import type { Block } from '../../schema/src/index.js';
import type { LayoutDeck, LayoutElement } from '../../core/src/types.js';

export type IssueCategory = 'text-overflow'|'out-of-bounds'|'overlap'|'image-distortion'|'font-size'|'contrast'|'missing-content'|'artifact';
export interface AuditIssue {issueId:string;elementId:string;slideId:string;category:IssueCategory;severity:'error'|'warning';description:string;evidence:Record<string,unknown>;recommendedFix:string;status:'open'|'fixed'|'manual-review';}
export interface DomObservation {slideId:string;elementId:string;x:number;y:number;width:number;height:number;scrollWidth:number;scrollHeight:number;clientWidth:number;clientHeight:number;fontSize:number;color:string;background:string;image?:{naturalWidth:number;naturalHeight:number;renderedWidth:number;renderedHeight:number;objectFit:string};text?:string;renderErrors?:string[];chartValues?:number[];tableCells?:string[];}
export interface SlideQuality {slideId:string;alignment:number;whitespace:number;density:number;hierarchy:number;colorConsistency:number;balance:number;score:number;}
export interface AuditReport {version:'0.1';generatedAt:string;method:'geometry'|'browser+geometry';passed:boolean;score:number;issues:AuditIssue[];quality:SlideQuality[];limitations:string[];}
export interface AuditOptions {contrastMinimum?:number;overlapTolerance?:number;weights?:Partial<Record<'alignment'|'whitespace'|'hierarchy'|'colorConsistency'|'balance',number>>;}

