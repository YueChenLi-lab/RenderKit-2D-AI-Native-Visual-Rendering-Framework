import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir,readFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import type { DomObservation } from './audit.js';

export async function captureBrowser(htmlPath:string,outputDir:string):Promise<{observations:DomObservation[];screenshots:string[]}>{
 await mkdir(outputDir,{recursive:true});
 const configured=process.env.RENDERKIT_CHROMIUM_PATH;
 const executablePath=configured??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 const browser=await chromium.launch({headless:true,executablePath});
 try {
  const page=await browser.newPage({viewport:{width:1400,height:900},deviceScaleFactor:1});
  // Input assets are embedded. Refuse any accidental external fetch during audit.
  await page.route(/^https?:/,route=>route.abort());
  await page.setContent(await readFile(resolve(htmlPath),'utf8'),{waitUntil:'load'});
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(img=>img.complete?Promise.resolve():new Promise<void>(done=>{img.onload=()=>done();img.onerror=()=>done();})));});
  const observations=await page.locator('[data-element-id][data-slide-id]').evaluateAll(elements=>elements.map(node=>{
   const el=node as HTMLElement;
   const slide=el.closest('[data-renderkit-slide]') as HTMLElement;
   if(!slide)throw new Error('Missing data-renderkit-slide parent');
   const r=el.getBoundingClientRect(),s=slide.getBoundingClientRect(),style=getComputedStyle(el);
   const scaleX=s.width/(slide.offsetWidth||s.width),scaleY=s.height/(slide.offsetHeight||s.height);
   const content=el.querySelector('[data-content]') as HTMLElement|null;
   const cr=content?.getBoundingClientRect();
   let bg=style.backgroundColor,parent:HTMLElement|null=el;
   while((bg==='rgba(0, 0, 0, 0)'||bg==='transparent')&&parent?.parentElement){parent=parent.parentElement;bg=getComputedStyle(parent).backgroundColor;}
   const img=el.querySelector('img'),ir=img?.getBoundingClientRect();
   const renderErrors:string[]=[];
   const formulaError=el.querySelector('[data-formula-error]');
   if(formulaError)renderErrors.push(formulaError.textContent??'Formula rendering failed.');
   if(img&&(!img.complete||img.naturalWidth===0||img.naturalHeight===0))renderErrors.push('Embedded image did not decode.');
   // SVG viewports can clip glyphs without expanding scrollWidth/scrollHeight.
   // Measure text and formula/caption bounds in addition to the outer viewport.
   let contentWidth=0,contentHeight=0;
   for(const child of el.querySelectorAll('svg text, [data-formula], figcaption')){
    const rect=child.getBoundingClientRect();
    contentWidth=Math.max(contentWidth,(rect.right-r.left)/scaleX,(r.right-rect.left)/scaleX);
    contentHeight=Math.max(contentHeight,(rect.bottom-r.top)/scaleY,(r.bottom-rect.top)/scaleY);
   }
   return {elementId:el.dataset.elementId!,slideId:el.dataset.slideId!,x:(r.x-s.x)/scaleX,y:(r.y-s.y)/scaleY,width:r.width/scaleX,height:r.height/scaleY,scrollWidth:Math.max(el.scrollWidth,content?.scrollWidth??0,cr?cr.width/scaleX:0,contentWidth),scrollHeight:Math.max(el.scrollHeight,content?.scrollHeight??0,cr?cr.height/scaleY:0,contentHeight),clientWidth:el.clientWidth,clientHeight:el.clientHeight,fontSize:parseFloat(style.fontSize),color:style.color,background:bg,text:el.textContent??'',renderErrors,chartValues:el.dataset.kind==='chart'?Array.from(el.querySelectorAll('[data-value]')).map(point=>Number(point.getAttribute('data-value'))):undefined,tableCells:el.dataset.kind==='table'?Array.from(el.querySelectorAll('th,td')).map(cell=>cell.textContent??''):undefined,image:img&&ir?{naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,renderedWidth:ir.width/scaleX,renderedHeight:ir.height/scaleY,objectFit:getComputedStyle(img).objectFit}:undefined};
  }));
  const screenshots:string[]=[];
  const slides=page.locator('[data-renderkit-slide]');
  for(let i=0;i<await slides.count();i++){const file=join(resolve(outputDir),`slide-${String(i+1).padStart(2,'0')}.png`);await slides.nth(i).screenshot({path:file});screenshots.push(file);}
  if(!screenshots.length)throw new Error('No slides were found in generated HTML.');
  return {observations,screenshots};
 }finally{await browser.close();}
}
