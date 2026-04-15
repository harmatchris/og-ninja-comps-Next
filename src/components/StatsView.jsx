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
const NinjaRunner=({x,y,size=28,color='#FF5E3A',name='',fallen=false,livesLeft=3,livesUsed=0,doneCPCount=0,lastCPTime=null,timeRemaining=null,resetting=false,resetUntil=null})=>{
  const fid=`gl-${(name||'n').replace(/\s/g,'')}`;
  const trick=TRICKS[doneCPCount%TRICKS.length];
  const heartD='M6 1.5C4.5-.5 1-.5 0 2c-1 2.5 3 5 6 7.5C9 7 13 4.5 12 2c-1-2.5-4.5-2.5-6-.5z';
  const allDead=livesLeft<=0&&livesUsed>0;
  // Reset countdown
  const [resetSec,setResetSec]=useState(0);
  useEffect(()=>{
    if(!resetting||!resetUntil)return;
    const tick=()=>{const left=Math.max(0,Math.ceil((resetUntil-Date.now())/1000));setResetSec(left);};
    tick();const iv=setInterval(tick,200);return()=>clearInterval(iv);
  },[resetting,resetUntil]);
  const stumbling=livesUsed>0&&!allDead;
  // Choose animation: all dead → fall out, resetting → hang+recover, CP → trick, idle → bob
  const anim=allDead?'ninjaFallOut 1.2s ease-in forwards'
    :resetting?'ninjaHangRecover 3.5s ease-in-out'
    :stumbling&&!resetting?`ninjaHangRecover 3.5s ease-in-out`
    :doneCPCount>0?`${trick} 0.6s ease-out`
    :'ninjaBob 0.45s ease-in-out infinite alternate';
  const fmtSplit=ms=>{if(!ms)return'';const s=Math.floor(ms/1000);const m=Math.floor(s/60);return`${m}:${String(s%60).padStart(2,'0')}.${String(Math.floor((ms%1000))).padStart(3,'0')}`;};
  return(
    <g transform={`translate(${x-size/2},${allDead?y+300:y-size})`}>
    <g style={{animation:anim}}>
      <style>{`
        @keyframes ninjaBob{0%{transform:translateY(0)}100%{transform:translateY(-3px)}}
        @keyframes ninjaFallOut{0%{transform:translateY(0) rotate(0);opacity:1}40%{transform:translateY(${size*2}px) rotate(180deg);opacity:.8}100%{transform:translateY(${size*12}px) rotate(720deg);opacity:0}}
        @keyframes ninjaHangRecover{
          0%{transform:translateY(0) rotate(0)}
          6%{transform:translateY(${size*1.2}px) rotate(12deg)}
          12%{transform:translateY(${size*1.5}px) rotate(-5deg)}
          16%{transform:translateY(${size*1.4}px) rotate(0) scaleY(.88)}
          22%{transform:translateY(${size*1.4}px) rotate(2deg) scaleY(.88)}
          26%{transform:translateY(${size*1.4}px) rotate(-2deg) scaleY(.88)}
          32%{transform:translateY(${size*1.1}px) rotate(3deg) scaleY(.9)}
          38%{transform:translateY(${size*1.15}px) rotate(-2deg) scaleY(.9)}
          44%{transform:translateY(${size*.85}px) rotate(2deg) scaleY(.92)}
          50%{transform:translateY(${size*.9}px) rotate(-1deg) scaleY(.92)}
          56%{transform:translateY(${size*.6}px) rotate(2deg) scaleY(.95)}
          62%{transform:translateY(${size*.65}px) rotate(-1deg) scaleY(.95)}
          70%{transform:translateY(${size*.3}px) rotate(1deg) scaleY(.98)}
          78%{transform:translateY(${size*.1}px) rotate(-3deg)}
          86%{transform:translateY(0) rotate(4deg)}
          93%{transform:translateY(0) rotate(-1deg)}
          100%{transform:translateY(0) rotate(0)}
        }
        @keyframes ninjaFlip{0%{transform:rotate(0)}30%{transform:translateY(-${size*.6}px) rotate(-180deg)}60%{transform:translateY(-${size*.3}px) rotate(-360deg)}100%{transform:rotate(-360deg)}}
        @keyframes ninjaSpinKick{0%{transform:rotate(0) scale(1)}40%{transform:translateY(-${size*.5}px) rotate(180deg) scale(1.1)}100%{transform:rotate(360deg) scale(1)}}
        @keyframes ninjaSplit{0%{transform:scaleX(1)}30%{transform:translateY(-${size*.4}px) scaleX(1.4) scaleY(.7)}60%{transform:scaleX(1.2) scaleY(.9)}100%{transform:scaleX(1) scaleY(1)}}
        @keyframes ninjaBackflip{0%{transform:translateY(0) rotate(0)}50%{transform:translateY(-${size*.8}px) rotate(180deg)}100%{transform:translateY(0) rotate(360deg)}}
        @keyframes ninjaStarJump{0%{transform:scale(1)}30%{transform:translateY(-${size*.5}px) scale(1.3)}60%{transform:scale(.9)}100%{transform:scale(1)}}
        @keyframes ninjaWallRun{0%{transform:translateX(0)}25%{transform:translateX(${size*.3}px) translateY(-${size*.5}px)}75%{transform:translateX(-${size*.3}px) translateY(-${size*.3}px)}100%{transform:translateX(0)}}
        @keyframes ninjaGlow{0%{opacity:.4}50%{opacity:.9}100%{opacity:.4}}
        @keyframes legA{0%{transform:rotate(25deg)}50%{transform:rotate(-25deg)}100%{transform:rotate(25deg)}}
        @keyframes legB{0%{transform:rotate(-25deg)}50%{transform:rotate(25deg)}100%{transform:rotate(-25deg)}}
        @keyframes splitFlash{0%{opacity:0;transform:translateY(4px)}15%{opacity:1;transform:translateY(0)}85%{opacity:1}100%{opacity:0;transform:translateY(-4px)}}
        @keyframes countPulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.15);opacity:1}}
      `}</style>
      <defs><filter id={fid} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      {/* glow */}
      <circle cx={size/2} cy={size*.5} r={size*.6} fill="none" stroke={color} strokeWidth="2.5" opacity=".3" style={{animation:'ninjaGlow 1s ease-in-out infinite'}} filter={`url(#${fid})`}/>
      <circle cx={size/2} cy={size*.5} r={size*.35} fill={color} opacity=".12" filter={`url(#${fid})`}/>
      {/* head */}
      <circle cx={size/2} cy={size*.28} r={size*.18} fill={color}/>
      <rect x={size*.3} y={size*.24} width={size*.4} height={size*.06} fill="rgba(0,0,0,.55)"/>
      {/* body */}
      <rect x={size*.35} y={size*.42} width={size*.3} height={size*.35} rx={size*.08} fill={color}/>
      {/* arms */}
      <rect x={size*.18} y={size*.48} width={size*.16} height={size*.08} rx={size*.04} fill={color} transform={`rotate(-20 ${size*.26} ${size*.52})`}/>
      <rect x={size*.66} y={size*.48} width={size*.16} height={size*.08} rx={size*.04} fill={color} transform={`rotate(20 ${size*.74} ${size*.52})`}/>
      {/* legs */}
      <g style={{transformOrigin:`${size*.45}px ${size*.77}px`,animation:allDead?'none':'legA 0.35s linear infinite'}}>
        <rect x={size*.38} y={size*.75} width={size*.1} height={size*.22} rx={size*.04} fill={color}/>
      </g>
      <g style={{transformOrigin:`${size*.55}px ${size*.77}px`,animation:allDead?'none':'legB 0.35s linear infinite'}}>
        <rect x={size*.52} y={size*.75} width={size*.1} height={size*.22} rx={size*.04} fill={color}/>
      </g>
      {/* Hearts for lives */}
      {(livesLeft+livesUsed)>0&&Array.from({length:livesLeft+livesUsed}).map((_,i)=>{
        const alive=i<livesLeft;
        const hx=size/2+(i-(livesLeft+livesUsed-1)/2)*9;
        return<g key={i} transform={`translate(${hx-6},${-8}) scale(0.7)`} opacity={alive?1:.2}><path d={heartD} fill={alive?'#FF3B60':'#555'} stroke={alive?'#FF1744':'#333'} strokeWidth=".5"/></g>;
      })}
      {/* Name */}
      {name&&<text x={size/2} y={-16} textAnchor="middle" fontSize={size*.32} fontWeight="800" fill="#fff" fontFamily="system-ui" style={{paintOrder:'stroke',stroke:'rgba(0,0,0,.8)',strokeWidth:3,strokeLinejoin:'round'}}>{name}</text>}
      {/* Reset countdown — big number over ninja */}
      {resetting&&resetSec>0&&<>
        <text x={size/2} y={-22} textAnchor="middle" fontSize={size*.8} fontWeight="900" fontFamily="JetBrains Mono,monospace" fill={resetSec<=3?'#FF3B30':'#FF9500'} style={{animation:'countPulse .6s ease-in-out infinite alternate',paintOrder:'stroke',stroke:'rgba(0,0,0,.8)',strokeWidth:3}}>{resetSec}</text>
        <text x={size/2} y={size+14} textAnchor="middle" fontSize="8" fontWeight="700" fontFamily="system-ui" fill="rgba(255,149,0,.8)">RESET</text>
      </>}
      {/* Split time below ninja — always visible when there's a CP */}
      {!resetting&&lastCPTime&&<text x={size/2} y={size+14} textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono,monospace" fill={color} opacity=".8">{fmtSplit(lastCPTime)}</text>}
      {/* Time remaining (small) */}
      {timeRemaining!=null&&!resetting&&<text x={size/2} y={size+24} textAnchor="middle" fontSize="8" fontWeight="600" fontFamily="JetBrains Mono,monospace" fill={timeRemaining<15000?'#FF3B30':'rgba(255,214,10,.7)'}>{fmtSplit(timeRemaining)}</text>}
    </g>
    </g>
  );
};

// Ghost ninja: semi-transparent, follows the best run's timeline
// ahead = ghost is leading (best time is faster) → green. behind = runner overtook ghost → red
const GhostNinja=({x,y,size=24,name='',ahead=false})=>{
  const c=ahead?'#30D158':'#FF3B30';
  const gid=`gg-${(name||'g').replace(/\s/g,'')}`;
  return(
  <g transform={`translate(${x-size/2},${y-size})`} opacity={.55}>
    <g style={{animation:'ninjaBob 0.5s ease-in-out infinite alternate'}}>
      <defs><filter id={gid} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      {/* glow */}
      <circle cx={size/2} cy={size*.5} r={size*.5} fill={c} opacity=".18" filter={`url(#${gid})`}/>
      {/* head */}
      <circle cx={size/2} cy={size*.28} r={size*.16} fill={c}/>
      <rect x={size*.32} y={size*.26} width={size*.36} height={size*.05} fill="rgba(0,0,0,.4)"/>
      {/* body */}
      <rect x={size*.36} y={size*.42} width={size*.28} height={size*.32} rx={size*.07} fill={c}/>
      {/* arms */}
      <rect x={size*.2} y={size*.48} width={size*.14} height={size*.07} rx={size*.03} fill={c} transform={`rotate(-15 ${size*.27} ${size*.51})`}/>
      <rect x={size*.66} y={size*.48} width={size*.14} height={size*.07} rx={size*.03} fill={c} transform={`rotate(15 ${size*.73} ${size*.51})`}/>
      {/* legs */}
      <g style={{transformOrigin:`${size*.44}px ${size*.74}px`,animation:'legA 0.4s linear infinite'}}>
        <rect x={size*.38} y={size*.72} width={size*.09} height={size*.2} rx={size*.03} fill={c}/>
      </g>
      <g style={{transformOrigin:`${size*.56}px ${size*.74}px`,animation:'legB 0.4s linear infinite'}}>
        <rect x={size*.52} y={size*.72} width={size*.09} height={size*.2} rx={size*.03} fill={c}/>
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
  // Also animate ghost ninja based on best run's CP times
  useEffect(()=>{
    // Don't animate during countdown — ninja waits at start
    if(isCountdown||cpIdx>=nPts-1||lr.fallen)return;
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
  },[isCountdown,cpIdx,fromX,toX,lr.fallen,nPts,lr.startEpoch,lr.bestRunCPs?.length]);
  const runnerLeads=animX>=ghostX;
  // Leader is green, trailer is red — applies to BOTH ninjas
  const runnerColor=lr.bestRunCPs?.length>0?(runnerLeads?'#30D158':'#FF5E3A'):(catData?.cat?.color||'#FF5E3A');
  const countdownNum=isCountdown?(lr.countdown||3):0;
  return<>
    {lr.bestRunCPs?.length>0&&!isCountdown&&<GhostNinja x={ghostX} y={cy} size={tvMode?28:20} name={lr.bestRunName||'Best'} ahead={!runnerLeads}/>}
    <NinjaRunner x={isCountdown?xs(0):animX} y={cy} size={tvMode?36:24} color={lr.resetting?'#FF9500':isCountdown?'#FF9500':runnerColor} name={lr.name} fallen={lr.fallen} livesLeft={lr.livesLeft} livesUsed={lr.livesUsed} doneCPCount={isCountdown?0:lr.doneCPCount} lastCPTime={lr.lastCPTime} timeRemaining={lr.timeRemaining} resetting={lr.resetting} resetUntil={lr.resetUntil}/>
    {/* Big countdown number above ninja */}
    {isCountdown&&(
      <text x={xs(0)} y={cy-((tvMode?36:24)*1.5)} textAnchor="middle" fontSize={tvMode?48:32} fontWeight="900" fontFamily="JetBrains Mono,monospace" fill="#FF9500" style={{animation:'countPulse .8s ease-in-out infinite alternate',paintOrder:'stroke',stroke:'rgba(0,0,0,.8)',strokeWidth:4,strokeLinejoin:'round'}}>
        {countdownNum}
      </text>
    )}
  </>;
};

const SurvivalChart=({data,tvMode,liveRunners=[],obsArr=[]})=>{
  if(!data||!data.length)return<div style={{padding:'20px 0',color:'var(--muted)',fontSize:13,textAlign:'center'}}>Keine Daten</div>;
  const W=1000,H=tvMode?420:300;
  const ML=46,MR=16,MT=20,MB=tvMode?90:80;
  const PW=W-ML-MR,PH=H-MT-MB;
  const nPts=data[0]?.points?.length||0;
  if(nPts<2)return<div style={{padding:'20px 0',color:'var(--muted)',fontSize:13,textAlign:'center'}}>Noch zu wenig Läufe für eine Kurve</div>;
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
        {data.map(({cat,points})=>{
          const d=points.map((p,i)=>`${i===0?'M':'L'}${xs(i).toFixed(1)},${ys(p.y).toFixed(1)}`).join(' ');
          return(
            <g key={cat.id}>
              <path d={d} fill="none" stroke={cat.color} strokeWidth={tvMode?3:2.2} strokeLinecap="round" strokeLinejoin="round" opacity={.88}/>
              {points.map((p,i)=><circle key={i} cx={xs(i)} cy={ys(p.y)} r={tvMode?5:3} fill={cat.color} stroke="rgba(0,0,0,.35)" strokeWidth="1.2"/>)}
            </g>
          );
        })}
        {data[0]?.points?.map((p,i)=>(
          <text key={i} x={xs(i)} y={H-MB+16} fill="rgba(255,255,255,.4)" fontSize={tvMode?11:9} textAnchor="end" fontFamily="system-ui"
            transform={`rotate(-48,${xs(i)},${H-MB+16})`}>
            {i===0?'Platform':(p.label||'').substring(0,20)}
          </text>
        ))}
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
  const pipelineStages=isPipeline?Object.entries(pipelineData).map(([id,v])=>({id,...v})).sort((a,b)=>(a.order||0)-(b.order||0)):[];

  // ── PIPELINE MODE: build stage data from pipeline stages ──
  const pipelineStageDataArr=isPipeline?pipelineStages.map(pStage=>{
    const stageKey=pStage.id;
    const stageName=pStage.name||stageKey;
    const stageRuns=runList.filter(r=>r.stageId===stageKey);
    const runCatIds=[...new Set(stageRuns.map(r=>r.catId).filter(Boolean))];
    const activeRunCatIds=activeRuns?Object.entries(activeRuns).filter(([snKey,r])=>snKey===stageKey&&r?.catId&&(r.phase==='active'||r.phase==='countdown')).map(([,r])=>r.catId):[];
    const configCatIds=pStage.categories==='all'?[]:Array.isArray(pStage.categories)?pStage.categories:[];
    const unionIds=[...new Set([...configCatIds,...runCatIds,...activeRunCatIds])];
    const activeCats=unionIds.map(id=>IGN_CATS.find(c=>c.id===id)).filter(Boolean);
    if(activeCats.length===0&&stageRuns.length===0&&!activeRuns?.[stageKey]?.athleteId)return null;
    const obsArr=(()=>{const raw=globalObstacles;if(!raw)return DEF_OBS;return Object.values(raw).sort((a,b)=>a.order-b.order).filter(o=>o.isCP!==false);})();
    const survivalData=activeCats.map(cat=>{
      const cr=stageRuns.filter(r=>r.catId===cat.id&&r.status!=='dsq');
      const total=cr.length;if(!total)return null;
      const points=[{x:-1,y:100,label:'Platform'},...obsArr.map((obs,i)=>({x:i,y:(cr.filter(r=>(r.doneCP?.length||0)>i).length/total)*100,label:obsShortName(obs.name)}))];
      return{cat,points,total};
    }).filter(Boolean);
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
      const totalLives=info?.lives||3;
      const livesLeft=r.livesLeft!=null?r.livesLeft:totalLives;
      const livesUsed=totalLives-livesLeft;
      const cpArr=Array.isArray(r.doneCP)?r.doneCP:(r.doneCP&&typeof r.doneCP==='object'?Object.values(r.doneCP):[]);
      const lastCPTime=cpArr.length>0?cpArr[cpArr.length-1]?.time:null;
      const limitSec=info?.stageLimits?.[stageKey]??info?.timeLimit??0;
      const elapsed=r.startEpoch?Date.now()-r.startEpoch:0;
      const timeRemaining=limitSec>0?Math.max(0,limitSec*1000-elapsed):null;
      // Best run for ghost ninja (same cat+stage, best = most CPs then fastest, any athlete)
      const bestRun=stageRuns.filter(x=>x.catId===catId&&x.status!=='dsq'&&(x.doneCP?.length||Object.keys(x.doneCP||{}).length)>0).sort((a,b)=>(Array.isArray(b.doneCP)?b.doneCP.length:Object.keys(b.doneCP||{}).length)-(Array.isArray(a.doneCP)?a.doneCP.length:Object.keys(a.doneCP||{}).length)||(a.finalTime||Infinity)-(b.finalTime||Infinity))[0];
      const bestRunCPs=bestRun?Array.isArray(bestRun.doneCP)?bestRun.doneCP:(bestRun.doneCP?Object.values(bestRun.doneCP):[]):[];
      const bestRunName=bestRun?(athletesMap?.[bestRun.athleteId]?.name||bestRun.athleteName||'?').split(' ')[0]:'';
      return{id:r.athleteId,catId,doneCPCount,name:a?.name?.split(' ')[0]||'',livesLeft,livesUsed,totalLives,fallen:livesLeft<=0&&livesUsed>0,lastCPTime,timeRemaining,startEpoch:r.startEpoch,bestRunCPs,bestRunName,phase:r.phase,countdown:r.countdown,resetting:!!r.resetting,resetUntil:r.resetUntil||null};
    }):[];
    return{sn:stageKey,stageName,catId:configCatIds[0]||null,obsArr,survivalData,difficultyData,progressData,liveRunners};
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
  const getStageObsArr=sn=>{
    const raw=allStagesData?.[sn]?.obstacles||globalObstacles;
    if(!raw)return DEF_OBS;
    return Object.values(raw).sort((a,b)=>a.order-b.order).filter(o=>o.isCP!==false);
  };

  // Build full dataset for each active stage independently
  const legacyStageDataArr=activeStageNums.map(sn=>{
    const catId=allStations?.[sn]?.cat||null;
    const obsArr=getStageObsArr(sn);
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
      const cpArr=Array.isArray(r.doneCP)?r.doneCP:(r.doneCP&&typeof r.doneCP==='object'?Object.values(r.doneCP):[]);
      const lastCPTime=cpArr.length>0?cpArr[cpArr.length-1]?.time:null;
      const limitSec=info?.stageLimits?.[sn]??info?.timeLimit??0;
      const elapsed=r.startEpoch?Date.now()-r.startEpoch:0;
      const timeRemaining=limitSec>0?Math.max(0,limitSec*1000-elapsed):null;
      const _catId=r.catId||(a?.cat)||null;
      const bestRun=stageRuns.filter(x=>x.catId===_catId&&x.status!=='dsq'&&(x.doneCP?.length||Object.keys(x.doneCP||{}).length)>0).sort((x,y)=>(Array.isArray(y.doneCP)?y.doneCP.length:Object.keys(y.doneCP||{}).length)-(Array.isArray(x.doneCP)?x.doneCP.length:Object.keys(x.doneCP||{}).length)||(x.finalTime||Infinity)-(y.finalTime||Infinity))[0];
      const bestRunCPs=bestRun?Array.isArray(bestRun.doneCP)?bestRun.doneCP:(bestRun.doneCP?Object.values(bestRun.doneCP):[]):[];
      const bestRunName=bestRun?(athletesMap?.[bestRun.athleteId]?.name||bestRun.athleteName||'?').split(' ')[0]:'';
      return{id:r.athleteId,catId:_catId,doneCPCount,name:a?.name?.split(' ')[0]||'',livesLeft,livesUsed:totalLives-livesLeft,totalLives,fallen:livesLeft<=0&&(totalLives-livesLeft)>0,lastCPTime,timeRemaining,startEpoch:r.startEpoch,bestRunCPs,bestRunName,phase:r.phase,countdown:r.countdown,resetting:!!r.resetting,resetUntil:r.resetUntil||null};
    }):[];

    return{sn,catId,obsArr,survivalData,difficultyData,progressData,liveRunners};
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
        {stageDataArr.map(({sn,stageName:pipelineStageName,catId,survivalData,difficultyData,progressData,liveRunners,obsArr})=>{
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
              {chartTab==='survival'&&<SurvivalChart data={survivalData} tvMode={tvMode} liveRunners={liveRunners} obsArr={obsArr}/>}
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
