import React, { useState, useEffect, useRef } from 'react';
import { useLang } from '../i18n.js';
import { IGN_CATS } from '../config.js';
import { fmtMs, computeRanked, computeRankedStage } from '../utils.js';
import { useFbVal, SFX } from '../hooks.js';
import { I } from '../icons.jsx';
import { Spinner, EmptyState } from './shared.jsx';

const SurvivalChart=({data,tvMode})=>{
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
            {i===0?'Start':(p.label||'').substring(0,20)}
          </text>
        ))}
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


const StatsView=({compId,info,completedRuns,athletesMap,tvMode=false})=>{
  const {lang,catName}=useLang();
  const [chartTab,setChartTab]=useState('survival');
  // Load global obstacles AND per-stage obstacles (via the stages subtree)
  const globalObstacles=useFbVal(`ogn/${compId}/obstacles`);
  const allStations=useFbVal(`ogn/${compId}/stations`);
  const allStagesData=useFbVal(`ogn/${compId}/stages`);
  const runList=completedRuns?Object.values(completedRuns):[];
  const athList=athletesMap?Object.values(athletesMap):[];

  const numStages=info?.numStations||1;

  // Determine which stages are active (have a category assigned or have at least one run)
  const activeStageNums=Array.from({length:numStages},(_,i)=>i+1).filter(sn=>{
    const hasCat=allStations?.[sn]?.cat;
    const hasRuns=runList.some(r=>String(r.stNum)===String(sn));
    return hasCat||hasRuns;
  });

  // Get the correct obstacle array for a specific stage
  // Priority: per-stage obstacles → global obstacles → built-in defaults
  const getStageObsArr=sn=>{
    const raw=allStagesData?.[sn]?.obstacles||globalObstacles;
    if(!raw)return DEF_OBS;
    return Object.values(raw).sort((a,b)=>a.order-b.order).filter(o=>o.isCP!==false);
  };

  // Build full dataset for each active stage independently
  const stageDataArr=activeStageNums.map(sn=>{
    const catId=allStations?.[sn]?.cat||null;
    const obsArr=getStageObsArr(sn);
    // Only runs from THIS stage
    const stageRuns=runList.filter(r=>String(r.stNum)===String(sn));
    // Categories present in this stage
    const activeCats=catId
      ?[IGN_CATS.find(c=>c.id===catId)].filter(Boolean)
      :[...new Set(stageRuns.map(r=>r.catId))].map(id=>IGN_CATS.find(c=>c.id===id)).filter(Boolean);

    // ── Survival curve (per category for this stage) ──
    const survivalData=activeCats.map(cat=>{
      const cr=stageRuns.filter(r=>r.catId===cat.id&&r.status!=='dsq');
      const total=cr.length;if(!total)return null;
      const points=[{x:-1,y:100,label:'Start'},...obsArr.map((obs,i)=>({x:i,y:(cr.filter(r=>(r.doneCP?.length||0)>i).length/total)*100,label:obsShortName(obs.name)}))];
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

    return{sn,catId,obsArr,survivalData,difficultyData,progressData};
  });

  const tabs=[
    {k:'survival',ic:<I.TrendUp s={12}/>,lb:lang==='de'?'Überlebensrate':'Survival'},
    {k:'difficulty',ic:<I.BarChart s={12}/>,lb:lang==='de'?'Statistik':'Stats'},
  ];

  if(stageDataArr.length===0)return(
    <div style={{padding:'40px 0',textAlign:'center',color:'var(--muted)',fontSize:13}}>
      {lang==='de'?'Noch keine aktiven Stages':'No active stages yet'}
    </div>
  );

  const multiStage=stageDataArr.length>1;

  return(
    <div style={{padding:tvMode?'12px 0':'4px 0'}}>
      {/* Chart type selector (applies to all stage sections) */}
      <div style={{display:'flex',gap:5,marginBottom:tvMode?16:12,flexWrap:'wrap'}}>
        {tabs.map(({k,ic,lb})=>(
          <button key={k} style={{display:'flex',alignItems:'center',gap:5,padding:tvMode?'9px 14px':'7px 11px',borderRadius:20,border:`1px solid ${chartTab===k?'rgba(255,94,58,.4)':'var(--border)'}`,background:chartTab===k?'rgba(255,94,58,.14)':'transparent',color:chartTab===k?'var(--coral)':'var(--muted)',fontWeight:700,fontSize:tvMode?13:11,cursor:'pointer',transition:'all .15s'}} onClick={()=>setChartTab(k)}>{ic}{lb}</button>
        ))}
      </div>

      {/* One section per active stage */}
      <div style={{display:'flex',flexDirection:'column',gap:tvMode?32:20}}>
        {stageDataArr.map(({sn,catId,survivalData,difficultyData,progressData})=>{
          const cat=catId?IGN_CATS.find(c=>c.id===catId):null;
          const stageName=info?.stageNames?.[sn]||`Stage ${sn}`;
          return(
            <div key={sn}>
              {/* Stage header — only shown when multiple stages are active */}
              {multiStage&&(
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:tvMode?14:10,paddingBottom:tvMode?8:6,borderBottom:'1px solid rgba(255,255,255,.08)'}}>
                  <div style={{width:tvMode?34:26,height:tvMode?34:26,borderRadius:tvMode?10:7,background:'linear-gradient(135deg,var(--cor),var(--cor2))',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:tvMode?17:13,color:'#fff',flexShrink:0}}>{sn}</div>
                  <div style={{fontSize:tvMode?17:14,fontWeight:800,color:'#fff'}}>{stageName}</div>
                  {cat&&<div style={{fontSize:tvMode?13:10,color:cat.color,fontWeight:700,background:`${cat.color}1A`,borderRadius:12,padding:'2px 10px',border:`1px solid ${cat.color}35`,flexShrink:0}}>{catName(cat)}</div>}
                  <div style={{fontSize:tvMode?11:9,color:'rgba(255,255,255,.3)',fontFamily:'JetBrains Mono',marginLeft:'auto'}}>
                    {survivalData[0]?.total||0} {lang==='de'?'Läufe':'runs'}
                  </div>
                </div>
              )}
              {chartTab==='survival'&&<SurvivalChart data={survivalData} tvMode={tvMode}/>}
              {chartTab==='difficulty'&&<>
                <DifficultyChart data={difficultyData} lang={lang} tvMode={tvMode}/>
                <div style={{marginTop:tvMode?16:10}}><ProgressChart data={progressData} catName={catName} lang={lang} tvMode={tvMode}/></div>
              </>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// QUEUE DISPLAY VIEW (TV full-screen)
// ══════════════════════════════════════════════════════════

export { StatsView, SurvivalChart, DifficultyChart, ProgressChart };
