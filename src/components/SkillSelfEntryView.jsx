import React, { useState, useEffect, useRef } from 'react';
import { useLang } from '../i18n.js';
import { IGN_CATS, db, fbSet } from '../config.js';
import { uid, toFlag } from '../utils.js';
import { useFbVal, SFX } from '../hooks.js';
import { I } from '../icons.jsx';
import { TopBar, Spinner, EmptyState } from './shared.jsx';

const SkillSelfEntryView=({compId})=>{
  const {lang}=useLang();
  const info=useFbVal(`ogn/${compId}/info`);
  const athletes=useFbVal(`ogn/${compId}/athletes`);
  const skillScores=useFbVal(`ogn/${compId}/skillScores`);
  const skillStatus=useFbVal(`ogn/${compId}/skillPhaseStatus`);
  const [selCat,setSelCat]=useState(null);
  const [selAth,setSelAth]=useState(null);
  const [search,setSearch]=useState('');
  const [now,setNow]=useState(Date.now());

  const skillPhase=info?.skillPhase||{};
  const skills=skillPhase.skills||[];

  // Timer
  const timerStartedAt=skillStatus?.timerStartedAt||null;
  const timerMin=skillPhase.timerMin||(skillPhase.timerHrs?skillPhase.timerHrs*60:0);
  const timerDurationMs=timerMin*60000;
  const timerPaused=!!skillStatus?.paused;
  const pausedAt=skillStatus?.pausedAt||0;
  const pausedTotal=skillStatus?.pausedTotal||0;
  const timerStarted=!!timerStartedAt&&timerMin>0;
  const currentPauseDur=timerPaused&&pausedAt?(now-pausedAt):0;
  const timerElapsed=timerStarted?(now-timerStartedAt-pausedTotal-currentPauseDur):0;
  const timerRemaining=timerStarted?Math.max(0,timerDurationMs-timerElapsed):0;
  const timerExpired=timerStarted&&!timerPaused&&timerRemaining<=0;
  // Scoring only allowed when timer is running (started + not paused + not expired)
  const scoringBlocked=timerMin>0&&(!timerStarted||timerPaused||timerExpired);
  const fmtTimer=ms=>{const t=Math.floor(ms/1000);const h=Math.floor(t/3600);const m=Math.floor((t%3600)/60);const s=t%60;return h>0?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;};
  useEffect(()=>{if(!timerStarted||timerExpired||timerPaused)return;const iv=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(iv);},[timerStarted,timerExpired,timerPaused]);
  const athListAll=athletes?Object.values(athletes):[];
  const skillCats=skillPhase.skillCategories;
  const athList=skillCats&&skillCats!=='all'&&Array.isArray(skillCats)?athListAll.filter(a=>skillCats.includes(a.cat)):athListAll;
  const cats=[...new Set(athList.map(a=>a.cat))];
  const activeCat=selCat||cats[0];
  const filtered=athList.filter(a=>a.cat===activeCat&&(!search.trim()||a.name.toLowerCase().includes(search.toLowerCase())||a.num?.toString()===search.trim()));

  const recordAttempt=async(skillId,success)=>{
    if(!selAth)return;
    const path=`ogn/${compId}/skillScores/${selAth.id}/${skillId}`;
    const cur=skillScores?.[selAth.id]?.[skillId]||{attempts:0,completed:false,flashed:false};
    if(cur.completed)return;
    const newAttempts=(cur.attempts||0)+1;
    const flashed=newAttempts===1&&success;
    const updates={attempts:newAttempts,completed:success?true:cur.completed,flashed:success&&flashed?true:cur.flashed};
    if(success){
      // Compute pool score (simple: 1000 shared among all completions)
      // We'll just store 1000 as raw score and recompute on display
      updates.poolScore=1000;
    }
    await fbSet(path,{...cur,...updates});
    if(success)SFX.checkpoint();else SFX.click();
  };

  if(!info)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}><Spinner/></div>;

  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <TopBar title="Skill Phase" sub={info.name||''} logo={false}/>
      {/* Timer bar */}
      {timerMin>0&&(
        <div style={{padding:'10px 16px',
          background:timerExpired?'rgba(255,59,48,.15)':timerPaused?'rgba(255,149,0,.12)':timerStarted?'rgba(255,214,10,.1)':'rgba(255,255,255,.05)',
          borderBottom:`1px solid ${timerExpired?'rgba(255,59,48,.3)':timerPaused?'rgba(255,149,0,.35)':timerStarted?'rgba(255,214,10,.25)':'var(--border)'}`,
          display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <I.Clock s={16} c={timerExpired?'var(--red)':timerPaused?'#FF9500':timerStarted?'var(--gold)':'var(--muted)'}/>
          <span style={{fontSize:20,fontWeight:900,fontFamily:'JetBrains Mono',letterSpacing:'-1px',
            color:timerExpired?'var(--red)':timerPaused?'#FF9500':timerStarted?'var(--gold)':'var(--muted)'}}>
            {timerExpired?(lang==='de'?'ZEIT ABGELAUFEN':'TIME UP')
              :timerPaused?(lang==='de'?'⏸ PAUSIERT':'⏸ PAUSED')
              :timerStarted?fmtTimer(timerRemaining)
              :(lang==='de'?'Warte auf Start…':'Waiting for start…')}
          </span>
        </div>
      )}
      <div className="section" style={{flex:1}}>
      {scoringBlocked&&!scoringBlocked&&(
        <div style={{padding:'16px',background:timerPaused?'rgba(255,149,0,.08)':'rgba(255,255,255,.04)',border:`1px solid ${timerPaused?'rgba(255,149,0,.25)':'var(--border)'}`,borderRadius:12,textAlign:'center',marginBottom:8}}>
          <div style={{fontSize:15,fontWeight:800,color:timerPaused?'#FF9500':'var(--muted)'}}>
            {timerPaused?(lang==='de'?'Wettkampf unterbrochen':'Competition paused'):(lang==='de'?'Wettkampf noch nicht gestartet':'Competition not started yet')}
          </div>
          <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>
            {timerPaused?(lang==='de'?'Bitte warten — keine Eingaben möglich':'Please wait — no entries allowed'):(lang==='de'?'Warte bis die Jury den Timer startet…':'Waiting for the jury to start the timer…')}
          </div>
        </div>
      )}
      {timerExpired&&(
        <div style={{padding:'16px',background:'rgba(255,59,48,.1)',border:'1px solid rgba(255,59,48,.3)',borderRadius:12,textAlign:'center',marginBottom:8}}>
          <div style={{fontSize:15,fontWeight:800,color:'var(--red)'}}>{lang==='de'?'Skill Phase beendet':'Skill Phase ended'}</div>
          <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>{lang==='de'?'Keine weiteren Versuche möglich':'No more attempts allowed'}</div>
        </div>
      )}
        {!selAth&&(
          <>
            <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>{lang==='de'?'Wähle deine Kategorie:':'Select your category:'}</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>
              {cats.map(catId=>{const cat=IGN_CATS.find(c=>c.id===catId);return(
                <button key={catId} className={`chip${activeCat===catId?' active':''}`} style={{fontSize:12}} onClick={()=>setSelCat(catId)}>{cat?.name[lang]||catId}</button>
              );})}
            </div>
            <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>{lang==='de'?'Wähle deinen Namen:':'Select your name:'}</div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={lang==='de'?'Name oder Startnummer suchen…':'Search name or start number…'} style={{marginBottom:8}}/>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              {filtered.map(a=>(
                <button key={a.id} className="sh-card btn" style={{padding:'16px 18px',textAlign:'left',display:'flex',gap:14,alignItems:'center',justifyContent:'flex-start',minHeight:60}} onClick={()=>setSelAth(a)}>
                  <div style={{width:32,height:32,borderRadius:8,background:'rgba(255,94,58,.15)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:13,color:'var(--cor)',fontFamily:'JetBrains Mono',flexShrink:0}}>#{a.num}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14}}>{a.name}</div>
                    {a.team&&<div style={{fontSize:11,color:'var(--muted)'}}>{a.team}</div>}
                  </div>
                  <I.ChevR s={16} c="var(--muted)"/>
                </button>
              ))}
            </div>
          </>
        )}
        {selAth&&(
          <>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
              <button className="btn btn-ghost" style={{padding:'6px 10px',fontSize:12,gap:5}} onClick={()=>setSelAth(null)}><I.ChevL s={13}/> {lang==='de'?'Zurück':'Back'}</button>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:16}}>{selAth.name}</div>
                <div style={{fontSize:11,color:'var(--muted)'}}>#{selAth.num}{selAth.team&&` · ${selAth.team}`}</div>
              </div>
            </div>
            {skills.map((sk,si)=>{
              const score=skillScores?.[selAth.id]?.[sk.id]||{attempts:0,completed:false,flashed:false};
              const resetSkill=async()=>{
                await fbSet(`ogn/${compId}/skillScores/${selAth.id}/${sk.id}`,null);
                SFX.click();
              };
              return(
                <div key={sk.id} className="sh-card" style={{padding:'14px 16px',marginBottom:10,borderColor:score.completed?(score.flashed?'rgba(255,214,10,.4)':'rgba(52,199,89,.4)'):score.attempts>0?'rgba(255,59,48,.3)':'var(--border)',background:score.completed?(score.flashed?'rgba(255,214,10,.06)':'rgba(52,199,89,.06)'):score.attempts>0?'rgba(255,59,48,.04)':'var(--card)'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:score.completed||score.attempts>0?4:8}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,display:'flex',alignItems:'center',gap:6}}>
                        <div style={{width:20,height:20,borderRadius:5,background:'rgba(255,255,255,.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'var(--muted)',flexShrink:0}}>{si+1}</div>
                        {sk.name||`Skill ${si+1}`}
                        {(()=>{const d=sk.difficulty||'medium';const c={easy:'#30D158',medium:'#FF9F0A',hard:'#FF3B30'}[d];const l={easy:lang==='de'?'Leicht':'Easy',medium:lang==='de'?'Mittel':'Medium',hard:lang==='de'?'Schwer':'Hard'}[d];const m={easy:'×0.8',medium:'×1',hard:'×1.5'}[d];return <span style={{fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:4,color:c,background:c+'1A',border:`1px solid ${c}44`,marginLeft:4}}>{l} {m}</span>;})()}
                      </div>
                      <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>
                        {score.completed?(
                          <span style={{color:score.flashed?'var(--gold)':'var(--green)'}}>{score.flashed?'Flash':`✓ Top · 2+ ${lang==='de'?'Versuche':'attempts'}`}</span>
                        ):(
                          score.attempts>0?<span style={{color:'var(--red)'}}>{score.attempts}× Failed</span>
                          :<span style={{color:'var(--muted)'}}>{lang==='de'?'Noch offen':'Not attempted'}</span>
                        )}
                      </div>
                    </div>
                    {score.completed?<I.CheckCircle s={22} c={score.flashed?'var(--gold)':'var(--green)'}/>:null}
                  </div>
                  {/* Reset button if already scored */}
                  {(score.completed||score.attempts>0)&&!scoringBlocked&&(
                    <button style={{fontSize:10,color:'var(--muted)',background:'rgba(255,255,255,.05)',border:'1px solid var(--border)',borderRadius:6,padding:'4px 10px',cursor:'pointer',marginBottom:8,display:'flex',alignItems:'center',gap:4}} onClick={resetSkill}>
                      <I.RefreshCw s={10}/> {lang==='de'?'Zurücksetzen':'Reset'}
                    </button>
                  )}
                  {!score.completed&&!scoringBlocked&&(
                    <div style={{display:'flex',gap:6}}>
                      <button className="btn" style={{flex:1,padding:'18px 12px',fontSize:15,gap:6,flexDirection:'column',background:'rgba(255,214,10,.12)',border:'2px solid rgba(255,214,10,.4)',color:'var(--gold)',minHeight:80,borderRadius:14}} onClick={()=>{
                        const path=`ogn/${compId}/skillScores/${selAth.id}/${sk.id}`;
                        fbSet(path,{attempts:1,completed:true,flashed:true,poolScore:1000});SFX.checkpoint();
                      }}>
                        <span style={{fontSize:18,fontWeight:700,color:'var(--gold)'}}>FLASH</span>
                        <span style={{fontWeight:800}}>Flash</span>
                      </button>
                      <button className="btn" style={{flex:1,padding:'18px 12px',fontSize:15,gap:6,flexDirection:'column',background:'rgba(52,199,89,.15)',border:'2px solid rgba(52,199,89,.4)',color:'var(--green)',minHeight:80,borderRadius:14}} onClick={()=>{
                        const path=`ogn/${compId}/skillScores/${selAth.id}/${sk.id}`;
                        const cur=skillScores?.[selAth.id]?.[sk.id]||{attempts:0,completed:false,flashed:false};
                        const newAttempts=Math.max((cur.attempts||0)+1,2);
                        fbSet(path,{...cur,attempts:newAttempts,completed:true,flashed:false,poolScore:1000});SFX.checkpoint();
                      }}>
                        <span style={{fontSize:28}}>✓</span>
                        <span style={{fontWeight:800}}>Top</span>
                      </button>
                      <button className="btn" style={{flex:1,padding:'18px 12px',fontSize:15,gap:6,flexDirection:'column',background:'rgba(255,59,48,.1)',border:'2px solid rgba(255,59,48,.35)',color:'var(--red)',minHeight:80,borderRadius:14}} onClick={()=>recordAttempt(sk.id,false)}>
                        <span style={{fontSize:28}}>✗</span>
                        <span style={{fontWeight:800}}>Failed</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

export { SkillSelfEntryView };
