// ═══════════════════════════════════════════════════════════════════════════
//  Ninja-Race — 2D-Platformer-Engine (Side-Scroller mit Vertikalität)
//
//  Gebaut nach Recherche (Mark of the Ninja + Level-/Animations-Prinzipien):
//   · Charakter = DUNKLE Silhouette + EIN Akzent (Schal). Kein Rim-Glow ("Floatie"),
//     Schal als verzögertes Stoff-Layer (kein "gelber Stock"), weicher Cast-Shadow.
//   · EINE surfaceY-Datenquelle → Boden-Linie und Füsse teilen sie → nie "Füsse im Boden".
//   · Modulares Terrain mit Vertikalität (Humps, Pits, Plattformen, Decken-Bars).
//   · Lauf: Kontakt→Passing→Push, Arme 180° gegenphasig, Spiegeln via scaleX.
//   · Hellere Dämmerungs-Palette; Hindernisse per Aktionsfarbe codiert.
//   · Stop-dann-Seil-Schwung-Sequenz an langen Schluchten.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef } from 'react';

// ── 16 Paletten: dunkle Silhouette + EINE Akzentfarbe (Schal/Augen) ───────────
const BODIES = ['#191d2e', '#1d1827', '#15211d', '#1a1b2a'];
const ACCENTS = ['#ffc24b', '#ff5a4d', '#4fd1c5', '#a78bfa', '#ff5fa2', '#6ee27a', '#ff9f3a', '#5ab3ff', '#c0f04a', '#5be0ff', '#ff6fae', '#ffb03a', '#7af0c0', '#ff7a5a', '#9fd0ff', '#ff85a1'];
export const RACE_PALETTE = ACCENTS.map((a, i) => [BODIES[i % BODIES.length], '#0e1019', a]);
export const celebOf = idx => idx % 8;

// ── Hindernis → Visual + Aktion + Farbcode ────────────────────────────────────
export const obsVisual = o => {
  const n = (o?.name || o?.type || '').toLowerCase();
  if (/ring|reck/.test(n)) return 'rings';
  if (/cargo|net|netz/.test(n)) return 'cargonet';
  if (/monkey|bar|salmon|peg|leiter|ladder|flying/.test(n)) return 'monkeybars';
  if (/spider/.test(n)) return 'spiderwall';
  if (/warp|wall|wand|cliff|klippe|curved/.test(n)) return 'warpedwall';
  if (/rope|seil|cannon|pendel|schaukel|final.?swing/.test(n)) return 'rope';
  if (/balance|beam|log|balken|bridge|brücke|unstable|slider|pipe|rolling|spinning/.test(n)) return 'beam';
  if (/gap|step|quintuple|float|jump|sprung|absprung|hüpf|devil|doppel/.test(n)) return 'gap';
  return 'gap';
};
const VIS_ACTION = { monkeybars: 'hang', rings: 'hang', cargonet: 'climb', warpedwall: 'climb', spiderwall: 'climb', rope: 'swing', beam: 'balance', gap: 'jump' };
export const ACTION_LABEL = {
  jump: { de: 'Sprung', en: 'Jump' }, hang: { de: 'Hangeln', en: 'Bars' },
  swing: { de: 'Seil-Schwung', en: 'Rope' }, climb: { de: 'Kletterwand', en: 'Climb' },
  balance: { de: 'Balance', en: 'Balance' }, run: { de: '', en: '' },
};
const ACTION_COLOR = { hang: '#ffc24b', swing: '#4fd1c5', climb: '#a78bfa', jump: '#f87171', balance: '#9fd0ff', run: '#9fb4dd' };

// ── Modulares Terrain-Level aus echten Hindernissen ───────────────────────────
//    surface-Punkte {x px, y Frac 0..1 (0=oben,1=unten)}. base = Standard-Bodenlinie.
// Ist das Item eine Plattform/Section (aus den Stage-Daten)?
const isPlatO = o => o?.type === 'section' || /plattform|platform|section/i.test(o?.name || '');
// Stage-Struktur: Plattform-Pads (10%) + gestreckte Hindernis-Abschnitte (90%), die
// den ganzen Bereich zwischen den Plattformen füllen. Speed=kurz/einfach, Final=wachsend/langsamer.
export const buildLevel = (obs, VW, stageName = '') => {
  const isSpeed = /speed/i.test(stageName), isFinal = /final/i.test(stageName);
  const obstacles = (obs || []).filter(o => o && !isPlatO(o)).slice(0, 40);
  const N = Math.max(obstacles.length, 4);
  const base = 0.76, startX = VW * 0.32;
  const pts = [], items = [], pads = [];
  const push = (x, y) => pts.push({ x, y });
  push(0, base);
  let x = startX;
  const sPadW = VW * 0.08;                                  // Start-Plattform
  pads.push({ x0: x - VW * 0.05, x1: x + sPadW, start: true });
  push(x + sPadW, base); x += sPadW;
  for (let i = 0; i < N; i++) {
    const o = obstacles[i] || {}, vis = obsVisual(o), action = VIS_ACTION[vis], name = o.name || '';
    const unitBase = isSpeed ? VW * 0.46 : VW * 0.62;
    const grow = isFinal ? 1 + (i / N) * 0.85 : (isSpeed ? 1 : 1 + (i / N) * 0.22);   // Final: später länger
    const unit = unitBase * grow, obsW = unit * 0.90, padW = unit * 0.10;             // 90/10
    const x0 = x, x1 = x + obsW, xc = (x0 + x1) / 2, e = Math.min(22, obsW * 0.2);
    if (vis === 'gap') { const haz = ['lava', 'spike', 'pit'][i % 3], dep = haz === 'spike' ? 0.92 : 0.99; push(x0, base); push(x0 + e, dep); push(x1 - e, dep); push(x1, base); items.push({ x0, x1, xc, vis, action, name, kind: 'gap', haz, dep }); }
    else if (vis === 'beam') { const top = base - 0.16; push(x0, base); push(x0 + 8, 0.95); push(x1 - 8, 0.95); push(x1, base); items.push({ x0, x1, xc, vis, action, name, kind: 'beam', topY: top }); }
    else if (vis === 'warpedwall' || vis === 'cargonet' || vis === 'spiderwall') { const top = base - 0.52; push(x0, base); push(x0 + obsW * 0.30, top); push(x1 - obsW * 0.30, top); push(x1, base); items.push({ x0, x1, xc, vis, action, name, kind: 'climb', topY: top }); }
    else if (vis === 'monkeybars' || vis === 'rings') { push(x0, base); push(x0 + 10, 0.99); push(x1 - 10, 0.99); push(x1, base); items.push({ x0, x1, xc, vis, action, name, kind: 'hang', barY: base - 0.42 }); }
    else if (vis === 'rope') { push(x0, base); push(x0 + 12, 1.0); push(x1 - 12, 1.0); push(x1, base); items.push({ x0, x1, xc, vis, action, name, kind: 'swing', pivotY: 0.03 }); }
    else { push(x0, base); push(x1, base); items.push({ x0, x1, xc, vis, action, name, kind: 'run' }); }
    x = x1;
    pads.push({ x0: x, x1: x + padW });                     // Landeplattform
    push(x, base); push(x + padW, base); x += padW;
  }
  const finishX = x + VW * 0.05;
  push(finishX, base); const worldW = finishX + VW * 0.36; push(worldW, base);
  const ys = pts.map(p => p.y);
  const yMin = Math.min(...ys) - 0.13, yMax = Math.max(...ys) + 0.06;
  return { N, isSpeed, isFinal, startX, finishX, worldW, items, pads, pts, base, VW, yMin, yMax };
};
const surfYF = (x, lvl) => {
  const p = lvl.pts;
  if (x <= p[0].x) return p[0].y;
  for (let i = 1; i < p.length; i++) if (x <= p[i].x) { const a = p[i - 1], b = p[i]; return a.y + (b.y - a.y) * ((x - a.x) / Math.max(1, b.x - a.x)); }
  return p[p.length - 1].y;
};
const progressToX = (p, lvl) => lvl.startX + Math.max(0, Math.min(1, p)) * (lvl.finishX - lvl.startX);
// Aktueller Hindernis-Abschnitt (Aktion füllt den ganzen Bereich zwischen den Plattformen)
const currentSeg = (x, lvl) => { for (const it of lvl.items) if (x >= it.x0 && x <= it.x1) return it; return null; };
const nearestItem = currentSeg;
export const getRunnerAction = (worldX, lvl, finished) => { if (finished) return 'celebrate'; const it = currentSeg(worldX, lvl); return it ? it.action : 'run'; };