function channels(color:string):number[]{
 if(/^#[0-9a-f]{6}$/i.test(color))return [1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
 const match=color.match(/^rgba?\(([^)]+)\)/);return match?match[1].split(',').slice(0,3).map(Number):[0,0,0];
}
export function contrastRatio(foreground:string,background:string):number {
 const luminance=(color:string)=>channels(color).map(c=>{const v=c/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[0.2126,0.7152,0.0722][i],0);
 const a=luminance(foreground),b=luminance(background);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}
function stableValue(value:unknown):unknown {if(Array.isArray(value))return value.map(stableValue);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,stableValue(item)]));return value;}
function semanticPayload(block:Block):string {const {layout: _layout,fontSize: _fontSize,color: _color,...payload}=block;return JSON.stringify(stableValue(payload));}
function intersection(a:LayoutElement,b:LayoutElement):number{return Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));}
export function estimateTextHeight(text:string,width:number,fontSize:number,lineHeight=1.5):number {
 const available=Math.max(1,width);
 const lines=text.split('\n').reduce((count,line)=>{const units=[...line].reduce((n,c)=>n+(/[^\x00-\xff]/.test(c)?1:0.54),0);return count+Math.max(1,Math.ceil(units*fontSize/available));},0);
 return lines*fontSize*lineHeight;
}
export function auditLayout(layout:LayoutDeck,observations?:DomObservation[],options:AuditOptions={}):AuditReport {
 const issues:AuditIssue[]=[],quality:SlideQuality[]=[];
 const add=(elementId:string,slideId:string,category:IssueCategory,description:string,evidence:Record<string,unknown>,recommendedFix:string,severity:'error'|'warning'='error')=>{
  if(issues.some(i=>i.elementId===elementId&&i.slideId===slideId&&i.category===category))return;
  issues.push({issueId:`${slideId}:${elementId}:${category}`,elementId,slideId,category,severity,description,evidence,recommendedFix,status:'open'});
 };
 for(const slide of layout.slides){
  const content=slide.elements.filter(e=>e.role==='content');
  for(const block of slide.source.blocks){
   const rendered=content.find(e=>e.id===block.id);
   if(block.required&&!rendered)add(block.id,slide.id,'missing-content','Required source block has no rendered element.',{},'Restore the required block from the original input.');
   if(rendered&&semanticPayload(block)!==semanticPayload(rendered.block))add(block.id,slide.id,'missing-content','Rendered semantic payload differs from the source content.',{sourceType:block.type,renderedType:rendered.block.type},'Restore the original data, formula, text and evidence before exporting.');
  }
  for(const id of slide.source.constraints.preserve){if(!content.some(e=>e.id===id))add(id,slide.id,'missing-content','Explicitly preserved content is missing.',{},'Restore preserved content; never delete it to improve layout.');}
  for(const el of slide.elements){
   const observed=observations?.find(o=>o.elementId===el.id&&o.slideId===slide.id);
   const bounds=observed??el;
   if(![bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite)||bounds.width<=0||bounds.height<=0)add(el.id,slide.id,'out-of-bounds','Element geometry is non-finite or non-positive.',{box:bounds},'Use finite positions and positive box dimensions.');
   if(bounds.x < -1 || bounds.y < -1 || bounds.x+bounds.width > slide.width+1 || bounds.y+bounds.height > slide.height+1)add(el.id,slide.id,'out-of-bounds','Element extends outside the slide.',{box:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height},slide:{width:slide.width,height:slide.height}},'Move or resize the element inside the page.');
   const font=observed?.fontSize??el.fontSize;
   if(font<layout.deck.render.minFontSize-0.1||font>layout.deck.render.maxFontSize+0.1)add(el.id,slide.id,'font-size','Font size is outside the configured safe range.',{fontSize:font,min:layout.deck.render.minFontSize,max:layout.deck.render.maxFontSize},'Use a font size inside the safe range.');
   const contrast=contrastRatio(observed?.color??el.color,observed?.background??el.background??layout.theme.colors.background);
   if(contrast<(options.contrastMinimum??4.5)-0.01)add(el.id,slide.id,'contrast','Text contrast is below the configured threshold.',{ratio:Number(contrast.toFixed(2)),minimum:options.contrastMinimum??4.5},'Use the theme text color or a higher contrast surface.');
   if(observed){
    if(el.block.type==='text'&&observed.text!==undefined&&observed.text!==el.block.text)add(el.id,slide.id,'missing-content','Rendered text does not match its semantic source.',{},'Restore the complete source text without rewriting or truncating it.');
    if(el.block.type==='chart'&&observed.chartValues!==undefined&&JSON.stringify(observed.chartValues)!==JSON.stringify(el.block.series.flatMap(series=>series.values)))add(el.id,slide.id,'missing-content','Rendered chart values do not match the source data.',{expected:el.block.series.flatMap(series=>series.values),actual:observed.chartValues},'Restore the exact original numeric data mapping.');
    if(el.block.type==='table'&&observed.tableCells!==undefined&&JSON.stringify(observed.tableCells)!==JSON.stringify([...el.block.columns,...el.block.rows.flat().map(String)]))add(el.id,slide.id,'missing-content','Rendered table cells do not match the source data.',{},'Restore all original table headers and values.');
    if(observed.renderErrors?.length)add(el.id,slide.id,'missing-content','The browser could not render required content.',{renderErrors:observed.renderErrors},'Correct the input or renderer error; do not treat its diagnostic placeholder as the intended content.');
    if(observed.scrollHeight>observed.clientHeight+2||observed.scrollWidth>observed.clientWidth+2)add(el.id,slide.id,'text-overflow','Browser content exceeds its allocated box.',{scrollWidth:observed.scrollWidth,scrollHeight:observed.scrollHeight,clientWidth:observed.clientWidth,clientHeight:observed.clientHeight},'Increase available space, reduce font within safe bounds, or move the block to another slide.');
    const img=observed.image;
    if(img){const natural=img.naturalWidth/img.naturalHeight,rendered=img.renderedWidth/img.renderedHeight;if(el.block.type==='image'&&img.naturalWidth>0&&img.naturalHeight>0&&Math.abs((el.block.naturalWidth/el.block.naturalHeight)/natural-1)>0.02)add(el.id,slide.id,'image-distortion','Declared image proportions disagree with the decoded image.',{declaredRatio:el.block.naturalWidth/el.block.naturalHeight,decodedRatio:natural},'Correct intrinsic size metadata from the original image to keep Web and PPTX proportions consistent.');if(img.objectFit==='fill'&&Math.abs(rendered/natural-1)>0.02)add(el.id,slide.id,'image-distortion','Image is stretched away from its intrinsic aspect ratio.',{naturalRatio:natural,renderedRatio:rendered,objectFit:img.objectFit},'Use contain or proportional dimensions.');}
   } else if(observations){
    add(el.id,slide.id,'missing-content','Expected element was not found in the browser DOM.',{},'Check renderer element IDs and restore missing content.');
   } else if(el.block.type==='text'){
    const estimated=estimateTextHeight(el.block.text,el.width,el.fontSize,el.role==='title'?1.16:1.5);
    if(estimated>el.height+4)add(el.id,slide.id,'text-overflow','Estimated text height exceeds the layout box; browser measurement is authoritative.',{estimatedHeight:Math.round(estimated),availableHeight:el.height,estimated:true},'Increase container height or reduce text font safely; confirm using browser measurement.');
   }
   const block=el.block;
   if(block.type==='chart'&&block.series.some(s=>s.values.length!==block.labels.length))add(el.id,slide.id,'missing-content','Chart values do not align with the category labels.',{},'Correct the data mapping from original input, without inventing values.');
  }
  for(let i=0;i<slide.elements.length;i++)for(let j=i+1;j<slide.elements.length;j++){
   const a=slide.elements[i],b=slide.elements[j];
   if(a.allowOverlap||b.allowOverlap)continue;
   const oa=observations?.find(o=>o.elementId===a.id&&o.slideId===slide.id),ob=observations?.find(o=>o.elementId===b.id&&o.slideId===slide.id);
   const area=intersection({...a,...oa},{...b,...ob});
   if(area>(options.overlapTolerance??4))add(b.id,slide.id,'overlap','Two independent content elements overlap.',{otherElementId:a.id,intersectionArea:Math.round(area)},'Separate the boxes, or explicitly mark intentional layering with allowOverlap.');
  }
  const area=slide.width*slide.height,density=Math.min(1,content.reduce((n,e)=>n+e.width*e.height,0)/area);
  const alignment=content.length<2?1:content.filter(e=>content.some(other=>other.id!==e.id&&(Math.abs(other.x-e.x)<3||Math.abs(other.y-e.y)<3))).length/content.length;
  const whitespace=1-density;
  const title=slide.elements.find(e=>e.role==='title');
  const hierarchy=title&&content.length?Math.min(1,title.fontSize/Math.max(...content.map(e=>e.fontSize))/1.6):1;
  const palette=new Set([layout.theme.colors.text,layout.theme.colors.muted,layout.theme.colors.primary,layout.theme.colors.secondary]);
  const colorConsistency=slide.elements.filter(e=>palette.has(e.color)).length/Math.max(1,slide.elements.length);
  const totalArea=content.reduce((n,e)=>n+e.width*e.height,0)||1;
  const center=content.reduce((n,e)=>n+(e.x+e.width/2)*e.width*e.height,0)/totalArea;
  const balance=content.length?Math.max(0,1-Math.abs(center-slide.width/2)/(slide.width/2)):1;
  const values={alignment,whitespace:Math.min(1,whitespace/0.25),hierarchy,colorConsistency,balance};
  const weights={alignment:1,whitespace:1,hierarchy:1,colorConsistency:1,balance:1,...options.weights};
  const sum=Object.values(weights).reduce((a,b)=>a+Math.max(0,b),0)||1;
  const score=Math.round(Object.entries(values).reduce((n,[key,value])=>n+value*Math.max(0,weights[key as keyof typeof values]),0)/sum*100);
  quality.push({slideId:slide.id,alignment,whitespace,density,hierarchy,colorConsistency,balance,score});
  if(density>slide.source.constraints.maxDensity)add(slide.id,slide.id,'text-overflow','Content box density exceeds the slide constraint.',{density,maxDensity:slide.source.constraints.maxDensity},'Reduce occupied area or move intact blocks to a continuation slide.','warning');
 }
 return {version:'0.1',generatedAt:new Date().toISOString(),method:observations?'browser+geometry':'geometry',passed:!issues.some(i=>i.severity==='error'),score:Math.round(quality.reduce((n,q)=>n+q.score,0)/Math.max(1,quality.length)),issues,quality,limitations:[observations?'DOM checks measure browser layout, not PowerPoint rendering.':'Text fitting is estimated without a browser. Run browser capture for measured results.','Nested chart tick and diagram annotation font sizes are not yet independently checked against the body font range.','Quality scores are geometric heuristics, not proof of evidence accuracy or subjective aesthetic quality.']};
}
