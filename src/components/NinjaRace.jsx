// ═══════════════════════════════════════════════════════════════════════════
//  Ninja-Race — 2D-Platformer-Engine (Side-Scroller) für die Live-Ninja-Comp.
//
//  Gebaut nach Recherche eines Experten-Panels (run-cycle, brachiation,
//  character-art, camera/parallax). Kernprinzipien:
//   · Charakter = artikuliertes Skelett aus getaperten Kapsel-Gliedmassen,
//     Kapuze + leuchtende Augen, fliegender Schal (secondary motion), 3-Schicht-
//     Shading mit kühlem Rim-Light. Kein „Pixel-Zeug".
//   · Animationen: echte 4-Posen-Laufzyklen, Arm-über-Arm-Hangeln mit Körper-
//     Pendel, Seil-Pendel, Wand-Mantle — alles mit Easing, nie linear.
//   · Welt: ECHTE 30–50 Hindernisse + Plattformen, Kamera folgt dem Läufer
//     (Lerp + Look-ahead), 6 Parallax-Ebenen + gekachelter Boden + Vordergrund
//     → Scrollen wird spürbar.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef } from 'react';

// ── 16 Charakter-Paletten: gedämpfter tiefer Anzug + EINE gesättigte Akzentfarbe ─
//    [suit, suitDark, accent] — Akzent = Schal · Gürtel · leuchtende Augen
export const RACE_PALETTE = [
  ['#2a3550', '#171f33', '#ffd23f'], ['#26402f', '#15271c', '#ff5fa2'],
  ['#3a2740', '#241829', '#4fd6c4'], ['#2e3138', '#1b1e23', '#ff8a3d'],
  ['#45222a', '#2a1318', '#ffd23f'], ['#2f2a55', '#1c1936', '#6ee27a'],
  ['#24403f', '#142726', '#ff5e3a'], ['#401f28', '#271218', '#5ab3ff'],
  ['#1f3a2a', '#112318', '#ffb03a'], ['#3d2030', '#26131e', '#9fe0ff'],
  ['#2a323c', '#181e25', '#ffd23f'], ['#3a3a22', '#232314', '#ff6fae'],
  ['#243050', '#141d33', '#ff9f3a'], ['#332550', '#1e1633', '#7af0c0'],
  ['#3a2c20', '#231a13', '#ffd23f'], ['#2a2a33', '#17171f', '#ff5e3a'],
];
export const celebOf = idx => idx % 8;

// ── Hindernis → Visual + Aktion ───────────────────────────────────────────────
export const obsVisual = o => {
  const n = (o?.name || o?.type || '').toLowerCase();
  if (/ring|reck/.test(n)) return 'rings';
  if (/cargo|net|netz/.test(n)) return 'cargonet';
  if (/monkey|bar|salmon|peg|leiter|ladder/.test(n)) return 'monkeybars';
  if (/spider/.test(n)) return 'spiderwall';
  if (/warp|wall|wand|cliff|klippe/.test(n)) return 'warpedwall';
  if (/rope|seil|swing|cannon|pendel|schaukel/.test(n)) return 'rope';
  if (/balance|beam|log|balken|bridge|brücke|unstable|slider|pipe|rolling/.test(n)) return 'beam';
  if (/gap|step|quintuple|float|jump|sprung|absprung|hüpf/.test(n)) return 'gap';
  return 'gap';
};
const VISUAL_ACTION = { monkeybars: 'hang', rings: 'hang', cargonet: 'climb', warpedwall: 'climb', spiderwall: 'climb', rope: 'swing', beam: 'balance', gap: 'jump' };
export const ACTION_LABEL = {
  jump: { de: 'Sprung', en: 'Jump' }, hang: { de: 'Hangeln', en: 'Bars' },
  swing: { de: 'Seil-Schwung', en: 'Rope' }, climb: { de: 'Kletterwand', en: 'Climb' },
  balance: { de: 'Balance', en: 'Balance' }, run: { de: '', en: '' },
};

// ── Level-Layout aus echten Hindernissen ──────────────────────────────────────
//    VW = Viewport-Breite px. Hindernisse ~ alle 0.5·VW → 2 pro Screen sichtbar.
export const buildLevel = (obs, VW) => {
  const list = (obs || []).filter(Boolean).slice(0, 50);
  const N = Math.max(list.length, 5);
  const SP = VW * 0.52;           // Abstand pro Hindernis
  const startX = VW * 0.34;       // Startplattform
  const firstX = VW * 0.9;        // erstes Hindernis
  const items = list.map((o, i) => {
    const vis = obsVisual(o);
    return { x: firstX + i * SP, vis, action: VISUAL_ACTION[vis], name: o.name || '', i };
  });
  const lastX = items.length ? items[items.length - 1].x : firstX;
  const finishX = lastX + VW * 0.7;
  const worldW = finishX + VW * 0.55;
  // Plattformen: zwischen je ~3. Hindernis ein erhöhtes Podest (gestaffelte Höhe)
  const platforms = [];
  for (let i = 0; i < items.length - 1; i++) {
    if (i % 3 === 1) {
      const a = items[i].x, b = items[i + 1].x;
      const lift = 34 + ((i / 3 | 0) % 3) * 22;     // 34 · 56 · 78 px gestaffelt
      platforms.push({ x0: a + SP * 0.28, x1: b - SP * 0.28, lift });
    }
  }
  return { N, SP, startX, finishX, worldW, items, platforms, VW };
};
const progressToX = (p, lvl) => lvl.startX + Math.max(0, Math.min(1, p)) * (lvl.finishX - lvl.startX);
const nearestItem = (x, lvl) => {
  let best = null, bd = lvl.SP * 0.42;
  for (const it of lvl.items) { const d = Math.abs(x - it.x); if (d < bd) { bd = d; best = it; } }
  return best;
};
export const getRunnerAction = (worldX, lvl, finished) => {
  if (finished) return 'celebrate';
  const it = nearestItem(worldX, lvl);
  return it ? it.action : 'run';
};
const platformLiftAt = (x, lvl) => { for (const p of lvl.platforms) if (x >= p.x0 && x <= p.x1) return p.lift; return 0; };

