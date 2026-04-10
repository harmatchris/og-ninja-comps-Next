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
export const fmtMs = ms => {
  if (ms == null || ms < 0) return '--:--.---';
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), ms3 = Math.floor(ms % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms3).padStart(3, '0')}`;
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
