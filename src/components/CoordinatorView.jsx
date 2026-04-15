import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '../i18n.js';
import { IGN_CATS, MODES, DEF_OBS, STAGE_LETTERS, db, fbSet, fbUpdate, fbRemove } from '../config.js';
import { uid, fmtMs, toFlag, storage, AC_KEYS, acSave, acProfileSave, resizePhotoUtil, resizeLogoUtil, computeRanked, computeRankedStage, computeRankedPipeline, computeQualifiedAthletes } from '../utils.js';
import { useFbVal, SFX } from '../hooks.js';
import { I } from '../icons.jsx';
import { Spinner, EmptyState, TopBar, CompEmoji, DragList, AutocompleteInput, QRCodeComp } from './shared.jsx';
import { SetupWizard } from './SetupWizard.jsx';
import { ResultsView } from './ResultsView.jsx';
import { AthleteQueueView } from './QueueView.jsx';
import { StatsView } from './StatsView.jsx';
import { SkillPhaseView } from './SkillPhaseView.jsx';

// ── LIVE RUN BANNER (shows above ranking when stage is running) ────────
// Firebase may return arrays as objects — normalize doneCP to array
const normCP=cp=>{if(!cp)return[];if(Array.isArray(cp))return cp;return Object.values(cp);};
const cpLen=cp=>normCP(cp).length;

