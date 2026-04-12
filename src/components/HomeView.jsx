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
      <TopBar title={
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <img src="/og-logo.png" style={{width:28,height:28,borderRadius:7,objectFit:'cover'}} alt="" onError={e=>{e.target.style.display='none'}}/>
          <div>
            <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:17,fontWeight:700,letterSpacing:'-.4px',lineHeight:1.1}}>OG Comps</div>
            <div style={{fontSize:9,color:'var(--muted)',fontWeight:500,letterSpacing:'.06em',lineHeight:1}}>Ninja Competition Tool</div>
          </div>
        </div>}
        right={<div style={{display:'flex',gap:6}}>
          <button className="btn btn-ghost" style={{padding:'5px 11px',fontSize:12,fontWeight:700}} onClick={()=>setLang(lang==='de'?'en':'de')}>{t('lang')}</button>
          <button className="btn btn-ghost" style={{padding:'7px'}} onClick={()=>window.open(`${location.href.split('?')[0]}?mode=display`,'_blank')}><I.Monitor s={15}/></button>
        </div>}/>
      <div className="section" style={{paddingTop:16}}>
        <button className="btn btn-coral" style={{width:'100%',padding:13,gap:6,fontSize:15,fontWeight:700,borderRadius:14,background:'linear-gradient(135deg,#FF5E3A,#FF9040)',border:'none',boxShadow:'0 4px 18px rgba(255,94,58,.35)',transition:'all .18s'}} onClick={()=>{SFX.click();setCreating(true);}}><I.Plus s={16}/> {t('newComp')}</button>
        <button className="btn btn-ghost" style={{width:'100%',padding:11,gap:6,border:'1px solid var(--border)',borderRadius:14,fontSize:13}} onClick={()=>{SFX.click();setShowRulebook(true);}}><I.Book s={15}/> {t('rulebook')}</button>
        {comps===undefined&&<Spinner/>}
        {comps!==undefined&&list.length===0&&<EmptyState icon={<I.Trophy s={28} c="rgba(255,255,255,.3)"/>} text={t('noComps')}/>}
        {list.map((c,i)=>(
          <div key={c.id} className="sh-card fade-up"
            style={{padding:14,display:'flex',flexDirection:'row',alignItems:'center',gap:12,width:'100%',animationDelay:`${i*.06}s`,cursor:'pointer',transition:'background .18s,border-color .18s,transform .12s'}}
            onClick={()=>{SFX.click();onOpen(c.id);}}>
            <CompEmoji emoji={c.info?.emoji} logo={c.info?.logo} s={42}/>
            <div style={{flex:1,textAlign:'left',minWidth:0}}>
              <div style={{fontWeight:800,fontSize:14,letterSpacing:'-.2px',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.info?.name||'Wettkampf'}</div>
              <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{c.info?.date||''}{c.info?.location?` \u00b7 ${c.info.location}`:''}</div>
            </div>
            <div style={{fontSize:9,fontFamily:'JetBrains Mono',padding:'2px 7px',borderRadius:7,background:'rgba(255,94,58,.12)',color:'var(--cor)',letterSpacing:'.08em',flexShrink:0}}>{c.id}</div>
            <button style={{background:'none',border:'none',cursor:'pointer',padding:'5px',display:'flex',flexShrink:0,borderRadius:8}}
              onClick={e=>{e.stopPropagation();if(window.confirm(`"${c.info?.name||c.id}" wirklich l\u00f6schen?\n\nAlle Daten werden permanent gel\u00f6scht.`)){fbRemove(`ogn/${c.id}`);SFX.fall();}}}>
              <I.Trash s={13} c="rgba(255,59,48,.45)"/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export { HomeView };
