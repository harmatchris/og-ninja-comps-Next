import React, { useState, useEffect, useRef } from 'react';
import { useLang } from '../i18n.js';
import { IGN_CATS } from '../config.js';
import { toFlag, fmtMs, effectiveStageLimit } from '../utils.js';
import { useFbVal, SFX } from '../hooks.js';
import { I } from '../icons.jsx';
import { Spinner, EmptyState, CompEmoji } from './shared.jsx';

const AutoScrollList=({children,itemCount,tvMode,topPause=3500,minItems=5,maxH=null})=>{
  const ref=useRef(null);
  useEffect(()=>{
    if(!ref.current||itemCount<=minItems)return;
    let pos=0,pauseUntil=Date.now()+topPause,animId;
    const speed=tvMode?0.5:0.35;
    const tick=()=>{
      const el=ref.current;
      if(!el){animId=requestAnimationFrame(tick);return;}
      const now=Date.now();
      if(now<pauseUntil){animId=requestAnimationFrame(tick);return;}
      const maxS=el.scrollHeight-el.clientHeight;
      if(maxS<=0){animId=requestAnimationFrame(tick);return;}
      pos+=speed;
      if(pos>=maxS+60){pos=0;el.scrollTop=0;pauseUntil=Date.now()+topPause;}
      else{el.scrollTop=pos;}
      animId=requestAnimationFrame(tick);
    };
    animId=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(animId);
  },[itemCount,tvMode,topPause,minItems]);
  const h=maxH||(tvMode?'70vh':'44vh');
  return<div ref={ref} style={{overflowY:'hidden',maxHeight:h}}>{children}</div>;
};