const LiveRunBanner=({compId,info,athletes,pipelineData})=>{
  const activeRuns=useFbVal(`ogn/${compId}/activeRuns`);
  const completedRuns=useFbVal(`ogn/${compId}/completedRuns`);
  const obstacles=useFbVal(`ogn/${compId}/obstacles`);
  const {lang}=useLang();
  const [now,setNow]=useState(Date.now());
  const [flashSplit,setFlashSplit]=useState(null);
  const prevCPRef=useRef({});
  const bestSplits=useRef({});
  const liveEntries=activeRuns?Object.entries(activeRuns).filter(([,r])=>r?.athleteId&&r.phase!=='done'):[];
  const isPipeline=!!(info?.pipelineEnabled&&pipelineData);
  const pipelineStages=isPipeline?Object.entries(pipelineData).map(([id,v])=>({id,...v})):[];
  const obsArr=obstacles?Object.values(obstacles).sort((a,b)=>a.order-b.order).filter(o=>o.isCP!==false):[];
  const totalCPs=obsArr.length;
  const fmtT=ms=>{if(ms<0)ms=0;const t=Math.floor(ms/1000);const m=Math.floor(t/60);const s=t%60;const ms3=String(Math.floor((ms%1000))).padStart(3,'0');return`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${ms3}`;};
  const allRuns=completedRuns?Object.values(completedRuns):[];
  useEffect(()=>{if(!liveEntries.length)return;const iv=setInterval(()=>setNow(Date.now()),200);return()=>clearInterval(iv);},[liveEntries.length]);
  // Best splits per CP for ski-racing comparison
  useEffect(()=>{
    const map={};
    allRuns.forEach(r=>{
      const cp=normCP(r.doneCP);if(!cp.length||r.status==='dsq')return;
      cp.forEach((c,i)=>{if(!c?.time)return;const k=`${r.catId}_${r.stageId||r.stNum||1}_${i}`;if(!map[k]||c.time<map[k].time)map[k]={time:c.time,name:(athletes?.[r.athleteId]?.name||r.athleteName||'?').split(' ')[0]};});
    });
    bestSplits.current=map;
  },[allRuns.length]);
  // Detect new CP → flash split
  const cpSig=liveEntries.map(([k,r])=>`${k}:${cpLen(r.doneCP)}`).join(',');
  useEffect(()=>{
    liveEntries.forEach(([key,r])=>{
      const cpArr=normCP(r.doneCP);const cnt=cpArr.length;
      const prev=prevCPRef.current[key]||0;
      if(cnt>prev&&cnt>0){
        const catId=athletes?.[r.athleteId]?.cat||r.catId;
        const stageKey=isPipeline?key:(r.stNum||1);
        const bestKey=`${catId}_${stageKey}_${cnt-1}`;
        const best=bestSplits.current[bestKey];
        const curTime=cpArr[cnt-1]?.time;
        const diff=(best&&curTime)?(curTime-best.time):null;
        setFlashSplit({key,cpIdx:cnt-1,diff,bestName:best?.name||null,obsName:obsArr[cnt-1]?.name||`CP ${cnt}`,at:Date.now()});
      }
      prevCPRef.current[key]=cnt;
    });
  },[cpSig]);
  // Auto-hide split flash after 4s
  useEffect(()=>{if(!flashSplit)return;const t=setTimeout(()=>setFlashSplit(null),4000);return()=>clearTimeout(t);},[flashSplit?.at]);
  if(!liveEntries.length)return null;
  return(
    <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(liveEntries.length,4)},1fr)`,gap:8,marginBottom:8}}>
      {liveEntries.map(([key,r])=>{
        const a=athletes?.[r.athleteId];
        const isCountdown=r.phase==='countdown';
        const elapsed=r.startEpoch?Math.max(0,now-r.startEpoch):0;
        const stageName=isPipeline?(pipelineStages.find(s=>s.id===key)?.name||key):`Stage ${key}`;
        const limitMs=(info?.stageLimits?.[key]??info?.timeLimit??0)*1000;
        const remaining=(!isCountdown&&limitMs>0)?Math.max(0,limitMs-elapsed):null;
        const timeCritical=remaining!==null&&remaining<15000;
        const catId=a?.cat||r.catId;
        const cat=IGN_CATS.find(c=>c.id===catId);
        const cpsDone=cpLen(r.doneCP);
        const lastCPObs=cpsDone>0&&obsArr[cpsDone-1]?obsArr[cpsDone-1].name:null;
        const hasLives=info?.mode==='lives';
        const activeFlash=flashSplit?.key===key?flashSplit:null;
        const isResetting=!!r.resetting;
        const resetSec=isResetting&&r.resetUntil?Math.max(0,Math.ceil((r.resetUntil-now)/1000)):0;
        const timerColor=isResetting?'#FF9500':isCountdown?'#FF9500':timeCritical?'#FF3B30':remaining!==null?'var(--gold)':'rgba(255,180,120,.9)';
        return(
          <div key={key} className="sh-card" style={{padding:'10px 12px',overflow:'hidden',border:'1px solid rgba(52,199,89,.3)'}}>
            {/* Row 1: Stage + LIVE dot */}
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:'var(--cor)',boxShadow:'0 0 6px rgba(255,94,58,.8)',animation:'pulse 1.2s infinite',flexShrink:0}}/>
              <span style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,.45)',letterSpacing:'.06em',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{stageName}</span>
              {cat&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:4,background:`${cat.color}1A`,color:cat.color,border:`1px solid ${cat.color}44`,fontWeight:700,flexShrink:0}}>{cat.name?.[lang]||cat.id}</span>}
            </div>
            {/* Row 2: Photo + name + lives */}
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              {a?.photo
                ?<img src={a.photo} style={{width:32,height:32,borderRadius:'50%',objectFit:'cover',border:'1.5px solid rgba(255,94,58,.3)',flexShrink:0}}/>
                :<div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,rgba(255,94,58,.2),rgba(255,94,58,.06))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:'var(--cor)',border:'1.5px solid rgba(255,94,58,.15)',flexShrink:0}}>{(a?.name||'?')[0].toUpperCase()}</div>
              }
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:800,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a?.name||r.athleteName||'?'}</div>
                <div style={{fontSize:10,color:'var(--muted)'}}>#{a?.num||'?'}</div>
              </div>
              {hasLives&&r.livesLeft!=null&&<div style={{display:'flex',gap:3,flexShrink:0}}>{Array.from({length:r.livesLeft}).map((_,i)=>(
                <div key={i} style={{width:10,height:10,borderRadius:'50%',background:'var(--cor)',boxShadow:'0 0 4px rgba(255,94,58,.4)'}}/>
              ))}</div>}
            </div>
            {/* Big timer */}
            <div style={{textAlign:'center'}}>
              {isResetting?(
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:'#FF9500',letterSpacing:'.12em',marginBottom:4}}>OBSTACLE RESET</div>
                  <div style={{fontFamily:'JetBrains Mono',fontSize:36,fontWeight:900,lineHeight:1,letterSpacing:'-1.5px',color:resetSec<=3?'#FF3B30':'#FF9500',
                    textShadow:`0 0 16px rgba(255,149,0,.4)`}}>
                    {resetSec>0?resetSec:'GO'}
                  </div>
                  <div style={{fontSize:9,color:'rgba(255,149,0,.6)',marginTop:4}}>{lang==='de'?'Athlet setzt zurück zum Hindernis':'Athlete resetting to obstacle'}</div>
                </div>
              ):(
                <div>
                  <div style={{fontFamily:'JetBrains Mono',fontSize:36,fontWeight:900,lineHeight:1,letterSpacing:'-1.5px',color:timerColor,
                    textShadow:timeCritical?'0 0 20px rgba(255,59,48,.4)':'none'}}>
                    {isCountdown?(r.countdown||'GO'):fmtT(remaining!==null?remaining:elapsed)}
                  </div>
                  <div style={{fontSize:10,color:'var(--muted)',marginTop:4}}>
                    {lastCPObs&&<span>{lastCPObs} · </span>}CP {cpsDone}/{totalCPs||'?'}
                  </div>
                </div>
              )}
            </div>
            {/* Split flash */}
            {activeFlash&&(
              <div style={{textAlign:'center',marginTop:6,padding:'4px 8px',borderRadius:8,
                background:activeFlash.diff===null?'rgba(255,255,255,.06)':activeFlash.diff<=0?'rgba(52,199,89,.1)':'rgba(255,59,48,.1)',
                border:`1px solid ${activeFlash.diff===null?'rgba(255,255,255,.12)':activeFlash.diff<=0?'rgba(52,199,89,.3)':'rgba(255,59,48,.3)'}`,
                animation:'fadeUp .3s ease'}}>
                <div style={{fontFamily:'JetBrains Mono',fontSize:18,fontWeight:900,
                  color:activeFlash.diff!==null?(activeFlash.diff<=0?'var(--green)':'var(--red)'):'var(--gold)'}}>
                  {activeFlash.diff!==null?`${activeFlash.diff<=0?'-':'+'}${fmtMs(Math.abs(activeFlash.diff))}`:(lang==='de'?'Bestzeit!':'Best!')}
                </div>
                <div style={{fontSize:9,color:'var(--muted)'}}>{activeFlash.obsName}{activeFlash.bestName&&activeFlash.diff!==null?` · vs ${activeFlash.bestName}`:''}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── SKILL RANKING LIVE (auto-rotating categories) ────────
const SkillRankingLive=({compId,info,athletes})=>{
  const {lang}=useLang();
  const skillScores=useFbVal(`ogn/${compId}/skillScores`);
  const skillStatus=useFbVal(`ogn/${compId}/skillPhaseStatus`);
  const [activeCatIdx,setActiveCatIdx]=useState(0);
  const [autoRotate,setAutoRotate]=useState(true);
  const skillPhase=info?.skillPhase||{};
  const skills=skillPhase.skills||[];
  const isOldschool=(skillPhase.type||'oldschool')==='oldschool';
  const athList=athletes?Object.values(athletes):[];
  const cats=[...new Set(athList.map(a=>a.cat))];
  const activeCat=cats[activeCatIdx%cats.length]||null;

  // Timer display
  const timerStartedAt=skillStatus?.timerStartedAt||null;
  const timerMin=skillPhase.timerMin||(skillPhase.timerHrs?skillPhase.timerHrs*60:0);
  const timerDurationMs=timerMin*60000;
  const timerRunning=!!timerStartedAt&&timerMin>0;
  const [now,setNow]=useState(Date.now());
  const timerRemaining=timerRunning?Math.max(0,timerDurationMs-(now-timerStartedAt)):0;
  const timerExpired=timerRunning&&timerRemaining<=0;
  const fmtTimer=ms=>{const t=Math.floor(ms/1000);const h=Math.floor(t/3600);const m=Math.floor((t%3600)/60);const s=t%60;return h>0?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;};
  useEffect(()=>{if(!timerRunning||timerExpired)return;const iv=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(iv);},[timerRunning,timerExpired]);

  // Auto-rotate categories every 8 seconds
  useEffect(()=>{
    if(!autoRotate||cats.length<=1)return;
    const iv=setInterval(()=>setActiveCatIdx(i=>i+1),8000);
    return()=>clearInterval(iv);
  },[autoRotate,cats.length]);

  const DIFF_MULT={easy:0.8,medium:1.0,hard:1.5};
  const computeTotal=(athId)=>{
    if(!skillScores)return 0;
    let tot=0;
    skills.forEach(sk=>{
      const s=skillScores?.[athId]?.[sk.id];
      if(!s)return;
      const mult=DIFF_MULT[sk.difficulty||'medium']||1;
      if(isOldschool){
        if(s.a1===true)tot+=100*mult;else if(s.a2===true)tot+=50*mult;else if(s.a3===true)tot+=20*mult;
      } else {
        tot+=(s.poolScore||0)*(s.flashed?1.2:1)*mult;
      }
    });
    return Math.round(tot);
  };

  const ranking=activeCat?athList.filter(a=>a.cat===activeCat).map(a=>({...a,skillTotal:computeTotal(a.id)})).sort((a,b)=>b.skillTotal-a.skillTotal):[];
  const cat=IGN_CATS.find(c=>c.id===activeCat);
  const podColors=['var(--gold)','#C0C0C0','#CD7F32'];

  return(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {/* Timer bar */}
      {timerMin>0&&timerRunning&&(
        <div style={{padding:'10px 16px',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',gap:10,
          background:timerExpired?'rgba(255,59,48,.12)':'rgba(255,214,10,.1)',border:`1px solid ${timerExpired?'rgba(255,59,48,.3)':'rgba(255,214,10,.25)'}`}}>
          <I.Clock s={18} c={timerExpired?'var(--red)':'var(--gold)'}/>
          <span style={{fontSize:26,fontWeight:900,fontFamily:'JetBrains Mono',color:timerExpired?'var(--red)':'var(--gold)',letterSpacing:'-1px'}}>
            {timerExpired?(lang==='de'?'ZEIT ABGELAUFEN':'TIME UP'):fmtTimer(timerRemaining)}
          </span>
          {!timerExpired&&<div style={{fontSize:9,color:'var(--gold)',fontWeight:700,padding:'3px 8px',background:'rgba(255,214,10,.15)',borderRadius:6,border:'1px solid rgba(255,214,10,.3)',animation:'pulse 1.6s infinite'}}>LIVE</div>}
        </div>
      )}

      {/* Category tabs */}
      <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
        {cats.map((catId,i)=>{const c=IGN_CATS.find(x=>x.id===catId);return(
          <button key={catId} className={`chip${activeCat===catId?' active':''}`}
            style={{fontSize:11,padding:'3px 10px',...(activeCat===catId?{background:`${c?.color||'var(--cor)'}1A`,borderColor:`${c?.color||'var(--cor)'}55`,color:c?.color||'var(--cor)'}:{})}}
            onClick={()=>{setActiveCatIdx(i);setAutoRotate(false);}}>{c?.name[lang]||catId}</button>
        );})}
        <button className={`chip${autoRotate?' active':''}`} style={{fontSize:10,padding:'3px 8px',marginLeft:'auto'}} onClick={()=>setAutoRotate(!autoRotate)}>
          <I.RefreshCw s={10}/> Auto
        </button>
      </div>

      {/* Category header */}
      {cat&&<div style={{fontSize:16,fontWeight:900,color:cat.color,display:'flex',alignItems:'center',gap:8}}>
        <div style={{width:8,height:8,borderRadius:'50%',background:cat.color,flexShrink:0}}/>
        {cat.name[lang]||cat.id}
        <span style={{fontSize:12,fontWeight:500,color:'var(--muted)',marginLeft:4}}>{ranking.length} {lang==='de'?'Athleten':'athletes'}</span>
      </div>}

      {/* Ranking list — compact rows */}
      {ranking.length===0&&<EmptyState icon={<I.Trophy s={28} c="rgba(255,255,255,.3)"/>} text={lang==='de'?'Keine Athleten':'No athletes'}/>}
      {ranking.map((a,i)=>{
        const rankColor=podColors[i]||'var(--muted)';
        return(
          <div key={a.id} className="sh-card" style={{padding:'5px 10px',display:'flex',alignItems:'center',gap:7,animation:`fadeUp .2s ${i*.02}s both`}}>
            <div style={{width:20,textAlign:'center',fontWeight:900,fontSize:12,color:rankColor,fontFamily:'JetBrains Mono',flexShrink:0}}>{i+1}</div>
            <div style={{width:26,height:26,borderRadius:'50%',background:`${rankColor}18`,border:`1px solid ${rankColor}44`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              {a.photo?<img src={a.photo} style={{width:24,height:24,borderRadius:'50%',objectFit:'cover'}}/>
              :<I.User s={12} c={rankColor}/>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.name}</div>
              <div style={{display:'flex',gap:2,marginTop:1,flexWrap:'wrap'}}>
                {skills.map(sk=>{
                  const sc=skillScores?.[a.id]?.[sk.id];
                  const diffCol={easy:'#30D158',medium:'#FF9F0A',hard:'#FF3B30'}[sk.difficulty||'medium'];
                  let col='var(--dim)',icon='·';
                  if(isOldschool){
                    if(sc?.a1===true){col='var(--gold)';icon='✓';}
                    else if(sc?.a2===true){col='var(--green)';icon='✓';}
                    else if(sc?.a3===true){col='var(--green)';icon='✓';}
                    else if(sc?.a1===false&&sc?.a2===false&&sc?.a3===false){col='var(--red)';icon='✗';}
                  } else {
                    if(sc?.completed&&sc?.flashed){col='var(--gold)';icon='F';}
                    else if(sc?.completed){col='var(--green)';icon='✓';}
                    else if(sc?.attempts>0){col='var(--red)';icon='✗';}
                  }
                  return<span key={sk.id} style={{fontSize:9,color:col,fontWeight:700}}>{icon}</span>;
                })}
              </div>
            </div>
            <div style={{fontWeight:900,fontSize:16,fontFamily:'JetBrains Mono',color:a.skillTotal>0?rankColor:'var(--dim)',flexShrink:0}}>
              {a.skillTotal>0?a.skillTotal:'—'}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const CoordinatorView=({compId,onBack,onStage,lang,setLang})=>{
  const {t,catName}=useLang();
  const info=useFbVal(`ogn/${compId}/info`);
  const athletes=useFbVal(`ogn/${compId}/athletes`);
  const obstacles=useFbVal(`ogn/${compId}/obstacles`);
  const stages=useFbVal(`ogn/${compId}/stages`);
  const stations=useFbVal(`ogn/${compId}/stations`);
  const pipelineData=useFbVal(`ogn/${compId}/pipeline`);
  const completedRuns=useFbVal(`ogn/${compId}/completedRuns`);
    const skillStatus=useFbVal(`ogn/${compId}/skillPhaseStatus`);
  const activeRuns=useFbVal(`ogn/${compId}/activeRuns`);
  const [editing,setEditing]=useState(false);
  const [showQR,setShowQR]=useState(null);
  const [copied,setCopied]=useState(null);
  const [showRestart,setShowRestart]=useState(false);
  const [coordView,setCoordView]=useState(()=>(info?.skillPhase?.enabled&&(info?.numStations||0)===0)?'skills':'coordinator'); // 'coordinator' | 'results' | 'queue' | 'stats' | 'skills'
  const [showAddAth,setShowAddAth]=useState(false);
  const [quickAth,setQuickAth]=useState({name:'',num:'',cat:'am1',gender:'m',country:'',team:'',photo:null});
  const [addingAth,setAddingAth]=useState(false);
  const [editingStageName,setEditingStageName]=useState(null); // stNum being renamed
  const [stageNameDraft,setStageNameDraft]=useState('');
  const saveStageNameFn=(n)=>{fbSet(`ogn/${compId}/info/stageNames/${n}`,stageNameDraft.trim()||null);setEditingStageName(null);};
  // Stage occupation: activeRuns that are currently live (not done / not stale)
  // Keys are numeric stNum for legacy, or stageId strings for pipeline
  const occupiedStages=new Set(activeRuns?Object.entries(activeRuns).filter(([,r])=>r?.athleteId&&r?.phase!=='done').map(([k])=>isNaN(Number(k))?k:parseInt(k,10)):[]);
  const [editObsStage,setEditObsStage]=useState(null);
  const [localObs,setLocalObs]=useState([]);
  const [newObsName,setNewObsName]=useState('');
  const [editingAth,setEditingAth]=useState(null);
  const [editAthDraft,setEditAthDraft]=useState(null);
  const [editTimeLimitStage,setEditTimeLimitStage]=useState(null);
  const [timeLimitDraft,setTimeLimitDraft]=useState(0);
  const saveTimeLimit=async(n)=>{const val=timeLimitDraft!=null?timeLimitDraft:0;await fbSet(`ogn/${compId}/info/stageLimits/${n}`,val===0?null:val);setEditTimeLimitStage(null);SFX.complete();};
  if(!info)return<Spinner/>;
  const openObsEdit=(n)=>{
    const stObs=stages?.[n]?.obstacles;
    const src=stObs
      ?Object.values(stObs).sort((a,b)=>a.order-b.order)
      :(obstacles?Object.values(obstacles).sort((a,b)=>a.order-b.order):[...DEF_OBS]);
    setLocalObs(src.map(o=>({...o})));
    setEditObsStage(n);setNewObsName('');
  };
  const saveObsEdit=async()=>{
    const om={};localObs.forEach((o,idx)=>{om[o.id]={...o,order:idx};});
    await fbSet(`ogn/${compId}/stages/${editObsStage}/obstacles`,om);
    setEditObsStage(null);SFX.complete();
  };
  const addLocalObs=()=>{
    const name=newObsName.trim();if(!name)return;
    setLocalObs(obs=>[...obs,{id:uid(),name,isCP:true,order:obs.length}]);
    setNewObsName('');
  };
  const moveObs=(idx,dir)=>{
    setLocalObs(obs=>{const a=[...obs];const ti=idx+dir;if(ti<0||ti>=a.length)return obs;[a[idx],a[ti]]=[a[ti],a[idx]];return a;});
  };
  const handleRestart=async()=>{
    if(!window.confirm(lang==='de'?`Alle Läufe von "${info.name}" löschen und Wettkampf neu starten?\n\nDie Athleten-Liste und Hindernisse bleiben erhalten.`:`Delete all runs from "${info.name}" and restart?\n\nAthletes and obstacles are kept.`))return;
    await fbRemove(`ogn/${compId}/completedRuns`);
    await fbRemove(`ogn/${compId}/activeRuns`);
    await fbRemove(`ogn/${compId}/stations`);
    SFX.complete();setShowRestart(false);
  };
  const handleStageReset=async(stN,catId)=>{
    const pin=window.prompt(lang==='de'?`PIN für Stage-${stN}-Reset eingeben:`:`Enter PIN to reset Stage ${stN}:`);
    if(pin===null)return;
    if(pin!=='2021'){window.alert(lang==='de'?'Falscher PIN — Stage nicht zurückgesetzt.':'Wrong PIN — stage not reset.');return;}
    if(!window.confirm(lang==='de'?`Stage ${stN} (${IGN_CATS.find(c=>c.id===catId)?.name.de||catId}) wirklich zurücksetzen?\nAlle Läufe dieser Stage werden gelöscht.`:`Really reset Stage ${stN}?\nAll runs for this stage will be deleted.`))return;
    if(completedRuns){
      const toDelete=Object.entries(completedRuns).filter(([,r])=>r.stNum===stN||(r.catId===catId&&!r.stNum));
      const updates={};toDelete.forEach(([k])=>{updates[`ogn/${compId}/completedRuns/${k}`]=null;});
      if(Object.keys(updates).length)await db.ref().update(updates);
    }
    await fbRemove(`ogn/${compId}/activeRuns/${stN}`);
    SFX.complete();
  };
  const handleQuickAddAth=async()=>{
    if(!quickAth.name.trim())return;
    setAddingAth(true);
    const id=uid();
    const numSugg=quickAth.num||String((athList.length+1));
    const newA={id,name:quickAth.name.trim(),num:numSugg,cat:quickAth.cat,gender:quickAth.gender,country:quickAth.country||'',team:quickAth.team||'',photo:quickAth.photo||null};
    await fbSet(`ogn/${compId}/athletes/${id}`,newA);
    acProfileSave(newA.name,{team:newA.team,country:newA.country,gender:newA.gender,photo:newA.photo});
    acSave(AC_KEYS.names,newA.name);if(newA.team)acSave(AC_KEYS.teams,newA.team);if(newA.country)acSave(AC_KEYS.countries,newA.country);
    // Also write to all stage athlete lists so they show up in JuryApp
    const updates={};
    if(info?.pipelineEnabled&&pipelineData){
      Object.keys(pipelineData).forEach(stageId=>{const _st=pipelineData[stageId];const _cats=_st?.categories==='all'?null:(Array.isArray(_st?.categories)?_st.categories:null);if(!_cats||_cats.includes(newA.cat))updates[`ogn/${compId}/pipeline/${stageId}/athletes/${id}`]=newA;});
    }else{
      const numSt2=info.numStations||1;
      for(let s=1;s<=numSt2;s++){updates[`ogn/${compId}/stages/${s}/athletes/${id}`]=newA;}
    }
    if(Object.keys(updates).length)db.ref().update(updates);
    setQuickAth(a=>({...a,name:'',num:'',country:'',team:'',photo:null}));
    setAddingAth(false);SFX.complete();
  };
  const handleEditAth=(a)=>{setEditingAth(a.id);setEditAthDraft({...a});};
  const handleSaveAth=async()=>{
    if(!editAthDraft||!editAthDraft.name.trim())return;
    const a={...editAthDraft,name:editAthDraft.name.trim()};
    await fbSet(`ogn/${compId}/athletes/${a.id}`,a);
    acProfileSave(a.name,{team:a.team||'',country:a.country||'',gender:a.gender,photo:a.photo||null});
    acSave(AC_KEYS.names,a.name);if(a.team)acSave(AC_KEYS.teams,a.team);if(a.country)acSave(AC_KEYS.countries,a.country);
    const updates={};
    if(info?.pipelineEnabled&&pipelineData){
      Object.keys(pipelineData).forEach(stageId=>{const _st=pipelineData[stageId];const _cats=_st?.categories==='all'?null:(Array.isArray(_st?.categories)?_st.categories:null);if(!_cats||_cats.includes(a.cat))updates[`ogn/${compId}/pipeline/${stageId}/athletes/${a.id}`]=a;});
    }else{
      const numSt2=info.numStations||1;
      for(let s=1;s<=numSt2;s++){updates[`ogn/${compId}/stages/${s}/athletes/${a.id}`]=a;}
    }
    if(Object.keys(updates).length)db.ref().update(updates);
    setEditingAth(null);setEditAthDraft(null);SFX.complete();
  };
  const closeStage=async(n,pipelineStageCfg=null)=>{
    if(isPipeline&&pipelineStageCfg){
      // Pipeline mode: close this stage and qualify athletes to successor stages
      const stageId=pipelineStageCfg.id;
      const qualiPercent=pipelineStageCfg.qualiPercent||0;
      const successors=pipelineStages.filter(s=>(s.predecessorStages||[]).includes(stageId));
      if(!window.confirm(lang==='de'?`Stage "${pipelineStageCfg.name||stageId}" abschließen${successors.length?` und Top-${qualiPercent}% qualifizieren?`:'?'}`:`Close stage "${pipelineStageCfg.name||stageId}"${successors.length?` and qualify top ${qualiPercent}%?`:''}`))return;
      await fbSet(`ogn/${compId}/pipeline/${stageId}/closed`,true);
      if(qualiPercent>0&&successors.length>0){
        const allRuns=completedRuns?Object.values(completedRuns):[];
        const cats=pipelineStageCfg.categories==='all'
          ?[...new Set(allRuns.filter(r=>r.stageId===stageId).map(r=>r.catId))]
          :(pipelineStageCfg.categoriesList||[]);
        const updates={};
        cats.forEach(catId=>{
          const ranked=computeRankedPipeline(allRuns,catId,stageId);
          const {qualified}=computeQualifiedAthletes(ranked,qualiPercent,pipelineStageCfg.minPerDivision||0,athletes||{});
          const qualSet=new Set(qualified);
          successors.forEach(succ=>{
            qualified.forEach(athId=>{
              const a=(athletes||{})[athId]||{name:'?'};
              updates[`ogn/${compId}/pipeline/${succ.id}/athletes/${athId}`]={...a,qualifiedFrom:stageId};
            });
          });
        });
        if(Object.keys(updates).length)db.ref().update(updates);
      }
    } else {
      // Legacy numbered stage mode
      if(!window.confirm(lang==='de'?`Stage ${n} abschließen und Top-${info?.qualPercent||50}% zu Stage ${n+1} importieren?`:`Close Stage ${n} and import top ${info?.qualPercent||50}% to Stage ${n+1}?`))return;
      await fbSet(`ogn/${compId}/stages/${n}/closed`,true);
      if((info?.qualPercent||0)>0){
        const allRuns=completedRuns?Object.values(completedRuns):[];
        const stageRuns=allRuns.filter(r=>r.stageNum===n||r.stNum===n);
        const athTimes={};
        stageRuns.forEach(r=>{if(r.status==='complete'&&r.finalTime&&r.athleteId){if(!athTimes[r.athleteId]||r.finalTime<athTimes[r.athleteId].time)athTimes[r.athleteId]={time:r.finalTime,run:r};}});
        const sorted=Object.values(athTimes).sort((a,b)=>a.time-b.time);
        const count=Math.max(1,Math.ceil(sorted.length*(info.qualPercent/100)));
        const top=sorted.slice(0,count);
        const updates={};
        top.forEach(({run:r})=>{const a=(athletes||{})[r.athleteId]||{name:r.athleteName||'?'};updates[`ogn/${compId}/stages/${n+1}/athletes/${r.athleteId}`]={...a,stageNum:n+1};});
        if(Object.keys(updates).length)db.ref().update(updates);
      }
    }
  };
const handleDeleteAth=async(a)=>{
    if(!window.confirm(lang==='de'?`Athlet "${a.name}" wirklich löschen?\nBereits absolvierte Läufe bleiben erhalten.`:`Delete athlete "${a.name}"?\nCompleted runs are kept.`))return;
    await fbRemove(`ogn/${compId}/athletes/${a.id}`);
    const updates={};
    if(info?.pipelineEnabled&&pipelineData){
      Object.keys(pipelineData).forEach(stageId=>{const _st=pipelineData[stageId];const _cats=_st?.categories==='all'?null:(Array.isArray(_st?.categories)?_st.categories:null);if(!_cats||_cats.includes(a.cat))updates[`ogn/${compId}/pipeline/${stageId}/athletes/${a.id}`]=null;});
    }else{
      const numSt2=info.numStations||1;
      for(let s=1;s<=numSt2;s++){updates[`ogn/${compId}/stages/${s}/athletes/${a.id}`]=null;}
    }
    if(Object.keys(updates).length)db.ref().update(updates);
    if(editingAth===a.id){setEditingAth(null);setEditAthDraft(null);}
    SFX.fall();
  };
  if(editing){
    const initialStages=stages||null;
    const initialObstacles=obstacles?Object.values(obstacles).sort((a,b)=>a.order-b.order):null;
    const initialAthletes=athletes?athletes:null;
    return<SetupWizard existingId={compId} initialInfo={info} initialStages={initialStages} initialObstacles={initialObstacles?{...Object.fromEntries(initialObstacles.map(o=>[o.id,o]))}:null} initialAthletes={initialAthletes} onDone={()=>setEditing(false)} onBack={()=>setEditing(false)}/>;
  }
  const isPipeline=!!(info?.pipelineEnabled&&pipelineData);
  // Pipeline stages as sorted array [{id, name, mode, categories, predecessorStages, qualiPercent, minPerDivision}, ...]
  const pipelineStages=isPipeline
    ?Object.entries(pipelineData).map(([id,v])=>({id,...v})).sort((a,b)=>(a.order||0)-(b.order||0))
    :[];
  const numSt=isPipeline?pipelineStages.length:(info.numStations||0);
  const base=window.location.href.split('?')[0];
  const athList=athletes?Object.values(athletes):[];
  const runList=completedRuns?Object.values(completedRuns):[];
  const assignCat=(n,id)=>{fbSet(`ogn/${compId}/stations/${n}/cat`,id);SFX.click();};
  const copyUrl=(url,k)=>{navigator.clipboard?.writeText(url);setCopied(k);setTimeout(()=>setCopied(null),2200);SFX.click();};
  return(
    <div style={{minHeight:'100vh',paddingBottom:40}}>
      <TopBar title={<div style={{display:'flex',alignItems:'center',gap:8}}>{info.logo&&<img src={info.logo} style={{width:28,height:28,borderRadius:7,objectFit:'cover',flexShrink:0,border:'1px solid rgba(255,255,255,.1)'}}/>}<span>{info.name||'Wettkampf'}</span></div>} sub={`${compId} · ${MODES[info.mode]?.name[lang]||info.mode}`} onBack={onBack}
        right={<div style={{display:'flex',gap:6}}>
          <button className="btn btn-ghost" style={{padding:'7px'}} onClick={()=>setEditing(true)}><I.Settings s={15}/></button>
          <button className="btn btn-ghost" style={{padding:'5px 10px',fontSize:12,fontWeight:700}} onClick={()=>setLang(lang==='de'?'en':'de')}>{t('lang')}</button>
        </div>}/>
      <div className="section">
        {/* Stat badges */}
        <div style={{display:'flex',gap:8}}>
          {[{label:t('athletes'),val:athList.length},{label:'Stages',val:numSt},{label:'Läufe',val:runList.length}].map(s=>(
            <div key={s.label} className="sh-card" style={{flex:1,padding:'11px 12px',textAlign:'center'}}>
              <div style={{fontSize:18,fontWeight:900,color:'var(--cor)'}}>{s.val}</div>
              <div style={{fontSize:10,color:'var(--muted)',marginTop:2,letterSpacing:'.04em'}}>{s.label}</div>
            </div>
          ))}
        </div>


        {/* ── Segmented pill toggle: Jury / Ranking / Next up / Stats ── */}
        <div style={{display:'flex',background:'rgba(255,255,255,.07)',borderRadius:26,padding:3,gap:2,marginTop:8}}>
          {[
            ...(numSt>0?[{k:'coordinator', ic:<I.Bolt s={13}/>, lb:'Jury'}]:[]),
            {k:'results',     ic:<I.Trophy s={13}/>, lb:'Ranking'},
            ...(numSt>0?[{k:'queue', ic:<I.User s={13}/>, lb:'Next up'}]:[]),
            ...(numSt>0?[{k:'stats', ic:<I.TrendUp s={13}/>, lb:'Stats'}]:[]),
            ...(info?.skillPhase?.enabled?[{k:'skills',ic:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="4" r="2"/><path d="M10.5 9l-2.5 5h4l2 4"/><path d="M8.5 21l2-4M14.5 13l2 4-3.5 1.5"/></svg>,lb:'Skills'}]:[]),
          ].map(({k,ic,lb})=>(
            <button key={k} style={{flex:1,padding:'8px 4px',borderRadius:22,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,fontSize:11,fontWeight:700,letterSpacing:'.03em',minWidth:0,
              background:coordView===k?'var(--coral)':'transparent',
              color:coordView===k?'#fff':'rgba(255,255,255,.4)',
              transition:'background .18s, color .18s',
              boxShadow:coordView===k?'0 2px 10px rgba(255,94,58,.35)':'none'}}
              onClick={()=>{setCoordView(k);SFX.hover();}}>
              {ic}<span className="tab-label">{lb}</span>
            </button>
          ))}
        </div>
        {coordView==='results'&&(()=>{
          const skillsActive=info?.skillPhase?.enabled&&!skillStatus?.finalized&&!skillStatus?.seedingDone;
          const skillsDone=info?.skillPhase?.enabled&&(skillStatus?.finalized||skillStatus?.seedingDone);
          return<div style={{marginTop:8}}>
            <LiveRunBanner compId={compId} info={info} athletes={athletes} pipelineData={pipelineData}/>
            {skillsActive&&<SkillRankingLive compId={compId} info={info} athletes={athletes}/>}
            {!skillsActive&&<ResultsView compId={compId} athletes={athletes}/>}
            {skillsDone&&<div style={{marginTop:12,padding:'10px 0',borderTop:'1px solid rgba(255,255,255,.06)'}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--muted)',letterSpacing:'.08em',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="4" r="2"/><path d="M10.5 9l-2.5 5h4l2 4"/><path d="M8.5 21l2-4M14.5 13l2 4-3.5 1.5"/></svg>
                SKILL RANKING
              </div>
              <SkillRankingLive compId={compId} info={info} athletes={athletes}/>
            </div>}
          </div>;
        })()}
        {coordView==='queue'&&<div style={{marginTop:8}}><AthleteQueueView compId={compId} info={info} completedRuns={completedRuns} athletesMap={athletes} pipelineData={pipelineData}/></div>}
        {coordView==='stats'&&<div style={{marginTop:8}}><StatsView compId={compId} info={info} completedRuns={completedRuns} athletesMap={athletes} pipelineData={pipelineData}/></div>}
        {coordView==='skills'&&info?.skillPhase?.enabled&&<div style={{marginTop:8}}><SkillPhaseView compId={compId} info={info} athletes={athletes}/></div>}
        {coordView==='coordinator'&&<>
        <div className="sep"/>
        {numSt===0?(
          <div style={{padding:'20px 0',textAlign:'center',color:'var(--muted)',fontSize:13}}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:8,display:'block',margin:'0 auto 8px'}}><circle cx="13" cy="4" r="2"/><path d="M10.5 9l-2.5 5h4l2 4"/><path d="M8.5 21l2-4M14.5 13l2 4-3.5 1.5"/></svg>
            {lang==='de'?'Reiner Skill-Wettkampf — Stages-Tab öffnen um Skill-Rangliste zu verwalten':'Pure skill competition — open Skills tab to manage skill ranking'}
          </div>
        ):(
        <>
        <div className="lbl">Stages — direkt starten</div>
        {isPipeline
          /* ── PIPELINE MODE: render pipeline stage cards ── */
          ?pipelineStages.map((pStage,idx)=>{
            const stageKey=pStage.id;
            const stageClosed=pipelineData?.[stageKey]?.closed||false;
            const stageLetter=STAGE_LETTERS[idx]||String(idx+1);
            const isOccupied=occupiedStages.has(stageKey);
            const stageName=pStage.name||`Stage ${stageLetter}`;
            const pipelineAthletes=pipelineData?.[stageKey]?.athletes||{};
            const hasPipeAths=Object.keys(pipelineAthletes).length>0;
            const athsInStage=hasPipeAths?Object.values(pipelineAthletes):(()=>{const _cIds=pStage.categories==='all'?IGN_CATS.map(c=>c.id):(Array.isArray(pStage.categories)?pStage.categories:[]);const _cs=new Set(_cIds);return Object.values(athletes||{}).filter(a=>_cs.has(a.cat));})();
            const allRuns=completedRuns?Object.values(completedRuns):[];
            const stageRuns=allRuns.filter(r=>r.stageId===stageKey);
            const doneAthIds=new Set(stageRuns.map(r=>r.athleteId));
            const url=`${base}?stageId=${stageKey}&comp=${compId}`;
            const successors=pipelineStages.filter(s=>(s.predecessorStages||[]).includes(stageKey));
            const predecessors=(pStage.predecessorStages||[]).map(pid=>pipelineStages.find(s=>s.id===pid)).filter(Boolean);
            const predsClosed=predecessors.length===0||predecessors.every(p=>pipelineData?.[p.id]?.closed);
            const catIds=pStage.categories==='all'
              ?[...new Set(athsInStage.map(a=>a.cat).filter(Boolean))]
              :(Array.isArray(pStage.categories)?pStage.categories:[]);
            return(
              <div key={stageKey} className="sh-card fade-up" style={{padding:16,display:'flex',flexDirection:'column',gap:10,opacity:stageClosed?.6:1}}>
                {/* Stage header */}
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:44,height:44,borderRadius:12,background:isOccupied?'linear-gradient(135deg,#ff9500,#ff6000)':stageClosed?'rgba(255,255,255,.08)':'linear-gradient(135deg,var(--cor),var(--cor2))',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:22,color:stageClosed?'var(--muted)':'#fff',boxShadow:stageClosed?'none':'0 4px 14px rgba(255,94,58,.26)',flexShrink:0,position:'relative'}}>
                    {stageLetter}
                    {isOccupied&&<div style={{position:'absolute',top:-4,right:-4,width:12,height:12,borderRadius:'50%',background:'var(--green)',border:'2px solid var(--card)',boxShadow:'0 0 6px rgba(52,199,89,.8)'}}/>}
                    {stageClosed&&<div style={{position:'absolute',top:-4,right:-4,width:12,height:12,borderRadius:'50%',background:'var(--muted)',border:'2px solid var(--card)'}}/>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <div style={{fontWeight:700,fontSize:15,color:stageClosed?'var(--muted)':'var(--fg)'}}>{stageName}</div>
                      {isOccupied&&<span style={{fontSize:9,fontWeight:800,color:'var(--green)',background:'rgba(52,199,89,.15)',border:'1px solid rgba(52,199,89,.3)',borderRadius:6,padding:'1px 6px',letterSpacing:'.05em'}}>LIVE</span>}
                      {stageClosed&&<span style={{fontSize:9,fontWeight:800,color:'var(--muted)',background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.12)',borderRadius:6,padding:'1px 6px',letterSpacing:'.05em'}}>{lang==='de'?'ABG.':'CLOSED'}</span>}
                    </div>
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>
                      {doneAthIds.size}/{athsInStage.length} {lang==='de'?'Läufe':'runs'}
                      {pStage.qualiPercent>0&&<span style={{marginLeft:6,color:'var(--cor2)'}}>· Top {pStage.qualiPercent}% quali</span>}
                      {predecessors.length>0&&<span style={{marginLeft:6}}>· von {predecessors.map(p=>p.name||p.id).join(', ')}</span>}
                    </div>
                    {/* Category pills */}
                    {catIds.length>0&&<div style={{display:'flex',gap:3,flexWrap:'wrap',marginTop:4}}>
                      {catIds.map(cid=>{const c=IGN_CATS.find(x=>x.id===cid);return c?<span key={cid} style={{fontSize:9,padding:'1px 6px',borderRadius:6,background:`${c.color}1A`,color:c.color,border:`1px solid ${c.color}44`,fontWeight:600}}>{c.name[lang]}</span>:null;})}
                    </div>}
                  </div>
                  <button className="btn btn-ghost" style={{padding:'7px'}} onClick={()=>setShowQR(showQR===stageKey?null:stageKey)}><I.QR s={15}/></button>
                </div>
                {/* QR panel */}
                {showQR===stageKey&&(
                  <div className="scale-in" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,background:'rgba(255,255,255,.03)',borderRadius:12,padding:16}}>
                    <QRCodeComp url={url} size={140}/>
                    <div style={{fontSize:10,color:'var(--muted)',textAlign:'center',wordBreak:'break-all',maxWidth:260}}>{url}</div>
                    <button className="btn btn-ghost" style={{fontSize:12,padding:'6px 14px',gap:6}} onClick={()=>copyUrl(url,stageKey)}>
                      {copied===stageKey?<><I.Check s={13} c="var(--green)"/> {t('copied')}</>:<><I.Download s={13}/> {t('copyUrl')}</>}
                    </button>
                  </div>
                )}
                {/* BIG START BUTTON */}
                {isOccupied
                  ?<button className="btn btn-ghost" style={{width:'100%',padding:14,fontSize:14,gap:8,marginTop:2,cursor:'default',opacity:.6,borderColor:'rgba(52,199,89,.3)',color:'var(--green)'}} disabled>
                      <div style={{width:8,height:8,borderRadius:'50%',background:'var(--green)',boxShadow:'0 0 6px rgba(52,199,89,.8)',animation:'pulse 1.2s infinite'}}/>
                      {lang==='de'?'Stage läuft — besetzt':'Stage occupied — running'}
                    </button>
                  :stageClosed
                    ?<div style={{width:'100%',padding:12,fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',gap:7,opacity:.5,background:'var(--card2)',borderRadius:10,color:'var(--muted)'}}>✔ {lang==='de'?'Abgeschlossen':'Closed'}</div>
                    :!predsClosed
                      ?<div style={{width:'100%',padding:14,fontSize:14,marginTop:2,display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:0.55,background:'var(--card2)',borderRadius:10,color:'var(--muted)'}}>{lang==='de'?'Vorgänger-Stage(s) erst abschließen':'Complete predecessor stage(s) first'}</div>
                      :info?.skillPhase?.enabled&&!skillStatus?.seedingDone&&!skillStatus?.finalized&&(()=>{
                        // Only block stages whose categories overlap with skill phase categories
                        const sc=info?.skillPhase?.skillCategories;
                        const stageCats=pStage.categories==='all'?IGN_CATS.map(c=>c.id):(Array.isArray(pStage.categories)?pStage.categories:[]);
                        if(!sc||sc==='all')return stageCats.length>0; // block all if skills apply to all
                        return stageCats.some(c=>sc.includes(c)); // block only if overlap
                      })()
                        ?<div style={{width:'100%',padding:14,fontSize:14,marginTop:2,display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:0.55,background:'var(--card2)',borderRadius:10,color:'rgba(52,199,89,.7)'}}>{lang==='de'?'Skill Phase muss erst abgeschlossen werden':'Complete Skill Phase first'}</div>
                        :<button className="btn btn-coral" style={{width:'100%',padding:14,fontSize:15,gap:8,marginTop:2}} onClick={()=>{SFX.click();onStage(0,stageKey);}}><I.Play s={16}/> {stageName} starten</button>
                }
                {/* Close stage button (shows when not occupied, not closed, has successors or qualiPercent) */}
                {!stageClosed&&!isOccupied&&(successors.length>0||pStage.qualiPercent>0)&&predsClosed&&(
                  <button className="btn" style={{width:'100%',padding:10,fontSize:13,gap:6,marginTop:0,background:'var(--card2)',color:'var(--muted)',border:'1px solid var(--border)',borderRadius:10}} onClick={()=>closeStage(0,pStage)}>
                    ✔ {lang==='de'?`Stage "${stageName}" abschließen`:`Close stage "${stageName}"`}
                  </button>
                )}
              </div>
            );
          })
          /* ── LEGACY MODE: numbered stages ── */
          :Array.from({length:numSt},(_,i)=>i+1).map(n=>{
          const st=stations?.[n]||{};const cat=IGN_CATS.find(c=>c.id===st.cat);
          const doneIds=new Set(runList.filter(r=>r.catId===st.cat).map(r=>r.athleteId));
          const total=athList.filter(a=>a.cat===st.cat).length;
          const done=doneIds.size;
          const url=`${base}?station=${n}&comp=${compId}`;
          return(
            <div key={n} className="sh-card fade-up" style={{padding:16,display:'flex',flexDirection:'column',gap:10}}>
              {/* Stage header */}
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:44,height:44,borderRadius:12,background:occupiedStages.has(n)?'linear-gradient(135deg,#ff9500,#ff6000)':'linear-gradient(135deg,var(--cor),var(--cor2))',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:20,color:'#fff',boxShadow:'0 4px 14px rgba(255,94,58,.26)',flexShrink:0,position:'relative'}}>
                  {n}
                  {occupiedStages.has(n)&&<div style={{position:'absolute',top:-4,right:-4,width:12,height:12,borderRadius:'50%',background:'var(--green)',border:'2px solid var(--card)',boxShadow:'0 0 6px rgba(52,199,89,.8)'}}/>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  {editingStageName===n
                    ?<div style={{display:'flex',gap:6,alignItems:'center'}}>
                       <input value={stageNameDraft} onChange={e=>setStageNameDraft(e.target.value)} placeholder={`Stage ${n}`} autoFocus style={{flex:1,fontSize:13,padding:'4px 8px'}} onKeyDown={e=>{if(e.key==='Enter')saveStageNameFn(n);if(e.key==='Escape')setEditingStageName(null);}}/>
                       <button className="btn btn-coral" style={{padding:'4px 10px',fontSize:11}} onClick={()=>saveStageNameFn(n)}><I.Check s={12}/></button>
                       <button className="btn btn-ghost" style={{padding:'4px 8px',fontSize:11}} onClick={()=>setEditingStageName(null)}><I.X s={12}/></button>
                     </div>
                    :<div style={{display:'flex',alignItems:'center',gap:5}}>
                       <div style={{fontWeight:700,fontSize:15}}>{info.stageNames?.[n]||`Stage ${n}`}</div>
                       <button style={{background:'none',border:'none',cursor:'pointer',padding:2,opacity:.35,display:'flex'}} title="Umbenennen" onClick={()=>{setStageNameDraft(info.stageNames?.[n]||'');setEditingStageName(n);}}><I.Edit s={12}/></button>
                       {occupiedStages.has(n)&&<span style={{fontSize:9,fontWeight:800,color:'var(--green)',background:'rgba(52,199,89,.15)',border:'1px solid rgba(52,199,89,.3)',borderRadius:6,padding:'1px 6px',letterSpacing:'.05em'}}>LIVE</span>}
                     </div>
                  }
                  {cat
                    ?<div style={{fontSize:12,marginTop:2,display:'flex',alignItems:'center',gap:6}}>
                       <span style={{color:cat.color,fontWeight:600}}>{catName(cat)}</span>
                       <span style={{color:'var(--muted)'}}>{done}/{total} Läufe</span>
                     </div>
                    :<div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>Kategorie wählen → Stage starten</div>}
                </div>
                <button className="btn btn-ghost" style={{padding:'7px',color:editObsStage===n?'var(--cor)':'currentColor',borderColor:editObsStage===n?'rgba(255,94,58,.4)':'var(--border)'}} title={lang==='de'?`Stage ${n} Hindernisse bearbeiten`:`Edit Stage ${n} obstacles`} onClick={()=>editObsStage===n?setEditObsStage(null):openObsEdit(n)}><I.Edit s={14} c={editObsStage===n?'var(--cor)':'currentColor'}/></button>
                <button className="btn btn-ghost" style={{padding:'7px'}} onClick={()=>setShowQR(showQR===n?null:n)}><I.QR s={15}/></button>
                {st.cat&&<button className="btn btn-ghost" style={{padding:'7px',color:'rgba(255,120,60,.7)',borderColor:'rgba(255,100,40,.2)'}} title={lang==='de'?`Stage ${n} zurücksetzen (PIN)`:`Reset Stage ${n} (PIN)`} onClick={()=>handleStageReset(n,st.cat)}><I.RefreshCw s={14} c="rgba(255,120,60,.7)"/></button>}
              </div>
              {/* QR panel */}
              {showQR===n&&(
                <div className="scale-in" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,background:'rgba(255,255,255,.03)',borderRadius:12,padding:16}}>
                  <QRCodeComp url={url} size={140}/>
                  <div style={{fontSize:10,color:'var(--muted)',textAlign:'center',wordBreak:'break-all',maxWidth:260}}>{url}</div>
                  <button className="btn btn-ghost" style={{fontSize:12,padding:'6px 14px',gap:6}} onClick={()=>copyUrl(url,n)}>
                    {copied===n?<><I.Check s={13} c="var(--green)"/> {t('copied')}</>:<><I.Download s={13}/> {t('copyUrl')}</>}
                  </button>
                </div>
              )}
              {/* Category chips — only cats with registered athletes */}
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {IGN_CATS.filter(c=>athList.some(a=>a.cat===c.id)).map(c=>(
                  <button key={c.id} className={`chip${st.cat===c.id?' active':''}`}
                    style={{fontSize:10,padding:'3px 9px',...(st.cat===c.id?{background:`${c.color}1A`,borderColor:`${c.color}55`,color:c.color}:{})}}
                    onClick={()=>assignCat(n,c.id)}>{c.name[lang]}</button>
                ))}
                {athList.length===0&&<div style={{fontSize:11,color:'var(--muted)',padding:'4px 2px'}}>{lang==='de'?'Keine Athleten registriert':'No athletes registered'}</div>}
              </div>
              {/* Time limit display + inline editor (only for non-occupied stages) */}
              {!occupiedStages.has(n)&&(editTimeLimitStage===n
                ?<div className="scale-in" style={{background:'rgba(255,255,255,.03)',border:'1px solid var(--border)',borderRadius:12,padding:12,display:'flex',flexDirection:'column',gap:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div className="lbl" style={{display:'flex',alignItems:'center',gap:5}}><I.Clock s={13}/> {lang==='de'?'Zeitlimit für Stage':'Time limit for Stage'} {n}</div>
                      <button className="btn btn-ghost" style={{padding:'3px 7px',fontSize:11}} onClick={()=>setEditTimeLimitStage(null)}>{lang==='de'?'Abbrechen':'Cancel'}</button>
                    </div>
                    <TimePicker value={timeLimitDraft} onChange={v=>setTimeLimitDraft(v||0)} allowDefault/>
                    <div style={{fontSize:10,color:'var(--muted)'}}>{lang==='de'?'Standard (aus Setup)':'Default (from setup)'}: {(()=>{const d=info.timeLimit||0;return d===0?(lang==='de'?'Kein Limit':'No limit'):`${Math.floor(d/60)}:${String(d%60).padStart(2,'0')}`;})()}</div>
                    <button className="btn btn-coral" style={{width:'100%',padding:'10px',fontSize:13,gap:6}} onClick={()=>saveTimeLimit(n)}><I.Check s={13}/>{lang==='de'?'Speichern':'Save'}</button>
                  </div>
                :<button className="btn btn-ghost" style={{width:'100%',padding:'8px 14px',fontSize:12,gap:7,justifyContent:'space-between',marginTop:2}}
                    onClick={()=>{const cur=info.stageLimits?.[n]!=null?info.stageLimits[n]:(info.timeLimit||0);setTimeLimitDraft(cur);setEditTimeLimitStage(n);}}>
                    <span style={{display:'flex',alignItems:'center',gap:6}}><I.Clock s={12}/> {lang==='de'?'Zeitlimit':'Time limit'}: <span style={{fontFamily:'JetBrains Mono',color:'var(--gold)'}}>{(()=>{const v=info.stageLimits?.[n]!=null?info.stageLimits[n]:(info.timeLimit||0);return v===0?(lang==='de'?'Kein Limit':'No limit'):`${Math.floor(v/60)}:${String(v%60).padStart(2,'0')}`;})()}</span></span>
                    <I.Edit s={11} c="var(--muted)"/>
                  </button>
              )}
              {/* BIG START BUTTON with validation */}
              {(()=>{
                const stObs=stages?.[n]?.obstacles;
                const hasObs=stObs?Object.keys(stObs).length>0:(obstacles?Object.keys(obstacles).length>0:false);
                const catAths=st.cat?athList.filter(a=>a.cat===st.cat).length:0;
                const canStart=!!st.cat&&catAths>0&&hasObs;
                const reason=!st.cat?(lang==='de'?'Erst Kategorie wählen':'Select a category first'):catAths===0?(lang==='de'?'Keine Athleten in dieser Kategorie':'No athletes in this category'):!hasObs?(lang==='de'?'Keine Hindernisse konfiguriert':'No obstacles configured'):'';
                return occupiedStages.has(n)
                  ?<button className="btn btn-ghost" style={{width:'100%',padding:14,fontSize:14,gap:8,marginTop:2,cursor:'default',opacity:.6,borderColor:'rgba(52,199,89,.3)',color:'var(--green)'}} disabled>
                      <div style={{width:8,height:8,borderRadius:'50%',background:'var(--green)',boxShadow:'0 0 6px rgba(52,199,89,.8)',animation:'pulse 1.2s infinite'}}/>
                      {lang==='de'?'Stage läuft — besetzt':'Stage occupied — running'}
                    </button>
                  :info?.stageLinked&&n>1&&!stages?.[n-1]?.closed
                    ?<div style={{width:'100%',padding:14,fontSize:14,marginTop:2,display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:0.55,background:'var(--card2)',borderRadius:10,color:'var(--muted)'}}>{lang==='de'?`Stage ${n-1} zuerst abschließen`:`Complete Stage ${n-1} first`}</div>
                  :!canStart
                    ?<div style={{display:'flex',flexDirection:'column',gap:4,marginTop:2}}>
                        <button className="btn btn-ghost" style={{width:'100%',padding:14,fontSize:15,gap:8,opacity:.4,cursor:'not-allowed'}} disabled>
                          <I.Play s={16}/> {info.stageNames?.[n]||`Stage ${n}`} starten
                        </button>
                        <div style={{fontSize:11,color:'var(--dim)',textAlign:'center',padding:'0 4px'}}>{reason}</div>
                      </div>
                    :<button className="btn btn-coral" style={{width:'100%',padding:14,fontSize:15,gap:8,marginTop:2}} onClick={()=>{SFX.click();onStage(n);}}><I.Play s={16}/> {info.stageNames?.[n]||`Stage ${n}`} starten</button>;
              })()}
              {info?.stageLinked&&!stages?.[n]?.closed&&!occupiedStages.has(n)&&n<numSt&&(<button className="btn" style={{width:'100%',padding:10,fontSize:13,gap:6,marginTop:4,background:'var(--card2)',color:'var(--muted)',border:'1px solid var(--border)',borderRadius:10}} onClick={()=>closeStage(n)}>✔ {lang==='de'?`Stage ${n} abschließen`:`Close Stage ${n}`}</button>)}
              {/* ── Inline obstacle editor ── */}
              {editObsStage===n&&(
                <div className="scale-in" style={{background:'rgba(255,255,255,.03)',border:'1px solid var(--border)',borderRadius:12,padding:12,display:'flex',flexDirection:'column',gap:7}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:2}}>
                    <div className="lbl">{lang==='de'?'Hindernisse bearbeiten':'Edit obstacles'}</div>
                    <div style={{fontSize:11,color:'var(--muted)'}}>{localObs.length} · {localObs.filter(o=>o.isCP).length} CPs</div>
                  </div>
                  <div style={{maxHeight:280,overflowY:'auto'}}>
                    <DragList items={localObs} onReorder={arr=>setLocalObs(arr)} keyFn={o=>o.id}
                      onExternalDrop={(data,pos)=>{const name=data.trim();if(!name)return;setLocalObs(obs=>{const a=[...obs];a.splice(pos,0,{id:uid(),name,isCP:true,order:pos});return a.map((x,i)=>({...x,order:i}));});setNewObsName('');SFX.click();}}
                      renderItem={(o,idx)=>o.type==='section'?(<div data-drag-item style={{display:'flex',alignItems:'center',gap:6,padding:'5px 4px',borderRadius:8,background:'rgba(255,153,0,0.08)',borderLeft:'3px solid var(--accent)',marginBottom:2}}><div className="drag-handle" style={{cursor:'grab',color:'var(--dim)',padding:'4px 5px',borderRadius:6,display:'flex',alignItems:'center',touchAction:'none'}}>⠿</div><span style={{fontSize:14}}></span><input value={o.name} onChange={e=>setLocalObs(lo=>lo.map(x=>x.id===o.id?{...x,name:e.target.value}:x))} style={{flex:1,background:'transparent',border:'1px solid rgba(255,153,0,0.3)',borderRadius:6,padding:'3px 8px',color:'var(--fg)',fontSize:13}}/><label style={{display:'flex',alignItems:'center',gap:3,fontSize:11,color:'var(--dim)',flexShrink:0}}><span>{lang==='de'?'Pause':'Rest'}</span><input type="number" min={0} max={60} value={o.restTime||0} onChange={e=>setLocalObs(lo=>lo.map(x=>x.id===o.id?{...x,restTime:+e.target.value}:x))} style={{width:36,background:'transparent',border:'1px solid rgba(255,153,0,0.3)',borderRadius:4,padding:'2px 3px',color:'var(--fg)',fontSize:11,textAlign:'center'}}/><span>s</span></label><button onClick={()=>setLocalObs(lo=>lo.filter(x=>x.id!==o.id))} style={{background:'none',border:'none',color:'var(--danger)',cursor:'pointer',padding:'2px 8px',fontSize:16,flexShrink:0}}>×</button></div>):(
                        <div style={{padding:'4px 6px',display:'flex',alignItems:'center',gap:5}}>
                          <div className="drag-handle"><I.Drag s={14}/></div>
                          <button style={{background:'none',border:'none',cursor:'pointer',padding:'2px 3px',lineHeight:1,color:o.isCP?'var(--cor)':'var(--dim)',flexShrink:0,display:'flex',alignItems:'center'}} onClick={()=>setLocalObs(obs=>obs.map((x,i)=>i===idx?{...x,isCP:!x.isCP}:x))} title={o.isCP?'CP aktiv':'Kein CP'}>{o.isCP?<I.Target s={14} c="var(--cor)"/>:<I.Target s={14} c="rgba(255,255,255,.2)"/>}</button>
                          <input value={o.name} onChange={e=>setLocalObs(obs=>obs.map((x,i)=>i===idx?{...x,name:e.target.value}:x))} style={{flex:1,padding:'4px 7px',fontSize:12,borderRadius:7,minWidth:0}}/>
                          <button style={{background:'rgba(255,59,48,.1)',border:'none',borderRadius:6,padding:'3px 7px',color:'var(--red)',cursor:'pointer',fontSize:11,flexShrink:0}} onClick={()=>setLocalObs(obs=>obs.filter((_,i)=>i!==idx))}><I.X s={11} c="var(--red)"/></button>
                        </div>
                      )}/>
                  </div>
                  <div style={{display:'flex',gap:6,borderTop:'1px solid var(--border)',paddingTop:8,marginTop:1,alignItems:'center'}}
                    draggable={!!newObsName.trim()}
                    onDragStart={e=>{if(!e.target.closest('.drag-handle')||!newObsName.trim()){e.preventDefault();return;}e.dataTransfer.setData('dnd-obs-ext',newObsName.trim());e.dataTransfer.effectAllowed='copy';}}>
                    <div className="drag-handle" title={lang==='de'?'Ziehen zum Einfügen':'Drag to insert'} style={{opacity:newObsName.trim()?1:0.3,cursor:newObsName.trim()?'grab':'default'}}><I.Drag s={14}/></div>
                    <input value={newObsName} onChange={e=>setNewObsName(e.target.value)} placeholder={lang==='de'?'Neues Hindernis…':'New obstacle…'} style={{flex:1,padding:'6px 10px',fontSize:12,borderRadius:8}} onKeyDown={e=>{if(e.key==='Enter')addLocalObs();}}/>
                    <button className="btn btn-ghost" style={{padding:'6px 11px',fontSize:12,gap:4,flexShrink:0}} onClick={addLocalObs}><I.Plus s={12}/>{lang==='de'?'Hinzu':'Add'}</button><button className="btn btn-ghost" style={{padding:'6px 10px',fontSize:12,gap:3,flexShrink:0}} onClick={()=>setLocalObs(lo=>[...lo,{id:'sec'+Date.now(),name:lang==='de'?'Plattform':'Platform',type:'section',isCP:false,order:lo.length,restTime:30}])}> {lang==='de'?'Plattform':'Platform'}</button>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button className="btn btn-coral" style={{flex:1,padding:'10px',fontSize:13,gap:6}} onClick={saveObsEdit}><I.Check s={13}/>{lang==='de'?'Speichern':'Save'}</button>
                    <button className="btn btn-ghost" style={{padding:'10px 14px',fontSize:12}} onClick={()=>setEditObsStage(null)}>{lang==='de'?'Abbrechen':'Cancel'}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </>
        )}

        {/* ── Quick add athlete mid-competition ── */}
        <div className="sep" style={{marginTop:8}}/>
        <button className="btn btn-ghost" style={{width:'100%',padding:'11px 14px',gap:8,justifyContent:'space-between',fontSize:14}}
          onClick={()=>{setShowAddAth(v=>!v);SFX.hover();}}>
          <span style={{display:'flex',alignItems:'center',gap:8}}><I.Plus s={15}/> {lang==='de'?'Athleten nachträglich hinzufügen':'Add athlete during competition'}</span>
          <span style={{fontSize:11,color:'var(--muted)'}}>{showAddAth?'▲':'▼'}</span>
        </button>
        {showAddAth&&(
          <div className="scale-in" style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:14,padding:14,display:'flex',flexDirection:'column',gap:8}}>
            <div style={{fontSize:12,color:'var(--muted)',marginBottom:2}}>{lang==='de'?'Athlete wird sofort in alle Stages eingetragen':'Athlete is added to all stages immediately'}</div>
            <div style={{display:'flex',gap:8}}>
              <input value={quickAth.num} onChange={e=>setQuickAth(a=>({...a,num:e.target.value}))} placeholder="#" style={{width:60,flexShrink:0}}/>
              <input value={quickAth.name} onChange={e=>setQuickAth(a=>({...a,name:e.target.value}))} placeholder={lang==='de'?'Name':'Name'} onKeyDown={e=>{if(e.key==='Enter')handleQuickAddAth();}} autoFocus/>
            </div>
            <select value={quickAth.cat} onChange={e=>setQuickAth(a=>({...a,cat:e.target.value}))}>
              {IGN_CATS.map(c=><option key={c.id} value={c.id}>{c.name[lang]||c.name.de}</option>)}
            </select>
            <div style={{display:'flex',gap:6}}>
              {[['m',lang==='de'?'M':'M'],['w',lang==='de'?'W':'W'],['d','D']].map(([v,lbl])=>(
                <button key={v} className={`chip${quickAth.gender===v?' active':''}`} style={{flex:1,justifyContent:'center',fontSize:11}}
                  onClick={()=>setQuickAth(a=>({...a,gender:v}))}>{lbl}</button>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <input value={quickAth.country||''} onChange={e=>setQuickAth(a=>({...a,country:e.target.value}))} placeholder={lang==='de'?'Land (z.B. CH)':'Country'} style={{flex:1}}/>
              <input value={quickAth.team||''} onChange={e=>setQuickAth(a=>({...a,team:e.target.value}))} placeholder="Team" style={{flex:1}}/>
            </div>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'7px 10px',background:'rgba(255,255,255,.03)',borderRadius:10,border:'1px solid var(--border)'}}>
              {quickAth.photo
                ?<><img src={quickAth.photo} style={{width:28,height:28,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/><span style={{fontSize:12,flex:1}}>{lang==='de'?'Foto ändern ✓':'Change photo ✓'}</span><button style={{background:'rgba(255,59,48,.15)',border:'none',borderRadius:6,padding:'2px 8px',color:'var(--red)',fontSize:11,cursor:'pointer'}} onClick={e=>{e.preventDefault();setQuickAth(a=>({...a,photo:null}));}}>{lang==='de'?'Löschen':'Remove'}</button></>
                :<><I.Camera s={17} c="var(--muted)"/><span style={{fontSize:12,flex:1,color:'var(--muted)'}}>{lang==='de'?'Foto (optional)':'Photo (optional)'}</span></>
              }
              <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{if(e.target.files[0])resizePhotoUtil(e.target.files[0],b64=>setQuickAth(a=>({...a,photo:b64})));e.target.value='';}}/>
            </label>
            <button className="btn btn-coral" style={{padding:'10px',gap:6}} disabled={addingAth||!quickAth.name.trim()} onClick={handleQuickAddAth}>
              {addingAth?'Speichern…':<><I.Plus s={15}/> {lang==='de'?'Athlet hinzufügen':'Add Athlete'}</>}
            </button>
          </div>
        )}
        {/* Athlete list quick overview with edit/delete */}
        {athList.length>0&&(
          <div style={{marginTop:4}}>
            <div className="lbl" style={{marginBottom:6}}>{lang==='de'?`Athleten (${athList.length})`:`Athletes (${athList.length})`}</div>
            <div style={{maxHeight:320,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
              {athList.sort((a,b)=>(+a.num||0)-(+b.num||0)).map(a=>{
                const cat=IGN_CATS.find(c=>c.id===a.cat);
                const isEditing=editingAth===a.id;
                if(isEditing&&editAthDraft){
                  const dCat=IGN_CATS.find(c=>c.id===editAthDraft.cat);
                  return(
                    <div key={a.id} style={{background:'rgba(255,94,58,.06)',border:'1px solid rgba(255,94,58,.25)',borderRadius:10,padding:'10px 12px',display:'flex',flexDirection:'column',gap:8}}>
                      <div style={{display:'flex',gap:6}}>
                        <input value={editAthDraft.num||''} onChange={e=>setEditAthDraft(d=>({...d,num:e.target.value}))} placeholder="#" style={{width:54,flexShrink:0,fontSize:13,padding:'6px 8px'}}/>
                        <input value={editAthDraft.name} onChange={e=>setEditAthDraft(d=>({...d,name:e.target.value}))} placeholder="Name" style={{flex:1,fontSize:13,padding:'6px 8px'}} onKeyDown={e=>{if(e.key==='Enter')handleSaveAth();if(e.key==='Escape'){setEditingAth(null);setEditAthDraft(null);}}} autoFocus/>
                      </div>
                      <div style={{display:'flex',gap:6}}>
                        <select value={editAthDraft.cat} onChange={e=>setEditAthDraft(d=>({...d,cat:e.target.value}))} style={{flex:1,fontSize:12,padding:'5px 7px'}}>
                          {IGN_CATS.map(c=><option key={c.id} value={c.id}>{c.name[lang]||c.id}</option>)}
                        </select>
                        <select value={editAthDraft.gender||'m'} onChange={e=>setEditAthDraft(d=>({...d,gender:e.target.value}))} style={{width:70,fontSize:12,padding:'5px 7px'}}>
                          <option value="m">♂ m</option>
                          <option value="f">♀ f</option>
                        </select>
                      </div>
                      <div style={{display:'flex',gap:6}}>
                        <input value={editAthDraft.country||''} onChange={e=>setEditAthDraft(d=>({...d,country:e.target.value}))} placeholder={lang==='de'?'Land (z.B. CH)':'Country'} style={{flex:1,fontSize:12,padding:'5px 8px'}}/>
                        <input value={editAthDraft.team||''} onChange={e=>setEditAthDraft(d=>({...d,team:e.target.value}))} placeholder="Team" style={{flex:1,fontSize:12,padding:'5px 8px'}}/>
                      </div>
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn btn-coral" style={{flex:1,padding:'7px',fontSize:13,gap:5}} onClick={handleSaveAth}><I.Check s={13}/>{lang==='de'?'Speichern':'Save'}</button>
                        <button className="btn" style={{padding:'7px 12px',fontSize:13}} onClick={()=>{setEditingAth(null);setEditAthDraft(null);}}>✕</button>
                        <button className="btn" style={{padding:'7px 12px',fontSize:13,background:'rgba(255,59,48,.12)',color:'var(--red)',border:'1px solid rgba(255,59,48,.25)'}} onClick={()=>handleDeleteAth(a)}><I.Trash s={13}/></button>
                      </div>
                    </div>
                  );
                }
                return(
                  <div key={a.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:'rgba(255,255,255,.03)',borderRadius:8}}>
                    {a.photo?<img src={a.photo} style={{width:22,height:22,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>:null}
                    <div style={{flex:1,fontSize:13,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{toFlag(a.country)&&<span style={{marginRight:4}}>{toFlag(a.country)}</span>}{a.name}</div>
                    <div style={{fontSize:11,color:'var(--muted)',fontFamily:'JetBrains Mono'}}>#{a.num}</div>
                    {cat&&<div style={{fontSize:10,padding:'1px 7px',borderRadius:8,background:`${cat.color}1A`,color:cat.color,border:`1px solid ${cat.color}44`,fontWeight:600,flexShrink:0}}>{cat.name[lang]||'?'}</div>}
                    <button onClick={()=>handleEditAth(a)} style={{background:'rgba(255,255,255,.07)',border:'none',borderRadius:6,padding:'3px 7px',cursor:'pointer',color:'rgba(255,255,255,.55)',fontSize:11,flexShrink:0,display:'flex',alignItems:'center',gap:3}}><I.Edit s={11}/></button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </>}
      </div>
    </div>
  );
};

// ── Obstacle label helpers ──────────────────────────────────

export { CoordinatorView };
