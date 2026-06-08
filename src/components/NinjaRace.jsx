// ═══════════════════════════════════════════════════════════════════════════
//  Ninja-Race — prozedural animierte Spielfiguren in EINER Side-Scroller-Landschaft
//  Keine Bild-Sprites: jede Figur ist ein echtes Skelett (Kopf · Rumpf · 2 Arme ·
//  2 Beine mit Knie/Ellbogen) und wird per CSS-Keyframes animiert wie in einem
//  Jump'n'Run. Aktionen: run · jump · hang · swing · climb · celebrate (8 Varianten).
//  Der Parcours ist ein kuratiertes, gut gespreiztes Layout (nicht 1:1 zu allen
//  Hindernissen) — Krater, Höhle, Monkey-Bars, Seil über Klippe, Warped Wall, Buzzer.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';

// ── Charakter-Paletten (Anzug · Akzent/Schärpe · Haut) — 16 Figuren ───────────
export const RACE_PALETTE = [
  ['#2f7be0', '#ffd23f', '#e8b48c'], ['#ff5fa2', '#ffffff', '#f0c0a0'],
  ['#3aa655', '#ffd23f', '#e8b48c'], ['#ff8a3d', '#ffffff', '#f0c0a0'],
  ['#ffd23f', '#e0006c', '#e8b48c'], ['#9b5de5', '#ffd23f', '#f0c0a0'],
  ['#27c4c4', '#ff5e3a', '#e8b48c'], ['#ff4d4d', '#ffffff', '#f0c0a0'],
  ['#27408b', '#ffd23f', '#d8a070'], ['#e6b800', '#1a1a2e', '#e8b48c'],
  ['#2e8b57', '#ffd23f', '#d8a070'], ['#c41e3a', '#ffffff', '#e8b48c'],
  ['#7ec8e3', '#1a1a2e', '#d8a070'], ['#7a3cc4', '#ffd23f', '#e8b48c'],
  ['#b9763f', '#ffd23f', '#d8a070'], ['#4a4a58', '#ff5e3a', '#e8b48c'],
];
export const celebOf = idx => idx % 8;

// ── Kuratierter Parcours (gut gespreizt, immer lesbar) ────────────────────────
export const COURSE = [
  { at: 0.13, type: 'jump' },   // Krater 1
  { at: 0.27, type: 'hang' },   // Monkey Bars
  { at: 0.41, type: 'cave' },   // Höhle (durchlaufen)
  { at: 0.55, type: 'swing' },  // Seil über Klippe
  { at: 0.70, type: 'climb' },  // Warped Wall
  { at: 0.84, type: 'jump' },   // Krater 2
];
export const ACTION_LABEL = {
  jump:  { de: 'Sprung',       en: 'Jump' },
  hang:  { de: 'Monkey Bars',  en: 'Monkey Bars' },
  swing: { de: 'Seil-Schwung', en: 'Rope Swing' },
  climb: { de: 'Warped Wall',  en: 'Warped Wall' },
  cave:  { de: 'Höhle',        en: 'Cave' },
};
const ZONE = 0.055;
export const currentObstacle = progress => COURSE.find(c => Math.abs(progress - c.at) < ZONE) || null;
export const getRunnerAction = (progress, finished) => {
  if (finished) return 'celebrate';
  const hit = currentObstacle(progress);
  if (!hit) return 'run';
  return hit.type === 'cave' ? 'run' : hit.type;   // Höhle = durchrennen
};

