// StatWidgets.jsx — zusätzliche Statistik-Kacheln für den Display-Builder.
// Jede Kachel bekommt die dataProps {compId,info,completedRuns,athletesMap,pipelineData,skillScores}
// plus cats (Divisions-Filter oder null = alle) und lang.
import React, { useState, useEffect, useRef } from 'react';
import { IGN_CATS } from '../config.js';
import { fmtMs, toFlag, ageOnDate, skillTotalOf, skillRankingOf, computeRankedPipeline, computeDivisionOverall } from '../utils.js';
import { I } from '../icons.jsx';
import { useFbVal } from '../hooks.js';

// ── kleine Helfer ──────────────────────────────────────────────────────────
const mono = { fontFamily: 'JetBrains Mono, monospace' };
const DIFF_COL = { easy: '#30D158', medium: '#FF9F0A', hard: '#FF3B30' };
const DIFF_LB = { easy: { de: 'Leicht', en: 'Easy' }, medium: { de: 'Mittel', en: 'Medium' }, hard: { de: 'Schwer', en: 'Hard' } };
const MEDAL = ['#FFD60A', '#CBD2DC', '#E0915A']; // Gold / Silber / Bronze
const catMeta = id => IGN_CATS.find(c => c.id === id) || { name: { de: id, en: id }, color: '#8E8E93' };
const divLabel = (id, lang) => catMeta(id).name?.[lang] || id;
const divColor = id => catMeta(id).color;
const runArr = cr => Object.values(cr || {}).filter(r => r && typeof r === 'object');
const inCats = (catId, cats) => !Array.isArray(cats) || !cats.length || cats.includes(catId);
const activeDivs = (athletesMap, cats) => {
  const present = new Set(Object.values(athletesMap || {}).map(a => a?.cat).filter(Boolean));
  return IGN_CATS.map(c => c.id).filter(id => present.has(id) && inCats(id, cats));
};
const skillCfg = info => ({ skills: info?.skillPhase?.skills || [], isOld: (info?.skillPhase?.type || 'oldschool') === 'oldschool' });

// Füllt den Eltern-Container und scrollt langsam durch — bei kleineren Fenstern automatisch
// mehr (fixe Pixel/Frame ⇒ mehr Overflow = längerer Lauf). Hin & zurück, mit Pause oben/unten.
// Scrollt nur, wenn der Inhalt wirklich überläuft; passt sich live an Höhen-/Datenänderungen an.
const AutoScroll = ({ children, speed = 0.4 }) => {
  const ref = useRef(null);
  useEffect(() => {
    let pos = 0, dir = 1, pauseUntil = Date.now() + 2200, animId;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const maxS = el.scrollHeight - el.clientHeight;
        const now = Date.now();
        if (maxS > 6) {
          if (now >= pauseUntil) {
            pos += speed * dir;
            if (pos >= maxS) { pos = maxS; dir = -1; pauseUntil = now + 2600; }
            else if (pos <= 0) { pos = 0; dir = 1; pauseUntil = now + 2600; }
            el.scrollTop = pos;
          }
        } else { pos = 0; el.scrollTop = 0; }
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [speed]);
  return <div ref={ref} style={{ height: '100%', overflowY: 'hidden' }}>{children}</div>;
};
const Shell = ({ title, Icon, accent = '#FF5E3A', right, children }) => (
  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, gap: 11 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
      <span style={{ width: 28, height: 28, borderRadius: 9, background: accent + '22', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{Icon && <Icon s={16} c={accent} />}</span>
      <div style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,.92)' }}>{title}</div>
      {right != null && <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', fontWeight: 700, ...mono }}>{right}</div>}
    </div>
    <div style={{ flex: 1, minHeight: 0 }}><AutoScroll>{children}</AutoScroll></div>
  </div>
);
const Empty = ({ msg }) => <div style={{ padding: '24px 12px', textAlign: 'center', color: 'rgba(255,255,255,.32)', fontSize: 13, fontWeight: 600 }}>{msg}</div>;
const RankDot = ({ i, size = 22 }) => (
  <span style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.5), fontWeight: 800, ...mono, background: i < 3 ? MEDAL[i] + '26' : 'rgba(255,255,255,.06)', color: i < 3 ? MEDAL[i] : 'rgba(255,255,255,.5)', border: `1px solid ${i < 3 ? MEDAL[i] + '66' : 'transparent'}` }}>{i + 1}</span>
);
const Bar = ({ pct, color, h = 6 }) => (
  <div style={{ height: h, borderRadius: h, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${Math.max(2, Math.min(100, pct))}%`, borderRadius: h, background: `linear-gradient(90deg, ${color}AA, ${color})`, transition: 'width .5s ease' }} />
  </div>
);
const NameFlag = ({ ath, lang, size = 14 }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
    {ath?.country && <span style={{ fontSize: size + 1, flexShrink: 0 }}>{toFlag(ath.country)}</span>}
    <span style={{ fontWeight: 700, fontSize: size, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ath?.name || '—'}</span>
  </span>
);

// ── 1. Hindernis-Killer — welches Hindernis hat am meisten Athleten gestoppt ──
const ObstacleKiller = ({ completedRuns, cats, lang }) => {
  const counts = {};
  runArr(completedRuns).filter(r => r.fellAt && inCats(r.catId, cats)).forEach(r => {
    const n = r.fellAt.name; counts[n] = (counts[n] || 0) + 1;
  });
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 9);
  const max = ranked[0]?.[1] || 1;
  const total = Object.values(counts).reduce((s, c) => s + c, 0);
  return (
    <Shell title={lang === 'de' ? 'Hindernis-Killer' : 'Obstacle Killer'} Icon={I.XCircle} accent="#FF3B30" right={`${total} ${lang === 'de' ? 'Stürze' : 'falls'}`}>
      {ranked.length === 0 ? <Empty msg={lang === 'de' ? 'Noch keine Stürze' : 'No falls yet'} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {ranked.map(([name, c], i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <RankDot i={i} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                  {i === 0 && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.08em', color: '#FF3B30', background: 'rgba(255,59,48,.14)', padding: '2px 6px', borderRadius: 5, flexShrink: 0 }}>{lang === 'de' ? 'BOSS' : 'BOSS'}</span>}
                </div>
                <Bar pct={(c / max) * 100} color="#FF3B30" />
              </div>
              <span style={{ ...mono, fontSize: 19, fontWeight: 800, color: i === 0 ? '#FF3B30' : 'rgba(255,255,255,.85)', minWidth: 26, textAlign: 'right' }}>{c}</span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
};

// ── 2. Skills nach Schwierigkeit — Top-Liste pro Level ───────────────────────
const SkillsByDifficulty = ({ info, athletesMap, skillScores, cats, lang }) => {
  const { skills, isOld } = skillCfg(info);
  const aIds = Object.keys(athletesMap || {}).filter(id => inCats(athletesMap[id]?.cat, cats));
  const levels = ['easy', 'medium', 'hard'].filter(d => skills.some(s => (s.difficulty || 'medium') === d));
  return (
    <Shell title={lang === 'de' ? 'Skills nach Level' : 'Skills by Level'} Icon={I.Muscle} accent="#FFD60A">
      {levels.length === 0 ? <Empty msg={lang === 'de' ? 'Keine Skills definiert' : 'No skills defined'} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${levels.length}, 1fr)`, gap: 12 }}>
          {levels.map(diff => {
            const dSkills = skills.filter(s => (s.difficulty || 'medium') === diff);
            const ranked = aIds.map(id => ({ ath: athletesMap[id], pts: skillTotalOf(skillScores?.[id], dSkills, isOld) }))
              .filter(r => r.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, 6);
            const col = DIFF_COL[diff];
            return (
              <div key={diff} style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: col }} />
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: col }}>{DIFF_LB[diff][lang]}</span>
                </div>
                {ranked.length === 0 ? <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>—</div> : ranked.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0' }}>
                    <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: i < 3 ? MEDAL[i] : 'rgba(255,255,255,.4)', width: 12 }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0 }}><NameFlag ath={r.ath} lang={lang} size={12.5} /></span>
                    <span style={{ ...mono, fontSize: 12.5, fontWeight: 800, color: col }}>{r.pts}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
};

