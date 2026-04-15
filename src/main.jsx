import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { LangCtx } from './i18n.js';
import { storage } from './utils.js';
import { HomeView } from './components/HomeView.jsx';
import { CoordinatorView } from './components/CoordinatorView.jsx';
import { JuryApp } from './components/JuryApp.jsx';
import { DisplayView, DisplayNoComp, InstallPrompt, QueueDisplayView, StatsDisplayView, StageRecoveryBanner } from './components/DisplayView.jsx';
import { SkillSelfEntryView } from './components/SkillSelfEntryView.jsx';

const App=()=>{
  const params=new URLSearchParams(window.location.search);
  const modeP=params.get('mode'),compP=params.get('comp'),stP=params.get('station'),stageIdP=params.get('stageId');
  const [lang,setLang]=useState(()=>storage.get('lang','de'));
  const [compId,setCompId]=useState(()=>compP||storage.get('lastCompId',null));
  const [stNum,setStNum]=useState(stP?parseInt(stP,10):1);
  const [stageId,setStageId]=useState(stageIdP||null);
  const [view,setView]=useState(()=>{
    if(modeP==='display')return 'display';if(modeP==='queue')return 'queue';if(modeP==='stats')return 'stats';if(modeP==='skill')return 'skill';
    if(stageIdP&&compP)return 'jury';if(stP&&compP)return 'jury';if(compP)return 'coordinator';
    // Restore last view on refresh (if no URL params)
    const lastView=storage.get('lastView',null);const lastComp=storage.get('lastCompId',null);
    if(lastComp&&lastView&&lastView!=='home')return lastView;
    return 'home';
  });
  const [prevView,setPrevView]=useState('coordinator');
  useEffect(()=>storage.set('lang',lang),[lang]);
  // Persist current comp + view to localStorage for refresh recovery
  useEffect(()=>{if(compId)storage.set('lastCompId',compId);},[compId]);
  useEffect(()=>{storage.set('lastView',view);},[view]);
  const openComp=id=>{setCompId(id);setView('coordinator');};
  const openStage=(n,sid=null)=>{setStNum(typeof n==='number'?n:1);setStageId(sid);setView('jury');};
  return(
    <LangCtx.Provider value={lang}>
      {view==='home'&&<HomeView onOpen={openComp} lang={lang} setLang={setLang}/>}
      {view==='coordinator'&&compId&&<CoordinatorView compId={compId} onBack={()=>{setView('home');setCompId(null);}} onStage={(n,sid)=>{setPrevView('coordinator');openStage(n,sid);}} lang={lang} setLang={setLang}/>}
      {view==='coordinator'&&compId&&<StageRecoveryBanner compId={compId} lang={lang} onJoin={n=>{setPrevView('coordinator');if(typeof n==='number'){setStageId(null);setStNum(n);}else{setStageId(n);setStNum(1);}setView('jury');}}/>}
      {view==='jury'&&compId&&<JuryApp compId={compId} stNum={stNum} stageId={stageId} onBack={()=>setView(prevView)}/>}
      {view==='display'&&compId&&<DisplayView compId={compId} onBack={()=>setCompId(null)} onOpenJury={n=>{setPrevView('display');setStNum(n);setView('jury');}} onBackToCoordinator={prevView==='coordinator'?()=>{setView('coordinator');}:null}/>}
      {view==='display'&&!compId&&<DisplayNoComp onSelect={id=>{setCompId(id);setView('display');}}/>}
      {view==='queue'&&compId&&<QueueDisplayView compId={compId} onBack={null}/>}
      {view==='queue'&&!compId&&<DisplayNoComp onSelect={id=>{setCompId(id);setView('queue');}}/>}
      {view==='stats'&&compId&&<StatsDisplayView compId={compId} onBack={null}/>}
      {view==='stats'&&!compId&&<DisplayNoComp onSelect={id=>{setCompId(id);setView('stats');}}/>}
      {view==='skill'&&compId&&<SkillSelfEntryView compId={compId}/>}
      {view==='skill'&&!compId&&<DisplayNoComp onSelect={id=>{setCompId(id);setView('skill');}}/>}
      {/* Install prompt — only shows on mobile, dismissable, "not again" saves to localStorage */}
      <InstallPrompt lang={lang}/>
    </LangCtx.Provider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
