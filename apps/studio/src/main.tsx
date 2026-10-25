import React,{useMemo,useState,useRef,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {parseDeck} from '../../../packages/schema/src/index.js';
import {layoutDeck} from '../../../packages/core/src/index.js';
import {SlideView} from '../../../packages/renderer-web/src/components.js';
import demo from '../../../examples/demo.json';
import 'katex/dist/katex.min.css';
import './studio.css';

const parsed=parseDeck(demo);
const icons:Record<string,string>={title:'◈',content:'≡','two-column':'◫',formula:'ƒ',architecture:'⌘',comparison:'▥',timeline:'→',summary:'✓',experiment:'◉'};
function Studio(){
 const [theme,setTheme]=useState(parsed.theme),[selected,setSelected]=useState(0),[notes,setNotes]=useState(false),[copied,setCopied]=useState(false);
 const deck=useMemo(()=>({...parsed,theme}),[theme]);const layout=useMemo(()=>layoutDeck(deck),[deck]);const slide=layout.slides[selected];
 const viewport=useRef<HTMLDivElement>(null),[scale,setScale]=useState(.65);
 useEffect(()=>{const element=viewport.current;if(!element)return;const observer=new ResizeObserver(entries=>setScale(Math.max(.05,Math.min((entries[0].contentRect.width-64)/1280,(entries[0].contentRect.height-64)/720,1))));observer.observe(element);return()=>observer.disconnect();},[]);
 const go=(next:number)=>setSelected(Math.max(0,Math.min(layout.slides.length-1,next)));
 useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.target instanceof HTMLSelectElement||event.target instanceof HTMLInputElement)return;if(event.key==='ArrowRight')go(selected+1);if(event.key==='ArrowLeft')go(selected-1);};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[selected]);
 const download=()=>{const blob=new Blob([JSON.stringify(deck,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='renderkit-demo.json';a.click();URL.revokeObjectURL(a.href);};
 return <div className="studio-shell">
 <aside className="rail"><a href="#" className="brand" aria-label="RenderKit home"><span className="brand-mark">R<span>2</span></span><div>RenderKit<span className="brand-sub">VISUAL SYSTEMS</span></div></a><div className="project-label">WORKSPACE <span>v0.1</span></div><div className="project-title">A visual language<br/>for intelligent systems.</div><div className="nav-heading">STORYBOARD <span>{String(layout.slides.length).padStart(2,'0')} SLIDES</span></div><nav aria-label="Slide navigation">{layout.slides.map((s,i)=><button key={s.id} className={`slide-nav ${i===selected?'active':''}`} onClick={()=>go(i)} aria-current={i===selected?'page':undefined}><span className="slide-num">{String(i+1).padStart(2,'0')}</span><span className="slide-label">{s.title}</span><span className="slide-symbol">{icons[s.source.type]??'◇'}</span></button>)}</nav><div className="rail-bottom"><span className="status-dot"/> Local-first · No API required<p>Shared semantics. Multiple surfaces.</p></div></aside>
 <main className="workspace"><header className="topbar"><div className="breadcrumb">Projects <span>/</span> RenderKit 2D <span>/</span> <strong>Demo</strong></div><div className="top-actions"><span className="version-badge">MVP / 0.1</span><button className="download-button" onClick={download}>↓ Export JSON</button></div></header>
 <section className="workspace-intro"><div><p className="eyebrow">SEMANTIC DESIGN ENGINE</p><h1>One idea. Every surface.</h1><p className="intro-copy">从结构化内容到可审计的视觉表达。</p></div><div className="theme-control"><label htmlFor="theme">DESIGN SYSTEM</label><select id="theme" value={theme} onChange={e=>setTheme(e.target.value as typeof theme)}><option value="academic-minimal">Academic Minimal</option><option value="tech-dashboard">Tech Dashboard</option></select></div></section>
 <div className="canvas-toolbar"><span><span className="status-dot"/> LIVE PREVIEW</span><div><span>{slide.source.type}</span><span className="toolbar-divider"/><span>1280 × 720</span><span className="toolbar-divider"/><span>{Math.round(scale*100)}%</span></div></div>
 <div className="canvas-viewport" ref={viewport}><div className="canvas-scale" style={{width:1280*scale,height:720*scale}}><div style={{transform:`scale(${scale})`,transformOrigin:'top left'}}><SlideView slide={slide} theme={layout.theme}/></div></div></div>
 <footer className="canvas-footer"><div className="pager"><button aria-label="Previous slide" disabled={!selected} onClick={()=>go(selected-1)}>←</button><span><strong>{String(selected+1).padStart(2,'0')}</strong> / {String(layout.slides.length).padStart(2,'0')}</span><button aria-label="Next slide" disabled={selected===layout.slides.length-1} onClick={()=>go(selected+1)}>→</button></div><span className="keyboard-hint">← → to navigate</span><button className={`notes-toggle ${notes?'selected':''}`} onClick={()=>setNotes(!notes)}>☷ Speaker notes</button></footer>
 {notes&&<section className="notes"><span>SPEAKER NOTES</span><p>{slide.notes||slide.source.keyMessage||'此页暂无演讲备注。'}</p></section>}
 <div className="pipeline"><div><span className="pipeline-step">01</span><strong>Structured IR</strong><span>Validated with Zod</span></div><span className="pipeline-arrow">→</span><div><span className="pipeline-step">02</span><strong>Semantic layout</strong><span>{layout.theme.name}</span></div><span className="pipeline-arrow">→</span><div><span className="pipeline-step">03</span><strong>Web + PPTX</strong><span>Same content, native output</span></div><button className="copy-command" onClick={async()=>{try{await navigator.clipboard.writeText('npm run demo');setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setCopied(false);}}} title="Copy CLI command">{copied?'Copied ✓':'$ npm run demo'}</button></div>
 </main></div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Studio/></React.StrictMode>);