// ── 3. Seltene Skills — welche Skills haben am wenigsten geschafft ────────────
const RareSkills = ({ info, athletesMap, skillScores, cats, lang }) => {
  const { skills } = skillCfg(info);
  const aIds = Object.keys(athletesMap || {}).filter(id => inCats(athletesMap[id]?.cat, cats));
  const rows = skills.map(sk => {
    let n = 0;
    aIds.forEach(id => { const s = skillScores?.[id]?.[sk.id]; if (s && (s.a1 || s.a2 || s.a3 || s.flashed || s.poolScore > 0)) n++; });
    return { sk, n };
  }).filter(r => r.n > 0).sort((a, b) => a.n - b.n).slice(0, 9);
  const maxN = Math.max(1, ...rows.map(r => r.n));
  return (
    <Shell title={lang === 'de' ? 'Seltene Skills' : 'Rare Skills'} Icon={I.Award} accent="#BF5AF2">
      {rows.length === 0 ? <Empty msg={lang === 'de' ? 'Noch keine Skills geschafft' : 'No skills landed yet'} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {rows.map(({ sk, n }, i) => {
            const col = DIFF_COL[sk.difficulty || 'medium'];
            return (
              <div key={sk.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: col, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sk.name}</div>
                  <Bar pct={(n / maxN) * 100} color={col} h={5} />
                </div>
                <span style={{ ...mono, fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,.85)', flexShrink: 0 }}>{n}<span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', fontWeight: 600 }}>{lang === 'de' ? '×' : '×'}</span></span>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
};

// ── 4. Nationen-Medaillenspiegel ─────────────────────────────────────────────
const MedalTable = ({ completedRuns, athletesMap, pipelineData, skillScores, info, cats, lang }) => {
  const runList = runArr(completedRuns);
  const stages = Object.values(pipelineData || {}).filter(s => s && typeof s === 'object');
  const { skills, isOld } = skillCfg(info);
  const tally = {}; // country -> [g,s,b]
  activeDivs(athletesMap, cats).forEach(catId => {
    try {
      const isLk2 = /2$/.test(catId);
      const skillRanking = isLk2 ? skillRankingOf(catId, athletesMap, skillScores, skills, isOld) : [];
      const { ranked } = computeDivisionOverall(catId, { runList, pipelineStages: stages, skillRanking, computeStageFn: computeRankedPipeline });
      (ranked || []).slice(0, 3).forEach((r, i) => {
        const c = athletesMap?.[r.athleteId]?.country; if (!c) return;
        if (!tally[c]) tally[c] = [0, 0, 0]; tally[c][i]++;
      });
    } catch (e) { /* division noch nicht wertbar */ }
  });
  const rows = Object.entries(tally).map(([c, m]) => ({ c, g: m[0], s: m[1], b: m[2], t: m[0] + m[1] + m[2] }))
    .sort((a, b) => b.g - a.g || b.s - a.s || b.b - a.b || b.t - a.t);
  return (
    <Shell title={lang === 'de' ? 'Nationenwertung' : 'Nations'} Icon={I.Award} accent="#FFD60A" right={rows.length ? `${rows.length} ${lang === 'de' ? 'Länder' : 'nations'}` : null}>
      {rows.length === 0 ? <Empty msg={lang === 'de' ? 'Noch keine Podestplätze' : 'No podiums yet'} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 4px 7px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.4)', letterSpacing: '.04em' }}>
            <span style={{ width: 24 }} /><span style={{ flex: 1 }} />
            <span style={{ width: 28, textAlign: 'center' }}>🥇</span><span style={{ width: 28, textAlign: 'center' }}>🥈</span><span style={{ width: 28, textAlign: 'center' }}>🥉</span>
          </div>
          {rows.map((r, i) => (
            <div key={r.c} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderTop: i ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
              <span style={{ fontSize: 22, width: 24, textAlign: 'center' }}>{toFlag(r.c)}</span>
              <span style={{ flex: 1, fontWeight: 800, fontSize: 14, letterSpacing: '.02em' }}>{r.c}</span>
              {[r.g, r.s, r.b].map((v, k) => <span key={k} style={{ ...mono, width: 28, textAlign: 'center', fontSize: 15, fontWeight: 800, color: v ? MEDAL[k] : 'rgba(255,255,255,.18)' }}>{v || '·'}</span>)}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
};

// ── 5. Rekord-Board — schnellste beendete Läufe ──────────────────────────────
const RecordBoard = ({ completedRuns, athletesMap, cats, lang }) => {
  const done = runArr(completedRuns).filter(r => r.status === 'complete' && r.finalTime > 0 && inCats(r.catId, cats))
    .sort((a, b) => a.finalTime - b.finalTime);
  const hero = done[0];
  const rest = done.slice(1, 7);
  return (
    <Shell title={lang === 'de' ? 'Bestzeiten' : 'Records'} Icon={I.Bolt} accent="#FF9F0A" right={done.length ? `${done.length} ${lang === 'de' ? 'im Ziel' : 'finished'}` : null}>
      {!hero ? <Empty msg={lang === 'de' ? 'Noch keine Ziel-Zeit' : 'No finishes yet'} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(255,159,10,.16), rgba(255,159,10,.04))', border: '1px solid rgba(255,159,10,.3)', borderRadius: 14, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 13 }}>
            <span style={{ fontSize: 28 }}>⚡</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.1em', color: '#FF9F0A', textTransform: 'uppercase', marginBottom: 2 }}>{lang === 'de' ? 'Schnellster Lauf' : 'Fastest run'}</div>
              <NameFlag ath={athletesMap?.[hero.athleteId]} lang={lang} size={15} />
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.45)', marginTop: 1 }}>{divLabel(hero.catId, lang)}</div>
            </div>
            <span style={{ ...mono, fontSize: 24, fontWeight: 800, color: '#FF9F0A' }}>{fmtMs(hero.finalTime)}</span>
          </div>
          {rest.map((r, i) => (
            <div key={r._fbKey || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 2px' }}>
              <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.4)', width: 16 }}>{i + 2}</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: divColor(r.catId), flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}><NameFlag ath={athletesMap?.[r.athleteId]} lang={lang} size={13} /></span>
              <span style={{ ...mono, fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,.82)' }}>{fmtMs(r.finalTime)}</span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
};

// ── 6. Buzzer-Quote — wie viele beenden den Parcours, pro Division ───────────
const BuzzerRate = ({ completedRuns, cats, lang }) => {
  const byDiv = {};
  runArr(completedRuns).filter(r => inCats(r.catId, cats)).forEach(r => {
    // pro Athlet nur EINMAL zählen (bester Versuch): finished gewinnt
    if (!byDiv[r.catId]) byDiv[r.catId] = {};
    const cur = byDiv[r.catId][r.athleteId];
    const fin = r.status === 'complete';
    if (cur === undefined || (fin && !cur)) byDiv[r.catId][r.athleteId] = fin;
  });
  const rows = Object.entries(byDiv).map(([catId, ath]) => {
    const ids = Object.values(ath); const fin = ids.filter(Boolean).length;
    return { catId, fin, tot: ids.length, pct: ids.length ? Math.round(fin / ids.length * 100) : 0 };
  }).sort((a, b) => b.pct - a.pct);
  return (
    <Shell title={lang === 'de' ? 'Buzzer-Quote' : 'Buzzer Rate'} Icon={I.FlagCheck} accent="#30D158">
      {rows.length === 0 ? <Empty msg={lang === 'de' ? 'Noch keine Läufe' : 'No runs yet'} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map(r => (
            <div key={r.catId}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: divColor(r.catId), flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 13, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{divLabel(r.catId, lang)}</span>
                <span style={{ ...mono, fontSize: 15, fontWeight: 800, color: '#30D158' }}>{r.pct}%</span>
                <span style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{r.fin}/{r.tot}</span>
              </div>
              <Bar pct={r.pct} color="#30D158" h={7} />
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
};

// ── 7. Jüngste / Älteste ─────────────────────────────────────────────────────
const AgeExtremes = ({ info, athletesMap, cats, lang }) => {
  const ref = info?.date;
  const withAge = Object.keys(athletesMap || {}).filter(id => inCats(athletesMap[id]?.cat, cats))
    .map(id => ({ ath: athletesMap[id], age: ageOnDate(athletesMap[id]?.birthdate, ref) }))
    .filter(r => r.age != null);
  if (withAge.length === 0) return <Shell title={lang === 'de' ? 'Alter' : 'Age'} Icon={I.User} accent="#64D2FF"><Empty msg={lang === 'de' ? 'Keine Geburtsdaten' : 'No birthdates'} /></Shell>;
  const sorted = [...withAge].sort((a, b) => a.age - b.age);
  const youngest = sorted[0], oldest = sorted[sorted.length - 1];
  const avg = (withAge.reduce((s, r) => s + r.age, 0) / withAge.length).toFixed(1);
  const Card = ({ lb, r, col, emoji }) => (
    <div style={{ flex: 1, background: col + '14', border: `1px solid ${col}33`, borderRadius: 13, padding: '12px 13px' }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: col, marginBottom: 6 }}>{emoji} {lb}</div>
      <NameFlag ath={r.ath} lang={lang} size={14.5} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 5 }}>
        <span style={{ ...mono, fontSize: 26, fontWeight: 800, color: col }}>{r.age}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', fontWeight: 600 }}>{lang === 'de' ? 'Jahre' : 'yrs'}</span>
      </div>
    </div>
  );
  return (
    <Shell title={lang === 'de' ? 'Jüngste / Älteste' : 'Youngest / Oldest'} Icon={I.User} accent="#64D2FF" right={`Ø ${avg}`}>
      <div style={{ display: 'flex', gap: 11 }}>
        <Card lb={lang === 'de' ? 'Jüngste:r' : 'Youngest'} r={youngest} col="#30D158" emoji="🌱" />
        <Card lb={lang === 'de' ? 'Älteste:r' : 'Oldest'} r={oldest} col="#FF9F0A" emoji="🦾" />
      </div>
    </Shell>
  );
};

// ── 8. Skill-Fortschritt pro Division ────────────────────────────────────────
const SkillProgress = ({ info, athletesMap, skillScores, cats, lang }) => {
  const { skills, isOld } = skillCfg(info);
  const rows = activeDivs(athletesMap, cats).map(catId => {
    const ids = Object.keys(athletesMap || {}).filter(id => athletesMap[id]?.cat === catId);
    let scored = 0, sumPts = 0;
    ids.forEach(id => { const p = skillTotalOf(skillScores?.[id], skills, isOld); if (p > 0) scored++; sumPts += p; });
    return { catId, scored, tot: ids.length, avg: ids.length ? Math.round(sumPts / ids.length) : 0, pct: ids.length ? Math.round(scored / ids.length * 100) : 0 };
  }).filter(r => r.tot > 0);
  return (
    <Shell title={lang === 'de' ? 'Skill-Fortschritt' : 'Skill Progress'} Icon={I.TrendUp} accent="#5DCA7E">
      {rows.length === 0 ? <Empty msg={lang === 'de' ? 'Keine Divisionen' : 'No divisions'} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map(r => (
            <div key={r.catId}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: divColor(r.catId), flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 13, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{divLabel(r.catId, lang)}</span>
                <span style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,.5)' }}>Ø {r.avg}</span>
                <span style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,.4)' }}>{r.scored}/{r.tot}</span>
              </div>
              <Bar pct={r.pct} color={divColor(r.catId)} h={7} />
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
};

// Parcours-Helfer (Hindernisliste der relevanten Stage)
const obsList = stage => {
  const o = stage?.obstacles; const arr = o ? (Array.isArray(o) ? o : Object.values(o)) : [];
  return arr.filter(x => x && typeof x === 'object').sort((a, b) => (a.order || 0) - (b.order || 0));
};
const isPlat = o => o?.type === 'section' || /plattform|platform/i.test(o?.name || '');
const mainStage = (pipelineData, cats) => {
  const stages = Object.entries(pipelineData || {}).map(([id, s]) => ({ id, ...(s || {}) })).filter(s => s.obstacles);
  const match = stages.filter(s => !Array.isArray(cats) || !cats.length || (Array.isArray(s.categories) && s.categories.some(c => cats.includes(c))));
  return (match.length ? match : stages).sort((a, b) => obsList(b).length - obsList(a).length)[0] || null;
};
const rateColor = rate => `hsl(${Math.round(130 * (1 - Math.min(1, Math.max(0, rate))))}, 78%, 48%)`;

// ── 9. Parcours-Heatmap — Sturzrate pro Hindernis entlang des Parcours ───────
const ParcoursHeatmap = ({ completedRuns, pipelineData, cats, lang }) => {
  const stage = mainStage(pipelineData, cats);
  const obs = obsList(stage);
  // Über ALLE passenden Läufe nach Hindernis-NAME aggregieren (Stages teilen denselben Parcours)
  const runs = stage ? runArr(completedRuns).filter(r => inCats(r.catId, cats)) : [];
  const stat = {}; obs.forEach(o => stat[o.name] = { fell: 0, done: 0 });
  runs.forEach(r => {
    new Set((r.doneCP || []).map(d => d.name).filter(Boolean)).forEach(n => { if (stat[n]) stat[n].done++; });
    if (r.fellAt?.name && stat[r.fellAt.name] != null) stat[r.fellAt.name].fell++;
  });
  // Farbe relativ zum schwersten Hindernis skalieren (Raten sind absolut oft niedrig) → klarer Grün→Rot-Verlauf
  const maxRate = Math.max(0.001, ...obs.filter(o => !isPlat(o)).map(o => { const s = stat[o.name] || { fell: 0, done: 0 }; const a = s.fell + s.done; return a ? s.fell / a : 0; }));
  return (
    <Shell title={lang === 'de' ? 'Parcours-Heatmap' : 'Course Heatmap'} Icon={I.BarChart} accent="#FF9F0A" right={runs.length ? `${runs.length} ${lang === 'de' ? 'Läufe' : 'runs'}` : null}>
      {obs.length === 0 || runs.length === 0 ? <Empty msg={lang === 'de' ? 'Noch keine Läufe' : 'No runs yet'} /> : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'stretch' }}>
          {obs.map(o => {
            if (isPlat(o)) return <div key={o.id} style={{ display: 'flex', alignItems: 'center', padding: '0 8px', borderRadius: 7, background: 'rgba(10,132,255,.14)', border: '1px solid rgba(10,132,255,.3)', fontSize: 10, fontWeight: 800, color: '#4DA3FF', letterSpacing: '.02em', whiteSpace: 'nowrap' }}>▮ {o.name.replace(/plattform\s*/i, 'P')}</div>;
            const s = stat[o.name] || { fell: 0, done: 0 }; const att = s.fell + s.done; const rate = att ? s.fell / att : 0; const col = att ? rateColor(rate / maxRate) : '#3a3a44';
            return (
              <div key={o.id} title={`${o.name}: ${Math.round(rate * 100)}% (${s.fell}/${att})`} style={{ flex: '1 1 78px', minWidth: 70, background: col + '24', border: `1px solid ${col}66`, borderRadius: 9, padding: '7px 8px' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 5 }}>{o.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ ...mono, fontSize: 16, fontWeight: 800, color: col }}>{att ? Math.round(rate * 100) : '–'}{att ? '%' : ''}</span>
                  {att > 0 && <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,.4)', ...mono }}>{s.fell}×</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
};

// ── 10. Segment-Bestzeiten — schnellster Abschnitt Plattform → Plattform ─────
const SegmentSplits = ({ completedRuns, athletesMap, pipelineData, cats, lang }) => {
  const stage = mainStage(pipelineData, cats);
  const obs = obsList(stage);
  const plats = obs.filter(isPlat);
  // Plattformen über NAMEN matchen (obsIds können nach Duplizieren des Wettkampfs abweichen).
  // Segmente zwischen aufeinanderfolgenden Plattformen, über alle passenden Läufe.
  const runs = stage ? runArr(completedRuns).filter(r => inCats(r.catId, cats)) : [];
  const platTime = (r, name) => { const d = (r.doneCP || []).find(x => x.name === name); return d ? d.time : null; };
  const segs = [];
  for (let i = 1; i < plats.length; i++) {
    const a = plats[i - 1].name, b = plats[i].name;
    let best = Infinity, who = null;
    runs.forEach(r => { const t1 = platTime(r, a), t2 = platTime(r, b); if (t1 != null && t2 != null && t2 > t1) { const d = t2 - t1; if (d < best) { best = d; who = r.athleteId; } } });
    if (best < Infinity) segs.push({ label: `P${i} → P${i + 1}`, best, who });
  }
  return (
    <Shell title={lang === 'de' ? 'Segment-Bestzeiten' : 'Segment Records'} Icon={I.Clock} accent="#32ADE6">
      {segs.length === 0 ? <Empty msg={lang === 'de' ? 'Noch keine Plattform-Zeiten' : 'No platform splits yet'} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {segs.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 2px' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#32ADE6', ...mono, minWidth: 66, whiteSpace: 'nowrap' }}>{s.label}</span>
              <span style={{ flex: 1, minWidth: 0 }}><NameFlag ath={athletesMap?.[s.who]} lang={lang} size={12.5} /></span>
              <span style={{ ...mono, fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,.85)' }}>{fmtMs(s.best)}</span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
};

// ── 11. Skill-Trophäen-Matrix — Athleten × Skills, eingefärbt nach Level ─────
const SkillMatrix = ({ info, athletesMap, skillScores, cats, lang }) => {
  const { skills, isOld } = skillCfg(info);
  const ranked = Object.keys(athletesMap || {}).filter(id => inCats(athletesMap[id]?.cat, cats))
    .map(id => ({ id, ath: athletesMap[id], pts: skillTotalOf(skillScores?.[id], skills, isOld) }))
    .filter(r => r.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, 14);
  const lvlOpacity = s => !s ? 0 : (s.a1 || (s.poolScore > 0 && s.flashed)) ? 1 : s.a2 ? 0.62 : (s.a3 || s.poolScore > 0) ? 0.34 : 0;
  return (
    <Shell title={lang === 'de' ? 'Skill-Matrix' : 'Skill Matrix'} Icon={I.Grid} accent="#BF5AF2" right={`${skills.length} Skills`}>
      {ranked.length === 0 || skills.length === 0 ? <Empty msg={lang === 'de' ? 'Noch keine Skills' : 'No skills yet'} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {ranked.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 96, flexShrink: 0, minWidth: 0 }}><NameFlag ath={r.ath} lang={lang} size={11.5} /></span>
              <div style={{ flex: 1, display: 'flex', gap: 3 }}>
                {skills.map(sk => {
                  const op = lvlOpacity(skillScores?.[r.id]?.[sk.id]); const col = DIFF_COL[sk.difficulty || 'medium'];
                  return <span key={sk.id} title={sk.name} style={{ flex: 1, height: 15, borderRadius: 3, background: op ? col : 'rgba(255,255,255,.05)', opacity: op || 1 }} />;
                })}
              </div>
              <span style={{ ...mono, fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.7)', width: 34, textAlign: 'right' }}>{r.pts}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,.45)' }}>
            {['easy', 'medium', 'hard'].filter(d => skills.some(s => (s.difficulty || 'medium') === d)).map(d => (
              <span key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: DIFF_COL[d] }} />{DIFF_LB[d][lang]}</span>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
};

// ── 12. Skill-Live-Ticker — Laufband gemeisterter Skills ─────────────────────
const SkillTicker = ({ info, athletesMap, skillScores, cats, lang }) => {
  const { skills } = skillCfg(info);
  const skById = {}; skills.forEach(s => skById[s.id] = s);
  const [feed, setFeed] = useState([]);
  const seenRef = useRef(null);
  useEffect(() => {
    if (!skillScores || Object.keys(skillScores).length === 0) return; // erst seeden, wenn echte Daten da sind
    const snap = {};
    Object.keys(skillScores || {}).forEach(aid => {
      if (!inCats(athletesMap?.[aid]?.cat, cats)) return;
      Object.keys(skillScores[aid] || {}).forEach(sid => {
        const s = skillScores[aid][sid]; const lvl = s?.a1 ? 'a1' : s?.a2 ? 'a2' : (s?.a3 || s?.poolScore > 0) ? 'a3' : null;
        if (lvl) snap[`${aid}|${sid}`] = lvl;
      });
    });
    if (seenRef.current === null) { // erstes Laden: Showcase = ein Highlight pro Athlet (bestes Level)
      seenRef.current = snap;
      const perAth = {};
      Object.entries(snap).forEach(([k, lvl]) => { const aid = k.split('|')[0]; const rank = lvl === 'a1' ? 0 : lvl === 'a2' ? 1 : 2; if (!perAth[aid] || rank < perAth[aid].rank) perAth[aid] = { k, lvl, rank }; });
      const seed = Object.values(perAth).sort((a, b) => a.rank - b.rank).slice(0, 12).map(({ k, lvl }) => { const [aid, sid] = k.split('|'); return { aid, sid, lvl, id: k }; });
      setFeed(seed);
      return;
    }
    const fresh = [];
    Object.entries(snap).forEach(([k, lvl]) => { if (seenRef.current[k] !== lvl) { const [aid, sid] = k.split('|'); fresh.push({ aid, sid, lvl, id: k + ':' + lvl }); } });
    seenRef.current = snap;
    if (fresh.length) setFeed(f => [...fresh.reverse(), ...f].slice(0, 24));
  }, [skillScores, cats]);
  const LVL = { a1: { de: 'gemeistert', en: 'mastered', c: '#FFD60A' }, a2: { de: 'geschafft', en: 'cleared', c: '#30D158' }, a3: { de: 'versucht', en: 'tried', c: '#8E8E93' } };
  return (
    <Shell title={lang === 'de' ? 'Skill-Ticker' : 'Skill Ticker'} Icon={I.Bolt} accent="#FFD60A">
      {feed.length === 0 ? <Empty msg={lang === 'de' ? 'Warte auf Skills…' : 'Waiting for skills…'} /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {feed.map((f, i) => {
            const sk = skById[f.sid]; const lv = LVL[f.lvl] || LVL.a3; const dc = DIFF_COL[sk?.difficulty || 'medium'];
            return (
              <div key={f.id + i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 10, background: i === 0 ? lv.c + '14' : 'rgba(255,255,255,.03)', border: `1px solid ${i === 0 ? lv.c + '40' : 'transparent'}` }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: dc, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}><NameFlag ath={athletesMap?.[f.aid]} lang={lang} size={12.5} /></span>
                <span style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '38%', color: 'rgba(255,255,255,.6)' }}>{sk?.name || '—'}</span>
                <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: lv.c, flexShrink: 0 }}>{lv[lang]}</span>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
};

// ── 13. Ninja-Race — Figuren rennen über den Parcours, Reihenfolge = Live-Rang ─
const NINJA_COUNT = 16;
// Anzahl Lauf-Frames pro Figur. 1 = Einzel-Sprite + CSS-Wippen (Platzhalter, aktuell).
// Sobald echte Lauf-Frames generiert sind (n01_1.png … n01_N.png je Figur): hier hochsetzen
// → NinjaSprite spielt automatisch ein echtes Frame-Cycling ab (realistische Laufbewegung).
const RUN_FRAMES = 1;
const spriteSrc = (i, frame) => { const nn = String((i % NINJA_COUNT) + 1).padStart(2, '0'); return RUN_FRAMES > 1 ? `/ninjas/n${nn}_${frame}.png` : `/ninjas/n${nn}.png`; };
// Replay-Position (0..1) eines Laufs zur Zeit T (ms) — interpoliert linear zwischen den echten CP-Zeiten.
const replayProgress = (run, T, totalCP) => {
  const dc = run.doneCP || [];
  const tot = run.totalCPs || totalCP || 1;
  if (!dc.length) { const ft = run.finalTime || 0; return ft > 0 ? Math.min(0.5, (T / ft) * 0.5) : 0; }
  let n = 0; while (n < dc.length && (dc[n].time || 0) <= T) n++;
  if (n === 0) { const t0 = dc[0].time || 1; return Math.max(0, Math.min(1, T / t0)) / tot; }
  if (n >= dc.length) return Math.min(1, dc.length / tot);
  const prev = dc[n - 1].time || 0, next = dc[n].time || prev;
  const f = next > prev ? Math.max(0, Math.min(1, (T - prev) / (next - prev))) : 1;
  return Math.min(1, (n + f) / tot);
};
const NinjaSprite = ({ idx, active, onPlat, moving }) => {
  const [failed, setFailed] = useState(false);
  const [frame, setFrame] = useState(1);
  useEffect(() => {
    if (RUN_FRAMES <= 1 || !moving) { setFrame(1); return; }
    const iv = setInterval(() => setFrame(f => (f % RUN_FRAMES) + 1), 90);
    return () => clearInterval(iv);
  }, [moving]);
  const anim = RUN_FRAMES > 1 ? 'none' : (onPlat ? 'nidle 1.6s ease-in-out infinite' : 'nrun .5s ease-in-out infinite');
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', transformOrigin: 'bottom center', animation: anim }}>
      {failed
        ? <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontSize: 28 }}>🥷</span>
        : <img src={spriteSrc(idx, frame)} alt="" onError={() => setFailed(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', filter: active ? 'drop-shadow(0 0 6px rgba(255,94,58,.85))' : 'none' }} />}
    </div>
  );
};
const RaceWidget = ({ compId, info, completedRuns, athletesMap, pipelineData, cats, lang }) => {
  const activeRuns = useFbVal(`ogn/${compId}/activeRuns`);
  const stage = mainStage(pipelineData, cats);
  const obs = obsList(stage);
  const cpSeq = obs.filter(o => o.isCP || isPlat(o));   // Checkpoints inkl. Plattformen, in Reihenfolge
  const totalCP = Math.max(1, cpSeq.length);
  const platPos = cpSeq.map((o, i) => isPlat(o) ? (i / totalCP) : -1).filter(p => p >= 0);
  // Demo-Replay: alle bereits Gelaufenen rennen gleichzeitig in Echtzeit (1:1) ab ihren CP-Zeiten.
  const [demoStart, setDemoStart] = useState(null);
  const [, force] = useState(0);
  useEffect(() => {
    if (demoStart == null) return;
    let id; const tick = () => { force(n => (n + 1) % 1000000); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [demoStart]);
  const demoT = demoStart != null ? performance.now() - demoStart : null;
  const completedList = runArr(completedRuns).filter(r => inCats(r.catId, cats) && ((r.doneCP && r.doneCP.length) || r.finalTime));
  const hasCompleted = completedList.length > 0;
  const endOf = r => r.finalTime || (r.doneCP?.[r.doneCP.length - 1]?.time) || 0;

  let runners, demoDone = false;
  if (demoT != null) {
    const byA = {};
    completedList.forEach(r => { const cur = byA[r.athleteId]; const t = r.finalTime || 1e9; if (!cur || t < (cur.finalTime || 1e9)) byA[r.athleteId] = r; });
    const list = Object.values(byA);
    const maxT = Math.max(1, ...list.map(endOf));
    demoDone = demoT > maxT + 1200;
    runners = list.map(r => ({ athleteId: r.athleteId, progress: replayProgress(r, demoT, r.totalCPs || totalCP), finished: demoT >= endOf(r), time: r.finalTime || Infinity, active: demoT < endOf(r) }))
      .sort((a, b) => b.progress - a.progress || a.time - b.time).slice(0, 8);
  } else {
    const byAth = {};
    runArr(completedRuns).filter(r => inCats(r.catId, cats)).forEach(r => {
      const tot = r.totalCPs || totalCP;
      const prog = r.status === 'complete' ? 1 : Math.min(0.98, (r.doneCP?.length || 0) / tot);
      const cur = byAth[r.athleteId];
      const cand = { athleteId: r.athleteId, progress: prog, finished: r.status === 'complete', time: r.finalTime || Infinity, active: false };
      if (!cur || cand.progress > cur.progress || (cand.finished && cand.time < cur.time)) byAth[r.athleteId] = cand;
    });
    Object.values(activeRuns || {}).filter(r => r && typeof r === 'object' && inCats(r.catId, cats)).forEach(r => {
      const cp = r.doneCPCount != null ? r.doneCPCount : (r.doneCP?.length || 0);
      byAth[r.athleteId] = { athleteId: r.athleteId, progress: Math.min(0.98, cp / totalCP), finished: false, time: Infinity, active: true };
    });
    const all = Object.values(byAth);
    const liveR = all.filter(r => r.active).sort((a, b) => b.progress - a.progress);
    const doneR = all.filter(r => !r.active).sort((a, b) => b.progress - a.progress || a.time - b.time);
    runners = [...liveR.slice(0, 6), ...doneR].slice(0, 8).sort((a, b) => b.progress - a.progress || a.time - b.time);
  }
  const demoBtn = hasCompleted ? (
    <button onClick={() => setDemoStart(demoStart != null ? null : performance.now())} style={{ ...mono, fontSize: 10.5, fontWeight: 800, letterSpacing: '.03em', padding: '4px 10px', borderRadius: 13, cursor: 'pointer', border: `1px solid ${demoStart != null ? 'rgba(255,59,48,.5)' : 'rgba(255,94,58,.5)'}`, background: demoStart != null ? 'rgba(255,59,48,.16)' : 'rgba(255,94,58,.14)', color: demoStart != null ? '#FF6B6B' : '#FF8A5E' }}>{demoStart != null ? '■ Live' : '▶ Demo'}</button>
  ) : null;
  const anyLive = demoT == null && runners.some(r => r.active);
  const rightSlot = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      {demoT != null ? <span style={{ color: demoDone ? 'var(--green)' : '#FF8A5E' }}>{demoDone ? (lang === 'de' ? '✓ fertig' : '✓ done') : fmtMs(Math.round(demoT))}</span> : (anyLive ? <span style={{ color: '#FF5E3A' }}>● LIVE</span> : null)}
      {demoBtn}
    </span>
  );
  if (runners.length === 0) return <Shell title={lang === 'de' ? 'Ninja-Race' : 'Ninja Race'} Icon={I.Ninja} accent="#FF5E3A" right={demoBtn}><Empty msg={lang === 'de' ? 'Noch keine Läufer' : 'No runners yet'} /></Shell>;
  return (
    <Shell title={lang === 'de' ? 'Ninja-Race' : 'Ninja Race'} Icon={I.Ninja} accent="#FF5E3A" right={rightSlot}>
      <style>{`@keyframes nrun{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-22%) rotate(4deg)}}@keyframes nidle{0%,100%{transform:translateY(0)}50%{transform:translateY(-7%)}}`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {runners.map((r, idx) => {
          const ath = athletesMap?.[r.athleteId];
          const onPlat = platPos.some(p => Math.abs(p - r.progress) < 0.025);
          const lead = idx === 0;
          const dispLeft = Math.max(3, Math.min(96, r.progress * 100));
          return (
            <div key={r.athleteId} style={{ display: 'flex', alignItems: 'center', gap: 9, background: lead ? 'rgba(255,214,10,.08)' : 'transparent', borderRadius: 10, padding: '2px 6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, width: 148, flexShrink: 0, minWidth: 0 }}>
                <span style={{ ...mono, fontSize: 14, fontWeight: 800, color: idx < 3 ? MEDAL[idx] : 'rgba(255,255,255,.5)', width: 16, textAlign: 'center' }}>{idx + 1}</span>
                <NameFlag ath={ath} lang={lang} size={12.5} />
              </div>
              <div style={{ flex: 1, position: 'relative', height: 44, borderBottom: '2px solid rgba(255,255,255,.1)', minWidth: 60 }}>
                {platPos.map((p, k) => <div key={k} title="Plattform" style={{ position: 'absolute', left: `${p * 100}%`, bottom: 0, width: 13, height: 6, marginLeft: -6.5, borderRadius: 2, background: 'rgba(10,132,255,.55)' }} />)}
                <div style={{ position: 'absolute', right: -2, bottom: 1, fontSize: 13, opacity: .8 }}>🏁</div>
                <div style={{ position: 'absolute', bottom: 1, left: `${dispLeft}%`, width: 38, height: 42, marginLeft: -19, transition: demoT != null ? 'left .13s linear' : 'left .8s cubic-bezier(.4,0,.2,1)' }}>
                  <NinjaSprite idx={idx} active={r.active} onPlat={onPlat} moving={r.active} />
                </div>
              </div>
              <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: r.finished ? 'var(--green)' : r.active ? '#FF5E3A' : 'rgba(255,255,255,.5)', width: 54, textAlign: 'right', flexShrink: 0 }}>
                {r.finished ? (r.time !== Infinity ? fmtMs(r.time) : '✓') : (demoT != null ? `${Math.round(r.progress * 100)}%` : (r.active ? 'live' : `${Math.round(r.progress * 100)}%`))}
              </span>
            </div>
          );
        })}
      </div>
    </Shell>
  );
};

// ── Registry ─────────────────────────────────────────────────────────────────
export const STAT_WIDGETS = [
  { type: 'obstaclekiller', de: 'Hindernis-Killer', en: 'Obstacle Killer', ic: I.XCircle },
  { type: 'skilldiff', de: 'Skills nach Level', en: 'Skills by Level', ic: I.Muscle },
  { type: 'rareskills', de: 'Seltene Skills', en: 'Rare Skills', ic: I.Award },
  { type: 'medals', de: 'Nationenwertung', en: 'Nations', ic: I.Trophy },
  { type: 'records', de: 'Bestzeiten', en: 'Records', ic: I.Bolt },
  { type: 'buzzerrate', de: 'Buzzer-Quote', en: 'Buzzer Rate', ic: I.FlagCheck },
  { type: 'agestats', de: 'Jüngste/Älteste', en: 'Youngest/Oldest', ic: I.User },
  { type: 'skillprogress', de: 'Skill-Fortschritt', en: 'Skill Progress', ic: I.TrendUp },
  { type: 'heatmap', de: 'Parcours-Heatmap', en: 'Course Heatmap', ic: I.BarChart },
  { type: 'segments', de: 'Segment-Bestzeiten', en: 'Segment Records', ic: I.Clock },
  { type: 'skillmatrix', de: 'Skill-Matrix', en: 'Skill Matrix', ic: I.Grid },
  { type: 'skillticker', de: 'Skill-Ticker', en: 'Skill Ticker', ic: I.Bolt },
  { type: 'ninjarace', de: 'Ninja-Race', en: 'Ninja Race', ic: I.Ninja },
];

export const renderStatWidget = (type, props) => {
  switch (type) {
    case 'obstaclekiller': return <ObstacleKiller {...props} />;
    case 'skilldiff': return <SkillsByDifficulty {...props} />;
    case 'rareskills': return <RareSkills {...props} />;
    case 'medals': return <MedalTable {...props} />;
    case 'records': return <RecordBoard {...props} />;
    case 'buzzerrate': return <BuzzerRate {...props} />;
    case 'agestats': return <AgeExtremes {...props} />;
    case 'skillprogress': return <SkillProgress {...props} />;
    case 'heatmap': return <ParcoursHeatmap {...props} />;
    case 'segments': return <SegmentSplits {...props} />;
    case 'skillmatrix': return <SkillMatrix {...props} />;
    case 'skillticker': return <SkillTicker {...props} />;
    case 'ninjarace': return <RaceWidget {...props} />;
    default: return null;
  }
};
