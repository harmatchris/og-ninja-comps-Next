import React, { useState, useEffect, useRef } from 'react';
import { useLang } from '../i18n.js';
import { IGN_CATS } from '../config.js';
import { toFlag, fmtMs } from '../utils.js';
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


const AthleteQueueView=({compId,info,completedRuns,athletesMap,tvMode=false})=>{
  const {lang,catName}=useLang();
  const allStations=useFbVal(`ogn/${compId}/stations`);
  const allActiveRuns=useFbVal(`ogn/${compId}/activeRuns`);
  const [,setTick]=useState(0);
  useEffect(()=>{const iv=setInterval(()=>setTick(t=>t+1),15000);return()=>clearInterval(iv);},[]);

  const numStages=info?.numStations||1;
  const athList=athletesMap?Object.values(athletesMap):[];
  const runList=completedRuns?Object.values(completedRuns):[];

  const getAvgMs=(sn)=>{
    const lim=info?.stageLimits?.[sn]??info?.timeLimit??0;
    if(lim>0)return lim*1000;
    const recent=runList.filter(r=>String(r.stNum)===String(sn)&&(r.finalTime||0)>0&&(r.finalTime||0)<1200000)
      .sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,6);
    if(recent.length===0)return 90000;
    return Math.round(recent.reduce((s,r)=>s+(r.finalTime||0),0)/recent.length);
  };

  const stages=Array.from({length:numStages},(_,i)=>i+1);
  const activeStages=stages.filter(sn=>allStations?.[sn]?.cat);

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
      gridTemplateColumns:`repeat(${Math.min(activeStages.length,tvMode?4:4)},minmax(0,1fr))`,
      gap:tvMode?20:8,
      padding:tvMode?'20px 24px 40px':'4px 0 12px',
      alignItems:'start'}}>
      {activeStages.map(sn=>{
        const catId=allStations?.[sn]?.cat;
        const cat=IGN_CATS.find(c=>c.id===catId);
        const doneIds=new Set(runList.filter(r=>r.catId===catId&&r.stNum===sn).map(r=>r.athleteId));
        const activeRun=allActiveRuns?.[sn];
        const runningId=(activeRun&&(activeRun.phase==='active'||activeRun.phase==='countdown'))?activeRun.athleteId:null;
        const queue=athList.filter(a=>a.cat===catId&&!doneIds.has(a.id))
          .sort((a,b)=>(a.queueOrder??999)-(b.queueOrder??999));
        const total=athList.filter(a=>a.cat===catId).length;
        const done=doneIds.size;

        if(queue.length===0)return(
          <div key={sn} style={{background:'rgba(48,209,88,.06)',border:'1px solid rgba(48,209,88,.25)',borderRadius:tvMode?18:12,padding:tvMode?'20px 24px':'12px 14px'}}>
            <div style={{fontWeight:800,fontSize:tvMode?17:12}}>Stage {sn}</div>
            {cat&&<div style={{fontSize:tvMode?13:10,color:'var(--muted)',marginBottom:4}}>{catName(cat)}</div>}
            <div style={{fontSize:tvMode?15:11,color:'#30D158',fontWeight:700}}>✓ {lang==='de'?`Alle ${total} fertig`:`All ${total} done`}</div>
          </div>
        );

        const avgMs=getAvgMs(sn);
        const slotMs=avgMs+22000;
        const recentCnt=runList.filter(r=>String(r.stNum)===String(sn)&&(r.finalTime||0)>0&&(r.finalTime||0)<1200000).length;
        const lim=info?.stageLimits?.[sn]??info?.timeLimit??0;
        const basisLabel=lim>0?`${lim}s`:(recentCnt>=2?`Ø${Math.round(avgMs/60000)}m`:`~${Math.round(avgMs/60000)}m`);

        return(
          <div key={sn} style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:tvMode?18:12,overflow:'hidden'}}>
            {/* Stage header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:tvMode?'12px 18px':'8px 12px',background:'rgba(255,255,255,.03)',borderBottom:'1px solid var(--border)'}}>
              <div style={{display:'flex',alignItems:'center',gap:tvMode?12:8}}>
                <div style={{width:tvMode?38:26,height:tvMode?38:26,borderRadius:tvMode?10:7,background:'rgba(255,94,58,.14)',border:'1px solid rgba(255,94,58,.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:tvMode?20:13,fontWeight:900,color:'var(--coral)',flexShrink:0}}>{sn}</div>
                <div>
                  <div style={{fontWeight:800,fontSize:tvMode?16:11,lineHeight:1.2}}>{info?.stageNames?.[sn]||`Stage ${sn}`}</div>
                  {cat&&<div style={{fontSize:tvMode?12:9,color:'var(--muted)',marginTop:1}}>{catName(cat)}</div>}
                </div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontSize:tvMode?11:9,color:'var(--muted)',fontWeight:700}}>{done}/{total}</div>
                <div style={{fontSize:tvMode?10:8,color:'var(--dim)',marginTop:1}}>{basisLabel}</div>
              </div>
            </div>
            {/* Auto-scrolling athlete list */}
            <AutoScrollList itemCount={queue.length} tvMode={tvMode}>
              {queue.map((ath,i)=>{
                const isNowRunning=ath.id===runningId;
                const slotsAhead=i;
                let etaLabel,etaColor;
                if(isNowRunning){etaLabel='▶';etaColor='#30D158';}
                else if(slotsAhead===0){etaLabel=lang==='de'?'Next →':'Next →';etaColor='var(--coral)';}
                else{const mins=Math.max(1,Math.round((slotsAhead*slotMs)/60000));etaLabel=`~${mins}m`;etaColor=mins<=3?'var(--gold)':'var(--muted)';}
                const isNext=!runningId&&i===0;
                const isLast=i===queue.length-1;
                return(
                  <div key={ath.id} style={{display:'flex',alignItems:'center',gap:tvMode?12:7,padding:tvMode?'12px 18px':'7px 12px',background:isNowRunning?'rgba(48,209,88,.07)':isNext?'rgba(255,94,58,.06)':'transparent',borderBottom:isLast?'none':'1px solid rgba(255,255,255,.04)'}}>
                    <div style={{width:tvMode?24:18,textAlign:'center',fontSize:tvMode?14:10,fontWeight:900,color:isNowRunning?'#30D158':isNext?'var(--coral)':'var(--dim)',flexShrink:0}}>{isNowRunning?'▶':(i+1)}</div>
                    {ath.photo
                      ?<img src={ath.photo} style={{width:photoSz,height:photoSz,borderRadius:'50%',objectFit:'cover',flexShrink:0,border:`2px solid ${isNowRunning?'rgba(48,209,88,.5)':isNext?'rgba(255,94,58,.4)':'rgba(255,255,255,.1)'}`}}/>
                      :<div style={{width:photoSz,height:photoSz,borderRadius:'50%',background:isNext?'rgba(255,94,58,.1)':'rgba(255,255,255,.05)',border:`2px solid ${isNext?'rgba(255,94,58,.3)':'rgba(255,255,255,.08)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <I.User s={tvMode?28:14} c={isNext?'rgba(255,94,58,.6)':'rgba(255,255,255,.3)'}/>
                      </div>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:nameSz,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:isNowRunning?'#30D158':isNext?'#fff':'var(--text)'}}>{ath.name}</div>
                      <div style={{fontSize:subSz,color:'var(--dim)',marginTop:1}}>#{ath.num}{ath.team?` · ${ath.team}`:''}</div>
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
