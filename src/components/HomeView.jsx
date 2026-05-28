import React, { useState } from 'react';
import { useLang, LangCtx } from '../i18n.js';
import { fbRemove } from '../config.js';
import { useFbVal, SFX } from '../hooks.js';
import { isUnlocked } from '../utils.js';
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
  // Klick auf Karte: schon entsperrt → direkt öffnen, sonst Passwort-Gate
  const tryOpen=(c)=>{ if(isUnlocked(c.id,c)){onOpen(c.id);} else {setPendingComp(c);} };
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
            <button style={{background:'none',border:'none',cursor:'pointer',padding:'5px',display:'flex',flexShrink:0,borderRadius:8}}
              onClick={e=>{e.stopPropagation();if(window.confirm(`"${c.info?.name||c.id}" wirklich löschen?\n\nAlle Daten werden permanent gelöscht.`)){fbRemove(`ogn/${c.id}`);SFX.fall();}}}>
              <I.Trash s={13} c="rgba(255,59,48,.45)"/>
            </button>
          </div>
          );
        })}
      </div>
      {pendingComp&&<PasswordModal comp={pendingComp} onUnlock={()=>{const id=pendingComp.id;setPendingComp(null);onOpen(id);}} onCancel={()=>setPendingComp(null)}/>}
    </div>
  );
};

export { HomeView };
