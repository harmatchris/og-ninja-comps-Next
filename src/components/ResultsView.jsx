import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLang, REGELWERK_DE, REGELWERK_EN } from '../i18n.js';
import { IGN_CATS, fbSet, fbUpdate, fbRemove, db } from '../config.js';
import { uid, fmtMs, computeRanked, computeRankedStage, computeRankedMultiStage, toFlag } from '../utils.js';
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
          <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontSize:14,opacity:.5}}>🔍</span>
          {query&&<button onClick={()=>setQuery('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:16,opacity:.5,color:'var(--text)',padding:'0 2px'}}>✕</button>}
        </div>
        {q&&<div style={{marginTop:8,display:'flex',gap:6,alignItems:'center'}}>
          <span className="rw-match-badge">🔍 {totalMatches} {lang==='de'?'Treffer':'matches'} · {visible.length} {lang==='de'?'Kapitel':'chapters'}</span>
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
  const catsWithRuns=IGN_CATS.filter(c=>runList.some(r=>r.catId===c.id));
  useEffect(()=>{if(!selCat&&catsWithRuns.length>0)setSelCat(catsWithRuns[0].id);},[catsWithRuns.length]);
  const getRunKey=(r)=>r._fbKey||Object.entries(runs||{}).find(([,v])=>v.timestamp!=null&&v.timestamp===r.timestamp&&v.athleteId===r.athleteId)?.[0];
  const openEdit=(r)=>{if(!editMode)return;const key=getRunKey(r);if(key)setEditRun({key,run:r});};
  const handlePwSubmit=()=>{if(pwInput==='2021'){setEditMode(true);setShowPwModal(false);setPwInput('');setPwError(false);SFX.complete();}else{setPwError(true);SFX.fall();}};
  const EditBtn=({r})=>editMode?<button style={{padding:'4px 8px',borderRadius:7,border:'1px solid rgba(255,200,80,.35)',background:'rgba(255,200,80,.08)',color:'var(--gold)',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',gap:4,fontSize:11,fontWeight:700,fontFamily:'Inter,sans-serif'}} onClick={e=>{e.stopPropagation();openEdit(r);}}><I.Edit s={12} c="var(--gold)"/></button>:null;
  // Reset stage selection when category changes
  useEffect(()=>{setSelStage(null);},[selCat]);
  // Stage numbers that have runs for the selected category
  const stageNums=selCat?[...new Set(runList.filter(r=>r.catId===selCat&&r.stNum!=null).map(r=>r.stNum))].sort((a,b)=>a-b):[];
  const multiStage=stageNums.length>1;
  const isMultiOverall=multiStage&&selStage===null;
  const ranked=selCat?(selStage!=null?computeRankedStage(runList,selCat,selStage):isMultiOverall?computeRankedMultiStage(runList,selCat,stageNums):computeRanked(runList,selCat)):[];
  const rCPs=r=>isMultiOverall?r.totalCPs:(r.doneCP?.length||0);
  const rTime=r=>isMultiOverall?r.totalTime:(r.finalTime||0);
  const rMaxCPs=r=>{if(isMultiOverall){const tot=stageNums.reduce((s,sn)=>{const bd=r.stageBreakdown?.[String(sn)];return s+(bd?.totalCPs||0);},0);return tot||r.totalCPs||1;}return Math.max(r.totalCPs||0,r.doneCP?.length||0)||1;};
  const StageBreakdown=({r,compact=false})=>{if(!isMultiOverall||!r.stageBreakdown)return null;const totCPs=rCPs(r),totT=rTime(r);return(<div style={{marginTop:compact?3:6,display:'flex',flexWrap:'wrap',gap:3,alignItems:'center'}}>{stageNums.map(sn=>{const bd=r.stageBreakdown[String(sn)];const cps=bd?.doneCP?.length||0;const maxC=bd?.totalCPs||'?';const tm=bd?.finalTime||0;return(<span key={sn} style={{display:'inline-flex',alignItems:'center',gap:2,padding:'1px 5px',borderRadius:6,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.08)',fontSize:9,fontFamily:'JetBrains Mono',color:'rgba(255,255,255,.5)'}}><span style={{color:'rgba(255,144,64,.9)',fontWeight:700,fontSize:8}}>S{sn}</span><span>{cps}/{maxC}</span><span style={{opacity:.35}}>·</span><span>{tm>0?fmtMs(tm):'—'}</span></span>);})}  {stageNums.length>1&&<span style={{display:'inline-flex',alignItems:'center',gap:2,padding:'1px 6px',borderRadius:6,background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,144,64,.25)',fontSize:9,fontFamily:'JetBrains Mono',color:'rgba(255,144,64,.9)',fontWeight:700}}>Σ {totCPs}{totT>0?` · ${fmtMs(totT)}`:''}</span>}</div>);};
  const medalColors=['#FFD60A','#C0C0C0','#CD7F32'];
  const comp=useFbVal(`ogn/${compId}/info`);
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
          rows.push([i+1,`"${a.num}"`,`"${a.name}"`,`"${a.team||''}"`,`"${a.country||''}"`,`"${catName(c)}"`,run.doneCP?.length||0,run.status==='complete'?fmtMs(run.finalTime):'',`"${ergebnis}"`,run.protested?'🚩':'']);
        });
      });
      const csv=rows.map(r=>r.join(',')).join('\n');
      const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=`ninja-results-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
      SFX.complete();
    } else {
      // Text share fallback
      const lines=['OG Ninja Comp · Ergebnisse',new Date().toLocaleDateString(),''];
      catsWithRuns.forEach(c=>{const r=computeRanked(runList,c.id);if(!r.length)return;lines.push(`\n=== ${catName(c)} ===`);r.forEach((run,i)=>{const a=athMap[run.athleteId]||{name:run.athleteName||'?',num:'?'};lines.push(`${i+1}. #${a.num} ${a.name}  |  ${run.doneCP?.length||0} CPs  |  ${fmtMs(run.finalTime)}${run.protested?' 🚩':''}`);});});
      const text=lines.join('\n');
      if(navigator.share)navigator.share({title:'OG Ninja Results',text});else if(navigator.clipboard){navigator.clipboard.writeText(text);alert('📋 In Zwischenablage kopiert');}
      SFX.complete();
    }
  };
  return(
    <div style={{paddingBottom:82,overflowX:'hidden',maxWidth:'100%'}}>
      <div style={{overflowX:'auto',padding:'12px 16px',display:'flex',gap:6,borderBottom:'1px solid var(--border)'}}>
        {catsWithRuns.map(c=>(
          <button key={c.id} className={`chip${selCat===c.id?' active':''}`}
            style={{flexShrink:0,fontSize:11,...(selCat===c.id?{background:`${c.color}1A`,borderColor:`${c.color}55`,color:c.color}:{})}}
            onClick={()=>{setSelCat(c.id);SFX.hover();}}>{c.name[lang]}</button>
        ))}
      </div>
      {/* Stage selector — only shown when multiple stages have runs */}
      {multiStage&&(
        <div style={{overflowX:'auto',padding:'8px 16px',display:'flex',gap:6,borderBottom:'1px solid var(--border)',background:'rgba(255,255,255,.02)'}}>
          <button className={`chip${selStage===null?' active':''}`} style={{flexShrink:0,fontSize:11,padding:'3px 12px'}}
            onClick={()=>{setSelStage(null);SFX.hover();}}>
            {lang==='de'?'Gesamt':'Overall'}
          </button>
          {stageNums.map(n=>(
            <button key={n} className={`chip${selStage===n?' active':''}`}
              style={{flexShrink:0,fontSize:11,padding:'3px 12px',...(selStage===n?{background:'rgba(255,94,58,.15)',borderColor:'rgba(255,94,58,.4)',color:'var(--cor)'}:{})}}
              onClick={()=>{setSelStage(n);SFX.hover();}}>
              Stage {n}
            </button>
          ))}
        </div>
      )}
      {catsWithRuns.length===0&&<EmptyState icon={<I.FileText s={28} c="rgba(255,255,255,.3)"/>} text={t('noRuns')}/>}
      {selCat&&ranked.length>0&&(()=>{
        return(
          <div className="section">
            {ranked[0]&&(()=>{const a=athMap[ranked[0].athleteId]||{name:ranked[0].athleteName||'?',num:'?'};return(
              <div className="winner-card">
                <div style={{fontSize:10,color:'var(--cor)',letterSpacing:'.12em',textTransform:'uppercase',marginBottom:10,fontWeight:600,display:'flex',alignItems:'center',gap:5,justifyContent:'space-between'}}><span style={{display:'flex',alignItems:'center',gap:5}}><I.Trophy s={11} c="var(--cor)"/> {lang==='de'?'Platz 1':'Top Ranked'}{selStage!=null?` · Stage ${selStage}`:multiStage?` · ${lang==='de'?'Gesamt':'Overall'}`:''}</span><EditBtn r={ranked[0]}/></div>
                <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:10}}>
                  {a.photo?<img src={a.photo} style={{width:52,height:52,borderRadius:'50%',objectFit:'cover',border:'2px solid rgba(255,215,10,.4)',flexShrink:0}}/>:null}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:24,fontWeight:800,letterSpacing:'-.5px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}{ranked[0].protested&&<span style={{marginLeft:8}}><I.Flag s={13} c="var(--gold)"/></span>}</div>
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>#{a.num}{!isMultiOverall&&ranked[0].stNum&&<span style={{marginLeft:6,color:'var(--cor)',fontWeight:700,background:'rgba(255,94,58,.1)',borderRadius:5,padding:'1px 6px',fontSize:10}}>S{ranked[0].stNum}</span>}{a.team&&<span style={{marginLeft:6,color:'var(--cor2)',fontWeight:600}}>{a.team}</span>}{a.country&&<span style={{marginLeft:6}}>{toFlag(a.country)} {a.country}</span>}</div>
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10,marginTop:6,flexWrap:'wrap'}}>
                  <div className="timer-grad" style={{fontSize:26,color:ranked[0].status==='dsq'?'#FF3B6B':ranked[0].status!=='complete'&&rTime(ranked[0])>0?'rgba(255,255,255,.65)':undefined,flexShrink:0}}>{ranked[0].status==='dsq'?'DSQ':rTime(ranked[0])>0?fmtMs(rTime(ranked[0])):'—'}</div>
                  {ranked[0].status==='complete'&&<div className="buzzer-badge" style={{flexShrink:0}}><I.Bolt s={11} c="#FFD700"/> Buzzer</div>}
                  {ranked[0].corrected&&<div style={{fontSize:9,padding:'2px 6px',borderRadius:5,background:'rgba(255,200,80,.12)',color:'var(--gold)',border:'1px solid rgba(255,200,80,.25)',fontWeight:700,letterSpacing:'.04em',flexShrink:0}}>KORRIGIERT</div>}
                  <LifeDots run={ranked[0]} size={9}/>
                </div>
                <div style={{marginTop:8,display:'flex',alignItems:'center',gap:8}}>
                  <div style={{flex:1,height:5,background:'rgba(255,255,255,.1)',borderRadius:3,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${(()=>{const done=rCPs(ranked[0]);const tot=rMaxCPs(ranked[0]);return(done/tot)*100;})()}%`,background:ranked[0].status==='complete'?'var(--green)':'var(--cor)',borderRadius:3}}/>
                  </div>
                  <span style={{fontSize:11,color:'var(--muted)',fontFamily:'JetBrains Mono',flexShrink:0}}>{rCPs(ranked[0])}{isMultiOverall?`/${rMaxCPs(ranked[0])}`:(ranked[0].totalCPs?`/${ranked[0].totalCPs}`:'')} CPs</span>
                </div>
                <StageBreakdown r={ranked[0]}/>
                {!isMultiOverall&&ranked[0].status!=='complete'&&ranked[0].status!=='dsq'&&(ranked[0].fellAt?.name
                  ?<div style={{fontSize:12,color:'var(--red)',marginTop:4,fontWeight:600,display:'flex',alignItems:'center',gap:5}}><I.XCircle s={13} c="var(--red)"/> Failed @ {ranked[0].fellAt.name}</div>
                  :null
                )}
              </div>
            );})()}
            {ranked.slice(1).map((r,i)=>{const a=athMap[r.athleteId]||{name:r.athleteName||'?',num:'?'};const initials=(a.name||'?')[0].toUpperCase();const isFirstNonQual=qualCount!=null&&(i+1)===qualCount;
return(<React.Fragment key={r.athleteId}>
{isFirstNonQual&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'3px 4px'}}><div style={{flex:1,height:1,background:'linear-gradient(to right,rgba(52,199,89,.5),transparent)'}}/><span style={{fontSize:9,color:'rgba(52,199,89,.8)',fontWeight:700,letterSpacing:'.1em',padding:'2px 8px',background:'rgba(52,199,89,.1)',borderRadius:8,border:'1px solid rgba(52,199,89,.25)',flexShrink:0}}>{lang==='de'?'▽ NICHT QUALIFIZIERT':'▽ NOT QUALIFIED'}</span><div style={{flex:1,height:1,background:'linear-gradient(to left,rgba(52,199,89,.5),transparent)'}}/></div>}
              <div key={r.athleteId} className="sh-card fade-up" style={{padding:'11px 14px',display:'flex',alignItems:'center',gap:10,animationDelay:`${(i+1)*.04}s`,opacity:r.status==='dsq'?.6:1}}>
                <div style={{flexShrink:0}}>{r.status==='dsq'?<div style={{width:26,height:26,borderRadius:'50%',background:'rgba(255,59,80,.12)',border:'1px solid rgba(255,59,80,.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,color:'#FF3B6B',letterSpacing:'.02em'}}>DSQ</div>:i<2?<MedalBadge pos={i+1} s={26}/>:<div style={{width:26,height:26,borderRadius:'50%',background:'rgba(255,255,255,.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:'var(--muted)'}}>{i+2}</div>}</div>
                {a.photo
                  ?<img src={a.photo} style={{width:38,height:38,borderRadius:'50%',objectFit:'cover',flexShrink:0,border:'1.5px solid rgba(255,255,255,.12)'}}/>
                  :<div style={{width:38,height:38,borderRadius:'50%',flexShrink:0,background:'linear-gradient(135deg,rgba(255,94,58,.22),rgba(255,94,58,.08))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color:'var(--cor)',border:'1.5px solid rgba(255,94,58,.18)'}}>{initials}</div>
                }
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',display:'flex',alignItems:'center',gap:5}}>
                    {a.name}{r.protested&&<I.Flag s={11} c="var(--gold)"/>}
                  </div>
                  <div style={{display:'flex',gap:5,alignItems:'center',marginTop:2,flexWrap:'wrap'}}>
                    <span style={{fontSize:10,fontFamily:'JetBrains Mono',color:'var(--muted)'}}>#{a.num}</span>
                    {!isMultiOverall&&r.stNum&&<span style={{fontSize:9,color:'var(--cor)',fontWeight:700,background:'rgba(255,94,58,.1)',borderRadius:5,padding:'1px 5px',letterSpacing:'.03em'}}>S{r.stNum}</span>}
                    {a.team&&<span style={{fontSize:10,color:'var(--cor2)',fontWeight:700,background:'rgba(255,144,64,.13)',borderRadius:5,padding:'1px 5px'}}>{a.team}</span>}
                    {a.country&&<span style={{fontSize:10,color:'var(--muted)'}}>{toFlag(a.country)} {a.country}</span>}
                  </div>
                  <div style={{marginTop:5,display:'flex',alignItems:'center',gap:5}}>
                    <div style={{flex:1,height:3,background:'rgba(255,255,255,.08)',borderRadius:2,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${(()=>{const done=rCPs(r);const tot=rMaxCPs(r);return(done/tot)*100;})()}%`,background:r.status==='complete'?'var(--green)':'var(--cor)',borderRadius:2}}/>
                    </div>
                    <span style={{fontSize:9,color:'var(--muted)',fontFamily:'JetBrains Mono',flexShrink:0}}>{rCPs(r)}{isMultiOverall?`/${rMaxCPs(r)}`:(r.totalCPs?`/${r.totalCPs}`:'')}</span>
                  </div>
                  <StageBreakdown r={r} compact={true}/>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4,flexShrink:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <div className="timer-grad" style={{fontSize:14,color:r.status==='dsq'?'#FF3B6B':r.status!=='complete'&&rTime(r)>0?'rgba(255,255,255,.55)':undefined}}>{r.status==='dsq'?'DSQ':rTime(r)>0?fmtMs(rTime(r)):t('dnf')}</div>
                    <EditBtn r={r}/>
                  </div>
                  {r.status==='complete'
                    ?<div className="buzzer-badge"><I.Bolt s={11} c="#FFD700"/> Buzzer</div>
                    :r.status==='dsq'
                      ?<div style={{fontSize:10,color:'#FF3B6B',fontWeight:600}}>{lang==='de'?'Disqualifiziert':'Disqualified'}</div>
                    :!isMultiOverall&&r.fellAt?.name
                      ?<div style={{fontSize:10,color:'var(--red)',fontWeight:600,display:'flex',alignItems:'center',gap:3,maxWidth:90,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}><I.XCircle s={10} c="var(--red)"/>{r.fellAt.name}</div>
                      :!isMultiOverall?<div style={{fontSize:10,color:'var(--muted)'}}>DNF</div>:null
                  }
                  <LifeDots run={r} size={7}/>
                </div>
              </div>
            </React.Fragment>);})}
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-ghost" style={{flex:1,padding:12,gap:7}} onClick={()=>exportAll('csv')}><I.Download s={15}/> CSV</button>
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