// ── Demo-Timeline: läuft über Plattformen, überquert jedes Hindernis (Aktion), Stop vor dem Seil ─
const buildDemoTimeline = (lvl) => {
  const phases = []; let prev = 0;
  const pOf = xx => (xx - lvl.startX) / (lvl.finishX - lvl.startX);
  lvl.items.forEach(it => {
    const p0 = Math.max(0, Math.min(1, pOf(it.x0))), p1 = Math.max(0, Math.min(1, pOf(it.x1)));
    phases.push({ dur: 300, from: prev, to: p0 });                              // Anlauf auf Plattform
    if (it.action === 'swing') phases.push({ dur: 520, from: p0, to: p0 });     // Stop vor dem Seil
    phases.push({ dur: it.action === 'run' ? 240 : 1150, from: p0, to: p1 });   // Hindernis überqueren
    prev = p1;
  });
  phases.push({ dur: 520, from: prev, to: 1 });
  const total = phases.reduce((s, ph) => s + ph.dur, 0);
  return { total, at: t => { if (t >= total) return { p: 1, done: true }; let a = 0; for (const ph of phases) { if (t < a + ph.dur) return { p: ph.from + (ph.to - ph.from) * ((t - a) / ph.dur), done: false }; a += ph.dur; } return { p: 1, done: false }; } };
};

// ═══ NINJA-FIGUR — dunkle Silhouette + Akzent-Schal ═════════════════════════
export const NinjaFigure = ({ idx = 0, action = 'run', scale = 1, ghost = false }) => {
  const [body, bodyD, accent] = RACE_PALETTE[idx % RACE_PALETTE.length];
  const cls = `nf nf-${action}` + (action === 'celebrate' ? ` cel cel-${celebOf(idx)}` : '');
  return (
    <div className={cls} style={{ '--body': body, '--bodyD': bodyD, '--accent': accent, transform: `scale(${scale})`, transformOrigin: 'bottom center', opacity: ghost ? 0.5 : 1, filter: ghost ? 'grayscale(.5) brightness(.7)' : 'none' }}>
      <div className="nf-in">
        <div className="katana" />
        <div className="j hipB"><div className="seg thigh thighB"><div className="seg shin shinB"><div className="boot" /></div></div></div>
        <div className="j shoB"><div className="seg uarm uarmB"><div className="seg farm farmB"><div className="hand" /></div></div></div>
        <div className="j spine">
          <div className="torso"><i className="obi" /></div>
          <div className="scarf sc1"><div className="scarf sc2"><div className="scarf sc3" /></div></div>
          <div className="neck" />
          <div className="head"><i className="eye" /><i className="band" /></div>
        </div>
        <div className="j hipF"><div className="seg thigh thighF"><div className="seg shin shinF"><div className="boot" /></div></div></div>
        <div className="j shoF"><div className="seg uarm uarmF"><div className="seg farm farmF"><div className="hand" /></div></div></div>
      </div>
    </div>
  );
};

// ── CC0-Pixel-Sprite (Umschalt-Modus) — "Ninja Animated", OpenGameArt, CC0 ────
//    32×32-Frames; [col,row]. Lauf = step-end-Keyframe-Zyklus, sonst Einzelpose.
const SPRITE_FRAME = { idle: [0, 0], jump: [5, 0], climb: [2, 1], hang: [5, 0], swing: [5, 0], balance: [0, 0], celebrate: [5, 0], run: [1, 0] };
export const SpriteFigure = ({ idx = 0, action = 'run', scale = 1, ghost = false }) => {
  const fr = SPRITE_FRAME[action] || SPRITE_FRAME.run;
  const isRun = action === 'run';
  const hue = (idx % 16) * 22;
  return (
    <div className={`spr${isRun ? ' spr-run' : ''}${action === 'climb' || action === 'hang' || action === 'swing' ? ' spr-bob' : ''}`}
      style={{ backgroundPosition: isRun ? undefined : `${-fr[0] * 32}px ${-fr[1] * 32}px`, transform: `scale(${scale * 2.6})`, transformOrigin: 'bottom center', filter: `hue-rotate(${hue}deg) saturate(1.15)${ghost ? ' grayscale(.4) brightness(.8)' : ''}`, opacity: ghost ? 0.5 : 1 }} />
  );
};

// ── Hindernis-Aufbauten (terrain-bezogen) ─────────────────────────────────────
const Bars = ({ w, col }) => (
  <div style={{ position: 'absolute', left: -w / 2, top: 0, width: w, height: 6 }}>
    <div style={{ position: 'absolute', inset: 0, height: 5, background: '#6e5a34', borderRadius: 3, boxShadow: `0 0 6px ${col}55, 0 2px 4px rgba(0,0,0,.4)` }} />
    {Array.from({ length: Math.floor(w / 13) }).map((_, i) => <div key={i} style={{ position: 'absolute', left: 9 + i * 13, top: 5, width: 3, height: 11, background: '#52400f', borderRadius: 2 }} />)}
  </div>
);

