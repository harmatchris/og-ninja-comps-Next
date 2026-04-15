import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLang, REGELWERK_DE, REGELWERK_EN } from '../i18n.js';
import { IGN_CATS, fbSet, fbUpdate, fbRemove, db } from '../config.js';
import { uid, fmtMs, computeRanked, computeRankedStage, computeRankedMultiStage, computeRankedPipeline, computeRankedMultiStagePipeline, computeRankedByPlacement, toFlag } from '../utils.js';
import { useFbVal, SFX } from '../hooks.js';
import { I } from '../icons.jsx';
import { Spinner, EmptyState, MedalBadge, LifeDots, TopBar } from './shared.jsx';

const Regelwerk=()=>{
  const {lang}=useLang();
  const rw=lang==='en'?REGELWERK_EN:REGELWERK_DE;
  const [query,setQuery]=useState('');
  const q=query.trim().toLowerCase();
  const hl=(html)=>{
    if(!q)return html;
    const re=new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
    return html.replace(re,'<mark>$1</mark>');
  };
  const matches=(ch)=>{
    if(!q)return true;
    return ch.title.toLowerCase().includes(q)||ch.content.toLowerCase().includes(q)||ch.nr.toLowerCase().includes(q);
  };
  const matchCount=(ch)=>{
    if(!q)return 0;
    const text=(ch.title+' '+ch.content).toLowerCase();
    let count=0,pos=0;
    while((pos=text.indexOf(q,pos))!==-1){count++;pos+=q.length;}
    return count;
  };
  const totalMatches=rw.reduce((s,c)=>s+matchCount(c),0);
  const visible=rw.filter(matches);
  return(
    <div style={{paddingBottom:80}}>
      <div className="rw-search-bar">
        <div style={{position:'relative'}}>
          <input value={query} onChange={e=>setQuery(e.target.value)}
            placeholder={lang==='de'?'Regelwerk durchsuchen…':'Search rulebook…'}
            style={{paddingLeft:36,borderRadius:10,fontSize:13}}/>
          <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontSize:14,opacity:.5}}></span>
          {query&&<button onClick={()=>setQuery('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16,opacity:.5,color:'var(--text)',padding:'0 2px'}}>✕</button>}
        </div>
        {q&&<div style={{marginTop:8,display:'flex',gap:6,alignItems:'center'}}>
          <span className="rw-match-badge"> {totalMatches} {lang==='de'?'Treffer':'matches'} · {visible.length} {lang==='de'?'Kapitel':'chapters'}</span>
          {visible.length===0&&<span style={{fontSize:11,color:'var(--muted)'}}>{lang==='de'?'Keine Ergebnisse':'No results'}</span>}
        </div>}
      </div>
      {visible.map(ch=>{
        const cnt=matchCount(ch);
        const hasMatch=cnt>0&&!!q;
        return(
          <details key={ch.nr} className="rw-chapter" open={hasMatch||undefined}>
            <summary>
              <span style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{color:ch.color,fontWeight:800,fontSize:15,minWidth:20}}>{ch.nr}</span>
                <span>{ch.title}</span>
                {hasMatch&&<span className="rw-match-badge">{cnt}</span>}
              </span>
            </summary>
            <div className="rw-body" dangerouslySetInnerHTML={{__html:hl(ch.content)}}/>
          </details>
        );
      })}
      {visible.length===0&&q&&<div style={{padding:'40px 24px',textAlign:'center',color:'var(--muted)',fontSize:13}}>{lang==='de'?`Kein Ergebnis für «${q}»`:`No results for "${q}"`}</div>}
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// EDIT RUN MODAL

const EditRunModal=({run,runKey,compId,onClose})=>{
  const {lang}=useLang();
  const stObstRaw=useFbVal(run.stNum?`ogn/${compId}/stages/${run.stNum}/obstacles`:null);
  const globObstRaw=useFbVal(`ogn/${compId}/obstacles`);
  const obstArr=Object.values(stObstRaw||globObstRaw||{}).sort((a,b)=>a.order-b.order);
  const doneCP=run.doneCP||[];
  const [status,setStatus]=useState(run.status||'fall');
  const [selCpIdx,setSelCpIdx]=useState(doneCP.length>0?doneCP.length-1:-1);
  const [fellAtId,setFellAtId]=useState(run.fellAt?.id||null);
  const [saving,setSaving]=useState(false);
  const selectedTime=selCpIdx>=0?(doneCP[selCpIdx]?.time||run.finalTime||0):(run.finalTime||0);
  const newDoneCP=doneCP.slice(0,selCpIdx+1);
  const fellAtObst=obstArr.find(o=>o.id===fellAtId)||null;
  const lastCpOrder=selCpIdx>=0?(doneCP[selCpIdx]?.order??-1):-1;
  const candidateObst=obstArr.filter(o=>(o.order??999)>lastCpOrder);
  const handleSave=async()=>{
    setSaving(true);
    const updated={...run,status,finalTime:selectedTime,doneCP:newDoneCP,
      fellAt:fellAtObst?{id:fellAtObst.id,name:fellAtObst.name,order:fellAtObst.order}:null,
      corrected:true,correctedAt:Date.now()};
    await fbSet(`ogn/${compId}/completedRuns/${runKey}`,updated);
    setSaving(false);SFX.complete();onClose();
  };
  const statusOpts=[['complete',lang==='de'?'Abgeschlossen / Buzzer':'Complete / Buzzer','var(--green)'],['fall',lang==='de'?'Fall':'Fall','var(--cor)'],['dnf','DNF / '+(lang==='de'?'Abgebrochen':'Stopped'),'var(--gold)'],['timeout',lang==='de'?'Zeitlimit':'Timeout','var(--gold)'],['dsq','DSQ','#FF3B6B']];
  return(
    <div className="modal-overlay">
      <div className="modal-sheet" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
        <div style={{textAlign:'center',marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'center',marginBottom:8}}><div style={{width:48,height:48,borderRadius:'50%',background:'rgba(255,200,80,.1)',border:'2px solid rgba(255,200,80,.25)',display:'flex',alignItems:'center',justifyContent:'center'}}><I.Edit s={22} c="var(--gold)"/></div></div>
          <div style={{fontSize:17,fontWeight:900}}>{lang==='de'?'Ergebnis korrigieren':'Correct Result'}</div>
          <div style={{fontSize:12,color:'var(--muted)',marginTop:3}}>{run.athleteName} · Stage {run.stNum||1}</div>
          {run.corrected&&<div style={{fontSize:10,color:'var(--gold)',marginTop:4,display:'flex',alignItems:'center',gap:4,justifyContent:'center'}}><I.Flag s={10} c="var(--gold)"/>{lang==='de'?'Bereits korrigiert':'Previously corrected'}</div>}
        </div>
        <div className="sh-card" style={{padding:12,marginBottom:10}}>
          <div className="lbl" style={{marginBottom:8}}>Status</div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {statusOpts.map(([s,label,col])=>(
              <button key={s} className={`chip${status===s?' active':''}`}
                style={{justifyContent:'space-between',padding:'8px 12px',background:status===s?`${col}18`:'rgba(255,255,255,.03)',borderColor:status===s?`${col}55`:'rgba(255,255,255,.08)'}}
                onClick={()=>setStatus(s)}>
                <span style={{fontWeight:700,color:status===s?col:'var(--text)'}}>{label}</span>
                {status===s&&<I.Check s={13} c={col}/>}
              </button>
            ))}
          </div>
        </div>
        <div className="sh-card" style={{padding:12,marginBottom:10}}>
          <div className="lbl" style={{marginBottom:8}}>{lang==='de'?'Letzter erreichter Checkpoint':'Last reached checkpoint'}</div>
          <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:200,overflowY:'auto'}}>
            <button className={`chip${selCpIdx===-1?' active':''}`} style={{justifyContent:'space-between',padding:'8px 12px'}} onClick={()=>{setSelCpIdx(-1);setFellAtId(null);}}>
              <span style={{fontWeight:600}}>{lang==='de'?'Kein CP erreicht':'No CP reached'}</span>
              <span style={{fontSize:11,color:'var(--muted)',fontFamily:'JetBrains Mono'}}>—</span>
            </button>
            {doneCP.map((cp,i)=>(
              <button key={i} className={`chip${selCpIdx===i?' active':''}`}
                style={{justifyContent:'space-between',padding:'8px 12px',background:selCpIdx===i?'rgba(255,94,58,.18)':'rgba(255,255,255,.04)'}}
                onClick={()=>{setSelCpIdx(i);setFellAtId(null);}}>
                <span style={{fontWeight:600}}><span style={{color:'var(--cor)',marginRight:5,fontSize:10}}>✓</span>{i+1}. {cp.name||`CP ${i+1}`}</span>
                <span style={{fontSize:12,fontFamily:'JetBrains Mono',fontWeight:700,color:'var(--text)',marginLeft:8,flexShrink:0}}>{cp.time!=null?fmtMs(cp.time):'—'}</span>
              </button>
            ))}
          </div>
          {(selCpIdx>=0||run.finalTime>0)&&<div style={{marginTop:8,padding:'6px 10px',background:'rgba(255,94,58,.08)',borderRadius:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:11,color:'var(--muted)'}}>{lang==='de'?'Offizielle Zeit':'Official time'}</span>
            <span className="timer-grad" style={{fontSize:20}}>{selectedTime>0?fmtMs(selectedTime):'—'}</span>
          </div>}
        </div>
        {status!=='complete'&&status!=='dsq'&&candidateObst.length>0&&(
          <div className="sh-card" style={{padding:12,marginBottom:10}}>
            <div className="lbl" style={{marginBottom:8}}>{lang==='de'?'Gestürzt/Gestoppt bei:':'Fell/stopped at:'}</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
              <button className={`chip${fellAtId===null?' active':''}`} style={{fontSize:11,padding:'4px 10px'}} onClick={()=>setFellAtId(null)}>—</button>
              {candidateObst.map(o=>(
                <button key={o.id} className={`chip${fellAtId===o.id?' active':''}`} style={{fontSize:11,padding:'4px 10px',display:'inline-flex',alignItems:'center',gap:3}} onClick={()=>setFellAtId(o.id)}><ObsLabel obs={o} size={9}/></button>
              ))}
            </div>
          </div>
        )}
        <button className="btn btn-coral" style={{width:'100%',padding:13,gap:8,marginBottom:8}} onClick={handleSave} disabled={saving}>{saving?<I.RefreshCw s={14}/>:<I.Check s={14}/>} {lang==='de'?'Korrektur speichern':'Save correction'}</button>
        <button className="btn btn-ghost" style={{width:'100%',padding:11}} onClick={onClose}>↩ {lang==='de'?'Abbrechen':'Cancel'}</button>
      </div>
    </div>
  );
};

