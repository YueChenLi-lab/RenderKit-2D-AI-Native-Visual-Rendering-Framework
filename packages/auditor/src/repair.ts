import { layoutDeck } from '../../core/src/index.js';
import { DeckSchema,type Deck } from '../../schema/src/index.js';
import { auditLayout,estimateTextHeight,type AuditReport } from './audit.js';
export interface RepairChange {iteration:number;slideId:string;elementId:string;action:string;before:unknown;after:unknown;}
export interface RepairResult {deck:Deck;report:AuditReport;iterations:number;history:AuditReport[];changes:RepairChange[];}
export function repairDeck(input:Deck,options:{maxIterations?:number;elementId?:string}={}):RepairResult{
 const deck=DeckSchema.parse(structuredClone(input));
 const maxIterations=options.maxIterations??4;
 if(!Number.isInteger(maxIterations)||maxIterations<0||maxIterations>10)throw new Error('maxIterations must be an integer between 0 and 10.');
 if(options.elementId&&!deck.slides.some(s=>s.blocks.some(b=>b.id===options.elementId)))throw new Error(`Unknown element ID: ${options.elementId}`);
 const history:AuditReport[]=[],changes:RepairChange[]=[];
 let iterations=0;
 for(let attempt=0;attempt<=maxIterations;attempt++){
  const layout=layoutDeck(deck),report=auditLayout(layout);history.push(report);
  if(report.passed||attempt===maxIterations)break;
  let changed=false;
  for(const slide of [...deck.slides]){
   const ls=layout.slides.find(s=>s.id===slide.id)!;
   for(const block of [...slide.blocks]){
    if(options.elementId&&block.id!==options.elementId)continue;
    const el=ls.elements.find(e=>e.id===block.id);if(!el)continue;
    const issues=report.issues.filter(i=>i.slideId===slide.id&&i.elementId===block.id&&i.severity==='error');
    if(!issues.length)continue;
    const before=structuredClone({layout:block.layout,fontSize:block.fontSize,color:block.color});
    let box={x:el.x,y:el.y,width:el.width,height:el.height},font=el.fontSize;
    if(issues.some(i=>i.category==='font-size'))font=Math.max(deck.render.minFontSize,Math.min(deck.render.maxFontSize,font));
    if(issues.some(i=>i.category==='out-of-bounds')){
     box.width=Math.min(box.width,ls.width-2*layout.theme.spacing.page);box.height=Math.min(box.height,ls.height-240);
     box.x=Math.max(layout.theme.spacing.page,Math.min(ls.width-layout.theme.spacing.page-box.width,box.x));
     box.y=Math.max(180,Math.min(ls.height-64-box.height,box.y));
    }
    if(issues.some(i=>i.category==='text-overflow')&&block.type==='text'){
     const available=ls.height-80-box.y;
     box.height=Math.max(box.height,Math.min(available,estimateTextHeight(block.text,box.width,font)));
     while(font>deck.render.minFontSize&&estimateTextHeight(block.text,box.width,font)>box.height)font=Math.max(deck.render.minFontSize,font-1);
    }
    if(issues.some(i=>i.category==='overlap')){
     const peers=ls.elements.filter(e=>e.id!==el.id&&!e.allowOverlap);
     for(const peer of peers){const overlaps=box.x<peer.x+peer.width&&box.x+box.width>peer.x&&box.y<peer.y+peer.height&&box.y+box.height>peer.y;if(overlaps)box.y=peer.y+peer.height+layout.theme.spacing.gap;}
    }
    const cannotFit=box.y+box.height>ls.height-56||block.type==='text'&&estimateTextHeight(block.text,box.width,font)>box.height+4;
    if(cannotFit&&slide.blocks.length>1){
     // Move the complete semantic block; never rewrite, round, truncate or drop its data.
     let continuationId=`${slide.id}-continuation-${block.id}`;while(deck.slides.some(s=>s.id===continuationId||s.blocks.some(b=>b.id===continuationId)))continuationId+='-next';
     slide.blocks=slide.blocks.filter(b=>b.id!==block.id);
     const preserve=slide.constraints.preserve.filter(id=>id===block.id);slide.constraints.preserve=slide.constraints.preserve.filter(id=>id!==block.id);
     const continuation={...structuredClone(slide),id:continuationId,title:`${slide.title} (continued)`,blocks:[block],constraints:{...slide.constraints,preserve}};
     delete block.layout;block.fontSize=font;deck.slides.splice(deck.slides.indexOf(slide)+1,0,continuation);
     changes.push({iteration:attempt+1,slideId:slide.id,elementId:block.id,action:'move-intact-block-to-continuation',before,after:{slideId:continuationId}});changed=true;continue;
    }
    if(cannotFit)continue; // Cannot safely reduce further; leave original content and report it.
    if(issues.some(i=>i.category==='contrast'))block.color=layout.theme.colors.text;
    block.layout=box;block.fontSize=font;
    const after={layout:block.layout,fontSize:block.fontSize,color:block.color};
    if(JSON.stringify(before)!==JSON.stringify(after)){changes.push({iteration:attempt+1,slideId:slide.id,elementId:block.id,action:'adjust-layout-and-style',before,after:structuredClone(after)});changed=true;}
   }
  }
  if(!changed)break;
  iterations=attempt+1;
 }
 const report=auditLayout(layoutDeck(deck));
 report.issues=report.issues.map(issue=>({...issue,status:issue.severity==='error'?'manual-review':issue.status}));
 return {deck,report,iterations,history,changes};
}
