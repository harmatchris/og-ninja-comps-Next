import React, { useState, useEffect, useRef } from 'react';
import { useLang } from '../i18n.js';
import { IGN_CATS, DEF_OBS } from '../config.js';

const obsShortName=name=>{
  const n=(name||'').toLowerCase();
  if(/startplattform|start plattform|^start/.test(n))return '▶ Platform';
  if(/landeplattform|land plattform/.test(n))return '⬛ Land';
  if(/endplattform|end plattform/.test(n))return '⬛ End';
  return name;
};
import { fmtMs, computeRanked, computeRankedStage } from '../utils.js';
import { useFbVal, SFX } from '../hooks.js';
import { I } from '../icons.jsx';
import { Spinner, EmptyState } from './shared.jsx';

// Little ninja SVG that "runs" in place (bobbing + leg swing)
// Tricks: each CP triggers a different trick animation
const TRICKS=['ninjaFlip','ninjaSpinKick','ninjaSplit','ninjaBackflip','ninjaStarJump','ninjaWallRun'];
// Running gait cycle frames (viewBox 0 0 100 100) — 4 poses per gender
const MALE_FRAMES=[
  // Frame 1: Right leg far forward, left arm forward (contact)
  'M52 8a7.5 7.5 0 1 0-4 0zM42 17l-3 1-2 14c0 2 1 3 2 4l-12 14c-1 2 0 4 2 4l1-1 13-14 2 3-6 20c-1 3 1 5 3 5l2-1 7-21c1-3 0-5-1-7l-2-4 2-8 8 6c2 1 4 1 5-1l0-2-10-9c-2-2-4-3-6-3z',
  // Frame 2: Right leg passing under, arms mid (drive)
  'M52 8a7.5 7.5 0 1 0-4 0zM42 17l-3 1-2 14c0 2 1 3 2 4l-6 18c-1 2 0 4 2 4l1-1 7-18 4 6-3 17c0 3 1 5 3 5l2-1 4-18c1-3 0-5-1-7l-4-7 2-8 5 3c2 1 4 0 4-2l0-2-7-6c-2-2-4-3-6-3z',
  // Frame 3: Left leg far forward, right arm forward (contact opposite)
  'M52 8a7.5 7.5 0 1 0-4 0zM42 17l-3 1-2 14c0 2 1 3 2 4l-4 20c0 3 1 5 3 5l2-1 5-20 3 2-10 16c-1 2 0 4 2 4l2-1 11-17c1-2 1-4 0-6l-5-7 2-8 10 8c2 1 4 1 5-1l0-2-12-10c-2-2-4-3-6-3z',
  // Frame 4: Left leg passing under, arms mid (drive opposite)
  'M52 8a7.5 7.5 0 1 0-4 0zM42 17l-3 1-2 14c0 2 1 3 2 4l-2 18c0 3 1 5 3 5l2-1 3-18 5 5-7 18c-1 2 0 4 2 4l1-1 8-19c1-2 1-4 0-6l-3-6 2-8 6 4c2 1 4 0 4-2l0-2-8-7c-2-2-4-3-6-3z'
];
const FEMALE_FRAMES=[
  // Frame 1: Right leg far forward, left arm forward — ponytail trailing
  'M53 7a7 7 0 1 0-6 0l-4-1c-2-1-3 0-3 1l3 2 4 0 4-1 2-2c0-1-1-2-3-1l-3 2zM41 17l-2.5 1-2 13c0 2 1 3 2 3.5l-11 14c-1 2 0 4 2 4l1-.5 12-14 2 3-6 19c0 3 1 5 3 4.5l2-.5 7-20c.5-3 0-5-1-6.5l-2-4 1.5-7 7 5c2 1.5 4 1 5-1l0-2-9-8c-2-2-3.5-2.5-5.5-2.5z',
  // Frame 2: Drive phase
  'M53 7a7 7 0 1 0-6 0l-4-1c-2-1-3 0-3 1l3 2 4 0 4-1 2-2c0-1-1-2-3-1l-3 2zM41 17l-2.5 1-2 13c0 2 1 3 2 3.5l-5 17c-.5 2.5.5 4 2.5 4l1-.5 6-17 4 5-3 17c0 3 1 5 3 4.5l2-.5 4-18c.5-3 0-5-1-6.5l-4-6 1.5-7 5 3c2 1 3.5 0 4-2l0-2-7-6c-2-2-3.5-2.5-5.5-2.5z',
  // Frame 3: Left leg forward, right arm forward
  'M53 7a7 7 0 1 0-6 0l-4-1c-2-1-3 0-3 1l3 2 4 0 4-1 2-2c0-1-1-2-3-1l-3 2zM41 17l-2.5 1-2 13c0 2 1 3 2 3.5l-3 19c0 3 1 5 3 4.5l2-.5 4-19 3 2-10 15c-1 2 0 4 2 4l1-.5 11-16c1-2 1-4 0-6l-4-6 1.5-7 9 7c2 1.5 4 1 5-1l0-2-11-9c-2-2-3.5-2.5-5.5-2.5z',
  // Frame 4: Drive opposite
  'M53 7a7 7 0 1 0-6 0l-4-1c-2-1-3 0-3 1l3 2 4 0 4-1 2-2c0-1-1-2-3-1l-3 2zM41 17l-2.5 1-2 13c0 2 1 3 2 3.5l-2 17c0 3 1 5 3 4.5l2-.5 3-17 5 5-7 17c-.5 2.5.5 4 2.5 4l1-.5 8-18c.5-2.5.5-4 0-6l-3-5 1.5-7 6 4c2 1 3.5 0 4-2l0-2-8-7c-2-2-3.5-2.5-5.5-2.5z'
];
const MALE_SWING='M52 8a7.5 7.5 0 1 0-4 0zM44 17c-1.5.5-3 2-3 4l1 6-1 3-10 2c-2 .5-3 2-2 4l2 1 12-3 3-8 4 2 0 12c0 3 1 5 3 5.5l2-.5 1-14c0-3-1.5-5-3.5-6l-3-2 0-5 3 1c2 .5 3-.5 3.5-2l0-2-7-3c-2-.8-3.5-.5-5 .5z';
const FEMALE_SWING='M53 7a7 7 0 1 0-6 0l-4-1c-2-1-3 0-3 1l3 2 4 0 4-1 2-2c0-1-1-2-3-1l-3 2zM43 17c-1.5.5-2.5 2-2.5 4l.5 5-1 3-9 2c-2 .5-2.5 2-1.5 3.5l2 .5 11-3 2-7 3.5 2-.5 11c0 3 1.5 5 3.5 5l1.5-.5 1-13c0-3-1.5-5-3-5.5l-3-2 .5-5 2.5 1c2 .5 3-.5 3.5-2l-.5-2-6-2.5c-2-.8-3-.5-4.5.5z';
const isFemale=catId=>catId&&(catId.includes('w')||catId.includes('W')||catId.endsWith('f'));

