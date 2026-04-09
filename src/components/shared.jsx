import React, { useState, useEffect, useRef } from 'react';
import { useLang } from '../i18n.js';
import { toFlag, acSuggest, acProfileLoad, AC_KEYS } from '../utils.js';
import { countrySuggest } from '../countries.js';
import { SFX } from '../hooks.js';
import { I } from '../icons.jsx';

const AutocompleteInput=({acKey,value,onChange,placeholder,style,onKeyDown,autoFocus,inputStyle,profileKey,onSelectFull,extraSugs=[]})=>{
  const profiles=profileKey?acProfileLoad():{};
  const isCountry=acKey===AC_KEYS.countries;
  const [open,setOpen]=React.useState(false);
  const [sugs,setSugs]=React.useState([]);
  const ref=React.useRef(null);
  React.useEffect(()=>{
    const fn=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener('mousedown',fn);return()=>document.removeEventListener('mousedown',fn);
  },[]);
  const computeSugs=v=>{
    if(isCountry){const cs=countrySuggest(v);return cs.length?cs:[];}
    const base=acSuggest(acKey,v);
    if(!extraSugs||!extraSugs.length)return base;
    const ql=(v||'').toLowerCase();
    const extra=extraSugs.filter(s=>s&&s.toLowerCase().includes(ql)&&!base.includes(s));
    return[...base,...extra].slice(0,8);
  };
  const handleChange=e=>{
    const v=e.target.value;onChange(e);
    const s=computeSugs(v);setSugs(s);setOpen(s.length>0);
  };
  const pick=(v,isCountryPick,code)=>{
    if(isCountryPick){onChange({target:{value:code}});}
    else{onChange({target:{value:v}});if(onSelectFull)onSelectFull({value:v,profile:profiles[v]||null});}
    setOpen(false);
  };
  return(
    <div ref={ref} style={{position:'relative',flex:1,...(style||{})}}>
      <input value={value} onChange={handleChange} placeholder={placeholder} autoFocus={autoFocus}
        style={{width:'100%',...(inputStyle||{})}}
        onKeyDown={e=>{if(e.key==='Escape')setOpen(false);if(onKeyDown)onKeyDown(e);}}
        onFocus={()=>{const s=computeSugs(value);if(s.length>0){setSugs(s);setOpen(true);}}}/>
      {open&&sugs.length>0&&(
        <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:999,background:'#1C1C28',border:'1px solid var(--border)',borderRadius:10,marginTop:3,boxShadow:'0 8px 24px rgba(0,0,0,.4)',overflow:'hidden'}}>
          {isCountry
            ?sugs.map(([name,code])=>(
              <div key={code} onMouseDown={()=>pick(name,true,code)} style={{padding:'8px 13px',fontSize:13,cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,.05)',display:'flex',alignItems:'center',gap:8,transition:'background .1s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,94,58,.12)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <span style={{fontSize:18}}>{toFlag(code)}</span>
                <span style={{flex:1}}>{name}</span>
                <span style={{fontSize:11,fontFamily:'JetBrains Mono',color:'var(--muted)',background:'rgba(255,255,255,.06)',borderRadius:5,padding:'1px 6px'}}>{code}</span>
              </div>
            ))
            :sugs.map(s=>{const sp=profiles[s]||null;return(
              <div key={s} onMouseDown={()=>pick(s)} style={{padding:'8px 13px',fontSize:13,cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,.05)',display:'flex',alignItems:'center',gap:8,transition:'background .1s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,94,58,.12)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                {sp?.photo&&<img src={sp.photo} style={{width:22,height:22,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>}
                {sp?.country&&<span style={{fontSize:16,lineHeight:1}}>{toFlag(sp.country)}</span>}
                <span style={{flex:1}}>{s}</span>
              </div>
            );})
          }
        </div>
      )}
    </div>
  );
};