// ── Eine Figur auf dem Terrain ────────────────────────────────────────────────
const RunnerOnCourse = ({ r, lvl, demoT, H, scale, ghost, sprite }) => {
  const worldX = progressToX(r.progress, lvl);
  const action = getRunnerAction(worldX, lvl, r.finished);
  const figH = 64 * scale, figW = 40 * scale;
  const Figure = sprite ? SpriteFigure : NinjaFigure;
  const it = nearestItem(worldX, lvl);
  let surfacePx = surfYF(worldX, lvl) * H;
  let bottom, pivot = false, climbing = false;
  if (action === 'hang') { const barY = (it?.barY ?? lvl.base - 0.32) * H; bottom = H - barY - figH; }
  else if (action === 'swing') { bottom = H - (lvl.base - 0.30) * H; pivot = true; }
  else if (action === 'jump') { bottom = H - lvl.base * H; }                 // über die Lücke, Hop-Arc
  else if (action === 'climb') { bottom = H - surfacePx; climbing = true; }   // folgt der Wand-Rampe
  else if (action === 'balance') { const beamY = (it?.topY ?? lvl.base - 0.16) * H; bottom = H - beamY; }  // auf dem Balken
  else { bottom = H - surfacePx; }                                            // run: Füsse auf Linie
  const trans = demoT != null ? 'bottom .18s linear' : 'left .55s cubic-bezier(.4,0,.2,1), bottom .25s ease';
  const inner = (
    <div className={action === 'jump' ? 'hop' : ''} style={{ position: 'relative' }}>
      <Figure idx={r.idx} action={action} scale={scale} ghost={ghost} />
      {ghost && <div style={{ position: 'absolute', bottom: figH + 5, left: '50%', transform: 'translateX(-50%)', fontSize: 13 }}>👑</div>}
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: worldX, bottom, transform: 'translateX(-50%)', transition: trans, zIndex: ghost ? 4 : 6 }}>
      {/* weicher Cast-Shadow (erdet die Füsse) */}
      {!pivot && !climbing && action !== 'hang' && <div style={{ position: 'absolute', bottom: -4, left: '50%', width: figW * 0.62, height: 7, transform: 'translateX(-50%)', borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(8,12,24,.5),transparent 70%)' }} />}
      {/* Lauf-Staub */}
      {action === 'run' && !ghost && <>
        <div className="dust" style={{ bottom: -2, left: '36%', width: 9, height: 6 }} />
        <div className="dust" style={{ bottom: -2, left: '54%', width: 7, height: 5, animationDelay: '.27s' }} />
      </>}
      {pivot ? <div className="swing-pivot">{inner}</div> : inner}
      {r.finished && !ghost && <div className="buzzburst" style={{ position: 'absolute', bottom: figH * 0.7, left: '62%' }}>★</div>}
    </div>
  );
};

