import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '../i18n.js';
import { IGN_CATS, db, fbSet, fbUpdate, fbRemove } from '../config.js';
import { uid, fmtMs, toFlag, computeRanked, computeRankedStage, computeRankedMultiStage } from '../utils.js';
import { useFbVal, useTimer, SFX, BLE } from '../hooks.js';
import { I } from '../icons.jsx';
import { Spinner, EmptyState, MedalBadge, LifeDots, TopBar, DragList } from './shared.jsx';
import { ResultsView, Regelwerk } from './ResultsView.jsx';
import { AthleteQueueView } from './QueueView.jsx';
import { StatsView } from './StatsView.jsx';
import { SkillPhaseView } from './SkillPhaseView.jsx';

const obsShortName=name=>{
  const n=(name||'').toLowerCase();
  if(/startplattform/.test(n))return '▶ Start';
  if(/landeplattform/.test(n))return '⬛ Land';
  if(/endplattform/.test(n))return '⬛ End';
  return name;
};
// React component — renders icon version for CP pills
const ObsLabel=({obs,size=10})=>{
  const n=(obs.name||'').toLowerCase();
  const isStart=/startplattform/.test(n);
  const isLand=/landeplattform|endplattform/.test(n);
  if(isStart)return<span style={{display:'inline-flex',alignItems:'center',gap:3}}><I.Play s={size} c="rgba(160,160,255,.9)"/><span>Start</span></span>;
  if(isLand)return<span style={{display:'inline-flex',alignItems:'center',gap:3}}><I.Flag s={size} c="rgba(52,199,89,.9)"/><span>Land</span></span>;
  return<span>{obs.name}</span>;
};

// ════════════════════════════════════════════════════════════
// JURY — WAIT