const AthleteQueueView=({compId,info,completedRuns,athletesMap,tvMode=false,pipelineData=null,onlyCats=null,builderFill=false})=>{
  const {lang,catName}=useLang();
  const allStations=useFbVal(`ogn/${compId}/stations`);
  const allActiveRuns=useFbVal(`ogn/${compId}/activeRuns`);
  const [,setTick]=useState(0);
  // Re-render every 5s so the ETA / "next starter" countdown stays live and keeps re-checking the pace.
  useEffect(()=>{const iv=setInterval(()=>setTick(t=>t+1),5000);return()=>clearInterval(iv);},[]);

  const numStages=info?.numStations||1;
  const athList=athletesMap?Object.values(athletesMap):[];
  const runList=completedRuns?Object.values(completedRuns):[];

  // Realistic, self-adapting per-athlete SLOT time (start-to-start, ms). Adapts after a few runners and
  // self-corrects if the pace slows down:
  //   1) realized throughput = avg gap between recent completions (breaks/outliers capped) — the truest
  //      measure once ≥4 athletes are through (covers run + jury/transition time automatically),
  //   2) else avg of recent run times + ~22s transition,
  //   3) else the stage time-limit + transition, 4) else a 90s default. The limit is now only the
  //      fallback for the very first runners — not the permanent assumption.
  const getSlot=(sn)=>{
    const on=r=>isPipeline?r.stageId===sn:String(r.stNum)===String(sn);
    const done=runList.filter(r=>on(r)&&(r.timestamp||0)>0).sort((a,b)=>(a.timestamp||0)-(b.timestamp||0));
    if(done.length>=4){
      const recent=done.slice(-8),gaps=[];
      for(let i=1;i<recent.length;i++){const g=(recent[i].timestamp||0)-(recent[i-1].timestamp||0);if(g>5000&&g<600000)gaps.push(g);}
      if(gaps.length>=3)return{ms:Math.round(gaps.reduce((s,g)=>s+g,0)/gaps.length),src:'pace'};
    }
    const runs=runList.filter(r=>on(r)&&(r.finalTime||0)>0&&(r.finalTime||0)<1200000).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,6);
    if(runs.length>=3)return{ms:Math.round(runs.reduce((s,r)=>s+(r.finalTime||0),0)/runs.length)+22000,src:'avg'};
    const lim=effectiveStageLimit(info,pipelineData,sn);
    return{ms:(lim>0?lim*1000:90000)+22000,src:lim>0?'limit':'default'};
  };

  const isPipeline=!!(info?.pipelineEnabled&&pipelineData);
  const pipelineStages=isPipeline?Object.entries(pipelineData).filter(([,v])=>v&&typeof v==='object'&&v.name!=null).map(([id,v])=>({id,...v})).sort((a,b)=>(a.order||0)-(b.order||0)):[];
  const stages=isPipeline?pipelineStages.map(s=>s.id):Array.from({length:numStages},(_,i)=>i+1);
  const activeStages=isPipeline?stages.filter(sid=>{const ps=pipelineStages.find(s=>s.id===sid);const catIds=ps?.categories==='all'?IGN_CATS.map(c=>c.id):(Array.isArray(ps?.categories)?ps.categories:[]);const catSet=new Set(catIds);return catIds.length>0&&athList.some(a=>catSet.has(a.cat))&&(!onlyCats||catIds.some(c=>onlyCats.includes(c)));}):stages.filter(sn=>allStations?.[sn]?.cat&&(!onlyCats||onlyCats.includes(allStations[sn].cat)));

  if(!allStations&&!info)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:40}}><Spinner/></div>;
  if(activeStages.length===0)return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:32,textAlign:'center'}}>
      <I.User s={tvMode?80:36} c="rgba(255,255,255,.15)"/>
      <div style={{fontSize:tvMode?20:13,color:'var(--muted)',lineHeight:1.55}}>{lang==='de'?'Noch keine Stage aktiv.':'No stage active yet.'}</div>
    </div>
  );

  const photoSz=tvMode?68:34;
  const nameSz=tvMode?20:13;
  const subSz=tvMode?13:10;
  const etaSz=tvMode?16:12;

  return(
    <div style={{
      display:'grid',
      // auto-fit so columns stay wide enough for full names (no clipping): narrow tiles (e.g. combo) get one
      // full-width column, wide TV/queue screens get several. 250px guarantees room for long names.
      gridTemplateColumns:`repeat(auto-fit,minmax(${tvMode?360:250}px,1fr))`,
      gap:tvMode?20:8,
      padding:tvMode?'20px 24px 40px':'4px 0 12px',
      alignItems:'start'}}>
      {activeStages.map(sn=>{
        const pStage=isPipeline?pipelineStages.find(s=>s.id===sn):null;
        const catId=isPipeline?null:allStations?.[sn]?.cat;
        const stageCatIds=isPipeline?(pStage?.categories==='all'?IGN_CATS.map(c=>c.id):(Array.isArray(pStage?.categories)?pStage.categories:[])):(catId?[catId]:[]);
        const stageCatSet=new Set(stageCatIds);
        const cat=isPipeline?(stageCatIds.length===1?IGN_CATS.find(c=>c.id===stageCatIds[0]):null):IGN_CATS.find(c=>c.id===catId);
        // Membership: prefer the stage's seeded athletes (stage.athletes). For a continuation stage
        // (predecessorStages) that isn't seeded yet, show nobody — it's waiting on its predecessor,
        // not the whole category. First-round stages without explicit seeding fall back to category.
        const seededIds=isPipeline&&pStage?.athletes&&Object.keys(pStage.athletes).length>0?new Set(Object.keys(pStage.athletes)):null;
        const isContinuation=isPipeline&&Array.isArray(pStage?.predecessorStages)&&pStage.predecessorStages.length>0;
        const memberOf=a=>seededIds?seededIds.has(a.id):(isContinuation?false:(isPipeline?stageCatSet.has(a.cat):(a.cat===catId)));
        const doneIds=new Set(runList.filter(r=>isPipeline?(r.stageId===sn&&stageCatSet.has(r.catId)):(r.catId===catId&&r.stNum===sn)).map(r=>r.athleteId));
        const activeRun=allActiveRuns?.[sn];
        const runningId=(activeRun&&(activeRun.phase==='active'||activeRun.phase==='countdown'))?activeRun.athleteId:null;
        // exclude currently-running athlete from queue so next-up shows at top
        if(runningId)doneIds.add(runningId);
        const queue=athList.filter(a=>memberOf(a)&&!doneIds.has(a.id))
          .sort((a,b)=>{
            const aOrd=isPipeline?(a.pipelineQueueOrder?.[sn]??a.queueOrder??999):(a.queueOrder??999);
            const bOrd=isPipeline?(b.pipelineQueueOrder?.[sn]??b.queueOrder??999):(b.queueOrder??999);
            return aOrd-bOrd;
          });
        const total=athList.filter(memberOf).length;
        if(total===0)return null;
        const done=doneIds.size;

        if(queue.length===0)return(
          <div key={sn} style={{background:'rgba(48,209,88,.06)',border:'1px solid rgba(48,209,88,.25)',borderRadius:tvMode?18:12,padding:tvMode?'20px 24px':'12px 14px'}}>
            <div style={{fontWeight:800,fontSize:tvMode?17:12}}>{isPipeline?(pStage?.name||'Stage'):('Stage '+sn)}</div>
            {cat&&<div style={{fontSize:tvMode?13:10,color:'var(--muted)',marginBottom:4}}>{catName(cat)}</div>}
            <div style={{fontSize:tvMode?15:11,color:'#30D158',fontWeight:700,display:'flex',alignItems:'center',gap:5}}><I.CheckCircle s={tvMode?15:12} c="#30D158"/><span>{lang==='de'?`Alle ${total} fertig`:`All ${total} done`}</span></div>
          </div>
        );

        const slot=getSlot(sn);
        const slotMs=slot.ms,slotSec=Math.round(slotMs/1000);
        // Basis shown so the operator can sanity-check the estimate: \u00d8 Takt (realized pace) / \u00d8 Lauf
        // (avg run) / Limit (fallback), with the per-athlete time.
        const basisLabel=`${slot.src==='pace'?'\u00d8 Takt':slot.src==='avg'?'\u00d8 Lauf':'Limit'} ${Math.floor(slotSec/60)}:${String(slotSec%60).padStart(2,'0')}`;
        // Live countdown to the next starter: subtract how long the current athlete has already been running.
        const hasRunner=!!(activeRun&&(activeRun.phase==='active'||activeRun.phase==='countdown')&&activeRun.startEpoch);
        const firstGap=hasRunner?Math.max(0,slotMs-(Date.now()-activeRun.startEpoch)):0;

        return(
          <div key={sn} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:tvMode?18:12,overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:tvMode?'12px 18px':'8px 12px',background:'rgba(255,255,255,.03)',borderBottom:'1px solid var(--border)'}}>
              <div style={{display:'flex',alignItems:'center',gap:tvMode?12:8}}>
                <div style={{width:tvMode?38:26,height:tvMode?38:26,borderRadius:tvMode?10:7,background:'rgba(255,94,58,.14)',border:'1px solid rgba(255,94,58,.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:tvMode?20:13,fontWeight:900,color:'var(--coral)',flexShrink:0}}>{isPipeline?((pStage?.name||'').trim().charAt(0).toUpperCase()||'•'):sn}</div>
                <div>
                  <div style={{fontWeight:800,fontSize:tvMode?16:11,lineHeight:1.2}}>{isPipeline?(pStage?.name||sn):(info?.stageNames?.[sn]||`Stage ${sn}`)}</div>
                  {cat&&<div style={{fontSize:tvMode?12:9,color:'var(--muted)',marginTop:1}}>{catName(cat)}</div>}
                </div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontSize:tvMode?11:9,color:'var(--muted)',fontWeight:700}}>{done}/{total}</div>
                <div style={{fontSize:tvMode?10:8,color:'var(--dim)',marginTop:1}}>{basisLabel}</div>
              </div>
            </div>
            <AutoScrollList itemCount={queue.length} tvMode={tvMode} maxH={builderFill?'100%':null}>
              {queue.map((ath,i)=>{
                const isNowRunning=ath.id===runningId;
                const slotsAhead=i;
                let etaLabel,etaColor;
                // Time until THIS athlete starts: remaining time of the current run + a full slot per athlete ahead.
                const etaMs=firstGap+slotsAhead*slotMs;
                if(isNowRunning){etaLabel='\u25b6';etaColor='#30D158';}
                else if(etaMs<20000){etaLabel='Next \u2192';etaColor='var(--coral)';}
                else if(etaMs<90000){const s=Math.round(etaMs/1000);etaLabel=`in ${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;etaColor='var(--gold)';}
                else{const mins=Math.max(1,Math.round(etaMs/60000));etaLabel=`~${mins}m`;etaColor=mins<=3?'var(--gold)':'var(--muted)';}
                const isNext=!runningId&&i===0;
                const isLast=i===queue.length-1;
                return(
                  <div key={ath.id} style={{display:'flex',alignItems:'center',gap:tvMode?12:7,padding:tvMode?'12px 18px':'7px 12px',background:isNowRunning?'rgba(48,209,88,.07)':isNext?'rgba(255,94,58,.06)':'transparent',borderBottom:isLast?'none':'1px solid rgba(255,255,255,.04)'}}>
                    <div style={{width:tvMode?24:18,textAlign:'center',fontSize:tvMode?14:10,fontWeight:900,color:isNowRunning?'#30D158':isNext?'var(--coral)':'var(--dim)',flexShrink:0}}>{isNowRunning?'\u25b6':(i+1)}</div>
                    {ath.photo
                      ?<img src={ath.photo} style={{width:photoSz,height:photoSz,borderRadius:'50%',objectFit:'cover',flexShrink:0,border:`2px solid ${isNowRunning?'rgba(48,209,88,.5)':isNext?'rgba(255,94,58,.4)':'rgba(255,255,255,.1)'}`}}/>
                      :<div style={{width:photoSz,height:photoSz,borderRadius:'50%',background:isNext?'rgba(255,94,58,.1)':'rgba(255,255,255,.05)',border:`2px solid ${isNext?'rgba(255,94,58,.3)':'rgba(255,255,255,.08)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <I.User s={tvMode?28:14} c={isNext?'rgba(255,94,58,.6)':'rgba(255,255,255,.3)'}/>
                      </div>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:nameSz,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:isNowRunning?'#30D158':isNext?'#fff':'var(--text)'}}>{ath.name}</div>
                      <div style={{fontSize:subSz,color:'var(--dim)',marginTop:1}}>#{ath.num}{ath.team?` \u00b7 ${ath.team}`:''}</div>
                    </div>
                    <div style={{fontSize:etaSz,fontWeight:700,color:etaColor,flexShrink:0}}>{etaLabel}</div>
                  </div>
                );
              })}
            </AutoScrollList>
          </div>
        );
      })}
    </div>
  );
};

export { AutoScrollList, AthleteQueueView };
