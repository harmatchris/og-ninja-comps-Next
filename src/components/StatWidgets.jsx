// StatWidgets.jsx — zusätzliche Statistik-Kacheln für den Display-Builder.
// Jede Kachel bekommt die dataProps {compId,info,completedRuns,athletesMap,pipelineData,skillScores}
// plus cats (Divisions-Filter oder null = alle) und lang.
import React from 'react';
import { IGN_CATS } from '../config.js';
import { fmtMs, toFlag, ageOnDate, skillTotalOf, skillRankingOf, computeRankedPipeline, computeDivisionOverall } from '../utils.js';
import { I } from '../icons.jsx';

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

const Shell = ({ title, Icon, accent = '#FF5E3A', right, children }) => (
  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, gap: 11 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
      <span style={{ width: 28, height: 28, borderRadius: 9, background: accent + '22', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{Icon && <Icon s={16} c={accent} />}</span>
      <div style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,.92)' }}>{title}</div>
      {right != null && <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', fontWeight: 700, ...mono }}>{right}</div>}
    </div>
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</div>
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
    default: return null;
  }
};
