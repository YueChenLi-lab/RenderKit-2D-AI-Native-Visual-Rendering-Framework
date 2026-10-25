import React from 'react';
import katex from 'katex';
import type { Block } from '../../schema/src/index.js';
import type { LayoutDeck, LayoutElement, LayoutSlide } from '../../core/src/types.js';
import type { Theme } from '../../design-system/src/index.js';

export interface VisualProps { element: LayoutElement; theme: Theme }
const splitLabel = (label: string, limit = 22): string[] => {
  const words = label.split(/\s+/); const lines: string[] = []; let current = '';
  for (const word of words) {
    if (current && current.length + word.length > limit) { lines.push(current); current = ''; }
    current += `${current ? ' ' : ''}${word}`;
  }
  if (current) lines.push(current);
  return lines;
};
function SvgLabel({text,x,y,color,size=18,max=22}:{text:string;x:number;y:number;color:string;size?:number;max?:number}) {
  const lines=splitLabel(text,max);
  return <text x={x} y={y-(lines.length-1)*size*0.6} fill={color} fontSize={size} textAnchor="middle" dominantBaseline="middle">{lines.map((line,i)=><tspan key={i} x={x} dy={i?size*1.2:0}>{line}</tspan>)}</text>;
}
export function renderFormulaHtml(latex:string):string {
  return katex.renderToString(latex,{displayMode:true,throwOnError:true,trust:false,strict:'error',output:'htmlAndMathml'});
}
export function FormulaBlock({element,theme}:VisualProps) {
  const b=element.block; if(b.type!=='formula') return null;
  let rendered: string;
  try { rendered=renderFormulaHtml(b.latex); }
  catch(error) { return <div role="alert" data-formula-error="true">Formula error: {error instanceof Error?error.message:String(error)}</div>; }
  return <div className="rk-formula" style={{height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',padding:24,boxSizing:'border-box',borderLeft:`4px solid ${theme.colors.primary}`,background:theme.colors.surface,borderRadius:theme.radius}}>
    <div data-formula="true" style={{maxWidth:'100%',fontSize:element.fontSize}} dangerouslySetInnerHTML={{__html:rendered}} />
    {b.caption&&<div style={{fontSize:theme.typography.small,color:theme.colors.muted,textAlign:'center',marginTop:16}}>{b.caption}</div>}
  </div>;
}
export function ProcessFlow({element,theme}:VisualProps) {
  const b=element.block;if(b.type!=='process')return null;
  const count=b.steps.length, cols=Math.min(count,4),rows=Math.ceil(count/cols), gap=32, cellW=(element.width-gap*(cols-1))/cols,cellH=Math.min(112,(element.height-gap*(rows-1))/rows), top=(element.height-(rows*cellH+(rows-1)*gap))/2;
  const points=b.steps.map((_,i)=>({x:(i%cols)*(cellW+gap),y:top+Math.floor(i/cols)*(cellH+gap)}));
  const marker=`arrow-${element.id}`;
  return <svg style={{display:'block'}} role="img" aria-label={`Process: ${b.steps.join(' → ')}`} width="100%" height="100%" viewBox={`0 0 ${element.width} ${element.height}`}>
    <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill={theme.colors.primary}/></marker></defs>
    {points.slice(0,-1).map((p,i)=>{const next=points[i+1];return <path key={i} d={next.y===p.y?`M ${p.x+cellW+3} ${p.y+cellH/2} H ${next.x-5}`:`M ${p.x+cellW/2} ${p.y+cellH+2} V ${p.y+cellH+gap/2} H ${next.x+cellW/2} V ${next.y-5}`} fill="none" stroke={theme.colors.primary} strokeWidth="2" markerEnd={`url(#${marker})`}/>;})}
    {b.steps.map((step,i)=><g key={i}><rect x={points[i].x+1} y={points[i].y} width={cellW-2} height={cellH} rx={theme.radius} fill={theme.colors.surface} stroke={theme.colors.border}/><text x={points[i].x+18} y={points[i].y+25} fontSize="13" fontWeight="700" fill={theme.colors.primary}>{String(i+1).padStart(2,'0')}</text><SvgLabel text={step} x={points[i].x+cellW/2} y={points[i].y+cellH/2+9} color={element.color} size={Math.min(element.fontSize,20)} max={Math.max(12,Math.floor(cellW/12))}/></g>)}
  </svg>;
}
export function ArchitectureDiagram({element,theme}:VisualProps) {
  const b=element.block;if(b.type!=='architecture')return null;
  const levels=new Map(b.nodes.map(n=>[n.id,0]));
  for(let round=0;round<b.nodes.length;round++){let changed=false;for(const e of b.edges){const v=Math.min(b.nodes.length-1,(levels.get(e.from)??0)+1);if((levels.get(e.to)??0)<v){levels.set(e.to,v);changed=true;}}if(!changed)break;}
  const unique=[...new Set(levels.values())].sort((a,b)=>a-b);let colCount=Math.min(unique.length,5);
  let grouped=Array.from({length:colCount},()=>[] as typeof b.nodes);
  b.nodes.forEach(n=>grouped[Math.min(unique.indexOf(levels.get(n.id)??0),colCount-1)].push(n));
  // Cycles and wide fan-outs must not collapse 16 nodes into negative-height boxes.
  if(grouped.some(nodes=>nodes.length>4)){colCount=Math.min(4,b.nodes.length);grouped=Array.from({length:colCount},()=>[] as typeof b.nodes);b.nodes.forEach((n,i)=>grouped[i%colCount].push(n));}
  const gap=48,w=Math.max(1,(element.width-gap*(colCount-1)-40)/colCount);
  const positions=new Map<string,{x:number;y:number;w:number;h:number}>();
  grouped.forEach((nodes,col)=>{const h=Math.max(1,Math.min(108,(element.height-32*(nodes.length-1)-12)/nodes.length));nodes.forEach((n,row)=>positions.set(n.id,{x:4+col*(w+gap),y:(element.height-(h*nodes.length+32*(nodes.length-1)))/2+row*(h+32),w,h}));});
  const marker=`arch-arrow-${element.id}`;
  return <svg style={{display:'block'}} role="img" aria-label="Directed system architecture" width="100%" height="100%" viewBox={`0 0 ${element.width} ${element.height}`}>
    <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill={theme.colors.primary}/></marker></defs>
    {b.edges.map((edge,i)=>{const from=positions.get(edge.from)!,to=positions.get(edge.to)!;const vertical=from.x===to.x,forward=vertical?to.y>from.y:to.x>from.x;const x1=vertical?from.x+from.w/2:from.x+(forward?from.w:0),y1=vertical?from.y+(forward?from.h:0):from.y+from.h/2,x2=vertical?to.x+to.w/2:to.x+(forward?-6:to.w+6),y2=vertical?to.y+(forward?-6:to.h+6):to.y+to.h/2,mx=(x1+x2)/2,my=(y1+y2)/2;const backward=vertical&&!forward&&edge.from!==edge.to;const path=backward?`M ${from.x+from.w} ${from.y+from.h/2} H ${from.x+from.w+24} V ${to.y+to.h/2} H ${to.x+to.w+6}`:edge.from===edge.to?`M ${from.x+from.w} ${y1} C ${from.x+from.w+24} ${y1}, ${from.x+from.w+24} ${from.y-20}, ${from.x+from.w/2} ${from.y-6}`:vertical?`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`:`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;return <g key={i}><path data-edge-from={edge.from} data-edge-to={edge.to} d={path} fill="none" stroke={theme.colors.primary} strokeWidth="2" markerEnd={`url(#${marker})`}/>{edge.label&&<text x={backward?from.x+from.w+12:mx} y={(y1+y2)/2-10} transform={backward?`rotate(-90 ${from.x+from.w+12} ${(y1+y2)/2-10})`:undefined} textAnchor="middle" fontSize="13" fill={theme.colors.muted}>{edge.label}</text>}</g>;})}
    {b.nodes.map(n=>{const p=positions.get(n.id)!;return <g key={n.id} data-node-id={n.id}><rect {...{x:p.x,y:p.y,width:p.w,height:p.h}} rx={theme.radius} fill={theme.colors.surface} stroke={theme.colors.primary} strokeWidth="1.5"/><SvgLabel text={n.label} x={p.x+p.w/2} y={p.y+p.h/2} color={element.color} size={Math.min(element.fontSize,20)} max={Math.max(9,Math.floor(p.w/12))}/></g>;})}
  </svg>;
}
export function ComparisonTable({element,theme}:VisualProps){const b=element.block;if(b.type!=='table')return null;return <div style={{height:'100%',boxSizing:'border-box'}}>{b.simulated&&<div className="rk-simulated" style={{fontSize:14,color:theme.colors.secondary,marginBottom:10,fontWeight:700}}>SIMULATED DATA · 模拟数据</div>}<table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed',fontSize:Math.min(element.fontSize,24)}}><thead><tr>{b.columns.map((c,i)=><th key={i} style={{textAlign:'left',padding:'16px 18px',color:theme.colors.primary,borderBottom:`2px solid ${theme.colors.primary}`,overflowWrap:'anywhere'}}>{c}</th>)}</tr></thead><tbody>{b.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j} style={{padding:'15px 18px',borderBottom:`1px solid ${theme.colors.border}`,background:i%2?theme.colors.surface:'transparent',overflowWrap:'anywhere'}}>{cell}</td>)}</tr>)}</tbody></table></div>;}
export function ChartBlock({element,theme}:VisualProps){
  const b=element.block;if(b.type!=='chart')return null;
  const w=element.width,h=element.height,left=58,right=18,top=48,bottom=72,pw=w-left-right,ph=h-top-bottom;
  const vals=b.series.flatMap(s=>s.values),min=Math.min(0,...vals),max=Math.max(0,...vals),range=max-min||1;
  const y=(v:number)=>top+ph-(v-min)/range*ph,step=pw/b.labels.length,x=(i:number)=>left+step*(i+0.5);
  return <svg style={{display:'block'}} role="img" aria-label={`${b.chartType} chart${b.simulated?', simulated data':''}`} data-chart-values={JSON.stringify(b.series)} width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>
    {b.simulated&&<text x={left} y="18" fontSize="13" fontWeight="700" fill={theme.colors.secondary}>SIMULATED DATA · 模拟数据</text>}
    {Array.from({length:5},(_,i)=>{const v=min+range*i/4;return <g key={i}><line x1={left} x2={w-right} y1={y(v)} y2={y(v)} stroke={theme.colors.border}/><text x={left-9} y={y(v)+5} textAnchor="end" fontSize="14" fill={theme.colors.muted}>{Number(v.toFixed(2))}</text></g>;})}
    <line x1={left} x2={w-right} y1={y(0)} y2={y(0)} stroke={theme.colors.muted}/>
    {b.labels.map((label,i)=><text key={i} x={x(i)} y={top+ph+24} fill={theme.colors.muted} textAnchor="middle" fontSize="14">{label}</text>)}
    {b.series.map((series,s)=>{const color=theme.colors.chart[s%theme.colors.chart.length],bw=step*.7/b.series.length;return <g key={series.name} aria-label={series.name}>{b.chartType==='line'&&<polyline points={series.values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')} fill="none" stroke={color} strokeWidth="3"/>}{series.values.map((v,i)=>b.chartType==='bar'?<rect key={i} data-value={v} x={x(i)-step*.35+s*bw+2} y={Math.min(y(v),y(0))} width={Math.max(1,bw-4)} height={Math.abs(y(v)-y(0))} rx="3" fill={color}/>:<circle key={i} data-value={v} cx={x(i)} cy={y(v)} r="5" fill={color}/>)}<rect x={left+s*160} y={h-19} width="10" height="10" rx="2" fill={color}/><text x={left+s*160+16} y={h-10} fontSize="14" fill={theme.colors.text}>{series.name}</text></g>;})}
  </svg>;
}
export function ImagePanel({element,theme}:VisualProps){const b=element.block;if(b.type!=='image')return null;return <figure style={{margin:0,height:'100%',display:'flex',flexDirection:'column',gap:12}}><img src={b.src} alt={b.alt} data-natural-width={b.naturalWidth} data-natural-height={b.naturalHeight} style={{width:'100%',height:b.caption?'calc(100% - 42px)':'100%',minHeight:0,objectFit:b.fit,borderRadius:theme.radius}}/>{b.caption&&<figcaption style={{fontSize:theme.typography.small,color:theme.colors.muted}}>{b.caption}</figcaption>}</figure>;}
function Content({element,theme}:VisualProps){switch(element.block.type){case 'formula':return <FormulaBlock element={element} theme={theme}/>;case 'process':return <ProcessFlow element={element} theme={theme}/>;case 'architecture':return <ArchitectureDiagram element={element} theme={theme}/>;case 'table':return <ComparisonTable element={element} theme={theme}/>;case 'chart':return <ChartBlock element={element} theme={theme}/>;case 'image':return <ImagePanel element={element} theme={theme}/>;case 'text':return <div style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',lineHeight:element.role==='title'?1.16:1.5,fontWeight:element.role==='title'?700:400,letterSpacing:element.role==='title'?'-0.035em':undefined}}>{element.block.text}</div>;}}
export function SlideView({slide,theme}:{slide:LayoutSlide;theme:Theme}){
 return <section className={`rk-slide rk-${slide.source.type}`} data-slide-id={slide.id} data-renderkit-slide={slide.id} aria-label={slide.title} style={{width:slide.width,height:slide.height,position:'relative',overflow:'hidden',background:theme.colors.background,color:theme.colors.text,fontFamily:theme.typography.fontFamily,boxSizing:'border-box'}}>
  <div aria-hidden="true" style={{position:'absolute',left:0,top:0,width:8,height:'100%',background:theme.colors.primary}}/>
  {slide.elements.map(element=><div key={element.id} data-element-id={element.id} data-slide-id={slide.id} data-role={element.role} data-kind={element.kind} data-allow-overlap={element.allowOverlap?'true':'false'} style={{position:'absolute',left:element.x,top:element.y,width:element.width,height:element.height,fontSize:element.fontSize,color:element.color,background:element.background,boxSizing:'border-box'}}><div data-content="true" style={{height:element.block.type==='text'?undefined:'100%',minHeight:0,boxSizing:'border-box'}}><Content element={element} theme={theme}/></div></div>)}
 </section>;
}
export const TitleSlide=SlideView;
export const ContentSlide=SlideView;
export const TwoColumn=SlideView;
export const SummarySlide=SlideView;
export function DeckView({layout}:{layout:LayoutDeck}){return <main className="rk-deck" data-deck-id={layout.deck.id}>{layout.slides.map(slide=><SlideView key={slide.id} slide={slide} theme={layout.theme}/>)}</main>;}