// ═══ DIE WELT — heller Side-Scroller mit Terrain ════════════════════════════
export const RaceScene = ({ featured, leader, obs, demoElapsed, lang, sprite = false, stageName = '', lives = '∞', tall = true }) => {
  const sceneRef = useRef(null);
  const [sz, setSz] = useState({ w: 900, h: tall ? 320 : 168 });
  const camRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const el = sceneRef.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const upd = () => setSz({ w: el.clientWidth || 900, h: el.clientHeight || (tall ? 320 : 168) });
    const ro = new ResizeObserver(upd); ro.observe(el); upd();
    return () => ro.disconnect();
  }, []);
  const sw = sz.w, H = sz.h;
  const scale = tall ? Math.min(2.5, Math.max(1.4, H / 150)) : 1.1;
  const VW = sw, lvl = buildLevel(obs, VW, stageName);
  const demo = demoElapsed != null;
  // Demo: Fortschritt + Stop-Sequenzen aus der Timeline
  let feat = featured, demoDone = false;
  if (demo && featured) { const tl = buildDemoTimeline(lvl); const loop = demoElapsed % (tl.total + 2600); const st = tl.at(loop); demoDone = st.done; feat = { ...featured, progress: st.p, finished: st.done, active: !st.done }; }
  const same = !leader || (feat && leader.athleteId === feat.athleteId);
  const finishedNow = feat?.finished;
  const featX = feat ? progressToX(feat.progress, lvl) : 0;
  const fAct = feat && !finishedNow ? getRunnerAction(featX, lvl, false) : null;
  const fItem = feat && !finishedNow ? nearestItem(featX, lvl) : null;
  const featLbl = finishedNow ? '🎉 Buzzer!' : (fAct && fAct !== 'run' ? ACTION_LABEL[fAct]?.[lang] : null);
  const staminaPct = feat ? Math.max(12, Math.round(100 - (feat.finished ? 0.95 : feat.progress) * 62)) : 100;
  // Kamera (horizontal + vertikal): Läufer auf 34%/62%, Look-ahead, geklemmt, weich
  const featYpx = (feat ? surfYF(featX, lvl) : lvl.base) * H;
  const yLo = lvl.yMin * H, yHi = lvl.yMax * H;
  const tX = Math.max(0, Math.min(lvl.worldW - VW, featX - VW * 0.34 + VW * 0.12));
  const tY = Math.max(yLo, Math.min(Math.max(yLo, yHi - H), featYpx - H * 0.62));
  if (demo) { camRef.current.x += (tX - camRef.current.x) * 0.16; camRef.current.y += (tY - camRef.current.y) * 0.1; }
  else { camRef.current.x = tX; camRef.current.y = tY; }
  const cam = camRef.current.x, camY = camRef.current.y;
  const camTrans = demo ? 'none' : 'transform .3s cubic-bezier(.4,0,.2,1)';
  const lay = (fx, z, extra, fy = fx) => ({ position: 'absolute', top: 0, bottom: 0, left: 0, width: Math.max(lvl.worldW, VW), transform: `translate(${(-cam * fx).toFixed(1)}px, ${(-camY * fy).toFixed(1)}px)`, transition: camTrans, zIndex: z, ...extra });
  // Terrain-Pfad (schliesst am Welt-Boden yHi, deckt hohe Wände + tiefe Gruben)
  const terr = `M0,${yHi.toFixed(1)} ` + lvl.pts.map(p => `L${p.x.toFixed(1)},${(p.y * H).toFixed(1)}`).join(' ') + ` L${lvl.worldW},${yHi.toFixed(1)} Z`;
  const topLine = 'M' + lvl.pts.map(p => `${p.x.toFixed(1)},${(p.y * H).toFixed(1)}`).join(' L');
  return (
    <div ref={sceneRef} style={{ position: 'relative', height: tall ? 'clamp(260px, 46vh, 580px)' : 168, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,.1)', filter: 'saturate(1.18) contrast(1.06)' }}>
      {/* Himmel — Dämmerung, hell */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#2b3a66 0%,#4a5b8c 45%,#8fa3c4 100%)' }} />
      <div style={{ position: 'absolute', left: '10%', top: '14%', width: 40, height: 40, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%,#fff,#dfe8fb 65%,#cdd8f0)', boxShadow: '0 0 34px rgba(205,216,240,.6)', transform: `translateX(${-cam * 0.05}px)`, transition: camTrans }} />
      {/* Sterne dezent oben */}
      <div style={lay(0.1, 1)}>
        {Array.from({ length: Math.ceil(lvl.worldW / 120) + 6 }).map((_, i) => <div key={i} style={{ position: 'absolute', left: (i * 113 + 17) % Math.max(lvl.worldW, VW), top: `${(i * 31 + 3) % 26}%`, width: 1.5, height: 1.5, borderRadius: '50%', background: '#fff', opacity: .4 }} />)}
      </div>
      {/* Ferne Berge — hell/entsättigt (Aerial Haze) */}
      <div style={lay(0.28, 1, { filter: 'blur(.6px)', opacity: .9 })}>
        <svg style={{ position: 'absolute', bottom: `${(1 - lvl.base) * 100 - 4}%`, width: '100%', height: Math.round(H * 0.4) }} viewBox="0 0 1600 60" preserveAspectRatio="none">
          <polygon points="0,60 80,18 180,52 300,12 440,50 600,22 780,52 940,16 1120,50 1300,22 1480,50 1600,24 1600,60" fill="#7e93b8" />
        </svg>
      </div>
      {/* Mittlere Hügel */}
      <div style={lay(0.5, 2, { opacity: .92 })}>
        <svg style={{ position: 'absolute', bottom: `${(1 - lvl.base) * 100 - 8}%`, width: '100%', height: Math.round(H * 0.34) }} viewBox="0 0 1600 50" preserveAspectRatio="none">
          <polygon points="0,50 100,26 220,48 360,20 520,48 700,24 880,48 1060,22 1240,48 1420,26 1600,46 1600,50" fill="#566a96" />
        </svg>
      </div>
      {/* WELT-Vordergrund — Terrain, Hindernisse, Figuren */}
      <div style={lay(1, 4)}>
        {/* Terrain-Füllung + Oberkante */}
        <svg style={{ position: 'absolute', left: 0, top: yLo, width: lvl.worldW, height: yHi - yLo }} viewBox={`0 ${yLo.toFixed(1)} ${lvl.worldW} ${(yHi - yLo).toFixed(1)}`} preserveAspectRatio="none">
          <defs><linearGradient id="grnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#46506e" /><stop offset="1" stopColor="#262c44" /></linearGradient></defs>
          <path d={terr} fill="url(#grnd)" />
          <path d={topLine} fill="none" stroke="#8a96bd" strokeWidth="2.5" strokeLinejoin="round" />
          <path d={topLine} fill="none" stroke="#aeb9dd" strokeWidth="1" strokeLinejoin="round" opacity=".6" />
        </svg>
        {/* Plattform-Pads (Landeplattformen zwischen den Hindernissen) */}
        {lvl.pads.map((p, k) => p.start ? null : <div key={`pad${k}`} style={{ position: 'absolute', left: p.x0, top: lvl.base * H - 6, width: p.x1 - p.x0, height: 10, background: 'linear-gradient(180deg,#717c92,#3c4456)', borderTop: '2px solid #93a0b8', borderRadius: 2, boxShadow: '0 4px 7px rgba(0,0,0,.45)' }} />)}
        {/* Gap-Hazards: Lava (glühend) / Stacheln — füllen den ganzen Abschnitt */}
        {lvl.items.filter(it => it.kind === 'gap').map((it, k) => {
          const py = it.dep * H, w = it.x1 - it.x0;
          if (it.haz === 'lava') return (
            <div key={`lv${k}`} style={{ position: 'absolute', left: it.x0, top: py - 6, width: w }}>
              <div className="lava-glow" style={{ position: 'absolute', left: -10, top: -30, right: -10, height: 46, borderRadius: '50%', background: 'radial-gradient(70% 100% at 50% 100%,#ff7a10aa,#ff5e0000 72%)', mixBlendMode: 'screen', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(14, (1 - it.dep) * H + 6), background: 'linear-gradient(180deg,#ffae00,#ff5e00 40%,#c01200)', borderRadius: '14px 14px 4px 4px' }} />
              <div className="lava-surf" style={{ position: 'absolute', left: 4, right: 4, top: -2, height: 7, borderRadius: 4, background: 'linear-gradient(90deg,#ffe066,#ff7a10,#ffd24a,#ff7a10)', boxShadow: '0 0 10px #ff7a10' }} />
            </div>
          );
          if (it.haz === 'spike') { const n = Math.max(4, Math.round(w / 12)); return (
            <svg key={`sp${k}`} style={{ position: 'absolute', left: it.x0, top: py - 17, width: w, height: 19 }} viewBox={`0 0 ${w.toFixed(0)} 19`} preserveAspectRatio="none">
              {Array.from({ length: n }).map((_, j) => { const sw = w / n; return <polygon key={j} points={`${(j * sw).toFixed(1)},19 ${(j * sw + sw / 2).toFixed(1)},2 ${((j + 1) * sw).toFixed(1)},19`} fill="#c2cadb" stroke="#5a6072" strokeWidth=".5" />; })}
            </svg>
          ); }
          return null;
        })}
        {/* Hindernis-Aufbauten — füllen den ganzen Abschnitt zwischen den Plattformen */}
        {lvl.items.map((it, k) => {
          const w = it.x1 - it.x0, col = ACTION_COLOR[it.action];
          if (it.kind === 'hang') return <div key={k} style={{ position: 'absolute', left: it.x0, top: it.barY * H, width: w }}>
            {it.vis === 'rings'
              ? (() => { const m = Math.max(2, Math.round(w / 38)); return <><div style={{ position: 'absolute', left: 0, top: -5, width: w, height: 4, background: '#52400f', borderRadius: 2 }} />{Array.from({ length: m }).map((_, j) => { const cx = (j + 0.5) * (w / m); return <div key={j} style={{ position: 'absolute', left: cx - 7, top: 0 }}><div style={{ width: 2, height: 14, background: '#6e5a34', margin: '0 auto' }} /><div style={{ width: 14, height: 14, borderRadius: '50%', border: `3px solid ${col}`, boxShadow: `0 0 6px ${col}66` }} /></div>; })}</>; })()
              : <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: 6 }}><div style={{ position: 'absolute', inset: 0, height: 5, background: '#6e5a34', borderRadius: 3, boxShadow: `0 0 6px ${col}55,0 2px 4px rgba(0,0,0,.4)` }} />{Array.from({ length: Math.max(3, Math.round(w / 13)) }).map((_, j) => <div key={j} style={{ position: 'absolute', left: 9 + j * 13, top: 5, width: 3, height: 11, background: '#52400f', borderRadius: 2 }} />)}</div>}
          </div>;
          if (it.kind === 'swing') { const ropeH = (lvl.base - 0.30 - it.pivotY) * H; return <div key={k} style={{ position: 'absolute', left: it.xc, top: it.pivotY * H, width: 0, zIndex: 2 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: 10, height: 5, borderRadius: 2, background: '#9aa6c0', transform: 'translateX(-50%)' }} />
            <div style={{ position: 'absolute', left: 0, top: 4, width: 2.5, height: ropeH, transform: 'translateX(-50%)', background: 'repeating-linear-gradient(180deg,#b89a55,#8a6d30 5px)' }} />
            <div style={{ position: 'absolute', left: 0, top: ropeH + 4, width: 15, height: 15, borderRadius: '50%', transform: 'translateX(-50%)', background: `radial-gradient(circle at 35% 30%,${col},#5a4015)`, boxShadow: `0 0 8px ${col}66`, border: '2px solid #5a4015' }} />
          </div>; }
          if (it.kind === 'climb') return <div key={k} style={{ position: 'absolute', left: it.x0, top: it.topY * H, width: w, height: (lvl.base - it.topY) * H, background: it.vis === 'cargonet' ? 'repeating-linear-gradient(45deg,#3a3027 0 1.5px,transparent 1.5px 13px),repeating-linear-gradient(-45deg,#3a3027 0 1.5px,transparent 1.5px 13px)' : 'repeating-linear-gradient(0deg,#403a55 0 10px,#322e44 10px 12px),linear-gradient(90deg,#4a4458,#2e2b3c)', borderTop: `3px solid ${col}`, boxShadow: `0 0 10px ${col}55`, opacity: .9, clipPath: 'polygon(34% 0,66% 0,100% 100%,0 100%)' }} />;
          if (it.kind === 'beam') return <div key={k} style={{ position: 'absolute', left: it.x0, top: it.topY * H - 3, width: w, height: 5, background: col, borderRadius: 2, opacity: .85, boxShadow: `0 0 6px ${col}55` }} />;
          return null;
        })}
        {/* Hindernis-Namen dezent (über der Mitte) */}
        {lvl.items.map((it, k) => it.name ? <div key={`n${k}`} style={{ position: 'absolute', left: it.xc, top: (it.kind === 'gap' || it.kind === 'hang' || it.kind === 'swing' ? lvl.base + 0.04 : surfYF(it.xc, lvl)) * H + 4, transform: 'translateX(-50%)', fontSize: 7.5, fontWeight: 700, color: 'rgba(255,255,255,.4)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{it.name.length > 15 ? it.name.slice(0, 14) + '…' : it.name}</div> : null)}
        {/* Startplattform */}
        <div style={{ position: 'absolute', left: lvl.startX, top: lvl.base * H - 11, width: 0 }}>
          <div style={{ position: 'absolute', left: -43, width: 86, height: 11, borderRadius: 3, background: 'repeating-linear-gradient(90deg,#5a6584,#5a6584 5px,#3a4258 5px,#3a4258 10px)', border: '1px solid #76829f' }} />
          <div style={{ position: 'absolute', left: -36, top: -Math.round((1 - lvl.base) * H * 0.6), background: '#2aa35a', color: '#fff', fontSize: 10, fontWeight: 900, letterSpacing: '.12em', padding: '2px 11px', borderRadius: 4, border: '2px solid #fff', whiteSpace: 'nowrap' }}>START</div>
        </div>
        {/* Ziel-Buzzer + ZIEL */}
        <div style={{ position: 'absolute', left: lvl.finishX, top: lvl.base * H, width: 0, zIndex: 8 }}>
          <div style={{ position: 'absolute', left: 0, top: -52, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className={finishedNow ? 'buzz-dome lit' : 'buzz-dome'} />
            <div style={{ width: 11, height: 46, background: 'linear-gradient(90deg,#3a3a44,#5a5a66)', borderRadius: 2 }} />
          </div>
          <div style={{ position: 'absolute', left: 0, top: -Math.round((1 - lvl.base) * H * 0.62) - 52, transform: 'translateX(-50%)', background: '#e23', color: '#fff', fontSize: 10, fontWeight: 900, letterSpacing: '.12em', padding: '2px 11px', borderRadius: 4, border: '2px solid #fff', whiteSpace: 'nowrap' }}>ZIEL</div>
        </div>
        {/* Figuren */}
        {!same && leader && <RunnerOnCourse r={leader} lvl={lvl} demoT={demo ? demoElapsed : null} H={H} scale={scale} ghost sprite={sprite} />}
        {feat && <RunnerOnCourse r={feat} lvl={lvl} demoT={demo ? demoElapsed : null} H={H} scale={scale} sprite={sprite} />}
      </div>
      {/* Vordergrund-Gras (1.25× — whoosh) */}
      <div style={lay(1.25, 7)}>
        {Array.from({ length: Math.ceil(lvl.worldW / (VW * 0.5)) }).map((_, i) => (
          <div key={i} style={{ position: 'absolute', left: VW * 0.15 + i * VW * 0.5, bottom: 0, width: 26, height: 13, transform: 'translateX(-50%)', borderRadius: '50% 50% 0 0', background: 'linear-gradient(#2e5a22,#16320f)' }} />
        ))}
      </div>
      {/* Dampf-Schwaden (Metal-Slug-Atmosphäre) */}
      <div style={lay(0.7, 5)}>
        {Array.from({ length: Math.ceil(lvl.worldW / (VW * 0.7)) }).map((_, i) => (
          <div key={i} className="steam" style={{ position: 'absolute', left: VW * 0.3 + i * VW * 0.7, top: `${48 + (i % 3) * 13}%`, width: 44, height: 44, animationDelay: `${(i % 5) * 0.9}s` }} />
        ))}
      </div>
      {/* Vignette (Tiefe) */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9, background: 'radial-gradient(125% 125% at 50% 36%, transparent 52%, rgba(8,10,22,.5))' }} />
      {/* HUD — Stamina-Leiste + Leben (oben links, im Stil der Game-Referenz) */}
      <div style={{ position: 'absolute', left: 9, top: 8, zIndex: 12, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', height: 17 }}>
          <div style={{ width: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(#39456a,#1a2236)', border: '1px solid #5a6a8c', borderRight: 'none', borderRadius: '3px 0 0 3px', fontSize: 11, color: '#ffd23f', textShadow: '0 0 4px rgba(255,210,63,.6)' }}>⚡</div>
          <div style={{ position: 'relative', width: Math.min(VW * 0.32, 240), height: 17, background: '#0e1626', border: '1px solid #5a6a8c', borderRadius: '0 3px 3px 0', overflow: 'hidden' }}>
            <div style={{ width: `${staminaPct}%`, height: '100%', background: 'linear-gradient(180deg,#8fc8ff,#2a7fd4)', boxShadow: 'inset 0 -3px 5px rgba(0,0,0,.35)', transition: 'width .3s' }} />
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, background: 'linear-gradient(#e04b3a,#a01f12)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 1px,transparent 1px 9px)' }} />
          </div>
        </div>
        <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.14em', color: 'rgba(255,255,255,.7)', marginLeft: 25, marginTop: 1.5 }}>STAMINA</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, marginLeft: 2 }}>
          <span style={{ fontSize: 14, color: '#ff4d5e', filter: 'drop-shadow(0 0 3px rgba(255,77,94,.6))', lineHeight: 1 }}>❤</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: lives === '∞' ? 17 : 14, fontWeight: 800, color: '#fff', lineHeight: 1, textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>{lives}</span>
        </div>
      </div>
      {/* Aktions-Label (oben mitte) */}
      {featLbl && <div style={{ position: 'absolute', left: '50%', top: 8, transform: 'translateX(-50%)', zIndex: 12, fontSize: 10, fontWeight: 800, letterSpacing: '.02em', color: '#fff', background: `${fItem ? ACTION_COLOR[fAct] : '#000'}dd`, padding: '3px 10px', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,.4)', pointerEvents: 'none' }}>{featLbl}</div>}
      {finishedNow && <div style={{ position: 'absolute', right: '7%', top: '11%', zIndex: 11, fontSize: 13, fontWeight: 900, color: '#ffe08a', textShadow: '0 1px 3px rgba(0,0,0,.5)', animation: 'buzzPop .6s ease-out' }}>BUZZ!</div>}
    </div>
  );
};

// ═══ STYLES — dunkle Silhouette + sauberer Lauf ═════════════════════════════
export const RaceStyles = () => (
  <style>{`
.nf{position:relative;width:40px;height:64px;transform-origin:bottom center}
.nf-in{position:absolute;inset:0}
.nf .j{position:absolute;width:0;height:0}
.nf .hipF,.nf .hipB{left:20px;top:37px}
.nf .shoF,.nf .shoB{left:20px;top:20px}
/* getaperte Kapsel-Gliedmassen — dunkel, dezente Form-Schattierung, KEIN Rim-Glow */
.nf .seg{position:absolute;background:linear-gradient(100deg,var(--body),var(--bodyD));box-shadow:inset -1px -1px 2px rgba(0,0,0,.4)}
.nf .thigh{left:-3.5px;top:0;width:7px;height:15px;border-radius:4px 4px 3px 3px;transform-origin:top center}
.nf .shin{left:-3px;top:13px;width:6px;height:14px;border-radius:3px 3px 4px 4px;transform-origin:top center}
.nf .boot{position:absolute;left:-3.5px;top:11px;width:11px;height:5px;border-radius:3px 5px 3px 2px;background:#0c0c12;transform-origin:left center}
.nf .uarm{left:-2.7px;top:0;width:5.4px;height:13px;border-radius:3px;transform-origin:top center}
.nf .farm{left:-2.4px;top:11px;width:5px;height:12px;border-radius:3px 3px 4px 4px;transform-origin:top center}
.nf .hand{position:absolute;left:-2.7px;top:10px;width:5.4px;height:5.4px;border-radius:50% 50% 50% 40%;background:#0d0d14}
.nf .spine{left:20px;top:37px;transform-origin:bottom center}
.nf .torso{position:absolute;left:-8px;top:-24px;width:16px;height:25px;border-radius:7px 8px 5px 5px;background:linear-gradient(102deg,var(--body),var(--bodyD));box-shadow:inset -2px -1px 3px rgba(0,0,0,.45)}
.nf .obi{position:absolute;left:-1px;top:15px;width:18px;height:4px;background:var(--accent);opacity:.85;border-radius:1px}
.nf .neck{position:absolute;left:-2.5px;top:-27px;width:5px;height:6px;background:var(--bodyD)}
/* Kopf: Kapuze (dunkel) + leuchtendes Auge + Stirnband */
.nf .head{position:absolute;left:-7.5px;top:-40px;width:15px;height:15px;border-radius:54% 54% 46% 46%/60% 60% 42% 42%;background:linear-gradient(106deg,var(--body),var(--bodyD));box-shadow:inset -1px -1px 2px rgba(0,0,0,.45);transform-origin:bottom center}
.nf .head::after{content:"";position:absolute;left:2px;top:7px;width:11px;height:4px;background:#08080d;border-radius:2px}
.nf .eye{position:absolute;left:10px;top:7px;width:3px;height:2.4px;border-radius:50%;background:var(--accent);box-shadow:0 0 5px 1px var(--accent)}
.nf .band{position:absolute;left:-1px;top:4.5px;width:17px;height:3px;background:var(--accent);opacity:.9;border-radius:2px}
.nf .band::after{content:"";position:absolute;left:-9px;top:0;width:10px;height:2.6px;background:var(--accent);opacity:.7;border-radius:2px;transform-origin:right center;animation:tailFlap .55s ease-in-out infinite}
.nf .katana{position:absolute;left:9px;top:9px;width:24px;height:3px;border-radius:2px;background:linear-gradient(90deg,#23232c,#44444f);transform:rotate(-32deg);transform-origin:left center}
/* Schal — Stoff-Layer, strömt nach hinten, verzögerter Nachlauf */
.nf .scarf{position:absolute;height:5px;border-radius:1px 5px 5px 1px;background:linear-gradient(90deg,var(--accent),color-mix(in srgb,var(--accent) 75%,#000));transform-origin:right center}
.nf .sc1{left:-15px;top:-22px;width:13px;animation:scarfW 1.3s ease-in-out infinite}
.nf .sc2{left:-11px;top:.3px;width:11px;height:4.2px;animation:scarfW 1.3s ease-in-out infinite -.09s}
.nf .sc3{left:-9px;top:.3px;width:9px;height:3.4px;opacity:.9;animation:scarfW 1.3s ease-in-out infinite -.18s}
/* Grundpose */
.nf .thighF{transform:rotate(8deg)}.nf .thighB{transform:rotate(-9deg)}
.nf .shinF{transform:rotate(-8deg)}.nf .shinB{transform:rotate(-12deg)}
.nf .uarmF{transform:rotate(15deg)}.nf .uarmB{transform:rotate(-14deg)}
.nf .farmF,.nf .farmB{transform:rotate(-26deg)}
@keyframes tailFlap{0%,100%{transform:rotate(8deg)}50%{transform:rotate(-15deg)}}
@keyframes scarfW{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(13deg)}}
/* IDLE */
.nf-idle .nf-in{animation:breathe 3s ease-in-out infinite}
@keyframes breathe{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.4px)}}
/* ── RUN: Kontakt(0%)→Recoil(25%)→Passing(50%)→Push(75%) · Arme gegenphasig ── */
.nf-run .nf-in{animation:bob .5s cubic-bezier(.4,0,.6,1) infinite}
.nf-run .spine{transform:rotate(11deg)}
.nf-run .thighF{animation:thF .5s cubic-bezier(.5,0,.5,1) infinite}
.nf-run .shinF{animation:shF .5s cubic-bezier(.5,0,.5,1) infinite}
.nf-run .thighB{animation:thF .5s cubic-bezier(.5,0,.5,1) infinite -.25s}
.nf-run .shinB{animation:shF .5s cubic-bezier(.5,0,.5,1) infinite -.25s}
.nf-run .uarmF{animation:uaF .5s cubic-bezier(.45,0,.55,1) infinite -.25s}
.nf-run .uarmB{animation:uaF .5s cubic-bezier(.45,0,.55,1) infinite}
.nf-run .farmF{transform:rotate(-70deg)}.nf-run .farmB{transform:rotate(-82deg)}
.nf-run .head{animation:headBob .5s ease-in-out infinite}
@keyframes bob{0%{transform:translateY(-1px)}25%{transform:translateY(-5px)}50%{transform:translateY(0)}75%{transform:translateY(-5px)}100%{transform:translateY(-1px)}}
@keyframes thF{0%{transform:rotate(26deg)}25%{transform:rotate(6deg)}50%{transform:rotate(-26deg)}75%{transform:rotate(-6deg)}100%{transform:rotate(26deg)}}
@keyframes shF{0%{transform:rotate(-8deg)}25%{transform:rotate(-30deg)}50%{transform:rotate(-18deg)}75%{transform:rotate(-78deg)}100%{transform:rotate(-8deg)}}
@keyframes uaF{0%{transform:rotate(-32deg)}50%{transform:rotate(32deg)}100%{transform:rotate(-32deg)}}
@keyframes headBob{0%,100%{transform:rotate(2deg)}50%{transform:rotate(5deg)}}
/* ── JUMP: Antizipation → Stretch → Tuck → Squash ── */
.hop{animation:hopArc 1s cubic-bezier(.3,0,.4,1) infinite}
@keyframes hopArc{0%{transform:translateY(0) scaleY(.92) scaleX(1.06)}12%{transform:translateY(0) scaleY(1.12) scaleX(.9)}45%{transform:translateY(-40px) scaleY(1) scaleX(1)}60%{transform:translateY(-40px)}88%{transform:translateY(0) scaleY(.82) scaleX(1.14)}100%{transform:translateY(0) scaleY(1) scaleX(1)}}
.nf-jump .spine{transform:rotate(-12deg)}
.nf-jump .thighF{transform:rotate(52deg)}.nf-jump .shinF{transform:rotate(-92deg)}
.nf-jump .thighB{transform:rotate(20deg)}.nf-jump .shinB{transform:rotate(-66deg)}
.nf-jump .uarmF{transform:rotate(-54deg)}.nf-jump .uarmB{transform:rotate(-70deg)}
.nf-jump .farmF,.nf-jump .farmB{transform:rotate(-34deg)}
/* ── HANG: Arm-über-Arm + Körper-Pendel + Knie ── */
.nf-hang .nf-in{animation:hangBody 1.1s ease-in-out infinite}
.nf-hang .uarmF{animation:hangArmA 1.1s ease-in-out infinite}
.nf-hang .uarmB{animation:hangArmA 1.1s ease-in-out infinite -.55s}
.nf-hang .farmF,.nf-hang .farmB{transform:rotate(8deg)}
.nf-hang .thighF{animation:hangLegA 1.1s ease-in-out infinite}
.nf-hang .thighB{animation:hangLegB 1.1s ease-in-out infinite}
.nf-hang .shinF,.nf-hang .shinB{transform:rotate(-26deg)}
@keyframes hangBody{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
@keyframes hangArmA{0%{transform:rotate(168deg)}25%{transform:rotate(150deg)}50%{transform:rotate(170deg)}75%{transform:rotate(196deg)}100%{transform:rotate(168deg)}}
@keyframes hangLegA{0%,100%{transform:rotate(16deg)}50%{transform:rotate(-12deg)}}
@keyframes hangLegB{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(24deg)}}
/* ── SWING ── */
.swing-pivot{transform-origin:top center;animation:swingPend 1.5s cubic-bezier(.37,0,.63,1) infinite alternate}
@keyframes swingPend{0%{transform:rotate(-34deg)}100%{transform:rotate(38deg)}}
.nf-swing .uarmF,.nf-swing .uarmB{transform:rotate(174deg)}
.nf-swing .farmF,.nf-swing .farmB{transform:rotate(3deg)}
.nf-swing .thighF{animation:swingLeg 1.5s cubic-bezier(.37,0,.63,1) infinite alternate}
.nf-swing .thighB{animation:swingLeg 1.5s cubic-bezier(.37,0,.63,1) infinite alternate}
.nf-swing .shinF,.nf-swing .shinB{transform:rotate(-22deg)}
@keyframes swingLeg{0%{transform:rotate(-40deg)}100%{transform:rotate(30deg)}}
/* ── CLIMB ── */
.nf-climb .nf-in{animation:climbUp 1s ease-in-out infinite}
.nf-climb .spine{transform:rotate(4deg)}
.nf-climb .uarmF{animation:climbArmA 1s ease-in-out infinite}
.nf-climb .uarmB{animation:climbArmB 1s ease-in-out infinite}
.nf-climb .farmF,.nf-climb .farmB{transform:rotate(-34deg)}
.nf-climb .thighF{animation:climbLegA 1s ease-in-out infinite}
.nf-climb .thighB{animation:climbLegB 1s ease-in-out infinite}
.nf-climb .shinF,.nf-climb .shinB{transform:rotate(-46deg)}
@keyframes climbUp{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}
@keyframes climbArmA{0%,100%{transform:rotate(150deg)}50%{transform:rotate(116deg)}}
@keyframes climbArmB{0%,100%{transform:rotate(116deg)}50%{transform:rotate(150deg)}}
@keyframes climbLegA{0%,100%{transform:rotate(40deg)}50%{transform:rotate(10deg)}}
@keyframes climbLegB{0%,100%{transform:rotate(10deg)}50%{transform:rotate(40deg)}}
/* ── BALANCE ── */
.nf-balance .nf-in{animation:balWob 1.6s ease-in-out infinite}
.nf-balance .spine{transform:rotate(2deg)}
.nf-balance .uarmF{transform:rotate(86deg)}.nf-balance .uarmB{transform:rotate(-90deg)}
.nf-balance .farmF{transform:rotate(8deg)}.nf-balance .farmB{transform:rotate(-8deg)}
.nf-balance .thighF{animation:balLeg 1.6s ease-in-out infinite}
.nf-balance .thighB{animation:balLeg 1.6s ease-in-out infinite -.8s}
.nf-balance .shinF,.nf-balance .shinB{transform:rotate(-14deg)}
@keyframes balWob{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
@keyframes balLeg{0%,100%{transform:rotate(-10deg)}50%{transform:rotate(14deg)}}
/* ── CELEBRATE (8) ── */
.cel .farmF,.cel .farmB{transform:rotate(-30deg)}
.cel-0 .nf-in{animation:hopS .5s ease-in-out infinite}
.cel-0 .uarmF,.cel-0 .uarmB{animation:pump .5s ease-in-out infinite}
@keyframes pump{0%,100%{transform:rotate(-120deg)}50%{transform:rotate(-168deg)}}
@keyframes hopS{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.cel-1 .nf-in{animation:flip 1.3s cubic-bezier(.5,0,.5,1) infinite}
@keyframes flip{0%,18%{transform:translateY(0) rotate(0)}55%{transform:translateY(-24px) rotate(-360deg)}80%,100%{transform:translateY(0) rotate(-360deg)}}
.cel-1 .thighF{transform:rotate(40deg)}.cel-1 .shinF{transform:rotate(-70deg)}.cel-1 .thighB{transform:rotate(30deg)}.cel-1 .shinB{transform:rotate(-60deg)}
.cel-1 .uarmF,.cel-1 .uarmB{transform:rotate(150deg)}
.cel-2 .nf-in{animation:planeLean 1.2s ease-in-out infinite}
.cel-2 .uarmF{transform:rotate(96deg)}.cel-2 .uarmB{transform:rotate(-96deg)}
.cel-2 .farmF,.cel-2 .farmB{transform:rotate(0)}
@keyframes planeLean{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
.cel-3{animation:slide 1.6s ease-in-out infinite}
.cel-3 .spine{transform:rotate(16deg)}
.cel-3 .thighF{transform:rotate(40deg)}.cel-3 .shinF{transform:rotate(-20deg)}
.cel-3 .thighB{transform:rotate(-46deg)}.cel-3 .shinB{transform:rotate(-90deg)}
.cel-3 .uarmF,.cel-3 .uarmB{transform:rotate(-150deg)}
@keyframes slide{0%{transform:translateX(-6px)}40%{transform:translateX(5px)}100%{transform:translateX(-6px)}}
.cel-4 .nf-in{animation:breathe 1s ease-in-out infinite}
.cel-4 .uarmF{transform:rotate(120deg)}.cel-4 .uarmB{transform:rotate(-120deg)}
.cel-4 .farmF{animation:flexA .7s ease-in-out infinite}.cel-4 .farmB{animation:flexA .7s ease-in-out infinite}
@keyframes flexA{0%,100%{transform:rotate(-150deg)}50%{transform:rotate(-120deg)}}
.cel-5 .spine{animation:bow 1.6s ease-in-out infinite}
.cel-5 .uarmF{transform:rotate(40deg)}.cel-5 .uarmB{transform:rotate(-30deg)}
@keyframes bow{0%,100%{transform:rotate(8deg)}50%{transform:rotate(46deg)}}
.cel-6 .nf-in{animation:spin 1.1s linear infinite}
.cel-6 .thighF{transform:rotate(50deg)}.cel-6 .thighB{transform:rotate(-50deg)}
.cel-6 .shinF,.cel-6 .shinB{transform:rotate(-30deg)}
.cel-6 .uarmF{transform:rotate(70deg)}.cel-6 .uarmB{transform:rotate(-70deg)}
@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
.cel-7{animation:bigHop .7s cubic-bezier(.4,0,.5,1) infinite}
.cel-7 .uarmF,.cel-7 .uarmB{transform:rotate(165deg)}
.cel-7 .thighF{transform:rotate(24deg)}.cel-7 .shinF{transform:rotate(-50deg)}
.cel-7 .thighB{transform:rotate(-18deg)}.cel-7 .shinB{transform:rotate(-44deg)}
@keyframes bigHop{0%,100%{transform:translateY(0)}45%{transform:translateY(-13px)}}
/* Buzzer */
.buzz-dome{width:28px;height:16px;border-radius:14px 14px 3px 3px;background:radial-gradient(circle at 40% 25%,#ff8a8a,#d11 65%,#900);box-shadow:0 0 0 2px #700,0 2px 4px rgba(0,0,0,.4)}
.buzz-dome.lit{background:radial-gradient(circle at 40% 25%,#fff,#ff5a5a 55%,#e00);box-shadow:0 0 18px 5px rgba(255,80,80,.9),0 0 0 2px #f33;animation:buzzPulse .5s ease-in-out infinite}
@keyframes buzzPulse{0%,100%{box-shadow:0 0 18px 5px rgba(255,80,80,.9),0 0 0 2px #f33}50%{box-shadow:0 0 28px 9px rgba(255,110,110,1),0 0 0 2px #f55}}
@keyframes buzzPop{0%{transform:scale(.3);opacity:0}50%{transform:scale(1.25);opacity:1}100%{transform:scale(1);opacity:1}}
.buzzburst{color:#ffe08a;font-size:14px;animation:sparkle .8s ease-out infinite;text-shadow:0 0 6px rgba(255,214,10,.9)}
@keyframes sparkle{0%{transform:scale(.4) rotate(0);opacity:0}40%{opacity:1}100%{transform:scale(1.3) rotate(40deg);opacity:0}}
/* ── CC0-Pixel-Sprite-Modus ── */
.spr{width:32px;height:32px;background-image:url(/sprites/ninja-sheet.png);background-repeat:no-repeat;image-rendering:pixelated;image-rendering:crisp-edges}
.spr-run{animation:spriteRun .46s step-end infinite}
.spr-bob{animation:sprBob .9s ease-in-out infinite}
@keyframes spriteRun{0%{background-position:-32px 0}25%{background-position:-64px 0}50%{background-position:-128px 0}75%{background-position:-64px 0}100%{background-position:-32px 0}}
@keyframes sprBob{0%,100%{margin-top:0}50%{margin-top:-2px}}
/* ── Metal-Slug Juice: Lava · Dampf · Staub ── */
.lava-glow{animation:lavaPulse 1.8s ease-in-out infinite}
.lava-surf{animation:lavaSurf 2.4s ease-in-out infinite}
@keyframes lavaPulse{0%,100%{opacity:.65;transform:scaleY(1)}50%{opacity:1;transform:scaleY(1.28)}}
@keyframes lavaSurf{0%,100%{filter:brightness(1)}50%{filter:brightness(1.4)}}
.steam{border-radius:50%;background:radial-gradient(#cfd8ea,#cfd8ea00 65%);filter:blur(5px);opacity:.3;mix-blend-mode:screen;animation:steamRise 5s linear infinite}
@keyframes steamRise{0%{transform:translateY(0) scale(.5);opacity:0}25%{opacity:.34}100%{transform:translateY(-70px) scale(1.5);opacity:0}}
.dust{position:absolute;border-radius:50%;background:radial-gradient(#cdbb95,#cdbb9500 70%);pointer-events:none;animation:dustPuff .55s ease-out infinite}
@keyframes dustPuff{0%{transform:translate(0,0) scale(.4);opacity:.55}100%{transform:translate(-16px,1px) scale(1.4);opacity:0}}
`}</style>
);
