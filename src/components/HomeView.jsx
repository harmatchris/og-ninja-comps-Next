import React, { useState } from 'react';
import { useLang, LangCtx } from '../i18n.js';
import { fbRemove, fbSet } from '../config.js';
import { useFbVal, SFX } from '../hooks.js';
import { isUnlocked, uid } from '../utils.js';
import { I } from '../icons.jsx';
import { Spinner, EmptyState, TopBar, CompEmoji } from './shared.jsx';
import { SetupWizard } from './SetupWizard.jsx';
import { PasswordModal } from './PasswordModal.jsx';
import { Regelwerk } from './ResultsView.jsx';

const HomeView=({onOpen,lang,setLang})=>{
  const {t}=useLang();
  const comps=useFbVal('ogn');
  const [creating,setCreating]=useState(false);
  const [showRulebook,setShowRulebook]=useState(false);
  const [pendingComp,setPendingComp]=useState(null); // Comp wartet auf Passwort
  const [query,setQuery]=useState('');
  const [dupBusy,setDupBusy]=useState(null); // id of comp currently being duplicated
  const [toast,setToast]=useState('');
  // Klick auf Karte: schon entsperrt → direkt öffnen, sonst Passwort-Gate
  const tryOpen=(c)=>{ if(isUnlocked(c.id,c)){onOpen(c.id);} else {setPendingComp(c);} };
  // Wettkampf duplizieren: struktureller Kopie ohne Läufe/Live-State, "(Kopie)" am Namen
  const duplicate=async(c)=>{
    const baseName=c.info?.name||'Wettkampf';
    if(!window.confirm(lang==='de'?`"${baseName}" als Kopie duplizieren?\n\nAthleten, Hindernisse und Stages werden übernommen — Läufe und Live-Daten nicht.`:`Duplicate "${baseName}" as copy?\n\nAthletes, obstacles and stages are copied — runs and live data are not.`))return;
    SFX.click?.();
    setDupBusy(c.id);
    try{
      const newId=uid();
      // Stages: closed-Flag + runtime-Felder entfernen (Frischstart)
      const cleanStages={};
      Object.entries(c.stages||{}).forEach(([k,v])=>{
        if(!v||typeof v!=='object')return;
        const {closed,...rest}=v;
        cleanStages[k]=rest;
      });
      // Pipeline: closed + runtime-Felder entfernen; Athleten aus cleanStages wiederherstellen
      // (qualifizierte Athleten aus Folge-Stages werden bewusst geleert → Frischstart)
      const cleanPipeline={};
      Object.entries(c.pipeline||{}).forEach(([k,v])=>{
        if(!v||typeof v!=='object'||v.name==null)return;
        // Nur Konfig-Felder übernehmen, alle Runtime-Felder entfernen
        const {closed,athletes:_qualAths,completedAthletes:_ca,...rest}=v;
        // Athleten aus stages-Daten wiederherstellen (entspricht dem initialen Setup-Zustand)
        const initialAthletes=(cleanStages[k]?.athletes)||null;
        cleanPipeline[k]={...rest,athletes:initialAthletes};
      });
      const data={
        info:{...(c.info||{}),name:`${baseName} (Kopie)`,createdAt:Date.now()},
        obstacles:c.obstacles||null,
        athletes:c.athletes||null,
        stages:Object.keys(cleanStages).length?cleanStages:null,
      };
      if(Object.keys(cleanPipeline).length)data.pipeline=cleanPipeline;
      // completedRuns, activeRuns, stations, skillScores, skillPhaseStatus werden bewusst NICHT übernommen
      await fbSet(`ogn/${newId}`,data);
      SFX.complete?.();
      setToast(lang==='de'?`Kopie "${baseName} (Kopie)" erstellt`:`Copy "${baseName} (Kopie)" created`);
      setTimeout(()=>setToast(''),2800);
    }catch(e){
      SFX.fall?.();
      setToast(lang==='de'?`Fehler beim Duplizieren: ${e?.message||e}`:`Duplicate failed: ${e?.message||e}`);
      setTimeout(()=>setToast(''),3500);
    }finally{
      setDupBusy(null);
    }
  };
  if(creating)return<SetupWizard onDone={id=>{setCreating(false);onOpen(id);}} onBack={()=>setCreating(false)}/>;
  if(showRulebook)return<div style={{minHeight:'100vh'}}><TopBar title={t('rulebook')} onBack={()=>{SFX.click();setShowRulebook(false)}} right={<button className="btn btn-ghost" style={{padding:'5px 11px',fontSize:12,fontWeight:700}} onClick={()=>setLang(lang==='de'?'en':'de')}>{t('lang')}</button>}/><LangCtx.Provider value={lang}><Regelwerk/></LangCtx.Provider></div>;
  const list=comps?Object.entries(comps).map(([id,v])=>({id,...v})).sort((a,b)=>(b.info?.createdAt||0)-(a.info?.createdAt||0)):[];
  const q=query.trim().toLowerCase();
  const filtered=q?list.filter(c=>(c.info?.name||'').toLowerCase().includes(q)||(c.info?.location||'').toLowerCase().includes(q)||c.id.toLowerCase().includes(q)):list;
  return(
    <div style={{minHeight:'100vh'}}>
      {/* #1 â Compact single-line header */}
      <TopBar title={null}
        right={<div style={{display:'flex',gap:6}}>
          <button className="btn btn-ghost" style={{padding:'5px 11px',fontSize:12,fontWeight:700}} onClick={()=>setLang(lang==='de'?'en':'de')}>{t('lang')}</button>
          <button className="btn btn-ghost" style={{padding:'7px'}} onClick={()=>window.open(`${location.href.split('?')[0]}?mode=display`,'_blank')}><I.Monitor s={15}/></button>
        </div>}/>
      <div className="section" style={{paddingTop:16}}>
        <button className="btn btn-coral" style={{width:'100%',padding:13,gap:6,fontSize:15,fontWeight:700,borderRadius:14,background:'linear-gradient(135deg,#FF5E3A,#FF9040)',border:'none',boxShadow:'0 4px 18px rgba(255,94,58,.35)',transition:'all .18s'}} onClick={()=>{SFX.click();setCreating(true);}}><I.Plus s={16}/> {t('newComp')}</button>
        <button className="btn btn-ghost" style={{width:'100%',padding:11,gap:6,border:'1px solid var(--border)',borderRadius:14,fontSize:13}} onClick={()=>{SFX.click();setShowRulebook(true);}}><I.Book s={15}/> {t('rulebook')}</button>
        {comps===undefined&&<Spinner/>}
        {comps!==undefined&&list.length===0&&<EmptyState icon={<I.Trophy s={28} c="rgba(255,255,255,.3)"/>} text={t('noComps')}/>}
        {list.length>5&&(
          <div style={{position:'relative'}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder={lang==='de'?'Wettkampf suchen…':'Search competition…'} style={{width:'100%',paddingLeft:36}}/>
          </div>
        )}
        {q&&filtered.length===0&&<div className="type-caption" style={{textAlign:'center',padding:'12px 0'}}>{lang==='de'?'Kein Wettkampf gefunden.':'No competition found.'}</div>}
        {filtered.map((c,i)=>{
          // Abgeschlossen: alle Stages geschlossen (Pipeline oder numbered)
          const isPipe=c.info?.pipelineEnabled&&c.pipeline;
          const stagesArr=isPipe?Object.values(c.pipeline||{}).filter(s=>s&&typeof s==='object'&&s.name!=null):Object.values(c.stages||{});
          const numStComp=isPipe?stagesArr.length:(c.info?.numStations||0);
          const closedCount=stagesArr.filter(s=>s&&s.closed).length;
          const isDone=numStComp>0&&closedCount===numStComp;
          return(
          <div key={c.id} className="sh-card fade-up"
            style={{padding:14,display:'flex',flexDirection:'row',alignItems:'center',gap:12,width:'100%',animationDelay:`${i*.06}s`,cursor:'pointer',transition:'background .18s,border-color .18s,transform .12s'}}
            onClick={()=>{SFX.click();tryOpen(c);}}>
            <CompEmoji emoji={c.info?.emoji} logo={c.info?.logo} s={42}/>
            <div style={{flex:1,textAlign:'left',minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:7,minWidth:0}}>
                <span style={{fontWeight:800,fontSize:14,letterSpacing:'-.2px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0}}>{c.info?.name||'Wettkampf'}</span>
                {isDone&&<span className="done-badge" title={lang==='de'?'Abgeschlossen — Rangliste verfügbar':'Finished — ranking available'}>{lang==='de'?'Fertig':'Done'}</span>}
                <span className="lock-badge" title={lang==='de'?'Passwort-geschützt':'Password-protected'}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                </span>
              </div>
              <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{c.info?.date||''}{c.info?.location?` · ${c.info.location}`:''}</div>
            </div>
            <div style={{fontSize:9,fontFamily:'JetBrains Mono',padding:'2px 7px',borderRadius:7,background:'rgba(255,94,58,.12)',color:'var(--cor)',letterSpacing:'.08em',flexShrink:0}}>{c.id}</div>
            {/* Duplizieren */}
            <button title={lang==='de'?'Als Kopie duplizieren':'Duplicate as copy'} disabled={dupBusy===c.id}
              style={{background:'none',border:'none',cursor:dupBusy===c.id?'wait':'pointer',padding:'5px',display:'flex',flexShrink:0,borderRadius:8,opacity:dupBusy===c.id?.4:1}}
              onClick={e=>{e.stopPropagation();duplicate(c);}}>
              {dupBusy===c.id
                ?<span className="inline-spinner" style={{width:12,height:12}}/>
                :<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>}
            </button>
            <button style={{background:'none',border:'none',cursor:'pointer',padding:'5px',display:'flex',flexShrink:0,borderRadius:8}}
              onClick={e=>{e.stopPropagation();if(window.confirm(`"${c.info?.name||c.id}" wirklich löschen?\n\nAlle Daten werden permanent gelöscht.`)){fbRemove(`ogn/${c.id}`);SFX.fall();}}}>
              <I.Trash s={13} c="rgba(255,59,48,.45)"/>
            </button>
          </div>
          );
        })}
      </div>
      {pendingComp&&<PasswordModal comp={pendingComp} onUnlock={()=>{const id=pendingComp.id;setPendingComp(null);onOpen(id);}} onCancel={()=>setPendingComp(null)}/>}
      {toast&&<div style={{position:'fixed',bottom:'calc(24px + env(safe-area-inset-bottom,0px))',left:'50%',transform:'translateX(-50%)',zIndex:300,background:'rgba(52,199,89,.95)',color:'#fff',padding:'10px 18px',borderRadius:'var(--radius-full)',fontSize:13,fontWeight:700,boxShadow:'var(--shadow-lg)',display:'flex',alignItems:'center',gap:8,maxWidth:'90vw'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{toast}</span></div>}
    </div>
  );
};

export { HomeView };