// ── Skelett-Figur ─────────────────────────────────────────────────────────────
export const NinjaFigure = ({ idx = 0, action = 'run', scale = 1, ghost = false }) => {
  const [suit, accent, skin] = RACE_PALETTE[idx % RACE_PALETTE.length];
  const cls = `nf nf-${action}` + (action === 'celebrate' ? ` cel cel-${celebOf(idx)}` : '');
  return (
    <div className={cls} style={{ '--suit': suit, '--accent': accent, '--skin': skin, transform: `scale(${scale})`, transformOrigin: 'bottom center', opacity: ghost ? 0.42 : 1, filter: ghost ? 'grayscale(.35) brightness(.9)' : 'none' }}>
      <div className="nf-in">
        <div className="j hipB"><div className="seg thigh thighB"><div className="seg shin shinB"><div className="seg foot" /></div></div></div>
        <div className="j shoB"><div className="seg uarm uarmB"><div className="seg farm farmB"><div className="hand" /></div></div></div>
        <div className="j spine">
          <div className="torso"><div className="sash" /></div>
          <div className="neck" />
          <div className="head"><div className="band" /><div className="mask" /><div className="eye" /><div className="tail tailA" /><div className="tail tailB" /></div>
        </div>
        <div className="j hipF"><div className="seg thigh thighF"><div className="seg shin shinF"><div className="seg foot" /></div></div></div>
        <div className="j shoF"><div className="seg uarm uarmF"><div className="seg farm farmF"><div className="hand" /></div></div></div>
      </div>
    </div>
  );
};