// ═══ DETAILLIERTE NINJA-FIGUR ═══════════════════════════════════════════════
export const NinjaFigure = ({ idx = 0, action = 'run', scale = 1, ghost = false }) => {
  const [suit, suitD, accent] = RACE_PALETTE[idx % RACE_PALETTE.length];
  const cls = `nf nf-${action}` + (action === 'celebrate' ? ` cel cel-${celebOf(idx)}` : '');
  return (
    <div className={cls} style={{ '--suit': suit, '--suitD': suitD, '--accent': accent, transform: `scale(${scale})`, transformOrigin: 'bottom center', opacity: ghost ? 0.4 : 1, filter: ghost ? 'grayscale(.4) brightness(.85)' : 'none' }}>
      <div className="nf-in">
        {/* Katana auf dem Rücken (ganz hinten) */}
        <div className="katana" />
        {/* hinteres Bein + Arm */}
        <div className="j hipB"><div className="seg thigh thighB"><div className="seg shin shinB"><div className="boot" /></div></div></div>
        <div className="j shoB"><div className="seg uarm uarmB"><div className="seg farm farmB"><div className="hand" /></div></div></div>
        {/* Rumpf */}
        <div className="j spine">
          <div className="torso"><i className="fold" /><i className="obi" /><i className="obiknot" /></div>
          {/* Schal — gekettete Segmente, strömt nach hinten mit Nachlauf (secondary motion) */}
          <div className="scarf sc1"><div className="scarf sc2"><div className="scarf sc3" /></div></div>
          <div className="neck" />
          <div className="head"><i className="hood" /><i className="band" /><i className="eye" /></div>
        </div>
        {/* vorderes Bein + Arm (vorne) */}
        <div className="j hipF"><div className="seg thigh thighF"><div className="seg shin shinF"><div className="boot" /></div></div></div>
        <div className="j shoF"><div className="seg uarm uarmF"><div className="seg farm farmF"><div className="hand" /></div></div></div>
      </div>
    </div>
  );
};

