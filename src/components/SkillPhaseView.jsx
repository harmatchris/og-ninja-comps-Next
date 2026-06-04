import React, { useState, useEffect, useRef } from 'react';
import { useLang } from '../i18n.js';
import { IGN_CATS, db, fbSet } from '../config.js';
import { uid, toFlag } from '../utils.js';
import { useFbVal, SFX } from '../hooks.js';
import { I } from '../icons.jsx';

// Division groups — the scoring list is filtered by these instead of by all 8 categories.
const GROUP_CATS={LK1:['km1','kw1','tm1','tw1'],LK2:['km2','kw2','tm2','tw2']};

const SkillPhaseView=({compId,info,athletes})=>{
  const {lang}=useLang();
  const skillPhase=info?.skillPhase||{};
  const skillStatus=useFbVal(`ogn/${compId}/skillPhaseStatus`);
  const skillScores=useFbVal(`ogn/${compId}/skillScores`);
  const [selCat,setSelCat]=useState(null);
  const [selSkill,setSelSkill]=useState(null);
  const [seedingDone,setSeedingDone]=useState(false);
  const [showSiegerehrung,setShowSiegerehrung]=useState(false);
  const [flashIds,setFlashIds]=useState(new Set());
  const [liveNotif,setLiveNotif]=useState(null);
  const prevScoresRef=React.useRef(null);
  const [newSkillName,setNewSkillName]=useState('');
  const [searchQ,setSearchQ]=useState('');
  const [showSkillMgmt,setShowSkillMgmt]=useState(false);
  const [now,setNow]=useState(Date.now());
  const [resetFlash,setResetFlash]=useState(null); // athId briefly highlighted after a long-press reset
  const lpTimerRef=useRef(null);     // long-press timer
  const lpStartRef=useRef(null);     // pointer start coords (to cancel the press on scroll)
  const [selGroup,setSelGroup]=useState(null);        // 'LK1' | 'LK2' | 'all' — scoring-list division filter
  const [countdownGroup,setCountdownGroup]=useState(null); // which group's timer the 10s countdown will start
  const [adminUnlocked,setAdminUnlocked]=useState(false);  // PIN gate for Seeding / Finalize
  const [scoringUnlocked,setScoringUnlocked]=useState({}); // {gid:true} — unlock scoring after that group's timer expired

  // ── Timers — LK1 and LK2 run in parallel and are started independently. ──
  // State lives under skillPhaseStatus/timers/{LK1|LK2}; the duration falls back to the
  // configured skillPhase.timerMin but can be overridden per group (durationMin).
  const timerMinBase=skillPhase.timerMin||(skillPhase.timerHrs?skillPhase.timerHrs*60:0);
  const timers=skillStatus?.timers||{};
  const groupDurMin=(gid)=>{const d=timers?.[gid]?.durationMin;return (d===0||d)?d:timerMinBase;};
  const deriveTimer=(gid)=>{
    const t=timers?.[gid]||{};
    const durMin=groupDurMin(gid);
    const durMs=durMin*60000;
    const startedAt=t.timerStartedAt||null;
    const paused=!!t.paused;
    const pausedAt=t.pausedAt||0;
    const pausedTotal=t.pausedTotal||0;
    const started=!!startedAt&&durMin>0;
    const curPause=paused&&pausedAt?(now-pausedAt):0;
    const elapsed=started?(now-startedAt-pausedTotal-curPause):0;
    const remaining=started?Math.max(0,durMs-elapsed):durMs;
    const expired=started&&!paused&&remaining<=0;
    return {gid,durMin,durMs,startedAt,paused,pausedAt,pausedTotal,started,elapsed,remaining,expired};
  };
  const tryUnlockScoring=(gid)=>{
    const code=window.prompt(lang==='de'?'Code eingeben um Eingabe nach Zeitablauf zu entsperren:':'Enter code to unlock scoring after time expired:');
    if(code==='2021'){setScoringUnlocked(u=>({...u,[gid]:true}));SFX.complete();}
    else if(code!==null){window.alert(lang==='de'?'Falscher Code':'Wrong code');SFX.fall();}
  };
  const [reminder,setReminder]=useState(null);   // {gid,mins} transient "X min left" banner
  const shownRemRef=useRef(new Set());           // thresholds already announced (per group+duration)
  // Extend a division timer (jury chose to keep going past time): add minutes → un-expires it.
  const extendTimer=(gid,mins)=>{
    const cur=groupDurMin(gid)||0;
    fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}/durationMin`,cur+mins);
    SFX.checkpoint();
  };
  // Jury confirmed the division is finished → lock its scoring + auto-score untouched skills as 0.
  const confirmCloseDivision=(gid)=>{
    fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}/closed`,true);
    SFX.complete();
  };

  // Tick once a second while any group timer is actively running.
  const tickKey=['LK1','LK2'].map(gid=>{const t=timers[gid]||{};return `${gid}:${t.timerStartedAt||0}:${t.paused?1:0}:${t.durationMin??''}`;}).join('|');
  useEffect(()=>{
    const run=['LK1','LK2'].some(gid=>{const T=deriveTimer(gid);return T.started&&!T.paused&&!T.expired;});
    if(!run)return;
    const iv=setInterval(()=>setNow(Date.now()),1000);
    return()=>clearInterval(iv);
  },[tickKey]);

  // Reminders at 30 / 15 / 5 / 1 min before a running division timer ends.
  useEffect(()=>{
    ['LK1','LK2'].forEach(gid=>{
      const T=deriveTimer(gid);
      if(!T.started||T.paused||T.expired)return;
      const minsLeft=Math.ceil(T.remaining/60000);
      [30,15,5,1].forEach(th=>{
        const key=`${gid}-${T.startedAt}-${T.durMin}-${th}`;
        if(minsLeft<=th&&T.remaining>0&&!shownRemRef.current.has(key)){
          shownRemRef.current.add(key);
          setReminder({gid,mins:th});
          if(navigator.vibrate)navigator.vibrate([80,40,80]);
          SFX.checkpoint();
          setTimeout(()=>setReminder(r=>(r&&r.gid===gid&&r.mins===th?null:r)),7000);
        }
      });
    });
  },[now]);

  // When the JURY confirms a division is closed (not merely on expiry), auto-score its
  // still-untouched skills as 0 (once per group). The expiry itself only prompts the jury.
  const lk1Closed=!!timers?.LK1?.closed, lk2Closed=!!timers?.LK2?.closed;
  useEffect(()=>{
    if(!athletes)return;
    ['LK1','LK2'].forEach(gid=>{
      if(!timers?.[gid]?.closed||timers?.[gid]?.autoFailed)return;
      const gCats=GROUP_CATS[gid];
      const updates={};
      athList.filter(a=>gCats.includes(a.cat)).forEach(a=>{
        skills.forEach(sk=>{
          const sc=skillScores?.[a.id]?.[sk.id];
          if(sc==null){ // only fill in completely untouched skills — never overwrite a recorded attempt
            updates[`ogn/${compId}/skillScores/${a.id}/${sk.id}`]=isOldschool?{a1:false,a2:false,a3:false,autoFailed:true}:{attempts:0,completed:false,flashed:false,poolScore:0,autoFailed:true};
          }
        });
      });
      if(Object.keys(updates).length)db.ref().update(updates);
      fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}/autoFailed`,true);
    });
  },[lk1Closed,lk2Closed]);

  const [countdown,setCountdown]=useState(null); // 10..1..GO

  const startTimer=(gid)=>{ setCountdownGroup(gid); setCountdown(10); SFX.click(); };

  const pauseTimer=async(gid)=>{
    await fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}/paused`,true);
    await fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}/pausedAt`,Date.now());
    SFX.fall();
  };

  const resumeTimer=async(gid)=>{
    const t=timers?.[gid]||{};
    const pauseDuration=Date.now()-(t.pausedAt||Date.now());
    const newTotal=(t.pausedTotal||0)+pauseDuration;
    await fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}/pausedTotal`,newTotal);
    await fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}/paused`,false);
    await fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}/pausedAt`,null);
    SFX.checkpoint();
  };

  // 10-second countdown with beeps
  useEffect(()=>{
    if(countdown===null)return;
    if(countdown<=0){
      // GO! — loud horn, start the selected group's timer fresh
      SFX.complete();
      const gid=countdownGroup||'LK1';
      fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}/timerStartedAt`,Date.now());
      fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}/pausedTotal`,0);
      fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}/paused`,false);
      fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}/autoFailed`,null);
      setCountdown(null); setCountdownGroup(null);
      return;
    }
    // Beep each second
    if(countdown<=3){
      // Last 3 seconds — louder, higher beeps
      SFX.checkpoint();
    } else {
      SFX.click();
    }
    const t=setTimeout(()=>setCountdown(c=>c-1),1000);
    return()=>clearTimeout(t);
  },[countdown]);
  const fmtTimer=ms=>{
    const totalSec=Math.floor(ms/1000);
    const h=Math.floor(totalSec/3600);
    const m=Math.floor((totalSec%3600)/60);
    const s=totalSec%60;
    return h>0?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;
  };

  const athList=athletes?Object.values(athletes):[];
  const skills=skillPhase.skills||[];
  const isOldschool=(skillPhase.type||'oldschool')==='oldschool';
  const skillCats=skillPhase.skillCategories;
  const filteredAthList=skillCats&&skillCats!=='all'&&Array.isArray(skillCats)?athList.filter(a=>skillCats.includes(a.cat)):athList;
  const cats=[...new Set(filteredAthList.map(a=>a.cat))];
  // Auto-select first skill and first category
  useEffect(()=>{if(skills.length>0&&!selSkill)setSelSkill(skills[0].id);},[skills.length]);
  useEffect(()=>{if(cats.length>0&&!selCat)setSelCat(cats[0]);},[cats.length]);

  // ── Division groups for the scoring list: LK1 / LK2 / Alle (instead of all 8 cats) ──
  const hasLK1=cats.some(c=>GROUP_CATS.LK1.includes(c));
  const hasLK2=cats.some(c=>GROUP_CATS.LK2.includes(c));
  const groups=[];
  if(hasLK1)groups.push({id:'LK1',label:'LK1',cats:GROUP_CATS.LK1.filter(c=>cats.includes(c))});
  if(hasLK2)groups.push({id:'LK2',label:'LK2',cats:GROUP_CATS.LK2.filter(c=>cats.includes(c))});
  if(cats.length)groups.push({id:'all',label:lang==='de'?'Alle':'All',cats});
  useEffect(()=>{if(groups.length&&!selGroup)setSelGroup(groups[0].id);},[groups.length]);
  const activeGroup=selGroup||groups[0]?.id||'all';
  const activeGroupObj=groups.find(g=>g.id===activeGroup)||{cats,label:lang==='de'?'Alle':'All'};
  const activeGroupCats=activeGroupObj.cats;
  const activeGroupLabel=activeGroupObj.label;
  // Scoring lock follows the selected group's own timer (no lock in the combined 'Alle' view).
  const activeTimer=activeGroup==='all'?null:deriveTimer(activeGroup);
  // Scoring locks only once the JURY confirms the division closed (after the expiry prompt),
  // not the instant the clock hits zero — so they can still finish a kid or extend.
  const scoringLocked=!!(activeGroup!=='all'&&timers?.[activeGroup]?.closed&&!scoringUnlocked[activeGroup]);

  // Difficulty multipliers
  const DIFF_MULT={easy:0.8,medium:1.0,hard:1.5};

  // Compute total score per athlete
  const computeTotal=(athId)=>{
    if(!skillScores)return 0;
    let tot=0;
    skills.forEach(sk=>{
      const s=skillScores?.[athId]?.[sk.id];
      if(!s)return;
      const mult=DIFF_MULT[sk.difficulty||'medium']||1;
      if(isOldschool){
        if(s.a1===true)tot+=100*mult;
        else if(s.a2===true)tot+=50*mult;
        else if(s.a3===true)tot+=20*mult;
      } else {
        tot+=(s.poolScore||0)*(s.flashed?1.2:1)*mult;
      }
    });
    return Math.round(tot);
  };

  // Ranking per category (for seeding)
  const getRanking=(catId)=>athList
    .filter(a=>a.cat===catId)
    .map(a=>({...a,skillTotal:computeTotal(a.id)}))
    .sort((a,b)=>b.skillTotal-a.skillTotal);

  const generateSeeding=async()=>{
    if(!window.confirm(lang==='de'?'Seeding aus Skill-Resultaten generieren?\n\nDie Startreihenfolge für alle Stages wird überschrieben.':'Generate seeding from skill results?\n\nQueue order for all stages will be overwritten.'))return;
    const seedMode=skillPhase.seedingMode||'inverted';
    const updates={};
    const isPipeline=!!(info?.pipelineEnabled&&info?.pipeline);
    if(isPipeline){
      const pStages=Object.entries(info.pipeline).map(([id,v])=>({id,...v})).sort((a,b)=>(a.order||0)-(b.order||0));
      const firstRound=pStages.filter(s=>!s.predecessorStages||s.predecessorStages.length===0);
      firstRound.forEach(stage=>{
        const sCats=(stage.categories==='all'?cats:(Array.isArray(stage.categories)?stage.categories:[])).filter(c=>cats.includes(c));
        const stageAths=[];
        sCats.forEach(catId=>{const ranked=getRanking(catId);const ordered=seedMode==='inverted'?[...ranked].reverse():ranked;stageAths.push(...ordered);});
        stageAths.forEach((a,i)=>{
          updates[`ogn/${compId}/pipeline/${stage.id}/athletes/${a.id}`]={id:a.id,name:a.name,num:a.num,cat:a.cat,team:a.team||'',country:a.country||'',queueOrder:i};
          updates[`ogn/${compId}/athletes/${a.id}/pipelineQueueOrder/${stage.id}`]=i;
          updates[`ogn/${compId}/athletes/${a.id}/queueOrder`]=i;
        });
      });
    }else{
      const numSt=info.numStations||1;
      cats.forEach(catId=>{
        const ranked=getRanking(catId);
        const ordered=seedMode==='inverted'?[...ranked].reverse():ranked;
        ordered.forEach((a,i)=>{updates[`ogn/${compId}/athletes/${a.id}/queueOrder`]=i;});
        for(let s=1;s<=numSt;s++){ordered.forEach((a,i)=>{updates[`ogn/${compId}/stages/${s}/athletes/${a.id}/queueOrder`]=i;});}
      });
    }
    await db.ref().update(updates);
    await fbSet(`ogn/${compId}/skillPhaseStatus/seedingDone`,true);
    setSeedingDone(true);
    SFX.complete();
  };

  const openSiegerehrung=async()=>{
    const hasStages=(info?.numStations||0)>0||!!(info?.pipelineEnabled);
    const msgDe=hasStages?'Skill-Wettkampf abschließen und Siegerehrung anzeigen?\n\nKein Seeding für Stages wird generiert.':'Skill-Wettkampf abschließen und Siegerehrung anzeigen?';
    const msgEn=hasStages?'Close skill competition and show awards ceremony?\n\nNo seeding for stages will be generated.':'Close skill competition and show awards ceremony?';
    if(!window.confirm(lang==='de'?msgDe:msgEn))return;
    await fbSet(`ogn/${compId}/skillPhaseStatus/finalized`,true);
    setShowSiegerehrung(true);
    SFX.complete();
  };

  const setAttempt=async(athId,skillId,attempt,success)=>{
    if(scoringLocked){tryUnlockScoring(activeGroup);return;}
    await fbSet(`ogn/${compId}/skillScores/${athId}/${skillId}/a${attempt}`,success);
    SFX.checkpoint();
  };

  // Reset a single athlete's score for the CURRENTLY selected skill back to 0 (unscored).
  // Works at any time — even mid-attempt — triggered by a long-press on the athlete's name.
  // Deleting the node is exactly what the existing "Reset" link does; this just makes it
  // reachable as a gesture from every scoring state, not only when the athlete is "done".
  const resetAthleteSkill=async(athId)=>{
    if(!selSkill)return;
    if(scoringLocked){tryUnlockScoring(activeGroup);return;}
    await fbSet(`ogn/${compId}/skillScores/${athId}/${selSkill}`,null);
    if(navigator.vibrate)navigator.vibrate([60,40,60]);
    setResetFlash(athId);
    setTimeout(()=>setResetFlash(f=>(f===athId?null:f)),1400);
    SFX.fall();
  };
  // Long-press plumbing (pointer events = mouse + touch). A 600ms hold fires the reset;
  // a >10px move (i.e. the start of a scroll) cancels it so list scrolling still works.
  const lpStart=(athId,e)=>{
    lpStartRef.current={x:e.clientX,y:e.clientY};
    clearTimeout(lpTimerRef.current);
    lpTimerRef.current=setTimeout(()=>{lpTimerRef.current=null;resetAthleteSkill(athId);},600);
  };
  const lpMove=(e)=>{
    if(!lpTimerRef.current||!lpStartRef.current)return;
    if(Math.abs(e.clientX-lpStartRef.current.x)>10||Math.abs(e.clientY-lpStartRef.current.y)>10){clearTimeout(lpTimerRef.current);lpTimerRef.current=null;}
  };
  const lpCancel=()=>{clearTimeout(lpTimerRef.current);lpTimerRef.current=null;};

  const getAttemptResult=(athId,skillId)=>{
    const s=skillScores?.[athId]?.[skillId];
    if(!s)return{tries:0,result:null};
    if(s.a1===true)return{tries:1,result:'pass',pts:100};
    if(s.a1===false&&s.a2===true)return{tries:2,result:'pass',pts:50};
    if(s.a1===false&&s.a2===false&&s.a3===true)return{tries:3,result:'pass',pts:20};
    if(s.a1===false&&s.a2===false&&s.a3===false)return{tries:3,result:'fail',pts:0};
    const tries=[s.a1,s.a2,s.a3].filter(v=>v!=null).length;
    return{tries,result:null,pts:null};
  };

  // Live animation: detect new passes
  React.useEffect(()=>{
    if(!skillScores){prevScoresRef.current=skillScores;return;}
    if(!prevScoresRef.current){prevScoresRef.current=skillScores;return;}
    const prev=prevScoresRef.current;
    const newFlash=new Set();
    let notifMsg=null;
    filteredAthList.forEach(a=>{
      skills.forEach(sk=>{
        const cur=skillScores?.[a.id]?.[sk.id];
        const prv=prev?.[a.id]?.[sk.id];
        const curPassed=cur?.a1===true||(cur?.a1===false&&cur?.a2===true)||(cur?.a1===false&&cur?.a2===false&&cur?.a3===true);
        const prvPassed=prv?.a1===true||(prv?.a1===false&&prv?.a2===true)||(prv?.a1===false&&prv?.a2===false&&prv?.a3===true);
        if(curPassed&&!prvPassed){
          newFlash.add(a.id);
          const pts=cur?.a1===true?100:cur?.a2===true?50:20;
          notifMsg=`${a.name} — ${sk.name||'Skill'} +${pts}P!`;
        }
      });
    });
    if(newFlash.size>0){
      setFlashIds(newFlash);
      if(notifMsg)setLiveNotif(notifMsg);
      setTimeout(()=>{setFlashIds(new Set());setLiveNotif(null);},2600);
    }
    prevScoresRef.current=skillScores;
  },[skillScores]);

  const curCatAths=selCat?athList.filter(a=>a.cat===selCat):[];
  const activeCat=selCat||cats[0];
  const ranking=getRanking(activeCat);
  const seedingAlreadyDone=skillStatus?.seedingDone||seedingDone;
  const base=location.href.split('?')[0];
  const skillUrl=`${base}?mode=skill&comp=${compId}`;

  return(
    <div style={{display:'flex',flexDirection:'column',gap:12,paddingBottom:80}}>
      {/* Header */}
      <div className="sh-card" style={{padding:'14px 16px',background:'rgba(52,199,89,.08)',borderColor:'rgba(52,199,89,.25)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
          <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(52,199,89,.2)',border:'1px solid rgba(52,199,89,.35)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5" style={{width:17,height:17}}><circle cx="12" cy="5" r="2.5"/><path d="M12 8l-3 5h6l-3-5z"/><path d="M9 13l-2 6M15 13l2 6"/><path d="M9 17l6-1"/></svg>
          </div>
          <div>
            <div style={{fontWeight:800,fontSize:15,color:'var(--green)'}}>{lang==='de'?'Skill Phase':'Skill Phase'}</div>
            <div style={{fontSize:11,color:'var(--muted)'}}>
              {isOldschool?(lang==='de'?'Jury-Modus — Versuche werden eingetragen':'Jury mode — attempts recorded'):'Boulderstyle — Athleten tragen selbst ein'}
              {' · '}{skills.length} {lang==='de'?'Skills':'skills'}
              {timerMinBase>0&&` · ${timerMinBase>=60?Math.floor(timerMinBase/60)+"h"+(timerMinBase%60?timerMinBase%60+"m":""):timerMinBase+"m"} Timer`}
            </div>
          </div>
        </div>
        {!isOldschool&&(
          <div style={{background:'rgba(255,255,255,.04)',borderRadius:10,padding:'10px 12px',display:'flex',alignItems:'center',gap:10}}>
            <div style={{fontSize:11,color:'var(--muted)',flex:1}}>{lang==='de'?'Athleten-Link (QR anzeigen):':'Athlete link (show QR):'}<br/><span style={{fontFamily:'JetBrains Mono',fontSize:10,color:'var(--cor)',wordBreak:'break-all'}}>{skillUrl}</span></div>
            <button className="btn btn-ghost" style={{padding:'6px 10px',fontSize:11,flexShrink:0,gap:5}} onClick={()=>window.open(skillUrl,'_blank')}><I.QR s={13}/> QR</button>
          </div>
        )}
      </div>

      {/* Combined, PIN-protected admin control: Seeding + Finalize (kept discreet) */}
      {(()=>{
        const hasStages=(info?.numStations||0)>0||!!(info?.pipelineEnabled);
        if(skillStatus?.finalized)return(
          <div style={{fontSize:11,color:'var(--gold)',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',gap:5,padding:'4px 0'}}><I.Trophy s={12} c="var(--gold)"/> {lang==='de'?'Wettkampf abgeschlossen':'Competition finalized'}</div>
        );
        const tryUnlockAdmin=()=>{
          if(adminUnlocked){setAdminUnlocked(false);return;}
          const c=window.prompt(lang==='de'?'PIN für Seeding / Abschließen:':'PIN for seeding / finalize:');
          if(c==='2021'){setAdminUnlocked(true);SFX.complete();}
          else if(c!=null){window.alert(lang==='de'?'Falscher Code':'Wrong code');SFX.fall();}
        };
        return(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <button className="btn btn-ghost" style={{padding:'6px 12px',fontSize:11,gap:6,alignSelf:'flex-start',opacity:.85}} onClick={tryUnlockAdmin}>
              {adminUnlocked?<I.Unlock s={12}/>:<I.Lock s={12}/>} {lang==='de'?'Seeding / Abschließen':'Seeding / Finalize'}
              {seedingAlreadyDone&&<span style={{color:'var(--green)',marginLeft:2,fontSize:10}}>· Seeding ✓</span>}
            </button>
            {adminUnlocked&&(
              <div className="sh-card" style={{padding:'10px 12px',display:'flex',flexDirection:'column',gap:8,borderColor:'rgba(200,168,75,.3)'}}>
                {hasStages&&<>
                  <button className="btn btn-coral" style={{padding:'10px',fontSize:12,gap:6}} onClick={generateSeeding}>
                    <I.Sort s={13}/> {seedingAlreadyDone?(lang==='de'?'Seeding erneut generieren':'Re-generate seeding'):(lang==='de'?`Seeding → Stage (${skillPhase.seedingMode==='inverted'?'Invertiert':'Manuell'})`:`Seeding → Stage (${skillPhase.seedingMode==='inverted'?'inverted':'manual'})`)}
                  </button>
                  <div style={{fontSize:10,color:'var(--muted)',textAlign:'center',lineHeight:1.4,marginTop:-2}}>
                    {skillPhase.seedingMode==='inverted'?(lang==='de'?'Niedrigste Skill-Punkte → zuerst auf den Stage-Parcours':'Lowest skill pts → first on stage'):lang==='de'?'Reihenfolge wie im Skill-Ranking':'Order as in skill ranking'}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{flex:1,height:1,background:'var(--border)'}}/>
                    <span style={{fontSize:10,color:'var(--dim)',letterSpacing:'.08em'}}>{lang==='de'?'ODER':'OR'}</span>
                    <div style={{flex:1,height:1,background:'var(--border)'}}/>
                  </div>
                </>}
                <button className="btn btn-ghost" style={{padding:'10px',fontSize:12,gap:6,borderColor:'rgba(200,168,75,.35)',color:'var(--gold)'}} onClick={openSiegerehrung}>
                  <I.Trophy s={13}/> {lang==='de'?'Siegerehrung / Wettkampf abschließen':'Awards / Close competition'}
                </button>
                <div style={{height:1,background:'var(--border)',margin:'2px 0'}}/>
                {/* Full reset — wipe all skill scores + status so the skill competition can restart from scratch */}
                <button className="btn btn-ghost" style={{padding:'10px',fontSize:12,gap:6,borderColor:'rgba(255,59,48,.4)',color:'var(--red)'}} onClick={async()=>{
                  if(!window.confirm(lang==='de'?'Skill-Wettkampf KOMPLETT zurücksetzen und neu starten?\n\nAlle Skill-Wertungen, Timer und der Status werden gelöscht. Das kann NICHT rückgängig gemacht werden.':'COMPLETELY reset and restart the skill competition?\n\nAll skill scores, timers and status will be deleted. This canNOT be undone.'))return;
                  await fbSet(`ogn/${compId}/skillScores`,null);
                  await fbSet(`ogn/${compId}/skillPhaseStatus`,null);
                  setScoringUnlocked({});setSeedingDone(false);setShowSiegerehrung(false);setAdminUnlocked(false);
                  shownRemRef.current=new Set();
                  SFX.complete();
                }}>
                  <I.RefreshCw s={13}/> {lang==='de'?'Skill-Wettkampf zurücksetzen / neu starten':'Reset / restart skill competition'}
                </button>
                <div style={{fontSize:10,color:'var(--dim)',textAlign:'center',lineHeight:1.4,marginTop:-2}}>{lang==='de'?'Löscht alle Skill-Wertungen, Timer & Status':'Deletes all skill scores, timers & status'}</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* 10-second countdown overlay */}
      {countdown!==null&&(
        <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,.92)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:'.15em',textTransform:'uppercase',color:'var(--muted)'}}>{lang==='de'?'Skill Phase startet in':'Skill Phase starts in'}</div>
          <div style={{fontSize:120,fontWeight:900,fontFamily:'JetBrains Mono',lineHeight:1,
            color:countdown<=3?'var(--cor)':'var(--gold)',
            textShadow:countdown<=3?'0 0 40px rgba(255,94,58,.6)':'0 0 30px rgba(255,214,10,.4)',
            animation:'scaleIn .3s ease'}}>
            {countdown}
          </div>
          <div style={{width:200,height:6,borderRadius:3,background:'rgba(255,255,255,.1)',overflow:'hidden',marginTop:8}}>
            <div style={{height:'100%',borderRadius:3,background:countdown<=3?'var(--cor)':'var(--gold)',transition:'width .3s',width:`${(countdown/10)*100}%`}}/>
          </div>
        </div>
      )}

      {/* Reminder banner — fires at 30/15/5/1 min before a division's time is up */}
      {reminder&&(
        <div style={{position:'fixed',top:14,left:'50%',transform:'translateX(-50%)',zIndex:9998,padding:'10px 18px',borderRadius:12,background:reminder.mins<=5?'rgba(255,59,48,.95)':'rgba(255,149,0,.95)',color:'#fff',fontWeight:800,fontSize:14,boxShadow:'0 8px 28px rgba(0,0,0,.4)',display:'flex',alignItems:'center',gap:8,animation:'scaleIn .25s ease'}}>
          <I.Clock s={17} c="#fff"/> {reminder.gid}: {lang==='de'?`noch ${reminder.mins} Min${reminder.mins===1?'ute':'uten'}!`:`${reminder.mins} min left!`}
        </div>
      )}

      {/* Expiry prompt — when a division's clock hits 0, ask the jury to extend or close */}
      {(()=>{
        const gid=['LK1','LK2'].find(g=>{const T=deriveTimer(g);return T.started&&T.expired&&!timers?.[g]?.closed;});
        if(!gid)return null;
        return(
          <div style={{position:'fixed',inset:0,zIndex:9997,background:'rgba(0,0,0,.85)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <div style={{width:'100%',maxWidth:420,background:'var(--bg2)',borderRadius:18,border:'1px solid rgba(255,59,48,.4)',padding:'24px 22px',textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,.65)',animation:'scaleIn .3s ease'}}>
              <div style={{fontSize:40,marginBottom:8}}>⏰</div>
              <div style={{fontSize:12,fontWeight:700,color:'var(--red)',letterSpacing:'.1em',textTransform:'uppercase',marginBottom:4}}>{lang==='de'?'Zeit abgelaufen':'Time is up'}</div>
              <div style={{fontSize:20,fontWeight:900,marginBottom:6}}>{gid} — {lang==='de'?'Skill-Phase':'skill phase'}</div>
              <div style={{fontSize:13,color:'var(--muted)',marginBottom:20,lineHeight:1.4}}>{lang==='de'?`Die Zeit für ${gid} ist um. Verlängern oder die Division jetzt abschließen?`:`Time for ${gid} is up. Extend, or close this division now?`}</div>
              <div style={{display:'flex',gap:8,marginBottom:10}}>
                <button className="btn btn-ghost" style={{flex:1,padding:'12px',fontSize:13,gap:5,borderColor:'rgba(255,149,0,.4)',color:'#FF9500'}} onClick={()=>extendTimer(gid,5)}><I.Play s={13}/> +5 min</button>
                <button className="btn btn-ghost" style={{flex:1,padding:'12px',fontSize:13,gap:5,borderColor:'rgba(255,149,0,.4)',color:'#FF9500'}} onClick={()=>extendTimer(gid,10)}><I.Play s={13}/> +10 min</button>
              </div>
              <button className="btn btn-coral" style={{width:'100%',padding:'13px',fontSize:14,gap:6}} onClick={()=>confirmCloseDivision(gid)}>
                <I.Check s={15}/> {lang==='de'?`${gid} abschließen & sperren`:`Close & lock ${gid}`}
              </button>
              <div style={{fontSize:10,color:'var(--dim)',marginTop:10,lineHeight:1.4}}>{lang==='de'?'Abschließen wertet noch nicht eingetragene Skills als 0 und sperrt die Eingabe (Entsperr-Code 2021).':'Closing scores untouched skills as 0 and locks entry (unlock code 2021).'}</div>
            </div>
          </div>
        );
      })()}

      {/* Two parallel timers — LK1 and LK2 started independently */}
      {(()=>{
        const present=[hasLK1&&'LK1',hasLK2&&'LK2'].filter(Boolean);
        if(!present.length)return null;
        const hasGroupDur=timers?.LK1?.durationMin||timers?.LK2?.durationMin;
        if(timerMinBase<=0&&!hasGroupDur){
          // No duration configured yet — offer a one-tap enable so the timers become settable here.
          return(
            <button className="btn btn-ghost" style={{padding:'6px 12px',fontSize:11,gap:5,alignSelf:'flex-start',opacity:.8}} onClick={()=>{present.forEach(g=>fbSet(`ogn/${compId}/skillPhaseStatus/timers/${g}/durationMin`,30));SFX.click();}}>
              <I.Clock s={12}/> {lang==='de'?'Timer aktivieren ('+present.join(' / ')+')':'Enable timers ('+present.join(' / ')+')'}
            </button>
          );
        }
        return(
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {present.map(gid=>{
            const T=deriveTimer(gid);
            const locked=T.expired&&!scoringUnlocked[gid];
            const counting=countdown!==null&&countdownGroup===gid;
            const col=T.expired?'var(--red)':T.paused?'#FF9500':T.started?'var(--gold)':'var(--muted)';
            return(
              <div key={gid} className="sh-card" style={{flex:'1 1 230px',minWidth:200,padding:'10px 12px',
                background:T.expired?'rgba(255,59,48,.1)':T.paused?'rgba(255,149,0,.1)':T.started?'rgba(255,214,10,.08)':'rgba(255,255,255,.03)',
                borderColor:T.expired?'rgba(255,59,48,.35)':T.paused?'rgba(255,149,0,.4)':T.started?'rgba(255,214,10,.3)':'var(--border)'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:12,fontWeight:800,padding:'2px 9px',borderRadius:6,background:'rgba(255,255,255,.08)',border:'1px solid var(--border)',flexShrink:0}}>{gid}</span>
                  <I.Clock s={15} c={col}/>
                  <div style={{flex:1,fontSize:23,fontWeight:900,fontFamily:'JetBrains Mono',letterSpacing:'-1px',color:col}}>
                    {T.expired?(lang==='de'?'ZEIT UM':'TIME UP'):counting?`${countdown}…`:T.started?fmtTimer(T.remaining):fmtTimer(T.durMs)}
                  </div>
                  {T.started&&!T.expired&&!T.paused&&<span style={{fontSize:9,color:'var(--gold)',fontWeight:700,padding:'3px 7px',background:'rgba(255,214,10,.15)',borderRadius:7,border:'1px solid rgba(255,214,10,.3)',animation:'pulse 1.6s infinite'}}>LIVE</span>}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6,marginTop:8,flexWrap:'wrap'}}>
                  {!T.started&&!T.expired&&!counting&&<>
                    <button className="btn btn-coral" style={{padding:'7px 14px',fontSize:12,gap:5}} disabled={!T.durMin} onClick={()=>startTimer(gid)}><I.Play s={13}/> Start</button>
                    <input type="number" min="1" value={groupDurMin(gid)||''} onChange={e=>{const v=parseInt(e.target.value)||0;fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}/durationMin`,v);}} style={{width:52,padding:'5px 7px',borderRadius:8,border:'1px solid var(--border)',background:'rgba(255,255,255,.06)',color:'var(--text)',fontSize:12,boxSizing:'border-box'}}/>
                    <span style={{fontSize:10,color:'var(--muted)'}}>min</span>
                  </>}
                  {counting&&<span style={{fontSize:11,color:'var(--gold)',fontWeight:700}}>{lang==='de'?'Startet…':'Starting…'}</span>}
                  {T.started&&!T.expired&&!T.paused&&<>
                    <button className="btn" style={{padding:'5px 11px',fontSize:11,gap:4,background:'rgba(255,149,0,.12)',border:'1.5px solid rgba(255,149,0,.4)',color:'#FF9500',fontWeight:700}} onClick={()=>pauseTimer(gid)}>⏸ {lang==='de'?'Pause':'Pause'}</button>
                    <button className="btn btn-fall" style={{padding:'5px 10px',fontSize:11,gap:4}} onClick={async()=>{if(!window.confirm(lang==='de'?gid+'-Timer jetzt beenden?':'End '+gid+' timer now?'))return;await fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}/paused`,false);await fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}/timerStartedAt`,Date.now()-T.durMs);SFX.fall();}}><I.StopOct s={11}/></button>
                  </>}
                  {T.started&&!T.expired&&T.paused&&<>
                    <span style={{fontSize:10,color:'#FF9500',fontWeight:700,padding:'3px 8px',background:'rgba(255,149,0,.15)',borderRadius:7,border:'1px solid rgba(255,149,0,.3)'}}>⏸ {lang==='de'?'PAUSE':'PAUSED'}</span>
                    <button className="btn btn-coral" style={{padding:'5px 11px',fontSize:11,gap:4}} onClick={()=>resumeTimer(gid)}>▶ {lang==='de'?'Weiter':'Resume'}</button>
                    <button className="btn btn-fall" style={{padding:'5px 10px',fontSize:11,gap:4}} onClick={async()=>{if(!window.confirm(lang==='de'?gid+'-Timer jetzt beenden?':'End '+gid+' timer now?'))return;await fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}/paused`,false);await fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}/timerStartedAt`,Date.now()-T.durMs);SFX.fall();}}><I.StopOct s={11}/></button>
                  </>}
                  {T.expired&&<>
                    {locked&&<button className="btn btn-ghost" style={{padding:'5px 10px',fontSize:11,gap:4,borderColor:'rgba(255,59,48,.35)',color:'var(--red)'}} onClick={()=>tryUnlockScoring(gid)}><I.Unlock s={12}/> Unlock</button>}
                    <button className="btn btn-ghost" style={{padding:'5px 10px',fontSize:11,gap:4}} onClick={async()=>{if(!window.confirm(lang==='de'?gid+'-Timer zurücksetzen?':'Reset '+gid+' timer?'))return;await fbSet(`ogn/${compId}/skillPhaseStatus/timers/${gid}`,null);setScoringUnlocked(u=>({...u,[gid]:false}));SFX.click();}}><I.RefreshCw s={12}/> Reset</button>
                  </>}
                </div>
                {locked&&<div style={{marginTop:6,fontSize:10,color:'var(--red)',fontWeight:600}}>{lang==='de'?'Eingabe gesperrt — Zeit abgelaufen (Unlock-Code 2021)':'Scoring locked — time up (unlock code 2021)'}</div>}
              </div>
            );
          })}
        </div>
        );
      })()}

      {/* Skill management (add/remove skills after comp started) */}
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <button className="btn btn-ghost" style={{padding:'5px 10px',fontSize:11,gap:4}} onClick={()=>setShowSkillMgmt(!showSkillMgmt)}>
          <I.Settings s={12}/> {lang==='de'?'Skills bearbeiten':'Edit skills'}
        </button>
      </div>
      {showSkillMgmt&&(
        <div className="sh-card" style={{padding:'12px 14px'}}>
          <div className="lbl" style={{marginBottom:8}}>{lang==='de'?'Skills verwalten':'Manage skills'}</div>
          {skills.map((sk,i)=>{
            const diffColors={easy:'#30D158',medium:'#FF9F0A',hard:'#FF3B30'};
            const diffLabels={easy:lang==='de'?'Leicht':'Easy',medium:lang==='de'?'Mittel':'Medium',hard:lang==='de'?'Schwer':'Hard'};
            const diff=sk.difficulty||'medium';
            return(
            <div key={sk.id} style={{padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:20,height:20,borderRadius:5,background:'rgba(255,255,255,.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'var(--muted)',flexShrink:0}}>{i+1}</div>
                <div style={{flex:1,fontSize:13,fontWeight:500}}>{sk.name||`Skill ${i+1}`}</div>
                <span style={{fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:4,color:diffColors[diff],background:diffColors[diff]+'1A',border:`1px solid ${diffColors[diff]}44`}}>{diffLabels[diff]}</span>
                <button style={{background:'none',border:'none',cursor:'pointer',padding:4,display:'flex'}}
                  onClick={async()=>{
                    const updated=skills.filter(s=>s.id!==sk.id);
                    await fbSet(`ogn/${compId}/info/skillPhase`,{...skillPhase,skills:updated});
                    SFX.click();
                  }}><I.Trash s={13} c="var(--red)"/></button>
              </div>
              <div style={{display:'flex',gap:3,marginTop:4,marginLeft:28}}>
                {['easy','medium','hard'].map(d=>(
                  <button key={d} style={{padding:'2px 8px',fontSize:9,fontWeight:700,borderRadius:5,cursor:'pointer',border:`1px solid ${diff===d?diffColors[d]+'88':'var(--border)'}`,background:diff===d?diffColors[d]+'1A':'transparent',color:diff===d?diffColors[d]:'var(--muted)',transition:'all .15s'}}
                    onClick={async()=>{
                      const updated=skills.map(s=>s.id===sk.id?{...s,difficulty:d}:s);
                      await fbSet(`ogn/${compId}/info/skillPhase`,{...skillPhase,skills:updated});
                      SFX.click();
                    }}>{diffLabels[d]}</button>
                ))}
              </div>
            </div>
            );
          })}
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <input value={newSkillName} onChange={e=>setNewSkillName(e.target.value)} placeholder={lang==='de'?'Neuer Skill Name…':'New skill name…'}
              onKeyDown={e=>{if(e.key==='Enter'&&newSkillName.trim()){
                const updated=[...skills,{id:uid(),name:newSkillName.trim(),difficulty:'medium'}];
                fbSet(`ogn/${compId}/info/skillPhase`,{...skillPhase,skills:updated});
                setNewSkillName('');SFX.click();
              }}} style={{flex:1}}/>
            <button className="btn btn-coral" style={{padding:'8px 14px',flexShrink:0}} onClick={async()=>{
              if(!newSkillName.trim())return;
              const updated=[...skills,{id:uid(),name:newSkillName.trim(),difficulty:'medium'}];
              await fbSet(`ogn/${compId}/info/skillPhase`,{...skillPhase,skills:updated});
              setNewSkillName('');SFX.click();
            }}><I.Plus s={14}/></button>
          </div>
        </div>
      )}

      {/* Division group pills (LK1 / LK2 / Alle) — in their own card, clearly set apart from the skills */}
      <div className="sh-card" style={{padding:'8px 10px',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <span style={{fontSize:10,fontWeight:700,color:'var(--muted)',letterSpacing:'.08em',textTransform:'uppercase',flexShrink:0}}>{lang==='de'?'Division':'Division'}</span>
        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
          {groups.map(g=>(
            <button key={g.id} className={`chip${activeGroup===g.id?' active':''}`} style={{fontSize:12,fontWeight:700,padding:'4px 14px',...(activeGroup===g.id?{background:'rgba(255,94,58,.15)',borderColor:'rgba(255,94,58,.5)',color:'var(--cor)'}:{})}} onClick={()=>setSelGroup(g.id)}>{g.label}</button>
          ))}
        </div>
      </div>

      {/* Skill tabs (oldschool only — jury scoring per skill) */}
      {skills.length>0&&isOldschool&&(
        <div>
          <div style={{fontSize:10,fontWeight:700,color:'var(--muted)',letterSpacing:'.08em',textTransform:'uppercase',margin:'2px 2px 5px'}}>{lang==='de'?'Skill / Posten':'Skill'}</div>
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {skills.map(sk=><button key={sk.id} className={`chip${selSkill===sk.id?' active':''}`} style={{fontSize:11,padding:'3px 10px'}} onClick={()=>setSelSkill(selSkill===sk.id?null:sk.id)}>{sk.name||`Skill ${skills.indexOf(sk)+1}`}</button>)}
          </div>
        </div>
      )}

      {/* Skill scoring view (oldschool) */}
      {selSkill&&isOldschool&&(()=>{
        const sk=skills.find(s=>s.id===selSkill);
        const catAths=filteredAthList.filter(a=>activeGroupCats.includes(a.cat));
        return(
          <div className="sh-card" style={{padding:'14px 16px'}}>
            <div style={{marginBottom:10}}>
              <div className="lbl" style={{marginBottom:4}}>
                {sk?.name||selSkill} — {activeGroupLabel}
                <span style={{fontSize:10,fontWeight:400,color:'var(--muted)',marginLeft:8}}>3 Versuche · 100/50/20 Punkte</span>
              </div>
              <div style={{fontSize:12,color:'var(--muted)',marginBottom:8}}>{catAths.length} {lang==='de'?'Athleten':'Athletes'} · {catAths.filter(a=>{const r=getAttemptResult(a.id,selSkill);return r.result!=null;}).length} {lang==='de'?'bewertet':'scored'}</div>
              <input placeholder={lang==='de'?'Suche nach Name oder #...':'Search by name or #...'} value={searchQ} onChange={e=>setSearchQ(e.target.value)} style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1px solid var(--border)',background:'rgba(255,255,255,.06)',fontSize:14,color:'var(--text)',boxSizing:'border-box'}}/>
              <div style={{fontSize:10,color:'var(--dim)',marginTop:6,display:'flex',alignItems:'center',gap:4}}><I.RefreshCw s={10}/> {lang==='de'?'Tipp: Lange auf einen Namen drücken, um die Wertung zurückzusetzen':'Tip: long-press a name to reset its score'}</div>
            </div>
            {catAths.filter(a=>{if(!searchQ.trim())return true;const q=searchQ.toLowerCase();return a.name?.toLowerCase().includes(q)||String(a.num).includes(q);}).map(a=>{
              const res=getAttemptResult(a.id,selSkill);
              const done=res.result==='pass'||res.tries===3;
              return(
                <div key={a.id} style={{padding:'8px 6px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:8,background:resetFlash===a.id?'rgba(255,149,0,.12)':'transparent',borderRadius:resetFlash===a.id?8:0,transition:'background .35s ease'}}>
                  <div style={{flex:1,cursor:'pointer',userSelect:'none',WebkitUserSelect:'none',WebkitTouchCallout:'none',touchAction:'pan-y'}}
                    onPointerDown={e=>lpStart(a.id,e)} onPointerMove={lpMove} onPointerUp={lpCancel} onPointerLeave={lpCancel} onPointerCancel={lpCancel}
                    onContextMenu={e=>e.preventDefault()}
                    title={lang==='de'?'Lange drücken → Wertung zurücksetzen':'Long-press → reset score'}>
                    <div style={{fontSize:13,fontWeight:600}}>{a.name}</div>
                    {resetFlash===a.id
                      ?<div style={{fontSize:10,color:'#FF9500',fontWeight:700,display:'flex',alignItems:'center',gap:3}}><I.RefreshCw s={10} c="#FF9500"/> {lang==='de'?'zurückgesetzt':'reset'}</div>
                      :<div style={{fontSize:10,color:'var(--muted)'}}>#{a.num}{activeGroup==='all'?` · ${(a.cat||'').toUpperCase()}`:''}</div>}
                  </div>
                  {done?(
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:15,fontWeight:800,color:res.result==='pass'?'var(--green)':'var(--red)',fontFamily:'JetBrains Mono'}}>{res.result==='pass'?`+${res.pts}`:'0'}</div>
                      <div style={{fontSize:9,color:'var(--muted)'}}>{res.result==='pass'?`${res.tries}. Versuch`:'Nicht geschafft'}</div>
                      <button style={{fontSize:9,color:'var(--muted)',background:'none',border:'none',cursor:'pointer',marginTop:2,textDecoration:'underline'}} onClick={async()=>{if(scoringLocked){tryUnlockScoring(activeGroup);return;}await fbSet(`ogn/${compId}/skillScores/${a.id}/${selSkill}`,null);SFX.click();}}>Reset</button>
                    </div>
                  ):(
                    <div style={{display:'flex',gap:4,flexShrink:0}}>
                      {[1,2,3].map(n=>{
                        const prevFailed=n>1&&(skillScores?.[a.id]?.[selSkill]?.[`a${n-1}`]===false);
                        const alreadyDone=skillScores?.[a.id]?.[selSkill]?.[`a${n}`]!=null;
                        const canTry=(n===1&&!alreadyDone)||(n>1&&prevFailed&&!alreadyDone);
                        return canTry?(
                          <div key={n} style={{display:'flex',flexDirection:'column',gap:6,alignItems:'center'}}>
                            <div style={{fontSize:12,color:'var(--muted)',fontWeight:800,letterSpacing:'.05em'}}>V{n} ({n===1?'100P':n===2?'50P':'20P'})</div>
                            <div style={{display:'flex',gap:8}}>
                              <button style={{width:72,height:64,borderRadius:14,border:'2.5px solid rgba(52,199,89,.6)',background:'rgba(52,199,89,.12)',color:'var(--green)',cursor:'pointer',fontSize:28,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',touchAction:'manipulation',WebkitTapHighlightColor:'transparent',boxShadow:'0 2px 8px rgba(52,199,89,.15)'}} onClick={()=>setAttempt(a.id,selSkill,n,true)}>✓</button>
                              <button style={{width:72,height:64,borderRadius:14,border:'2.5px solid rgba(255,59,48,.6)',background:'rgba(255,59,48,.12)',color:'var(--red)',cursor:'pointer',fontSize:28,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',touchAction:'manipulation',WebkitTapHighlightColor:'transparent',boxShadow:'0 2px 8px rgba(255,59,48,.15)'}} onClick={()=>setAttempt(a.id,selSkill,n,false)}>✗</button>
                            </div>
                          </div>
                        ):null;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Siegerehrung modal */}
      {showSiegerehrung&&(()=>{
        const podCat=activeCat;
        const podRank=getRanking(podCat);
        const top3=podRank.slice(0,3);
        const podColors=['var(--gold)','#C0C0C0','#CD7F32'];
        const podHeights=[100,70,50];
        return(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',zIndex:9000,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20,overflowY:'auto'}} onClick={e=>{if(e.target===e.currentTarget)setShowSiegerehrung(false);}}>
            <div style={{width:'100%',maxWidth:440,background:'var(--bg2)',borderRadius:18,border:'1px solid rgba(200,168,75,.3)',padding:'24px 20px',position:'relative',boxShadow:'0 20px 60px rgba(0,0,0,.65)',animation:'scaleIn .3s ease'}}>
              <button style={{position:'absolute',top:12,right:14,background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:20,lineHeight:1}} onClick={()=>setShowSiegerehrung(false)}>×</button>
              {/* Title */}
              <div style={{textAlign:'center',marginBottom:20}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--gold)',letterSpacing:'.12em',textTransform:'uppercase',marginBottom:4}}>{lang==='de'?'Siegerehrung':'Awards Ceremony'}</div>
                <div style={{fontSize:20,fontWeight:900}}>{info?.name||'Skill Wettkampf'}</div>
                <div style={{fontSize:12,color:'var(--muted)',marginTop:3}}>{IGN_CATS.find(c=>c.id===podCat)?.name[lang]||podCat}</div>
              </div>
              {/* Podium */}
              <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:8,marginBottom:24,height:160}}>
                {[1,0,2].map(rank=>{
                  const a=top3[rank];
                  if(!a)return<div key={rank} style={{flex:1}}/>;
                  const pos=rank+1;
                  const col=podColors[rank];
                  const h=podHeights[rank];
                  return(
                    <div key={rank} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,flex:1}}>
                      <div style={{width:rank===0?44:36,height:rank===0?44:36,borderRadius:'50%',background:`${col}22`,border:`2px solid ${col}`,display:'flex',alignItems:'center',justifyContent:'center',color:col,boxShadow:rank===0?`0 0 16px ${col}55`:'none'}}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:rank===0?22:18,height:rank===0?22:18}}><circle cx="12" cy="7" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                      </div>
                      <div style={{fontSize:rank===0?12:10,fontWeight:800,textAlign:'center',maxWidth:90,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:col}}>{a.name}</div>
                      <div style={{fontSize:rank===0?18:14,fontWeight:900,color:col,fontFamily:'JetBrains Mono'}}>{a.skillTotal}</div>
                      <div style={{background:`${col}22`,border:`1px solid ${col}`,borderRadius:'6px 6px 0 0',width:'100%',height:h,display:'flex',alignItems:'center',justifyContent:'center',fontSize:rank===0?30:22,fontWeight:900,color:col,boxShadow:rank===0?`0 0 20px ${col}33`:''}}>
                        {pos}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Category selector if multiple cats */}
              {cats.length>1&&(
                <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'center',marginBottom:12}}>
                  {cats.map(catId=>{const cat=IGN_CATS.find(c=>c.id===catId);return(
                    <button key={catId} className={`chip${podCat===catId?' active':''}`} style={{fontSize:10,padding:'2px 8px'}} onClick={()=>setSelCat(catId)}>{cat?.name[lang]||catId}</button>
                  );})}
                </div>
              )}
              {/* Full ranking list */}
              <div style={{borderTop:'1px solid var(--border)',paddingTop:12}}>
                <div style={{fontSize:10,color:'var(--muted)',marginBottom:8,textAlign:'center',letterSpacing:'.06em'}}>{lang==='de'?'VOLLSTÄNDIGE RANGLISTE':'FULL RANKING'}</div>
                {podRank.map((a,i)=>(
                  <div key={a.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:i<podRank.length-1?'1px solid var(--border)':''}}>
                    <div style={{width:22,textAlign:'center',fontWeight:800,fontSize:13,color:podColors[i]||'var(--muted)',fontFamily:'JetBrains Mono',flexShrink:0}}>{i+1}</div>
                    <div style={{width:32,height:32,borderRadius:'50%',background:(podColors[i]||'rgba(255,255,255,.06)')+'22',border:`1.5px solid ${(podColors[i]||'rgba(255,255,255,.1)')}55`,display:'flex',alignItems:'center',justifyContent:'center',color:podColors[i]||'var(--muted)',flexShrink:0}}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:17,height:17}}><circle cx="12" cy="7" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700}}>{a.name}</div>
                      <div style={{fontSize:10,color:'var(--muted)'}}>#{a.num}{a.team?` · ${a.team}`:''}</div>
                    </div>
                    <div style={{fontSize:16,fontWeight:800,color:podColors[i]||'var(--text)',fontFamily:'JetBrains Mono'}}>{a.skillTotal>0?a.skillTotal:'—'}</div>
                  </div>
                ))}
                {podRank.length===0&&<div style={{textAlign:'center',padding:'16px',color:'var(--muted)',fontSize:13}}>{lang==='de'?'Keine Resultate':'No results'}</div>}
              </div>
              <button className="btn btn-ghost" style={{width:'100%',marginTop:16,padding:'10px',fontSize:13}} onClick={()=>setShowSiegerehrung(false)}>{lang==='de'?'Schließen':'Close'}</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export { SkillPhaseView };
