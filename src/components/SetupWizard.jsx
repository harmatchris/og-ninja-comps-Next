import React, { useState, useEffect, useRef } from 'react';
import { useLang } from '../i18n.js';
import { IGN_CATS, MODES, DEF_OBS, STAGE_LETTERS, db, fbSet } from '../config.js';
import { uid, today, storage, toFlag, AC_KEYS, acSave, acProfileSave, resizePhotoUtil, resizeLogoUtil } from '../utils.js';
import { SFX } from '../hooks.js';
import { I } from '../icons.jsx';
import { AutocompleteInput, TopBar, EmptyState, DragList, TimePicker } from './shared.jsx';

/* ── colour palette for main-stage frames ── */
const FRAME_COLORS=['#FF5E3A','#5E9CFF','#34C759','#FF9F0A','#BF5AF2','#FF375F','#30D158','#64D2FF'];

const SetupWizard=({onDone,onBack,existingId=null,initialInfo=null,initialStages=null,initialObstacles=null,initialAthletes=null,initialPipelineData=null})=>{
  const {t,lang}=useLang();
  const [step,setStep]=useState(0);

  /* ── info state ── */
  const [info,setInfo]=useState(initialInfo||{
    name:'',date:today(),location:'',
    modes:[],
    mode:'classic',
    pipelineEnabled:true,
    pipeline:[],
    numStations:0,
    lives:3,timeLimit:0,
    stageLimits:{},stageLivesOverrides:{},livesPerSection:false,stageTotalLives:0,stageExtraLife:{},
    emoji:'',logo:null,
    qualification:{},
    chRankingEnabled:false,chRankingFinale:false,
    skillPhase:{enabled:false,type:'oldschool',skills:[],timerMin:0,seedingMode:'inverted',skillCategories:'all'}
  });

  /* ── migrate old data ── */
  useEffect(()=>{
    if(initialInfo&&!initialInfo.modes){
      const m=[];
      if(initialInfo.skillPhase?.enabled)m.push('skill');
      if(initialInfo.mode==='classic'||!initialInfo.mode)m.push('classic');
      if(initialInfo.mode==='lives')m.push('lives');
      sI('modes',m.length?m:['classic']);
    }
  },[]);

  const [stageObs,setStageObs]=useState(()=>{
    const pipeStages=initialInfo?.pipeline||[];
    return Array.from({length:8},(_,i)=>{
      // Pipeline mode: load per-stage obstacles from pipelineData
      const pStage=pipeStages[i];
      if(pStage&&initialPipelineData?.[pStage.id]?.obstacles){
        return Object.values(initialPipelineData[pStage.id].obstacles).sort((a,b)=>a.order-b.order);
      }
      // Legacy mode
      if(initialStages?.[i+1]?.obstacles)return Object.values(initialStages[i+1].obstacles).sort((a,b)=>a.order-b.order);
      // Fallback: global obstacles for first stage
      if(initialObstacles&&i===0)return Object.values(initialObstacles).sort((a,b)=>a.order-b.order);
      return DEF_OBS.map(o=>({...o,id:uid()}));
    });
  });
  const [stageAths,setStageAths]=useState(()=>{
    return Array.from({length:8},(_,i)=>{
      if(initialStages?.[i+1]?.athletes)return Object.values(initialStages[i+1].athletes);
      if(initialAthletes&&i===0)return Object.values(initialAthletes);
      return [];
    });
  });

  const [obsStage,setObsStage]=useState(0);
  const [athStage,setAthStage]=useState(0);
  const [newObs,setNewObs]=useState('');
  const [newAth,setNewAth]=useState({name:'',num:'1',cat:'am1',gender:'m',country:'',team:'',photo:null,stageNum:1});
  const [saving,setSaving]=useState(false);
  const [csvError,setCsvError]=useState('');
  const [showEmojiPicker,setShowEmojiPicker]=useState(false);
  const sI=(k,v)=>setInfo(i=>({...i,[k]:v}));

  /* ── CH Ranking ── */
  const [chRankingUnlocked,setChRankingUnlocked]=useState(!!(initialInfo?.chRankingEnabled));
  const [chRankingPwPrompt,setChRankingPwPrompt]=useState(false);
  const [chRankingPwInput,setChRankingPwInput]=useState('');
  const CH_RANKING_PW='2021';
  const tryUnlock=()=>{if(chRankingPwInput===CH_RANKING_PW){setChRankingUnlocked(true);setChRankingPwPrompt(false);setChRankingPwInput('');}else{setChRankingPwInput('');alert(lang==='de'?'Falsches Passwort':'Wrong password');}};

  /* ── derived ── */
  const modes=info.modes||[];
  const hasSkill=modes.includes('skill');
  const hasClassic=modes.includes('classic');
  const hasLives=modes.includes('lives');
  const hasAnyStage=hasClassic||hasLives;
  const pipeline=info.pipeline||[];
  const numSt=pipeline.length;
  const catsWithAths=[...new Set((stageAths||[]).flat().map(a=>a.cat))];

  /* ── step flow ── */
  const steps=[];
  steps.push('info');
  if(hasSkill)steps.push('skills');
  if(hasAnyStage)steps.push('stages');
  steps.push('athletes');
  const maxStep=steps.length-1;
  const stepLabel={info:'Setup',skills:'Skills',stages:t('obstacles'),athletes:t('athletes')};

  const resizePhoto=resizePhotoUtil;

  /* ── obstacle helpers ── */
  const si=Math.min(obsStage,Math.max(numSt-1,0));
  const curObs=stageObs[si]||[];
  const addObs=()=>{
    if(!newObs.trim())return;
    const idx=Math.min(obsStage,Math.max(numSt-1,0));
    setStageObs(s=>{const n=[...s];n[idx]=[...n[idx],{id:uid(),name:newObs.trim(),isCP:true,order:n[idx].length}];return n;});
    setNewObs('');SFX.click();
  };
  const reorderObs=arr=>{
    const idx=Math.min(obsStage,Math.max(numSt-1,0));
    setStageObs(s=>{const n=[...s];n[idx]=arr.map((o,i)=>({...o,order:i}));return n;});
  };
  const removeObs=(idx,id)=>{setStageObs(s=>{const n=[...s];n[idx]=n[idx].filter(o=>o.id!==id);return n;});};
  const toggleObsCP=(idx,id)=>{setStageObs(s=>{const n=[...s];n[idx]=n[idx].map(o=>o.id===id?{...o,isCP:!o.isCP}:o);return n;});};

  /* ── athlete helpers ── */
  const asi=Math.min(athStage,Math.max(numSt-1,0));
  const curAths=stageAths[asi]||[];
  const addAth=()=>{
    if(!newAth.name.trim())return;
    const idx=Math.min(athStage,Math.max(numSt-1,0));
    const stageNum=idx+1;
    setStageAths(a=>{const n=[...a];n[idx]=[...n[idx],{id:uid(),...newAth,stageNum}];return n;});
    acSave(AC_KEYS.names,newAth.name);
    if(newAth.team)acSave(AC_KEYS.teams,newAth.team);
    if(newAth.country)acSave(AC_KEYS.countries,newAth.country);
    acProfileSave(newAth.name,{country:newAth.country||'',photo:newAth.photo||null});
    setNewAth(a=>({...a,name:'',num:String((stageAths[idx]||[]).length+2)}));
    SFX.click();
  };
  const removeAth=(idx,id)=>{setStageAths(a=>{const n=[...a];n[idx]=n[idx].filter(x=>x.id!==id);return n;});};
  const reorderAth=(idx,arr)=>{setStageAths(a=>{const na=[...a];na[idx]=arr;return na;});};

  /* ── CSV import ── */
  const normalizeGender=raw=>{const g=(raw||'').trim().toLowerCase();if(['m','male'].includes(g))return 'm';if(['w','f','female'].includes(g))return 'w';if(['d','div','diverse'].includes(g))return 'd';return 'm';};
  const importCSV=(idx,text)=>{
    setCsvError('');
    const lines=text.trim().split(/\r?\n/).filter(l=>l.trim());
    const start=(lines[0]&&isNaN(lines[0].split(/[,;\t]/)[0].trim()))?1:0;
    const results=[];
    for(const line of lines.slice(start)){
      const parts=line.split(/[,;\t]/).map(s=>s.trim().replace(/^["']|["']$/g,''));
      if(parts.length<2){setCsvError(`Ungültige Zeile: ${line}`);return;}
      const [num,name,catRaw='',genderRaw='',countryRaw='',teamRaw='']=parts;
      const catLow=catRaw.toLowerCase();
      const cat=IGN_CATS.find(c=>c.id===catLow||c.name.de.toLowerCase().includes(catLow)||c.name.en.toLowerCase().includes(catLow))||IGN_CATS[9];
      results.push({id:uid(),num:num||String(results.length+1),name,cat:cat.id,gender:normalizeGender(genderRaw),country:countryRaw.trim(),team:teamRaw.trim(),stageNum:idx+1});
    }
    if(!results.length){setCsvError('Keine Athleten gefunden');return;}
    setStageAths(a=>{const n=[...a];n[idx]=[...n[idx],...results];return n;});
    SFX.complete();alert(`${results.length} Athleten importiert`);
  };
  const downloadCsvTemplate=()=>{const rows=['Startnr,Name,Kategorie-ID,Geschlecht,Land,Team','1,Max Muster,am1,M,CH,','2,Laura Beispiel,aw1,W,AT,Team Ninja'];const blob=new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='athleten-vorlage.csv';a.click();URL.revokeObjectURL(url);SFX.click();};
  const handleFileImport=(idx,file)=>{if(!file)return;const r=new FileReader();r.onload=e=>{try{importCSV(idx,e.target.result);}catch(err){setCsvError(err.message);}};r.readAsText(file);};

  const generateTestData=()=>{
    const TEST_NAMES_M=['Liam','Noah','Leon','Elias','Luca','Finn','Jonas','Julian','Matteo','Samuel','Ben','David','Nico','Felix','Alexander','Maximilian','Lukas','Gabriel','Rafael','Tim','Jannik','Marcel','Tobias','Florian','Stefan','Dominik','Patrick','Simon','Fabian','Marco'];
    const TEST_NAMES_F=['Mia','Emma','Lina','Lea','Elena','Anna','Sophie','Laura','Lara','Nina','Sarah','Julia','Lisa','Valentina','Alina','Amelie','Jana','Leonie','Nora','Paula','Marie','Kathrin','Sandra','Daniela','Andrea','Monika','Nicole','Sabine','Claudia','Martina'];
    const TEAMS_CH=['Zürich Ninjas','Bern Warriors','Basel Climbers','Luzern Force','Ninja Park Zürich','Ninja Factory Basel','Gravity CH','Swiss Ninja Team'];
    const TEAMS_DE=['Berlin Ninjas','München Runners','Hamburg Force','Ninja Warriors DE','Köln Climbers','Frankfurt Ninjas'];
    const TEAMS_AT=['Wien Ninjas','Graz Warriors','Salzburg Force'];
    const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
    const si=asi;const stageNum=si+1;const newAths=[];let num=(stageAths[si]||[]).length+1;
    // Respect stage's selected categories: only generate test athletes for cats that will actually run this stage
    const stageCfg=flatStages[si];
    const stageCats=stageCfg?.categories;
    const allowedCatIds=(!stageCats||stageCats==='all'||(Array.isArray(stageCats)&&stageCats.length===0))
      ?IGN_CATS.map(c=>c.id)
      :(Array.isArray(stageCats)?stageCats:[]);
    const allowedSet=new Set(allowedCatIds);
    IGN_CATS.filter(c=>allowedSet.has(c.id)).forEach(cat=>{
      const isFemale=cat.id.includes('w');
      const names=isFemale?TEST_NAMES_F:TEST_NAMES_M;
      for(let i=0;i<20;i++){
        const rnd=Math.random();let country,team;
        if(rnd<0.70){country='CH';team=pick(TEAMS_CH);}
        else if(rnd<0.95){country='DE';team=pick(TEAMS_DE);}
        else{country='AT';team=pick(TEAMS_AT);}
        newAths.push({id:uid(),name:pick(names)+' '+(Math.floor(Math.random()*90)+10),num:String(num++),cat:cat.id,gender:isFemale?'f':'m',country,team,photo:null,stageNum});
      }
    });
    setStageAths(a=>{const n=[...a];n[si]=[...n[si],...newAths];return n;});
    SFX.complete();
  };

  /* ── divisions used by main stages ── */
  const getDivsUsedByOtherMains=(excludeId)=>{
    const used=new Set();
    pipeline.filter(s=>s.isMain&&s.id!==excludeId).forEach(s=>{
      if(s.categories==='all')IGN_CATS.forEach(c=>used.add(c.id));
      else(s.categories||[]).forEach(c=>used.add(c));
    });
    return used;
  };

  /* ── stage helpers ── */
  const addMainStage=()=>{
    const pl=info.pipeline||[];
    const letter=STAGE_LETTERS[pl.filter(s=>s.isMain).length]||`S${pl.length+1}`;
    const defaultMode=hasLives?'lives':'classic';
    sI('pipeline',[...pl,{id:uid(),name:`Main Stage ${letter}`,mode:defaultMode,categories:[],isMain:true,continuations:[],qualiPercent:50,minPerDivision:3,order:pl.length,timeLimit:0}]);
    SFX.click();
  };
  const addContinuation=(mainId)=>{
    const pl=[...(info.pipeline||[])];
    const mainIdx=pl.findIndex(s=>s.id===mainId);
    if(mainIdx<0)return;
    const main=pl[mainIdx];
    const contCount=(main.continuations||[]).length;
    const contId=uid();
    const cont={id:contId,name:`${main.name} – Runde ${contCount+2}`,mode:main.mode,qualiPercent:50,minPerDivision:3,timeLimit:0,isMain:false};
    pl[mainIdx]={...main,continuations:[...(main.continuations||[]),cont]};
    sI('pipeline',pl);
    SFX.click();
  };
  const updateStage=(stageId,key,val)=>{
    sI('pipeline',(info.pipeline||[]).map(s=>{
      if(s.id===stageId)return{...s,[key]:val};
      if(s.continuations?.length){
        const newConts=s.continuations.map(c=>c.id===stageId?{...c,[key]:val}:c);
        if(newConts!==s.continuations)return{...s,continuations:newConts};
      }
      return s;
    }));
  };
  const removeStage=(stageId)=>{
    const pl=(info.pipeline||[]).filter(s=>s.id!==stageId).map(s=>({
      ...s,continuations:(s.continuations||[]).filter(c=>c.id!==stageId)
    }));
    sI('pipeline',pl);SFX.click();
  };

  /* ── get flat list of all stages for obs/ath indexing ── */
  const flatStages=[];
  pipeline.forEach(s=>{flatStages.push(s);(s.continuations||[]).forEach(c=>flatStages.push(c));});

  /* ── StageTabs ── */
  const StageTabs=({active,onChange})=>(
    <div style={{display:'flex',gap:4,overflowX:'auto',padding:'0 0 6px'}}>
      {flatStages.map((s,i)=>(
        <button key={s.id} className={`chip${active===i?' active':''}`}
          style={{flexShrink:0,padding:'4px 12px',fontSize:11}}
          onClick={()=>{onChange(i);SFX.hover();}}>
          {s.name||`Stage ${i+1}`}
        </button>
      ))}
    </div>
  );

  /* ── save ── */
  const save=async()=>{
    if(!info.name.trim())return;setSaving(true);
    const id=existingId||uid();
    const primaryMode=hasLives?'lives':'classic';
    const stagesData={};
    flatStages.forEach((stg,i)=>{
      const om={};(stageObs[i]||[]).forEach((o,idx)=>{om[o.id]={...o,order:idx};});
      const am={};(stageAths[i]||[]).forEach(a=>{am[a.id]=a;});
      stagesData[stg.id]={obstacles:om,athletes:Object.keys(am).length?am:null};
    });
    const om0={};(stageObs[0]||[]).forEach((o,i)=>{om0[o.id]={...o,order:i};});
    const am0={};flatStages.forEach((_,i)=>{(stageAths[i]||[]).forEach(a=>{am0[a.id]=a;});});
    const finalInfo={...info,mode:primaryMode,numStations:hasAnyStage?0:0,pipelineEnabled:hasAnyStage,skillPhase:{...(info.skillPhase||{}),enabled:hasSkill},createdAt:info.createdAt||Date.now()};
    const data={info:finalInfo,obstacles:om0,athletes:Object.keys(am0).length?am0:null,stages:stagesData};
    if(hasAnyStage&&pipeline.length>0){
      const pipelineData={};
      flatStages.forEach((stg,i)=>{
        const stgObs={};(stageObs[i]||[]).forEach((o,idx)=>{stgObs[o.id]={...o,order:idx};});
        // Filter athletes by stage's allowed categories — "all"/empty = everyone, array = only those cats
        const stgCats=stg.categories;
        const allowAll=!stgCats||stgCats==='all'||(Array.isArray(stgCats)&&stgCats.length===0);
        const allowedStgSet=allowAll?null:new Set(Array.isArray(stgCats)?stgCats:[]);
        const stgAths={};(stageAths[i]||[]).forEach(a=>{if(allowAll||allowedStgSet.has(a.cat))stgAths[a.id]=a;});
        pipelineData[stg.id]={...stg,order:i,obstacles:Object.keys(stgObs).length?stgObs:null,athletes:Object.keys(stgAths).length?stgAths:null};
      });
      data.pipeline=pipelineData;
    }
    try{
      if(existingId){
        // Existing comp: merge-update only config fields, preserve completedRuns/activeRuns/skillScores
        const updates={};
        updates[`ogn/${id}/info`]=data.info;
        updates[`ogn/${id}/obstacles`]=data.obstacles;
        // Always write athletes (even if empty from stageAths, use global initialAthletes as fallback)
        const athToWrite=data.athletes||(initialAthletes?{...initialAthletes}:null);
        if(athToWrite)updates[`ogn/${id}/athletes`]=athToWrite;
        if(data.pipeline){
          // Merge pipeline: preserve existing athletes/closed state, update config
          Object.entries(data.pipeline).forEach(([sid,stg])=>{
            updates[`ogn/${id}/pipeline/${sid}/name`]=stg.name||null;
            updates[`ogn/${id}/pipeline/${sid}/categories`]=stg.categories||'all';
            updates[`ogn/${id}/pipeline/${sid}/order`]=stg.order;
            updates[`ogn/${id}/pipeline/${sid}/mode`]=stg.mode||null;
            updates[`ogn/${id}/pipeline/${sid}/qualiPercent`]=stg.qualiPercent||0;
            if(stg.obstacles)updates[`ogn/${id}/pipeline/${sid}/obstacles`]=stg.obstacles;
            updates[`ogn/${id}/pipeline/${sid}/isMain`]=stg.isMain||null;
            updates[`ogn/${id}/pipeline/${sid}/predecessorStages`]=stg.predecessorStages||null;
            updates[`ogn/${id}/pipeline/${sid}/continuations`]=stg.continuations||null;
            updates[`ogn/${id}/pipeline/${sid}/timeLimit`]=stg.timeLimit||null;
            updates[`ogn/${id}/pipeline/${sid}/lives`]=stg.livesPerSection||null;
            updates[`ogn/${id}/pipeline/${sid}/totalLives`]=stg.totalLives??null;
          });
        }
        await db.ref().update(updates);
      }else{
        await fbSet(`ogn/${id}`,data);
      }
      setSaving(false);SFX.complete();onDone(id);
    }catch(err){
      console.error('Save error:',err);
      setSaving(false);
      window.alert((lang==='de'?'Fehler beim Speichern: ':'Save error: ')+err.message);
    }
  };

  /* ── shared styles ── */
  const chipStyle=(active,color)=>({
    padding:'6px 14px',fontSize:12,fontWeight:600,borderRadius:10,cursor:'pointer',
    border:`1.5px solid ${active?(color||'var(--cor)'):'var(--border)'}`,
    background:active?`${color||'var(--cor)'}18`:'rgba(255,255,255,.03)',
    color:active?(color||'var(--cor)'):'var(--text)',transition:'all .15s',
    display:'inline-flex',alignItems:'center',gap:6
  });
  const cardStyle={background:'rgba(255,255,255,.03)',borderRadius:12,padding:'12px 14px',border:'1px solid var(--border)'};
  const lblStyle={fontSize:12,fontWeight:700,color:'var(--muted)',marginBottom:6,letterSpacing:'.03em'};
  const fancyBtnStyle=(bg='linear-gradient(135deg,var(--cor),var(--cor2))',shadow='rgba(255,94,58,.3)')=>({
    width:'100%',padding:'13px 16px',fontSize:14,fontWeight:700,borderRadius:14,border:'none',
    background:bg,color:'#fff',cursor:'pointer',
    display:'flex',alignItems:'center',justifyContent:'center',gap:8,
    boxShadow:`0 4px 18px ${shadow}`,transition:'all .18s ease',
    position:'relative',overflow:'hidden'
  });

  /* ──────────── RENDER ──────────── */
  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <TopBar title={stepLabel[steps[step]]||'Setup'} logo={false}
        onBack={step===0?onBack:()=>setStep(s=>s-1)}
        right={<div style={{fontSize:12,color:'var(--muted)',fontWeight:700}}>{step+1}/{steps.length}</div>}/>
      {/* progress bar */}
      <div style={{display:'flex',gap:3,padding:'10px 16px',background:'rgba(255,255,255,.02)',borderBottom:'1px solid var(--border)'}}>
        {steps.map((_,i)=><div key={i} style={{flex:1,height:3,borderRadius:2,background:i<=step?'var(--cor)':'var(--border)',transition:'background .3s'}}/>)}
      </div>

      {/* ─────── STEP 0: INFO + MODES ─────── */}
      {steps[step]==='info'&&(
        <div className="section fade-up" style={{flex:1}}>
          {/* Logo + Emoji */}
          <div style={lblStyle}>Logo / Emoji</div>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
            <label style={{cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',width:56,height:56,borderRadius:12,border:`2px dashed ${info.logo?'rgba(255,94,58,.5)':'var(--border)'}`,background:info.logo?'transparent':'rgba(255,255,255,.03)',overflow:'hidden',flexShrink:0,position:'relative'}}>
              {info.logo?<img src={info.logo} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<><I.Camera s={18} c="var(--muted)"/><span style={{fontSize:7,color:'var(--muted)',marginTop:1}}>LOGO</span></>}
              <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{if(e.target.files[0])resizeLogoUtil(e.target.files[0],b64=>sI('logo',b64));e.target.value='';}}/>
            </label>
            {/* Emoji button (popup trigger) – #2 */}
            <button onClick={()=>setShowEmojiPicker(!showEmojiPicker)} style={{width:44,height:44,borderRadius:10,border:'1.5px solid var(--border)',background:info.emoji?'rgba(255,94,58,.1)':'rgba(255,255,255,.03)',cursor:'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}>
              {info.emoji||''}
            </button>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text)'}}>{lang==='de'?'Logo oder Emoji':'Logo or Emoji'}</div>
              <div style={{fontSize:9,color:'var(--muted)',lineHeight:1.4}}>{lang==='de'?'Optional – wird auf Displays angezeigt':'Optional – shown on displays'}</div>
              {info.logo&&<button style={{marginTop:3,fontSize:9,color:'var(--red)',background:'rgba(255,59,48,.12)',border:'none',borderRadius:6,padding:'2px 7px',cursor:'pointer'}} onClick={()=>sI('logo',null)}>{lang==='de'?'Entfernen':'Remove'}</button>}
            </div>
          </div>
          {/* Emoji popup – #2 */}
          {showEmojiPicker&&(
            <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowEmojiPicker(false)}>
              <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:18,padding:20,maxWidth:300}} onClick={e=>e.stopPropagation()}>
                <div style={{fontSize:14,fontWeight:700,marginBottom:12,textAlign:'center'}}>{lang==='de'?'Emoji wählen':'Pick Emoji'}</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:5,justifyContent:'center'}}>
                  {['🥷','🏆','🥇','⚡','🔥','💪','🎯','🦊','🐉','🌟','🏅','🎪','🦁','👑','⚔️','🎭','🚀','🥈','🛡️','⛰️'].map(e=>(
                    <button key={e} onClick={()=>{sI('emoji',e);setShowEmojiPicker(false);SFX.click();}} style={{width:42,height:42,fontSize:22,borderRadius:10,border:`2px solid ${info.emoji===e?'var(--cor)':'transparent'}`,background:info.emoji===e?'rgba(255,94,58,.18)':'rgba(255,255,255,.05)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s'}}>{e}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Name */}
          <div style={lblStyle}>{t('compName')}</div>
          <input value={info.name} onChange={e=>sI('name',e.target.value)} placeholder="Ninja Cup 2026" autoFocus/>

          {/* Date + Location – #3 compact date, clear separation */}
          <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
            <div style={{flex:'0 0 120px'}}>
              <div style={lblStyle}>{t('compDate')}</div>
              <input type="date" value={info.date} onChange={e=>sI('date',e.target.value)} style={{width:'100%',padding:'8px 6px',fontSize:12}}/>
            </div>
            <div style={{width:1,height:36,background:'var(--border)',flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={lblStyle}>{t('compLocation')}</div>
              <input value={info.location} onChange={e=>sI('location',e.target.value)} placeholder="Zurich Ninja Park" style={{width:'100%'}}/>
            </div>
          </div>

          {/* ── MODE SELECTION (multi-select) – #4 Skill Phase at mode ── */}
          <div style={lblStyle}>{lang==='de'?'Wettkampf-Modus':'Competition Mode'}</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {/* Skill Phase */}
            <button onClick={()=>{const m=[...(info.modes||[])];const idx=m.indexOf('skill');idx>=0?m.splice(idx,1):m.push('skill');sI('modes',m);sI('skillPhase',{...(info.skillPhase||{}),enabled:m.includes('skill')});SFX.hover();}}
              style={{...chipStyle(hasSkill,'#34C759'),padding:'12px 16px',width:'100%',justifyContent:'flex-start',borderRadius:14}}>
              <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${hasSkill?'#34C759':'var(--border)'}`,background:hasSkill?'#34C759':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .15s'}}>
                {hasSkill&&<span style={{color:'#000',fontSize:14,fontWeight:900,lineHeight:1}}>✓</span>}
              </div>
              <div style={{textAlign:'left'}}>
                <div style={{fontWeight:700}}>Skill Phase</div>
                <div style={{fontSize:10,opacity:.7,marginTop:1}}>{lang==='de'?'Vorqualifikation mit Skills':'Pre-qualification with skills'}</div>
              </div>
            </button>
            {/* Skill sub-options – #4 inline after mode */}
            {hasSkill&&(
              <div style={{marginLeft:28,display:'flex',flexDirection:'column',gap:8,paddingBottom:4}}>
                <div style={{display:'flex',gap:6}}>
                  {[{id:'oldschool',icon:'',lbl:lang==='de'?'Oldschool (Jury)':'Oldschool (Jury)'},{id:'boulderstyle',icon:'',lbl:'Boulderstyle'}].map(m=>(
                    <button key={m.id} onClick={()=>{sI('skillPhase',{...(info.skillPhase||{}),type:m.id});SFX.hover();}}
                      style={{...chipStyle((info.skillPhase?.type||'oldschool')===m.id,'#34C759'),flex:1,justifyContent:'center',padding:'8px 10px'}}>
                      <span>{m.icon}</span> {m.lbl}
                    </button>
                  ))}
                </div>
                {/* Skill divisions – #4 which divisions */}
                <div style={{fontSize:11,fontWeight:600,color:'var(--muted)'}}>{lang==='de'?'Welche Divisionen bei Skills?':'Which divisions for skills?'}</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                  <button style={chipStyle(!(info.skillPhase?.skillCategories)||info.skillPhase?.skillCategories==='all','#34C759')} onClick={()=>sI('skillPhase',{...(info.skillPhase||{}),skillCategories:'all'})}>
                    {lang==='de'?'Alle':'All'}
                  </button>
                  {IGN_CATS.map(cat=>{
                    const sel=Array.isArray(info.skillPhase?.skillCategories)&&info.skillPhase.skillCategories.includes(cat.id);
                    return <button key={cat.id} style={{...chipStyle(sel,cat.color),fontSize:10,padding:'3px 8px'}} onClick={()=>{
                      const cur=Array.isArray(info.skillPhase?.skillCategories)?info.skillPhase.skillCategories:[];
                      const next=sel?cur.filter(c=>c!==cat.id):[...cur,cat.id];
                      sI('skillPhase',{...(info.skillPhase||{}),skillCategories:next.length?next:'all'});
                    }}>{cat.name[lang]}</button>;
                  })}
                </div>
              </div>
            )}
            {/* Classic */}
            <button onClick={()=>{const m=[...(info.modes||[])];const idx=m.indexOf('classic');idx>=0?m.splice(idx,1):m.push('classic');sI('modes',m);SFX.hover();}}
              style={{...chipStyle(hasClassic,'#FF5E3A'),padding:'12px 16px',width:'100%',justifyContent:'flex-start',borderRadius:14}}>
              <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${hasClassic?'#FF5E3A':'var(--border)'}`,background:hasClassic?'#FF5E3A':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .15s'}}>
                {hasClassic&&<span style={{color:'#fff',fontSize:14,fontWeight:900,lineHeight:1}}>✓</span>}
              </div>
              <div style={{textAlign:'left'}}>
                <div style={{fontWeight:700}}>Classic Stage</div>
                <div style={{fontSize:10,opacity:.7,marginTop:1}}>{lang==='de'?'Klassischer Ninja Parcours':'Classic ninja course'}</div>
              </div>
            </button>
            {/* Extra Life */}
            <button onClick={()=>{const m=[...(info.modes||[])];const idx=m.indexOf('lives');idx>=0?m.splice(idx,1):m.push('lives');sI('modes',m);SFX.hover();}}
              style={{...chipStyle(hasLives,'#FFD60A'),padding:'12px 16px',width:'100%',justifyContent:'flex-start',borderRadius:14}}>
              <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${hasLives?'#FFD60A':'var(--border)'}`,background:hasLives?'#FFD60A':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .15s'}}>
                {hasLives&&<span style={{color:'#000',fontSize:14,fontWeight:900,lineHeight:1}}>✓</span>}
              </div>
              <div style={{textAlign:'left'}}>
                <div style={{fontWeight:700}}>Extra Life Stage</div>
                <div style={{fontSize:10,opacity:.7,marginTop:1}}>{lang==='de'?'Parcours mit Lebenssystem':'Course with lives system'}</div>
              </div>
            </button>
          </div>
          {!modes.length&&<div style={{fontSize:11,color:'var(--red)',marginTop:4,textAlign:'center'}}>{lang==='de'?'Mindestens einen Modus auswählen':'Select at least one mode'}</div>}

          {/* CH Ranking */}
          <div style={{marginTop:14,background:'rgba(200,168,75,.07)',border:`1px solid ${chRankingUnlocked&&info.chRankingEnabled?'rgba(200,168,75,.5)':'rgba(200,168,75,.2)'}`,borderRadius:12,padding:'12px 14px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <svg viewBox="0 0 32 32" width="28" height="28" style={{borderRadius:'50%',flexShrink:0,display:'block'}}><circle cx="16" cy="16" r="16" fill="#FF0000"/><rect x="13" y="7" width="6" height="18" fill="#FFFFFF"/><rect x="7" y="13" width="18" height="6" fill="#FFFFFF"/></svg>
                <div><div style={{fontSize:13,fontWeight:700,color:'#C8A84B'}}>CH Ninja Ranking</div><div style={{fontSize:10,color:'var(--muted)',marginTop:1}}>{lang==='de'?'Offizielle Schweizer Meisterschaft':'Official Swiss Championship'}</div></div>
              </div>
              {!chRankingUnlocked?<button onClick={()=>setChRankingPwPrompt(true)} style={{fontSize:11,fontWeight:700,color:'#C8A84B',background:'rgba(200,168,75,.15)',border:'1px solid rgba(200,168,75,.3)',borderRadius:8,padding:'5px 12px',cursor:'pointer'}}>🔓 Freischalten</button>
              :<button onClick={()=>{setChRankingUnlocked(false);sI('chRankingEnabled',false);}} style={{fontSize:11,color:'var(--muted)',background:'transparent',border:'1px solid var(--border)',borderRadius:8,padding:'5px 12px',cursor:'pointer'}}>🔒 Sperren</button>}
            </div>
            {chRankingUnlocked&&<div style={{marginTop:8}}><label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13}}><input type="checkbox" checked={!!info.chRankingEnabled} onChange={e=>sI('chRankingEnabled',e.target.checked)} style={{accentColor:'#C8A84B',width:16,height:16}}/>{lang==='de'?'Ergebnisse fliessen ins CH Ranking ein':'Results count towards CH Ranking'}</label>
              {info.chRankingEnabled&&<label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,paddingLeft:24,marginTop:6}}><input type="checkbox" checked={!!info.chRankingFinale} onChange={e=>sI('chRankingFinale',e.target.checked)} style={{accentColor:'#C8A84B',width:16,height:16}}/>{lang==='de'?'Finale (doppelte Punkte)':'Finale (double points)'}</label>}
            </div>}
            {chRankingPwPrompt&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget){setChRankingPwPrompt(false);setChRankingPwInput('');}}}>
              <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:24,width:280,display:'flex',flexDirection:'column',gap:12}}>
                <div style={{fontSize:15,fontWeight:700,color:'#C8A84B',textAlign:'center'}}>CH Freischalten</div>
                <input autoFocus type="password" value={chRankingPwInput} onChange={e=>setChRankingPwInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&tryUnlock()} placeholder="Passwort" style={{padding:'10px 14px',borderRadius:10}}/>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>{setChRankingPwPrompt(false);setChRankingPwInput('');}} style={{flex:1,padding:9,borderRadius:10,border:'1px solid var(--border)',background:'transparent',color:'var(--muted)',cursor:'pointer',fontSize:13}}>{lang==='de'?'Abbrechen':'Cancel'}</button>
                  <button onClick={tryUnlock} style={{flex:1,padding:9,borderRadius:10,border:'none',background:'#C8A84B',color:'#000',fontWeight:700,cursor:'pointer',fontSize:13}}>OK</button>
                </div>
              </div>
            </div>}
          </div>
        </div>
      )}

      {/* ─────── STEP: SKILLS CONFIG – #5 ─────── */}
      {steps[step]==='skills'&&(
        <div className="section fade-up" style={{flex:1}}>
          <div style={lblStyle}>{lang==='de'?'Skills / Hindernisse':'Skills / Obstacles'}</div>
          {(info.skillPhase?.skills||[]).map((sk,i)=>{
            const diffColors={easy:'#30D158',medium:'#FF9F0A',hard:'#FF3B30'};
            const diffLabels={easy:lang==='de'?'Leicht':'Easy',medium:lang==='de'?'Mittel':'Medium',hard:lang==='de'?'Schwer':'Hard'};
            const diff=sk.difficulty||'medium';
            return(
              <div key={sk.id} style={{padding:'10px 12px',background:'rgba(255,255,255,.03)',borderRadius:12,marginBottom:6,border:'1px solid var(--border)'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:24,height:24,borderRadius:7,background:'rgba(255,255,255,.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'var(--muted)',flexShrink:0}}>{i+1}</div>
                  <input value={sk.name} onChange={e=>sI('skillPhase',{...(info.skillPhase||{}),skills:(info.skillPhase?.skills||[]).map((s,j)=>j===i?{...s,name:e.target.value}:s)})} style={{flex:1,padding:'6px 10px',fontSize:14}} placeholder={`Skill ${i+1}`}/>
                  <button style={{background:'none',border:'none',cursor:'pointer',padding:4}} onClick={()=>sI('skillPhase',{...(info.skillPhase||{}),skills:(info.skillPhase?.skills||[]).filter((_,j)=>j!==i)})}><I.Trash s={14} c="var(--red)"/></button>
                </div>
                <div style={{display:'flex',gap:4,marginTop:6,marginLeft:32}}>
                  {['easy','medium','hard'].map(d=>(
                    <button key={d} style={{flex:1,padding:'5px 8px',fontSize:11,fontWeight:700,borderRadius:8,cursor:'pointer',border:`1.5px solid ${diff===d?diffColors[d]+'88':'var(--border)'}`,background:diff===d?diffColors[d]+'1A':'transparent',color:diff===d?diffColors[d]:'var(--muted)',transition:'all .15s'}}
                      onClick={()=>sI('skillPhase',{...(info.skillPhase||{}),skills:(info.skillPhase?.skills||[]).map((s,j)=>j===i?{...s,difficulty:d}:s)})}>{diffLabels[d]}</button>
                  ))}
                </div>
              </div>
            );
          })}
          <button style={{...fancyBtnStyle('rgba(255,255,255,.06)','transparent'),border:'1.5px dashed var(--border)',color:'var(--text)',boxShadow:'none',fontSize:13}} onClick={()=>sI('skillPhase',{...(info.skillPhase||{}),skills:[...(info.skillPhase?.skills||[]),{id:uid(),name:'',difficulty:'medium'}]})}>
            <I.Plus s={14}/> {lang==='de'?'Skill hinzufügen':'Add skill'}
          </button>
          {(info.skillPhase?.skills||[]).length===0&&<div style={{fontSize:12,color:'var(--muted)',textAlign:'center',marginTop:6,padding:10}}>{lang==='de'?'Mindestens 1 Skill hinzufügen':'Add at least 1 skill'}</div>}

          {/* Timer */}
          <div style={{...lblStyle,marginTop:16}}><I.Clock s={13}/> Timer (0 = {lang==='de'?'kein Limit':'no limit'})</div>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {[0,5,10,15,20,30,45,60,90,120,180,240,300,360].map(m=>(
              <button key={m} style={chipStyle((info.skillPhase?.timerMin||0)===m)} onClick={()=>sI('skillPhase',{...(info.skillPhase||{}),timerMin:m})}>
                {m===0?'∞':m<60?`${m}m`:`${Math.floor(m/60)}h${m%60?m%60+'m':''}`}
              </button>
            ))}
          </div>

          {/* Seeding */}
          {hasAnyStage&&(<>
            <div style={{...lblStyle,marginTop:16}}>{lang==='de'?'Seeding für Stage':'Seeding for stage'}</div>
            <div style={{display:'flex',gap:6}}>
              {[{id:'inverted',lbl:lang==='de'?'Invertiert':'Inverted'},{id:'manual',lbl:lang==='de'?'Manuell':'Manual'}].map(s=>(
                <button key={s.id} style={{...chipStyle((info.skillPhase?.seedingMode||'inverted')===s.id),flex:1,justifyContent:'center'}} onClick={()=>sI('skillPhase',{...(info.skillPhase||{}),seedingMode:s.id})}>{s.lbl}</button>
              ))}
            </div>
          </>)}
        </div>
      )}

      {/* ─────── STEP: STAGES (builder + obstacles) – #6 only stagebuilder ─────── */}
      {steps[step]==='stages'&&(
        <div className="section fade-up" style={{flex:1}}>
          {/* Main stage groups – #12 visually separated */}
          {pipeline.map((mainStg,mi)=>{
            if(!mainStg.isMain)return null;
            const frameColor=FRAME_COLORS[mi%FRAME_COLORS.length];
            const usedByOthers=getDivsUsedByOtherMains(mainStg.id);
            const flatIdx=flatStages.findIndex(s=>s.id===mainStg.id);
            const stgMode=mainStg.mode||(hasLives?'lives':'classic');
            return(
              <div key={mainStg.id} style={{borderRadius:16,border:`2px solid ${frameColor}44`,background:`${frameColor}08`,padding:14,marginBottom:16}}>
                {/* Main stage header */}
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                  <div style={{width:30,height:30,borderRadius:9,background:`${frameColor}22`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:14,color:frameColor,flexShrink:0}}>{STAGE_LETTERS[mi]||mi+1}</div>
                  <input value={mainStg.name} onChange={e=>updateStage(mainStg.id,'name',e.target.value)} style={{flex:1,padding:'6px 10px',fontSize:14,fontWeight:700}} placeholder="Stage Name"/>
                  <button style={{background:'none',border:'none',cursor:'pointer',padding:4}} onClick={()=>removeStage(mainStg.id)}><I.Trash s={14} c="var(--red)"/></button>
                </div>

                {/* Mode per stage */}
                <div style={{display:'flex',gap:4,marginBottom:8}}>
                  {(hasClassic?[{id:'classic',lbl:'Classic'}]:[]).concat(hasLives?[{id:'lives',lbl:'Extra Life'}]:[]).concat(!hasClassic&&!hasLives?[{id:'classic',lbl:'Classic'},{id:'lives',lbl:'Extra Life'}]:[]).map(m=>(
                    <button key={m.id} style={{...chipStyle(stgMode===m.id,frameColor),flex:1,justifyContent:'center',fontSize:11}} onClick={()=>updateStage(mainStg.id,'mode',m.id)}>{m.lbl}</button>
                  ))}
                </div>

                {/* Divisions – #11 exclusive, #14 all divisions always selectable */}
                <div style={{fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:4}}>{lang==='de'?'Divisionen':'Divisions'}</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:8}}>
                  {IGN_CATS.map(cat=>{
                    const sel=(mainStg.categories||[]).includes(cat.id);
                    const shared=usedByOthers.has(cat.id);
                    return <button key={cat.id} style={{...chipStyle(sel,cat.color),fontSize:9,padding:'3px 7px'}} onClick={()=>{
                      const cur=mainStg.categories||[];
                      updateStage(mainStg.id,'categories',sel?cur.filter(c=>c!==cat.id):[...cur,cat.id]);
                    }}>{cat.name[lang]}{shared&&sel?' ⇆':''}</button>;
                  })}
                </div>

                {/* Time limit (10s steps) – #7 */}
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
                  <div>
                    <div style={{fontSize:10,color:'var(--muted)',marginBottom:3}}>⏱ Time Limit</div>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <button style={{width:30,height:30,borderRadius:8,border:'1px solid var(--border)',background:'rgba(255,255,255,.05)',cursor:'pointer',color:'var(--text)',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s'}} onClick={()=>updateStage(mainStg.id,'timeLimit',Math.max(0,(mainStg.timeLimit||0)-10))}>−</button>
                      <div style={{fontFamily:'JetBrains Mono',fontSize:14,fontWeight:700,minWidth:50,textAlign:'center'}}>{Math.floor((mainStg.timeLimit||0)/60)}:{String((mainStg.timeLimit||0)%60).padStart(2,'0')}</div>
                      <button style={{width:30,height:30,borderRadius:8,border:'1px solid var(--border)',background:'rgba(255,255,255,.05)',cursor:'pointer',color:'var(--text)',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s'}} onClick={()=>updateStage(mainStg.id,'timeLimit',(mainStg.timeLimit||0)+10)}>+</button>
                    </div>
                  </div>
                  {/* Quali % – #8 starts at 50, 1% steps – only shown when multiple stages */}
                  {pipeline.filter(s=>s.isMain).length>1&&<div>
                    <div style={{fontSize:10,color:'var(--muted)',marginBottom:3}}>Quali %</div>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <button style={{width:30,height:30,borderRadius:8,border:'1px solid var(--border)',background:'rgba(255,255,255,.05)',cursor:'pointer',color:'var(--text)',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s'}} onClick={()=>updateStage(mainStg.id,'qualiPercent',Math.max(0,(mainStg.qualiPercent||50)-1))}>−</button>
                      <input type="number" min={0} max={100} value={mainStg.qualiPercent??50} onChange={e=>updateStage(mainStg.id,'qualiPercent',Math.min(100,Math.max(0,Number(e.target.value)||0)))} style={{width:48,textAlign:'center',fontSize:13,fontWeight:700,padding:'4px 2px',fontFamily:'JetBrains Mono'}}/>
                      <button style={{width:30,height:30,borderRadius:8,border:'1px solid var(--border)',background:'rgba(255,255,255,.05)',cursor:'pointer',color:'var(--text)',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s'}} onClick={()=>updateStage(mainStg.id,'qualiPercent',Math.min(100,(mainStg.qualiPercent||50)+1))}>+</button>
                      <span style={{fontSize:10,color:'var(--muted)'}}>%</span>
                    </div>
                  </div>}
                </div>

                {/* Extra Life config – #9 lives per section 1-5, total to infinity */}
                {stgMode==='lives'&&(
                  <div style={{...cardStyle,marginBottom:8}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#FFD60A',marginBottom:6}}>Extra Life</div>
                    <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                      <div>
                        <div style={{fontSize:10,color:'var(--muted)',marginBottom:3,display:'flex',alignItems:'center',gap:6}}>
                          <span>{lang==='de'?'Sektions-Leben':'Section lives'}</span>
                          <button onClick={()=>updateStage(mainStg.id,'livesPerSection',(mainStg.livesPerSection||0)>0?0:3)} style={{padding:'2px 8px',borderRadius:10,border:`1px solid ${(mainStg.livesPerSection||0)>0?'rgba(255,214,10,.5)':'var(--border)'}`,background:(mainStg.livesPerSection||0)>0?'rgba(255,214,10,.15)':'rgba(255,255,255,.03)',color:(mainStg.livesPerSection||0)>0?'#FFD60A':'var(--muted)',fontSize:9,fontWeight:700,cursor:'pointer'}}>{(mainStg.livesPerSection||0)>0?(lang==='de'?'AN':'ON'):(lang==='de'?'AUS':'OFF')}</button>
                        </div>
                        {(mainStg.livesPerSection||0)>0&&<div style={{display:'flex',gap:3}}>{[1,2,3,4,5].map(n=><button key={n} onClick={()=>updateStage(mainStg.id,'livesPerSection',n)} style={{width:32,height:32,borderRadius:8,border:`1.5px solid ${(mainStg.livesPerSection||3)===n?'#FFD60A':'var(--border)'}`,background:(mainStg.livesPerSection||3)===n?'rgba(255,214,10,.15)':'rgba(255,255,255,.03)',color:(mainStg.livesPerSection||3)===n?'#FFD60A':'var(--text)',fontWeight:700,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s'}}>{n}</button>)}</div>}
                      </div>
                      <div>
                        <div style={{fontSize:10,color:'var(--muted)',marginBottom:3}}>{lang==='de'?'Gesamt-Leben (0=∞)':'Total lives (0=∞)'}</div>
                        <div style={{display:'flex',alignItems:'center',gap:4}}>
                          <button style={{width:30,height:30,borderRadius:8,border:'1px solid var(--border)',background:'rgba(255,255,255,.05)',cursor:'pointer',color:'var(--text)',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s'}} onClick={()=>updateStage(mainStg.id,'totalLives',Math.max(0,(mainStg.totalLives??0)-1))}>−</button>
                          <input type="number" min={0} max={999} value={mainStg.totalLives??0} onChange={e=>updateStage(mainStg.id,'totalLives',Math.max(0,Number(e.target.value)||0))} style={{width:52,textAlign:'center',fontSize:14,fontWeight:700,padding:'6px',fontFamily:'JetBrains Mono'}}/>
                          <button style={{width:30,height:30,borderRadius:8,border:'1px solid var(--border)',background:'rgba(255,255,255,.05)',cursor:'pointer',color:'var(--text)',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s'}} onClick={()=>updateStage(mainStg.id,'totalLives',(mainStg.totalLives??0)+1)}>+</button>
                          <button style={{padding:'4px 10px',borderRadius:8,border:'1px solid rgba(255,214,10,.3)',background:(mainStg.totalLives===0||!mainStg.totalLives)?'rgba(255,214,10,.15)':'transparent',color:'#FFD60A',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all .12s'}} onClick={()=>updateStage(mainStg.id,'totalLives',0)}>∞</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Obstacles for this main stage */}
                {flatIdx>=0&&(<>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--muted)',marginBottom:4}}>{lang==='de'?'Hindernisse':'Obstacles'} ({(stageObs[flatIdx]||[]).length})</div>
                  <div style={{maxHeight:180,overflowY:'auto',marginBottom:6}}>
                    <DragList items={stageObs[flatIdx]||[]} onReorder={arr=>{setStageObs(s=>{const n=[...s];n[flatIdx]=arr.map((o,i)=>({...o,order:i}));return n;});}} keyFn={o=>o.id}
                      renderItem={(o,i)=>(
                        <div style={{padding:'7px 10px',display:'flex',alignItems:'center',gap:6}}>
                          <div className="drag-handle"><I.Drag s={14}/></div>
                          <div style={{fontSize:10,color:'var(--muted)',minWidth:16,fontFamily:'JetBrains Mono'}}>{i+1}</div>
                          <div style={{flex:1,fontSize:12,fontWeight:500}}>{o.name}</div>
                          <button className={`chip${o.isCP?' active':''}`} style={{padding:'1px 7px',fontSize:9}} onClick={()=>{setStageObs(s=>{const n=[...s];n[flatIdx]=n[flatIdx].map(x=>x.id===o.id?{...x,isCP:!x.isCP}:x);return n;});}}>CP</button>
                          <button style={{background:'none',border:'none',cursor:'pointer',padding:3}} onClick={()=>{setStageObs(s=>{const n=[...s];n[flatIdx]=n[flatIdx].filter(x=>x.id!==o.id);return n;});}}><I.Trash s={12} c="var(--red)"/></button>
                        </div>
                      )}/>
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <input value={obsStage===flatIdx?newObs:''} onChange={e=>{setObsStage(flatIdx);setNewObs(e.target.value);}} onFocus={()=>setObsStage(flatIdx)} placeholder={lang==='de'?'Hindernis...':'Obstacle...'} onKeyDown={e=>{if(e.key==='Enter'&&newObs.trim()){setStageObs(s=>{const n=[...s];n[flatIdx]=[...n[flatIdx],{id:uid(),name:newObs.trim(),isCP:true,order:n[flatIdx].length}];return n;});setNewObs('');SFX.click();}}} style={{flex:1,fontSize:12,padding:'8px 10px'}}/>
                    <button style={{padding:'8px 14px',borderRadius:10,border:'none',background:'linear-gradient(135deg,var(--cor),var(--cor2))',color:'#fff',cursor:'pointer',fontWeight:700,fontSize:14,boxShadow:'0 2px 8px rgba(255,94,58,.3)',transition:'all .12s'}} onClick={()=>{if(!newObs.trim())return;setStageObs(s=>{const n=[...s];n[flatIdx]=[...n[flatIdx],{id:uid(),name:newObs.trim(),isCP:true,order:n[flatIdx].length}];return n;});setNewObs('');SFX.click();}}><I.Plus s={14}/></button>
                  </div>
                  {/* #6 Section-flag quick-add: Platform marker (life refill section boundary) */}
                  <div style={{marginTop:6}}>
                    <button style={{width:'100%',padding:'8px 12px',borderRadius:10,border:'1px dashed rgba(52,199,89,.4)',background:'rgba(52,199,89,.06)',color:'var(--green)',cursor:'pointer',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:7}} onClick={()=>{setStageObs(s=>{const n=[...s];n[flatIdx]=[...n[flatIdx],{id:uid(),name:'Platform',type:'section',isCP:false,order:n[flatIdx].length,restTime:10}];return n;});SFX.click();}}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="16" width="20" height="4" rx="1.5"/><path d="M12 4v8M8 8l4-4 4 4"/></svg>
                      {lang==='de'?'+ Platform (Sektionsgrenze)':'+ Platform (section boundary)'}
                    </button>
                  </div>
                </>)}

                {/* Continuations – #11, #13 */}
                {(mainStg.continuations||[]).map((cont,ci)=>{
                  const contFlatIdx=flatStages.findIndex(s=>s.id===cont.id);
                  return(
                    <div key={cont.id} style={{marginTop:10,paddingTop:10,borderTop:`1px dashed ${frameColor}44`}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                        <span style={{fontSize:11,color:frameColor,fontWeight:700}}>↳ Runde {ci+2}</span>
                        <input value={cont.name} onChange={e=>updateStage(cont.id,'name',e.target.value)} style={{flex:1,padding:'4px 8px',fontSize:12}} placeholder={`Runde ${ci+2}`}/>
                        <button style={{background:'none',border:'none',cursor:'pointer',padding:3}} onClick={()=>removeStage(cont.id)}><I.Trash s={12} c="var(--red)"/></button>
                      </div>
                      {/* Quali – #13 */}
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <div style={{fontSize:10,color:'var(--muted)'}}>Quali:</div>
                        <div style={{display:'flex',alignItems:'center',gap:3}}>
                          <button style={{width:26,height:26,borderRadius:6,border:'1px solid var(--border)',background:'rgba(255,255,255,.05)',cursor:'pointer',color:'var(--text)',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s'}} onClick={()=>updateStage(cont.id,'qualiPercent',Math.max(1,(cont.qualiPercent||50)-1))}>−</button>
                          <input type="number" min={1} max={100} value={cont.qualiPercent||50} onChange={e=>updateStage(cont.id,'qualiPercent',Math.min(100,Math.max(1,Number(e.target.value)||1)))} style={{width:42,textAlign:'center',fontSize:12,fontWeight:700,padding:'3px',fontFamily:'JetBrains Mono'}}/>
                          <button style={{width:26,height:26,borderRadius:6,border:'1px solid var(--border)',background:'rgba(255,255,255,.05)',cursor:'pointer',color:'var(--text)',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s'}} onClick={()=>updateStage(cont.id,'qualiPercent',Math.min(100,(cont.qualiPercent||50)+1))}>+</button>
                          <span style={{fontSize:10,color:'var(--muted)'}}>% (min 3/Div)</span>
                        </div>
                      </div>
                      {/* Time limit for continuation – #7 */}
                      <div style={{display:'flex',alignItems:'center',gap:4,marginTop:6}}>
                        <span style={{fontSize:10,color:'var(--muted)'}}>⏱</span>
                        <button style={{width:26,height:26,borderRadius:6,border:'1px solid var(--border)',background:'rgba(255,255,255,.05)',cursor:'pointer',color:'var(--text)',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s'}} onClick={()=>updateStage(cont.id,'timeLimit',Math.max(0,(cont.timeLimit||0)-10))}>−</button>
                        <span style={{fontFamily:'JetBrains Mono',fontSize:12,fontWeight:700,minWidth:40,textAlign:'center'}}>{Math.floor((cont.timeLimit||0)/60)}:{String((cont.timeLimit||0)%60).padStart(2,'0')}</span>
                        <button style={{width:26,height:26,borderRadius:6,border:'1px solid var(--border)',background:'rgba(255,255,255,.05)',cursor:'pointer',color:'var(--text)',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s'}} onClick={()=>updateStage(cont.id,'timeLimit',(cont.timeLimit||0)+10)}>+</button>
                      </div>
                      {/* Obstacles for continuation */}
                      {contFlatIdx>=0&&(<>
                        <div style={{fontSize:10,color:'var(--muted)',marginTop:6}}>{lang==='de'?'Hindernisse':'Obstacles'} ({(stageObs[contFlatIdx]||[]).length})</div>
                        <div style={{maxHeight:120,overflowY:'auto'}}>
                          <DragList items={stageObs[contFlatIdx]||[]} onReorder={arr=>{setStageObs(s=>{const n=[...s];n[contFlatIdx]=arr.map((o,i)=>({...o,order:i}));return n;});}} keyFn={o=>o.id}
                            renderItem={(o,i)=>(
                              <div style={{padding:'5px 8px',display:'flex',alignItems:'center',gap:5,fontSize:11}}>
                                <div className="drag-handle"><I.Drag s={12}/></div>
                                <div style={{flex:1}}>{o.name}</div>
                                <button style={{background:'none',border:'none',cursor:'pointer',padding:2}} onClick={()=>{setStageObs(s=>{const n=[...s];n[contFlatIdx]=n[contFlatIdx].filter(x=>x.id!==o.id);return n;});}}><I.Trash s={11} c="var(--red)"/></button>
                              </div>
                            )}/>
                        </div>
                      </>)}
                    </div>
                  );
                })}
                {/* Add continuation button – #11 */}
                {(mainStg.categories||[]).length>0&&(
                  <button onClick={()=>addContinuation(mainStg.id)} style={{width:'100%',marginTop:10,padding:'8px',fontSize:12,fontWeight:600,borderRadius:10,border:`1.5px dashed ${frameColor}66`,background:'transparent',color:frameColor,cursor:'pointer',transition:'all .15s',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                    <I.Plus s={12}/> {lang==='de'?'+ Fortsetzung hinzufügen (zweite Stage...)':'+ Add continuation (second stage...)'}
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Main Stage button – #10 renamed */}
          <button onClick={addMainStage} style={fancyBtnStyle()}>
            <I.Plus s={16}/> {lang==='de'?'Main Stage hinzufügen':'Add Main Stage'}
          </button>
          {pipeline.filter(s=>s.isMain).length===0&&<div style={{fontSize:12,color:'var(--muted)',textAlign:'center',marginTop:8}}>{lang==='de'?'Mindestens eine Stage hinzufügen':'Add at least one stage'}</div>}
        </div>
      )}

      {/* ─────── STEP: ATHLETES ─────── */}
      {steps[step]==='athletes'&&(
        <div className="section fade-up" style={{flex:1}}>
          {flatStages.length>1&&<StageTabs active={asi} onChange={setAthStage}/>}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={lblStyle}>{t('athletes')} ({curAths.length}){flatStages.length>1&&<span style={{marginLeft:6,fontWeight:500}}>· {flatStages[asi]?.name||'Stage'}</span>}</div>
            <div style={{display:'flex',gap:6}}>
              <label className="btn btn-ghost" style={{padding:'4px 10px',fontSize:11,cursor:'pointer',gap:4}}>
                <I.Upload s={12}/> CSV
                <input type="file" accept=".csv,.txt" style={{display:'none'}} onChange={e=>{if(e.target.files[0])handleFileImport(asi,e.target.files[0]);e.target.value='';}}/>
              </label>
              <button className="btn btn-ghost" style={{padding:'4px 10px',fontSize:11,gap:4}} onClick={downloadCsvTemplate}><I.FileText s={12}/> {lang==='de'?'Vorlage':'Template'}</button>
              <button className="btn btn-ghost" style={{padding:'4px 10px',fontSize:11,gap:5,borderColor:'rgba(52,199,89,.3)',color:'rgba(52,199,89,.8)'}} onClick={()=>{if(window.confirm(lang==='de'?'20 Test-Athleten pro Division generieren?\n(70% CH, 25% DE, 5% AT)':'Generate 20 test athletes per division?\n(70% CH, 25% DE, 5% AT)'))generateTestData();}}><I.Plus s={12}/> Test</button>
            </div>
          </div>
          {csvError&&<div style={{fontSize:12,color:'var(--red)',background:'rgba(255,59,48,.08)',borderRadius:8,padding:'7px 12px'}}>⚠️ {csvError}</div>}
          <div style={{maxHeight:260,overflowY:'auto'}}>
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
                    <div style={{fontSize:10,padding:'2px 6px',borderRadius:8,background:`${cat?.color||'#888'}1A`,color:cat?.color||'#888',border:`1px solid ${cat?.color||'#888'}44`,fontWeight:600,flexShrink:0}}>{cat?.name[lang]||'?'}</div>
                    <button style={{background:'none',border:'none',cursor:'pointer',padding:4,flexShrink:0}} onClick={()=>removeAth(asi,a.id)}><I.Trash s={13} c="var(--red)"/></button>
                  </div>
                );}}/>
            }
          </div>
          <div style={{...cardStyle,display:'flex',flexDirection:'column',gap:8}}>
            <div style={{display:'flex',gap:8}}>
              <input value={newAth.num} onChange={e=>setNewAth(a=>({...a,num:e.target.value}))} placeholder="#" style={{width:55,flexShrink:0}}/>
              <AutocompleteInput acKey={AC_KEYS.names} value={newAth.name} onChange={e=>setNewAth(a=>({...a,name:e.target.value}))} placeholder={t('athName')} onKeyDown={e=>{if(e.key==='Enter')addAth();}} profileKey='ogn-ac-profiles' onSelectFull={({profile})=>{if(profile?.country)setNewAth(a=>({...a,country:profile.country}));if(profile?.team)setNewAth(a=>({...a,team:profile.team}));if(profile?.photo)setNewAth(a=>({...a,photo:profile.photo}));}}/>
            </div>
            <select value={newAth.cat} onChange={e=>setNewAth(a=>({...a,cat:e.target.value}))}>
              {IGN_CATS.map(c=><option key={c.id} value={c.id}>{c.name[lang]||c.name.de}</option>)}
            </select>
            <div style={{display:'flex',gap:8}}>
              <AutocompleteInput acKey={AC_KEYS.countries} value={newAth.country||''} onChange={e=>setNewAth(a=>({...a,country:e.target.value.toUpperCase().slice(0,3)}))} placeholder={`${toFlag('CH')} Land`} style={{flex:1}}/>
              <AutocompleteInput acKey={AC_KEYS.teams} value={newAth.team||''} onChange={e=>setNewAth(a=>({...a,team:e.target.value}))} placeholder="Team" style={{flex:1}}/>
            </div>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'7px 10px',background:'rgba(255,255,255,.03)',borderRadius:10,border:'1px solid var(--border)'}}>
              {newAth.photo
                ?<><img src={newAth.photo} style={{width:28,height:28,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/><span style={{fontSize:12,flex:1}}>Foto ✓</span><button style={{background:'rgba(255,59,48,.15)',border:'none',borderRadius:6,padding:'2px 8px',color:'var(--red)',fontSize:11,cursor:'pointer'}} onClick={e=>{e.preventDefault();setNewAth(a=>({...a,photo:null}));}}>✕</button></>
                :<><I.Camera s={17} c="var(--muted)"/><span style={{fontSize:12,flex:1,color:'var(--muted)'}}>Foto (optional)</span></>
              }
              <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{if(e.target.files[0])resizePhoto(e.target.files[0],b64=>setNewAth(a=>({...a,photo:b64})));e.target.value='';}}/>
            </label>
            <button style={fancyBtnStyle()} onClick={addAth}><I.Plus s={15}/> {t('addAth')}</button>
          </div>
        </div>
      )}

      {/* ─────── BOTTOM NAV – #15 fancy buttons ─────── */}
      <div style={{padding:'0 16px 36px',marginTop:'auto'}}>
        {step<maxStep
          ?<button style={{...fancyBtnStyle(),padding:15,fontSize:15,opacity:step===0&&(!info.name.trim()||!modes.length)?.5:1}} disabled={step===0&&(!info.name.trim()||!modes.length)} onClick={()=>{SFX.click();setStep(s=>s+1);}}>{t('next')} <I.ChevR s={16}/></button>
          :<button style={{...fancyBtnStyle('linear-gradient(135deg,#34C759,#30B852)','rgba(52,199,89,.3)'),padding:15,fontSize:15}} disabled={saving} onClick={()=>{SFX.click();save();}}>{saving?'Speichern…':<><I.Check s={17}/> {t('finish')}</>}</button>
        }
      </div>
    </div>
  );
};

export { SetupWizard };