const Spinner=()=><div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:40}}><div style={{width:26,height:26,border:'2.5px solid var(--border)',borderTopColor:'var(--cor)',borderRadius:'50%',animation:'spin .7s linear infinite'}}/></div>;
const EmptyState=({icon,text})=><div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,padding:'44px 24px',color:'var(--muted)',textAlign:'center'}}><div style={{fontSize:30,opacity:.4}}>{icon}</div><div style={{fontSize:13}}>{text}</div></div>;
const MedalBadge=({pos,s=28})=>{const c=pos===0?'#FFD60A':pos===1?'#C0C0C0':'#CD7F32';return<div style={{width:s,height:s,borderRadius:'50%',background:`radial-gradient(135deg,${c}33,${c}11)`,border:`2px solid ${c}88`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:Math.round(s*.44),color:c,flexShrink:0,fontFamily:'JetBrains Mono'}}>{pos+1}</div>;};
const LifeDots=({run,size=7})=>{
  if(run.mode!=='lives')return null;
  const used=Array.isArray(run.falls)?run.falls.length:0;
  if(used===0)return null;
  return(
    <div style={{display:'flex',gap:2,alignItems:'center',flexShrink:0}}>
      {Array.from({length:used},(_,i)=>(
        <div key={i} style={{width:size,height:size,borderRadius:'50%',background:'rgba(255,50,50,.18)',border:'1px solid rgba(255,60,50,.5)',position:'relative',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
          <div style={{position:'absolute',width:'130%',height:1,background:'rgba(255,60,50,.75)',transform:'rotate(-45deg)'}}/>
        </div>
      ))}
    </div>
  );
};
const CompEmoji=({emoji,logo,s=40})=>logo?<img src={logo} style={{width:s,height:s,borderRadius:Math.round(s*.28),objectFit:'cover',flexShrink:0,border:'1px solid rgba(255,255,255,.1)'}}/>:emoji?<div style={{width:s,height:s,borderRadius:Math.round(s*.28),background:'linear-gradient(135deg,#FF6B00,#FF9500)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.round(s*.52),flexShrink:0}}>{emoji}</div>:<div style={{width:s,height:s,borderRadius:Math.round(s*.28),background:'linear-gradient(135deg,#FF5E3A,#FF9040)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><I.Bolt s={Math.round(s*.44)} c="#fff"/></div>;

const TopBar=({title,sub,onBack,right,logo=true})=>(
  <div className="topbar">
    {onBack?<button className="btn btn-ghost" style={{padding:'7px',borderRadius:10,minWidth:36}} onClick={onBack}><I.ChevL s={20}/></button>:logo&&<div className="topbar-logo"><I.Bolt s={14}/></div>}
    <div style={{flex:1}}><div className="topbar-title">{title}</div>{sub&&<div className="topbar-sub">{sub}</div>}</div>
    {right}
  </div>
);

const QRCodeComp=({url,size=150})=>{
  const ref=useRef();
  useEffect(()=>{if(!ref.current||!url||!window.QRCode)return;ref.current.innerHTML='';try{new window.QRCode(ref.current,{text:url,width:size,height:size,colorDark:'#000',colorLight:'#fff'});}catch{ref.current.innerHTML=`<span style="font-size:10px;color:#666">${url}</span>`;};},[url,size]);
  return <div style={{background:'#fff',padding:10,borderRadius:10,display:'inline-block'}} ref={ref}/>;
};

const DragList=({items,onReorder,renderItem,keyFn,onExternalDrop})=>{
  const dragIdxRef=useRef(null);
  const [dragging,setDragging]=useState(null); // mirrors dragIdxRef for rendering
  const [insertAt,setInsertAt]=useState(null);
  const containerRef=useRef(null);
  const getInsertIdx=y=>{
    const rows=[...containerRef.current.querySelectorAll('[data-drag-item]')];
    for(let i=0;i<rows.length;i++){const r=rows[i].getBoundingClientRect();if(y<r.top+r.height/2)return i;}
    return rows.length;
  };
  // Desktop drag
  const onCOver=e=>{e.preventDefault();e.dataTransfer.dropEffect=e.dataTransfer.types.includes('dnd-obs-ext')?'copy':'move';setInsertAt(getInsertIdx(e.clientY));};
  const onCDrop=e=>{
    e.preventDefault();
    const extData=e.dataTransfer.getData('dnd-obs-ext');
    if(extData&&onExternalDrop){onExternalDrop(extData,insertAt!==null?insertAt:items.length);setInsertAt(null);return;}
    const from=dragIdxRef.current;let to=insertAt;
    if(from===null||to===null){dragIdxRef.current=null;setDragging(null);setInsertAt(null);return;}
    if(to>from)to--;
    if(to!==from){const a=[...items];const[m]=a.splice(from,1);a.splice(to,0,m);onReorder(a);SFX.click();}
    dragIdxRef.current=null;setDragging(null);setInsertAt(null);
  };
  // Touch drag (mobile) — only initiates from .drag-handle
  const onItemTouchStart=(idx,e)=>{
    if(!e.target.closest('.drag-handle'))return;
    dragIdxRef.current=idx;setDragging(idx);setInsertAt(idx);
  };
  useEffect(()=>{
    const el=containerRef.current;if(!el)return;
    const fn=e=>{if(dragIdxRef.current===null)return;e.preventDefault();setInsertAt(getInsertIdx(e.touches[0].clientY));};
    el.addEventListener('touchmove',fn,{passive:false});
    return()=>el.removeEventListener('touchmove',fn);
  },[]);
  const onItemTouchEnd=()=>{
    const from=dragIdxRef.current;let to=insertAt;
    dragIdxRef.current=null;setDragging(null);setInsertAt(null);
    if(from===null||to===null)return;
    if(to>from)to--;
    if(to!==from){const a=[...items];const[m]=a.splice(from,1);a.splice(to,0,m);onReorder(a);SFX.click();}
  };
  const showLine=i=>insertAt===i&&dragging!==null&&insertAt!==dragging&&insertAt!==dragging+1;
  const Line=({i})=><div style={{height:showLine(i)?4:6,background:showLine(i)?'var(--cor)':'transparent',borderRadius:3,boxShadow:showLine(i)?'0 0 10px rgba(255,94,58,.7)':'none',margin:'0 4px',transition:'height .08s,background .08s,box-shadow .08s'}}/>;
  return(
    <div ref={containerRef} style={{display:'flex',flexDirection:'column'}}
      onDragOver={onCOver} onDrop={onCDrop}
      onDragLeave={e=>{if(!containerRef.current?.contains(e.relatedTarget))setInsertAt(null);}}>
      <Line i={0}/>
      {items.map((item,i)=>(
        <React.Fragment key={keyFn?keyFn(item):i}>
          <div data-drag-item draggable
            onDragStart={e=>{if(!e.target.closest('.drag-handle')){e.preventDefault();return;}dragIdxRef.current=i;setDragging(i);e.dataTransfer.effectAllowed='move';}}
            onDragEnd={()=>{dragIdxRef.current=null;setDragging(null);setInsertAt(null);}}
            onTouchStart={e=>onItemTouchStart(i,e)}
            onTouchEnd={onItemTouchEnd}
            className="sh-card"
            style={{opacity:dragging===i?0.35:1,transition:'opacity .15s'}}>
            {renderItem(item,i)}
          </div>
          <Line i={i+1}/>
        </React.Fragment>
      ))}
    </div>
  );
};

const TimePicker=({value,onChange,allowDefault=false})=>{
  const {lang}=useLang();
  const ITEM_H=44;
  const opts=[];
  if(allowDefault)opts.push(null);
  for(let s=0;s<=600;s+=10)opts.push(s);
  const valToIdx=(v)=>{
    if((v==null||v===undefined)&&allowDefault)return 0;
    const base=allowDefault?1:0;
    return Math.max(0,Math.min(opts.length-1,base+Math.round((v||0)/10)));
  };
  const [activeIdx,setActiveIdx]=useState(()=>valToIdx(value));
  const scrollRef=useRef(null);
  const snapTimer=useRef(null);
  useEffect(()=>{
    const el=scrollRef.current;
    if(el)el.scrollTop=valToIdx(value)*ITEM_H;
  },[]);
  const handleScroll=()=>{
    const el=scrollRef.current;if(!el)return;
    const idx=Math.max(0,Math.min(opts.length-1,Math.round(el.scrollTop/ITEM_H)));
    setActiveIdx(idx);
    clearTimeout(snapTimer.current);
    snapTimer.current=setTimeout(()=>{
      el.scrollTo({top:idx*ITEM_H,behavior:'smooth'});
      onChange(opts[idx]);
    },150);
  };
  const fmt=(v)=>{
    if(v===null)return lang==='de'?'Standard':'Default';
    if(v===0)return lang==='de'?'Kein':'None';
    return `${Math.floor(v/60)}:${String(v%60).padStart(2,'0')}`;
  };
  return(
    <div style={{position:'relative',height:ITEM_H*5,overflow:'hidden',borderRadius:14,background:'rgba(255,255,255,.04)',border:'1px solid var(--border)',userSelect:'none',touchAction:'pan-y'}}>
      <div style={{position:'absolute',top:ITEM_H*2,left:0,right:0,height:ITEM_H,background:'rgba(255,94,58,.12)',borderTop:'1px solid rgba(255,94,58,.4)',borderBottom:'1px solid rgba(255,94,58,.4)',pointerEvents:'none',zIndex:2,borderRadius:0}}/>
      <div style={{position:'absolute',top:0,left:0,right:0,height:ITEM_H*2,background:'linear-gradient(to bottom,#0B0B14 20%,transparent)',pointerEvents:'none',zIndex:3}}/>
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:ITEM_H*2,background:'linear-gradient(to top,#0B0B14 20%,transparent)',pointerEvents:'none',zIndex:3}}/>
      <div ref={scrollRef} onScroll={handleScroll}
        style={{height:'100%',overflowY:'scroll',scrollSnapType:'y mandatory',WebkitOverflowScrolling:'touch'}}>
        <div style={{height:ITEM_H*2}}/>
        {opts.map((v,i)=>(
          <div key={i} onClick={()=>{scrollRef.current?.scrollTo({top:i*ITEM_H,behavior:'smooth'});setActiveIdx(i);onChange(v);}}
            style={{height:ITEM_H,display:'flex',alignItems:'center',justifyContent:'center',scrollSnapAlign:'center',
              fontSize:i===activeIdx?20:14,fontWeight:i===activeIdx?800:400,
              color:i===activeIdx?'var(--cor)':'rgba(255,255,255,.28)',
              fontFamily:'JetBrains Mono',letterSpacing:'.05em',transition:'font-size .1s,color .1s',cursor:'pointer'}}>
            {fmt(v)}
          </div>
        ))}
        <div style={{height:ITEM_H*2}}/>
      </div>
    </div>
  );
};

export { AutocompleteInput, Spinner, EmptyState, MedalBadge, LifeDots, CompEmoji, TopBar, QRCodeComp, DragList, TimePicker };
