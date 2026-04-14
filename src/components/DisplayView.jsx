import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLang, LangCtx } from '../i18n.js';
import { IGN_CATS, db, fbSet } from '../config.js';
import { uid, fmtMs, toFlag, storage, computeRanked, computeRankedStage, computeRankedMultiStage } from '../utils.js';
import { useFbVal, useTimer, SFX } from '../hooks.js';
import { I } from '../icons.jsx';
import { Spinner, EmptyState, TopBar, MedalBadge, CompEmoji, LifeDots } from './shared.jsx';
import { ResultsView } from './ResultsView.jsx';
import { AthleteQueueView, AutoScrollList } from './QueueView.jsx';
import { StatsView } from './StatsView.jsx';

const DisplayView=({compId,onBack,onOpenJury,onBackToCoordinator})=>{
  const {lang,catName,t}=useLang();
  const info=useFbVal(`ogn/${compId}/info`);
  const athletesMap=useFbVal(`ogn/${compId}/athletes`);
  const completedRuns=useFbVal(`ogn/${compId}/completedRuns`);
  const activeRuns=useFbVal(`ogn/${compId}/activeRuns`);
  const [catIdx,setCatIdx]=useState(0);const [nowMs,setNowMs]=useState(Date.now());
  const [showJuryPicker,setShowJuryPicker]=useState(false);
  const winW=useWinW();const isWide=winW>=1024;
  const doneStartRef=useRef({});
  const runList=completedRuns?Object.values(completedRuns):[];
  const athMap=athletesMap||{};
  /* bestSplits — ski-racing style split comparison */
  const bestSplits=useMemo(()=>{
    const map={};
    runList.forEach(r=>{
      if(!r.doneCP||r.doneCP.length===0||r.status==='dsq')return;
      r.doneCP.forEach((cp,idx)=>{
        if(!cp.time)return;
        const key=`${r.catId}_${r.stNum||1}_${idx}`;
        if(!map[key]||cp.time<map[key].time){
          const a=athMap[r.athleteId];
          map[key]={time:cp.time,athleteName:a?.name||r.athleteName||'?'};
        }
      });
    });
    return map;
  },[runList.length,athMap]);
  const catsWithData=IGN_CATS.filter(c=>runList.some(r=>r.catId===c.id));
  // Build active run array — filter out stale 'done' entries older than 8s (JuryApp cleanup guard)
  const activeArr=activeRuns
    ?Object.entries(activeRuns)
      .filter(([,r])=>r?.athleteId&&!(r.phase==='done'&&r.doneAt&&(nowMs-r.doneAt)>8000))
      .map(([stNum,r])=>({stNum:parseInt(stNum,10),...r}))
    :[];
  // Track done phase start times
  activeArr.forEach(run=>{
    if(run.phase==='done'){if(!doneStartRef.current[run.stNum])doneStartRef.current[run.stNum]=Date.now();}
    else{delete doneStartRef.current[run.stNum];}
  });
  // Compute queue for a given catId (athletes not yet done)
  const getQueue=(catId)=>{
    if(!catId||!athletesMap)return[];
    const doneIds=new Set(runList.filter(r=>r.catId===catId).map(r=>r.athleteId));
    // also exclude currently running athletes
    activeArr.forEach(r=>{if(r.catId===catId&&r.phase!=='done')doneIds.add(r.athleteId);});
    return Object.values(athletesMap).filter(a=>a.cat===catId&&!doneIds.has(a.id)).sort((a,b)=>(a.queueOrder??999)-(b.queueOrder??999));
  };
  useEffect(()=>{if(catsWithData.length<=1||isWide)return;const id=setInterval(()=>{setCatIdx(i=>(i+1)%catsWithData.length);},15000);return()=>clearInterval(id);},[catsWithData.length,isWide]);
  useEffect(()=>{let raf;const tick=()=>{setNowMs(Date.now());raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);},[]);
  const medalColors=['#FFD60A','#C0C0C0','#CD7F32'];
  const curCat=catsWithData[catIdx]||null;
  // Per-stage columns: use all stage slots when numStations > 1, fill in actual run data
  const numDispStages=info?.numStations||1;
  const dispStageNums=numDispStages>1
    ?Array.from({length:numDispStages},(_,i)=>i+1)
    :(curCat?[...new Set(runList.filter(r=>r.catId===curCat.id&&r.stNum!=null).map(r=>r.stNum))].sort((a,b)=>a-b):[]);
  const multiDispStage=dispStageNums.length>1;
  // For single-stage or overall, use AutoScrollList for smooth scroll
  const ranked=curCat?computeRanked(runList,curCat.id):[];
  if(!info)return<div style={{background:'#000',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><Spinner/></div>;
  const cols=activeArr.length>=2?2:1;
  return(
    <div className="display-root">
      {/* ── Header ── */}
      <div style={{padding:'18px 24px 14px',borderBottom:'1px solid rgba(255,255,255,.07)',display:'flex',alignItems:'center',gap:16,background:'radial-gradient(ellipse at 50% -40%,rgba(255,94,58,.07) 0%,transparent 60%)'}}>
        <div style={{display:'flex',gap:6,flexShrink:0}}>
          {onBackToCoordinator&&(
            <button onClick={onBackToCoordinator} style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',borderRadius:10,padding:'7px 10px',cursor:'pointer',color:'rgba(255,255,255,.55)',display:'flex',alignItems:'center',gap:5,fontSize:12,fontWeight:600,transition:'background .15s,color .15s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.12)';e.currentTarget.style.color='#fff';}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.06)';e.currentTarget.style.color='rgba(255,255,255,.55)';}}>
              <I.ChevL s={16}/>{lang==='de'?'Koordination':'Coordinator'}
            </button>
          )}
          {onBack&&(
            <button onClick={onBack} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',borderRadius:10,padding:'7px 10px',cursor:'pointer',color:'rgba(255,255,255,.4)',display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,transition:'background .15s,color .15s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.1)';e.currentTarget.style.color='rgba(255,255,255,.7)';}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.04)';e.currentTarget.style.color='rgba(255,255,255,.4)';}}>
              <I.Settings s={13}/>{lang==='de'?'Anzeige':'Display'}
            </button>
          )}
        </div>
        <CompEmoji emoji={info.emoji} logo={info.logo} s={40}/>
        <div style={{flex:1}}><div style={{fontSize:11,color:'rgba(255,255,255,.35)',letterSpacing:'.1em',textTransform:'uppercase'}}>Ninja Competition Tool</div><div style={{fontSize:21,fontWeight:900,letterSpacing:'-.5px',marginTop:1}}>{info.name}</div></div>
        <div className="live-badge"><div className="live-dot"/>Live</div>
        {onOpenJury&&(
          <div style={{position:'relative',flexShrink:0}}>
            <button onClick={()=>setShowJuryPicker(p=>!p)}
              style={{background:'rgba(255,94,58,.15)',border:'1px solid rgba(255,94,58,.35)',borderRadius:10,padding:'7px 11px',cursor:'pointer',color:'#FF9040',display:'flex',alignItems:'center',gap:5,fontSize:12,fontWeight:700,transition:'background .15s'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,94,58,.25)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(255,94,58,.15)'}>
              <I.Bolt s={14}/>{lang==='de'?'Jury':'Jury'}
            </button>
            {showJuryPicker&&(
              <div style={{position:'absolute',top:'calc(100% + 6px)',right:0,background:'#1c1c1e',border:'1px solid rgba(255,255,255,.12)',borderRadius:12,padding:8,display:'flex',flexDirection:'column',gap:5,zIndex:200,minWidth:130,boxShadow:'0 8px 32px rgba(0,0,0,.5)'}}>
                <div style={{fontSize:10,color:'rgba(255,255,255,.4)',letterSpacing:'.08em',textTransform:'uppercase',padding:'2px 8px 4px'}}>Stage wählen</div>
                {Array.from({length:info.numStations||1},(_,i)=>{
                  const n=i+1;
                  const stageName=info.stageNames?.[n]||`Stage ${n}`;
                  const isOcc=activeArr.some(r=>r.stNum===n&&r.phase!=='done');
                  return(
                    <button key={n} onClick={()=>{setShowJuryPicker(false);onOpenJury(n);}}
                      style={{background:isOcc?'rgba(255,94,58,.12)':'rgba(255,255,255,.05)',border:`1px solid ${isOcc?'rgba(255,94,58,.35)':'rgba(255,255,255,.08)'}`,borderRadius:8,padding:'8px 12px',cursor:'pointer',color:'#fff',fontSize:13,fontWeight:600,textAlign:'left',display:'flex',alignItems:'center',gap:8}}>
                      {isOcc&&<span style={{width:7,height:7,borderRadius:'50%',background:'#FF5E3A',display:'inline-block',animation:'pulse 1.4s infinite'}}/>}
                      {stageName}
                    </button>
                  );
                })}
              </div>
            )}
            {showJuryPicker&&<div style={{position:'fixed',inset:0,zIndex:199}} onClick={()=>setShowJuryPicker(false)}/>}
          </div>
        )}
      </div>

      {/* ── Active Stage Cards (Presenter Mode) ── */}
      {activeArr.length>0&&(
        <div style={{padding:'16px 20px',display:'grid',gridTemplateColumns:`repeat(${cols},1fr)`,gap:16}}>
          {activeArr.map((run)=>{
            const ath=athMap[run.athleteId]||{name:run.athleteName||'?'};
            const cat=IGN_CATS.find(c=>c.id===run.catId);
            const lastCP=run.doneCP&&run.doneCP.length>0?run.doneCP[run.doneCP.length-1]:null;
            const isCountdown=run.phase==='countdown'&&(run.countdown>0);
            const elapsed=run.startEpoch?nowMs-run.startEpoch:0;
            const catColor=cat?.color||'#FF5E3A';
            const stageTimeLimit=(()=>{const sl=info.stageLimits?.[run.stNum];return((sl!=null&&sl!=='')?sl:(info.timeLimit||0))*1000;})();
            const isTimedOut=stageTimeLimit>0&&elapsed>=stageTimeLimit&&run.phase!=='done'&&!isCountdown;
            return(
              <div key={run.stNum} style={{position:'relative',background:'var(--card)',borderRadius:20,border:`1px solid ${catColor}30`,overflow:'hidden',boxShadow:`0 8px 32px rgba(0,0,0,.4),0 0 0 1px ${catColor}18`}}>
                {/* Accent strip */}
                <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${catColor},${catColor}60)`}}/>
                {/* Countdown overlay */}
                {isCountdown&&(
                  <div style={{position:'absolute',inset:0,background:'rgba(11,11,20,.94)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:10,borderRadius:20}}>
                    <div className="timer-grad" style={{fontSize:cols===1?150:110,lineHeight:1,letterSpacing:'-6px',animation:'scaleIn .3s cubic-bezier(.16,1,.3,1)'}}>{run.countdown}</div>
                    <div style={{fontSize:13,color:'rgba(255,255,255,.5)',letterSpacing:'.18em',textTransform:'uppercase',fontWeight:700,marginTop:8}}>{info.stageNames?.[run.stNum]||`Stage ${run.stNum}`} · {lang==='de'?'Bereit…':'Get ready…'}</div>
                  </div>
                )}
                {/* Timeout overlay */}
                {isTimedOut&&(
                  <div style={{position:'absolute',inset:0,background:'rgba(11,11,20,.93)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:9,borderRadius:20,gap:8}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:cols===1?64:52,height:cols===1?64:52,borderRadius:'50%',background:'rgba(255,200,0,.12)',border:'2px solid rgba(255,200,0,.35)'}}><I.Clock s={cols===1?36:28} c="var(--gold)"/></div>
                    <div style={{fontSize:cols===1?28:22,fontWeight:900,color:'var(--gold)',letterSpacing:'-.3px'}}>{lang==='de'?'ZEIT AB!':'TIME UP!'}</div>
                    <div style={{fontFamily:'JetBrains Mono',fontSize:cols===1?22:18,fontWeight:700,color:'rgba(255,255,255,.7)'}}>{fmtMs(stageTimeLimit)}</div>
                    {lastCP&&<div style={{fontSize:12,color:'rgba(255,255,255,.45)',display:'flex',alignItems:'center',gap:5,marginTop:2}}><span style={{color:'var(--green)'}}>✓</span>{lang==='de'?'Letzter CP:':'Last CP:'} {lastCP.name}</div>}
                    <div style={{fontSize:11,color:'rgba(255,255,255,.3)',marginTop:4}}>{run.doneCP?.length||0} CP{(run.doneCP?.length||0)!==1?'s':''} · {ath.name}</div>
                  </div>
                )}
                {/* Restarting overlay — shown when jury pressed "restart run" */}
                {run.phase==='restarting'&&(
                  <div style={{position:'absolute',inset:0,background:'rgba(11,11,20,.93)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:11,borderRadius:20,gap:10}}>
                    <div style={{width:cols===1?60:50,height:cols===1?60:50,borderRadius:'50%',background:'rgba(255,200,80,.1)',border:'2px solid rgba(255,200,80,.3)',display:'flex',alignItems:'center',justifyContent:'center'}}><I.RefreshCw s={cols===1?34:28} c="#FFD060"/></div>
                    <div style={{fontSize:cols===1?24:20,fontWeight:900,color:'#FFD060',letterSpacing:'-.3px',textAlign:'center',padding:'0 12px'}}>{lang==='de'?'Lauf wird neu gestartet':'Run restarting…'}</div>
                    <div style={{fontSize:13,color:'rgba(255,255,255,.45)',marginTop:4}}>{ath.name||run.athleteName}</div>
                  </div>
                )}
                {/* Done result overlay — fades after 3s, shows next athlete after 5s */}
                {run.phase==='done'&&(()=>{
                  const doneAge=nowMs-(doneStartRef.current[run.stNum]||nowMs);
                  const showNext=doneAge>5000;
                  const resultOpacity=showNext?0:1;
                  const nextQueue=getQueue(run.catId);
                  return(
                    <div style={{position:'absolute',inset:0,background:'rgba(11,11,20,.93)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:10,borderRadius:20,gap:6,transition:'background .4s',overflow:'hidden'}}>
                      {/* Result (fades out after 5s) */}
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,transition:'opacity .5s,transform .5s',opacity:resultOpacity,transform:showNext?'translateY(-20px)':'translateY(0)'}}>
                        {run.status==='complete'
                          ?<>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:cols===1?64:52,height:cols===1?64:52,borderRadius:'50%',background:'rgba(52,199,89,.15)',border:'2px solid rgba(52,199,89,.3)'}}><I.CheckCircle s={cols===1?36:28} c="var(--green)"/></div>
                            <div style={{fontSize:cols===1?36:28,fontWeight:900,color:'var(--green)',letterSpacing:'-.5px'}}>{lang==='de'?'Gebuzzert!':'Buzzer!'}</div>
                            {run.finalTime&&<div style={{fontFamily:'JetBrains Mono',fontSize:cols===1?34:26,fontWeight:700,color:'#FF5E3A'}}>{fmtMs(run.finalTime)}</div>}
                            <div style={{fontSize:12,color:'rgba(255,255,255,.45)',display:'flex',alignItems:'center',gap:5}}><I.Bolt s={12} c="rgba(255,255,255,.45)"/> Buzzer</div>
                          </>
                          :run.status==='dsq'
                          ?<>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:cols===1?64:52,height:cols===1?64:52,borderRadius:'50%',background:'rgba(255,0,80,.15)',border:'2px solid rgba(255,0,80,.35)'}}><I.XCircle s={cols===1?36:28} c="#FF3B6B"/></div>
                            <div style={{fontSize:cols===1?32:26,fontWeight:900,color:'#FF3B6B',letterSpacing:'-.3px'}}>DSQ</div>
                            <div style={{fontSize:12,color:'rgba(255,255,255,.35)',letterSpacing:'.06em'}}>{lang==='de'?'Disqualifiziert':'Disqualified'}</div>
                          </>
                          :<>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:cols===1?64:52,height:cols===1?64:52,borderRadius:'50%',background:'rgba(255,59,48,.15)',border:'2px solid rgba(255,59,48,.3)'}}><I.StopOct s={cols===1?36:28} c="var(--red)"/></div>
                            <div style={{fontSize:cols===1?32:26,fontWeight:900,color:'var(--red)',letterSpacing:'-.3px'}}>FAIL</div>
                            {run.finalTime>0&&<div style={{fontFamily:'JetBrains Mono',fontSize:cols===1?30:24,fontWeight:700,color:'rgba(255,255,255,.65)',letterSpacing:'-1px'}}>{fmtMs(run.finalTime)}</div>}
                            {run.fellAt?.name&&<div style={{fontSize:cols===1?15:13,color:'rgba(255,255,255,.55)',textAlign:'center',padding:'0 8px',display:'flex',alignItems:'center',gap:5,justifyContent:'center'}}><I.XCircle s={14} c="rgba(255,255,255,.45)"/> {run.fellAt.name}</div>}
                            {run.doneCP?.length>0&&<div style={{fontSize:12,color:'rgba(255,255,255,.35)',fontFamily:'JetBrains Mono'}}>{run.doneCP.length} CPs</div>}
                          </>
                        }
                        <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,.25)',letterSpacing:'.08em',marginTop:2}}>{ath.name||run.athleteName}</div>
                      </div>
                      {/* Next athlete slides up after 5s */}
                      {showNext&&nextQueue.length>0&&(()=>{const nx=nextQueue[0];return(
                        <div className="slide-up-in" style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,padding:'20px 16px'}}>
                          <div style={{fontSize:11,fontWeight:800,color:'rgba(255,255,255,.3)',letterSpacing:'.14em',textTransform:'uppercase',marginBottom:2,display:'flex',alignItems:'center',gap:5}}><I.SkipFwd s={11} c="rgba(255,255,255,.3)"/>{lang==='de'?'Nächster Start':'Up Next'}</div>
                          {nx.photo
                            ?<img src={nx.photo} style={{width:cols===1?72:60,height:cols===1?72:60,borderRadius:'50%',objectFit:'cover',border:`3px solid ${catColor}60`,boxShadow:`0 0 20px ${catColor}40`}}/>
                            :<div style={{width:cols===1?72:60,height:cols===1?72:60,borderRadius:'50%',background:`radial-gradient(135deg,${catColor}40,${catColor}15)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:cols===1?30:24,fontWeight:900,color:catColor,border:`2px solid ${catColor}40`}}>{(nx.name||'?')[0].toUpperCase()}</div>
                          }
                          <div style={{textAlign:'center'}}>
                            <div style={{fontSize:cols===1?26:20,fontWeight:900,letterSpacing:'-.5px'}}>{nx.country&&<span style={{marginRight:5}}>{toFlag(nx.country)}</span>}{nx.name}</div>
                            <div style={{fontSize:12,color:'rgba(255,255,255,.4)',marginTop:3,display:'flex',gap:8,justifyContent:'center',alignItems:'center',flexWrap:'wrap'}}>
                              <span style={{fontFamily:'JetBrains Mono'}}>#{nx.num}</span>
                              {nx.team&&<span style={{color:`${catColor}CC`,fontWeight:600}}>{nx.team}</span>}
                            </div>
                          </div>
                          {nextQueue.length>1&&<div style={{fontSize:11,color:'rgba(255,255,255,.22)',marginTop:4}}>{lang==='de'?`Danach: ${nextQueue[1].name}`:`Then: ${nextQueue[1].name}`}</div>}
                        </div>
                      );})()}
                    </div>
                  );
                })()}
                <div style={{padding:cols===1?'22px 24px':'18px 20px'}}>
                  {/* Stage + category row */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                      <div style={{fontSize:11,fontWeight:800,color:'rgba(255,255,255,.35)',letterSpacing:'.1em',textTransform:'uppercase'}}>Stage {info.stageNames?.[run.stNum]||run.stNum}</div>
                      {stageTimeLimit>0&&<div style={{fontSize:10,fontWeight:700,color:isTimedOut?'var(--gold)':'rgba(255,255,255,.25)',fontFamily:'JetBrains Mono',background:'rgba(255,255,255,.05)',borderRadius:6,padding:'1px 6px',display:'flex',alignItems:'center',gap:3}}><I.Clock s={9} c={isTimedOut?'var(--gold)':'rgba(255,255,255,.25)'}/> {fmtMs(stageTimeLimit).slice(0,-4)}</div>}
                    </div>
                    {cat&&<div style={{fontSize:11,padding:'3px 11px',borderRadius:20,background:`${catColor}20`,border:`1px solid ${catColor}40`,color:catColor,fontWeight:700}}>{catName(cat)}</div>}
                  </div>
                  {/* Athlete presenter info */}
                  <div style={{display:'flex',gap:14,alignItems:'center',marginBottom:16}}>
                    {ath.photo
                      ?<img src={ath.photo} style={{width:cols===1?68:56,height:cols===1?68:56,borderRadius:'50%',objectFit:'cover',border:`2.5px solid ${catColor}60`,flexShrink:0,boxShadow:`0 4px 16px rgba(0,0,0,.4)`}}/>
                      :<div style={{width:cols===1?68:56,height:cols===1?68:56,borderRadius:'50%',background:`radial-gradient(135deg,${catColor}30,${catColor}10)`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:`2px solid ${catColor}30`}}><I.Ninja s={cols===1?32:26} c={`${catColor}90`}/></div>
                    }
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:cols===1?26:20,fontWeight:900,letterSpacing:'-.6px',lineHeight:1.15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{ath.name||run.athleteName}</div>
                      <div style={{fontSize:12,color:'rgba(255,255,255,.45)',marginTop:4,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                        <span style={{fontFamily:'JetBrains Mono'}}>#{ath.num||'?'}</span>
                        {ath.country&&<span style={{background:'rgba(255,255,255,.07)',borderRadius:6,padding:'1px 6px',fontSize:11}}>{toFlag(ath.country)} {ath.country}</span>}
                        {ath.team&&<span style={{color:`${catColor}CC`,fontWeight:600,fontSize:11}}>{ath.team}</span>}
                      </div>
                    </div>
                  </div>
                  {/* Live timer */}
                  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:lastCP?10:0}}>
                    <div className="live-dot"/>
                    <div style={{fontFamily:'JetBrains Mono',fontSize:cols===1?36:28,fontWeight:700,color:'#FF5E3A',letterSpacing:'-1px'}}>{fmtMs(elapsed)}</div>
                    {run.livesLeft!=null&&run.livesLeft>0&&(
                      <div style={{marginLeft:'auto',display:'flex',gap:4,alignItems:'center'}}>
                        {Array.from({length:run.livesLeft}).map((_,i)=>(
                          <div key={i} style={{width:8,height:8,borderRadius:'50%',background:'var(--green)',boxShadow:'0 0 6px rgba(52,199,89,.6)'}}/>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Last checkpoint with ski-racing split delta */}
                  {lastCP&&(()=>{
                    const cpIdx=run.doneCP.length-1;
                    const cpTime=lastCP.time;
                    const bestKey=`${run.catId}_${run.stNum||1}_${cpIdx}`;
                    const best=bestSplits[bestKey];
                    const delta=best&&typeof cpTime==='number'&&typeof best.time==='number'?(cpTime-best.time):null;
                    return(
                      <div style={{marginTop:6,display:'flex',flexDirection:'column',gap:4}}>
                        <div style={{display:'flex',alignItems:'center',gap:7,padding:'6px 10px',background:'rgba(52,199,89,.08)',borderRadius:10,border:'1px solid rgba(52,199,89,.15)'}}>
                          <span style={{color:'var(--green)',fontSize:14,flexShrink:0}}>✓</span>
                          <span style={{fontSize:12,color:'rgba(255,255,255,.5)',flexShrink:0}}>CP:</span>
                          <span style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,.85)',flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{lastCP.name||lastCP}</span>
                          <span style={{fontSize:11,color:'rgba(255,255,255,.3)',flexShrink:0,fontFamily:'JetBrains Mono'}}>{run.doneCP.length}×</span>
                        </div>
                        {delta!==null&&(
                          <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:8,background:delta<=0?'rgba(52,199,89,.08)':'rgba(255,59,48,.08)',border:`1px solid ${delta<=0?'rgba(52,199,89,.15)':'rgba(255,59,48,.15)'}`}}>
                            <span style={{fontFamily:'JetBrains Mono',fontSize:cols===1?16:13,fontWeight:900,color:delta<=0?'var(--green)':'var(--red)',letterSpacing:'-.5px'}}>
                              {delta<=0?'−':'+'}{fmtMs(Math.abs(delta))}
                            </span>
                            <span style={{fontSize:10,color:'rgba(255,255,255,.35)',flex:1}}>vs {best.athleteName}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Next athletes strip ── */}
      {activeArr.length>0&&(()=>{
        // collect queues for each active stage (excluding done-phase stages that already show next inline)
        const strips=activeArr.map(run=>{
          const q=getQueue(run.catId);
          // show next 2, but skip if "done" phase already shows next inline (after 5s)
          const doneAge=run.phase==='done'?nowMs-(doneStartRef.current[run.stNum]||nowMs):0;
          if(run.phase==='done'&&doneAge>5000)return null; // inline already showing
          if(q.length===0)return null;
          const cat=IGN_CATS.find(c=>c.id===run.catId);
          const catColor=cat?.color||'#FF5E3A';
          return{stNum:run.stNum,q:q.slice(0,2),catColor,cat};
        }).filter(Boolean);
        if(!strips.length)return null;
        return(
          <div style={{padding:'0 20px 14px',display:'grid',gridTemplateColumns:`repeat(${Math.min(strips.length,cols)},1fr)`,gap:12}}>
            {strips.map(({stNum,q,catColor,cat})=>(
              <div key={stNum} style={{background:'rgba(255,255,255,.03)',border:`1px solid ${catColor}20`,borderRadius:14,padding:'10px 14px'}}>
                <div style={{fontSize:10,fontWeight:800,color:'rgba(255,255,255,.3)',letterSpacing:'.12em',textTransform:'uppercase',marginBottom:8}}>{lang==='de'?'Nächste':'Up Next'} · {info.stageNames?.[stNum]||`Stage ${stNum}`}</div>
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  {q.map((a,i)=>(
                    <div key={a.id} className={i===0?'slide-up-in':''} style={{display:'flex',alignItems:'center',gap:10,animationDelay:i===0?'0s':'0.1s'}}>
                      <div style={{width:16,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>{i===0?<I.Play s={10} c={catColor}/>:<div style={{width:4,height:4,borderRadius:'50%',background:'rgba(255,255,255,.2)'}}/>}</div>
                      {a.photo
                        ?<img src={a.photo} style={{width:i===0?34:26,height:i===0?34:26,borderRadius:'50%',objectFit:'cover',flexShrink:0,border:`1.5px solid ${i===0?catColor+'60':'rgba(255,255,255,.1)'}`,transition:'all .3s'}}/>
                        :<div style={{width:i===0?34:26,height:i===0?34:26,borderRadius:'50%',flexShrink:0,background:i===0?`linear-gradient(135deg,${catColor}30,${catColor}10)`:'rgba(255,255,255,.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:i===0?14:11,fontWeight:800,color:i===0?catColor:'rgba(255,255,255,.3)',transition:'all .3s'}}>{(a.name||'?')[0].toUpperCase()}</div>
                      }
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:i===0?15:12,fontWeight:i===0?800:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',color:i===0?'#fff':'rgba(255,255,255,.45)'}}>
                          {a.country&&<span style={{marginRight:4}}>{toFlag(a.country)}</span>}{a.name}
                        </div>
                        {(a.team||a.num)&&<div style={{fontSize:10,color:'rgba(255,255,255,.28)',marginTop:1,fontFamily:'JetBrains Mono'}}>#{a.num}{a.team&&<span style={{marginLeft:5,fontFamily:'Inter,sans-serif',color:i===0?`${catColor}99`:'rgba(255,255,255,.2)'}}>{a.team}</span>}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Multi-division overview grid (shown when no active runs, multiple cats, narrow screen) ── */}
      {!isWide&&activeArr.length===0&&catsWithData.length>1&&(
        <div style={{padding:'18px 20px 10px'}}>
          <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(catsWithData.length,4)},1fr)`,gap:10}}>
            {catsWithData.map(c=>{
              const r=computeRanked(runList,c.id).slice(0,5);
              return(
                <div key={c.id} style={{background:'var(--card)',borderRadius:14,border:`1px solid ${c.color}20`,overflow:'hidden',cursor:'pointer'}} onClick={()=>{const idx=catsWithData.indexOf(c);if(idx>=0)setCatIdx(idx);}}>
                  <div style={{padding:'8px 12px',borderBottom:`1px solid ${c.color}15`,display:'flex',alignItems:'center',gap:6,background:`${c.color}08`}}>
                    <div style={{width:6,height:6,borderRadius:'50%',background:c.color,flexShrink:0}}/>
                    <div style={{fontSize:11,fontWeight:700,color:c.color,flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{catName(c)}</div>
                    <div style={{fontSize:9,color:'rgba(255,255,255,.3)',fontFamily:'JetBrains Mono'}}>{r.length}</div>
                  </div>
                  <div style={{padding:'4px 0'}}>
                    {r.map((run,i)=>{const a=athMap[run.athleteId]||{name:run.athleteName||'?'};return(
                      <div key={run.athleteId} style={{display:'flex',alignItems:'center',gap:5,padding:'3px 10px',fontSize:11}}>
                        <span style={{width:16,fontWeight:800,color:i<3?medalColors[i]:'rgba(255,255,255,.3)',fontFamily:'JetBrains Mono',flexShrink:0,textAlign:'center'}}>{run.status==='dsq'?'—':(i+1)}</span>
                        <span style={{flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontWeight:i===0?700:500,color:i===0?'#fff':'rgba(255,255,255,.5)'}}>{a.name}</span>
                        <span style={{fontSize:9,fontFamily:'JetBrains Mono',color:run.status==='complete'?(i<3?medalColors[i]:'rgba(255,255,255,.4)'):'rgba(255,255,255,.25)',flexShrink:0}}>{run.finalTime>0?fmtMs(run.finalTime).slice(0,-4):'—'}</span>
                      </div>
                    );})}
                    {r.length===0&&<div style={{padding:'12px 10px',fontSize:10,color:'rgba(255,255,255,.2)',textAlign:'center'}}>—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Rankings ── */}

      {/* Wide screen: ALL categories side by side with auto-scroll */}
      {isWide&&catsWithData.length>0&&(
        <div style={{padding:'12px 20px 40px',display:'grid',gridTemplateColumns:`repeat(${Math.min(catsWithData.length,4)},minmax(260px,1fr))`,gap:14}}>
          {catsWithData.map(cat=>{
            const catRanked=computeRanked(runList,cat.id);
            const numSt=info?.numStations||1;
            const catStageNums=numSt>1?Array.from({length:numSt},(_,i)=>i+1):[...new Set(runList.filter(r=>r.catId===cat.id&&r.stNum!=null).map(r=>r.stNum))].sort((a,b)=>a-b);
            const catMulti=catStageNums.length>1;
            return(
              <div key={cat.id} style={{background:'var(--card)',borderRadius:18,border:`1px solid ${cat.color}28`,overflow:'hidden',display:'flex',flexDirection:'column'}}>
                <div style={{padding:'12px 16px',background:`${cat.color}10`,borderBottom:`1px solid ${cat.color}1E`,display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:cat.color,flexShrink:0}}/>
                  <span style={{fontSize:14,fontWeight:800,color:cat.color}}>{catName(cat)}</span>
                  <span style={{fontSize:11,color:'rgba(255,255,255,.3)',fontFamily:'JetBrains Mono',marginLeft:'auto'}}>{catRanked.length}</span>
                </div>
                {catMulti?(
                  <div style={{display:'grid',gridTemplateColumns:`minmax(180px,1.3fr) repeat(${Math.min(catStageNums.length,4)},minmax(120px,1fr))`}}>
                    {/* Gesamt / Overall column */}
                    {(()=>{const msRanked=computeRankedMultiStage(runList,cat.id,catStageNums);return(
                      <div style={{borderRight:'1px solid rgba(255,255,255,.06)'}}>
                        <div style={{padding:'5px 10px',borderBottom:'1px solid rgba(255,255,255,.04)',fontSize:10,fontWeight:700,color:'rgba(255,144,64,.7)',letterSpacing:'.06em',display:'flex',alignItems:'center',gap:5}}><I.Trophy s={9} c="rgba(255,144,64,.7)"/> Gesamt</div>
                        <AutoScrollList itemCount={msRanked.length} tvMode={true} topPause={5000} minItems={3} maxH="calc(100vh - 250px)">
                          {msRanked.map((r,i)=>{const a=athMap[r.athleteId]||{name:r.athleteName||'?',num:'?'};return(
                            <div key={r.athleteId} style={{display:'flex',alignItems:'center',gap:5,padding:'6px 10px',borderBottom:'1px solid rgba(255,255,255,.03)',opacity:r.status==='dsq'?.5:1}}>
                              <div style={{fontSize:10,fontWeight:800,color:i===0?medalColors[0]:i===1?medalColors[1]:i===2?medalColors[2]:'rgba(255,255,255,.22)',width:14,textAlign:'center',flexShrink:0}}>{r.status==='dsq'?'—':i+1}</div>
                              {a.photo?<img src={a.photo} style={{width:20,height:20,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>:null}
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:11,fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.name}</div>
                                <div style={{display:'flex',flexWrap:'wrap',gap:2,marginTop:2}}>
                                  {catStageNums.map(sn=>{const bd=r.stageBreakdown?.[String(sn)];if(!bd)return null;return(<span key={sn} style={{fontSize:8,fontFamily:'JetBrains Mono',color:'rgba(255,255,255,.4)',padding:'0 3px',background:'rgba(255,255,255,.04)',borderRadius:4}}><span style={{color:'rgba(255,144,64,.8)',fontWeight:700}}>S{sn}</span> {bd.doneCP?.length||0}/{bd.totalCPs||'?'} {bd.finalTime>0?fmtMs(bd.finalTime):'?'}</span>);})}
                                </div>
                              </div>
                              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:1,flexShrink:0}}>
                                <div style={{fontFamily:'JetBrains Mono',fontSize:10,fontWeight:700,color:r.status==='dsq'?'#FF3B6B':i<3?medalColors[Math.min(i,2)]:'rgba(255,255,255,.5)'}}>{r.status==='dsq'?'DSQ':r.totalTime>0?fmtMs(r.totalTime):'—'}</div>
                                <div style={{fontSize:8,color:'rgba(255,255,255,.3)',fontFamily:'JetBrains Mono'}}>{r.totalCPs} CPs</div>
                              </div>
                            </div>
                          );})}
                        </AutoScrollList>
                      </div>
                    );})()}
                    {catStageNums.map((stN,si)=>{
                      const stRanked=computeRankedStage(runList,cat.id,stN);
                      return(
                        <div key={stN} style={{borderRight:si<catStageNums.length-1?'1px solid rgba(255,255,255,.05)':'none'}}>
                          <div style={{padding:'5px 10px',borderBottom:'1px solid rgba(255,255,255,.04)',fontSize:10,fontWeight:700,color:'rgba(255,255,255,.35)',letterSpacing:'.06em'}}>{info.stageNames?.[stN]||`S${stN}`}</div>
                          <AutoScrollList itemCount={stRanked.length} tvMode={true} topPause={5000} minItems={3} maxH="calc(100vh - 250px)">
                            {stRanked.map((r,i)=>{const a=athMap[r.athleteId]||{name:r.athleteName||'?',num:'?'};return(
                              <div key={r.athleteId} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderBottom:'1px solid rgba(255,255,255,.03)',opacity:r.status==='dsq'?.5:1}}>
                                <div style={{fontSize:10,fontWeight:800,color:i===0?medalColors[0]:i===1?medalColors[1]:i===2?medalColors[2]:'rgba(255,255,255,.25)',width:16,textAlign:'center',flexShrink:0}}>{r.status==='dsq'?'—':i+1}</div>
                                {a.photo?<img src={a.photo} style={{width:22,height:22,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>:null}
                                <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.name}</div></div>
                                <div style={{fontFamily:'JetBrains Mono',fontSize:10,fontWeight:700,color:r.status==='dsq'?'#FF3B6B':r.status==='complete'?medalColors[Math.min(i,2)]:'rgba(255,255,255,.4)',flexShrink:0}}>{r.status==='dsq'?'DSQ':r.finalTime>0?fmtMs(r.finalTime):'—'}</div>
                              </div>
                            );})}
                          </AutoScrollList>
                        </div>
                      );
                    })}
                  </div>
                ):(
                  <AutoScrollList itemCount={catRanked.length} tvMode={true} topPause={5000} minItems={3} maxH="calc(100vh - 200px)">
                    {catRanked.map((r,i)=>{const a=athMap[r.athleteId]||{name:r.athleteName||'?',num:'?'};const isDsqR=r.status==='dsq';return(
                      <div key={r.athleteId} style={{display:'flex',alignItems:'center',gap:10,padding:i<3?'10px 16px':'7px 14px',borderBottom:'1px solid rgba(255,255,255,.03)',background:i===0?`${cat.color}09`:i<3?`${cat.color}04`:'transparent',opacity:isDsqR?.6:1}}>
                        {isDsqR?<div style={{fontSize:9,fontWeight:900,color:'#FF3B6B',width:22,textAlign:'center',flexShrink:0}}>DSQ</div>:i<3?<MedalBadge pos={i} s={i===0?28:22}/>:<div style={{width:22,height:22,borderRadius:'50%',background:'rgba(255,255,255,.04)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'rgba(255,255,255,.28)',flexShrink:0}}>{i+1}</div>}
                        {a.photo?<img src={a.photo} style={{width:i<3?32:26,height:i<3?32:26,borderRadius:'50%',objectFit:'cover',flexShrink:0,border:`1.5px solid ${i===0?cat.color+'60':i<3?cat.color+'30':'rgba(255,255,255,.08)'}`}}/>:null}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:i===0?16:i<3?14:12,fontWeight:i<3?800:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.name}</div>
                          <div style={{fontSize:10,color:'rgba(255,255,255,.32)',marginTop:1}}>#{a.num}{a.team&&<span style={{marginLeft:5,color:`${cat.color}99`,fontWeight:600}}>{a.team}</span>} · {r.doneCP?.length||0} CPs{r.status==='complete'&&<span style={{color:'var(--green)',marginLeft:3}}>✓</span>}</div>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2,flexShrink:0}}>
                          <div style={{fontFamily:'JetBrains Mono',fontSize:i===0?16:13,fontWeight:700,color:isDsqR?'#FF3B6B':r.status!=='complete'&&r.finalTime>0?'rgba(255,255,255,.45)':medalColors[Math.min(i,2)]}}>{isDsqR?'DSQ':r.finalTime>0?fmtMs(r.finalTime):'—'}</div>
                          <LifeDots run={r} size={5}/>
                        </div>
                      </div>
                    );})}
                  </AutoScrollList>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Narrow screen: category pills + single cycling category with auto-scroll */}
      {!isWide&&(
        <>
          {catsWithData.length>1&&(
            <div style={{padding:'10px 20px 0',display:'flex',gap:7,overflowX:'auto'}}>
              {catsWithData.map((c,i)=>(
                <button key={c.id} style={{padding:'5px 14px',borderRadius:20,fontSize:12,fontWeight:700,border:'none',cursor:'pointer',flexShrink:0,background:i===catIdx?c.color:'rgba(255,255,255,.06)',color:i===catIdx?'#fff':'rgba(255,255,255,.4)',transition:'all .4s'}} onClick={()=>setCatIdx(i)}>{catName(c)}</button>
              ))}
            </div>
          )}
          {!curCat&&activeArr.length===0&&<div style={{padding:'80px 24px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}><div style={{width:64,height:64,borderRadius:'50%',background:'rgba(255,94,58,.06)',border:'1px solid rgba(255,94,58,.15)',display:'flex',alignItems:'center',justifyContent:'center'}}><I.Trophy s={30} c="rgba(255,255,255,.15)"/></div><div style={{fontSize:18,color:'rgba(255,255,255,.35)'}}>{lang==='de'?'Noch keine Ergebnisse':'No results yet'}</div></div>}
          {curCat&&(
            <div style={{padding:'18px 20px 40px'}}>
              <div style={{marginBottom:12}}><div style={{display:'inline-flex',alignItems:'center',gap:8,padding:'5px 14px',borderRadius:20,background:`${curCat.color}20`,border:`1px solid ${curCat.color}30`}}><div style={{width:8,height:8,borderRadius:'50%',background:curCat.color}}/><span style={{fontSize:13,fontWeight:700,color:curCat.color}}>{catName(curCat)}</span></div></div>
              {multiDispStage?(
                <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(dispStageNums.length,2)},1fr)`,gap:10}}>
                  {dispStageNums.map(stN=>{
                    const stRanked=computeRankedStage(runList,curCat.id,stN);
                    return(
                      <div key={stN} style={{background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',overflow:'hidden'}}>
                        <div style={{padding:'8px 12px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:7,background:'rgba(255,255,255,.02)'}}>
                          <div style={{width:24,height:24,borderRadius:7,background:'linear-gradient(135deg,var(--cor),var(--cor2))',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:12,color:'#fff',flexShrink:0}}>{stN}</div>
                          <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,.6)'}}>{info.stageNames?.[stN]||`Stage ${stN}`}</div>
                        </div>
                        <AutoScrollList itemCount={stRanked.length} tvMode={false} topPause={5000} minItems={4} maxH="55vh">
                          {stRanked.map((r,i)=>{const a=athMap[r.athleteId]||{name:r.athleteName||'?',num:'?'};return(
                            <div key={r.athleteId} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',borderBottom:'1px solid rgba(255,255,255,.03)',opacity:r.status==='dsq'?.55:1}}>
                              <div style={{fontSize:11,fontWeight:800,color:i===0?medalColors[0]:i===1?medalColors[1]:i===2?medalColors[2]:'rgba(255,255,255,.3)',width:18,textAlign:'center',flexShrink:0}}>{r.status==='dsq'?'—':i+1}</div>
                              {a.photo?<img src={a.photo} style={{width:24,height:24,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>:null}
                              <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.name}</div></div>
                              <div style={{fontFamily:'JetBrains Mono',fontSize:11,fontWeight:700,color:r.status==='dsq'?'#FF3B6B':r.status==='complete'?(i<3?medalColors[i]:'rgba(255,255,255,.7)'):'rgba(255,255,255,.45)'}}>{r.status==='dsq'?'DSQ':r.finalTime>0?fmtMs(r.finalTime):'—'}</div>
                            </div>
                          );})}
                        </AutoScrollList>
                      </div>
                    );
                  })}
                </div>
              ):(
                <AutoScrollList itemCount={ranked.length} tvMode={false} topPause={5000} minItems={4} maxH="72vh">
                  {ranked.map((r,i)=>{const a=athMap[r.athleteId]||{name:r.athleteName||'?',num:'?'};const isDsqR=r.status==='dsq';const isTop2=i<2;return(
                    <div key={r.athleteId} style={{display:'flex',alignItems:'center',gap:isTop2?12:8,padding:isTop2?'10px 14px':'6px 12px',borderRadius:isTop2?14:8,background:isDsqR?'rgba(255,59,80,.06)':i===0?`linear-gradient(135deg,${curCat.color}18,${curCat.color}06)`:i<3?`${curCat.color}08`:'rgba(255,255,255,.02)',border:i<3?`1px solid ${isDsqR?'rgba(255,59,80,.2)':curCat.color+(i===0?'30':'18')}`:'1px solid transparent',marginBottom:isTop2?6:2,opacity:isDsqR?.6:1}}>
                      {isDsqR?<div style={{width:28,height:28,borderRadius:'50%',background:'rgba(255,59,80,.12)',border:'1px solid rgba(255,59,80,.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,color:'#FF3B6B',flexShrink:0}}>DSQ</div>:i<3?<MedalBadge pos={i} s={isTop2?36:26}/>:<div style={{width:24,height:24,borderRadius:'50%',background:'rgba(255,255,255,.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'rgba(255,255,255,.3)',flexShrink:0}}>{i+1}</div>}
                      {a.photo?<img src={a.photo} style={{width:isTop2?32:24,height:isTop2?32:24,borderRadius:'50%',objectFit:'cover',flexShrink:0,border:`1.5px solid ${isDsqR?'rgba(255,59,80,.3)':curCat.color+'40'}`}}/>:null}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:isTop2?17:13,fontWeight:800,letterSpacing:'-.2px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.name}</div>
                        <div style={{fontSize:10,color:'rgba(255,255,255,.38)',marginTop:1}}>#{a.num}{a.team&&<span style={{marginLeft:5,fontWeight:600,color:'rgba(255,144,64,.7)'}}>{a.team}</span>} · {r.doneCP?.length||0} CPs</div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontFamily:'JetBrains Mono',fontSize:isTop2?16:12,fontWeight:700,color:isDsqR?'#FF3B6B':r.status!=='complete'&&r.finalTime>0?'rgba(255,255,255,.45)':medalColors[Math.min(i,2)]}}>{isDsqR?'DSQ':r.finalTime>0?fmtMs(r.finalTime):'—'}</div>
                        <LifeDots run={r} size={5}/>
                      </div>
                    </div>
                  );})}
                </AutoScrollList>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const DisplayNoComp=({onSelect})=>{
  const comps=useFbVal('ogn');const list=comps?Object.entries(comps).map(([id,v])=>({id,...v})):[];
  return(
    <div style={{background:'#000',minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:24}}>
      <div style={{width:64,height:64,borderRadius:18,background:'linear-gradient(135deg,#FF5E3A,#FF9040)',display:'flex',alignItems:'center',justifyContent:'center'}}><I.Bolt s={34} c="#fff"/></div><div style={{fontSize:20,fontWeight:900,color:'#fff'}}>Ninja Competition Tool</div>
      <div style={{fontSize:13,color:'rgba(255,255,255,.4)',marginBottom:6}}>Wettkampf auswählen</div>
      {list.length===0&&<Spinner/>}
      {list.map(c=>(
        <button key={c.id} style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',borderRadius:12,padding:'12px 28px',color:'#fff',cursor:'pointer',fontSize:15,fontWeight:600,width:'100%',maxWidth:340}} onClick={()=>onSelect(c.id)}>
          {c.info?.name||c.id} <span style={{opacity:.5,fontSize:12}}>{c.id}</span>
        </button>
      ))}
    </div>
  );
};

const InstallPrompt=({lang})=>{
  const de=lang==='de';
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)&&!window.MSStream;
  const isAndroid=/Android/.test(navigator.userAgent);
  const isStandalone=window.navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches;
  const [show,setShow]=useState(false);
  useEffect(()=>{
    if(isStandalone)return;
    if(storage.get('install-dismissed',false))return;
    if(!isIOS&&!isAndroid)return;
    const t=setTimeout(()=>setShow(true),2000);
    return()=>clearTimeout(t);
  },[]);
  if(!show)return null;
  const iosSteps=[
    {icon:'1️⃣',text:de?'Tippe auf das Teilen-Symbol ⬆️ in der Browser-Leiste unten (Safari)':'Tap the Share icon ⬆️ in the bottom browser bar (Safari)'},
    {icon:'2️⃣',text:de?'Scrolle runter und tippe «Zum Home-Bildschirm»':'Scroll down and tap "Add to Home Screen"'},
    {icon:'3️⃣',text:de?'Tippe oben rechts auf «Hinzufügen» — fertig!':'Tap "Add" in the top right — done!'},
  ];
  const androidSteps=[
    {icon:'1️⃣',text:de?'Tippe auf die drei Punkte ⋮ oben rechts in Chrome':'Tap the three dots ⋮ in the top right of Chrome'},
    {icon:'2️⃣',text:de?'Tippe auf «App installieren» oder «Zum Startbildschirm»':'Tap "Install app" or "Add to Home screen"'},
    {icon:'3️⃣',text:de?'Bestätige mit «Installieren» — fertig!':'Confirm with "Install" — done!'},
  ];
  const steps=isIOS?iosSteps:androidSteps;
  return(
    <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:300,padding:'0 10px 10px',animation:'slideUp .32s cubic-bezier(.16,1,.3,1)'}}>
      <div style={{background:'#1C1C2E',border:'1px solid rgba(255,94,58,.3)',borderRadius:20,padding:'18px 16px 14px',
        boxShadow:'0 -6px 40px rgba(0,0,0,.65)',maxWidth:520,margin:'0 auto'}}>
        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:14}}>
          <div style={{width:44,height:44,borderRadius:12,background:'linear-gradient(135deg,#FF5E3A,#FF9040)',
            display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><I.Bolt s={24} c="#fff"/></div>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:15,color:'#fff',letterSpacing:'-.2px',marginBottom:2}}>
              {de?'Als App installieren':'Install as App'}
            </div>
            <div style={{fontSize:12,color:'rgba(255,255,255,.5)'}}>
              {de?`Schneller Zugriff auf dem ${isIOS?'iPhone':'Android'}-Homescreen`
                :`Quick access on your ${isIOS?'iPhone':'Android'} home screen`}
            </div>
          </div>
          <button style={{background:'rgba(255,255,255,.07)',border:'none',borderRadius:8,
            padding:'6px 8px',cursor:'pointer',color:'rgba(255,255,255,.45)',fontSize:15,lineHeight:1,display:'flex'}}
            onClick={()=>setShow(false)}>✕</button>
        </div>
        {/* Steps */}
        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
          <div style={{fontSize:11,color:'rgba(255,94,58,.9)',fontWeight:700,letterSpacing:'.1em',
            textTransform:'uppercase',marginBottom:2}}>
            {isIOS?'iPhone / iPad — Safari':'Android — Chrome'}
          </div>
          {steps.map((s,i)=>(
            <div key={i} style={{display:'flex',gap:10,alignItems:'flex-start',
              padding:'9px 12px',borderRadius:11,background:'rgba(255,255,255,.04)',
              border:'1px solid rgba(255,255,255,.06)'}}>
              <span style={{fontSize:16,lineHeight:1.3,flexShrink:0}}>{s.icon}</span>
              <span style={{fontSize:13,color:'rgba(255,255,255,.82)',lineHeight:1.45}}>{s.text}</span>
            </div>
          ))}
        </div>
        {/* Buttons */}
        <div style={{display:'flex',gap:8}}>
          <button style={{flex:1,padding:'11px 8px',borderRadius:11,cursor:'pointer',fontWeight:600,fontSize:12,
            background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',color:'rgba(255,255,255,.45)'}}
            onClick={()=>{storage.set('install-dismissed',true);setShow(false);}}>
            {de?'Nicht mehr anzeigen':'Don\'t show again'}
          </button>
          <button style={{flex:1,padding:'11px 8px',borderRadius:11,cursor:'pointer',fontWeight:700,fontSize:13,
            background:'linear-gradient(135deg,#FF5E3A,#FF9040)',border:'none',color:'#fff',
            boxShadow:'0 4px 16px rgba(255,94,58,.3)'}}
            onClick={()=>setShow(false)}>
            {de?'Verstanden':'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════
// STATS VIEW — Survival Curve / Difficulty / Progress
// ══════════════════════════════════════════════════════════

const QueueDisplayView=({compId,onBack})=>{
  const {lang}=useLang();
  const info=useFbVal(`ogn/${compId}/info`);
  const athletesMap=useFbVal(`ogn/${compId}/athletes`);
  const completedRuns=useFbVal(`ogn/${compId}/completedRuns`);
  if(!info)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}><Spinner/></div>;
  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'var(--bg)',overflow:'hidden'}}>
      {/* Header bar */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 28px',borderBottom:'1px solid var(--border)',background:'rgba(255,255,255,.02)',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          {info.logo&&<img src={info.logo} style={{width:48,height:48,borderRadius:12,objectFit:'cover',border:'1px solid rgba(255,255,255,.1)'}}/>}
          <div>
            <div style={{fontSize:22,fontWeight:900,color:'#fff',letterSpacing:'-.01em'}}>{info.name||'Competition'}</div>
            <div style={{fontSize:13,color:'var(--muted)',marginTop:2,letterSpacing:'.04em',textTransform:'uppercase'}}>Next Up</div>
          </div>
        </div>
        {onBack&&<button className="btn btn-ghost" style={{padding:'8px 16px',fontSize:13}} onClick={onBack}><I.X s={14}/></button>}
      </div>
      {/* Queue grid */}
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <AthleteQueueView compId={compId} info={info} completedRuns={completedRuns} athletesMap={athletesMap} tvMode={true}/>
      </div>
    </div>
  );
};

// STATS DISPLAY VIEW (TV full-screen)
// ══════════════════════════════════════════════════════════

const StatsDisplayView=({compId,onBack})=>{
  const info=useFbVal(`ogn/${compId}/info`);
  const athletesMap=useFbVal(`ogn/${compId}/athletes`);
  const completedRuns=useFbVal(`ogn/${compId}/completedRuns`);
  if(!info)return<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}><Spinner/></div>;
  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'var(--bg)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 28px',borderBottom:'1px solid var(--border)',background:'rgba(255,255,255,.02)',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          {info.logo&&<img src={info.logo} style={{width:44,height:44,borderRadius:11,objectFit:'cover',border:'1px solid rgba(255,255,255,.1)'}}/>}
          <div>
            <div style={{fontSize:20,fontWeight:900,color:'#fff'}}>{info.name||'Competition'}</div>
            <div style={{fontSize:12,color:'var(--muted)',marginTop:1,letterSpacing:'.05em',textTransform:'uppercase'}}>Live Stats</div>
          </div>
        </div>
        {onBack&&<button className="btn btn-ghost" style={{padding:'8px 16px',fontSize:13}} onClick={onBack}><I.X s={14}/></button>}
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'16px 28px 40px'}}>
        <StatsView compId={compId} info={info} completedRuns={completedRuns} athletesMap={athletesMap} tvMode={true}/>
      </div>
    </div>
  );
};

// APP ROUTER
// ══════════════════════════════════════════════════════════

const StageRecoveryBanner=({compId,onJoin,lang})=>{
  const activeRuns=useFbVal(compId?`ogn/${compId}/activeRuns`:null);
  const [dismissed,setDismissed]=useState(false);
  if(dismissed||!activeRuns||typeof activeRuns!=='object'||!Object.keys(activeRuns).length)return null;
  const stages=Object.keys(activeRuns).sort();
  return(
    <>
      {/* spacer so fixed banner doesn't cover content */}
      <div style={{height:48,flexShrink:0}}/>
      <div style={{position:'fixed',top:0,left:0,right:0,zIndex:9999,background:'rgba(18,18,20,.97)',padding:'8px 16px',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',borderBottom:'2px solid rgba(255,160,0,.55)'}}>
        <span style={{fontSize:12,color:'rgba(255,195,40,1)',flex:1}}>
          {lang==='de'?'Aktive Stage gefunden — Handy ausgefallen?':'Active stage found — phone died?'}
        </span>
        {stages.map(s=>(
          <button key={s} className="btn btn-ghost" style={{padding:'5px 12px',fontSize:12,borderColor:'rgba(255,160,0,.55)',color:'rgba(255,195,40,1)',minWidth:0}} onClick={()=>onJoin(parseInt(s,10)||s)}>
            Stage {s} {lang==='de'?'übernehmen':'re-join'}
          </button>
        ))}
        <button onClick={()=>setDismissed(true)} style={{padding:'5px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.06)',color:'rgba(255,255,255,.5)',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'Inter,sans-serif',flexShrink:0}}>
          {lang==='de'?'Nein, schließen':'No, dismiss'} ✕
        </button>
      </div>
    </>
  );
};

export { DisplayView, DisplayNoComp, InstallPrompt, QueueDisplayView, StatsDisplayView, StageRecoveryBanner };
