import React, { useState, useEffect, useRef } from 'react';
import { useLang } from '../i18n.js';
import { IGN_CATS, MODES, DEF_OBS, STAGE_LETTERS, fbSet } from '../config.js';
import { uid, today, storage, toFlag, AC_KEYS, acSave, acProfileSave, resizePhotoUtil, resizeLogoUtil } from '../utils.js';
import { SFX } from '../hooks.js';
import { I } from '../icons.jsx';
import { AutocompleteInput, TopBar, EmptyState, DragList, TimePicker } from './shared.jsx';

const SetupWizard=({onDone,onBack,existingId=null,initialInfo=null,initialStages=null,initialObstacles=null,initialAthletes=null})=>{
  const {t,lang}=useLang();
  const [step,setStep]=useState(0);
  const [info,setInfo]=useState(initialInfo||{name:'',date:today(),location:'',mode:'classic',numStations:2,lives:3,timeLimit:0,stageLimits:{},stageLivesOverrides:{},livesPerSection:false,stageTotalLives:0,stageExtraLife:{},emoji:'',logo:null,qualification:{},chRankingEnabled:false,chRankingFinale:false,skillPhase:{enabled:false,type:'oldschool',skills:[],timerHrs:0,seedingMode:'inverted'}});
  // Per-stage obstacles: array[stageIdx] = [{id,name,isCP,order}]
  const [stageObs,setStageObs]=useState(()=>{
    const n=initialInfo?.numStations||2;
    return Array.from({length:4},(_,i)=>{
      if(initialStages?.[i+1]?.obstacles)return Object.values(initialStages[i+1].obstacles).sort((a,b)=>a.order-b.order);
      if(initialObstacles&&i===0)return Object.values(initialObstacles).sort((a,b)=>a.order-b.order);
      return DEF_OBS.map(o=>({...o,id:uid()}));
    });
  });
  // Per-stage athletes: array[stageIdx] = [{id,name,num,cat,stageNum}]
  const [stageAths,setStageAths]=useState(()=>{
    const n=initialInfo?.numStations||2;
    return Array.from({length:4},(_,i)=>{
      if(initialStages?.[i+1]?.athletes)return Object.values(initialStages[i+1].athletes);
      if(initialAthletes&&i===0)return Object.values(initialAthletes);
      return [];
    });
  });
  const [obsStage,setObsStage]=useState(0);// which stage tab is active for obstacles
  const [athStage,setAthStage]=useState(0);// which stage tab is active for athletes
  const [newObs,setNewObs]=useState('');
  const [newAth,setNewAth]=useState({name:'',num:'1',cat:'am1',gender:'m',country:'',team:'',photo:null,stageNum:1});
  const [saving,setSaving]=useState(false);
  const [csvError,setCsvError]=useState('');
  const sI=(k,v)=>setInfo(i=>({...i,[k]:v}));
  const setStageLim=(n,v)=>setInfo(i=>({...i,stageLimits:{...(i.stageLimits||{}),[n]:v}}));
  // CH Ranking unlock
  const [chRankingUnlocked,setChRankingUnlocked]=useState(!!(initialInfo?.chRankingEnabled));
  const [chRankingPwPrompt,setChRankingPwPrompt]=useState(false);
  const [chRankingPwInput,setChRankingPwInput]=useState('');
  const CH_RANKING_PW='CH2026';
  const tryUnlock=()=>{if(chRankingPwInput===CH_RANKING_PW){setChRankingUnlocked(true);setChRankingPwPrompt(false);setChRankingPwInput('');}else{setChRankingPwInput('');alert(lang==='de'?'Falsches Passwort':'Wrong password');}};
  const numSt=info.pipelineEnabled?(info.pipeline||[]).length:(info.numStations||1);const catsWithAths=[...new Set((stageAths||[]).flat().map(a=>a.cat))];
  // Sync stageNum in newAth when obsStage changes
  const curAthStage=athStage;

  const resizePhoto=resizePhotoUtil;
  const addObs=()=>{
    if(!newObs.trim())return;
    const si=Math.min(obsStage,numSt-1);
    setStageObs(s=>{const n=[...s];n[si]=[...n[si],{id:uid(),name:newObs.trim(),isCP:true,order:n[si].length}];return n;});
    setNewObs('');SFX.click();
  };
  const reorderObs=arr=>{
    const si=Math.min(obsStage,numSt-1);
    setStageObs(s=>{const n=[...s];n[si]=arr.map((o,i)=>({...o,order:i}));return n;});
  };
  const removeObs=(si,id)=>{
    setStageObs(s=>{const n=[...s];n[si]=n[si].filter(o=>o.id!==id);return n;});
  };
  const toggleObsCP=(si,id)=>{
    setStageObs(s=>{const n=[...s];n[si]=n[si].map(o=>o.id===id?{...o,isCP:!o.isCP}:o);return n;});
  };
  const addAth=()=>{
    if(!newAth.name.trim())return;
    const si=Math.min(curAthStage,numSt-1);
    const stageNum=si+1;
    setStageAths(a=>{const n=[...a];n[si]=[...n[si],{id:uid(),...newAth,stageNum}];return n;});
    // Persist for autocomplete
    acSave(AC_KEYS.names,newAth.name);
    if(newAth.team)acSave(AC_KEYS.teams,newAth.team);
    if(newAth.country)acSave(AC_KEYS.countries,newAth.country);
    acProfileSave(newAth.name,{country:newAth.country||'',photo:newAth.photo||null});
    setNewAth(a=>({...a,name:'',num:String(stageAths[si].length+2)}));
    SFX.click();
  };
  const removeAth=(si,id)=>{
    setStageAths(a=>{const n=[...a];n[si]=n[si].filter(x=>x.id!==id);return n;});
  };
  const reorderAth=(si,arr)=>{
    setStageAths(a=>{const na=[...a];na[si]=arr;return na;});
  };

  // CSV Import
  const normalizeGender=raw=>{
    const g=(raw||'').trim().toLowerCase();
    if(['m','male','männlich','maennlich','man'].includes(g))return 'm';
    if(['w','f','female','weiblich','frau','woman'].includes(g))return 'w';
    if(['d','div','diverse','divers','non-binary','nb','x'].includes(g))return 'd';
    return 'm'; // default
  };
  const importCSV=(si,text)=>{
    setCsvError('');
    const lines=text.trim().split(/\r?\n/).filter(l=>l.trim());
    // Skip header row if it looks like a header
    const start=(lines[0]&&isNaN(lines[0].split(/[,;\t]/)[0].trim())&&!lines[0].split(/[,;\t]/)[0].trim().match(/^\d/))?1:0;
    const results=[];
    for(const line of lines.slice(start)){
      const parts=line.split(/[,;\t]/).map(s=>s.trim().replace(/^["']|["']$/g,''));
      if(parts.length<2){setCsvError(`Ungültige Zeile: ${line}`);return;}
      const [num,name,catRaw='',genderRaw='',countryRaw='',teamRaw='']=parts;
      const catLow=catRaw.toLowerCase();
      const cat=IGN_CATS.find(c=>c.id===catLow||c.name.de.toLowerCase().includes(catLow)||c.name.en.toLowerCase().includes(catLow))||IGN_CATS[9];
      const gender=normalizeGender(genderRaw);
      results.push({id:uid(),num:num||String(results.length+1),name,cat:cat.id,gender,country:countryRaw.trim(),team:teamRaw.trim(),stageNum:si+1});
    }
    if(results.length===0){setCsvError('Keine Athleten gefunden');return;}
    setStageAths(a=>{const n=[...a];n[si]=[...n[si],...results];return n;});
    SFX.complete();
    alert(`${results.length} Athleten importiert`);
  };
  const downloadCsvTemplate=()=>{
    const rows=[
      'Startnr,Name,Kategorie-ID,Geschlecht,Land,Team',
      '1,Max Muster,am1,M,CH,',
      '2,Laura Beispiel,aw1,W,AT,Team Ninja',
      '3,Robin Test,am2,D,DE,',
      '4,Anna Sample,jm1,W,CH,SwissNinja',
    ];
    const blob=new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='athleten-vorlage.csv';a.click();URL.revokeObjectURL(url);
    SFX.click();
  };
  const handleFileImport=(si,file)=>{
    if(!file)return;
    const r=new FileReader();
    r.onload=e=>{
      if(file.name.endsWith('.csv')||file.name.endsWith('.txt')){
        importCSV(si,e.target.result);
      } else {
        // Try xlsx via SheetJS if available, else treat as CSV
        try{
          const data=new Uint8Array(e.target.result);
          const wb=XLSX.read(data,{type:'array'});
          const ws=wb.Sheets[wb.SheetNames[0]];
          const rows=XLSX.utils.sheet_to_json(ws,{header:1});
          // Skip header row if first cell looks like a header
          const start=(rows[0]&&typeof rows[0][0]==='string'&&isNaN(rows[0][0]))?1:0;
          const csvLines=rows.slice(start).map(r=>`${r[0]||''},${r[1]||''},${r[2]||''},${r[3]||''},${r[4]||''},${r[5]||''}`).join('\n');
          importCSV(si,csvLines);
        }catch{
          // Fallback: try as text
          importCSV(si,e.target.result);
        }
      }
    };
    if(file.name.endsWith('.xlsx')||file.name.endsWith('.xls')){
      r.readAsArrayBuffer(file);
    } else {
      r.readAsText(file);
    }
  };

  const save=async()=>{
    if(!info.name.trim())return;setSaving(true);
    const id=existingId||uid();
    const stagesData={};
    const pipeline=info.pipeline||[];
    for(let i=0;i<numSt;i++){
      const n=info.pipelineEnabled?(pipeline[i]?.id||i+1):(i+1);
      const om={};(stageObs[i]||[]).forEach((o,idx)=>{om[o.id]={...o,order:idx};});
      const am={};(stageAths[i]||[]).forEach(a=>{am[a.id]=a;});
      stagesData[n]={obstacles:om,athletes:Object.keys(am).length?am:null};
    }
    // Global fallback
    const om0={};(stageObs[0]||[]).forEach((o,i)=>{om0[o.id]={...o,order:i};});
    const am0={};
    for(let i=0;i<numSt;i++){(stageAths[i]||[]).forEach(a=>{am0[a.id]=a;});}
    const data={
      info:{...info,numStations:numSt,createdAt:Date.now()},
      obstacles:om0,
      athletes:Object.keys(am0).length?am0:null,
      stages:stagesData,
    };
    // Write pipeline config
    if(info.pipelineEnabled&&pipeline.length>0){
      const pipelineData={};
      pipeline.forEach((stg,i)=>{pipelineData[stg.id]={...stg,order:i};});
      data.pipeline=pipelineData;
    }
    await fbSet(`ogn/${id}`,data);
    setSaving(false);SFX.complete();onDone(id);
  };

  // Stage tab bar helper
  const pipelineStages=info.pipelineEnabled?(info.pipeline||[]):null;
  const StageTabs=({active,onChange})=>(
    <div style={{display:'flex',gap:4,overflowX:'auto',padding:'0 0 4px'}}>
      {Array.from({length:numSt},(_,i)=>(
        <button key={i} className={`chip${active===i?' active':''}`}
          style={{flexShrink:0,padding:'4px 14px',fontSize:12}}
          onClick={()=>{onChange(i);SFX.hover();}}>
          {pipelineStages?pipelineStages[i]?.name||`Stage ${i+1}`:`Stage ${i+1}`}
        </button>
      ))}
    </div>
  );
  const si=Math.min(obsStage,numSt-1);
  const curObs=stageObs[si]||[];
  const asi=Math.min(athStage,numSt-1);
  const curAths=stageAths[asi]||[];

  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <TopBar title={['Setup',t('obstacles'),t('athletes'),'Skill Phase'][step]||'Setup'} logo={false}
        onBack={step===0?onBack:()=>{
          const noStages=(info.numStations||0)===0;
          // skip Obstacles step when going back if no stages
          if(step===2&&noStages)setStep(0);
          else setStep(s=>s-1);
        }}
        right={<div style={{fontSize:12,color:'var(--muted)',fontWeight:700}}>{step+1}/{info.skillPhase?.enabled?4:3}</div>}/>
      <div style={{display:'flex',gap:3,padding:'10px 16px',background:'rgba(255,255,255,.02)',borderBottom:'1px solid var(--border)'}}>
        {(info.skillPhase?.enabled?[0,1,2,3]:[0,1,2]).map(i=><div key={i} style={{flex:1,height:3,borderRadius:2,background:i<=step?'var(--cor)':'var(--border)',transition:'background .3s'}}/>)}
      </div>

      {step===0&&(
        <div className="section fade-up" style={{flex:1}}>
          <div className="lbl">{lang==='de'?'Emoji':'Emoji'}</div>
          {/* Competition logo upload */}
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
            <label style={{cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',width:72,height:72,borderRadius:16,border:`2px dashed ${info.logo?'rgba(255,94,58,.5)':'var(--border)'}`,background:info.logo?'transparent':'rgba(255,255,255,.03)',overflow:'hidden',flexShrink:0,transition:'border-color .15s',position:'relative'}}>
              {info.logo?<img src={info.logo} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<><I.Camera s={22} c="var(--muted)"/><span style={{fontSize:9,color:'var(--muted)',marginTop:3,textAlign:'center',letterSpacing:'.04em'}}>LOGO</span></>}
              <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{if(e.target.files[0])resizeLogoUtil(e.target.files[0],b64=>sI('logo',b64));e.target.value='';}}/>
            </label>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:'var(--text)',marginBottom:4}}>{lang==='de'?'Wettkampf-Logo (optional)':'Competition Logo (optional)'}</div>
              <div style={{fontSize:11,color:'var(--muted)',lineHeight:1.5}}>{lang==='de'?'Wird überall angezeigt — Display, Warteliste, etc.':'Shown everywhere — display, queue, etc.'}</div>
              {info.logo&&<button style={{marginTop:6,fontSize:11,color:'var(--red)',background:'rgba(255,59,48,.12)',border:'none',borderRadius:6,padding:'3px 8px',cursor:'pointer'}} onClick={()=>sI('logo',null)}>{lang==='de'?'Entfernen':'Remove'}</button>}
            </div>
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:4}}>
            {['🥷','🏆','🥇','🎯','💪','🔥','⚡','🌟','🏅','🤸','🧗','🦸','🐉','⚔️','🐯','🦁','🦅','💥','🌊','🎖️'].map(e=>(
              <button key={e} onClick={()=>sI('emoji',e)} style={{width:38,height:38,fontSize:20,borderRadius:10,border:`2px solid ${info.emoji===e?'var(--cor)':'var(--border)'}`,background:info.emoji===e?'rgba(255,94,58,.18)':'rgba(255,255,255,.03)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}>{e}</button>
            ))}
          </div>
          <div className="lbl">{t('compName')}</div>
          <input value={info.name} onChange={e=>sI('name',e.target.value)} placeholder="OG Ninja Cup 2026" autoFocus/>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <div style={{flex:'1 1 160px',minWidth:0}}><div className="lbl" style={{marginBottom:6}}>{t('compDate')}</div><input type="date" value={info.date} onChange={e=>sI('date',e.target.value)} style={{width:'100%'}}/></div>
            <div style={{flex:'2 1 180px',minWidth:0}}><div className="lbl" style={{marginBottom:6}}>{t('compLocation')}</div><input value={info.location} onChange={e=>sI('location',e.target.value)} placeholder="Zurich Ninja Park" style={{width:'100%'}}/></div>
          </div>
          <div className="lbl">{t('mode')}</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {Object.values(MODES).map(m=><button key={m.id} className={`chip${info.mode===m.id?' active':''}`} onClick={()=>{sI('mode',m.id);SFX.hover();}}>{m.name[lang]||m.name.de}</button>)}
          </div>
          <div className="lbl">{t('numStations')}</div>
          {/* Pipeline toggle */}
          <div style={{display:'flex',gap:6,marginBottom:8}}>
            <button className={`chip${!info.pipelineEnabled?' active':''}`} style={{flex:1,justifyContent:'center'}} onClick={()=>{sI('pipelineEnabled',false);SFX.hover();}}>
              {lang==='de'?'Einfach (1-4)':'Simple (1-4)'}
            </button>
            <button className={`chip${info.pipelineEnabled?' active':''}`} style={{flex:1,justifyContent:'center'}} onClick={()=>{sI('pipelineEnabled',true);SFX.hover();}}>
              {lang==='de'?'Stagebuilder':'Stagebuilder'}
            </button>
          </div>

          {/* Simple mode */}
          {!info.pipelineEnabled&&(<>
            <div style={{display:'flex',gap:6}}>
              {(info.skillPhase?.enabled?[0,1,2,3,4]:[1,2,3,4]).map(n=><button key={n} className={`chip${info.numStations===n?' active':''}`} style={{flex:1,justifyContent:'center'}} onClick={()=>sI('numStations',n)}>{n===0?(lang==='de'?'Keine':'None'):n}</button>)}
            </div>
            {info.numStations===0&&info.skillPhase?.enabled&&<div style={{fontSize:11,color:'var(--muted)',marginTop:4,padding:'6px 10px',background:'rgba(52,199,89,.06)',border:'1px solid rgba(52,199,89,.2)',borderRadius:8,lineHeight:1.5}}>{lang==='de'?'Reiner Skill-Wettkampf — kein Stage-Parcours, direkt Siegerehrung nach Skills':'Pure skill competition — no stage course, awards ceremony directly after skills'}</div>}
            {numSt>1&&(<div style={{marginTop:8,display:'flex',alignItems:'center',gap:8}}><label style={{fontSize:12,color:'var(--muted)',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}><input type="checkbox" checked={info.stageLinked||false} onChange={e=>sI('stageLinked',e.target.checked)} style={{cursor:'pointer'}}/>{lang==='de'?'Stages verbinden (Qualifikation)':'Link stages (qualification)'}</label></div>)}
            {numSt>1&&(<div style={{marginTop:8}}><div className="lbl" style={{display:'flex',alignItems:'center',gap:5,marginBottom:4}}><I.Trophy s={13}/> {lang==='de'?'Qualifikation (%)':'Qualification (%)'}</div><div style={{display:'flex',alignItems:'center',gap:6}}><input type="number" min={0} max={100} value={info.qualPercent||''} onChange={e=>sI('qualPercent',e.target.value===''?0:Number(e.target.value))} style={{width:72,padding:'6px 10px',background:'var(--card2)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)',fontSize:13}}/><span style={{fontSize:11,color:'var(--muted)'}}>% {lang==='de'?'kommen weiter':'advance'}</span></div></div>)}
          </>)}

          {/* Pipeline / Stagebuilder mode */}
          {info.pipelineEnabled&&(<>
            <div style={{background:'rgba(255,94,58,.04)',border:'1px solid rgba(255,94,58,.2)',borderRadius:12,padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div className="lbl" style={{margin:0}}>{lang==='de'?'Stage Pipeline':'Stage Pipeline'} ({(info.pipeline||[]).length})</div>
                <button className="btn btn-ghost" style={{padding:'4px 10px',fontSize:11,gap:4}} onClick={()=>{
                  const pl=info.pipeline||[];
                  const letter=STAGE_LETTERS[pl.length]||`S${pl.length+1}`;
                  sI('pipeline',[...pl,{id:uid(),name:`Stage ${letter}`,mode:info.mode||'classic',categories:'all',predecessorStages:[],qualiPercent:0,minPerDivision:3,order:pl.length}]);
                  SFX.click();
                }}><I.Plus s={12}/> {lang==='de'?'Stage hinzufügen':'Add Stage'}</button>
              </div>

              {(info.pipeline||[]).map((stg,si)=>{
                const updateStg=(key,val)=>{sI('pipeline',(info.pipeline||[]).map((s,j)=>j===si?{...s,[key]:val}:s));};
                const others=(info.pipeline||[]).filter(s=>s.id!==stg.id);
                const isEntry=!stg.predecessorStages||stg.predecessorStages.length===0;
                const isEnd=!stg.qualiPercent||stg.qualiPercent<=0;
                return(
                  <div key={stg.id} style={{background:'rgba(255,255,255,.03)',borderRadius:10,padding:'10px 12px',border:'1px solid var(--border)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                      <div style={{width:28,height:28,borderRadius:8,background:'rgba(255,94,58,.15)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:12,color:'var(--cor)',flexShrink:0}}>{si+1}</div>
                      <input value={stg.name} onChange={e=>updateStg('name',e.target.value)} style={{flex:1,padding:'4px 8px',fontSize:13,fontWeight:700}} placeholder="Stage Name"/>
                      {isEntry&&<span style={{fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:4,background:'rgba(52,199,89,.15)',color:'var(--green)',border:'1px solid rgba(52,199,89,.3)'}}>Entry</span>}
                      {isEnd&&!isEntry&&<span style={{fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:4,background:'rgba(255,94,58,.15)',color:'var(--cor)',border:'1px solid rgba(255,94,58,.3)'}}>Ende</span>}
                      <button style={{background:'none',border:'none',cursor:'pointer',padding:4}} onClick={()=>{sI('pipeline',(info.pipeline||[]).filter(s=>s.id!==stg.id));SFX.click();}}><I.Trash s={13} c="var(--red)"/></button>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,fontSize:12}}>
                      {/* Mode */}
                      <div>
                        <div style={{fontSize:10,color:'var(--muted)',marginBottom:3}}>{t('mode')}</div>
                        <div style={{display:'flex',gap:3}}>
                          {Object.values(MODES).map(m=><button key={m.id} className={`chip${stg.mode===m.id?' active':''}`} style={{fontSize:10,padding:'2px 8px',flex:1,justifyContent:'center'}} onClick={()=>updateStg('mode',m.id)}>{m.name[lang]}</button>)}
                        </div>
                      </div>
                      {/* Categories */}
                      <div>
                        <div style={{fontSize:10,color:'var(--muted)',marginBottom:3}}>{lang==='de'?'Kategorien':'Categories'}</div>
                        <button className={`chip${stg.categories==='all'?' active':''}`} style={{fontSize:10,padding:'2px 8px',width:'100%',justifyContent:'center'}} onClick={()=>updateStg('categories',stg.categories==='all'?[]:'all')}>{lang==='de'?'Alle':'All'}</button>
                      </div>
                    </div>
                    {stg.categories!=='all'&&(
                      <div style={{display:'flex',gap:3,flexWrap:'wrap',marginTop:4}}>
                        {IGN_CATS.map(c=>{const sel=(stg.categories||[]).includes(c.id);return(
                          <button key={c.id} className={`chip${sel?' active':''}`} style={{fontSize:9,padding:'1px 6px',...(sel?{background:`${c.color}1A`,borderColor:`${c.color}55`,color:c.color}:{})}}
                            onClick={()=>updateStg('categories',sel?(stg.categories||[]).filter(x=>x!==c.id):[...(stg.categories||[]),c.id])}>{c.name[lang]||c.id}</button>
                        );})}
                      </div>
                    )}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:6}}>
                      {/* Predecessor */}
                      <div>
                        <div style={{fontSize:10,color:'var(--muted)',marginBottom:3}}>{lang==='de'?'Nach Stage':'After Stage'}</div>
                        <select value={stg.predecessorStages?.[0]||''} onChange={e=>{updateStg('predecessorStages',e.target.value?[e.target.value]:[]);}} style={{fontSize:11,padding:'4px 6px'}}>
                          <option value="">{lang==='de'?'— Einstieg —':'— Entry —'}</option>
                          {others.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      </div>
                      {/* Quali */}
                      <div>
                        <div style={{fontSize:10,color:'var(--muted)',marginBottom:3}}>{lang==='de'?'Quali %':'Quali %'}</div>
                        <div style={{display:'flex',gap:4,alignItems:'center'}}>
                          <input type="number" min={0} max={100} value={stg.qualiPercent||0} onChange={e=>updateStg('qualiPercent',Number(e.target.value)||0)} style={{width:50,padding:'4px 6px',fontSize:12,textAlign:'center'}}/>
                          <span style={{fontSize:9,color:'var(--muted)'}}>Min:</span>
                          <input type="number" min={0} max={99} value={stg.minPerDivision||3} onChange={e=>updateStg('minPerDivision',Number(e.target.value)||0)} style={{width:36,padding:'4px 4px',fontSize:12,textAlign:'center'}}/>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Pipeline preview */}
              {(info.pipeline||[]).length>0&&(
                <div style={{padding:'8px 0',display:'flex',flexWrap:'wrap',gap:4,alignItems:'center'}}>
                  {(info.pipeline||[]).filter(s=>!s.predecessorStages||s.predecessorStages.length===0).map(s=>(
                    <span key={s.id} style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:5,background:'rgba(52,199,89,.15)',color:'var(--green)',border:'1px solid rgba(52,199,89,.3)'}}>{s.name}</span>
                  ))}
                  {(info.pipeline||[]).some(s=>s.predecessorStages?.length>0)&&<span style={{color:'var(--muted)',fontSize:12}}>→</span>}
                  {(info.pipeline||[]).filter(s=>s.predecessorStages?.length>0).map(s=>(
                    <span key={s.id} style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:5,background:'rgba(255,94,58,.12)',color:'var(--cor)',border:'1px solid rgba(255,94,58,.25)'}}>{s.name}{s.qualiPercent>0?` (${s.qualiPercent}%)`:''}</span>
                  ))}
                </div>
              )}
            </div>
          </>)}

          {/* CH Ranking Toggle */}
          <div style={{marginTop:14,background:'rgba(200,168,75,.07)',border:`1px solid ${chRankingUnlocked&&info.chRankingEnabled?'rgba(200,168,75,.5)':'rgba(200,168,75,.2)'}`,borderRadius:12,padding:'12px 14px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:chRankingUnlocked?10:0}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:18}}>🇨🇭</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:'#C8A84B'}}>{lang==='de'?'CH Ninja Ranking':'CH Ninja Ranking'}</div>
                  <div style={{fontSize:10,color:'var(--muted)',marginTop:1}}>{lang==='de'?'Offizielle Schweizer Meisterschaft':'Official Swiss Championship'}</div>
                </div>
              </div>
              {!chRankingUnlocked?(
                <button onClick={()=>setChRankingPwPrompt(true)} style={{fontSize:11,fontWeight:700,color:'#C8A84B',background:'rgba(200,168,75,.15)',border:'1px solid rgba(200,168,75,.3)',borderRadius:8,padding:'5px 12px',cursor:'pointer'}}>🔒 {lang==='de'?'Freischalten':'Unlock'}</button>
              ):(
                <button onClick={()=>{setChRankingUnlocked(false);sI('chRankingEnabled',false);sI('chRankingFinale',false);}} style={{fontSize:11,color:'var(--muted)',background:'transparent',border:'1px solid var(--border)',borderRadius:8,padding:'5px 12px',cursor:'pointer'}}>🔓 {lang==='de'?'Sperren':'Lock'}</button>
              )}
            </div>
            {chRankingUnlocked&&(
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'var(--text)'}}>
                  <input type="checkbox" checked={!!info.chRankingEnabled} onChange={e=>sI('chRankingEnabled',e.target.checked)} style={{cursor:'pointer',accentColor:'#C8A84B',width:16,height:16}}/>
                  {lang==='de'?'Ergebnisse fliessen ins CH Ranking ein':'Results count towards CH Ranking'}
                </label>
                {info.chRankingEnabled&&(
                  <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'var(--text)',paddingLeft:24}}>
                    <input type="checkbox" checked={!!info.chRankingFinale} onChange={e=>sI('chRankingFinale',e.target.checked)} style={{cursor:'pointer',accentColor:'#C8A84B',width:16,height:16}}/>
                    <span>🏆 {lang==='de'?'Dies ist das Finale (doppelte Punkte)':'This is the Finale (double points)'}</span>
                  </label>
                )}
              </div>
            )}
            {chRankingPwPrompt&&(
              <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget){setChRankingPwPrompt(false);setChRankingPwInput('');}}}> n                <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:24,width:280,display:'flex',flexDirection:'column',gap:12}}>
                  <div style={{fontSize:15,fontWeight:700,color:'#C8A84B',textAlign:'center'}}>🇨🇭 CH Ranking {lang==='de'?'freischalten':'unlock'}</div>
                  <input autoFocus type="password" value={chRankingPwInput} onChange={e=>setChRankingPwInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&tryUnlock()} placeholder={lang==='de'?'Passwort eingeben':'Enter password'} style={{padding:'10px 14px',borderRadius:10,border:'1px solid var(--border)',background:'var(--card2)',color:'var(--text)',fontSize:14}}/>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>{setChRankingPwPrompt(false);setChRankingPwInput('');}} style={{flex:1,padding:'9px',borderRadius:10,border:'1px solid var(--border)',background:'transparent',color:'var(--muted)',cursor:'pointer',fontSize:13}}>{lang==='de'?'Abbrechen':'Cancel'}</button>
                    <button onClick={tryUnlock} style={{flex:1,padding:'9px',borderRadius:10,border:'none',background:'#C8A84B',color:'#000',fontWeight:700,cursor:'pointer',fontSize:13}}>{lang==='de'?'OK':'OK'}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Skill Phase Toggle */}
          <div style={{marginTop:14,background:`rgba(52,199,89,${info.skillPhase?.enabled?.07:.04})`,border:`1px solid ${info.skillPhase?.enabled?'rgba(52,199,89,.4)':'rgba(52,199,89,.2)'}`,borderRadius:12,padding:'12px 14px',transition:'all .2s'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="4" r="2"/><path d="M10.5 9l-2.5 5h4l2 4"/><path d="M8.5 21l2-4M14.5 13l2 4-3.5 1.5"/></svg>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--green)'}}>{lang==='de'?'Skill Phase':'Skill Phase'}</div>
                  <div style={{fontSize:10,color:'var(--muted)',marginTop:1}}>{lang==='de'?'Qualifikation vor dem Stage-Wettkampf':'Qualification before stage competition'}</div>
                </div>
              </div>
              <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
                <div style={{position:'relative',width:40,height:22,flexShrink:0}}>
                  <input type="checkbox" checked={info.skillPhase?.enabled||false} onChange={e=>sI('skillPhase',{...(info.skillPhase||{enabled:false,type:'oldschool',skills:[],timerHrs:0,seedingMode:'inverted'}),enabled:e.target.checked})} style={{opacity:0,width:0,height:0,position:'absolute'}}/>
                  <div style={{position:'absolute',inset:0,borderRadius:11,background:info.skillPhase?.enabled?'var(--green)':'rgba(255,255,255,.15)',transition:'background .2s'}}/>
                  <div style={{position:'absolute',top:3,left:info.skillPhase?.enabled?20:3,width:16,height:16,borderRadius:'50%',background:'#fff',transition:'left .2s',boxShadow:'0 1px 4px rgba(0,0,0,.3)'}}/>
                </div>
              </label>
            </div>
            {info.skillPhase?.enabled&&(
              <div style={{marginTop:10,fontSize:11,color:'rgba(52,199,89,.8)',display:'flex',alignItems:'center',gap:5}}>
                <span>✓</span>
                <span>{lang==='de'?'Skill-Konfiguration im nächsten Schritt':'Skill configuration in next step'}</span>
              </div>
            )}
          </div>
        </div>
      )}

                {numSt>1&&catsWithAths.length>0&&(
            <div style={{background:'rgba(255,255,255,.03)',border:'1px solid var(--border)',borderRadius:12,padding:'12px 14px',display:'flex',flexDirection:'column',gap:10}}>
              <div className="lbl" style={{display:'flex',alignItems:'center',gap:5}}>ð {lang==='de'?'Qualifikation (mehrstufig)':'Qualification (multi-stage)'}</div>
              {catsWithAths.map(catId=>{
                const cat=IGN_CATS.find(c=>c.id===catId);
                const q=info.qualification?.[catId]||{};
                const setQ=(key,val)=>setInfo(i=>({...i,qualification:{...(i.qualification||{}),[catId]:{...(i.qualification?.[catId]||{}),[key]:val}}}));
                return(
                  <div key={catId} style={{background:'rgba(255,255,255,.03)',borderRadius:10,padding:'10px 12px',display:'flex',flexDirection:'column',gap:8,border:`1px solid ${cat?.color||'#888'}22`}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <input type="checkbox" id={`q_${catId}`} checked={!!q.enabled} onChange={e=>setQ('enabled',e.target.checked)} style={{width:15,height:15,accentColor:cat?.color||'var(--cor)'}}/>
                      <label htmlFor={`q_${catId}`} style={{fontSize:13,fontWeight:700,color:cat?.color||'currentColor',cursor:'pointer'}}>{cat?.name[lang]||catId}</label>
                    </div>
                    {q.enabled&&(
                      <div style={{display:'flex',flexDirection:'column',gap:6,paddingLeft:23}}>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                          {[10,20,30,40,50,60].map(p=>(
                            <button key={p} className={`chip${(q.percent||50)===p?' active':''}`} style={{fontSize:11,padding:'2px 8px'}} onClick={()=>setQ('percent',p)}>{p}%</button>
                          ))}
                        </div>
                        <div style={{display:'flex',gap:8,alignItems:'center'}}>
                          <span style={{fontSize:11,color:'var(--muted)',flexShrink:0}}>{lang==='de'?'Mind.:':'Min.:'}</span>
                          <input type="number" min={1} max={99} value={q.minimum||1} onChange={e=>setQ('minimum',parseInt(e.target.value)||1)} style={{width:50,textAlign:'center',fontSize:12}}/>
                          <span style={{fontSize:11,color:'var(--muted)',flexShrink:0}}>{lang==='de'?'â Stage:':'â Stage:'}</span>
                          <select value={q.targetStage||numSt} onChange={e=>setQ('targetStage',parseInt(e.target.value))} style={{fontSize:12,padding:'3px 6px'}}>
                            {Array.from({length:numSt},(_,i)=>i+1).filter(n=>n>1).map(n=><option key={n} value={n}>Stage {n}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
{step===1&&(
        <div className="section fade-up" style={{flex:1}}>
          {numSt>1&&<StageTabs active={si} onChange={setObsStage}/>}
          {info.mode==='lives'&&(<div style={{background:'rgba(255,255,255,.03)',border:'1px solid var(--border)',borderRadius:12,padding:'10px 12px',marginBottom:8}}>
            <div className="lbl">❤️ Extra Life – Stage {si+1}</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-start',marginTop:6}}>
              <div>
                <div style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>Lives</div>
                <div style={{display:'flex',gap:4}}>{[1,2,3,4,5].map(n=>{const cur=info?.stageExtraLife?.[si+1]?.lives??info.lives??3;return(<button key={n} onClick={()=>setInfo(i=>({...i,stageExtraLife:{...(i.stageExtraLife||{}),[si+1]:{...(i.stageExtraLife?.[si+1]||{}),lives:n}}}))} style={{background:cur===n?'var(--cor)':'var(--card2)',border:'1px solid var(--border)',borderRadius:8,padding:'4px 10px',cursor:'pointer',color:cur===n?'#fff':'var(--text)',fontWeight:cur===n?700:400,fontSize:13,fontFamily:'JetBrains Mono'}}>{n}</button>);})}</div>
              </div>
              <div>
                <div style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>{lang==='de'?'Pro Sektion':'Per section'}</div>
                <input type="checkbox" checked={!!(info?.stageExtraLife?.[si+1]?.livesPerSection)} onChange={e=>setInfo(i=>({...i,stageExtraLife:{...(i.stageExtraLife||{}),[si+1]:{...(i.stageExtraLife?.[si+1]||{}),livesPerSection:e.target.checked}}}))} style={{width:18,height:18,cursor:'pointer'}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>{lang==='de'?'Gesamt-Lives (0=∞)':'Total lives (0=∞)'}</div>
                <input type="number" min={0} max={99} value={info?.stageExtraLife?.[si+1]?.stageTotalLives??0} onChange={e=>setInfo(i=>({...i,stageExtraLife:{...(i.stageExtraLife||{}),[si+1]:{...(i.stageExtraLife?.[si+1]||{}),stageTotalLives:Number(e.target.value)}}}))} style={{width:56,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'4px 8px',color:'var(--text)',fontSize:13,fontFamily:'JetBrains Mono'}}/>
              </div>
            </div>
          </div>)}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div className="lbl">{t('obstacles')} ({curObs.length}){numSt>1&&<span style={{marginLeft:6,color:'var(--muted)',fontWeight:500}}>· Stage {si+1}</span>}</div>
            <div style={{fontSize:11,color:'var(--muted)'}}>{t('sortHint')}</div>
          </div>
          <div style={{maxHeight:310,overflowY:'auto'}}>
            <DragList items={curObs} onReorder={reorderObs} keyFn={o=>o.id} onExternalDrop={(data,pos)=>{const si=Math.min(obsStage,numSt-1);setStageObs(s=>{const n=[...s];const newItem={id:uid(),name:data.trim(),isCP:true,order:pos};const arr=[...n[si]];arr.splice(pos,0,newItem);n[si]=arr.map((o,i)=>({...o,order:i}));return n;});setNewObs('');SFX.click();}}
              renderItem={(o,i)=>o.type==='section'?(
                <div style={{padding:'7px 12px',display:'flex',alignItems:'center',gap:8,background:'rgba(255,200,0,.06)',borderTop:'1px dashed rgba(255,200,0,.3)',borderBottom:'1px dashed rgba(255,200,0,.3)'}}>
                  <div className="drag-handle"><I.Drag s={16}/></div>
                  <div style={{fontSize:11,color:'rgba(255,200,0,.8)',flex:1,fontWeight:700}}>⬛ {o.name||'Start/Landeplattform'}</div>
                  <span style={{fontSize:10,color:'var(--muted)'}}>{lang==='de'?'Leben:':'Lives:'}</span>
                  <input type="number" min={1} max={99} value={o.lives||info.lives||3} onChange={e=>setStageObs(s=>{const n=[...s];n[si]=n[si].map((x,j)=>j===i?{...x,lives:Math.max(1,parseInt(e.target.value)||1)}:x);return n;})} style={{width:44,textAlign:'center',fontSize:12,fontWeight:700,padding:'2px 4px'}}/>
                  <button style={{background:'none',border:'none',cursor:'pointer',padding:4,display:'flex'}} onClick={()=>removeObs(si,o.id)}><I.Trash s={13} c="var(--red)"/></button>
                </div>
              ):(
                <div style={{padding:'9px 12px',display:'flex',alignItems:'center',gap:8}}>
                  <div className="drag-handle"><I.Drag s={16}/></div>
                  <div style={{fontSize:11,color:'var(--muted)',minWidth:18,fontFamily:'JetBrains Mono',textAlign:'center'}}>{i+1}</div>
                  <div style={{flex:1,fontSize:13,fontWeight:500}}>{o.name}</div>
                  <button className={`chip${o.isCP?' active':''}`} style={{padding:'2px 9px',fontSize:10}}
                    onClick={()=>toggleObsCP(si,o.id)}>CP</button>
                  <button style={{background:'none',border:'none',cursor:'pointer',padding:4,display:'flex'}}
                    onClick={()=>removeObs(si,o.id)}><I.Trash s={13} c="var(--red)"/></button>
                </div>
              )}/>
          </div>
          <div style={{fontSize:11,color:'var(--muted)',background:'rgba(255,255,255,.03)',borderRadius:10,padding:'8px 12px'}}>
            💡 {lang==='de'?'Die vorausgefüllten Hindernisse sind nur Vorschläge — jeder Wettkampf speichert seine eigene Liste.':'Pre-filled obstacles are suggestions only — each competition saves its own list.'}
            {numSt>1&&<span> {lang==='de'?'Jede Stage hat eigene Hindernisse.':'Each stage has its own obstacles.'}</span>}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}
            draggable={!!newObs.trim()}
            onDragStart={e=>{if(!e.target.closest('.drag-handle')||!newObs.trim()){e.preventDefault();return;}e.dataTransfer.setData('dnd-obs-ext',newObs.trim());e.dataTransfer.effectAllowed='copy';}}>
            <div className="drag-handle" title={lang==='de'?'Ziehen zum Einfügen an Position':'Drag to insert at position'} style={{opacity:newObs.trim()?1:0.3,cursor:newObs.trim()?'grab':'default'}}><I.Drag s={16}/></div>
            <input value={newObs} onChange={e=>setNewObs(e.target.value)} placeholder={t('obsName')} onKeyDown={e=>{if(e.target.closest('.drag-handle'))return;if(e.key==='Enter')addObs();}} style={{flex:1}}/>
            <button className="btn btn-coral" style={{padding:'10px 16px',flexShrink:0}} onClick={addObs}><I.Plus s={16}/></button>
          </div>
          {info.mode==='lives'&&info?.stageExtraLife?.[si+1]?.livesPerSection&&(<>
            <button className="btn btn-ghost" style={{width:'100%',padding:'8px',fontSize:12,gap:6,borderColor:'rgba(255,200,0,.3)',color:'rgba(255,200,0,.8)'}}
              onClick={()=>setStageObs(s=>{const n=[...s];n[si]=[...n[si],{id:uid(),type:'section',name:'Start/Landeplattform',isCP:true,lives:info.lives||3,order:n[si].length}];return n;})}>
              ⬛ {lang==='de'?'Start/Landeplattform hinzufügen':'Add Start/Landing Platform'}
            </button>
            <div style={{fontSize:10,color:'var(--muted)',marginTop:4,lineHeight:1.4}}>{lang==='de'?'▸ Zwischen Hindernissen einfügen → neue Sektion mit Leben-Auffüllung':'▸ Insert between obstacles → new section with life refill'}</div>
          </>)}
        </div>
      )}

      {step===3&&info.skillPhase?.enabled&&(
        <div className="section fade-up" style={{flex:1}}>
          <div className="lbl" style={{display:'flex',alignItems:'center',gap:6}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="4" r="2"/><path d="M10.5 9l-2.5 5h4l2 4"/><path d="M8.5 21l2-4M14.5 13l2 4-3.5 1.5"/></svg> {lang==='de'?'Skill Phase Konfiguration':'Skill Phase Configuration'}</div>

          {/* Type */}
          <div className="lbl" style={{marginBottom:6}}>{lang==='de'?'Modus':'Mode'}</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {[
              {id:'oldschool',icon:'👥',label:lang==='de'?'Oldschool (Jury)':'Oldschool (Jury)',sub:lang==='de'?'Jury trägt Versuche ein':'Jury records attempts'},
              {id:'boulderstyle',icon:'📱',label:'Boulderstyle',sub:lang==='de'?'Athleten tragen selbst ein':'Athletes self-report via link'}
            ].map(m=>(
              <button key={m.id} onClick={()=>sI('skillPhase',{...(info.skillPhase||{}),type:m.id})}
                style={{flex:1,minWidth:140,padding:'12px',borderRadius:12,border:`1.5px solid ${(info.skillPhase?.type||'oldschool')===m.id?'var(--green)':'var(--border)'}`,background:(info.skillPhase?.type||'oldschool')===m.id?'rgba(52,199,89,.1)':'rgba(255,255,255,.03)',cursor:'pointer',textAlign:'left',transition:'all .15s'}}>
                <div style={{fontSize:20,marginBottom:4}}>{m.icon}</div>
                <div style={{fontSize:13,fontWeight:700,color:(info.skillPhase?.type||'oldschool')===m.id?'var(--green)':'var(--text)'}}>{m.label}</div>
                <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{m.sub}</div>
              </button>
            ))}
          </div>

          {/* Skills list */}
          <div className="lbl" style={{marginTop:12,marginBottom:6}}>{lang==='de'?'Skills / Hindernisse':'Skills / Obstacles'}</div>
          {(info.skillPhase?.skills||[]).map((sk,i)=>{
            const diffColors={easy:'#30D158',medium:'#FF9F0A',hard:'#FF3B30'};
            const diffLabels={easy:lang==='de'?'Leicht':'Easy',medium:lang==='de'?'Mittel':'Medium',hard:lang==='de'?'Schwer':'Hard'};
            const diff=sk.difficulty||'medium';
            return(
            <div key={sk.id} style={{padding:'8px 10px',background:'rgba(255,255,255,.03)',borderRadius:10,marginBottom:4,border:'1px solid var(--border)'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:22,height:22,borderRadius:6,background:'rgba(255,255,255,.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'var(--muted)',flexShrink:0}}>{i+1}</div>
                <input value={sk.name} onChange={e=>sI('skillPhase',{...(info.skillPhase||{}),skills:(info.skillPhase?.skills||[]).map((s,j)=>j===i?{...s,name:e.target.value}:s)})} style={{flex:1,padding:'4px 8px',fontSize:13}} placeholder={`Skill ${i+1}`}/>
                <button style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'var(--red)',display:'flex'}} onClick={()=>sI('skillPhase',{...(info.skillPhase||{}),skills:(info.skillPhase?.skills||[]).filter((_,j)=>j!==i)})}><I.Trash s={14} c="var(--red)"/></button>
              </div>
              <div style={{display:'flex',gap:4,marginTop:6,marginLeft:30}}>
                {['easy','medium','hard'].map(d=>(
                  <button key={d} style={{flex:1,padding:'3px 6px',fontSize:10,fontWeight:700,borderRadius:6,cursor:'pointer',border:`1.5px solid ${diff===d?diffColors[d]+'88':'var(--border)'}`,background:diff===d?diffColors[d]+'1A':'transparent',color:diff===d?diffColors[d]:'var(--muted)',transition:'all .15s'}}
                    onClick={()=>sI('skillPhase',{...(info.skillPhase||{}),skills:(info.skillPhase?.skills||[]).map((s,j)=>j===i?{...s,difficulty:d}:s)})}>{diffLabels[d]}</button>
                ))}
              </div>
            </div>
            );
          })}
          <button className="btn btn-ghost" style={{width:'100%',padding:'8px',fontSize:12,gap:6,marginTop:4}} onClick={()=>sI('skillPhase',{...(info.skillPhase||{}),skills:[...(info.skillPhase?.skills||[]),{id:uid(),name:'',difficulty:'medium'}]})}>
            <I.Plus s={13}/> {lang==='de'?'Skill hinzufügen':'Add skill'}
          </button>
          {(info.skillPhase?.skills||[]).length===0&&<div style={{fontSize:11,color:'var(--muted)',textAlign:'center',marginTop:4,padding:'8px'}}>{lang==='de'?'Mindestens 1 Skill hinzufügen':'Add at least 1 skill'}</div>}

          {/* Timer */}
          <div className="lbl" style={{marginTop:12,marginBottom:6}}><I.Clock s={13}/> {lang==='de'?'Skill Phase Timer (0 = kein Limit)':'Skill Phase Timer (0 = no limit)'}</div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {[0,1,2,3,4,5,6].map(h=>(
              <button key={h} className={`chip${(info.skillPhase?.timerHrs||0)===h?' active':''}`} style={{fontSize:11,padding:'3px 9px',flex:1,justifyContent:'center'}} onClick={()=>sI('skillPhase',{...(info.skillPhase||{}),timerHrs:h})}>
                {h===0?'∞':`${h}h`}
              </button>
            ))}
          </div>

          {/* Seeding — only relevant when stages exist */}
          {(info.numStations||0)>0&&(<>
          <div className="lbl" style={{marginTop:12,marginBottom:6,display:'flex',alignItems:'center',gap:5}}><I.Sort s={13}/> {lang==='de'?'Seeding für Stage':'Seeding for stage'}</div>
          <div style={{display:'flex',gap:8}}>
            {[{id:'inverted',label:lang==='de'?'Invertiert (Schwächster zuerst)':'Inverted (weakest first)'},{id:'manual',label:lang==='de'?'Manuell':'Manual'}].map(s=>(
              <button key={s.id} className={`chip${(info.skillPhase?.seedingMode||'inverted')===s.id?' active':''}`} style={{flex:1,fontSize:11,justifyContent:'center',padding:'5px 8px'}} onClick={()=>sI('skillPhase',{...(info.skillPhase||{}),seedingMode:s.id})}>{s.label}</button>
            ))}
          </div>
          <div style={{fontSize:11,color:'var(--muted)',marginTop:6,padding:'8px 10px',background:'rgba(255,255,255,.03)',borderRadius:8,lineHeight:1.5}}>
            {lang==='de'?'Invertiert: Der Athlet mit der niedrigsten Skill-Gesamtpunktzahl startet als Erster auf dem Stage-Parcours (klassischer Ninja-Wettkampf-Aufbau, maximaler Spannungsaufbau)':'Inverted: Athlete with lowest skill total runs first on stage (classic ninja comp format, maximum suspense)'}
          </div>
          </>)}
        </div>
      )}

      {step===2&&(
        <div className="section fade-up" style={{flex:1}}>
          {numSt>1&&<StageTabs active={asi} onChange={setAthStage}/>}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div className="lbl">{t('athletes')} ({curAths.length}){numSt>1&&<span style={{marginLeft:6,color:'var(--muted)',fontWeight:500}}>· Stage {asi+1}</span>}</div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <div style={{fontSize:11,color:'var(--muted)'}}>{t('sortHint')}</div>
              <label className="btn btn-ghost" style={{padding:'4px 10px',fontSize:11,cursor:'pointer',gap:5}}>
                <I.Upload s={12}/> CSV
                <input type="file" accept=".csv,.txt,.xlsx,.xls" style={{display:'none'}} onChange={e=>{if(e.target.files[0])handleFileImport(asi,e.target.files[0]);e.target.value='';}}/>
              </label>
              <button className="btn btn-ghost" style={{padding:'4px 10px',fontSize:11,gap:5}} onClick={downloadCsvTemplate}><I.FileText s={12}/> {lang==='de'?'Vorlage':'Template'}</button>
            </div>
          </div>
          {csvError&&<div style={{fontSize:12,color:'var(--red)',background:'rgba(255,59,48,.08)',borderRadius:8,padding:'7px 12px'}}>⚠️ {csvError}</div>}
          <div style={{fontSize:11,color:'var(--muted)',background:'rgba(255,255,255,.03)',borderRadius:8,padding:'7px 12px'}}>
            📋 CSV-Format: <code style={{fontSize:10,color:'var(--cor)'}}>Startnr, Name, Kategorie-ID, Geschlecht, Land, Team</code> — {lang==='de'?'Land/Team optional':'Country/Team optional'}
          </div>
          <div style={{maxHeight:230,overflowY:'auto'}}>
            {curAths.length===0?<EmptyState icon={<I.User s={28} c="rgba(255,255,255,.3)"/>} text="Noch keine Athleten"/>:
              <DragList items={curAths} onReorder={arr=>reorderAth(asi,arr)} keyFn={a=>a.id}
                renderItem={(a,i)=>{const cat=IGN_CATS.find(c=>c.id===a.cat);return(
                  <div style={{padding:'8px 12px',display:'flex',alignItems:'center',gap:8}}>
                    <div className="drag-handle"><I.Drag s={15}/></div>
                    <div style={{fontSize:11,color:'var(--cor)',minWidth:16,fontWeight:700}}>{i+1}</div>
                    {a.photo?<img src={a.photo} style={{width:26,height:26,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>:<div style={{width:26,height:26,borderRadius:'50%',background:'rgba(255,255,255,.06)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><I.User s={13} c="rgba(255,255,255,.35)"/></div>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.name}</div>
                      {(a.country||a.team)&&<div style={{fontSize:10,color:'var(--muted)'}}>{[a.country,a.team].filter(Boolean).join(' · ')}</div>}
                    </div>
                    <div style={{fontSize:11,color:'var(--muted)',fontFamily:'JetBrains Mono',flexShrink:0}}>#{a.num}</div>
                    <div style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:`${cat?.color||'#888'}1A`,color:cat?.color||'#888',border:`1px solid ${cat?.color||'#888'}44`,fontWeight:600,whiteSpace:'nowrap',flexShrink:0}}>{cat?.name[lang]||'?'}</div>
                    <button style={{background:'none',border:'none',cursor:'pointer',padding:4,display:'flex',flexShrink:0}} onClick={()=>removeAth(asi,a.id)}><I.Trash s={13} c="var(--red)"/></button>
                  </div>
                );}}/>
            }
          </div>
          <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:14,padding:14,display:'flex',flexDirection:'column',gap:8}}>
            <div style={{display:'flex',gap:8}}>
              <input value={newAth.num} onChange={e=>setNewAth(a=>({...a,num:e.target.value}))} placeholder="#" style={{width:60,flexShrink:0}}/>
              <AutocompleteInput acKey={AC_KEYS.names} value={newAth.name} onChange={e=>setNewAth(a=>({...a,name:e.target.value}))} placeholder={t('athName')} onKeyDown={e=>{if(e.key==='Enter')addAth();}} profileKey='ogn-ac-profiles' onSelectFull={({profile})=>{if(profile?.country)setNewAth(a=>({...a,country:profile.country}));if(profile?.team)setNewAth(a=>({...a,team:profile.team}));if(profile?.gender)setNewAth(a=>({...a,gender:profile.gender}));if(profile?.photo)setNewAth(a=>({...a,photo:profile.photo}));}}/>
            </div>
            <select value={newAth.cat} onChange={e=>setNewAth(a=>({...a,cat:e.target.value}))}>
              {IGN_CATS.map(c=><option key={c.id} value={c.id}>{c.name[lang]||c.name.de}</option>)}
            </select>
            {/* gender removed - encoded in category name */}
            <div style={{display:'flex',gap:8}}>
              <AutocompleteInput acKey={AC_KEYS.countries} value={newAth.country||''} onChange={e=>setNewAth(a=>({...a,country:e.target.value.toUpperCase().slice(0,3)}))} placeholder={lang==='de'?`${toFlag('CH')} Land (CH, AT…)`:`${toFlag('US')} Country (US, DE…)`} style={{flex:1}}/>
              <AutocompleteInput acKey={AC_KEYS.teams} value={newAth.team||''} onChange={e=>setNewAth(a=>({...a,team:e.target.value}))} placeholder={lang==='de'?'Team (optional)':'Team (optional)'} style={{flex:1}}/>
            </div>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'7px 10px',background:'rgba(255,255,255,.03)',borderRadius:10,border:'1px solid var(--border)'}}>
              {newAth.photo
                ?<><img src={newAth.photo} style={{width:28,height:28,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/><span style={{fontSize:12,flex:1}}>{lang==='de'?'Foto ändern ✓':'Change photo ✓'}</span><button style={{background:'rgba(255,59,48,.15)',border:'none',borderRadius:6,padding:'2px 8px',color:'var(--red)',fontSize:11,cursor:'pointer'}} onClick={e=>{e.preventDefault();setNewAth(a=>({...a,photo:null}));}}>{lang==='de'?'Löschen':'Remove'}</button></>
                :<><I.Camera s={17} c="var(--muted)"/><span style={{fontSize:12,flex:1,color:'var(--muted)'}}>{lang==='de'?'Foto hinzufügen (optional)':'Add photo (optional)'}</span></>
              }
              <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{if(e.target.files[0])resizePhoto(e.target.files[0],b64=>setNewAth(a=>({...a,photo:b64})));e.target.value='';}}/>
            </label>
            <button className="btn btn-coral" style={{padding:10,gap:6}} onClick={addAth}><I.Plus s={15}/> {t('addAth')}</button>
          </div>
        </div>
      )}

      <div style={{padding:'0 16px 36px',marginTop:'auto'}}>
        {(()=>{
          const maxSt=info.skillPhase?.enabled?3:2;
          const noStages=(info.numStations||0)===0;
          const nextStep=s=>{
            // skip Obstacles step (step 1) when no stages configured
            if(s===0&&noStages)return 2;
            return s+1;
          };
          return step<maxSt
          ?<button className="btn btn-coral" style={{width:'100%',padding:15,fontSize:15}} disabled={step===0&&!info.name.trim()} onClick={()=>{SFX.click();setStep(s=>nextStep(s));}}>{t('next')} <I.ChevR s={16}/></button>
          :<button className="btn btn-coral" style={{width:'100%',padding:15,fontSize:15}} disabled={saving} onClick={()=>{SFX.click();save();}}>{saving?'Speichern…':<><I.Check s={17}/> {t('finish')}</>}</button>;
        })()}
      </div>
    </div>
  );
};

export { SetupWizard };