// ── Hindernis-Grafiken ────────────────────────────────────────────────────────
const MonkeyBars = ({ topY, w = 104 }) => (
  <div style={{ position: 'absolute', left: '50%', top: topY, transform: 'translateX(-50%)', width: w, height: 4 }}>
    <div style={{ position: 'absolute', left: 0, top: -8, width: 6, height: 54, background: 'linear-gradient(#7a5a2a,#4a3415)', borderRadius: 2 }} />
    <div style={{ position: 'absolute', right: 0, top: -8, width: 6, height: 54, background: 'linear-gradient(#7a5a2a,#4a3415)', borderRadius: 2 }} />
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 5, background: '#8B6914', borderRadius: 3, boxShadow: '0 2px 4px rgba(0,0,0,.5)' }} />
    {Array.from({ length: Math.floor(w / 13) }).map((_, i) => <div key={i} style={{ position: 'absolute', left: 9 + i * 13, top: 5, width: 3, height: 12, background: '#6B4A10', borderRadius: 2 }} />)}
  </div>
);
const RopeSwing = ({ topY, h }) => (
  <div style={{ position: 'absolute', left: '50%', top: topY, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
    <div style={{ width: 10, height: 5, borderRadius: 2, background: '#888' }} />
    <div style={{ width: 2.5, height: h, background: 'repeating-linear-gradient(180deg,#9a7530,#6B4A10 5px)' }} />
    <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%,#c89a55,#7B5A20)', border: '2px solid #5a4015' }} />
  </div>
);
const WarpedWall = ({ groundY, h, w = 46 }) => (
  <svg style={{ position: 'absolute', left: '50%', bottom: groundY, transform: 'translateX(-50%)' }} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
    <defs><linearGradient id="ww" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#3a2f22" /><stop offset="1" stopColor="#6a5640" /></linearGradient></defs>
    <path d={`M0,${h} L0,${h * 0.46} Q0,4 ${w},0 L${w},${h} Z`} fill="url(#ww)" stroke="#241c12" strokeWidth="1.5" />
    <path d={`M5,${h} L5,${h * 0.5} Q5,9 ${w - 3},6`} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="2" />
    <rect x={w - 7} y="3" width="4" height={h - 4} fill="#caa15a" opacity=".5" />
  </svg>
);
const Buzzer = ({ groundY, lit }) => (
  <div style={{ position: 'absolute', right: 8, bottom: groundY, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 8 }}>
    <div className={lit ? 'buzz-dome lit' : 'buzz-dome'} />
    <div style={{ width: 32, height: 6, background: 'repeating-linear-gradient(90deg,#1a1a1a,#1a1a1a 5px,#ffd23f 5px,#ffd23f 10px)', borderRadius: 1 }} />
    <div style={{ width: 10, height: 34, background: 'linear-gradient(90deg,#333,#555)', borderRadius: 2 }} />
    <div style={{ width: 38, height: 5, background: '#222', borderRadius: 2 }} />
  </div>
);

// ── Eine Figur auf dem Parcours ───────────────────────────────────────────────
const RunnerOnCourse = ({ r, idx, demoT, H, groundY, scale, ghost }) => {
  const action = getRunnerAction(r.progress, r.finished);
  const figH = 64 * scale;
  const left = r.finished ? 91 : Math.max(3, Math.min(88, r.progress * 100));
  let bottom = groundY - 2, pivot = false;
  if (action === 'hang') bottom = groundY + (H - groundY) * 0.40;
  else if (action === 'climb') bottom = groundY + (H - groundY) * 0.34;
  else if (action === 'swing') { bottom = groundY + (H - groundY) * 0.30; pivot = true; }
  const trans = demoT != null ? 'left .12s linear, bottom .25s ease' : 'left .8s cubic-bezier(.4,0,.2,1), bottom .3s ease';
  const inner = (
    <div className={action === 'jump' ? 'hop' : ''} style={{ position: 'relative' }}>
      <NinjaFigure idx={idx} action={action} scale={scale} ghost={ghost} />
      {ghost && <div style={{ position: 'absolute', bottom: figH + 2, left: '50%', transform: 'translateX(-50%)', fontSize: 12 }}>👑</div>}
    </div>
  );
  return (
    <div style={{ position: 'absolute', left: `${left}%`, bottom, transform: 'translateX(-50%)', transition: trans, zIndex: ghost ? 4 : 6 }}>
      {pivot ? <div className="swing-pivot">{inner}</div> : inner}
      {r.finished && !ghost && <div className="buzzburst" style={{ position: 'absolute', bottom: figH * 0.7, left: '64%' }}>★</div>}
    </div>
  );
};

// ── Die EINE Landschaft ────────────────────────────────────────────────────────
export const RaceScene = ({ featured, leader, demoT, lang, tall = true }) => {
  const H = tall ? 196 : 150;
  const groundY = Math.round(H * 0.17);
  const scale = tall ? 1.5 : 1.1;
  const same = !leader || (featured && leader.athleteId === featured.athleteId);
  const finishedNow = featured?.finished;
  const fObst = featured && !finishedNow ? currentObstacle(featured.progress) : null;
  const featLbl = finishedNow ? (lang === 'de' ? '🎉 Buzzer!' : '🎉 Buzzer!') : (fObst ? ACTION_LABEL[fObst.type]?.[lang] : null);
  const craters = COURSE.filter(c => c.type === 'jump');
  const swings = COURSE.filter(c => c.type === 'swing');
  const caves = COURSE.filter(c => c.type === 'cave');
  return (
    <div style={{ position: 'relative', height: H, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)', boxShadow: 'inset 0 0 44px rgba(0,0,0,.55)' }}>
      {/* Himmel */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#070718 0%,#0e1340 36%,#1a2350 58%,#243a2a 80%,#16280f 100%)' }} />
      {/* Mond */}
      <div style={{ position: 'absolute', left: '8%', top: '13%', width: 36, height: 36, borderRadius: '50%', background: 'radial-gradient(circle at 38% 35%,#fff,#cdd6e6 60%,#9aa6bd)', boxShadow: '0 0 28px rgba(205,214,230,.45)' }} />
      {/* Sterne */}
      {[[18,12],[26,7],[34,20],[44,9],[52,16],[63,6],[71,22],[80,11],[88,17],[94,8],[58,24],[40,5],[48,26]].map(([x, y], i) => (
        <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: i % 3 ? 1.5 : 2.5, height: i % 3 ? 1.5 : 2.5, borderRadius: '50%', background: '#fff', opacity: i % 3 ? .5 : .85 }} />
      ))}
      {/* ferne Berge */}
      <svg style={{ position: 'absolute', bottom: groundY, width: '100%', height: Math.round(H * 0.44) }} viewBox="0 0 320 60" preserveAspectRatio="none">
        <polygon points="0,60 24,14 50,48 84,8 120,44 156,18 196,50 232,10 270,46 300,20 320,60" fill="#141a30" />
        <polygon points="0,60 30,30 64,54 104,24 150,56 196,30 240,56 286,28 320,60" fill="#1c2640" opacity=".75" />
      </svg>
      {/* Höhlen (Hügel mit dunkler Öffnung) */}
      {caves.map((c, k) => (
        <div key={`cv${k}`} style={{ position: 'absolute', left: `${c.at * 100}%`, bottom: groundY - 3, transform: 'translateX(-50%)', width: 78, height: Math.round((H - groundY) * 0.62) }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 100%,#243a1c,#16240f)', borderRadius: '50% 50% 0 0' }} />
          <div style={{ position: 'absolute', left: '50%', bottom: 0, transform: 'translateX(-50%)', width: 36, height: '74%', borderRadius: '50% 50% 0 0', background: 'radial-gradient(ellipse at 50% 95%,#000,#06080e)', boxShadow: 'inset 0 6px 12px rgba(0,0,0,.9)' }} />
        </div>
      ))}
      {/* Boden */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: groundY, background: 'linear-gradient(180deg,#345d1c,#21400f)', borderTop: '2px solid #4a7a22' }} />
      {/* Krater (Lücken im Boden) */}
      {craters.map((c, k) => (
        <div key={`cr${k}`} style={{ position: 'absolute', left: `${c.at * 100}%`, bottom: 0, transform: 'translateX(-50%)', width: 46, height: groundY, background: 'linear-gradient(180deg,#02030a,#070b14)', borderRadius: '0 0 6px 6px', boxShadow: 'inset 4px 0 6px rgba(0,0,0,.7), inset -4px 0 6px rgba(0,0,0,.7)' }}>
          {[6, 16, 26, 36].map(x => <div key={x} style={{ position: 'absolute', left: x, top: -3, width: 2, height: 6, background: '#5a4a30', clipPath: 'polygon(50% 100%,0 0,100% 0)' }} />)}
        </div>
      ))}
      {/* Klippen-Pit unter dem Seil */}
      {swings.map((c, k) => (
        <div key={`pit${k}`} style={{ position: 'absolute', left: `${c.at * 100}%`, bottom: 0, transform: 'translateX(-50%)', width: 70, height: groundY, background: 'linear-gradient(180deg,#02030a,#060912)' }} />
      ))}
      {/* Hindernis-Aufbauten */}
      {COURSE.map((c, k) => {
        if (c.type === 'hang') return <div key={k} style={{ position: 'absolute', left: `${c.at * 100}%`, top: 0, bottom: 0 }}><MonkeyBars topY={Math.round(H * 0.16)} /></div>;
        if (c.type === 'swing') return <div key={k} style={{ position: 'absolute', left: `${c.at * 100}%`, top: 0, bottom: 0 }}><RopeSwing topY={6} h={Math.round(H * 0.34)} /></div>;
        if (c.type === 'climb') return <div key={k} style={{ position: 'absolute', left: `${c.at * 100}%`, top: 0, bottom: 0 }}><WarpedWall groundY={groundY} h={Math.round((H - groundY) * 0.72)} /></div>;
        return null;
      })}
      {/* Ziel-Buzzer */}
      <Buzzer groundY={groundY} lit={finishedNow} />
      {finishedNow && <div style={{ position: 'absolute', right: '7%', top: '12%', fontSize: 13, fontWeight: 900, color: '#FFD60A', textShadow: '0 0 8px rgba(255,214,10,.8)', animation: 'buzzPop .6s ease-out' }}>BUZZ!</div>}
      {/* Aktions-Caption (fix oben-links, nie abgeschnitten) */}
      {featLbl && <div style={{ position: 'absolute', left: 8, top: 7, zIndex: 9, fontSize: 10, fontWeight: 800, letterSpacing: '.02em', color: '#fff', background: 'rgba(0,0,0,.5)', padding: '3px 9px', borderRadius: 8, border: '1px solid rgba(255,255,255,.2)', pointerEvents: 'none' }}>{featLbl}</div>}
      {/* Figuren: Ghost-Leader hinten, Hauptläufer vorne */}
      {!same && leader && <RunnerOnCourse r={leader} idx={leader.idx} demoT={demoT} H={H} groundY={groundY} scale={scale} ghost />}
      {featured && <RunnerOnCourse r={featured} idx={featured.idx} demoT={demoT} H={H} groundY={groundY} scale={scale} />}
    </div>
  );
};

// ── Alle CSS-Keyframes + Posen (einmal global gemountet) ───────────────────────
export const RaceStyles = () => (
  <style>{`
.nf{position:relative;width:36px;height:64px}
.nf-in{position:absolute;inset:0}
.nf .j{position:absolute;width:0;height:0}
.nf .seg{position:absolute;border-radius:4px;background:var(--suit)}
.nf .hipF,.nf .hipB{left:18px;top:36px}
.nf .shoF,.nf .shoB{left:18px;top:19px}
.nf .thigh{left:-3px;top:0;width:6px;height:15px;transform-origin:top center}
.nf .shin{left:-2.5px;top:13px;width:5px;height:14px;transform-origin:top center}
.nf .foot{left:-2px;top:12px;width:9px;height:4px;border-radius:3px;background:#1c1c1c;transform-origin:left center}
.nf .uarm{left:-2.5px;top:0;width:5px;height:13px;transform-origin:top center}
.nf .farm{left:-2px;top:11px;width:4.5px;height:12px;transform-origin:top center}
.nf .hand{position:absolute;left:-2.5px;top:10px;width:5px;height:5px;border-radius:50%;background:var(--skin)}
.nf .spine{left:18px;top:36px;transform-origin:bottom center}
.nf .torso{position:absolute;left:-7px;top:-23px;width:14px;height:24px;border-radius:6px 6px 5px 5px;background:var(--suit)}
.nf .sash{position:absolute;left:0;top:13px;width:14px;height:5px;background:var(--accent);opacity:.92}
.nf .neck{position:absolute;left:-2.5px;top:-27px;width:5px;height:6px;background:var(--skin)}
.nf .head{position:absolute;left:-7.5px;top:-39px;width:15px;height:15px;border-radius:50%;background:var(--skin);transform-origin:bottom center}
.nf .mask{position:absolute;left:0;top:5px;width:15px;height:5.5px;background:var(--suit)}
.nf .band{position:absolute;left:0;top:3px;width:15px;height:4px;background:var(--accent)}
.nf .eye{position:absolute;left:10.5px;top:6px;width:2.5px;height:2.5px;border-radius:50%;background:#fff}
.nf .tail{position:absolute;left:1px;top:4px;width:11px;height:2.5px;background:var(--accent);transform-origin:left center;border-radius:2px}
.nf .tailA{animation:tailFlap .5s ease-in-out infinite}
.nf .tailB{top:7px;width:8px;opacity:.8;animation:tailFlap .5s ease-in-out infinite .08s}
/* Grundpose */
.nf .thighF{transform:rotate(7deg)}.nf .thighB{transform:rotate(-7deg)}
.nf .shinF{transform:rotate(-7deg)}.nf .shinB{transform:rotate(-11deg)}
.nf .uarmF{transform:rotate(16deg)}.nf .uarmB{transform:rotate(-13deg)}
.nf .farmF,.nf .farmB{transform:rotate(-22deg)}
.nf-idle .nf-in{animation:breathe 2.4s ease-in-out infinite}
@keyframes breathe{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}
@keyframes tailFlap{0%,100%{transform:rotate(8deg)}50%{transform:rotate(-14deg)}}
/* ── RUN ── */
.nf-run .nf-in{animation:bob .52s linear infinite}
.nf-run .spine{transform:rotate(-10deg)}
.nf-run .thighF{animation:thF .52s linear infinite}
.nf-run .shinF{animation:shF .52s linear infinite}
.nf-run .thighB{animation:thF .52s linear infinite -.26s}
.nf-run .shinB{animation:shF .52s linear infinite -.26s}
.nf-run .uarmF{animation:uaR .52s linear infinite -.26s}
.nf-run .uarmB{animation:uaR .52s linear infinite}
.nf-run .farmF,.nf-run .farmB{transform:rotate(-48deg)}
@keyframes bob{0%{transform:translateY(0)}25%{transform:translateY(-3px)}50%{transform:translateY(0)}75%{transform:translateY(-3px)}100%{transform:translateY(0)}}
@keyframes thF{0%{transform:rotate(30deg)}25%{transform:rotate(2deg)}50%{transform:rotate(-32deg)}75%{transform:rotate(-12deg)}100%{transform:rotate(30deg)}}
@keyframes shF{0%{transform:rotate(-12deg)}25%{transform:rotate(-60deg)}50%{transform:rotate(-14deg)}75%{transform:rotate(-84deg)}100%{transform:rotate(-12deg)}}
@keyframes uaR{0%{transform:rotate(-36deg)}50%{transform:rotate(36deg)}100%{transform:rotate(-36deg)}}
/* ── JUMP ── */
.hop{animation:hopArc 1s ease-in-out infinite}
@keyframes hopArc{0%{transform:translateY(0)}40%{transform:translateY(-34px)}55%{transform:translateY(-34px)}100%{transform:translateY(0)}}
.nf-jump .spine{transform:rotate(-15deg)}
.nf-jump .thighF{transform:rotate(48deg)}.nf-jump .shinF{transform:rotate(-88deg)}
.nf-jump .thighB{transform:rotate(20deg)}.nf-jump .shinB{transform:rotate(-66deg)}
.nf-jump .uarmF{transform:rotate(-46deg)}.nf-jump .uarmB{transform:rotate(-64deg)}
.nf-jump .farmF,.nf-jump .farmB{transform:rotate(-30deg)}
/* ── HANG ── */
.nf-hang .uarmF,.nf-hang .uarmB{transform:rotate(170deg)}
.nf-hang .farmF,.nf-hang .farmB{transform:rotate(6deg)}
.nf-hang .spine{animation:hangSway 1.4s ease-in-out infinite}
.nf-hang .thighF{animation:legSwingA 1.4s ease-in-out infinite}
.nf-hang .thighB{animation:legSwingB 1.4s ease-in-out infinite}
.nf-hang .shinF,.nf-hang .shinB{transform:rotate(-30deg)}
@keyframes hangSway{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@keyframes legSwingA{0%,100%{transform:rotate(14deg)}50%{transform:rotate(-10deg)}}
@keyframes legSwingB{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(20deg)}}
/* ── SWING ── */
.swing-pivot{transform-origin:top center;animation:swingPend 1.2s ease-in-out infinite alternate}
@keyframes swingPend{0%{transform:rotate(-34deg)}100%{transform:rotate(34deg)}}
.nf-swing .uarmF,.nf-swing .uarmB{transform:rotate(172deg)}
.nf-swing .farmF,.nf-swing .farmB{transform:rotate(2deg)}
.nf-swing .thighF{transform:rotate(18deg)}.nf-swing .thighB{transform:rotate(8deg)}
.nf-swing .shinF,.nf-swing .shinB{transform:rotate(-24deg)}
/* ── CLIMB ── */
.nf-climb .spine{transform:rotate(4deg)}
.nf-climb .uarmF{animation:climbArmA 1s ease-in-out infinite}
.nf-climb .uarmB{animation:climbArmB 1s ease-in-out infinite}
.nf-climb .farmF,.nf-climb .farmB{transform:rotate(-30deg)}
.nf-climb .thighF{animation:climbLegA 1s ease-in-out infinite}
.nf-climb .thighB{animation:climbLegB 1s ease-in-out infinite}
.nf-climb .shinF,.nf-climb .shinB{transform:rotate(-40deg)}
@keyframes climbArmA{0%,100%{transform:rotate(150deg)}50%{transform:rotate(118deg)}}
@keyframes climbArmB{0%,100%{transform:rotate(118deg)}50%{transform:rotate(150deg)}}
@keyframes climbLegA{0%,100%{transform:rotate(38deg)}50%{transform:rotate(12deg)}}
@keyframes climbLegB{0%,100%{transform:rotate(12deg)}50%{transform:rotate(38deg)}}
/* ── CELEBRATE (8 Fussball-Style-Varianten) ── */
.cel .farmF,.cel .farmB{transform:rotate(-30deg)}
.cel-0 .nf-in{animation:hopS .5s ease-in-out infinite}
.cel-0 .uarmF,.cel-0 .uarmB{animation:pump .5s ease-in-out infinite}
@keyframes pump{0%,100%{transform:rotate(-120deg)}50%{transform:rotate(-165deg)}}
@keyframes hopS{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.cel-1 .nf-in{animation:flip 1.3s cubic-bezier(.5,0,.5,1) infinite}
@keyframes flip{0%,18%{transform:translateY(0) rotate(0)}55%{transform:translateY(-22px) rotate(-360deg)}80%,100%{transform:translateY(0) rotate(-360deg)}}
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
@keyframes bow{0%,100%{transform:rotate(0)}50%{transform:rotate(40deg)}}
.cel-6 .nf-in{animation:spin 1.1s linear infinite}
.cel-6 .thighF{transform:rotate(50deg)}.cel-6 .thighB{transform:rotate(-50deg)}
.cel-6 .shinF,.cel-6 .shinB{transform:rotate(-30deg)}
.cel-6 .uarmF{transform:rotate(70deg)}.cel-6 .uarmB{transform:rotate(-70deg)}
@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
.cel-7{animation:bigHop .7s cubic-bezier(.4,0,.5,1) infinite}
.cel-7 .uarmF,.cel-7 .uarmB{transform:rotate(165deg)}
.cel-7 .thighF{transform:rotate(24deg)}.cel-7 .shinF{transform:rotate(-50deg)}
.cel-7 .thighB{transform:rotate(-18deg)}.cel-7 .shinB{transform:rotate(-44deg)}
@keyframes bigHop{0%,100%{transform:translateY(0)}45%{transform:translateY(-12px)}}
/* Buzzer */
.buzz-dome{width:26px;height:15px;border-radius:14px 14px 3px 3px;background:radial-gradient(circle at 40% 25%,#ff8a8a,#d11 65%,#900);box-shadow:0 0 0 2px #700,0 2px 4px rgba(0,0,0,.5)}
.buzz-dome.lit{background:radial-gradient(circle at 40% 25%,#fff,#ff5a5a 55%,#e00);box-shadow:0 0 16px 4px rgba(255,60,60,.8),0 0 0 2px #f33;animation:buzzPulse .5s ease-in-out infinite}
@keyframes buzzPulse{0%,100%{box-shadow:0 0 16px 4px rgba(255,60,60,.8),0 0 0 2px #f33}50%{box-shadow:0 0 26px 8px rgba(255,90,90,1),0 0 0 2px #f55}}
@keyframes buzzPop{0%{transform:scale(.3);opacity:0}50%{transform:scale(1.25);opacity:1}100%{transform:scale(1);opacity:1}}
.buzzburst{color:#FFD60A;font-size:14px;animation:sparkle .8s ease-out infinite;text-shadow:0 0 6px rgba(255,214,10,.9)}
@keyframes sparkle{0%{transform:scale(.4) rotate(0);opacity:0}40%{opacity:1}100%{transform:scale(1.3) rotate(40deg);opacity:0}}
`}</style>
);
