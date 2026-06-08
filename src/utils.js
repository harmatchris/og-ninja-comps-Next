import { ref, onValue } from 'firebase/database';
import { db } from './config.js';
import { COUNTRIES } from './countries.js';

// ── UTILS
export const uid = () => Math.random().toString(36).slice(2, 8).toUpperCase();
export const today = () => new Date().toISOString().slice(0, 10);
export const storage = {
  get: (k, d = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

// ── PASSWORT-SCHUTZ (Phase A) ────────────────────────────────────────
// Lazy migration: Comps ohne info.password werden behandelt, als wäre '2021' gesetzt.
// Existierende Hardcoded-2021-Checks (ResultsView, CoordinatorView) bleiben dadurch
// rückwärtskompatibel — alle bisherigen Wettkämpfe öffnen weiterhin mit '2021'.
export const DEFAULT_COMP_PASSWORD = '2021';

/** Liefert das effektive Passwort eines Wettkampfs (info.password ODER '2021'). */
export const getCompPassword = (comp) => {
  if (!comp) return DEFAULT_COMP_PASSWORD;
  const info = comp.info || comp; // unterstützt {info:{...}} und {password:...}
  return (info && typeof info.password === 'string' && info.password.length > 0)
    ? info.password
    : DEFAULT_COMP_PASSWORD;
};

/** Prüft eine Passwort-Eingabe gegen einen Wettkampf. */
export const verifyCompPassword = (comp, input) =>
  (input || '').trim() === getCompPassword(comp);

/** Kleiner deterministischer Hash (FNV-1a, 32-bit) für sessionStorage. */
const simpleHash = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
};

const sessionKey = (compId) => `ogn-unlock-${compId}`;

/** Markiert einen Wettkampf in dieser Browser-Session als entsperrt. */
export const unlockSession = (compId, password) => {
  try { sessionStorage.setItem(sessionKey(compId), simpleHash(password)); } catch {}
};

/** Entfernt den Unlock-Status (z.B. nach Passwort-Change). */
export const lockSession = (compId) => {
  try { sessionStorage.removeItem(sessionKey(compId)); } catch {}
};

/**
 * Prüft, ob ein Comp in dieser Session entsperrt ist UND der gespeicherte
 * Hash zum aktuellen Passwort passt (so wird nach einem Passwort-Change
 * automatisch re-locked auf anderen Tabs / Geräten).
 */
export const isUnlocked = (compId, comp) => {
  if (!compId || !comp) return false;
  try {
    const stored = sessionStorage.getItem(sessionKey(compId));
    if (!stored) return false;
    return stored === simpleHash(getCompPassword(comp));
  } catch { return false; }
};

export const fmtMs = ms => {
  if (ms == null || ms < 0) return '--:--.---';
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), ms3 = Math.floor(ms % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms3).padStart(3, '0')}`;
};

// ── EFFECTIVE STAGE TIME LIMIT (seconds; 0 = no limit) ──
// One source of truth for every limit reader. Limits can live in info.stageLimits[key]
// (written by the coordinator editor) OR pipeline[key].timeLimit (written by the setup wizard),
// with info.timeLimit as the global fallback. The coordinator editor keeps both in sync, but the
// setup wizard writes only pipeline.timeLimit — so a reader looking at just info.stageLimits would
// miss setup-configured limits (showing "no limit"). Use this everywhere instead.
export const effectiveStageLimit = (info, pipelineData, key) => {
  const sl = info?.stageLimits?.[key];
  if (sl != null && sl !== '') return +sl || 0;
  const pl = pipelineData?.[key]?.timeLimit;
  if (pl != null && pl !== '') return +pl || 0;
  return +(info?.timeLimit) || 0;
};

// ── FLAG EMOJI
export const toFlag = code => {
  if (!code || code.length < 2) return '';
  try { return String.fromCodePoint(...[...code.toUpperCase().slice(0, 2)].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)); } catch { return ''; }
};

// ── AUTOCOMPLETE STORE
export const AC_KEYS = { names: 'ogn-ac-names', teams: 'ogn-ac-teams', countries: 'ogn-ac-countries' };
export const acLoad = k => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
export const acSave = (k, val) => { if (!val || !val.trim()) return; const arr = acLoad(k); const trimmed = val.trim(); if (!arr.includes(trimmed)) { arr.unshift(trimmed); localStorage.setItem(k, JSON.stringify(arr.slice(0, 60))); } };
export const acSuggest = (k, q) => { if (!q || q.length < 2) return []; const arr = acLoad(k); const ql = q.toLowerCase(); return arr.filter(v => v.toLowerCase().includes(ql) && v.toLowerCase() !== ql).slice(0, 6); };
export const acProfileLoad = () => { try { return JSON.parse(localStorage.getItem('ogn-ac-profiles') || '{}'); } catch { return {}; } };
export const acProfileSave = (name, data) => { if (!name || !name.trim()) return; const p = acProfileLoad(); const k = name.trim(); p[k] = { ...(p[k] || {}), ...data }; localStorage.setItem('ogn-ac-profiles', JSON.stringify(p)); };

// ── RANKING UTIL
const _rankSort = (a, b) => { const ac = a.doneCP?.length || 0, bc = b.doneCP?.length || 0; if (ac !== bc) return bc - ac; return (a.finalTime || Infinity) - (b.finalTime || Infinity); };
const _bestRun = (cr) => { const byA = {}; cr.filter(r => r.status !== 'dsq').forEach(r => { const ex = byA[r.athleteId]; const rc = r.doneCP?.length || 0, ec = ex?.doneCP?.length || 0; if (!ex || rc > ec || (rc === ec && r.finalTime < (ex.finalTime || Infinity))) byA[r.athleteId] = r; }); return byA; };
const _dsqOnly = (cr, byA) => { const dsqMap = {}; cr.filter(r => r.status === 'dsq' && !byA[r.athleteId]).forEach(r => { dsqMap[r.athleteId] = r; }); return Object.values(dsqMap); };
export const computeRanked = (runList, catId) => {
  const cr = runList.filter(r => r.catId === catId);
  const byA = _bestRun(cr);
  return [...Object.values(byA).sort(_rankSort), ..._dsqOnly(cr, byA)];
};
export const computeRankedStage = (runList, catId, stNum) => {
  const cr = runList.filter(r => r.catId === catId && r.stNum === stNum);
  const byA = _bestRun(cr);
  return [...Object.values(byA).sort(_rankSort), ..._dsqOnly(cr, byA)];
};
export const computeRankedMultiStage = (runList, catId, stageNums) => {
  const snSet = new Set(stageNums.map(String));
  const byAS = {};
  runList.filter(r => r.catId === catId && r.status !== 'dsq' && snSet.has(String(r.stNum))).forEach(r => {
    const key = `${r.athleteId}__${String(r.stNum)}`; const ex = byAS[key];
    const rc = r.doneCP?.length || 0, ec = ex?.doneCP?.length || 0;
    if (!ex || rc > ec || (rc === ec && (r.finalTime || Infinity) < (ex.finalTime || Infinity))) byAS[key] = r;
  });
  const byA = {};
  Object.values(byAS).forEach(r => {
    const aid = r.athleteId; const sn = String(r.stNum);
    if (!byA[aid]) byA[aid] = { athleteId: aid, athleteName: r.athleteName, totalCPs: 0, totalTime: 0, stageBreakdown: {}, status: 'complete' };
    byA[aid].stageBreakdown[sn] = r;
    byA[aid].totalCPs += (r.doneCP?.length || 0);
    byA[aid].totalTime += (r.finalTime || 0);
    if (r.status !== 'complete') byA[aid].status = 'partial';
  });
  const inMain = new Set(Object.keys(byA));
  const dsqMap = {};
  runList.filter(r => r.catId === catId && r.status === 'dsq' && !inMain.has(r.athleteId)).forEach(r => {
    dsqMap[r.athleteId] = { athleteId: r.athleteId, athleteName: r.athleteName, totalCPs: 0, totalTime: 0, stageBreakdown: {}, status: 'dsq' };
  });
  const sorted = Object.values(byA).sort((a, b) => b.totalCPs - a.totalCPs || a.totalTime - b.totalTime);
  return [...sorted, ...Object.values(dsqMap)];
};



export const computeRankedMultiStagePipeline = (runList, catId, stageIds) => {
  const idSet = new Set(stageIds);
  const byAS = {};
  runList.filter(r => r.catId === catId && r.status !== 'dsq' && idSet.has(r.stageId)).forEach(r => {
    const key = r.athleteId + '__' + r.stageId;
    const ex = byAS[key];
    const rc = r.doneCP?.length || 0, ec = ex?.doneCP?.length || 0;
    if (!ex || rc > ec || (rc === ec && (r.finalTime || Infinity) < (ex.finalTime || Infinity))) byAS[key] = r;
  });
  const byA = {};
  Object.values(byAS).forEach(r => {
    const aid = r.athleteId;
    if (!byA[aid]) byA[aid] = { athleteId: aid, athleteName: r.athleteName, totalCPs: 0, totalTime: 0, stageBreakdown: {}, status: 'complete' };
    byA[aid].stageBreakdown[r.stageId] = r;
    byA[aid].totalCPs += (r.doneCP?.length || 0);
    byA[aid].totalTime += (r.finalTime || 0);
    if (r.status !== 'complete') byA[aid].status = 'partial';
  });
  const inMain = new Set(Object.keys(byA));
  const dsqMap = {};
  runList.filter(r => r.catId === catId && r.status === 'dsq' && !inMain.has(r.athleteId)).forEach(r => {
    dsqMap[r.athleteId] = { athleteId: r.athleteId, athleteName: r.athleteName, totalCPs: 0, totalTime: 0, stageBreakdown: {}, status: 'dsq' };
  });
  return [...Object.values(byA).sort((a, b) => b.totalCPs - a.totalCPs || a.totalTime - b.totalTime), ...Object.values(dsqMap)];
};



// ── PLACEMENT-BASED OVERALL RANKING (sum of per-stage placements, tiebreak by total time)
export const computeRankedByPlacement = (runList, catId, stageIds, computeStageFn, tieBreakStageId = null) => {
  // 1. Compute per-stage rankings
  const stageRankings = {};
  stageIds.forEach(sid => {
    const ranked = computeStageFn(runList, catId, sid).filter(r => r.status !== 'dsq');
    stageRankings[sid] = ranked;
  });
  // 2. For each athlete, sum their placements across stages
  const athMap = {};
  stageIds.forEach(sid => {
    (stageRankings[sid] || []).forEach((r, idx) => {
      const aid = r.athleteId;
      if (!athMap[aid]) athMap[aid] = { athleteId: aid, athleteName: r.athleteName, placementSum: 0, totalTime: 0, stagesRun: 0, placements: {}, stageBreakdown: {} };
      athMap[aid].placements[sid] = idx + 1; // 1-based placement
      athMap[aid].placementSum += (idx + 1);
      athMap[aid].totalTime += (r.finalTime || 0);
      athMap[aid].stagesRun += 1;
      athMap[aid].stageBreakdown[sid] = r;
    });
  });
  // 3. Sort: most stages run → lowest placement sum → fastest tiebreak time.
  //    Tiebreak = the time in `tieBreakStageId` (e.g. the LK1 Speed parcours) when ties occur,
  //    falling back to the summed time across all stages when no tiebreak stage is supplied.
  const _tie = (a) => {
    const br = tieBreakStageId && a.stageBreakdown ? a.stageBreakdown[tieBreakStageId] : null;
    return (br && br.finalTime) ? br.finalTime : (a.totalTime || Infinity);
  };
  const sorted = Object.values(athMap).sort((a, b) =>
    b.stagesRun - a.stagesRun ||
    a.placementSum - b.placementSum ||
    _tie(a) - _tie(b)
  );
  // 4. Add DSQ athletes at the end
  const inMain = new Set(sorted.map(a => a.athleteId));
  const dsqList = [];
  runList.filter(r => r.catId === catId && r.status === 'dsq' && !inMain.has(r.athleteId)).forEach(r => {
    if (!inMain.has(r.athleteId)) { dsqList.push({ athleteId: r.athleteId, athleteName: r.athleteName, placementSum: 999, totalTime: 0, stagesRun: 0, placements: {}, stageBreakdown: {}, status: 'dsq' }); inMain.add(r.athleteId); }
  });
  return [...sorted, ...dsqList];
};

// ── PHOTO RESIZE
export const resizePhotoUtil = (file, cb) => {
  const img = new Image(); const url = URL.createObjectURL(file);
  img.onload = () => {
    const s = 120; const canvas = document.createElement('canvas'); canvas.width = s; canvas.height = s;
    const ctx = canvas.getContext('2d'); const min = Math.min(img.width, img.height);
    const sx = (img.width - min) / 2, sy = (img.height - min) / 2;
    ctx.drawImage(img, sx, sy, min, min, 0, 0, s, s); URL.revokeObjectURL(url);
    cb(canvas.toDataURL('image/jpeg', 0.82));
  }; img.src = url;
};
export const resizeLogoUtil = (file, cb) => {
  const img = new Image(); const url = URL.createObjectURL(file);
  img.onload = () => {
    const s = 300; const canvas = document.createElement('canvas'); canvas.width = s; canvas.height = s;
    const ctx = canvas.getContext('2d'); const min = Math.min(img.width, img.height);
    const sx = (img.width - min) / 2, sy = (img.height - min) / 2;
    ctx.drawImage(img, sx, sy, min, min, 0, 0, s, s); URL.revokeObjectURL(url);
    cb(canvas.toDataURL('image/jpeg', 0.88));
  }; img.src = url;
};

// ── PIPELINE STAGE RANKING ──
export const computeRankedPipeline = (runList, catId, stageId) => {
  const cr = runList.filter(r => r.catId === catId && r.stageId === stageId);
  const byA = {};
  cr.filter(r => r.status !== 'dsq').forEach(r => {
    const ex = byA[r.athleteId];
    const rc = r.doneCP?.length || 0, ec = ex?.doneCP?.length || 0;
    if (!ex || rc > ec || (rc === ec && r.finalTime < (ex.finalTime || Infinity))) byA[r.athleteId] = r;
  });
  const dsqMap = {};
  cr.filter(r => r.status === 'dsq' && !byA[r.athleteId]).forEach(r => { dsqMap[r.athleteId] = r; });
  return [...Object.values(byA).sort((a, b) => {
    const ac = a.doneCP?.length || 0, bc = b.doneCP?.length || 0;
    if (ac !== bc) return bc - ac;
    return (a.finalTime || Infinity) - (b.finalTime || Infinity);
  }), ...Object.values(dsqMap)];
};

export const computeQualifiedAthletes = (rankedList, qualiPercent, minPerDivision, athletesMap) => {
  if (!qualiPercent || qualiPercent <= 0) return { qualified: rankedList.map(r => r.athleteId), cutLine: rankedList.length };
  const nonDsq = rankedList.filter(r => r.status !== 'dsq');
  let cutCount = Math.ceil(nonDsq.length * qualiPercent / 100);
  if (minPerDivision > 0 && athletesMap) {
    const byDiv = {};
    nonDsq.forEach((r, i) => {
      const ath = athletesMap[r.athleteId];
      const div = ath?.cat || 'unknown';
      if (!byDiv[div]) byDiv[div] = [];
      byDiv[div].push({ ...r, rank: i });
    });
    Object.values(byDiv).forEach(group => {
      const inCut = group.filter(a => a.rank < cutCount);
      if (inCut.length < minPerDivision) {
        const needed = minPerDivision - inCut.length;
        const extra = group.filter(a => a.rank >= cutCount).slice(0, needed);
        if (extra.length > 0) cutCount = Math.max(cutCount, Math.max(...extra.map(a => a.rank)) + 1);
      }
    });
  }
  return { qualified: nonDsq.slice(0, cutCount).map(r => r.athleteId), cutLine: cutCount };
};

export const computeCombinedRanking = (skillRanking, stageRanking) => {
  const skillRankMap = {};
  skillRanking.forEach((a, i) => { skillRankMap[a.athleteId || a.id] = i + 1; });
  const stageRankMap = {};
  stageRanking.forEach((a, i) => { stageRankMap[a.athleteId] = { rank: i + 1, time: a.finalTime || Infinity, cps: a.doneCP?.length || 0 }; });
  const allIds = new Set([...Object.keys(skillRankMap), ...Object.keys(stageRankMap)]);
  const combined = [...allIds].map(id => {
    const sr = skillRankMap[id] || skillRanking.length + 1;
    const stg = stageRankMap[id] || { rank: stageRanking.length + 1, time: Infinity, cps: 0 };
    return { athleteId: id, skillRank: sr, stageRank: stg.rank, combinedScore: sr + stg.rank, tiebreakTime: stg.time, stageCPs: stg.cps };
  });
  combined.sort((a, b) => a.combinedScore - b.combinedScore || a.tiebreakTime - b.tiebreakTime);
  return combined;
};

// Skill scoring (shared so display + coordinator agree): oldschool a1/a2/a3 × difficulty multiplier.
export const SKILL_DIFF_MULT = { easy: 0.8, medium: 1.0, hard: 1.5 };
export const skillTotalOf = (athScore, skills = [], isOldschool = true) => {
  if (!athScore) return 0;
  let tot = 0;
  (skills || []).forEach(sk => {
    const s = athScore[sk.id]; if (!s) return;
    const m = SKILL_DIFF_MULT[sk.difficulty || 'medium'] || 1;
    if (isOldschool) { if (s.a1 === true) tot += 100 * m; else if (s.a2 === true) tot += 50 * m; else if (s.a3 === true) tot += 20 * m; }
    else { tot += (s.poolScore || 0) * (s.flashed ? 1.2 : 1) * m; }
  });
  return Math.round(tot);
};
export const skillRankingOf = (catId, athletesMap = {}, skillScores = {}, skills = [], isOldschool = true) =>
  Object.keys(athletesMap || {}).filter(aid => athletesMap[aid]?.cat === catId)
    .map(aid => ({ athleteId: aid, athleteName: athletesMap[aid]?.name, skillTotal: skillTotalOf(skillScores?.[aid], skills, isOldschool) }))
    .sort((a, b) => b.skillTotal - a.skillTotal);

// Quali count per division: minimum N qualify (default 3) when at least N exist, else the qualiPercent
// only widens the cut once it would exceed N. Capped at the division size.
export const qualifyCount = (n, percent = 40, minPerDivision = 3) => {
  if (n <= 0) return 0;
  return Math.min(n, Math.max(minPerDivision, Math.ceil(n * percent / 100)));
};

// Age in whole years on a reference date (default the OG Youth Games 6.3 day, 2026-06-13).
export const ageOnDate = (birthISO, refISO) => {
  if (!birthISO) return null;
  const b = String(birthISO).slice(0, 10).split('-').map(Number);
  const r = (refISO ? String(refISO).slice(0, 10) : '2026-06-13').split('-').map(Number);
  if (b.length < 3 || r.length < 3 || !b[0] || !r[0]) return null;
  let age = r[0] - b[0];
  if (r[1] < b[1] || (r[1] === b[1] && r[2] < b[2])) age--;
  return (age >= 0 && age < 120) ? age : null;
};

// Official per-division OVERALL ranking (per the Ausschreibung / OG Youth Games format):
//   • Bambini  → only the LAST stage counts; earlier stages don't influence the final rank.
//   • LK1      → Speed-placement + Final-placement (sum); tiebreak = faster Speed-parcours time.
//   • LK2      → Skill-placement + Final-placement (sum); tiebreak = better Final result.
// Each returned item carries `_overall = { cells:[{label,place}], score, tie }` for a simple, uniform
// display. `skillRanking` is the division's skill standing (best first); only used for LK2.
// `computeStageFn(runList, catId, stageId)` ranks a single pipeline stage (computeRankedPipeline).
export const computeDivisionOverall = (catId, { runList, pipelineStages = [], skillRanking = [], computeStageFn }) => {
  const div = (pipelineStages || []).filter(s => s && Array.isArray(s.categories) && s.categories.includes(catId)).sort((a, b) => (a.order || 0) - (b.order || 0));
  const isLk1 = /1$/.test(catId || ''), isLk2 = /2$/.test(catId || '');
  // LK1 — the FINAL is decisive, no matter what came before (Speed/Skills only qualify + seed).
  // A tie on the final standing is broken by the faster Speed-parcours time.
  if (isLk1 && div.length >= 2) {
    const speed = div.find(s => /speed/i.test(s.name || '')) || div[0];
    const final = div.find(s => Array.isArray(s.predecessorStages) && s.predecessorStages.length) || div[div.length - 1];
    const speedRanking = computeStageFn(runList, catId, speed.id);
    const speedT = {}; speedRanking.forEach(r => { speedT[r.athleteId] = r.finalTime || Infinity; });
    const fr = computeStageFn(runList, catId, final.id);
    const finalIds = new Set(fr.map(r => r.athleteId));
    const nonDsq = fr.filter(r => r.status !== 'dsq'), dsq = fr.filter(r => r.status === 'dsq');
    nonDsq.sort((a, b) => {
      const ac = a.doneCP?.length || 0, bc = b.doneCP?.length || 0; if (ac !== bc) return bc - ac;
      const at = a.finalTime || Infinity, bt = b.finalTime || Infinity; if (at !== bt) return at - bt;
      return (speedT[a.athleteId] || Infinity) - (speedT[b.athleteId] || Infinity);
    });
    const finalists = [...nonDsq, ...dsq];
    finalists.forEach(r => { const sp = speedT[r.athleteId]; r._overall = { final: true, tie: (sp && sp !== Infinity) ? fmtMs(sp) : null }; });
    // Non-finalists (didn't make the final) follow below the cut-line, in their Speed-parcours order.
    const nonFinalists = speedRanking.filter(r => !finalIds.has(r.athleteId));
    nonFinalists.forEach(r => { r._overall = { nonFinalist: true }; });
    return { mode: 'lk1', stageIds: [final.id], cutLine: finalists.length, ranked: [...finalists, ...nonFinalists] };
  }
  // LK2 — Skills-placement + Final-placement (sum). Finalists rank first (making the final is an
  // achievement); non-finalists follow, ordered by their skill placement.
  if (isLk2 && div.length >= 1) {
    const final = div.find(s => /final/i.test(s.name || '')) || div[div.length - 1];
    const finalRanking = computeStageFn(runList, catId, final.id);
    const skMap = {}; skillRanking.forEach((a, i) => { skMap[a.athleteId || a.id] = i + 1; });
    const skN = skillRanking.length;
    const finalIds = new Set(finalRanking.map(r => r.athleteId));
    const finalists = finalRanking.map((r, i) => {
      const sr = skMap[r.athleteId] || skN + 1, fr = i + 1;
      return { athleteId: r.athleteId, athleteName: r.athleteName, status: r.status, placementSum: sr + fr, _tieMs: r.finalTime || Infinity,
        _overall: { cells: [{ label: 'Skills', place: sr }, { label: 'Final', place: fr }], score: sr + fr, tie: r.finalTime > 0 ? fmtMs(r.finalTime) : null } };
    }).sort((a, b) => a.placementSum - b.placementSum || a._tieMs - b._tieMs);
    const nonFinalists = skillRanking.filter(a => !finalIds.has(a.athleteId || a.id)).map(a => {
      const sr = skMap[a.athleteId || a.id];
      return { athleteId: a.athleteId || a.id, athleteName: a.athleteName, status: 'skillonly', placementSum: null,
        _overall: { cells: [{ label: 'Skills', place: sr }, { label: 'Final', place: null }], score: null, tie: null, skillOnly: true } };
    });
    return { mode: 'lk2', stageIds: [final.id], ranked: [...finalists, ...nonFinalists] };
  }
  // Bambini / single-stage fallback — only the last stage counts
  const last = div[div.length - 1];
  const ranked = last ? computeStageFn(runList, catId, last.id) : [];
  return { mode: 'lastStage', stageIds: last ? [last.id] : [], ranked };
};