const NinjaRunner=({x,y,size=28,color='#FF5E3A',name='',fallen=false,livesLeft=3,livesUsed=0,doneCPCount=0,lastCPTime=null,timeRemaining=null,resetting=false,resetUntil=null,catId=''})=>{
  const fid=`gl-${(name||'n').replace(/\s/g,'')}`;
  const rid=`rope-${(name||'n').replace(/\s/g,'')}`;
  const trick=TRICKS[doneCPCount%TRICKS.length];
  const heartD='M6 1.5C4.5-.5 1-.5 0 2c-1 2.5 3 5 6 7.5C9 7 13 4.5 12 2c-1-2.5-4.5-2.5-6-.5z';
  const female=isFemale(catId);
  const frames=female?FEMALE_FRAMES:MALE_FRAMES;
  const [frame,setFrame]=useState(0);
  const allDead=livesLeft<=0&&livesUsed>0;
  const [resetSec,setResetSec]=useState(0);
  useEffect(()=>{
    if(!resetting||!resetUntil)return;
    const tick=()=>{const left=Math.max(0,Math.ceil((resetUntil-Date.now())/1000));setResetSec(left);};
    tick();const iv=setInterval(tick,200);return()=>clearInterval(iv);
  },[resetting,resetUntil]);
  const stumbling=livesUsed>0&&!allDead;
  const swinging=resetting||(stumbling&&!resetting);
  const isRunning=!allDead&&!swinging;
  useEffect(()=>{
    if(!isRunning)return;
    const iv=setInterval(()=>setFrame(f=>(f+1)%4),150);
    return()=>clearInterval(iv);
  },[isRunning]);
  const anim=allDead?'ninjaFallOut 1.2s ease-in forwards'
    :swinging?`ninjaRopeSwing-${rid} 4s ease-in-out forwards`
    :doneCPCount>0?`${trick} 0.6s ease-out`
    :'';
  const fmtSplit=ms=>{if(!ms)return'';const s=Math.floor(ms/1000);const m=Math.floor(s/60);return`${m}:${String(s%60).padStart(2,'0')}.${String(Math.floor((ms%1000))).padStart(3,'0')}`;};
  const drop=size*2.5;
  const swingX=size*3;
  const silhouette=swinging?(female?FEMALE_SWING:MALE_SWING):frames[frame];
  const sc=size/100;
  return(
    <g transform={`translate(${x-size/2},${allDead?y+300:y-size})`}>
    <g style={{animation:anim}}>
      <style>{`
        @keyframes ninjaBob{0%{transform:translateY(0)}100%{transform:translateY(-3px)}}
        @keyframes ninjaFallOut{0%{transform:translateY(0) rotate(0);opacity:1}40%{transform:translateY(${size*2}px) rotate(180deg);opacity:.8}100%{transform:translateY(${size*12}px) rotate(720deg);opacity:0}}
        @keyframes ninjaRopeSwing-${rid}{
          0%{transform:translateY(0) translateX(0) rotate(0)}
          8%{transform:translateY(${drop}px) translateX(${size*.3}px) rotate(15deg)}
          12%{transform:translateY(${drop}px) translateX(0) rotate(-5deg)}
          18%{transform:translateY(${drop*.9}px) translateX(-${swingX*.3}px) rotate(-20deg)}
          28%{transform:translateY(${drop*.4}px) translateX(-${swingX*.7}px) rotate(-35deg)}
          38%{transform:translateY(-${size*.8}px) translateX(-${swingX}px) rotate(-15deg)}
          48%{transform:translateY(-${size*1.5}px) translateX(-${swingX*.85}px) rotate(5deg)}
          55%{transform:translateY(-${size*.3}px) translateX(-${swingX*.6}px) rotate(0)}
          65%{transform:translateY(0) translateX(-${swingX*.3}px) rotate(0)}
          78%{transform:translateY(${size*.15}px) translateX(-${swingX*.1}px) rotate(0)}
          88%{transform:translateY(-${size*.1}px) translateX(0) rotate(0)}
          100%{transform:translateY(0) translateX(0) rotate(0)}
        }
        @keyframes ropeAppear-${rid}{
          0%{opacity:0}8%{opacity:0}12%{opacity:1}55%{opacity:1}65%{opacity:.3}78%{opacity:0}100%{opacity:0}
        }
        @keyframes ninjaFlip{0%{transform:rotate(0)}30%{transform:translateY(-${size*.6}px) rotate(-180deg)}60%{transform:translateY(-${size*.3}px) rotate(-360deg)}100%{transform:rotate(-360deg)}}
        @keyframes ninjaSpinKick{0%{transform:rotate(0) scale(1)}40%{transform:translateY(-${size*.5}px) rotate(180deg) scale(1.1)}100%{transform:rotate(360deg) scale(1)}}
        @keyframes ninjaSplit{0%{transform:scaleX(1)}30%{transform:translateY(-${size*.4}px) scaleX(1.4) scaleY(.7)}60%{transform:scaleX(1.2) scaleY(.9)}100%{transform:scaleX(1) scaleY(1)}}
        @keyframes ninjaBackflip{0%{transform:translateY(0) rotate(0)}50%{transform:translateY(-${size*.8}px) rotate(180deg)}100%{transform:translateY(0) rotate(360deg)}}
        @keyframes ninjaStarJump{0%{transform:scale(1)}30%{transform:translateY(-${size*.5}px) scale(1.3)}60%{transform:scale(.9)}100%{transform:scale(1)}}
        @keyframes ninjaWallRun{0%{transform:translateX(0)}25%{transform:translateX(${size*.3}px) translateY(-${size*.5}px)}75%{transform:translateX(-${size*.3}px) translateY(-${size*.3}px)}100%{transform:translateX(0)}}
        @keyframes ninjaGlow{0%{opacity:.4}50%{opacity:.9}100%{opacity:.4}}
        @keyframes countPulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.15);opacity:1}}
      `}</style>
      <defs><filter id={fid} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      {/* Rope — visible only during swing recovery */}
      {swinging&&<line x1={size/2} y1={-size*4} x2={size/2} y2={size*.15} stroke="#C8A96E" strokeWidth="1.5" strokeLinecap="round" opacity=".7" style={{animation:`ropeAppear-${rid} 4s ease-in-out forwards`}}/>}
      {/* glow */}
      <circle cx={size/2} cy={size*.5} r={size*.6} fill="none" stroke={color} strokeWidth="2.5" opacity=".25" style={{animation:'ninjaGlow 1s ease-in-out infinite'}} filter={`url(#${fid})`}/>
      <circle cx={size/2} cy={size*.5} r={size*.4} fill={color} opacity=".1" filter={`url(#${fid})`}/>
      {/* Athlete silhouette */}
      <g transform={`scale(${sc})`}>
        <path d={silhouette} fill={color} stroke="rgba(0,0,0,.3)" strokeWidth="1" strokeLinejoin="round"/>
      </g>
      {/* Hearts for lives */}
      {livesLeft>=999
        ?<text x={size/2} y={-4} textAnchor="middle" fontSize={size*.5} fontWeight="900" fill="#FF3B60" fontFamily="JetBrains Mono" style={{paintOrder:'stroke',stroke:'rgba(0,0,0,.8)',strokeWidth:2}}>∞</text>
        :(livesLeft+livesUsed)>0&&Array.from({length:livesLeft+livesUsed}).map((_,i)=>{
          const alive=i<livesLeft;
          const hx=size/2+(i-(livesLeft+livesUsed-1)/2)*9;
          return<g key={i} transform={`translate(${hx-6},${-8}) scale(0.7)`} opacity={alive?1:.2}><path d={heartD} fill={alive?'#FF3B60':'#555'} stroke={alive?'#FF1744':'#333'} strokeWidth=".5"/></g>;
        })
      }
      {/* Name */}
      {name&&<text x={size/2} y={-16} textAnchor="middle" fontSize={size*.32} fontWeight="800" fill="#fff" fontFamily="system-ui" style={{paintOrder:'stroke',stroke:'rgba(0,0,0,.8)',strokeWidth:3,strokeLinejoin:'round'}}>{name}</text>}
      {/* Reset countdown — big number over ninja */}
      {resetting&&resetSec>0&&<>
        <text x={size/2} y={-22} textAnchor="middle" fontSize={size*.8} fontWeight="900" fontFamily="JetBrains Mono,monospace" fill={resetSec<=3?'#FF3B30':'#FF9500'} style={{animation:'countPulse .6s ease-in-out infinite alternate',paintOrder:'stroke',stroke:'rgba(0,0,0,.8)',strokeWidth:3}}>{resetSec}</text>
        <text x={size/2} y={size+14} textAnchor="middle" fontSize="8" fontWeight="700" fontFamily="system-ui" fill="rgba(255,149,0,.8)">RESET</text>
      </>}
      {/* Split time below */}
      {!resetting&&lastCPTime&&<text x={size/2} y={size+14} textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono,monospace" fill={color} opacity=".8">{fmtSplit(lastCPTime)}</text>}
      {timeRemaining!=null&&!resetting&&<text x={size/2} y={size+24} textAnchor="middle" fontSize="8" fontWeight="600" fontFamily="JetBrains Mono,monospace" fill={timeRemaining<15000?'#FF3B30':'rgba(255,214,10,.7)'}>{fmtSplit(timeRemaining)}</text>}
    </g>
    </g>
  );
};

// Ghost runner: semi-transparent, follows the best run's timeline
const GhostNinja=({x,y,size=24,name='',ahead=false,catId=''})=>{
  const c=ahead?'#30D158':'#FF3B30';
  const gid=`gg-${(name||'g').replace(/\s/g,'')}`;
  const female=isFemale(catId);
  const gFrames=female?FEMALE_FRAMES:MALE_FRAMES;
  const [gf,setGf]=useState(0);
  useEffect(()=>{const iv=setInterval(()=>setGf(f=>(f+1)%4),180);return()=>clearInterval(iv);},[]);
  const sc=size/100;
  return(
  <g transform={`translate(${x-size/2},${y-size})`} opacity={.55}>
    <g>
      <defs><filter id={gid} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <circle cx={size/2} cy={size*.5} r={size*.5} fill={c} opacity=".18" filter={`url(#${gid})`}/>
      <g transform={`scale(${sc})`}>
        <path d={gFrames[gf]} fill={c} stroke="rgba(0,0,0,.3)" strokeWidth="1" strokeLinejoin="round"/>
      </g>
      {name&&<text x={size/2} y={-6} textAnchor="middle" fontSize={size*.3} fontWeight="800" fill={c} fontFamily="system-ui" style={{paintOrder:'stroke',stroke:'rgba(0,0,0,.7)',strokeWidth:2.5,strokeLinejoin:'round'}}>{name}</text>}
    </g>
  </g>
  );
};

// Smooth ninja: interpolates X between CPs with easeOut (decelerating approach)
// Also renders a ghost ninja for the best run comparison
const SmoothNinja=({lr,xs,ys,nPts,tvMode,catData})=>{
  const isCountdown=lr.phase==='countdown';
  const cpIdx=Math.min(lr.doneCPCount,nPts-1);
  const nextIdx=Math.min(cpIdx+1,nPts-1);
  const fromX=xs(cpIdx);
  const toX=xs(nextIdx);
  const cy=ys(100);
  const [animX,setAnimX]=useState(fromX);
  const [ghostX,setGhostX]=useState(xs(0));
  const startRef=useRef(null);
  const prevCPRef=useRef(cpIdx);
  // When CP changes, snap to the CP position and restart forward animation
  useEffect(()=>{
    if(cpIdx!==prevCPRef.current){setAnimX(xs(cpIdx));startRef.current=null;prevCPRef.current=cpIdx;}
  },[cpIdx]);
  // Animate forward from current CP toward next CP, decelerating
  // When resetting after fall: animate back to last CP position
  const resetStartX=useRef(null);
  useEffect(()=>{
    if(isCountdown||cpIdx>=nPts-1)return;
    // Resetting: swing back to last CP
    if(lr.resetting){
      const snapBackFrom=animX;
      resetStartX.current=snapBackFrom;
      const targetX=xs(cpIdx);
      const dur=2500;
      const t0=performance.now();
      let raf;
      const tick=()=>{
        const t=Math.min((performance.now()-t0)/dur,1);
        const ease=1-Math.pow(1-t,3);
        setAnimX(snapBackFrom+(targetX-snapBackFrom)*ease);
        if(t<1)raf=requestAnimationFrame(tick);
      };
      raf=requestAnimationFrame(tick);
      return()=>cancelAnimationFrame(raf);
    }
    if(lr.fallen)return;
    // After reset ends: start fresh from current CP position
    startRef.current=null;
    setAnimX(xs(cpIdx));
    const segDuration=12000;
    let raf;
    const tick=()=>{
      const now=performance.now();
      if(!startRef.current)startRef.current=now;
      const elapsed=now-startRef.current;
      const t=Math.min(elapsed/segDuration,0.92);
      const ease=1-Math.pow(1-t,3);
      setAnimX(fromX+(toX-fromX)*ease);
      // Ghost: compute position based on elapsed real time vs best run CP times
      if(lr.bestRunCPs?.length>0&&lr.startEpoch){
        const realElapsed=Date.now()-lr.startEpoch;
        let ghostCP=0;
        for(let i=0;i<lr.bestRunCPs.length;i++){
          if(lr.bestRunCPs[i]?.time&&realElapsed>=lr.bestRunCPs[i].time)ghostCP=i+1;
          else break;
        }
        const ghostCpIdx=Math.min(ghostCP,nPts-1);
        const ghostNextIdx=Math.min(ghostCpIdx+1,nPts-1);
        const ghostFromTime=ghostCpIdx>0?lr.bestRunCPs[ghostCpIdx-1]?.time||0:0;
        const ghostToTime=lr.bestRunCPs[ghostCpIdx]?.time||ghostFromTime+segDuration;
        const ghostSegT=Math.min(Math.max(0,(realElapsed-ghostFromTime)/(ghostToTime-ghostFromTime)),0.98);
        const gx=xs(ghostCpIdx)+(xs(ghostNextIdx)-xs(ghostCpIdx))*ghostSegT;
        setGhostX(gx);
      }
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf);
  },[isCountdown,cpIdx,fromX,toX,lr.fallen,lr.resetting,nPts,lr.startEpoch,lr.bestRunCPs?.length]);
  const runnerLeads=animX>=ghostX;
  // Leader is green, trailer is red — applies to BOTH ninjas
  const runnerColor=lr.bestRunCPs?.length>0?(runnerLeads?'#30D158':'#FF5E3A'):(catData?.cat?.color||'#FF5E3A');
  const countdownNum=isCountdown?(lr.countdown||3):0;
  return<>
    {lr.bestRunCPs?.length>0&&!isCountdown&&<GhostNinja x={ghostX} y={cy} size={tvMode?28:20} name={lr.bestRunName||'Best'} ahead={!runnerLeads} catId={lr.catId}/>}
    <NinjaRunner x={isCountdown?xs(0):animX} y={cy} size={tvMode?36:24} color={lr.resetting?'#FF9500':isCountdown?'#FF9500':runnerColor} name={lr.name} fallen={lr.fallen} livesLeft={lr.livesLeft} livesUsed={lr.livesUsed} doneCPCount={isCountdown?0:lr.doneCPCount} lastCPTime={lr.lastCPTime} timeRemaining={lr.timeRemaining} resetting={lr.resetting} resetUntil={lr.resetUntil} catId={lr.catId}/>
    {/* Big countdown number above ninja */}
    {isCountdown&&(
      <text x={xs(0)} y={cy-((tvMode?36:24)*1.5)} textAnchor="middle" fontSize={tvMode?48:32} fontWeight="900" fontFamily="JetBrains Mono,monospace" fill="#FF9500" style={{animation:'countPulse .8s ease-in-out infinite alternate',paintOrder:'stroke',stroke:'rgba(0,0,0,.8)',strokeWidth:4,strokeLinejoin:'round'}}>
        {countdownNum}
      </text>
    )}
  </>;
};

const SurvivalChart=({data,tvMode,liveRunners=[],obsArr=[],allObs=[],livesUsedPerObs=[]})=>{
  if(!data||!data.length)return<div style={{padding:'20px 0',color:'var(--muted)',fontSize:13,textAlign:'center'}}>Keine Daten</div>;
  const nPts=data[0]?.points?.length||0;
  const extraMB=nPts>20?Math.min(nPts*1.5,60):0;
  const W=1000,H=(tvMode?420:300)+extraMB;
  const ML=46,MR=16,MT=tvMode?60:50,MB=(tvMode?90:80)+extraMB;
  const PW=W-ML-MR,PH=H-MT-MB;
  if(nPts<2)return<div style={{padding:'20px 0',color:'var(--muted)',fontSize:13,textAlign:'center'}}>Noch zu wenig Läufe für eine Kurve</div>;
  const hasRuns=data.some(d=>d.total>0);
  const xs=i=>ML+(i/(nPts-1))*PW;
  const ys=v=>MT+PH-(v/100)*PH;
  return(
    <div style={{background:'rgba(255,255,255,.03)',borderRadius:14,padding:tvMode?16:12,border:'1px solid var(--border)'}}>
      <div style={{fontSize:tvMode?15:11,fontWeight:700,color:'rgba(255,255,255,.5)',marginBottom:8,letterSpacing:'.06em',textTransform:'uppercase'}}>Normierte Überlebensrate pro Hindernis</div>
      <div style={{display:'flex',gap:14,flexWrap:'wrap',marginBottom:10}}>
        {data.map(({cat,total})=>(
          <div key={cat.id} style={{display:'flex',alignItems:'center',gap:6,fontSize:tvMode?13:10}}>
            <svg width={tvMode?24:18} height={tvMode?4:3}><line x1="0" y1="50%" x2="100%" y2="50%" stroke={cat.color} strokeWidth={tvMode?4:3} strokeLinecap="round"/></svg>
            <span style={{color:'rgba(255,255,255,.65)'}}>{cat.name.de||cat.name} (n={total})</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',display:'block',overflow:'visible'}}>
        {[0,20,40,60,80,100].map(v=>(
          <g key={v}>
            <line x1={ML} y1={ys(v)} x2={W-MR} y2={ys(v)} stroke={v===0?'rgba(255,255,255,.2)':'rgba(255,255,255,.06)'} strokeWidth="1"/>
            <text x={ML-6} y={ys(v)+4} fill="rgba(255,255,255,.3)" fontSize="12" textAnchor="end" fontFamily="system-ui">{v}</text>
          </g>
        ))}
        {data[0]?.points?.map((_,i)=>(
          <line key={i} x1={xs(i)} y1={MT} x2={xs(i)} y2={MT+PH} stroke="rgba(255,255,255,.04)" strokeWidth="1"/>
        ))}
        {hasRuns&&data.map(({cat,points,total})=>{
          if(!total)return null;
          const d=points.map((p,i)=>`${i===0?'M':'L'}${xs(i).toFixed(1)},${ys(p.y).toFixed(1)}`).join(' ');
          return(
            <g key={cat.id}>
              <path d={d} fill="none" stroke={cat.color} strokeWidth={tvMode?3:2.2} strokeLinecap="round" strokeLinejoin="round" opacity={.88}/>
              {points.map((p,i)=><circle key={i} cx={xs(i)} cy={ys(p.y)} r={tvMode?5:3} fill={cat.color} stroke="rgba(0,0,0,.35)" strokeWidth="1.2"/>)}
            </g>
          );
        })}
        {!hasRuns&&<text x={W/2} y={MT+PH/2} textAnchor="middle" fontSize={tvMode?18:14} fontWeight="700" fill="rgba(255,255,255,.2)" fontFamily="system-ui">Warten auf Läufer …</text>}
        {/* Platform zone highlights — orange columns */}
        {data[0]?.points?.map((p,i)=>{
          if(!p.isPlat||i===0)return null;
          const xi=xs(i);
          return<g key={`pf-${i}`}>
            <rect x={xi-6} y={MT} width={12} height={PH} rx={2} fill="rgba(255,149,0,.06)" stroke="rgba(255,149,0,.2)" strokeWidth="1" strokeDasharray="4 3"/>
            <rect x={xi-8} y={MT-7} width={16} height={8} rx={2.5} fill="rgba(255,149,0,.25)"/>
            <text x={xi} y={MT-1.5} textAnchor="middle" fontSize={tvMode?7:5.5} fontWeight="900" fill="#FF9500" fontFamily="system-ui">P</text>
          </g>;
        })}
        {data[0]?.points?.map((p,i)=>{
          const isPlat=p.isPlat;
          const lblSize=nPts>30?(tvMode?8:6):nPts>20?(tvMode?9:7):(tvMode?11:9);
          const maxLen=nPts>30?14:20;
          return<text key={i} x={xs(i)} y={H-MB+16} fill={isPlat?'#FF9500':'rgba(255,255,255,.4)'} fontSize={lblSize} fontWeight={isPlat?'800':'400'} textAnchor="end" fontFamily="system-ui"
            transform={`rotate(-55,${xs(i)},${H-MB+16})`}>
            {(isPlat?'▮ ':'')+(i===0?'Start':(p.label||'').substring(0,maxLen))}
          </text>;
        })}
        {livesUsedPerObs.map((count,i)=>{
          if(!count)return null;
          const xi=xs(i+1);
          const heartD='M6 1.5C4.5-.5 1-.5 0 2c-1 2.5 3 5 6 7.5C9 7 13 4.5 12 2c-1-2.5-4.5-2.5-6-.5z';
          return<g key={`h${i}`} transform={`translate(${xi-7},${MT+PH+4})`}>
            <g transform="scale(0.65)"><path d={heartD} fill="#FF3B60" stroke="#FF1744" strokeWidth=".5" opacity=".7"/></g>
            {count>1&&<text x={12} y={8} fontSize={tvMode?10:8} fontWeight="800" fill="#FF3B60" fontFamily="JetBrains Mono">{count}</text>}
          </g>;
        })}
        {/* Live ninja runners — smooth forward run along top line */}
        {liveRunners.map((lr,idx)=>{
          const catData=data.find(d=>d.cat.id===lr.catId);
          return<SmoothNinja key={lr.id||idx} lr={lr} xs={xs} ys={ys} nPts={nPts} tvMode={tvMode} catData={catData}/>;
        })}
      </svg>
    </div>
  );
};


const DifficultyChart=({data,lang,tvMode})=>{
  if(!data||!data.length)return<div style={{padding:'20px 0',color:'var(--muted)',fontSize:13,textAlign:'center'}}>Keine Daten</div>;
  const maxR=Math.max(...data.map(d=>d.rate),1);
  const barH=tvMode?36:24;
  const gap=tvMode?7:4;
  const shown=data.slice(0,tvMode?18:10);
  return(
    <div style={{background:'rgba(255,255,255,.03)',borderRadius:14,padding:tvMode?16:12,border:'1px solid var(--border)'}}>
      <div style={{fontSize:tvMode?15:11,fontWeight:700,color:'rgba(255,255,255,.5)',marginBottom:10,letterSpacing:'.06em',textTransform:'uppercase'}}>{lang==='de'?'Schwierigste Hindernisse (Ausfallrate)':'Hardest Obstacles (Fall Rate)'}</div>
      <div style={{display:'flex',flexDirection:'column',gap}}>
        {shown.map(({obs,falls,reached,rate})=>{
          const col=rate>=50?'#FF3B6B':rate>=25?'#FF9500':rate>=10?'#FFD60A':'#30D158';
          return(
            <div key={obs.id} style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:tvMode?180:130,fontSize:tvMode?12:10,color:'rgba(255,255,255,.65)',textAlign:'right',flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{obsShortName(obs.name)}</div>
              <div style={{flex:1,height:barH,background:'rgba(255,255,255,.06)',borderRadius:barH/2,overflow:'hidden',position:'relative'}}>
                <div style={{height:'100%',width:`${(rate/maxR)*100}%`,background:`linear-gradient(90deg,${col}80,${col})`,borderRadius:barH/2,display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:8,transition:'width .5s ease'}}>
                  {rate>=6&&<span style={{fontSize:tvMode?12:9,fontWeight:800,color:'#fff',whiteSpace:'nowrap'}}>{rate.toFixed(0)}%</span>}
                </div>
              </div>
              <div style={{width:tvMode?52:38,fontSize:tvMode?11:9,color:'var(--dim)',flexShrink:0}}>{falls}/{reached}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


const ProgressChart=({data,catName,lang,tvMode})=>{
  if(!data||!data.length)return<div style={{padding:'20px 0',color:'var(--muted)',fontSize:13,textAlign:'center'}}>Keine Daten</div>;
  return(
    <div style={{display:'grid',gridTemplateColumns:`repeat(auto-fill,minmax(${tvMode?'230px':'160px'},1fr))`,gap:tvMode?16:10}}>
      {data.map(({cat,total,done,buzzers,pending,dnf})=>{
        const pctBuzz=total>0?(buzzers/total)*100:0;
        const pctFail=total>0?(dnf/total)*100:0;
        const pctPend=total>0?(pending/total)*100:0;
        return(
          <div key={cat.id} style={{background:'rgba(255,255,255,.03)',borderRadius:tvMode?16:12,padding:tvMode?18:12,border:`1px solid ${cat.color}30`}}>
            <div style={{fontSize:tvMode?14:11,fontWeight:800,color:cat.color,marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{catName(cat)}</div>
            <div style={{height:tvMode?14:8,background:'rgba(255,255,255,.08)',borderRadius:8,overflow:'hidden',display:'flex',marginBottom:8}}>
              <div style={{width:`${pctBuzz}%`,background:'#30D158',height:'100%',transition:'width .5s'}}/>
              <div style={{width:`${pctFail}%`,background:'rgba(255,94,58,.6)',height:'100%',transition:'width .5s'}}/>
              <div style={{width:`${pctPend}%`,background:'rgba(255,255,255,.1)',height:'100%',transition:'width .5s'}}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'3px 8px',fontSize:tvMode?12:10}}>
              <span style={{color:'#30D158'}}>✓ {buzzers} Buzzer</span>
              <span style={{color:'rgba(255,94,58,.8)'}}>{dnf} DNF/Fall</span>
              <span style={{color:'rgba(255,255,255,.4)'}}>{pending} ausstehend</span>
              <span style={{color:'rgba(255,255,255,.3)',fontWeight:700}}>{total} ges.</span>
            </div>
            {total>0&&<div style={{marginTop:6,fontSize:tvMode?11:9,color:'var(--muted)'}}>{Math.round((done/total)*100)}% abgeschlossen</div>}
          </div>
        );
      })}
    </div>
  );
};


// ── SKILL STATS PANEL ──────────────────────────────────────
const SkillStatsPanel=({compId,info,athletesMap,tvMode=false})=>{
  const {lang}=useLang();
  const skillScores=useFbVal(`ogn/${compId}/skillScores`);
  const skillPhase=info?.skillPhase||{};
  const skills=skillPhase.skills||[];
  const isOldschool=(skillPhase.type||'oldschool')==='oldschool';
  const athList=athletesMap?Object.values(athletesMap):[];
  const DIFF_MULT={easy:0.8,medium:1.0,hard:1.5};
  if(!skills.length)return null;
  // Per-skill stats
  const skillStats=skills.map(sk=>{
    const diffCol={easy:'#30D158',medium:'#FF9F0A',hard:'#FF3B30'}[sk.difficulty||'medium'];
    let passed=0,failed=0,flash=0,pending=0,totalPts=0;
    athList.forEach(a=>{
      const s=skillScores?.[a.id]?.[sk.id];
      if(!s){pending++;return;}
      const mult=DIFF_MULT[sk.difficulty||'medium']||1;
      if(isOldschool){
        if(s.a1===true){passed++;flash++;totalPts+=100*mult;}
        else if(s.a2===true){passed++;totalPts+=50*mult;}
        else if(s.a3===true){passed++;totalPts+=20*mult;}
        else if(s.a1===false||s.a2===false||s.a3===false){failed++;}
        else{pending++;}
      }else{
        if(s.completed&&s.flashed){passed++;flash++;totalPts+=(s.poolScore||0)*1.2*mult;}
        else if(s.completed){passed++;totalPts+=(s.poolScore||0)*mult;}
        else if(s.attempts>0){failed++;}
        else{pending++;}
      }
    });
    const total=passed+failed+pending;
    return{sk,diffCol,passed,failed,flash,pending,total,totalPts:Math.round(totalPts),rate:total>0?(passed/total)*100:0};
  }).sort((a,b)=>b.rate-a.rate);
  const totalAllPts=skillStats.reduce((s,x)=>s+x.totalPts,0);
  const barH=tvMode?28:20;
  return(
    <div style={{background:'rgba(255,255,255,.03)',borderRadius:14,padding:tvMode?16:12,border:'1px solid var(--border)'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:tvMode?14:10}}>
        <svg width={tvMode?16:13} height={tvMode?16:13} viewBox="0 0 24 24" fill="none" stroke="var(--cor)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="4" r="2"/><path d="M10.5 9l-2.5 5h4l2 4"/><path d="M8.5 21l2-4M14.5 13l2 4-3.5 1.5"/></svg>
        <span style={{fontSize:tvMode?15:11,fontWeight:700,color:'rgba(255,255,255,.5)',letterSpacing:'.06em',textTransform:'uppercase'}}>Skill Phase</span>
        <span style={{marginLeft:'auto',fontFamily:'JetBrains Mono',fontSize:tvMode?14:11,fontWeight:900,color:'var(--gold)'}}>{totalAllPts} pts</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:tvMode?6:4}}>
        {skillStats.map(({sk,diffCol,passed,failed,flash,pending,total,totalPts,rate})=>(
          <div key={sk.id} style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:tvMode?130:90,fontSize:tvMode?12:10,color:'rgba(255,255,255,.65)',textAlign:'right',flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:4,justifyContent:'flex-end'}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:diffCol,flexShrink:0}}/>
              {sk.name||'Skill'}
            </div>
            <div style={{flex:1,height:barH,background:'rgba(255,255,255,.06)',borderRadius:barH/2,overflow:'hidden',display:'flex'}}>
              {flash>0&&<div style={{width:`${(flash/total)*100}%`,height:'100%',background:'linear-gradient(90deg,#FFD60A,#FF9500)',transition:'width .5s'}}/>}
              {(passed-flash)>0&&<div style={{width:`${((passed-flash)/total)*100}%`,height:'100%',background:'#30D158',transition:'width .5s'}}/>}
              {failed>0&&<div style={{width:`${(failed/total)*100}%`,height:'100%',background:'rgba(255,59,48,.6)',transition:'width .5s'}}/>}
            </div>
            <div style={{width:tvMode?70:50,fontSize:tvMode?11:9,color:'var(--muted)',flexShrink:0,textAlign:'right',fontFamily:'JetBrains Mono'}}>
              {passed}/{total} <span style={{color:'var(--gold)',fontWeight:700}}>{totalPts}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:tvMode?16:10,marginTop:tvMode?12:8,fontSize:tvMode?11:9}}>
        <span style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,borderRadius:2,background:'linear-gradient(90deg,#FFD60A,#FF9500)'}}/>Flash</span>
        <span style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,borderRadius:2,background:'#30D158'}}/>Passed</span>
        <span style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,borderRadius:2,background:'rgba(255,59,48,.6)'}}/>Failed</span>
        <span style={{display:'flex',alignItems:'center',gap:4,color:'var(--muted)'}}><div style={{width:8,height:8,borderRadius:2,background:'rgba(255,255,255,.1)'}}/>Pending</span>
      </div>
    </div>
  );
};