const LiveStageTimerBanner=({compId,info,athletes,pipelineData})=>{
  const activeRuns=useFbVal(`ogn/${compId}/activeRuns`);
  const [now,setNow]=useState(Date.now());
  const liveEntries=activeRuns?Object.entries(activeRuns).filter(([,r])=>r?.athleteId&&r.phase!=='done'&&(r.startEpoch||r.phase==='countdown')):[];
  useEffect(()=>{if(!liveEntries.length)return;const iv=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(iv);},[liveEntries.length]);
  if(!liveEntries.length)return null;
  const isPipeline=!!(info?.pipelineEnabled&&pipelineData);
  const pipelineStages=isPipeline?Object.entries(pipelineData).map(([id,v])=>({id,...v})):[];
  const fmtT=ms=>{const s=Math.floor(ms/1000);const m=Math.floor(s/60);return`${m}:${String(s%60).padStart(2,'0')}`;};
  return(
    <div style={{display:'flex',flexDirection:'column',gap:0}}>
      {liveEntries.map(([key,r])=>{
        const a=athletes?.[r.athleteId];
        const isCountdown=r.phase==='countdown';
        const elapsed=r.startEpoch?Math.max(0,now-r.startEpoch):0;
        const stageName=isPipeline?(pipelineStages.find(s=>s.id===key)?.name||key):`Stage ${key}`;
        const limitMs=(info?.stageLimits?.[key]??info?.timeLimit??0)*1000;
        const remaining=(!isCountdown&&limitMs>0)?Math.max(0,limitMs-elapsed):null;
        const timeCritical=remaining!==null&&remaining<15000;
        const timerVal=isCountdown?0:remaining!==null?remaining:elapsed;
        const timerColor=isCountdown?'#FF9500':timeCritical?'#FF3B30':remaining!==null?'#FFD60A':'#30D158';
        const catId=a?.cat||r.catId;
        const cat=IGN_CATS.find(c=>c.id===catId);
        return(
          <div key={key} style={{padding:'16px 20px',background:timeCritical?'rgba(255,59,48,.07)':'rgba(52,199,89,.05)',borderBottom:'1px solid rgba(255,255,255,.07)'}}>
            {/* Top row: stage + athlete name + LIVE badge */}
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:'var(--green)',boxShadow:'0 0 8px rgba(52,199,89,.9)',animation:'pulse 1.2s infinite',flexShrink:0}}/>
              <span style={{fontSize:11,color:'rgba(255,255,255,.45)',fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase'}}>{stageName}</span>
              {cat&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:5,background:`${cat.color}1A`,color:cat.color,border:`1px solid ${cat.color}44`,fontWeight:700,letterSpacing:'.06em'}}>{cat.name?.de||cat.name||catId}</span>}
              <span style={{marginLeft:'auto',fontSize:9,fontWeight:800,color:'var(--green)',background:'rgba(52,199,89,.15)',border:'1px solid rgba(52,199,89,.3)',borderRadius:5,padding:'2px 7px',letterSpacing:'.1em'}}>LIVE</span>
            </div>
            {/* Big timer + athlete name */}
            <div style={{display:'flex',alignItems:'center',gap:16}}>
              <div style={{fontFamily:'JetBrains Mono',fontSize:52,fontWeight:900,lineHeight:1,color:timerColor,letterSpacing:'-2px',flexShrink:0,textShadow:timeCritical?`0 0 24px rgba(255,59,48,.5)`:`0 0 24px ${timerColor}44`}}>
                {isCountdown?(r.countdown||'GO'):fmtT(timerVal)}
              </div>
              <div style={{flex:1,minWidth:0}}>
                {a&&<div style={{fontSize:20,fontWeight:800,color:'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',letterSpacing:'-.3px'}}>{a.name}</div>}
                {a?.team&&<div style={{fontSize:12,color:'var(--muted)',marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.team}</div>}
                {r.doneCP&&<div style={{fontSize:11,color:'rgba(255,255,255,.5)',marginTop:3,fontWeight:600}}>CP {r.doneCP.length||0}{r.livesLeft!=null&&<span style={{marginLeft:8,color:'var(--coral)'}}>{'*'.repeat(r.livesLeft)} Lives</span>}</div>}
                {remaining!==null&&<div style={{fontSize:10,color:timerColor,marginTop:4,fontWeight:700,opacity:.8}}>{remaining<=0?'ZEITLIMIT!':timeCritical?'LETZTE SEKUNDEN':'verbleibend'}</div>}
              </div>
            </div>
            {/* Elapsed progress bar when time limit exists */}
            {limitMs>0&&(
              <div style={{marginTop:10,height:4,background:'rgba(255,255,255,.08)',borderRadius:2,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.min(100,(elapsed/limitMs)*100)}%`,background:timerColor,borderRadius:2,transition:'width .5s linear'}}/>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Auto-scrolling ranking list: pauses at top 2s, scrolls slowly down, resets
const AutoScrollRanking=({items,athMap,fmtMs,lang,t})=>{
  const ref=useRef(null);
  useEffect(()=>{
    const el=ref.current;if(!el||items.length<=6)return;
    let raf,paused=true,pauseStart=performance.now();
    const tick=()=>{
      const now=performance.now();
      if(paused){
        if(now-pauseStart>2000){paused=false;}
      }else{
        el.scrollTop+=0.5; // slow scroll
        if(el.scrollTop>=el.scrollHeight-el.clientHeight){
          el.scrollTop=0;paused=true;pauseStart=now;
        }
      }
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf);
  },[items.length]);
  return(
    <div ref={ref} style={{flex:1,overflowY:'auto',overflowX:'hidden',scrollbarWidth:'none'}}>
      <style>{`.autoscroll-wrap::-webkit-scrollbar{display:none}`}</style>
      <div className="autoscroll-wrap">
        {items.map((r,i)=>{
          const a=athMap[r.athleteId]||{name:r.athleteName||'?',num:'?'};
          return(
            <div key={r.athleteId} style={{padding:'5px 8px',display:'flex',alignItems:'center',gap:6,borderBottom:'1px solid rgba(255,255,255,.04)',opacity:r.status==='dsq'?.5:1}}>
              <div style={{width:18,textAlign:'center',fontSize:10,fontWeight:800,color:i<3?['var(--gold)','#C0C0C0','#CD7F32'][i]:'var(--muted)',fontFamily:'JetBrains Mono'}}>{i+1}</div>
              {a.photo?<img src={a.photo} style={{width:22,height:22,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
                :<div style={{width:22,height:22,borderRadius:'50%',background:'rgba(255,94,58,.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,color:'var(--cor)',flexShrink:0}}>{(a.name||'?')[0]}</div>}
              <div style={{flex:1,minWidth:0,fontSize:11,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.name}</div>
              <div style={{fontSize:10,fontFamily:'JetBrains Mono',color:r.status==='complete'?'var(--green)':r.status==='dsq'?'#FF3B6B':'var(--muted)',fontWeight:700,flexShrink:0}}>
                {r.status==='dsq'?'DSQ':r.finalTime>0?fmtMs(r.finalTime):'—'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ResultsView=({compId,athletes})=>{
  const {t,lang,catName}=useLang();
  const runs=useFbVal(`ogn/${compId}/completedRuns`);
  const [selCat,setSelCat]=useState(null);
  const [selStage,setSelStage]=useState(null);
  const [editMode,setEditMode]=useState(false);
  const [showPwModal,setShowPwModal]=useState(false);
  const [pwInput,setPwInput]=useState('');
  const [pwError,setPwError]=useState(false);
  const [editRun,setEditRun]=useState(null);
  const runList=runs?Object.entries(runs).map(([k,v])=>({...v,_fbKey:k})):[];
  const athMap=athletes||{};
  const comp=useFbVal(`ogn/${compId}/info`);
  const pipelineData=useFbVal(comp?.pipelineEnabled?`ogn/${compId}/pipeline`:null);
  const isPipeline=!!(comp?.pipelineEnabled&&pipelineData);
  const pipelineStages=isPipeline?Object.entries(pipelineData).map(([id,v])=>({id,...v})).sort((a,b)=>(a.order||0)-(b.order||0)):[];
  const catsWithRuns=IGN_CATS.filter(c=>runList.some(r=>r.catId===c.id));
  useEffect(()=>{if(!selCat&&catsWithRuns.length>0)setSelCat(catsWithRuns[0].id);},[catsWithRuns.length]);
  const getRunKey=(r)=>r._fbKey||Object.entries(runs||{}).find(([,v])=>v.timestamp!=null&&v.timestamp===r.timestamp&&v.athleteId===r.athleteId)?.[0];
  const openEdit=(r)=>{if(!editMode)return;const key=getRunKey(r);if(key)setEditRun({key,run:r});};
  const handlePwSubmit=()=>{if(pwInput==='2021'){setEditMode(true);setShowPwModal(false);setPwInput('');setPwError(false);SFX.complete();}else{setPwError(true);SFX.fall();}};
  const EditBtn=({r})=>editMode?<button style={{padding:'4px 8px',borderRadius:7,border:'1px solid rgba(255,200,80,.35)',background:'rgba(255,200,80,.08)',color:'var(--gold)',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',gap:4,fontSize:11,fontWeight:700,fontFamily:'Inter,sans-serif'}} onClick={e=>{e.stopPropagation();openEdit(r);}}><I.Edit s={12} c="var(--gold)"/></button>:null;
  // Reset stage selection when category changes
  useEffect(()=>{setSelStage(null);},[selCat]);
  // Stage numbers that have runs for the selected category
  const stageNums=!isPipeline&&selCat?[...new Set(runList.filter(r=>r.catId===selCat&&r.stNum!=null).map(r=>r.stNum))].sort((a,b)=>a-b):[];
  const stageIds=isPipeline?pipelineStages.map(s=>s.id):[];
  const multiStage=isPipeline?stageIds.length>1:stageNums.length>1;
  const allStagesView=selStage==='all';
  const isOverall=selStage==='overall';
  const isMultiOverall=false;
  const ranked=selCat&&!allStagesView?(isOverall
    ?(isPipeline?computeRankedByPlacement(runList,selCat,stageIds,computeRankedPipeline):computeRankedByPlacement(runList,selCat,stageNums,computeRankedStage))
    :selStage!=null?(isPipeline?computeRankedPipeline(runList,selCat,selStage):computeRankedStage(runList,selCat,selStage))
    :computeRanked(runList,selCat)):[];
  const rCPs=r=>isOverall?null:(r.doneCP?.length||0);
  const rTime=r=>isOverall?r.totalTime:(r.finalTime||0);
  const rMaxCPs=r=>{if(isMultiOverall){const tot=stageNums.reduce((s,sn)=>{const bd=r.stageBreakdown?.[String(sn)];return s+(bd?.totalCPs||0);},0);return tot||r.totalCPs||1;}return Math.max(r.totalCPs||0,r.doneCP?.length||0)||1;};
  const StageBreakdown=({r,compact=false})=>{if(!isMultiOverall||!r.stageBreakdown)return null;const totCPs=rCPs(r),totT=rTime(r);const _stages=isPipeline?stageIds:stageNums;return(<div style={{marginTop:compact?3:6,display:'flex',flexWrap:'wrap',gap:3,alignItems:'center'}}>{_stages.map(sn=>{const bd=r.stageBreakdown[String(sn)];const cps=bd?.doneCP?.length||0;const maxC=bd?.totalCPs||'?';const tm=bd?.finalTime||0;return(<span key={sn} style={{display:'inline-flex',alignItems:'center',gap:2,padding:'1px 5px',borderRadius:6,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.08)',fontSize:9,fontFamily:'JetBrains Mono',color:'rgba(255,255,255,.5)'}}><span style={{color:'rgba(255,144,64,.9)',fontWeight:700,fontSize:8}}>{isPipeline?(pipelineStages.find(s=>s.id===sn)?.name||sn).substring(0,3):`S${sn}`}</span><span>{cps}/{maxC}</span><span style={{opacity:.35}}>·</span><span>{tm>0?fmtMs(tm):'—'}</span></span>);})}  {stageNums.length>1&&<span style={{display:'inline-flex',alignItems:'center',gap:2,padding:'1px 6px',borderRadius:6,background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,144,64,.25)',fontSize:9,fontFamily:'JetBrains Mono',color:'rgba(255,144,64,.9)',fontWeight:700}}>Σ {totCPs}{totT>0?` · ${fmtMs(totT)}`:''}</span>}</div>);};
  const medalColors=['#FFD60A','#C0C0C0','#CD7F32'];
  const qualRule=comp?.qualification?.[selCat]||(comp?.qualPercent>0?{enabled:true,percent:comp.qualPercent}:null);
  const qualCount=qualRule?.enabled&&ranked.length>0?Math.max(qualRule.minimum||1,Math.ceil(ranked.filter(r=>r.status!=='dsq').length*(qualRule.percent||50)/100)):null;
  const exportAll=(format='csv')=>{
    if(format==='csv'){
      const rows=[['Platz','#','Name','Team','Land','Kategorie','CPs','Zeit','Ergebnis','Reklamation']];
      catsWithRuns.forEach(c=>{
        const r=computeRanked(runList,c.id);
        if(!r.length)return;
        r.forEach((run,i)=>{
          const a=athMap[run.athleteId]||{name:run.athleteName||'?',num:'?'};
          const ergebnis=run.status==='complete'?'Buzzer':run.fellAt?.name?`Failed @ ${run.fellAt.name}`:(run.status||'DNF');
          rows.push([i+1,`"${a.num}"`,`"${a.name}"`,`"${a.team||''}"`,`"${a.country||''}"`,`"${catName(c)}"`,run.doneCP?.length||0,run.status==='complete'?fmtMs(run.finalTime):'',`"${ergebnis}"`,run.protested?'':'']);
        });
      });
      const csv=rows.map(r=>r.join(',')).join('\n');
      const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=`ninja-results-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
      SFX.complete();
    } else if(format==='print'){
      // HTML print window
      let html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ninja Competition Tool – Ergebnisse</title>
<style>body{font-family:Arial,sans-serif;padding:20px;color:#333;}h1{font-size:18px;margin-bottom:4px;}h2{font-size:15px;margin:18px 0 6px;color:#555;border-bottom:2px solid #FF5E3A;padding-bottom:4px;}
table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;}th{background:#f5f5f5;text-align:left;padding:5px 8px;font-weight:700;border-bottom:2px solid #ddd;}
td{padding:4px 8px;border-bottom:1px solid #eee;}.medal-1{background:#FFF8DC;font-weight:700;}.medal-2{background:#F5F5F5;}.medal-3{background:#FDF5ED;}
.buzzer{color:#34C759;font-weight:700;}.fall{color:#FF3B30;font-size:11px;}.protest{background:#FFFACD;}
@media print{body{padding:0;font-size:11px;}h1{font-size:14px;}h2{font-size:12px;page-break-after:avoid;}table{page-break-inside:auto;}tr{page-break-inside:avoid;}}</style></head><body>`;
      html+=`<h1>Ninja Competition Tool – ${info?.name||'Ergebnisse'}</h1><p style="font-size:11px;color:#888;">${info?.date||new Date().toLocaleDateString()} · ${info?.location||''}</p>`;
      catsWithRuns.forEach(c=>{
        const r=computeRanked(runList,c.id);if(!r.length)return;
        html+=`<h2>${catName(c)} (${r.length} Athleten)</h2><table><tr><th>#</th><th>Startnr</th><th>Name</th><th>Team</th><th>Land</th><th>CPs</th><th>Zeit</th><th>Ergebnis</th></tr>`;
        r.forEach((run,i)=>{
          const a=athMap[run.athleteId]||{name:run.athleteName||'?',num:'?'};
          const cls=i===0?'medal-1':i===1?'medal-2':i===2?'medal-3':'';
          const ergebnis=run.status==='complete'?'<span class="buzzer">Buzzer ✓</span>':run.fellAt?.name?`<span class="fall">Fall @ ${run.fellAt.name}</span>`:(run.status||'DNF');
          html+=`<tr class="${cls}${run.protested?' protest':''}"><td>${run.status==='dsq'?'DSQ':(i+1)}</td><td>${a.num}</td><td>${a.name}</td><td>${a.team||''}</td><td>${a.country||''}</td><td>${run.doneCP?.length||0}</td><td>${run.finalTime>0?fmtMs(run.finalTime):''}</td><td>${ergebnis}${run.protested?' 🚩':''}</td></tr>`;
        });
        html+=`</table>`;
      });
      html+=`</body></html>`;
      const w=window.open('','_blank');w.document.write(html);w.document.close();setTimeout(()=>w.print(),300);
      SFX.complete();
    } else {
      // Text share fallback
      const lines=['Ninja Competition Tool · Ergebnisse',new Date().toLocaleDateString(),''];
      catsWithRuns.forEach(c=>{const r=computeRanked(runList,c.id);if(!r.length)return;lines.push(`\n=== ${catName(c)} ===`);r.forEach((run,i)=>{const a=athMap[run.athleteId]||{name:run.athleteName||'?',num:'?'};const fall=run.fellAt?.name?` · Fall @ ${run.fellAt.name}`:'';lines.push(`${i+1}. #${a.num} ${a.name}  |  ${run.doneCP?.length||0} CPs  |  ${fmtMs(run.finalTime)}${fall}${run.protested?' 🚩':''}`);});});
      const text=lines.join('\n');
      if(navigator.share)navigator.share({title:'Ninja Competition Results',text});else if(navigator.clipboard){navigator.clipboard.writeText(text);alert('In Zwischenablage kopiert');}
      SFX.complete();
    }
  };
  // Auto-rotate divisions every 6 seconds
  const [autoRotateCat,setAutoRotateCat]=useState(true);
  const [catRotateIdx,setCatRotateIdx]=useState(0);
  useEffect(()=>{
    if(!autoRotateCat||catsWithRuns.length<=1)return;
    const iv=setInterval(()=>setCatRotateIdx(i=>(i+1)%catsWithRuns.length),6000);
    return()=>clearInterval(iv);
  },[autoRotateCat,catsWithRuns.length]);
  // Sync selCat with auto-rotate
  useEffect(()=>{
    if(autoRotateCat&&catsWithRuns.length>1&&catsWithRuns[catRotateIdx])setSelCat(catsWithRuns[catRotateIdx].id);
  },[catRotateIdx,autoRotateCat]);
  const stageList=isPipeline?pipelineStages.map(s=>s.id):stageNums;
  // Auto-select first stage if none selected
  useEffect(()=>{if(selStage===null&&stageList.length>0)setSelStage(multiStage?'all':stageList[0]);},[stageList.length]);
  return(
    <div style={{paddingBottom:82,overflowX:'hidden',maxWidth:'100%'}}>
      {/* Stage tabs — BIG, on top */}
      {multiStage&&(
        <div style={{display:'flex',gap:6,padding:'8px 16px',borderBottom:'1px solid var(--border)'}}>
          <button className={`chip${allStagesView?' active':''}`}
            style={{flex:1,padding:'8px 12px',fontSize:13,fontWeight:800,justifyContent:'center',...(allStagesView?{background:'rgba(255,94,58,.15)',borderColor:'rgba(255,94,58,.4)',color:'var(--cor)'}:{})}}
            onClick={()=>{setSelStage('all');SFX.hover();}}>
            {lang==='de'?'Alle Stages':'All Stages'}
          </button>
          {(isPipeline?pipelineStages:[]).map(stg=>(
            <button key={stg.id} className={`chip${selStage===stg.id?' active':''}`}
              style={{flex:1,padding:'8px 12px',fontSize:13,fontWeight:800,justifyContent:'center',...(selStage===stg.id?{background:'rgba(255,94,58,.15)',borderColor:'rgba(255,94,58,.4)',color:'var(--cor)'}:{})}}
              onClick={()=>{setSelStage(stg.id);SFX.hover();}}>
              {stg.name||stg.id}
            </button>
          ))}
          {(!isPipeline?stageNums:[]).map(n=>(
            <button key={n} className={`chip${selStage===n?' active':''}`}
              style={{flex:1,padding:'8px 12px',fontSize:13,fontWeight:800,justifyContent:'center',...(selStage===n?{background:'rgba(255,94,58,.15)',borderColor:'rgba(255,94,58,.4)',color:'var(--cor)'}:{})}}
              onClick={()=>{setSelStage(n);SFX.hover();}}>
              Stage {n}
            </button>
          ))}
          <button className={`chip${selStage==='overall'?' active':''}`}
            style={{flex:1,padding:'8px 12px',fontSize:13,fontWeight:800,justifyContent:'center',...(selStage==='overall'?{background:'rgba(255,214,10,.15)',borderColor:'rgba(255,214,10,.4)',color:'var(--gold)'}:{})}}
            onClick={()=>{setSelStage('overall');SFX.hover();}}>
            {lang==='de'?'Gesamt':'Overall'}
          </button>
        </div>
      )}
      {/* Division tabs — auto-rotating, smaller */}
      <div style={{padding:'6px 16px',display:'flex',gap:4,alignItems:'center',borderBottom:'1px solid var(--border)',background:'rgba(255,255,255,.02)'}}>
        {catsWithRuns.map((c,ci)=>(
          <button key={c.id} className={`chip${selCat===c.id?' active':''}`}
            style={{flexShrink:0,fontSize:10,padding:'2px 9px',...(selCat===c.id?{background:`${c.color}1A`,borderColor:`${c.color}55`,color:c.color}:{})}}
            onClick={()=>{setSelCat(c.id);setAutoRotateCat(false);setCatRotateIdx(ci);SFX.hover();}}>{c.name[lang]}</button>
        ))}
        {catsWithRuns.length>1&&<button className={`chip${autoRotateCat?' active':''}`} style={{fontSize:9,padding:'2px 7px',marginLeft:'auto'}} onClick={()=>setAutoRotateCat(!autoRotateCat)}>
          <I.RefreshCw s={9}/> Auto
        </button>}
      </div>
      {catsWithRuns.length===0&&<EmptyState icon={<I.FileText s={28} c="rgba(255,255,255,.3)"/>} text={t('noRuns')}/>}
      {/* ALL STAGES side-by-side view */}
      {allStagesView&&selCat&&(
        <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(stageList.length,4)},1fr)`,gap:8,padding:'8px 12px'}}>
          {stageList.map(sid=>{
            const stgRanked=isPipeline?computeRankedPipeline(runList,selCat,sid):computeRankedStage(runList,selCat,sid);
            const stgName=isPipeline?(pipelineStages.find(s=>s.id===sid)?.name||sid):`Stage ${sid}`;
            const cat=IGN_CATS.find(c=>c.id===selCat);
            return(
              <div key={sid} style={{border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',display:'flex',flexDirection:'column',maxHeight:'calc(100vh - 240px)'}}>
                <div style={{padding:'8px 10px',background:'rgba(255,94,58,.06)',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:6}}>
                  <div style={{width:22,height:22,borderRadius:6,background:'linear-gradient(135deg,var(--cor),var(--cor2))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,color:'#fff'}}>{isPipeline?(stgName||'').charAt(0).toUpperCase():sid}</div>
                  <div style={{fontSize:12,fontWeight:800}}>{stgName}</div>
                  {cat&&<div style={{fontSize:9,color:cat.color,marginLeft:'auto',fontWeight:700}}>{cat.name[lang]}</div>}
                </div>
                <AutoScrollRanking items={stgRanked} athMap={athMap} fmtMs={fmtMs} lang={lang} t={t}/>
              </div>
            );
          })}
        </div>
      )}
      {/* Single stage / overall view */}
      {!allStagesView&&selCat&&ranked.length>0&&(()=>{
        return(
          <div className="section">
            {ranked.map((r,i)=>{const a=athMap[r.athleteId]||{name:r.athleteName||'?',num:'?'};const initials=(a.name||'?')[0].toUpperCase();const isFirstNonQual=qualCount!=null&&i===qualCount;
return(<React.Fragment key={r.athleteId}>
{isFirstNonQual&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'3px 4px'}}><div style={{flex:1,height:1,background:'linear-gradient(to right,rgba(52,199,89,.5),transparent)'}}/><span style={{fontSize:9,color:'rgba(52,199,89,.8)',fontWeight:700,letterSpacing:'.1em',padding:'2px 8px',background:'rgba(52,199,89,.1)',borderRadius:8,border:'1px solid rgba(52,199,89,.25)',flexShrink:0}}>{lang==='de'?'▽ NICHT QUALIFIZIERT':'▽ NOT QUALIFIED'}</span><div style={{flex:1,height:1,background:'linear-gradient(to left,rgba(52,199,89,.5),transparent)'}}/></div>}
              <div key={r.athleteId} className="sh-card fade-up" style={{padding:'6px 10px',display:'flex',alignItems:'center',gap:8,animationDelay:`${(i+1)*.03}s`,opacity:r.status==='dsq'?.6:1}}>
                <div style={{flexShrink:0}}>{r.status==='dsq'?<div style={{width:22,height:22,borderRadius:'50%',background:'rgba(255,59,80,.12)',border:'1px solid rgba(255,59,80,.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:900,color:'#FF3B6B'}}>DSQ</div>:i<3?<MedalBadge pos={i} s={22}/>:<div style={{width:22,height:22,borderRadius:'50%',background:'rgba(255,255,255,.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'var(--muted)'}}>{i+1}</div>}</div>
                {a.photo
                  ?<img src={a.photo} style={{width:30,height:30,borderRadius:'50%',objectFit:'cover',flexShrink:0,border:'1px solid rgba(255,255,255,.1)'}}/>
                  :<div style={{width:30,height:30,borderRadius:'50%',flexShrink:0,background:'linear-gradient(135deg,rgba(255,94,58,.2),rgba(255,94,58,.06))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:'var(--cor)',border:'1px solid rgba(255,94,58,.15)'}}>{initials}</div>
                }
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',display:'flex',alignItems:'center',gap:4}}>
                    {a.name}{r.protested&&<I.Flag s={10} c="var(--gold)"/>}
                    <span style={{fontSize:9,fontFamily:'JetBrains Mono',color:'var(--muted)',marginLeft:2}}>#{a.num}</span>
                  </div>
                  <div style={{display:'flex',gap:4,alignItems:'center',marginTop:1,fontSize:9}}>
                    {isOverall?(
                      <span style={{fontFamily:'JetBrains Mono',color:'var(--muted)',display:'flex',gap:3,flexWrap:'wrap'}}>
                        {(isPipeline?stageIds:stageNums).map(sid=>{const pl=r.placements?.[sid];const sName=isPipeline?(pipelineStages.find(s=>s.id===sid)?.name||sid).substring(0,4):`S${sid}`;return pl?<span key={sid} style={{background:'rgba(255,255,255,.06)',borderRadius:4,padding:'0 4px'}}>{sName}:<span style={{color:'var(--cor)',fontWeight:700}}>P{pl}</span></span>:null;})}
                        <span style={{color:'var(--gold)',fontWeight:700}}>Σ {r.placementSum}</span>
                      </span>
                    ):(
                      <span style={{fontFamily:'JetBrains Mono',color:'var(--muted)'}}>{rCPs(r)!=null?`${rCPs(r)}/${r.totalCPs||'?'} CP`:''}</span>
                    )}
                    {a.team&&<span style={{color:'var(--cor2)',fontWeight:600}}>{a.team}</span>}
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4,flexShrink:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <div className="timer-grad" style={{fontSize:14,color:r.status==='dsq'?'#FF3B6B':(!isOverall&&r.status!=='complete'&&rTime(r)>0)?'rgba(255,255,255,.55)':undefined}}>{r.status==='dsq'?'DSQ':rTime(r)>0?fmtMs(rTime(r)):(isOverall?'—':t('dnf'))}</div>
                    {!isOverall&&<EditBtn r={r}/>}
                  </div>
                  {isOverall?null
                  :r.status==='complete'
                    ?<div className="buzzer-badge"><I.Bolt s={11} c="#FFD700"/> Buzzer</div>
                    :r.status==='dsq'
                      ?<div style={{fontSize:10,color:'#FF3B6B',fontWeight:600}}>{lang==='de'?'Disqualifiziert':'Disqualified'}</div>
                    :r.fellAt?.name
                      ?<div style={{fontSize:10,color:'var(--red)',fontWeight:600,display:'flex',alignItems:'center',gap:3,textAlign:'right'}}><I.XCircle s={10} c="var(--red)"/>{r.fellAt.name}</div>
                      :<div style={{fontSize:10,color:'var(--muted)'}}>DNF</div>
                  }
                  {!isOverall&&<LifeDots run={r} size={7}/>}
                </div>
              </div>
            </React.Fragment>);})}
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-ghost" style={{flex:1,padding:12,gap:7}} onClick={()=>exportAll('csv')}><I.Download s={15}/> CSV</button>
              <button className="btn btn-ghost" style={{flex:1,padding:12,gap:7}} onClick={()=>exportAll('print')}><I.FileText s={15}/> Print</button>
              <button className="btn btn-ghost" style={{flex:1,padding:12,gap:7}} onClick={()=>exportAll('text')}><I.Share2 s={15}/> {lang==='de'?'Teilen':'Share'}</button>
            </div>
          </div>
        );
      })()}
      {/* Edit mode unlock button */}
      <div style={{padding:'12px 16px 4px',display:'flex',justifyContent:'center'}}>
        <button style={{padding:'7px 16px',borderRadius:20,border:`1px solid ${editMode?'rgba(255,200,80,.4)':'rgba(255,255,255,.1)'}`,background:editMode?'rgba(255,200,80,.08)':'rgba(255,255,255,.03)',color:editMode?'var(--gold)':'rgba(255,255,255,.3)',cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontSize:11,fontWeight:700,fontFamily:'Inter,sans-serif'}} onClick={()=>editMode?setEditMode(false):setShowPwModal(true)}>
          {editMode?<I.Unlock s={13} c="var(--gold)"/>:<I.Lock s={13} c="rgba(255,255,255,.3)"/>}
          {editMode?(lang==='de'?'Bearbeitungsmodus aktiv — Beenden':'Edit mode active — Exit'):(lang==='de'?'Ergebnisse korrigieren':'Correct results')}
        </button>
      </div>
      {showPwModal&&(
        <div className="modal-overlay" onClick={()=>{setShowPwModal(false);setPwInput('');setPwError(false);}}>
          <div className="modal-sheet" style={{maxWidth:300}} onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:'center',marginBottom:16}}>
              <div style={{display:'flex',justifyContent:'center',marginBottom:8}}><div style={{width:48,height:48,borderRadius:'50%',background:'rgba(255,200,80,.1)',border:'2px solid rgba(255,200,80,.25)',display:'flex',alignItems:'center',justifyContent:'center'}}><I.Lock s={22} c="var(--gold)"/></div></div>
              <div style={{fontSize:17,fontWeight:900}}>{lang==='de'?'Bearbeitungsmodus':'Edit Mode'}</div>
              <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>{lang==='de'?'Passwort eingeben um Ergebnisse zu korrigieren':'Enter password to correct results'}</div>
            </div>
            <input type="password" autoFocus value={pwInput} onChange={e=>{setPwInput(e.target.value);setPwError(false);}} onKeyDown={e=>e.key==='Enter'&&handlePwSubmit()} placeholder="••••" style={{width:'100%',textAlign:'center',fontSize:24,letterSpacing:10,padding:'10px 14px',borderRadius:12,border:`1.5px solid ${pwError?'var(--red)':'rgba(255,255,255,.15)'}`,background:'rgba(255,255,255,.06)',color:'#fff',outline:'none',boxSizing:'border-box',marginBottom:pwError?6:12}}/>
            {pwError&&<div style={{color:'var(--red)',fontSize:12,textAlign:'center',marginBottom:10,fontWeight:600}}>{lang==='de'?'Falsches Passwort':'Wrong password'}</div>}
            <button className="btn btn-coral" style={{width:'100%',padding:13,gap:8}} onClick={handlePwSubmit}><I.Unlock s={14}/> {lang==='de'?'Freischalten':'Unlock'}</button>
          </div>
        </div>
      )}
      {editRun&&<EditRunModal run={editRun.run} runKey={editRun.key} compId={compId} onClose={()=>setEditRun(null)}/>}
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// ATHLETE QUEUE VIEW – public display: wer kommt als nächstes?
// ════════════════════════════════════════════════════════════
// Per-stage auto-scrolling list

export { ResultsView, Regelwerk, EditRunModal };