const JuryWait=({cat,queue,obstacles,onStart,compId,totalAthletes,doneCount,onForceReset,onDsq})=>{
  const {t,catName,lang}=useLang();
  const obstArr=obstacles?Object.values(obstacles).sort((a,b)=>a.order-b.order):[];
  const cpObst=obstArr.filter(o=>o.isCP);
  const [localQ,setLocalQ]=useState(null);
  const effectiveQ=localQ||queue;
  const reorderQ=arr=>{
    setLocalQ(arr);
    // persist order to firebase
    const updates={};arr.forEach((a,i)=>{updates[`ogn/${compId}/athletes/${a.id}/queueOrder`]=i;});
    if(Object.keys(updates).length)db.ref().update(updates);
  };
  const shuffleQ=()=>{
    const arr=[...effectiveQ];
    for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
    reorderQ(arr);SFX.click();
  };
  const next=effectiveQ[0];
  return(
    <div style={{display:'flex',flexDirection:'column',gap:0}}>
      {cat&&<div style={{padding:'14px 16px 0',display:'flex',justifyContent:'center'}}><div className="live-badge"><div className="live-dot"/>{catName(cat)}</div></div>}
      {!next&&(
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,padding:'36px 24px 24px'}}>
          <div style={{width:52,height:52,borderRadius:'50%',background:'rgba(52,199,89,.1)',border:'2px solid rgba(52,199,89,.25)',display:'flex',alignItems:'center',justifyContent:'center'}}><I.CheckCircle s={26} c="var(--green)"/></div>
          <div style={{fontSize:17,fontWeight:800,color:'var(--green)'}}>{t('allDone')}</div>
          {totalAthletes>0&&<div style={{fontSize:13,color:'var(--muted)',textAlign:'center'}}>{doneCount} / {totalAthletes} {lang==='de'?'Athleten absolviert':'athletes completed'}</div>}
          {doneCount>0&&totalAthletes>0&&doneCount<totalAthletes&&(
            <div style={{background:'rgba(255,200,80,.08)',border:'1px solid rgba(255,200,80,.25)',borderRadius:12,padding:'12px 16px',width:'100%',maxWidth:320}}>
              <div style={{fontSize:12,color:'rgba(255,200,80,.8)',fontWeight:700,marginBottom:6}}>{lang==='de'?'⚠ Nur teilweise absolviert':'⚠ Partially completed'}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,.4)',marginBottom:10,lineHeight:1.4}}>{lang==='de'?`${totalAthletes-doneCount} Athleten fehlen noch. Evt. sind Läufe einer anderen Stage diesem Athlet zugeordnet.`:`${totalAthletes-doneCount} athletes missing. Some runs may be attributed to another stage.`}</div>
              {onForceReset&&<button className="btn" style={{width:'100%',padding:'8px',fontSize:12,gap:6,background:'rgba(255,200,80,.1)',border:'1px solid rgba(255,200,80,.25)',color:'rgba(255,200,80,.8)'}} onClick={onForceReset}><I.RefreshCw s={13}/> {lang==='de'?'Stage zurücksetzen':'Reset stage'}</button>}
            </div>
          )}
          {doneCount>0&&doneCount>=totalAthletes&&onForceReset&&(
            <button className="btn" style={{padding:'8px 14px',fontSize:12,gap:6,opacity:.5}} onClick={onForceReset}><I.RefreshCw s={13}/> {lang==='de'?'Stage zurücksetzen':'Reset stage'}</button>
          )}
        </div>
      )}
      {next&&(
        <div className="section" style={{gap:10}}>
          {/* Next athlete hero card */}
          <div className="sh-card fade-up" style={{padding:20,position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 110%,rgba(255,94,58,.06) 0%,transparent 65%)',pointerEvents:'none'}}/>
            <div className="lbl" style={{marginBottom:10}}>{t('nextAthlete')}</div>
            <div style={{fontSize:26,fontWeight:900,letterSpacing:'-.6px',marginBottom:4}}>{next.country&&<span style={{marginRight:6}}>{toFlag(next.country)}</span>}{next.name}</div>
            <div style={{fontSize:13,color:'var(--muted)',fontFamily:'JetBrains Mono',marginBottom:14}}>#{next.num}{next.team&&<span style={{marginLeft:8,color:'var(--cor2)',fontWeight:600,fontFamily:'Inter,sans-serif',fontSize:12}}>{next.team}</span>}</div>
            {/* CP obstacle name pills */}
            <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
              {cpObst.map(o=><div key={o.id} className="cp-pill future"><ObsLabel obs={o} size={9}/></div>)}
            </div>
            <div style={{fontSize:11,color:'var(--muted)'}}>{cpObst.length} Checkpoints · {obstArr.length} Hindernisse</div>
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button className="btn btn-coral" style={{flex:1,padding:18,fontSize:18,gap:10,minHeight:56,borderRadius:14}} onClick={()=>{SFX.click();onStart(next);}}>
                <I.Play s={16}/> {t('startCountdown')}
              </button>
              {onDsq&&<button className="btn" style={{padding:'10px 14px',fontSize:13,gap:6,background:'rgba(255,59,80,.1)',border:'1px solid rgba(255,59,80,.35)',color:'#FF3B6B',flexShrink:0}} onClick={()=>{if(window.confirm(`${next.name} als DSQ markieren?`))onDsq(next);}}>
                <I.XCircle s={14} c="#FF3B6B"/> DSQ
              </button>}
            </div>
          </div>
          {/* Queue drag-reorder — ALL positions including #1 */}
          {effectiveQ.length>1&&(
            <div style={{paddingBottom:84}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div className="lbl">Startreihenfolge</div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <button className="btn btn-ghost" style={{padding:'4px 10px',fontSize:11,gap:5,borderRadius:10}} onClick={shuffleQ} title="Zufällige Reihenfolge"><span style={{fontSize:10}}>Mischen</span></button>
                  <div style={{fontSize:10,color:'var(--muted)'}}>{t('sortHint')}</div>
                </div>
              </div>
              <DragList items={effectiveQ} onReorder={arr=>reorderQ(arr)} keyFn={a=>a.id}
                renderItem={(a,i)=>(
                  <div style={{padding:'9px 12px',display:'flex',alignItems:'center',gap:8,background:i===0?'rgba(52,199,89,.04)':'transparent',borderRadius:i===0?10:0}}>
                    <div className="drag-handle"><I.Drag s={15}/></div>
                    <div style={{fontSize:11,color:i===0?'var(--green)':'var(--cor)',minWidth:20,fontWeight:800,fontFamily:'JetBrains Mono'}}>{i+1}</div>
                    <div style={{flex:1,fontSize:13,fontWeight:600}}>{a.name}</div>
                    {i===0&&<div style={{fontSize:9,padding:'2px 7px',borderRadius:6,background:'rgba(52,199,89,.15)',color:'var(--green)',fontWeight:800,border:'1px solid rgba(52,199,89,.3)',letterSpacing:'.05em'}}>NEXT</div>}
                    <div style={{fontSize:11,color:'var(--muted)',fontFamily:'JetBrains Mono'}}>#{a.num}</div>
                    {onDsq&&<button style={{fontSize:10,padding:'2px 8px',borderRadius:6,border:'1px solid rgba(255,59,80,.3)',background:'rgba(255,59,80,.08)',color:'#FF3B6B',cursor:'pointer',fontWeight:700,fontFamily:'Inter,sans-serif',flexShrink:0}} onClick={e=>{e.stopPropagation();if(window.confirm(`${a.name} als DSQ markieren?`))onDsq(a);}}>DSQ</button>}
                  </div>
                )}/>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// JURY — COUNTDOWN
// ════════════════════════════════════════════════════════════

const JuryCountdown=({onGo})=>{
  const {lang}=useLang();
  const [count,setCount]=useState(3);const [go,setGo]=useState(false);
  useEffect(()=>{
    // countdown(cb) now calls cb(goTime) exactly when GO tone fires at 3s
    SFX.countdown(goTime=>{setGo(true);onGo(goTime);});
    // Tick display at 1-second intervals matching the beeps
    const t1=setTimeout(()=>setCount(2),1000),
          t2=setTimeout(()=>setCount(1),2000),
          t3=setTimeout(()=>setCount(0),3000);
    return()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);};
  },[]);
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(11,11,20,.97)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:18,zIndex:200}}>
      <div key={go?'go':count} className="timer-grad" style={{fontSize:go?100:172,letterSpacing:'-6px',animation:'scaleIn .3s cubic-bezier(.16,1,.3,1)',lineHeight:1}}>
        {go||count===0?'GO!':(count)}
      </div>
      <div style={{fontSize:16,color:'rgba(255,255,255,.8)',letterSpacing:'.18em',textTransform:'uppercase',fontWeight:700}}>
        {go?<><I.Bolt s={18} c="#fff"/> {lang==='de'?'LOS!':'GO!'}</>:(lang==='de'?'Bereit machen…':'Get ready…')}
      </div>
      {!go&&(
        <div style={{display:'flex',gap:10,marginTop:6}}>
          {[3,2,1].map(n=>(
            <div key={n} style={{width:10,height:10,borderRadius:'50%',
              background:count<=n?'var(--cor)':'rgba(255,255,255,.15)',
              boxShadow:count<=n?'0 0 8px var(--cor)':'none',
              transition:'all .3s'}}/>
          ))}
        </div>
      )}
      {go&&<div className="live-dot" style={{marginTop:4,width:14,height:14}}/>}
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// JURY — ACTIVE RUN
// ════════════════════════════════════════════════════════════

const JuryActive=({compId,stNum,activeRunKey,athlete,obstacles,info,lives,totalLivesLeft,activeFalls,startPerf:startPerfProp,frozenAt,onFall,onComplete,onStop,onRefillLives})=>{
  const {lang}=useLang();
  const obstArr=obstacles?Object.values(obstacles).sort((a,b)=>a.order-b.order):[];
  const cpObst=obstArr.filter(o=>o.isCP);
  const [doneCP,setDoneCP]=useState([]);
  const [restSecs,setRestSecs]=useState(0);
  const [restActive,setRestActive]=useState(false);
  const restIntervalRef=useRef(null);
  const doneCPRef=useRef([]);
  const livesRef=useRef(lives);
  useEffect(()=>{livesRef.current=lives;},[lives]);
  // startPerf comes from JuryApp — captured at the exact moment GO tone fired
  const [startPerf]=useState(()=>startPerfProp!=null?startPerfProp:performance.now());
  const [startEpoch]=useState(()=>Date.now());
  // Split time display after each CP
  const [lastSplit,setLastSplit]=useState(null);
  const [showSplit,setShowSplit]=useState(false);
  const splitTimerRef=useRef();
  // Protest / complaint flag
  const [protested,setProtested]=useState(false);
  useEffect(()=>{return()=>{if(splitTimerRef.current)clearTimeout(splitTimerRef.current);};},[]);
  const elRaw=useTimer(frozenAt==null,startPerf);
  const el=frozenAt!=null?frozenAt:elRaw;
  const [flash,setFlash]=useState(false);
  const hasLives=info.mode==='lives';
  // Per-stage time limit overrides the global default
  const effectiveLimit=info.stageLimits?.[stNum]!=null?info.stageLimits[stNum]:(info.timeLimit||0);
  const timeLimitMs=effectiveLimit*1000;
  const remaining=timeLimitMs>0?Math.max(0,timeLimitMs-el):null;
  const timeCritical=remaining!==null&&remaining<15000;

  useEffect(()=>{
    fbSet(`ogn/${compId}/activeRuns/${activeRunKey}`,{athleteId:athlete.id,athleteName:athlete.name,startEpoch,catId:athlete.cat||null,doneCP:[],livesLeft:lives});
    return()=>fbRemove(`ogn/${compId}/activeRuns/${activeRunKey}`);
  },[]);
  useEffect(()=>{if(doneCP.length>0)fbUpdate(`ogn/${compId}/activeRuns/${activeRunKey}`,{doneCP,livesLeft:lives});},[doneCP,lives]);

  // Auto-stop when time limit expires
  useEffect(()=>{
    if(!timeLimitMs)return;
    const t=setTimeout(()=>{
      const dc=doneCPRef.current;
      const lct=dc.length>0?dc[dc.length-1].time:timeLimitMs;
      onStop({doneCP:dc,time:lct,currentTime:timeLimitMs,lives:livesRef.current,reason:'timeout'});
    },timeLimitMs);
    return()=>clearTimeout(t);
  },[]);

  const nextIdx=doneCP.length,nextCp=cpObst[nextIdx],allDone=doneCP.length>=cpObst.length;

  const longPressRef=useRef(null);
  const undoCP=()=>{
    if(doneCP.length===0)return;
    const nd=doneCP.slice(0,-1);
    doneCPRef.current=nd;setDoneCP(nd);
    if(navigator.vibrate)navigator.vibrate([100,50,100]);
    SFX.fall();
  };
  useEffect(()=>{
    if(!BLE.isConnected(stNum))return;
    const buzzerStop=()=>{
      const t=Math.round(performance.now()-startPerf);
      SFX.complete();vib(200);
      onComplete({doneCP:doneCPRef.current,finalTime:t,lives,protested:false});
    };
    BLE.onPress(stNum,buzzerStop);
    return()=>BLE.onPress(stNum,null);
  },[stNum,startPerf,lives]);
  const handleCP=()=>{
    if(allDone)return;
    SFX.checkpoint();if(navigator.vibrate)navigator.vibrate(50);setFlash(true);setTimeout(()=>setFlash(false),320);
    const t=Math.round(performance.now()-startPerf);
    const nd=[...doneCP,{obsId:nextCp.id,name:nextCp.name,time:t}];
    doneCPRef.current=nd;setDoneCP(nd);
    // Show split time for 3.5s
    setLastSplit({name:nextCp.name,time:t,idx:nd.length,total:cpObst.length});
    setShowSplit(true);
    if(splitTimerRef.current)clearTimeout(splitTimerRef.current);
    splitTimerRef.current=setTimeout(()=>setShowSplit(false),3500);
    if(nd.length>=cpObst.length)setTimeout(()=>onComplete({doneCP:nd,finalTime:nd[nd.length-1].time,lives,protested}),400);
    else if(onRefillLives&&nextCp.type==='section'){onRefillLives(nextCp.lives);if(nextCp.restTime>0){clearInterval(restIntervalRef.current);setRestSecs(nextCp.restTime);setRestActive(true);let s=nextCp.restTime;restIntervalRef.current=setInterval(()=>{s--;setRestSecs(s);if(s<=0){clearInterval(restIntervalRef.current);setRestActive(false);}},1000);}} // section marker: refill lives
  };
  const handleFall=()=>{
    SFX.fall();
    const elapsed=Math.round(performance.now()-startPerf);
    const lct=doneCP.length>0?doneCP[doneCP.length-1].time:elapsed;
    onFall({doneCP,time:lct,currentTime:elapsed,lives,pendingFallIdx:nextIdx,protested});
  };
  const handleStop=()=>{
    SFX.fall();
    const elapsed=Math.round(performance.now()-startPerf);
    const lct=doneCP.length>0?doneCP[doneCP.length-1].time:elapsed;
    onStop({doneCP,time:lct,currentTime:elapsed,lives,reason:'stopped',protested});
  };

  return(
    <div style={{display:'flex',flexDirection:'column',minHeight:'calc(100vh - 56px)',paddingBottom:16}}>
      {BLE.isConnected(stNum)&&<div style={{padding:'4px 16px',display:'flex',alignItems:'center',gap:6,fontSize:11,color:'#4CAF50'}}><span style={{width:8,height:8,borderRadius:'50%',background:'#4CAF50',display:'inline-block'}}></span> Buzzer: {BLE.devices[stNum]?.name}</div>}
      {/* Athlete card with gradient glow + timer */}
      <div className="sh-card" style={{margin:'12px 16px',padding:'18px 20px',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 110%,rgba(255,94,58,.09) 0%,transparent 58%)',pointerEvents:'none'}}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div>
            <div style={{fontSize:22,fontWeight:800,letterSpacing:'-.5px'}}>{athlete.name}</div>
            <div style={{fontSize:12,color:'var(--muted)',marginTop:3,fontFamily:'JetBrains Mono'}}>#{athlete.num}</div>
          </div>
          {hasLives&&(
            <div style={{textAlign:'right'}}>
              <div className="lbl" style={{marginBottom:7}}>{lang==='de'?'Leben':'Lives'}</div>
              <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                {Array.from({length:info.lives||3},(_,i)=>(
                  <div key={i} style={{width:11,height:11,borderRadius:'50%',background:i<lives?'var(--cor)':'rgba(255,255,255,.12)',boxShadow:i<lives?'0 0 8px rgba(255,94,58,.6)':'none',transition:'all .3s'}}/>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{textAlign:'center'}}>
          <div className="lbl" style={{marginBottom:10}}>{lang==='de'?'Laufzeit':'Run time'}</div>
          <div className="timer-grad" style={{fontSize:54}}>{fmtMs(el)}</div>
          {nextCp&&!allDone&&<div style={{fontSize:12,color:'var(--muted)',marginTop:8}}><ObsLabel obs={nextCp} size={11}/> · CP {nextIdx+1}/{cpObst.length}{totalLivesLeft!=null&&<span style={{marginLeft:8,color:'rgba(255,200,0,.8)',fontFamily:'JetBrains Mono'}}>{totalLivesLeft}</span>}</div>}
          {remaining!==null&&(
            <div style={{marginTop:10,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              <span style={{fontSize:11,color:'var(--muted)',letterSpacing:'.08em',textTransform:'uppercase',display:'flex',alignItems:'center',gap:4}}><I.Clock s={12}/> {lang==='de'?'Verbleibend':'Remaining'}</span>
              <span style={{fontFamily:'JetBrains Mono',fontWeight:700,fontSize:16,color:timeCritical?'var(--red)':'var(--gold)',animation:timeCritical?'pulse 1s infinite':undefined}}>{fmtMs(remaining).slice(0,-4)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Split time flash after each CP */}
      {showSplit&&lastSplit&&(
        <div style={{margin:'0 16px 6px',padding:'10px 16px',borderRadius:14,
          background:'rgba(52,199,89,.1)',border:'1px solid rgba(52,199,89,.3)',
          display:'flex',justifyContent:'space-between',alignItems:'center',
          animation:'fadeUp .22s ease'}}>
          <div style={{fontSize:13,fontWeight:700,color:'var(--green)'}}>
            ✓ {obsShortName(lastSplit.name)} · CP {lastSplit.idx}/{lastSplit.total}
          </div>
          <div className="timer-grad" style={{fontSize:20}}>{fmtMs(lastSplit.time)}</div>
        </div>
      )}

      {restActive&&(<div style={{position:'absolute',top:8,right:8,left:8,background:'rgba(0,0,0,0.88)',borderRadius:12,padding:'12px 16px',zIndex:20,display:'flex',flexDirection:'column',alignItems:'center',gap:4,border:'2px solid var(--accent)'}}><div style={{fontSize:11,color:'var(--dim)',letterSpacing:1,textTransform:'uppercase'}}>{lang==='de'?'Restzeit auf Plattform':'Rest time on platform'}</div><div style={{fontSize:56,fontWeight:900,color:restSecs<=5?'#ff4444':'var(--accent)',fontVariantNumeric:'tabular-nums',lineHeight:1}}>{restSecs}</div><div style={{fontSize:12,color:'var(--dim)'}}>s</div><button onClick={()=>{clearInterval(restIntervalRef.current);setRestActive(false);}} style={{marginTop:6,background:'none',border:'1px solid rgba(255,255,255,0.2)',borderRadius:20,padding:'4px 16px',color:'var(--dim)',cursor:'pointer',fontSize:12}}>{lang==='de'?'Überspringen':'Skip'}</button></div>)}

      {/* THE BIG CHECKPOINT BUTTON */}
      {!allDone&&(
        <div style={{padding:'6px 16px',flex:1,display:'flex',flexDirection:'column',gap:8}}>
          {(()=>{const isEndPlat=nextCp&&/endplattform/i.test(nextCp.name||'')&&info.mode==='segliv';const isStartPlat=nextCp&&/startplattform/i.test(nextCp.name||'')&&info.mode==='segliv';return(
          <button className={`big-cp-btn${flash?' flash':''}`} style={{flex:1,minHeight:220,
            ...(isEndPlat?{borderColor:'rgba(255,200,0,.35)',background:'rgba(255,200,0,.06)'}:
               isStartPlat?{borderColor:'rgba(150,150,255,.3)',background:'rgba(100,100,255,.05)'}:{})}} onClick={handleCP} onTouchStart={()=>{longPressRef.current=setTimeout(undoCP,800);}} onTouchEnd={()=>clearTimeout(longPressRef.current)} onContextMenu={e=>e.preventDefault()}>
            <div style={{width:52,height:52,borderRadius:'50%',background:isEndPlat?'rgba(255,200,0,.1)':'rgba(255,94,58,.08)',border:`1px solid ${isEndPlat?'rgba(255,200,0,.3)':'rgba(255,94,58,.15)'}`,display:'flex',alignItems:'center',justifyContent:'center'}}><I.Ninja s={28} c="rgba(255,255,255,.2)"/></div>
            <div>{isEndPlat?(lang==='de'?'SEGMENT ENDE':'SEGMENT END'):isStartPlat?(lang==='de'?'SEGMENT START':'SEGMENT START'):'CHECKPOINT'}</div>
            {nextCp&&<div style={{fontSize:15,opacity:.82,fontWeight:600,letterSpacing:'.01em',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}><ObsLabel obs={nextCp} size={13}/></div>}
            {isEndPlat&&<div style={{fontSize:11,color:'rgba(255,200,0,.7)',letterSpacing:'.1em',textTransform:'uppercase',marginTop:2}}>{lang==='de'?'⬛ Leben werden aufgefüllt':'⬛ Lives will refill'}</div>}
            <div style={{fontSize:9,opacity:.28,fontWeight:400,letterSpacing:'.04em',marginTop:3,lineHeight:1,textTransform:'none'}}>{lang==='de'?'halten = rückgängig':'hold = undo'}</div>
          </button>);})()}
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-fall" style={{flex:1,padding:20,fontSize:16,gap:10,minHeight:56,borderRadius:14}} onClick={handleFall}>
              <I.X s={14}/> {lang==='de'?'Fall':'Fall'}
            </button>
            <button className="btn btn-ghost" style={{padding:'16px 20px',fontSize:14,gap:7,minHeight:56,borderRadius:14}} onClick={handleStop}>
              <I.StopOct s={12}/> {lang==='de'?'Abbrechen':'Stop run'}
            </button>
          </div>
          <button className="btn btn-ghost" style={{width:'100%',padding:14,fontSize:13,gap:8,minHeight:48,
            ...(protested?{background:'rgba(255,200,0,.12)',color:'var(--gold)',borderColor:'rgba(255,200,0,.35)'}:{})}}
            onClick={()=>{setProtested(p=>!p);SFX.hover();}}>
            <I.Flag s={13} c={protested?'var(--gold)':'currentColor'}/> {protested
              ?(lang==='de'?'Reklamation gesetzt – nochmal drücken zum aufheben':'Protest marked – tap to remove')
              :(lang==='de'?'Reklamation markieren':'Mark protest')}
          </button>
        </div>
      )}

      {allDone&&(
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:'0 16px'}}>
          <div style={{fontSize:28,fontWeight:900,color:'var(--green)'}}>FINISH</div>
          <div style={{fontSize:22,fontWeight:900,color:'var(--green)'}}>{lang==='de'?'Ziel erreicht!':'Finish!'}</div>
          <div className="timer-grad" style={{fontSize:38}}>{fmtMs(doneCP[doneCP.length-1]?.time||el)}</div>
          <button className="btn btn-coral" style={{width:'100%',padding:18,fontSize:18,gap:10,minHeight:56,borderRadius:14,marginTop:8}}
            onClick={()=>onComplete({doneCP,finalTime:doneCP[doneCP.length-1]?.time||Math.round(performance.now()-startPerf),lives})}>
            <I.Flag s={16}/> {lang==='de'?'Bestätigen':'Confirm finish'}
          </button>
        </div>
      )}
    </div>
  );
};

const ResetCountdown=({frozenTime,onDone})=>{
  const {lang}=useLang();
  const [count,setCount]=useState(10);
  useEffect(()=>{
    if(count<=0){onDone();return;}
    const t=setTimeout(()=>setCount(c=>c-1),1000);
    return()=>clearTimeout(t);
  },[count]);
  return(
    <div style={{position:'fixed',inset:0,zIndex:160,background:'rgba(0,0,0,.88)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10}}>
      <div style={{fontSize:11,color:'rgba(255,255,255,.4)',letterSpacing:'.14em',textTransform:'uppercase'}}>{lang==='de'?'Hinderniss-Reset':'Obstacle Reset'}</div>
      <div style={{fontSize:96,fontWeight:900,color:count<=3?'var(--red)':'var(--gold)',fontFamily:'JetBrains Mono',lineHeight:1,transition:'color .3s'}}>{count}</div>
      <div style={{fontSize:11,color:'rgba(255,255,255,.3)',marginTop:2}}>{lang==='de'?'Timer läuft danach weiter':'Timer resumes after this'}</div>
      <div className="timer-grad" style={{fontSize:32,marginTop:6}}>{fmtMs(frozenTime)}</div>
    </div>
  );
};

const FallModal=({athlete,doneCP,cpObst,obstArr=[],currentTime,mode,lives,onConfirm,onUseLive,onCancel})=>{
  const {t,lang}=useLang();
  const [selCount,setSelCount]=useState(doneCP.length);
  const [manualTimeStr,setManualTimeStr]=useState('');
  useEffect(()=>{setManualTimeStr('');},[selCount]);
  const hasLives=mode==='lives';
  // Show last 2 + next 2 CPs around current done count
  const rangeStart=Math.max(0,doneCP.length-2);
  const rangeEnd=Math.min(cpObst.length,doneCP.length+2);
  const visible=cpObst.slice(rangeStart,rangeEnd);
  // Official time = time of selected CP, or currentTime if none/future
  const getTime=sc=>{
    if(sc===0)return currentTime;
    const ct=doneCP[sc-1]?.time;
    return ct!=null?ct:currentTime;
  };
  const officialTime=getTime(selCount);
  const isLaterCP=selCount>doneCP.length;
  const parseMs=str=>{const r=str.match(/^(\d+):(\d{2})\.(\d{1,3})$/);if(!r)return null;return +r[1]*60000+ +r[2]*1000+ +r[3].padEnd(3,'0');};
  // Obstacle selector: show all obstacles after last confirmed CP
  const lastCpOrder=selCount>0?(cpObst[selCount-1]?.order??-1):-1;
  const candidateObst=obstArr.filter(o=>o.order>lastCpOrder);
  const [fellAtObstId,setFellAtObstId]=useState(()=>candidateObst[0]?.id??null);
  useEffect(()=>{setFellAtObstId(candidateObst[0]?.id??null);},[selCount]);
  const fellAtObst=obstArr.find(o=>o.id===fellAtObstId)||null;
  return(
    <div className="modal-overlay">
      <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:4}}><div style={{width:52,height:52,borderRadius:'50%',background:'rgba(255,59,48,.12)',border:'2px solid rgba(255,59,48,.3)',display:'flex',alignItems:'center',justifyContent:'center'}}><I.XCircle s={28} c="var(--red)"/></div></div>
        <div style={{fontSize:20,fontWeight:900,textAlign:'center',marginBottom:4}}>{t('fallTitle')}</div>
        <div style={{fontSize:13,color:'var(--muted)',textAlign:'center',marginBottom:14}}>{athlete.name} · #{athlete.num}</div>
        <div className="sh-card" style={{padding:14,marginBottom:12}}>
          <div className="lbl" style={{marginBottom:8}}>{lang==='de'?'Letzter erreichter Checkpoint':'Last checkpoint reached'}</div>
          <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:12}}>
            <button className={`chip${selCount===0?' active':''}`}
              style={{justifyContent:'space-between',padding:'9px 14px'}}
              onClick={()=>setSelCount(0)}>
              <span style={{fontWeight:600,color:'var(--text)'}}>⛔ {lang==='de'?'Kein Checkpoint':'No checkpoint'}</span>
              <span style={{fontSize:11,color:'var(--muted)',fontFamily:'JetBrains Mono'}}>—</span>
            </button>
            {visible.map((cp,vi)=>{
              const idx=rangeStart+vi;
              const count=idx+1;
              const reached=count<=doneCP.length;
              const cpTime=reached?doneCP[idx]?.time:null;
              const isSel=selCount===count;
              return(
                <button key={cp.id} className={`chip${isSel?' active':''}`}
                  style={{justifyContent:'space-between',padding:'9px 14px',opacity:reached?1:.62,
                    background:isSel?'rgba(255,94,58,.22)':reached?'rgba(255,255,255,.06)':'rgba(255,255,255,.02)'}}
                  onClick={()=>setSelCount(count)}>
                  <span style={{fontWeight:600,color:'var(--text)'}}>
                    {reached&&<span style={{color:'var(--cor)',marginRight:5,fontSize:10}}>✓</span>}
                    {count}. {cp.name}
                    {!reached&&<span style={{fontSize:10,color:'var(--dim)',marginLeft:6}}>{lang==='de'?'(nicht erreicht)':'(not yet)'}</span>}
                  </span>
                  <span style={{fontSize:12,fontFamily:'JetBrains Mono',fontWeight:700,color:reached?'var(--text)':'var(--dim)',flexShrink:0,marginLeft:8}}>
                    {cpTime!=null?fmtMs(cpTime):'—'}
                  </span>
                </button>
              );
            })}
          </div>
          {obstArr.length>0&&(
            <div style={{marginBottom:12}}>
              <div className="lbl" style={{marginBottom:7}}>{lang==='de'?'Gefallen bei Hindernis:':'Fell at obstacle:'}</div>
              {candidateObst.length===0
                ?<div style={{fontSize:12,color:'var(--dim)',padding:'4px 0'}}>—</div>
                :<div style={{display:'flex',gap:5,overflowX:'auto',paddingBottom:2}}>
                  {candidateObst.map(o=>(
                    <button key={o.id} className={`chip${fellAtObstId===o.id?' active':''}`}
                      style={{flexShrink:0,fontSize:12,padding:'5px 11px',justifyContent:'center',display:'inline-flex',alignItems:'center',gap:3}}
                      onClick={()=>setFellAtObstId(o.id)}>
                      <ObsLabel obs={o} size={10}/>
                    </button>
                  ))}
                </div>
              }
            </div>
          )}
          <div className="lbl" style={{marginBottom:4}}>{t('officialTime')}</div>
          <div className="timer-grad" style={{fontSize:32}}>{fmtMs(officialTime)}</div>
        </div>
        {isLaterCP&&(
          <div style={{margin:'10px 0 6px',background:'rgba(255,160,0,.08)',border:'1px solid rgba(255,160,0,.25)',borderRadius:10,padding:'10px 12px'}}>
            <div style={{fontSize:11,fontWeight:700,color:'rgba(255,160,0,.8)',letterSpacing:'.07em',marginBottom:6}}>{lang==='de'?'OFFIZIELLE ZEIT (MANUELL)':'OFFICIAL TIME (MANUAL)'}</div>
            <input type="text" value={manualTimeStr||fmtMs(officialTime)}
              onChange={e=>setManualTimeStr(e.target.value)}
              placeholder="00:00.000"
              style={{width:'100%',background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,160,0,.35)',borderRadius:8,padding:'8px 10px',fontSize:22,color:'#fff',fontFamily:'JetBrains Mono,monospace',textAlign:'center',boxSizing:'border-box'}}/>
            <div style={{fontSize:10,color:'var(--muted)',marginTop:5}}>{lang==='de'?'Exakte Zeit eingeben (MM:SS.mmm)':'Enter exact time (MM:SS.mmm)'}</div>
          </div>
        )}
        {hasLives&&lives>1&&onUseLive&&(
          <button className="btn btn-coral" style={{width:'100%',padding:13,marginBottom:8,gap:8}}
            onClick={()=>onUseLive({selCount,time:officialTime})}>
             {lang==='de'?`Leben verbrauchen & weiter (${lives-1} übrig)`:`Use life & continue (${lives-1} left)`}
          </button>
        )}
        <button className="btn" style={{width:'100%',padding:13,marginBottom:8,gap:8,
          background:'rgba(255,59,48,.1)',color:'var(--red)',border:'1px solid rgba(255,59,48,.2)'}}
          onClick={()=>onConfirm({selCount,time:(isLaterCP&&parseMs(manualTimeStr||fmtMs(officialTime)))||officialTime,fellAtObst})}>
          <I.Check s={15}/> {lang==='de'?'Fall bestätigen (DNF)':'Confirm fall (DNF)'}
        </button>
        <button className="btn btn-ghost" style={{width:'100%',padding:12}} onClick={onCancel}>
          ↩ {lang==='de'?'Zurück zum Lauf':'Back to run'}
        </button>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// JURY — STOP MODAL (timer keeps running behind overlay)
// ════════════════════════════════════════════════════════════

const StopModal=({athlete,isTimeout,onRestart,onSwitchAth,onCancel})=>{
  const {lang}=useLang();
  return(
    <div style={{position:'fixed',inset:0,zIndex:900,background:'rgba(0,0,0,.85)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',overflowY:'auto',padding:'20px 16px 40px'}}>
      <div style={{width:'100%',maxWidth:440}}>
        <div style={{textAlign:'center',marginBottom:24,padding:'0 8px'}}>
          <div style={{fontSize:20,fontWeight:900,lineHeight:1.25,overflowWrap:'break-word'}}>{isTimeout?(lang==='de'?'Zeitlimit erreicht':'Time limit reached'):(lang==='de'?'Lauf abbrechen':'Stop run')}</div>
          <div style={{fontSize:13,color:'var(--muted)',marginTop:5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{athlete.name} · #{athlete.num}</div>
        </div>
        <div style={{background:'rgba(255,200,80,.06)',border:'1px solid rgba(255,200,80,.22)',borderRadius:14,padding:'14px 16px',marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:'rgba(255,200,80,.7)',letterSpacing:'.08em',marginBottom:12}}>{lang==='de'?'LAUF KORRIGIEREN':'CORRECT RUN'}</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <button className="btn" style={{flex:1,minWidth:130,padding:'10px 12px',gap:6,background:'rgba(255,200,80,.12)',border:'1px solid rgba(255,200,80,.3)',color:'#FFD060',fontWeight:700,fontSize:13}} onClick={onRestart}><I.RefreshCw s={13}/> {lang==='de'?'Nochmal starten':'Restart run'}</button>
            {onSwitchAth&&<button className="btn" style={{flex:1,minWidth:130,padding:'10px 12px',gap:6,background:'rgba(180,180,200,.07)',border:'1px solid rgba(180,180,200,.18)',fontSize:13,fontWeight:600}} onClick={onSwitchAth}><I.User s={13}/> {lang==='de'?'Athlet wechseln':'Switch athlete'}</button>}
          </div>
          <div style={{fontSize:11,color:'var(--muted)',marginTop:9,lineHeight:1.45}}>{lang==='de'?'Das Ergebnis wird gelöscht und der Lauf neu gestartet.':'Result will be cleared and run restarted.'}</div>
        </div>
        <button className="btn btn-ghost" style={{width:'100%',padding:'11px 16px',fontSize:13,gap:8}} onClick={onCancel}><I.ArrowLeft s={13}/> {lang==='de'?'Zurück zum Lauf':'Back to run'}</button>
      </div>
    </div>
  );
};

const JuryDone=({athlete,result,cat,onNext,onRestart,onSwitchAth})=>{
  const {t,lang,catName}=useLang();
  const ok=result.status==='complete';
  const isDnf=result.status==='dnf'||result.status==='stopped';
  const isTimeout=result.status==='timeout';
  const isDsq=result.status==='dsq';
  useEffect(()=>{if(ok)SFX.complete();},[]);
  const statusIconEl=ok?<I.Trophy s={28} c="var(--green)"/>:isDsq?<I.XCircle s={28} c="#FF3B6B"/>:isTimeout?<I.Clock s={28} c="var(--gold)"/>:isDnf?<I.StopOct s={28} c="var(--red)"/>:<I.XCircle s={28} c="var(--cor)"/>;
  const statusLabel=ok?(lang==='de'?'Abgeschlossen':'Completed'):isDsq?'DSQ':isTimeout?(lang==='de'?'Zeitlimit':'Timeout'):isDnf?(lang==='de'?'Abgebrochen':'Stopped'):(lang==='de'?'Gefallen':'Fall');
  const statusColor=ok?'var(--green)':isDsq?'#FF3B6B':isTimeout?'var(--gold)':isDnf?'rgba(255,200,80,.8)':'var(--cor)';
  const canRestart=!ok; // Restart only makes sense for non-complete results
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'44px 20px 20px',gap:16}}>
      <div style={{width:64,height:64,borderRadius:'50%',background:`${statusColor}18`,border:`2px solid ${statusColor}44`,display:'flex',alignItems:'center',justifyContent:'center'}}>{statusIconEl}</div>
      <div style={{fontSize:22,fontWeight:900,letterSpacing:'-.4px'}}>{t('runComplete')}</div>
      <div style={{fontSize:14,color:'var(--muted)'}}>{athlete.name}</div>
      <div className="sh-card" style={{width:'100%',padding:20,display:'flex',flexDirection:'column',gap:12}}>
        {cat&&(<div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div className="lbl">{t('category')}</div><div style={{fontSize:11,padding:'3px 10px',borderRadius:10,background:`${cat.color}1A`,color:cat.color,border:`1px solid ${cat.color}44`,fontWeight:600}}>{catName(cat)}</div></div>)}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div className="lbl">{t('official')}</div><div className="timer-grad" style={{fontSize:32}}>{fmtMs(result.finalTime)}</div></div>
        <div style={{display:'flex',justifyContent:'space-between'}}><div className="lbl">{t('allCPs')}</div><div style={{fontWeight:700,fontSize:15}}>{result.doneCP?.length||0} / {result.totalCPs||'?'} CPs</div></div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div className="lbl">Status</div><div style={{fontWeight:700,color:statusColor,display:'flex',alignItems:'center',gap:5}}>{React.cloneElement(statusIconEl,{s:13})}{statusLabel}</div></div>
        {result.protested&&(
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0 0',borderTop:'1px solid var(--border)',marginTop:4}}>
            <div className="lbl" style={{display:'flex',alignItems:'center',gap:6}}><I.Flag s={14} c="var(--gold)"/> {lang==='de'?'Reklamation':'Protest'}</div>
            <div style={{fontSize:12,color:'var(--gold)',fontWeight:700}}>{lang==='de'?'Markiert – bitte prüfen':'Marked – please review'}</div>
          </div>
        )}
      </div>
      {/* Restart / switch athlete section — only shown for non-complete runs */}
      {canRestart&&(onRestart||onSwitchAth)&&(
        <div style={{width:'100%',background:'rgba(255,200,80,.06)',border:'1px solid rgba(255,200,80,.2)',borderRadius:14,padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
          <div style={{fontSize:12,color:'rgba(255,200,80,.8)',fontWeight:700,letterSpacing:'.05em',textTransform:'uppercase'}}>{lang==='de'?'Lauf korrigieren':'Correct run'}</div>
          <div style={{display:'flex',gap:8}}>
            {onRestart&&<button className="btn" style={{flex:1,padding:'10px',gap:6,background:'rgba(255,200,80,.12)',border:'1px solid rgba(255,200,80,.3)',color:'#FFD060',fontWeight:700,fontSize:13}} onClick={onRestart}><I.RefreshCw s={13}/> {lang==='de'?'Nochmal starten':'Restart run'}</button>}
            {onSwitchAth&&<button className="btn" style={{flex:1,padding:'10px',gap:6,fontSize:13}} onClick={onSwitchAth}><I.User s={13}/> {lang==='de'?'Athlet wechseln':'Switch athlete'}</button>}
          </div>
          <div style={{fontSize:11,color:'rgba(255,255,255,.35)',lineHeight:1.4}}>{lang==='de'?'Das Ergebnis wird gelöscht und der Lauf neu gestartet.':'The result will be deleted and the run restarted.'}</div>
        </div>
      )}
      <button className="btn btn-coral" style={{width:'100%',padding:15,fontSize:15,gap:8}} onClick={onNext}><I.ChevR s={16}/> {t('nextAth')}</button>
    </div>
  );
};

const JuryApp=({compId,stNum,stageId,onBack})=>{
  const {t,lang,catName}=useLang();
  const isPipeline=!!stageId;
  // For pipeline mode use stageId as active run key, else stNum
  const activeRunKey=isPipeline?stageId:stNum;
  const [tab,setTab]=useState('jury');
  const [topView,setTopView]=useState('jury'); // 'jury' | 'results' | 'queue' | 'stats'
  const [buzzerName,setBuzzerName]=useState(BLE.isConnected(stNum)?BLE.devices[stNum]?.name:'');
  const toggleBuzzer=async()=>{if(buzzerName){BLE.disconnect(stNum);setBuzzerName('');}else{const name=await BLE.connect(stNum);if(name)setBuzzerName(name);}};
  const info=useFbVal(`ogn/${compId}/info`);
  const globalObstacles=useFbVal(`ogn/${compId}/obstacles`);
  const stageObstaclesRaw=useFbVal(isPipeline?`ogn/${compId}/pipeline/${stageId}/obstacles`:`ogn/${compId}/stages/${stNum}/obstacles`);
  const globalAthletesMap=useFbVal(`ogn/${compId}/athletes`);
  const stageAthletesRaw=useFbVal(isPipeline?`ogn/${compId}/pipeline/${stageId}/athletes`:`ogn/${compId}/stages/${stNum}/athletes`);
  const pipelineStageCfg=useFbVal(isPipeline?`ogn/${compId}/pipeline/${stageId}`:null);
  // Per-stage data overrides global with fallback
  const obstacles=stageObstaclesRaw||globalObstacles;
  // Always prefer global athletes (contains all registered athletes across all stages)
  const athletesMap=globalAthletesMap||stageAthletesRaw;
  // For pipeline mode: no stations doc, derive cat from stage config or athletes
  const stData=useFbVal(isPipeline?null:`ogn/${compId}/stations/${stNum}`);
  const completedRuns=useFbVal(`ogn/${compId}/completedRuns`);
  const [phase,setPhase]=useState('wait');
  const [currentAth,setCurrentAth]=useState(null);
  const [fallModal,setFallModal]=useState(null);   // null or fall data — timer stays running
  const [stopModal,setStopModal]=useState(null);   // null or stop data — timer stays running
  const [activeFalls,setActiveFalls]=useState([]); // committed falls in current run
  const [doneResult,setDoneResult]=useState(null);
  const [completedRunKey,setCompletedRunKey]=useState(null);
  const [lives,setLives]=useState(3);
  const effectiveLives=info?.stageExtraLife?.[stNum]?.lives??info?.stageLivesOverrides?.[stNum]??info?.lives??3;
  const effectiveTotalLives=info?.stageExtraLife?.[stNum]?.stageTotalLives??info?.stageTotalLives??0;
  const [totalLivesLeft,setTotalLivesLeft]=useState(effectiveTotalLives>0?effectiveTotalLives:null);
  const [goTime,setGoTime]=useState(null);
  const [fallFreezeTime,setFallFreezeTime]=useState(null);
  const [resetActive,setResetActive]=useState(false);
  useEffect(()=>{if(info)setLives(info?.lives||3);},[info?.lives]);

  // After run completes: keep stage card on Display for 5s showing result, then clear
  useEffect(()=>{
    if(phase==='done'&&doneResult&&currentAth){
      // Small delay so JuryActive's cleanup (fbRemove) fires first, then we write back
      const tWrite=setTimeout(()=>{
        fbSet(`ogn/${compId}/activeRuns/${activeRunKey}`,{
          athleteId:currentAth.id,athleteName:currentAth.name,catId:currentAth.cat||null,
          phase:'done',status:doneResult.status,finalTime:doneResult.finalTime||null,
          doneCP:doneResult.doneCP||[],fellAt:doneResult.fellAt||null,doneAt:Date.now()
        });
      },200);
      const tRemove=setTimeout(()=>fbRemove(`ogn/${compId}/activeRuns/${activeRunKey}`),5200);
      return()=>{clearTimeout(tWrite);clearTimeout(tRemove);};
    }
  },[phase,doneResult?.timestamp]);

  // Broadcast countdown phase to Firebase so DisplayView shows live countdown on stage card
  useEffect(()=>{
    if(phase==='countdown'&&currentAth){
      fbSet(`ogn/${compId}/activeRuns/${activeRunKey}`,{athleteId:currentAth.id,athleteName:currentAth.name,catId:currentAth.cat||null,phase:'countdown',countdown:3,doneCP:[],livesLeft:lives});
      const t1=setTimeout(()=>fbUpdate(`ogn/${compId}/activeRuns/${activeRunKey}`,{countdown:2}),1000);
      const t2=setTimeout(()=>fbUpdate(`ogn/${compId}/activeRuns/${activeRunKey}`,{countdown:1}),2000);
      return()=>{clearTimeout(t1);clearTimeout(t2);};
    }
  },[phase,currentAth?.id]);

  if(!info||globalObstacles===undefined)return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:10}}><Spinner/><div style={{fontSize:12,color:'var(--muted)'}}>{isPipeline?stageId:`Stage ${stNum}`} · {compId}</div></div>
  );

  // ── Inline category picker if no category assigned yet (legacy mode only) ──
  if(!isPipeline && !stData?.cat && stData !== undefined){
    const athList=athletesMap?Object.values(athletesMap):[];
    return(
      <div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>
        <TopBar title={`Stage ${stNum}`} sub={compId} onBack={onBack}/>
        <div className="section" style={{flex:1}}>
          <div style={{padding:'24px 0 8px',textAlign:'center'}}>
            <div style={{width:52,height:52,borderRadius:'50%',background:'rgba(255,94,58,.08)',border:'1px solid rgba(255,94,58,.15)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:8}}><I.Ninja s={28} c="rgba(255,255,255,.25)"/></div>
            <div style={{fontSize:18,fontWeight:800,marginBottom:4}}>Kategorie wählen</div>
            <div style={{fontSize:13,color:'var(--muted)'}}>Welche Kategorie startet auf Stage {stNum}?</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:8}}>
            {IGN_CATS.filter(c=>athList.some(a=>a.cat===c.id)).map(c=>{
              const cnt=athList.filter(a=>a.cat===c.id).length;
              return(
                <button key={c.id} className="sh-card btn fade-up"
                  style={{padding:'14px 16px',textAlign:'left',flexDirection:'row',gap:14,width:'100%',cursor:'pointer'}}
                  onClick={()=>{fbSet(`ogn/${compId}/stations/${stNum}/cat`,c.id);SFX.click();}}>
                  <div style={{width:12,height:12,borderRadius:'50%',background:c.color,flexShrink:0,marginTop:3}}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14}}>{catName(c)}</div>
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{cnt} Athlet{cnt!==1?'en':''}</div>
                  </div>
                  <I.ChevR s={16} c="var(--dim)"/>
                </button>
              );
            })}
            {IGN_CATS.filter(c=>athList.some(a=>a.cat===c.id)).length===0&&(
              <EmptyState icon={<I.User s={28} c="rgba(255,255,255,.3)"/>} text="Noch keine Athleten angelegt. Wettkampf bearbeiten."/>
            )}
          </div>
        </div>
      </div>
    );
  }

  // In pipeline mode: no single catId, show all athletes in stage. In legacy: catId from station.
  const catId=isPipeline?null:stData?.cat;
  const cat=catId?IGN_CATS.find(c=>c.id===catId):null;
  // In pipeline mode: athletesMap IS the global map, but queue = only pipeline stage athletes
  const pipelineAthIds=isPipeline&&stageAthletesRaw?new Set(Object.keys(stageAthletesRaw)):null;
  const athList=athletesMap?Object.values(athletesMap):[];
  const stageAthList=isPipeline?(pipelineAthIds&&pipelineAthIds.size>0?athList.filter(a=>pipelineAthIds.has(a.id)):(()=>{const _cats=pipelineStageCfg?.categories==='all'?IGN_CATS.map(c=>c.id):(pipelineStageCfg?.categoriesList||[]);const _cs=new Set(_cats);return athList.filter(a=>_cs.has(a.cat));})()):(athList.filter(a=>a.cat===catId));
  const doneIds=new Set(completedRuns?Object.values(completedRuns).filter(r=>isPipeline?r.stageId===stageId:(r.catId===catId&&r.stNum===stNum)).map(r=>r.athleteId):[]);
  const queue=stageAthList.filter(a=>!doneIds.has(a.id)).sort((a,b)=>(a.queueOrder??999)-(b.queueOrder??999));
  const totalCatAthletes=stageAthList.length;
  const handleForceResetStage=async()=>{
    if(!window.confirm(lang==='de'?`Alle Läufe von Stage ${isPipeline?stageId:stNum} löschen und Stage neu starten?`:`Delete all runs from Stage ${isPipeline?stageId:stNum} and restart?`))return;
    if(completedRuns){
      const toDelete=Object.entries(completedRuns).filter(([,r])=>isPipeline?r.stageId===stageId:(r.catId===catId&&r.stNum===stNum));
      if(toDelete.length){const updates={};toDelete.forEach(([k])=>{updates[`ogn/${compId}/completedRuns/${k}`]=null;});await db.ref().update(updates);}
    }
    await fbRemove(`ogn/${compId}/activeRuns/${activeRunKey}`);
    SFX.complete();
  };

  const obstArr=obstacles?Object.values(obstacles).sort((a,b)=>a.order-b.order):[];
  const cpObst=obstArr.filter(o=>o.isCP);

  const handleStart=ath=>{setCurrentAth(ath);setLives(info.lives||3);setActiveFalls([]);setGoTime(null);setPhase('countdown');};
  const handleDsqAth=async(ath)=>{
    const result={athleteId:ath.id,athleteName:ath.name,catId:ath.cat||catId,stNum,...(isPipeline?{stageId}:{}),mode:info.mode||'cp',doneCP:[],totalCPs:cpObst.length,finalTime:0,lives:info.lives||3,falls:0,status:'dsq',timestamp:Date.now()};
    const rk=uid();await fbSet(`ogn/${compId}/completedRuns/${rk}`,result);SFX.click();
  };
  // goTime = performance.now() at the exact moment the GO horn fired — used as timer origin
  const handleGo=(gt)=>{setGoTime(gt);setPhase('active');};
  // Fall: show modal overlay — JuryActive stays mounted, timer keeps running
  const handleFall=data=>{if(fallModal||stopModal)return;setFallModal(data);};
  const handleStop=data=>{if(fallModal||stopModal)return;setStopModal(data);};
  // "Back to run" — accidental press, no fall recorded
  const handleFallCancel=()=>setFallModal(null);
  const handleStopCancel=()=>setStopModal(null);
  const handleUseLive=({selCount,time})=>{
    const newFall={obsIdx:fallModal.pendingFallIdx,time:fallModal.currentTime};
    setActiveFalls(prev=>[...prev,newFall]);
    setFallFreezeTime(fallModal.currentTime);
    setFallModal(null);
    setLives(l=>l-1);
    if(totalLivesLeft!==null)setTotalLivesLeft(t=>t-1);
    if(info.mode==='lives')setResetActive(true);
  };
  const handleResetDone=()=>{
    setGoTime(performance.now()-fallFreezeTime);
    setFallFreezeTime(null);
    setResetActive(false);
  };
  const handleRefillLives=(sectionLives)=>{const refill=sectionLives!=null?sectionLives:effectiveLives;const capped=totalLivesLeft!=null?Math.min(refill,totalLivesLeft):refill;setLives(capped);};
  // Confirm DNF
  const handleFallConfirm=async({selCount,time,fellAtObst})=>{
    const corrected=(fallModal.doneCP||[]).slice(0,selCount);
    const finalFalls=[...activeFalls,{obsIdx:fallModal.pendingFallIdx,time:fallModal.currentTime}];
    const result={athleteId:currentAth.id,athleteName:currentAth.name,catId:currentAth.cat,stNum,...(isPipeline?{stageId}:{}),mode:info.mode,doneCP:corrected,totalCPs:cpObst.length,finalTime:time,lives,falls:finalFalls,protested:fallModal.protested||false,status:'fall',fellAt:fellAtObst?{id:fellAtObst.id,name:fellAtObst.name,order:fellAtObst.order}:null,timestamp:Date.now()};
    const rk=uid();await fbSet(`ogn/${compId}/completedRuns/${rk}`,result);setCompletedRunKey(rk);setFallModal(null);setDoneResult(result);setPhase('done');SFX.complete();
  };
  const handleStopConfirm=async({selCount,time,fellAtObst,dsq})=>{
    const corrected=(stopModal.doneCP||[]).slice(0,selCount);
    const result={athleteId:currentAth.id,athleteName:currentAth.name,catId:currentAth.cat,stNum,...(isPipeline?{stageId}:{}),mode:info.mode,doneCP:corrected,totalCPs:cpObst.length,finalTime:time,lives,falls:activeFalls,protested:stopModal.protested||false,status:dsq?'dsq':(stopModal.reason||'dnf'),fellAt:fellAtObst?{id:fellAtObst.id,name:fellAtObst.name,order:fellAtObst.order}:null,timestamp:Date.now()};
    const rk=uid();await fbSet(`ogn/${compId}/completedRuns/${rk}`,result);setCompletedRunKey(rk);setStopModal(null);setDoneResult(null);setCurrentAth(null);setFallModal(null);setActiveFalls([]);setLives(info.lives||3);setGoTime(null);setPhase('wait');SFX.complete();
  };
  const handleComplete=async data=>{
    const result={athleteId:currentAth.id,athleteName:currentAth.name,catId:currentAth.cat,stNum,...(isPipeline?{stageId}:{}),mode:info.mode,doneCP:data.doneCP||[],totalCPs:cpObst.length,finalTime:data.finalTime,lives:data.lives,falls:activeFalls,protested:data.protested||false,status:'complete',timestamp:Date.now()};
    const rk=uid();await fbSet(`ogn/${compId}/completedRuns/${rk}`,result);setCompletedRunKey(rk);setDoneResult(result);setPhase('done');
  };
  const handleNext=()=>{setPhase('wait');setCurrentAth(null);setFallModal(null);setStopModal(null);setActiveFalls([]);setDoneResult(null);setCompletedRunKey(null);setLives(info.lives||3);setGoTime(null);};
  // Restart: delete completed result, show "restarting" on Display, then go to countdown for same athlete
  const handleRestartRun=async()=>{
    if(completedRunKey)await fbRemove(`ogn/${compId}/completedRuns/${completedRunKey}`);
    setCompletedRunKey(null);
    await fbSet(`ogn/${compId}/activeRuns/${activeRunKey}`,{
      athleteId:currentAth.id,athleteName:currentAth.name,catId:currentAth.cat||null,
      phase:'restarting',doneAt:null
    });
    setTimeout(()=>{
      setDoneResult(null);setActiveFalls([]);setGoTime(null);setLives(info.lives||3);setPhase('countdown');
    },1800);
    SFX.click();
  };
  // Switch athlete: delete completed result, go back to wait queue
  const handleSwitchAth=async()=>{
    if(completedRunKey)await fbRemove(`ogn/${compId}/completedRuns/${completedRunKey}`);
    setCompletedRunKey(null);
    await fbRemove(`ogn/${compId}/activeRuns/${activeRunKey}`);
    setPhase('wait');setCurrentAth(null);setFallModal(null);setStopModal(null);setActiveFalls([]);setDoneResult(null);setLives(info.lives||3);setGoTime(null);
    SFX.click();
  };
  const inRun=phase==='active'||phase==='countdown';

  const juryContent=(()=>{
    if(phase==='countdown')return<JuryCountdown onGo={handleGo}/>;
    if(phase==='active')return<JuryActive compId={compId} stNum={stNum} activeRunKey={activeRunKey} athlete={currentAth} obstacles={obstacles} info={info} lives={lives} totalLivesLeft={totalLivesLeft} activeFalls={activeFalls} startPerf={goTime} frozenAt={fallFreezeTime} onFall={handleFall} onComplete={handleComplete} onStop={handleStop} onRefillLives={info.mode==='lives'?handleRefillLives:null}/>;
    if(phase==='done')return<JuryDone athlete={currentAth} result={doneResult} cat={cat} onNext={handleNext} onRestart={handleRestartRun} onSwitchAth={handleSwitchAth}/>;
    return<JuryWait cat={cat} queue={queue} obstacles={obstacles} onStart={handleStart} compId={compId} totalAthletes={totalCatAthletes} doneCount={doneIds.size} onForceReset={handleForceResetStage} onDsq={handleDsqAth}/>;
  })();

  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <TopBar title={isPipeline?(pipelineStageCfg?.name||stageId||`Stage`):`Stage ${stNum}`} sub={cat?catName(cat):compId}
        onBack={(!inRun&&onBack)?onBack:undefined}
        right={inRun?<div className="live-badge"><div className="live-dot"/>LIVE</div>:null}/>
      {/* ── Top 3-way toggle: Jury | Ranking | Athleten ── */}
      {!inRun&&(
        <div style={{padding:'8px 12px',background:'rgba(13,15,20,.97)',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          <div style={{display:'flex',background:'rgba(255,255,255,.07)',borderRadius:26,padding:3,gap:2}}>
            {[
              {k:'jury',   ic:<I.Bolt s={13}/>,    lb:'Jury'},
              {k:'results',ic:<I.Trophy s={13}/>,  lb:'Ranking'},
              {k:'queue',  ic:<I.User s={13}/>,    lb:'Next up'},
              {k:'stats',  ic:<I.TrendUp s={13}/>, lb:'Stats'},
            ].map(({k,ic,lb})=>(
              <button key={k} style={{flex:1,padding:'7px 3px',borderRadius:22,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:4,fontSize:11,fontWeight:700,letterSpacing:'.03em',minWidth:0,
                background:topView===k?'var(--coral)':'transparent',
                color:topView===k?'#fff':'rgba(255,255,255,.4)',
                transition:'background .18s,color .18s',
                boxShadow:topView===k?'0 2px 8px rgba(255,94,58,.3)':'none'}}
                onClick={()=>{setTopView(k);SFX.hover();}}>
                {ic}<span className="tab-label">{lb}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>
        {/* Jury content: always visible during run; else controlled by topView+tab */}
        {inRun&&juryContent}
        {!inRun&&topView==='jury'&&tab==='jury'&&juryContent}
        {!inRun&&topView==='jury'&&tab==='results'&&<ResultsView compId={compId} athletes={athletesMap}/>}
        {!inRun&&topView==='jury'&&tab==='rules'&&<Regelwerk/>}
        {!inRun&&topView==='results'&&<ResultsView compId={compId} athletes={athletesMap}/>}
        {!inRun&&topView==='queue'&&<AthleteQueueView compId={compId} info={info} completedRuns={completedRuns} athletesMap={athletesMap}/>}
        {!inRun&&topView==='stats'&&<div style={{padding:'8px 12px'}}><StatsView compId={compId} info={info} completedRuns={completedRuns} athletesMap={athletesMap}/></div>}
      </div>
      {/* Bottom navbar only for jury sub-view */}
      {!inRun&&topView==='jury'&&(
        <nav className="tabbar">
          {[{id:'jury',ic:<I.Bolt s={20}/>,lb:t('tabJury')},{id:'results',ic:<I.Trophy s={20}/>,lb:t('tabResults')},{id:'rules',ic:<I.Book s={20}/>,lb:t('tabRules')}].map(tb=>(
            <button key={tb.id} className={`tab-item${tab===tb.id?' active':''}`} onClick={()=>{setTab(tb.id);SFX.hover();}}>{tb.ic}<span>{tb.lb}</span></button>
          ))}
        </nav>
      )}
      {navigator.bluetooth&&<div style={{padding:'6px 16px',display:'flex',justifyContent:'flex-end'}}>
        <button onClick={toggleBuzzer} style={{background:buzzerName?'rgba(76,175,80,.15)':'rgba(255,255,255,.06)',border:buzzerName?'1px solid rgba(76,175,80,.3)':'1px solid rgba(255,255,255,.1)',borderRadius:8,padding:'5px 12px',fontSize:11,color:buzzerName?'#4CAF50':'rgba(255,255,255,.5)',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
          <span style={{width:7,height:7,borderRadius:'50%',background:buzzerName?'#4CAF50':'rgba(255,255,255,.3)',display:'inline-block'}}></span>
          {buzzerName?buzzerName:'Buzzer verbinden'}
        </button>
      </div>}
      {resetActive&&fallFreezeTime!=null&&<ResetCountdown frozenTime={fallFreezeTime} onDone={handleResetDone}/>}
      {fallModal&&phase==='active'&&(
        <FallModal athlete={currentAth} doneCP={fallModal.doneCP} cpObst={cpObst} obstArr={obstArr} currentTime={fallModal.currentTime}
          mode={info.mode} lives={lives}
          onConfirm={handleFallConfirm}
          onUseLive={info.mode==='lives'&&lives>0?handleUseLive:null}
          onCancel={handleFallCancel}/>
      )}
      {stopModal&&phase==='active'&&(
        <StopModal athlete={currentAth} isTimeout={stopModal.reason==='timeout'} onRestart={handleRestartRun} onSwitchAth={handleSwitchAth} onCancel={handleStopCancel}/>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// DISPLAY VIEW
// ════════════════════════════════════════════════════════════

export { JuryApp };