// ── Hindernis-Grafiken ────────────────────────────────────────────────────────
const Posts = ({ h, w }) => (<>
  <div style={{ position: 'absolute', left: -w / 2, bottom: 0, width: 6, height: h, background: 'linear-gradient(90deg,#7a5a2a,#4a3415)', borderRadius: 2 }} />
  <div style={{ position: 'absolute', left: w / 2 - 6, bottom: 0, width: 6, height: h, background: 'linear-gradient(90deg,#7a5a2a,#4a3415)', borderRadius: 2 }} />
</>);
const Obstacle = ({ vis, H, groundY }) => {
  const reach = H - groundY;
  if (vis === 'monkeybars') {
    const w = 120, barY = Math.round(reach * 0.74);
    return <div style={{ position: 'absolute', left: 0, bottom: groundY, width: w, height: barY, transform: 'translateX(-50%)' }}>
      <Posts h={barY} w={w} />
      <div style={{ position: 'absolute', left: -w / 2, top: 0, width: w, height: 6, background: 'linear-gradient(#8B6914,#5e470d)', borderRadius: 3, boxShadow: '0 2px 4px rgba(0,0,0,.5)' }} />
      {Array.from({ length: Math.floor(w / 13) }).map((_, i) => <div key={i} style={{ position: 'absolute', left: -w / 2 + 10 + i * 13, top: 6, width: 3, height: 12, background: '#6B4A10', borderRadius: 2 }} />)}
    </div>;
  }
  if (vis === 'rings') {
    const w = 110, barY = Math.round(reach * 0.74);
    return <div style={{ position: 'absolute', left: 0, bottom: groundY, width: w, height: barY, transform: 'translateX(-50%)' }}>
      <Posts h={barY} w={w} />
      <div style={{ position: 'absolute', left: -w / 2, top: 0, width: w, height: 5, background: '#5e470d', borderRadius: 3 }} />
      {[-30, 0, 30].map((dx, i) => <div key={i} style={{ position: 'absolute', left: w / 2 - 30 + dx + 8, top: 5 }}>
        <div style={{ width: 2, height: 16, background: '#9a7530', margin: '0 auto' }} />
        <div style={{ width: 15, height: 15, borderRadius: '50%', border: '3px solid #b8862f', background: 'transparent' }} />
      </div>)}
    </div>;
  }
  if (vis === 'cargonet') {
    const w = 70, hh = Math.round(reach * 0.8);
    return <div style={{ position: 'absolute', left: 0, bottom: groundY, width: w, height: hh, transform: 'translateX(-50%)', backgroundImage: 'repeating-linear-gradient(45deg,#3a3027 0 1.5px,transparent 1.5px 11px),repeating-linear-gradient(-45deg,#3a3027 0 1.5px,transparent 1.5px 11px)', borderTop: '4px solid #5a4a38', opacity: .92 }} />;
  }
  if (vis === 'warpedwall') {
    const w = 50, hh = Math.round(reach * 0.78);
    return <svg style={{ position: 'absolute', left: 0, bottom: groundY, transform: 'translateX(-50%)' }} width={w} height={hh} viewBox={`0 0 ${w} ${hh}`}>
      <defs><linearGradient id="ww" x1="0" x2="1"><stop offset="0" stopColor="#3a2f22" /><stop offset="1" stopColor="#6a5640" /></linearGradient></defs>
      <path d={`M0,${hh} L0,${hh * 0.46} Q0,4 ${w},0 L${w},${hh} Z`} fill="url(#ww)" stroke="#241c12" strokeWidth="1.5" />
      <path d={`M5,${hh} L5,${hh * 0.5} Q5,9 ${w - 4},6`} fill="none" stroke="rgba(255,255,255,.13)" strokeWidth="2" />
    </svg>;
  }
  if (vis === 'spiderwall') {
    const w = 56, hh = Math.round(reach * 0.8);
    return <div style={{ position: 'absolute', left: 0, bottom: groundY, width: w, height: hh, transform: 'translateX(-50%)', display: 'flex', justifyContent: 'space-between' }}>
      <div style={{ width: 9, height: '100%', background: 'linear-gradient(90deg,#444,#2a2a30)', borderRadius: 2 }} />
      <div style={{ width: 9, height: '100%', background: 'linear-gradient(90deg,#2a2a30,#444)', borderRadius: 2 }} />
    </div>;
  }
  if (vis === 'beam') {
    const w = Math.round(reach * 1.6), bh = 7;
    return <div style={{ position: 'absolute', left: 0, bottom: groundY + Math.round(reach * 0.16), width: w, height: bh, transform: 'translateX(-50%)', background: 'linear-gradient(#8a6a3a,#5e4422)', borderRadius: 3, boxShadow: '0 3px 5px rgba(0,0,0,.5)' }}>
      <div style={{ position: 'absolute', left: 8, top: bh, width: 5, height: Math.round(reach * 0.16), background: '#4a3415' }} />
      <div style={{ position: 'absolute', right: 8, top: bh, width: 5, height: Math.round(reach * 0.16), background: '#4a3415' }} />
    </div>;
  }
  return null; // gap → kein Aufbau (Krater im Boden)
};
const Rope = ({ H, groundY }) => (
  <div style={{ position: 'absolute', left: 0, top: Math.round(H * 0.06), bottom: groundY, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
    <div style={{ width: 12, height: 5, borderRadius: 2, background: '#888' }} />
    <div style={{ width: 2.5, flex: 1, background: 'repeating-linear-gradient(180deg,#9a7530,#6B4A10 5px)' }} />
    <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#c89a55,#7B5A20)', border: '2px solid #5a4015' }} />
  </div>
);
const Buzzer = ({ lit }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <div className={lit ? 'buzz-dome lit' : 'buzz-dome'} />
    <div style={{ width: 34, height: 6, background: 'repeating-linear-gradient(90deg,#1a1a1a,#1a1a1a 5px,#ffd23f 5px,#ffd23f 10px)', borderRadius: 1 }} />
    <div style={{ width: 11, height: 40, background: 'linear-gradient(90deg,#333,#555)', borderRadius: 2 }} />
    <div style={{ width: 40, height: 6, background: '#222', borderRadius: 2 }} />
  </div>
);
const StartGate = ({ groundY, H }) => {
  const postH = Math.round((H - groundY) * 0.66);
  return (<>
    <div style={{ position: 'absolute', bottom: groundY - 6, left: '50%', transform: 'translateX(-50%)', width: 86, height: 12, borderRadius: 3, background: 'repeating-linear-gradient(90deg,#475064,#475064 5px,#2c313c 5px,#2c313c 10px)', border: '1px solid #5a6172', boxShadow: '0 0 12px rgba(120,160,255,.2)' }} />
    <div style={{ position: 'absolute', bottom: groundY, left: 'calc(50% - 38px)', width: 5, height: postH, background: 'linear-gradient(#c0392b,#7d2018)', borderRadius: 2 }} />
    <div style={{ position: 'absolute', bottom: groundY, left: 'calc(50% + 33px)', width: 5, height: postH, background: 'linear-gradient(#c0392b,#7d2018)', borderRadius: 2 }} />
    <div style={{ position: 'absolute', bottom: groundY + postH - 8, left: '50%', transform: 'translateX(-50%)', background: '#1f9d4d', color: '#fff', fontSize: 11, fontWeight: 900, letterSpacing: '.14em', padding: '3px 14px', borderRadius: 4, border: '2px solid #fff', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,.5)' }}>START</div>
  </>);
};

// ── Eine Figur auf dem Parcours ───────────────────────────────────────────────
const RunnerOnCourse = ({ r, lvl, demoT, H, groundY, scale, ghost }) => {
  const worldX = progressToX(r.progress, lvl);
  const action = getRunnerAction(worldX, lvl, r.finished);
  const figH = 64 * scale;
  const plat = action === 'run' || action === 'balance' || action === 'jump' ? platformLiftAt(worldX, lvl) : 0;
  let bottom = groundY - 2 + plat, pivot = false;
  if (action === 'hang') bottom = groundY + (H - groundY) * 0.40;
  else if (action === 'climb') bottom = groundY + (H - groundY) * 0.34;
  else if (action === 'swing') { bottom = groundY + (H - groundY) * 0.30; pivot = true; }
  const trans = demoT != null ? 'bottom .2s ease' : 'left .6s cubic-bezier(.4,0,.2,1), bottom .25s ease';
  const inner = (
    <div className={action === 'jump' ? 'hop' : ''} style={{ position: 'relative' }}>
      <NinjaFigure idx={r.idx} action={action} scale={scale} ghost={ghost} />
      {ghost && <div style={{ position: 'absolute', bottom: figH + 4, left: '50%', transform: 'translateX(-50%)', fontSize: 13 }}>👑</div>}
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: worldX, bottom, transform: 'translateX(-50%)', transition: trans, zIndex: ghost ? 4 : 6 }}>
      {/* Bodenschatten */}
      <div style={{ position: 'absolute', bottom: -3, left: '50%', width: 30 * scale, height: 7, transform: 'translateX(-50%)', borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(0,0,0,.45),transparent 70%)' }} />
      {pivot ? <div className="swing-pivot">{inner}</div> : inner}
      {r.finished && !ghost && <div className="buzzburst" style={{ position: 'absolute', bottom: figH * 0.7, left: '64%' }}>★</div>}
    </div>
  );
};

// ═══ DIE WELT — Side-Scroller mit folgender Kamera ═══════════════════════════
export const RaceScene = ({ featured, leader, obs, demoT, lang, tall = true }) => {
  const H = tall ? 200 : 150;
  const groundY = Math.round(H * 0.17);
  const scale = tall ? 1.45 : 1.05;
  const sceneRef = useRef(null);
  const [sw, setSw] = useState(900);
  const camRef = useRef(0);
  useEffect(() => {
    const el = sceneRef.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setSw(el.clientWidth || 900));
    ro.observe(el); setSw(el.clientWidth || 900);
    return () => ro.disconnect();
  }, []);
  const VW = sw;
  const lvl = buildLevel(obs, VW);
  const same = !leader || (featured && leader.athleteId === featured.athleteId);
  const finishedNow = featured?.finished;
  const featX = featured ? progressToX(featured.progress, lvl) : 0;
  const fAct = featured && !finishedNow ? getRunnerAction(featX, lvl, false) : null;
  const featLbl = finishedNow ? '🎉 Buzzer!' : (fAct && fAct !== 'run' ? ACTION_LABEL[fAct]?.[lang] : null);
  // Kamera: Läufer auf 34% + Look-ahead 14%, geklemmt, weich nachgezogen
  const target = Math.max(0, Math.min(lvl.worldW - VW, featX - VW * 0.34 + VW * 0.14));
  if (demoT != null) camRef.current += (target - camRef.current) * 0.16;   // Lerp pro Frame
  else camRef.current = target;
  const cam = camRef.current;
  const camTrans = demoT != null ? 'none' : 'transform .3s cubic-bezier(.4,0,.2,1)';
  const lay = (factor, z) => ({ position: 'absolute', top: 0, bottom: 0, left: 0, width: Math.max(lvl.worldW, VW), transform: `translateX(${-cam * factor}px)`, transition: camTrans, zIndex: z });
  const finishX = lvl.finishX;
  return (
    <div ref={sceneRef} style={{ position: 'relative', height: H, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)', boxShadow: 'inset 0 0 44px rgba(0,0,0,.55)' }}>
      {/* Himmel (fix) */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#070718 0%,#0e1340 34%,#1a2350 56%,#223238 78%,#16240f 100%)' }} />
      <div style={{ position: 'absolute', left: '7%', top: '12%', width: 38, height: 38, borderRadius: '50%', background: 'radial-gradient(circle at 38% 35%,#fff,#cdd6e6 60%,#9aa6bd)', boxShadow: '0 0 30px rgba(205,214,230,.45)', transform: `translateX(${-cam * 0.05}px)`, transition: camTrans }} />
      {/* Sterne (0.12×) */}
      <div style={lay(0.12, 1)}>
        {Array.from({ length: Math.ceil(lvl.worldW / 90) + 8 }).map((_, i) => <div key={i} style={{ position: 'absolute', left: (i * 83 + 11) % Math.max(lvl.worldW, VW), top: `${(i * 37 + 4) % 38}%`, width: i % 3 ? 1.5 : 2.5, height: i % 3 ? 1.5 : 2.5, borderRadius: '50%', background: '#fff', opacity: i % 3 ? .4 : .8 }} />)}
      </div>
      {/* Ferne Berge (0.3×) */}
      <div style={lay(0.3, 1)}>
        <svg style={{ position: 'absolute', bottom: groundY, width: '100%', height: Math.round(H * 0.4) }} viewBox="0 0 1600 60" preserveAspectRatio="none">
          <polygon points="0,60 70,16 150,50 240,10 340,46 440,20 540,52 640,12 760,48 860,22 980,48 1080,16 1200,50 1320,22 1440,48 1560,20 1600,40 1600,60" fill="#141a2e" />
        </svg>
      </div>
      {/* Mittlere Hügel/Bäume (0.55×) */}
      <div style={lay(0.55, 2)}>
        <svg style={{ position: 'absolute', bottom: groundY - 2, width: '100%', height: Math.round(H * 0.34) }} viewBox="0 0 1600 50" preserveAspectRatio="none">
          <polygon points="0,50 90,24 200,46 320,18 460,48 600,22 760,48 900,20 1060,46 1220,22 1380,48 1540,24 1600,46 1600,50" fill="#1a2a1c" opacity=".85" />
        </svg>
      </div>
      {/* WELT-Vordergrund (1×) — Hindernisse, Plattformen, Figuren */}
      <div style={lay(1, 4)}>
        {/* gekachelter Boden (Bewegung sichtbar) */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: groundY, background: 'repeating-linear-gradient(90deg,#2f5418 0 46px,#356019 46px 92px)', borderTop: '2px solid #4a7a22' }}>
          <div style={{ position: 'absolute', top: 2, left: 0, width: '100%', height: 3, background: 'repeating-linear-gradient(90deg,#5a8a2a 0 4px,transparent 4px 92px)' }} />
        </div>
        {/* Krater (gap) */}
        {lvl.items.filter(it => it.vis === 'gap').map((it, k) => (
          <div key={`g${k}`} style={{ position: 'absolute', left: it.x, bottom: 0, transform: 'translateX(-50%)', width: 52, height: groundY, background: 'linear-gradient(180deg,#02030a,#070b14)', borderRadius: '0 0 6px 6px', boxShadow: 'inset 5px 0 7px rgba(0,0,0,.7),inset -5px 0 7px rgba(0,0,0,.7)' }} />
        ))}
        {/* Klippen-Pit unter Seil */}
        {lvl.items.filter(it => it.vis === 'rope').map((it, k) => (
          <div key={`p${k}`} style={{ position: 'absolute', left: it.x, bottom: 0, transform: 'translateX(-50%)', width: 84, height: groundY, background: 'linear-gradient(180deg,#02030a,#060912)' }} />
        ))}
        {/* Plattformen */}
        {lvl.platforms.map((p, k) => (
          <div key={`pl${k}`} style={{ position: 'absolute', left: p.x0, width: p.x1 - p.x0, bottom: groundY - 4 + p.lift, height: 9, background: 'linear-gradient(180deg,#6a7585,#3a4350)', borderRadius: 3, borderTop: '2px solid #8a95a8', boxShadow: '0 4px 8px rgba(0,0,0,.4)' }}>
            <div style={{ position: 'absolute', left: 0, bottom: -groundY - p.lift + 4, width: 6, height: p.lift, background: 'rgba(40,48,60,.5)' }} />
            <div style={{ position: 'absolute', right: 0, bottom: -groundY - p.lift + 4, width: 6, height: p.lift, background: 'rgba(40,48,60,.5)' }} />
          </div>
        ))}
        {/* Startplattform */}
        <div style={{ position: 'absolute', left: lvl.startX, top: 0, bottom: 0, width: 0 }}><StartGate groundY={groundY} H={H} /></div>
        {/* Hindernis-Aufbauten */}
        {lvl.items.map((it, k) => (
          <div key={`o${k}`} style={{ position: 'absolute', left: it.x, top: 0, bottom: 0, width: 0 }}>
            {it.vis === 'rope' ? <Rope H={H} groundY={groundY} /> : <Obstacle vis={it.vis} H={H} groundY={groundY} />}
          </div>
        ))}
        {/* Ziel: Buzzer + ZIEL */}
        <div style={{ position: 'absolute', left: finishX, bottom: groundY, transform: 'translateX(-50%)', zIndex: 8 }}><Buzzer lit={finishedNow} /></div>
        <div style={{ position: 'absolute', left: finishX, bottom: groundY + Math.round((H - groundY) * 0.62), transform: 'translateX(-50%)', background: '#d11', color: '#fff', fontSize: 11, fontWeight: 900, letterSpacing: '.14em', padding: '3px 13px', borderRadius: 4, border: '2px solid #fff', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(0,0,0,.5)' }}>ZIEL</div>
        {/* Figuren */}
        {!same && leader && <RunnerOnCourse r={leader} lvl={lvl} demoT={demoT} H={H} groundY={groundY} scale={scale} ghost />}
        {featured && <RunnerOnCourse r={featured} lvl={lvl} demoT={demoT} H={H} groundY={groundY} scale={scale} />}
      </div>
      {/* Vordergrund-Büsche (1.3× — whoosh) */}
      <div style={lay(1.3, 7)}>
        {Array.from({ length: Math.ceil(lvl.worldW / (VW * 0.55)) }).map((_, i) => (
          <div key={i} style={{ position: 'absolute', left: VW * 0.2 + i * VW * 0.55, bottom: groundY - 8, width: 30, height: 16, transform: 'translateX(-50%)', borderRadius: '50% 50% 40% 40%', background: 'radial-gradient(ellipse at 50% 30%,#1f3a16,#0d1c08)', opacity: .9 }} />
        ))}
      </div>
      {/* HUD (fix) */}
      {finishedNow && <div style={{ position: 'absolute', right: '7%', top: '11%', zIndex: 11, fontSize: 13, fontWeight: 900, color: '#FFD60A', textShadow: '0 0 8px rgba(255,214,10,.8)', animation: 'buzzPop .6s ease-out' }}>BUZZ!</div>}
      {featLbl && <div style={{ position: 'absolute', left: 8, top: 7, zIndex: 11, fontSize: 10, fontWeight: 800, letterSpacing: '.02em', color: '#fff', background: 'rgba(0,0,0,.5)', padding: '3px 9px', borderRadius: 8, border: '1px solid rgba(255,255,255,.2)', pointerEvents: 'none' }}>{featLbl}</div>}
    </div>
  );
};

// ═══ STYLES — Charakter-Aufbau + alle Animationen ═══════════════════════════
export const RaceStyles = () => (
  <style>{`
.nf{position:relative;width:40px;height:64px;transform-origin:bottom center}
.nf-in{position:absolute;inset:0}
.nf .j{position:absolute;width:0;height:0}
.nf .hipF,.nf .hipB{left:20px;top:37px}
.nf .shoF,.nf .shoB{left:20px;top:20px}
/* getaperte Kapsel-Gliedmassen mit Gradient + kühlem Rim-Light */
.nf .seg{position:absolute;background:linear-gradient(102deg,var(--suit) 55%,var(--suitD));box-shadow:inset 1px 0 0 rgba(170,205,255,.35),inset -1px -1px 2px rgba(0,0,0,.35)}
.nf .thigh{left:-3.5px;top:0;width:7px;height:15px;border-radius:4px 4px 3px 3px;transform-origin:top center}
.nf .shin{left:-3px;top:13px;width:6px;height:14px;border-radius:3px 3px 4px 4px;transform-origin:top center}
.nf .boot{position:absolute;left:-3px;top:25px;width:11px;height:6px;border-radius:3px 5px 3px 2px;background:#15151c;box-shadow:inset 0 1px 0 rgba(255,255,255,.12);transform-origin:left center}
.nf .uarm{left:-2.7px;top:0;width:5.4px;height:13px;border-radius:3px;transform-origin:top center}
.nf .farm{left:-2.4px;top:11px;width:5px;height:12px;border-radius:3px 3px 4px 4px;transform-origin:top center}
.nf .farm::after{content:"";position:absolute;left:-0.5px;top:5px;width:6px;height:2px;background:var(--accent);opacity:.7;border-radius:1px}
.nf .hand{position:absolute;left:-2.7px;top:10px;width:5.4px;height:5.4px;border-radius:50% 50% 50% 40%;background:#1a1a22}
.nf .spine{left:20px;top:37px;transform-origin:bottom center}
/* Rumpf: Keil mit Falte + Obi-Gürtel */
.nf .torso{position:absolute;left:-8px;top:-24px;width:16px;height:25px;border-radius:7px 8px 5px 5px;background:linear-gradient(104deg,var(--suit) 52%,var(--suitD));box-shadow:inset 2px 0 0 rgba(170,205,255,.3),inset -2px -1px 3px rgba(0,0,0,.4)}
.nf .fold{position:absolute;left:3px;top:2px;width:11px;height:20px;border-left:2px solid rgba(0,0,0,.22);border-radius:0 0 0 8px;transform:rotate(8deg)}
.nf .obi{position:absolute;left:-1px;top:14px;width:18px;height:5px;background:var(--accent);opacity:.92;border-radius:1px;box-shadow:inset 0 -1px 1px rgba(0,0,0,.3)}
.nf .obiknot{position:absolute;left:-3px;top:15px;width:5px;height:5px;background:var(--accent);transform:rotate(45deg);border-radius:1px}
.nf .obiknot::after{content:"";position:absolute;left:-1px;top:4px;width:3px;height:9px;background:var(--accent);opacity:.85;border-radius:1px;transform-origin:top center;animation:tailSway 1.6s ease-in-out infinite}
.nf .neck{position:absolute;left:-2.5px;top:-28px;width:5px;height:6px;background:#caa37e}
/* Kopf: Kapuze + Maske + leuchtendes Auge */
.nf .head{position:absolute;left:-8px;top:-41px;width:16px;height:16px;transform-origin:bottom center}
.nf .hood{position:absolute;inset:0;border-radius:54% 54% 46% 46%/60% 60% 42% 42%;background:linear-gradient(110deg,var(--suit),var(--suitD));box-shadow:inset 1.5px 1px 0 rgba(170,205,255,.3),inset -1px -1px 2px rgba(0,0,0,.4)}
.nf .head::after{content:"";position:absolute;left:2px;top:7px;width:12px;height:5px;background:#1a1a22;border-radius:2px}
.nf .band{position:absolute;left:-1px;top:5px;width:18px;height:3.5px;background:var(--accent);border-radius:2px;box-shadow:0 0 4px var(--accent)}
.nf .band::after{content:"";position:absolute;left:-10px;top:-.5px;width:11px;height:3px;background:var(--accent);opacity:.8;border-radius:2px;transform-origin:right center;animation:tailFlap .5s ease-in-out infinite}
.nf .eye{position:absolute;left:11px;top:7.5px;width:3px;height:2.4px;border-radius:50%;background:#fff;box-shadow:0 0 5px 1px var(--accent),0 0 2px #fff}
/* Katana auf dem Rücken */
.nf .katana{position:absolute;left:8px;top:8px;width:26px;height:3px;border-radius:2px;background:linear-gradient(90deg,#2a2a33,#4a4a55);transform:rotate(-32deg);transform-origin:left center;box-shadow:0 0 0 0.5px rgba(0,0,0,.4)}
.nf .katana::after{content:"";position:absolute;right:-1px;top:-1px;width:4px;height:5px;background:var(--accent);opacity:.8;border-radius:1px}
/* Schal — gekettete Segmente, jeweils mit Nachlauf */
.nf .scarf{position:absolute;height:5px;border-radius:2px 6px 6px 2px;background:var(--accent);transform-origin:right center;box-shadow:inset 0 -1px 1px rgba(0,0,0,.22)}
.nf .sc1{left:-16px;top:-23px;width:13px;animation:scarfW 1.25s ease-in-out infinite}
.nf .sc2{left:-12px;top:.3px;width:12px;height:4.4px;animation:scarfW 1.25s ease-in-out infinite -.08s}
.nf .sc3{left:-10px;top:.3px;width:10px;height:3.8px;opacity:.92;animation:scarfW 1.25s ease-in-out infinite -.16s}
/* Grundpose (Stand) */
.nf .thighF{transform:rotate(8deg)}.nf .thighB{transform:rotate(-9deg)}
.nf .shinF{transform:rotate(-8deg)}.nf .shinB{transform:rotate(-12deg)}
.nf .uarmF{transform:rotate(15deg)}.nf .uarmB{transform:rotate(-14deg)}
.nf .farmF,.nf .farmB{transform:rotate(-26deg)}
@keyframes tailSway{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(10deg)}}
@keyframes tailFlap{0%,100%{transform:rotate(10deg)}50%{transform:rotate(-16deg)}}
@keyframes scarf1{0%,100%{transform:rotate(6deg)}50%{transform:rotate(-12deg)}}
@keyframes scarf2{0%,100%{transform:rotate(10deg)}50%{transform:rotate(-18deg)}}
/* IDLE */
.nf-idle .nf-in{animation:breathe 3s ease-in-out infinite}
@keyframes breathe{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.4px)}}
/* ── RUN: 4 Posen · 2 Dips · gegenphasige Arme · echte Easing ── */
.nf-run .nf-in{animation:bob .5s cubic-bezier(.4,0,.6,1) infinite}
.nf-run .spine{transform:rotate(12deg)}
.nf-run .thighF{animation:thF .5s cubic-bezier(.5,0,.5,1) infinite}
.nf-run .shinF{animation:shF .5s cubic-bezier(.5,0,.5,1) infinite}
.nf-run .thighB{animation:thF .5s cubic-bezier(.5,0,.5,1) infinite -.25s}
.nf-run .shinB{animation:shF .5s cubic-bezier(.5,0,.5,1) infinite -.25s}
.nf-run .uarmF{animation:uaF .5s cubic-bezier(.45,0,.55,1) infinite}
.nf-run .uarmB{animation:uaF .5s cubic-bezier(.45,0,.55,1) infinite -.25s}
.nf-run .farmF{transform:rotate(-78deg)}.nf-run .farmB{transform:rotate(-78deg)}
.nf-run .head{animation:headBob .5s ease-in-out infinite}
@keyframes bob{0%{transform:translateY(-2px)}25%{transform:translateY(-6px)}50%{transform:translateY(-1px)}75%{transform:translateY(-6px)}100%{transform:translateY(-2px)}}
@keyframes thF{0%{transform:rotate(30deg)}25%{transform:rotate(8deg)}50%{transform:rotate(-24deg)}75%{transform:rotate(-34deg)}100%{transform:rotate(30deg)}}
@keyframes shF{0%{transform:rotate(-12deg)}25%{transform:rotate(-44deg)}50%{transform:rotate(-10deg)}75%{transform:rotate(-86deg)}100%{transform:rotate(-12deg)}}
@keyframes uaF{0%{transform:rotate(-34deg)}50%{transform:rotate(34deg)}100%{transform:rotate(-34deg)}}
@keyframes headBob{0%,100%{transform:rotate(3deg)}50%{transform:rotate(6deg)}}
/* ── JUMP: Anticipation → Stretch → Tuck → Squash ── */
.hop{animation:hopArc 1s cubic-bezier(.3,0,.4,1) infinite}
@keyframes hopArc{0%{transform:translateY(0) scaleY(.9) scaleX(1.08)}12%{transform:translateY(0) scaleY(1.12) scaleX(.9)}45%{transform:translateY(-36px) scaleY(1) scaleX(1)}60%{transform:translateY(-36px)}88%{transform:translateY(0) scaleY(.82) scaleX(1.14)}100%{transform:translateY(0) scaleY(1) scaleX(1)}}
.nf-jump .spine{transform:rotate(-12deg)}
.nf-jump .thighF{transform:rotate(52deg)}.nf-jump .shinF{transform:rotate(-92deg)}
.nf-jump .thighB{transform:rotate(22deg)}.nf-jump .shinB{transform:rotate(-66deg)}
.nf-jump .uarmF{transform:rotate(-58deg)}.nf-jump .uarmB{transform:rotate(-72deg)}
.nf-jump .farmF,.nf-jump .farmB{transform:rotate(-34deg)}
/* ── HANG: Arm-über-Arm-Travel mit Körper-Pendel + Knie-Schwung ── */
.nf-hang .nf-in{animation:hangBody 1.1s ease-in-out infinite}
.nf-hang .uarmF{animation:hangArmA 1.1s ease-in-out infinite}
.nf-hang .farmF{animation:hangForeA 1.1s ease-in-out infinite}
.nf-hang .uarmB{animation:hangArmA 1.1s ease-in-out infinite -.55s}
.nf-hang .farmB{animation:hangForeA 1.1s ease-in-out infinite -.55s}
.nf-hang .thighF{animation:hangLegA 1.1s ease-in-out infinite}
.nf-hang .thighB{animation:hangLegB 1.1s ease-in-out infinite}
.nf-hang .shinF,.nf-hang .shinB{transform:rotate(-26deg)}
@keyframes hangBody{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
@keyframes hangArmA{0%{transform:rotate(168deg)}25%{transform:rotate(150deg)}50%{transform:rotate(170deg)}75%{transform:rotate(196deg)}100%{transform:rotate(168deg)}}
@keyframes hangForeA{0%,100%{transform:rotate(6deg)}50%{transform:rotate(20deg)}}
@keyframes hangLegA{0%,100%{transform:rotate(16deg)}50%{transform:rotate(-12deg)}}
@keyframes hangLegB{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(24deg)}}
/* ── SWING: Pendel · Streckung unten · Tuck oben ── */
.swing-pivot{transform-origin:top center;animation:swingPend 1.5s cubic-bezier(.37,0,.63,1) infinite alternate}
@keyframes swingPend{0%{transform:rotate(-34deg)}100%{transform:rotate(38deg)}}
.nf-swing .uarmF,.nf-swing .uarmB{transform:rotate(174deg)}
.nf-swing .farmF,.nf-swing .farmB{transform:rotate(3deg)}
.nf-swing .thighF{animation:swingLeg 1.5s cubic-bezier(.37,0,.63,1) infinite alternate}
.nf-swing .thighB{animation:swingLeg 1.5s cubic-bezier(.37,0,.63,1) infinite alternate}
.nf-swing .shinF,.nf-swing .shinB{transform:rotate(-20deg)}
@keyframes swingLeg{0%{transform:rotate(-38deg)}100%{transform:rotate(28deg)}}
/* ── CLIMB: alternierend, Hüfte zur Wand ── */
.nf-climb .nf-in{animation:climbUp 1s ease-in-out infinite}
.nf-climb .spine{transform:rotate(6deg)}
.nf-climb .uarmF{animation:climbArmA 1s ease-in-out infinite}
.nf-climb .uarmB{animation:climbArmB 1s ease-in-out infinite}
.nf-climb .farmF,.nf-climb .farmB{transform:rotate(-34deg)}
.nf-climb .thighF{animation:climbLegA 1s ease-in-out infinite}
.nf-climb .thighB{animation:climbLegB 1s ease-in-out infinite}
.nf-climb .shinF,.nf-climb .shinB{transform:rotate(-46deg)}
@keyframes climbUp{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes climbArmA{0%,100%{transform:rotate(152deg)}50%{transform:rotate(116deg)}}
@keyframes climbArmB{0%,100%{transform:rotate(116deg)}50%{transform:rotate(152deg)}}
@keyframes climbLegA{0%,100%{transform:rotate(40deg)}50%{transform:rotate(10deg)}}
@keyframes climbLegB{0%,100%{transform:rotate(10deg)}50%{transform:rotate(40deg)}}
/* ── BALANCE: vorsichtiger Gang, Arme zur Seite ── */
.nf-balance .nf-in{animation:balWob 1.6s ease-in-out infinite}
.nf-balance .spine{transform:rotate(2deg)}
.nf-balance .uarmF{transform:rotate(88deg)}.nf-balance .uarmB{transform:rotate(-92deg)}
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
/* Buzzer + Funken */
.buzz-dome{width:28px;height:16px;border-radius:14px 14px 3px 3px;background:radial-gradient(circle at 40% 25%,#ff8a8a,#d11 65%,#900);box-shadow:0 0 0 2px #700,0 2px 4px rgba(0,0,0,.5)}
.buzz-dome.lit{background:radial-gradient(circle at 40% 25%,#fff,#ff5a5a 55%,#e00);box-shadow:0 0 18px 5px rgba(255,60,60,.85),0 0 0 2px #f33;animation:buzzPulse .5s ease-in-out infinite}
@keyframes buzzPulse{0%,100%{box-shadow:0 0 18px 5px rgba(255,60,60,.85),0 0 0 2px #f33}50%{box-shadow:0 0 28px 9px rgba(255,90,90,1),0 0 0 2px #f55}}
@keyframes buzzPop{0%{transform:scale(.3);opacity:0}50%{transform:scale(1.25);opacity:1}100%{transform:scale(1);opacity:1}}
.buzzburst{color:#FFD60A;font-size:14px;animation:sparkle .8s ease-out infinite;text-shadow:0 0 6px rgba(255,214,10,.9)}
@keyframes sparkle{0%{transform:scale(.4) rotate(0);opacity:0}40%{opacity:1}100%{transform:scale(1.3) rotate(40deg);opacity:0}}
`}</style>
);
