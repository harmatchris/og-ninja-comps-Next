import React, { useState, useEffect, useRef } from 'react';
import { useLang } from '../i18n.js';
import { IGN_CATS, db, fbSet } from '../config.js';
import { uid, toFlag } from '../utils.js';
import { useFbVal, SFX } from '../hooks.js';
import { I } from '../icons.jsx';

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
  const [showSkillMgmt,setShowSkillMgmt]=useState(false);
  const [now,setNow]=useState(Date.now());

  // Timer state from Firebase
  const timerStartedAt=skillStatus?.timerStartedAt||null;
  const timerHrs=skillPhase.timerHrs||0;
  const timerDurationMs=timerHrs*3600000;
  const timerPaused=!!skillStatus?.paused;
  const pausedAt=skillStatus?.pausedAt||0;
  const pausedTotal=skillStatus?.pausedTotal||0;
  const timerStarted=!!timerStartedAt&&timerHrs>0;
  // Effective elapsed = now - startedAt - totalPausedTime - (if currently paused, time since pause start)
  const currentPauseDur=timerPaused&&pausedAt?(now-pausedAt):0;
  const timerElapsed=timerStarted?(now-timerStartedAt-pausedTotal-currentPauseDur):0;
  const timerRemaining=timerStarted?Math.max(0,timerDurationMs-timerElapsed):timerDurationMs;
  const timerExpired=timerStarted&&!timerPaused&&timerRemaining<=0;
  // Scoring allowed = timer started AND not paused AND not expired
  const scoringAllowed=timerStarted&&!timerPaused&&!timerExpired;

  useEffect(()=>{
    if(!timerStarted||timerExpired||timerPaused)return;
    const iv=setInterval(()=>setNow(Date.now()),1000);
    return()=>clearInterval(iv);
  },[timerStarted,timerExpired,timerPaused]);

  // Auto-fail unattempted skills when timer expires
  useEffect(()=>{
    if(!timerExpired||!athletes||skillStatus?.autoFailed)return;
    const updates={};
    athList.forEach(a=>{
      skills.forEach(sk=>{
        const sc=skillScores?.[a.id]?.[sk.id];
        if(!sc||(!sc.completed&&(sc.attempts||0)===0)){
          updates[`ogn/${compId}/skillScores/${a.id}/${sk.id}`]={attempts:0,completed:false,flashed:false,poolScore:0,autoFailed:true};
        }
      });
    });
    if(Object.keys(updates).length){
      const batch={};Object.entries(updates).forEach(([p,v])=>{batch[p]=v;});
      db.ref().update(batch);
      fbSet(`ogn/${compId}/skillPhaseStatus/autoFailed`,true);
    }
  },[timerExpired]);

  const [countdown,setCountdown]=useState(null); // 10..1..GO

  const startTimer=()=>{
    setCountdown(10);
    SFX.click();
  };

  const pauseTimer=async()=>{
    await fbSet(`ogn/${compId}/skillPhaseStatus/paused`,true);
    await fbSet(`ogn/${compId}/skillPhaseStatus/pausedAt`,Date.now());
    SFX.fall();
  };

  const resumeTimer=async()=>{
    const pauseDuration=Date.now()-(skillStatus?.pausedAt||Date.now());
    const newTotal=(skillStatus?.pausedTotal||0)+pauseDuration;
    await fbSet(`ogn/${compId}/skillPhaseStatus/pausedTotal`,newTotal);
    await fbSet(`ogn/${compId}/skillPhaseStatus/paused`,false);
    await fbSet(`ogn/${compId}/skillPhaseStatus/pausedAt`,null);
    SFX.checkpoint();
  };

  // 10-second countdown with beeps
  useEffect(()=>{
    if(countdown===null)return;
    if(countdown<=0){
      // GO! — loud horn, start the actual timer
      SFX.complete();
      fbSet(`ogn/${compId}/skillPhaseStatus/timerStartedAt`,Date.now());
      setCountdown(null);
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
  const cats=[...new Set(athList.map(a=>a.cat))];

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
    const numSt=info.numStations||1;
    cats.forEach(catId=>{
      const ranked=getRanking(catId);
      const ordered=seedMode==='inverted'?[...ranked].reverse():ranked;
      ordered.forEach((a,i)=>{updates[`ogn/${compId}/athletes/${a.id}/queueOrder`]=i;});
      for(let s=1;s<=numSt;s++){ordered.forEach((a,i)=>{updates[`ogn/${compId}/stages/${s}/athletes/${a.id}/queueOrder`]=i;});}
    });
    await db.ref().update(updates);
    await fbSet(`ogn/${compId}/skillPhaseStatus/seedingDone`,true);
    setSeedingDone(true);
    SFX.complete();
  };

  const openSiegerehrung=async()=>{
    const hasStages=(info?.numStations||0)>0;
    const msgDe=hasStages?'Skill-Wettkampf abschließen und Siegerehrung anzeigen?\n\nKein Seeding für Stages wird generiert.':'Skill-Wettkampf abschließen und Siegerehrung anzeigen?';
    const msgEn=hasStages?'Close skill competition and show awards ceremony?\n\nNo seeding for stages will be generated.':'Close skill competition and show awards ceremony?';
    if(!window.confirm(lang==='de'?msgDe:msgEn))return;
    await fbSet(`ogn/${compId}/skillPhaseStatus/finalized`,true);
    setShowSiegerehrung(true);
    SFX.complete();
  };

  const setAttempt=async(athId,skillId,attempt,success)=>{
    await fbSet(`ogn/${compId}/skillScores/${athId}/${skillId}/a${attempt}`,success);
    SFX.checkpoint();
  };

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
    athList.forEach(a=>{
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
              {skillPhase.timerHrs>0&&` · ${skillPhase.timerHrs}h Timer`}
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

      {/* Timer */}
      {timerHrs>0&&(
        <div className="sh-card" style={{padding:'12px 16px',
          background:timerExpired?'rgba(255,59,48,.1)':timerPaused?'rgba(255,149,0,.1)':timerStarted?'rgba(255,214,10,.08)':'rgba(255,255,255,.03)',
          borderColor:timerExpired?'rgba(255,59,48,.35)':timerPaused?'rgba(255,149,0,.4)':timerStarted?'rgba(255,214,10,.3)':'var(--border)'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <I.Clock s={18} c={timerExpired?'var(--red)':timerPaused?'#FF9500':timerStarted?'var(--gold)':'var(--muted)'}/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:'var(--muted)',fontWeight:600}}>{lang==='de'?'Skill Phase Timer':'Skill Phase Timer'}</div>
              <div style={{fontSize:28,fontWeight:900,fontFamily:'JetBrains Mono',letterSpacing:'-1px',
                color:timerExpired?'var(--red)':timerPaused?'#FF9500':timerStarted?'var(--gold)':'var(--muted)'}}>
                {timerExpired?(lang==='de'?'ZEIT ABGELAUFEN':'TIME UP'):timerStarted?fmtTimer(timerRemaining):fmtTimer(timerDurationMs)}
              </div>
            </div>
            {/* Not started yet */}
            {!timerStarted&&!timerExpired&&countdown===null&&(
              <button className="btn btn-coral" style={{padding:'10px 18px',fontSize:13,gap:6}} onClick={startTimer}>
                <I.Play s={14}/> Start
              </button>
            )}
            {/* Running — show Pause + Stop + Reset */}
            {timerStarted&&!timerExpired&&!timerPaused&&(
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <div style={{fontSize:10,color:'var(--gold)',fontWeight:700,padding:'4px 10px',background:'rgba(255,214,10,.15)',borderRadius:8,border:'1px solid rgba(255,214,10,.3)',animation:'pulse 1.6s infinite'}}>LIVE</div>
                <button className="btn" style={{padding:'6px 10px',fontSize:10,gap:4,background:'rgba(255,149,0,.12)',border:'1.5px solid rgba(255,149,0,.4)',color:'#FF9500',fontWeight:700}} onClick={pauseTimer}>
                  ⏸ {lang==='de'?'Pause':'Pause'}
                </button>
                <button className="btn btn-fall" style={{padding:'6px 10px',fontSize:10,gap:4}} onClick={async()=>{
                  if(!window.confirm(lang==='de'?'Skill Phase jetzt beenden?':'End skill phase now?'))return;
                  await fbSet(`ogn/${compId}/skillPhaseStatus/paused`,false);
                  const elapsed=Date.now()-timerStartedAt-(pausedTotal||0);
                  await fbSet(`ogn/${compId}/skillPhaseStatus/timerStartedAt`,Date.now()-timerDurationMs);
                  SFX.fall();
                }}><I.StopOct s={11}/></button>
              </div>
            )}
            {/* Paused — show Resume + End + Reset */}
            {timerStarted&&!timerExpired&&timerPaused&&(
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <div style={{fontSize:10,color:'#FF9500',fontWeight:700,padding:'4px 10px',background:'rgba(255,149,0,.15)',borderRadius:8,border:'1px solid rgba(255,149,0,.3)'}}>⏸ {lang==='de'?'PAUSIERT':'PAUSED'}</div>
                <button className="btn btn-coral" style={{padding:'6px 12px',fontSize:10,gap:4}} onClick={resumeTimer}>
                  ▶ {lang==='de'?'Weiter':'Resume'}
                </button>
                <button className="btn btn-fall" style={{padding:'6px 10px',fontSize:10,gap:4}} onClick={async()=>{
                  if(!window.confirm(lang==='de'?'Skill Phase jetzt beenden?':'End skill phase now?'))return;
                  await fbSet(`ogn/${compId}/skillPhaseStatus/paused`,false);
                  await fbSet(`ogn/${compId}/skillPhaseStatus/timerStartedAt`,Date.now()-timerDurationMs);
                  SFX.fall();
                }}><I.StopOct s={11}/> {lang==='de'?'Beenden':'End'}</button>
              </div>
            )}
            {/* Expired */}
            {timerExpired&&(
              <button className="btn btn-ghost" style={{padding:'8px 14px',fontSize:11,gap:5}} onClick={async()=>{
                if(!window.confirm(lang==='de'?'Timer zurücksetzen?':'Reset timer?'))return;
                await fbSet(`ogn/${compId}/skillPhaseStatus`,{});
                SFX.click();
              }}><I.RefreshCw s={13}/> {lang==='de'?'Reset':'Reset'}</button>
            )}
          </div>
          {timerPaused&&(
            <div style={{marginTop:8,padding:'8px 12px',background:'rgba(255,149,0,.08)',borderRadius:8,border:'1px solid rgba(255,149,0,.2)',fontSize:11,color:'#FF9500',textAlign:'center',fontWeight:600}}>
              {lang==='de'?'Wettkampf unterbrochen — keine Eingaben möglich':'Competition paused — no entries allowed'}
            </div>
          )}
        </div>
      )}

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

      {/* Category tabs */}
      <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
        {cats.map(catId=>{const cat=IGN_CATS.find(c=>c.id===catId);return(
          <button key={catId} className={`chip${activeCat===catId?' active':''}`} style={{fontSize:11,padding:'3px 10px',...(activeCat===catId?{background:`${cat?.color||'var(--cor)'}1A`,borderColor:`${cat?.color||'var(--cor)'}55`,color:cat?.color||'var(--cor)'}:{})}} onClick={()=>setSelCat(catId)}>{cat?.name[lang]||catId}</button>
        );})}
      </div>

      {/* Skill tabs (oldschool only — jury scoring per skill) */}
      {skills.length>0&&isOldschool&&(
        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
          {skills.map(sk=><button key={sk.id} className={`chip${selSkill===sk.id?' active':''}`} style={{fontSize:11,padding:'3px 10px'}} onClick={()=>setSelSkill(selSkill===sk.id?null:sk.id)}>{sk.name||`Skill ${skills.indexOf(sk)+1}`}</button>)}
        </div>
      )}

      {/* Skill scoring view (oldschool) */}
      {selSkill&&isOldschool&&(()=>{
        const sk=skills.find(s=>s.id===selSkill);
        const catAths=athList.filter(a=>a.cat===activeCat);
        return(
          <div className="sh-card" style={{padding:'12px 14px'}}>
            <div className="lbl" style={{marginBottom:8}}>
              {sk?.name||selSkill} — {IGN_CATS.find(c=>c.id===activeCat)?.name[lang]||activeCat}
              <span style={{fontSize:10,fontWeight:400,color:'var(--muted)',marginLeft:8}}>3 Versuche · 100/50/20 Punkte</span>
            </div>
            {catAths.map(a=>{
              const res=getAttemptResult(a.id,selSkill);
              const done=res.result==='pass'||res.tries===3;
              return(
                <div key={a.id} style={{padding:'8px 0',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600}}>{a.name}</div>
                    <div style={{fontSize:10,color:'var(--muted)'}}>#{a.num}</div>
                  </div>
                  {done?(
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:15,fontWeight:800,color:res.result==='pass'?'var(--green)':'var(--red)',fontFamily:'JetBrains Mono'}}>{res.result==='pass'?`+${res.pts}`:'0'}</div>
                      <div style={{fontSize:9,color:'var(--muted)'}}>{res.result==='pass'?`${res.tries}. Versuch`:'Nicht geschafft'}</div>
                      <button style={{fontSize:9,color:'var(--muted)',background:'none',border:'none',cursor:'pointer',marginTop:2,textDecoration:'underline'}} onClick={async()=>{await fbSet(`ogn/${compId}/skillScores/${a.id}/${selSkill}`,null);SFX.click();}}>Reset</button>
                    </div>
                  ):(
                    <div style={{display:'flex',gap:4,flexShrink:0}}>
                      {[1,2,3].map(n=>{
                        const prevFailed=n>1&&(skillScores?.[a.id]?.[selSkill]?.[`a${n-1}`]===false);
                        const alreadyDone=skillScores?.[a.id]?.[selSkill]?.[`a${n}`]!=null;
                        const canTry=(n===1&&!alreadyDone)||(n>1&&prevFailed&&!alreadyDone);
                        return canTry?(
                          <div key={n} style={{display:'flex',flexDirection:'column',gap:3,alignItems:'center'}}>
                            <div style={{fontSize:8,color:'var(--muted)',fontWeight:700}}>V{n}</div>
                            <div style={{display:'flex',gap:2}}>
                              <button style={{width:30,height:30,borderRadius:8,border:'1.5px solid rgba(52,199,89,.5)',background:'rgba(52,199,89,.1)',color:'var(--green)',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setAttempt(a.id,selSkill,n,true)}>✓</button>
                              <button style={{width:30,height:30,borderRadius:8,border:'1.5px solid rgba(255,59,48,.5)',background:'rgba(255,59,48,.1)',color:'var(--red)',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setAttempt(a.id,selSkill,n,false)}>✗</button>
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

      {/* Action buttons */}
      {(()=>{
        const hasStages=(info?.numStations||0)>0;
        return(
        <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:8}}>
          {seedingAlreadyDone&&<div style={{fontSize:11,color:'var(--green)',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}><I.Check s={12} c="var(--green)"/> {lang==='de'?'Seeding wurde generiert':'Seeding generated'}</div>}
          {skillStatus?.finalized&&<div style={{fontSize:11,color:'var(--gold)',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}><I.Trophy s={12} c="var(--gold)"/> {lang==='de'?'Wettkampf abgeschlossen':'Competition finalized'}</div>}
          {hasStages&&(<>
            <button className="btn btn-coral" style={{width:'100%',padding:'11px',fontSize:13,gap:8}} onClick={generateSeeding}>
              <I.Sort s={14}/> {lang==='de'?`Seeding → Stage (${skillPhase.seedingMode==='inverted'?'Invertiert':'Manuell'})`:`Seeding → Stage (${skillPhase.seedingMode==='inverted'?'inverted':'manual'})`}
            </button>
            <div style={{fontSize:10,color:'var(--muted)',textAlign:'center',lineHeight:1.4,marginTop:-2}}>
              {skillPhase.seedingMode==='inverted'?(lang==='de'?'Niedrigste Skill-Punkte → zuerst auf den Stage-Parcours':'Lowest skill pts → first on stage'):lang==='de'?'Reihenfolge wie im Skill-Ranking':'Order as in skill ranking'}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{flex:1,height:1,background:'var(--border)'}}/>
              <span style={{fontSize:10,color:'var(--dim)',letterSpacing:'.08em'}}>{lang==='de'?'ODER':'OR'}</span>
              <div style={{flex:1,height:1,background:'var(--border)'}}/>
            </div>
          </>)}
          <button className={`btn ${hasStages?'btn-ghost':'btn-coral'}`} style={{width:'100%',padding:'11px',fontSize:13,gap:8,...(!hasStages?{}:{borderColor:'rgba(200,168,75,.35)',color:'var(--gold)'})}} onClick={openSiegerehrung}>
            <I.Trophy s={14}/> {lang==='de'?'Siegerehrung / Wettkampf abschließen':'Awards Ceremony / Close Competition'}
          </button>
          {!hasStages&&<div style={{fontSize:10,color:'var(--muted)',textAlign:'center',lineHeight:1.4,marginTop:-2}}>
            {lang==='de'?'Skill-Rangliste & Podium anzeigen':'Show skill ranking & podium'}
          </div>}
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