const StatsView=({compId,info,completedRuns,athletesMap,pipelineData,tvMode=false})=>{
  const {lang,catName}=useLang();
  const [chartTab,setChartTab]=useState('survival');
  // Load global obstacles AND per-stage obstacles (via the stages subtree)
  const globalObstacles=useFbVal(`ogn/${compId}/obstacles`);
  const allStations=useFbVal(`ogn/${compId}/stations`);
  const allStagesData=useFbVal(`ogn/${compId}/stages`);
  const activeRuns=useFbVal(`ogn/${compId}/activeRuns`);
  const skillStatus=useFbVal(`ogn/${compId}/skillPhaseStatus`);
  const runList=completedRuns?Object.values(completedRuns):[];
  const athList=athletesMap?Object.values(athletesMap):[];

  const isPipeline=!!(info?.pipelineEnabled&&pipelineData);
  const pipelineStages=isPipeline?Object.entries(pipelineData).filter(([,v])=>v&&typeof v==='object'&&v.name!=null).map(([id,v])=>({id,...v})).sort((a,b)=>(a.order||0)-(b.order||0)):[];

  // ── PIPELINE MODE: build stage data from pipeline stages ──
  const pipelineStageDataArr=isPipeline?pipelineStages.map(pStage=>{
    const stageKey=pStage.id;
    const stageName=pStage.name||stageKey;
    const stageRuns=runList.filter(r=>r.stageId===stageKey);
    const runCatIds=[...new Set(stageRuns.map(r=>r.catId).filter(Boolean))];
    const activeRunCatIds=activeRuns?Object.entries(activeRuns).filter(([snKey,r])=>snKey===stageKey&&r?.catId&&(r.phase==='active'||r.phase==='countdown')).map(([,r])=>r.catId):[];
    const configCatIds=pStage.categories==='all'||!pStage.categories?IGN_CATS.map(c=>c.id):Array.isArray(pStage.categories)?pStage.categories:[];
    const unionIds=[...new Set([...configCatIds,...runCatIds,...activeRunCatIds])];
    const activeCats=unionIds.map(id=>IGN_CATS.find(c=>c.id===id)).filter(Boolean);
    const allObs=(()=>{
      const stageObs=pipelineData?.[stageKey]?.obstacles;
      const raw=stageObs&&Object.keys(stageObs).length>0?stageObs:globalObstacles;
      if(!raw)return DEF_OBS;
      return Object.values(raw).sort((a,b)=>a.order-b.order);
    })();
    const obsArr=allObs.filter(o=>o.isCP!==false);
    const isPlatO=o=>o?.name&&(o.name.toLowerCase().includes('platform')||o.name.toLowerCase().includes('plattform')||o.name.toLowerCase().includes('section')||o.name.toLowerCase().includes('sektion'))||o?.type==='section';
    const isCpOrPlat=o=>o&&(o.isCP||isPlatO(o));
    const cpIdxMap=[];let ci=0;allObs.forEach((o,i)=>{cpIdxMap[i]=isCpOrPlat(o)?ci++:-1;});
    const survivalData=activeCats.map(cat=>{
      const cr=stageRuns.filter(r=>r.catId===cat.id&&r.status!=='dsq');
      const total=cr.length;
      const pts=allObs.map((obs,i)=>{
        const cIdx=cpIdxMap[i];
        const isPlat=isPlatO(obs);
        let surv=100;
        if(total>0&&cIdx>=0)surv=(cr.filter(r=>(r.doneCP?.length||0)>cIdx).length/total)*100;
        else if(total>0&&cIdx<0){const prevCp=cpIdxMap.slice(0,i).reverse().find(c=>c>=0);surv=prevCp!=null?(cr.filter(r=>(r.doneCP?.length||0)>prevCp).length/total)*100:100;}
        return{x:i,y:surv,label:obsShortName(obs.name),isPlat};
      });
      return{cat,points:[{x:-1,y:100,label:'Start',isPlat:true},...pts],total};
    }).filter(Boolean);
    const livesUsedPerObs=obsArr.map((_,i)=>stageRuns.reduce((sum,r)=>{
      if(!Array.isArray(r.falls))return sum;
      return sum+r.falls.filter(f=>f.obsIdx===i).length;
    },0));
    const difficultyData=obsArr.map((obs,i)=>{
      const reached=stageRuns.filter(r=>r.status!=='dsq'&&((r.doneCP?.length||0)>=i||r.status==='complete')).length;
      const falls=stageRuns.filter(r=>r.fellAt?.id===obs.id).length;
      return{obs,falls,reached,rate:reached>0?(falls/reached)*100:0};
    }).filter(d=>d.reached>0).sort((a,b)=>b.rate-a.rate);
    const pipelineAthletes=pipelineData?.[stageKey]?.athletes||{};
    const progressData=activeCats.map(cat=>{
      const stageAths=Object.values(pipelineAthletes).filter(a=>a.cat===cat.id);
      const total=stageAths.length||athList.filter(a=>a.cat===cat.id).length;
      const cr=stageRuns.filter(r=>r.catId===cat.id&&r.status!=='dsq');
      const buzzers=cr.filter(r=>r.status==='complete').length;
      const dnf=cr.filter(r=>['fall','dnf','timeout'].includes(r.status)).length;
      const done=cr.length;
      return{cat,total,done,buzzers,dnf,pending:Math.max(0,total-done)};
    });
    const liveRunners=activeRuns?Object.entries(activeRuns).filter(([snKey,r])=>snKey===stageKey&&r?.athleteId&&(r.phase==='active'||r.phase==='countdown')).map(([,r])=>{
      const a=athletesMap?.[r.athleteId];
      const catId=r.catId||(a?.cat)||null;
      const doneCPCount=r.doneCPCount||(Array.isArray(r.doneCP)?r.doneCP.length:(r.doneCP&&typeof r.doneCP==='object'?Object.keys(r.doneCP).length:0));
      const stageTotalLives=pStage.totalLives!=null&&pStage.totalLives>0?pStage.totalLives:(info?.lives||3);
      const livesLeft=r.livesLeft!=null?r.livesLeft:stageTotalLives;
      const livesUsed=r.livesUsed!=null?r.livesUsed:(livesLeft>=999?0:Math.max(0,stageTotalLives-livesLeft));
      const cpArr=Array.isArray(r.doneCP)?r.doneCP:(r.doneCP&&typeof r.doneCP==='object'?Object.values(r.doneCP):[]);
      const lastCPTime=cpArr.length>0?cpArr[cpArr.length-1]?.time:null;
      const limitSec=pStage.timeLimit||info?.stageLimits?.[stageKey]||info?.timeLimit||0;
      const elapsed=r.startEpoch?Date.now()-r.startEpoch:0;
      const timeRemaining=limitSec>0?Math.max(0,limitSec*1000-elapsed):null;
      const bestRun=stageRuns.filter(x=>x.catId===catId&&x.status!=='dsq'&&(x.doneCP?.length||Object.keys(x.doneCP||{}).length)>0).sort((a,b)=>(Array.isArray(b.doneCP)?b.doneCP.length:Object.keys(b.doneCP||{}).length)-(Array.isArray(a.doneCP)?a.doneCP.length:Object.keys(a.doneCP||{}).length)||(a.finalTime||Infinity)-(b.finalTime||Infinity))[0];
      const bestRunCPs=bestRun?Array.isArray(bestRun.doneCP)?bestRun.doneCP:(bestRun.doneCP?Object.values(bestRun.doneCP):[]):[];
      const bestRunName=bestRun?(athletesMap?.[bestRun.athleteId]?.name||bestRun.athleteName||'?').split(' ')[0]:'';
      return{id:r.athleteId,catId,doneCPCount,name:a?.name?.split(' ')[0]||'',livesLeft,livesUsed,totalLives:stageTotalLives,fallen:livesLeft<=0&&livesLeft<999&&livesUsed>0,lastCPTime,timeRemaining,startEpoch:r.startEpoch,bestRunCPs,bestRunName,phase:r.phase,countdown:r.countdown,resetting:!!r.resetting,resetUntil:r.resetUntil||null};
    }):[];
    return{sn:stageKey,stageName,catId:configCatIds[0]||null,obsArr,allObs,survivalData,difficultyData,progressData,liveRunners,livesUsedPerObs};
  }).filter(Boolean):[];

  // ── LEGACY MODE ──
  const numStages=info?.numStations||1;
  const activeStageNums=isPipeline?[]:Array.from({length:numStages},(_,i)=>i+1).filter(sn=>{
    const hasCat=allStations?.[sn]?.cat;
    const hasRuns=runList.some(r=>String(r.stNum)===String(sn));
    const hasActive=activeRuns?.[sn]?.athleteId;
    return hasCat||hasRuns||hasActive;
  });

  // Get the correct obstacle array for a specific stage
  // Priority: per-stage obstacles → global obstacles → built-in defaults
  const getStageAllObs=sn=>{
    const raw=allStagesData?.[sn]?.obstacles||globalObstacles;
    if(!raw)return DEF_OBS;
    return Object.values(raw).sort((a,b)=>a.order-b.order);
  };
  const getStageObsArr=sn=>getStageAllObs(sn).filter(o=>o.isCP!==false);

  // Build full dataset for each active stage independently
  const legacyStageDataArr=activeStageNums.map(sn=>{
    const catId=allStations?.[sn]?.cat||null;
    const allObs=getStageAllObs(sn);
    const obsArr=allObs.filter(o=>o.isCP!==false);
    // Only runs from THIS stage
    const stageRuns=runList.filter(r=>String(r.stNum)===String(sn));
    // Categories present in this stage — union of station's configured cat + all cats with runs
    const runCatIds=[...new Set(stageRuns.map(r=>r.catId).filter(Boolean))];
    const activeRunCatIds=activeRuns?Object.entries(activeRuns).filter(([snKey,r])=>String(snKey)===String(sn)&&r?.catId&&(r.phase==='active'||r.phase==='countdown')).map(([,r])=>r.catId):[];
    const unionIds=[...new Set([...(catId?[catId]:[]),...runCatIds,...activeRunCatIds])];
    const activeCats=unionIds.map(id=>IGN_CATS.find(c=>c.id===id)).filter(Boolean);

    // ── Survival curve (per category for this stage) ──
    const survivalData=activeCats.map(cat=>{
      const cr=stageRuns.filter(r=>r.catId===cat.id&&r.status!=='dsq');
      const total=cr.length;if(!total)return null;
      const points=[{x:-1,y:100,label:'Platform'},...obsArr.map((obs,i)=>({x:i,y:(cr.filter(r=>(r.doneCP?.length||0)>i).length/total)*100,label:obsShortName(obs.name)}))];
      return{cat,points,total};
    }).filter(Boolean);

    const livesUsedPerObs=obsArr.map((_,i)=>stageRuns.reduce((sum,r)=>{
      if(!Array.isArray(r.falls))return sum;
      return sum+r.falls.filter(f=>f.obsIdx===i).length;
    },0));

    // ── Difficulty (fall rate per obstacle, this stage only) ──
    const difficultyData=obsArr.map((obs,i)=>{
      const reached=stageRuns.filter(r=>r.status!=='dsq'&&((r.doneCP?.length||0)>=i||r.status==='complete')).length;
      const falls=stageRuns.filter(r=>r.fellAt?.id===obs.id).length;
      return{obs,falls,reached,rate:reached>0?(falls/reached)*100:0};
    }).filter(d=>d.reached>0).sort((a,b)=>b.rate-a.rate);

    // ── Progress per category (this stage only) ──
    const progressData=activeCats.map(cat=>{
      const total=athList.filter(a=>a.cat===cat.id).length;
      const cr=stageRuns.filter(r=>r.catId===cat.id&&r.status!=='dsq');
      const buzzers=cr.filter(r=>r.status==='complete').length;
      const dnf=cr.filter(r=>['fall','dnf','timeout'].includes(r.status)).length;
      const done=cr.length;
      return{cat,total,done,buzzers,dnf,pending:Math.max(0,total-done)};
    });

    // Active ninja runners for this stage
    const liveRunners=activeRuns?Object.entries(activeRuns).filter(([snKey,r])=>String(snKey)===String(sn)&&r?.athleteId&&(r.phase==='active'||r.phase==='countdown')).map(([,r])=>{
      const a=athletesMap?.[r.athleteId];
      const doneCPCount=r.doneCPCount||(Array.isArray(r.doneCP)?r.doneCP.length:(r.doneCP&&typeof r.doneCP==='object'?Object.keys(r.doneCP).length:0));
      const totalLives=info?.lives||3;const livesLeft=r.livesLeft!=null?r.livesLeft:totalLives;
      const livesUsed=r.livesUsed!=null?r.livesUsed:(livesLeft>=999?0:Math.max(0,totalLives-livesLeft));
      const cpArr=Array.isArray(r.doneCP)?r.doneCP:(r.doneCP&&typeof r.doneCP==='object'?Object.values(r.doneCP):[]);
      const lastCPTime=cpArr.length>0?cpArr[cpArr.length-1]?.time:null;
      const limitSec=info?.stageLimits?.[sn]??info?.timeLimit??0;
      const elapsed=r.startEpoch?Date.now()-r.startEpoch:0;
      const timeRemaining=limitSec>0?Math.max(0,limitSec*1000-elapsed):null;
      const _catId=r.catId||(a?.cat)||null;
      const bestRun=stageRuns.filter(x=>x.catId===_catId&&x.status!=='dsq'&&(x.doneCP?.length||Object.keys(x.doneCP||{}).length)>0).sort((x,y)=>(Array.isArray(y.doneCP)?y.doneCP.length:Object.keys(y.doneCP||{}).length)-(Array.isArray(x.doneCP)?x.doneCP.length:Object.keys(x.doneCP||{}).length)||(x.finalTime||Infinity)-(y.finalTime||Infinity))[0];
      const bestRunCPs=bestRun?Array.isArray(bestRun.doneCP)?bestRun.doneCP:(bestRun.doneCP?Object.values(bestRun.doneCP):[]):[];
      const bestRunName=bestRun?(athletesMap?.[bestRun.athleteId]?.name||bestRun.athleteName||'?').split(' ')[0]:'';
      return{id:r.athleteId,catId:_catId,doneCPCount,name:a?.name?.split(' ')[0]||'',livesLeft,livesUsed,totalLives,fallen:livesLeft<=0&&livesLeft<999&&livesUsed>0,lastCPTime,timeRemaining,startEpoch:r.startEpoch,bestRunCPs,bestRunName,phase:r.phase,countdown:r.countdown,resetting:!!r.resetting,resetUntil:r.resetUntil||null};
    }):[];

    return{sn,catId,obsArr,allObs,survivalData,difficultyData,progressData,liveRunners,livesUsedPerObs};
  });

  const stageDataArr=isPipeline?pipelineStageDataArr:legacyStageDataArr;

  const tabs=[
    {k:'survival',ic:<I.TrendUp s={12}/>,lb:lang==='de'?'Überlebensrate':'Survival'},
    {k:'difficulty',ic:<I.BarChart s={12}/>,lb:lang==='de'?'Statistik':'Stats'},
  ];

  const hasSkills=!!info?.skillPhase?.enabled&&(info?.skillPhase?.skills||[]).length>0;
  const skillsActive=hasSkills&&!skillStatus?.finalized&&!skillStatus?.seedingDone;
  const skillsDone=hasSkills&&(skillStatus?.finalized||skillStatus?.seedingDone);

  if(stageDataArr.length===0&&!hasSkills)return(
    <div style={{padding:'40px 0',textAlign:'center',color:'var(--muted)',fontSize:13}}>
      {lang==='de'?'Noch keine aktiven Stages':'No active stages yet'}
    </div>
  );

  const multiStage=stageDataArr.length>1;

  return(
    <div style={{padding:tvMode?'12px 0':'4px 0'}}>
      {/* Skill stats — TOP when skills are active */}
      {skillsActive&&<div style={{marginBottom:tvMode?16:12}}><SkillStatsPanel compId={compId} info={info} athletesMap={athletesMap} tvMode={tvMode}/></div>}
      {/* Chart type selector (applies to all stage sections) */}
      <div style={{display:'flex',gap:5,marginBottom:tvMode?16:12,flexWrap:'wrap'}}>
        {tabs.map(({k,ic,lb})=>(
          <button key={k} style={{display:'flex',alignItems:'center',gap:5,padding:tvMode?'9px 14px':'7px 11px',borderRadius:20,border:`1px solid ${chartTab===k?'rgba(255,94,58,.4)':'var(--border)'}`,background:chartTab===k?'rgba(255,94,58,.14)':'transparent',color:chartTab===k?'var(--coral)':'var(--muted)',fontWeight:700,fontSize:tvMode?13:11,cursor:'pointer',transition:'all .15s'}} onClick={()=>setChartTab(k)}>{ic}{lb}</button>
        ))}
      </div>

      {/* One section per active stage — side by side when 2+ stages */}
      <div style={stageDataArr.length>=2?{
        display:'grid',
        gridTemplateColumns:stageDataArr.length>=3?'1fr 1fr':`repeat(${Math.min(stageDataArr.length,2)},1fr)`,
        gap:tvMode?16:10,
        height:tvMode&&stageDataArr.length>1?'calc(100vh - 160px)':'auto'
      }:{display:'flex',flexDirection:'column',gap:tvMode?20:12}}>
        {stageDataArr.map(({sn,stageName:pipelineStageName,catId,survivalData,difficultyData,progressData,liveRunners,obsArr,allObs,livesUsedPerObs})=>{
          const cat=catId?IGN_CATS.find(c=>c.id===catId):null;
          const stageName=pipelineStageName||(info?.stageNames?.[sn]||`Stage ${sn}`);
          return(
            <div key={sn}>
              {/* Stage header — only shown when multiple stages are active */}
              {multiStage&&(
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:tvMode?14:10,paddingBottom:tvMode?8:6,borderBottom:'1px solid rgba(255,255,255,.08)'}}>
                  <div style={{width:tvMode?34:26,height:tvMode?34:26,borderRadius:tvMode?10:7,background:'linear-gradient(135deg,var(--cor),var(--cor2))',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:tvMode?17:13,color:'#fff',flexShrink:0}}>{typeof sn==='number'?sn:(stageName||sn).charAt(0).toUpperCase()}</div>
                  <div style={{fontSize:tvMode?17:14,fontWeight:800,color:'#fff'}}>{stageName}</div>
                  {cat&&<div style={{fontSize:tvMode?13:10,color:cat.color,fontWeight:700,background:`${cat.color}1A`,borderRadius:12,padding:'2px 10px',border:`1px solid ${cat.color}35`,flexShrink:0}}>{catName(cat)}</div>}
                  <div style={{fontSize:tvMode?11:9,color:'rgba(255,255,255,.3)',fontFamily:'JetBrains Mono',marginLeft:'auto'}}>
                    {survivalData[0]?.total||0} {lang==='de'?'Läufe':'runs'}
                  </div>
                </div>
              )}
              {chartTab==='survival'&&<SurvivalChart data={survivalData} tvMode={tvMode} liveRunners={liveRunners} obsArr={obsArr} allObs={allObs||obsArr} livesUsedPerObs={livesUsedPerObs||[]}/>}
              {chartTab==='difficulty'&&<>
                <DifficultyChart data={difficultyData} lang={lang} tvMode={tvMode}/>
                <div style={{marginTop:tvMode?16:10}}><ProgressChart data={progressData} catName={catName} lang={lang} tvMode={tvMode}/></div>
              </>}
            </div>
          );
        })}
      </div>
      {/* Skill stats — BOTTOM when skills are done */}
      {skillsDone&&<div style={{marginTop:tvMode?16:12}}><SkillStatsPanel compId={compId} info={info} athletesMap={athletesMap} tvMode={tvMode}/></div>}
    </div>
  );
};

// QUEUE DISPLAY VIEW (TV full-screen)
// ══════════════════════════════════════════════════════════

export { StatsView, SurvivalChart, DifficultyChart, ProgressChart };
