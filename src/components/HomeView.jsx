import React, { useState } from 'react';
import { useLang, LangCtx } from '../i18n.js';
import { fbRemove } from '../config.js';
import { useFbVal, SFX } from '../hooks.js';
import { I } from '../icons.jsx';
import { Spinner, EmptyState, TopBar, CompEmoji } from './shared.jsx';
import { SetupWizard } from './SetupWizard.jsx';
import { Regelwerk } from './ResultsView.jsx';

const HomeView=({onOpen,lang,setLang})=>{
  const {t}=useLang();
  const comps=useFbVal('ogn');
  const [creating,setCreating]=useState(false);
  const [showRulebook,setShowRulebook]=useState(false);
  if(creating)return<SetupWizard onDone={id=>{setCreating(false);onOpen(id);}} onBack={()=>setCreating(false)}/>;
  if(showRulebook)return<div style={{minHeight:'100vh'}}><TopBar title={t('rulebook')} onBack={()=>{SFX.click();setShowRulebook(false)}} right={<button className="btn btn-ghost" style={{padding:'5px 11px',fontSize:12,fontWeight:700}} onClick={()=>setLang(lang==='de'?'en':'de')}>{t('lang')}</button>}/><LangCtx.Provider value={lang}><Regelwerk/></LangCtx.Provider></div>;
  const list=comps?Object.entries(comps).map(([id,v])=>({id,...v})).sort((a,b)=>(b.info?.createdAt||0)-(a.info?.createdAt||0)):[];
  return(
    <div style={{minHeight:'100vh'}}>
      <TopBar title={<div style={{display:'flex',alignItems:'center',gap:8}}><img src="/og-logo.png" style={{width:26,height:26,borderRadius:6,objectFit:'cover'}} alt="" onError={e=>{e.target.style.display='none'}}/><span>OG Comps</span></div>}
        right={<div style={{display:'flex',gap:6}}>
          <button className="btn btn-ghost" style={{padding:'5px 11px',fontSize:12,fontWeight:700}} onClick={()=>setLang(lang==='de'?'en':'de')}>{t('lang')}</button>
          <button className="btn btn-ghost" style={{padding:'7px'}} onClick={()=>window.open(`${location.href.split('?')[0]}?mode=display`,'_blank')}><I.Monitor s={15}/></button>
        </div>}/>
      {/* Hero area */}
      <div style={{padding:'32px 24px 22px',borderBottom:'1px solid var(--border)',background:'radial-gradient(ellipse at 50% -20%,rgba(255,94,58,.08) 0%,transparent 65%)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}><img src="/og-logo.png" style={{width:44,height:44,borderRadius:10,objectFit:'cover'}} alt="OG Comps" onError={e=>{e.target.style.display='none'}}/><div><div style={{fontSize:16,fontWeight:900,color:'var(--cor)',letterSpacing:'-.3px'}}>OG Comps</div><div style={{fontSize:10,color:'var(--muted)',fontWeight:500}}>Ninja Competition Tool</div></div></div>
        <div style={{fontSize:30,fontWeight:900,letterSpacing:'-1px',lineHeight:1.1,marginBottom:5}}>{t('competitions')}</div>
        <div style={{fontSize:13,color:'var(--muted)'}}>{lang==='de'?'Echtzeit-Sync \u00b7 Bis 4 Stages \u00b7 DE / EN':'Real-time Sync \u00b7 Up to 4 Stages \u00b7 DE / EN'}</div>
      </div>
      <div className="section">
        <button className="btn btn-coral" style={{width:'100%',padding:12,gap:6}} onClick={()=>{SFX.click();setCreating(true);}}><I.Plus s={15}/> {t('newComp')}</button>
        <button className="btn btn-ghost" style={{width:'100%',padding:12,gap:6,border:'1px solid var(--border)'}} onClick={()=>{SFX.click();setShowRulebook(true);}}><I.Book s={15}/> {t('rulebook')}</button>
        {comps===undefined&&<Spinner/>}
        {comps!==undefined&&list.length===0&&<EmptyState icon={<I.Trophy s={28} c="rgba(255,255,255,.3)"/>} text={t('noComps')}/>}
        {list.map((c,i)=>(
          <div key={c.id} className="sh-card fade-up"
            style={{padding:16,display:'flex',flexDirection:'row',alignItems:'center',gap:14,width:'100%',animationDelay:`${i*.06}s`,cursor:'pointer',transition:'background .18s,border-color .18s'}}
            onClick={()=>{SFX.click();onOpen(c.id);}}>
            <CompEmoji emoji={c.info?.emoji} logo={c.info?.logo} s={44}/>
            <div style={{flex:1,textAlign:'left'}}>
              <div style={{fontWeight:800,fontSize:15,letterSpacing:'-.2px'}}>{c.info?.name||'Wettkampf'}</div>
              <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{c.info?.date||''}{c.info?.location?` \u00b7 ${c.info.location}`:''}</div>
            </div>
            <div style={{fontSize:10,fontFamily:'JetBrains Mono',padding:'2px 8px',borderRadius:8,background:'rgba(255,94,58,.12)',color:'var(--cor)',letterSpacing:'.1em'}}>{c.id}</div>
            <button style={{background:'none',border:'none',cursor:'pointer',padding:'6px',display:'flex',flexShrink:0,borderRadius:8,transition:'background .15s'}}
              onClick={e=>{e.stopPropagation();if(window.confirm(`"${c.info?.name||c.id}" wirklich l\u00f6schen?\n\nAlle Daten (Athleten, L\u00e4ufe, Ergebnisse) werden permanent gel\u00f6scht.`)){fbRemove(`ogn/${c.id}`);SFX.fall();}}}>
              <I.Trash s={14} c="rgba(255,59,48,.45)"/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export { HomeView };
