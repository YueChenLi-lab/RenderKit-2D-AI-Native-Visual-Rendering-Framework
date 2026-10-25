import { describe,it,expect,beforeAll,afterAll } from 'vitest';
import { mkdtemp,readFile,rm,mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { parseDeck, type Deck } from '../packages/schema/src/index.js';
import { layoutDeck } from '../packages/core/src/index.js';
import { renderDeckHtml } from '../packages/renderer-web/src/index.js';
import { renderPptx } from '../packages/renderer-pptx/src/index.js';
import { tinyPng } from './fixtures.js';
let temp:string;
beforeAll(async()=>{await mkdir('.cache',{recursive:true});temp=await mkdtemp(join(process.cwd(),'.cache/renderer-regressions-'));});
afterAll(async()=>{await rm(temp,{recursive:true,force:true});});
async function zipFor(deck:Deck,name:string){const path=join(temp,`${name}.pptx`);await renderPptx(layoutDeck(deck),path);return JSZip.loadAsync(await readFile(path),{checkCRC32:true});}
const parser=new DOMParser();
const values=(xml:string,kind:string)=>Array.from(parser.parseFromString(xml,'text/xml').getElementsByTagName(`c:${kind}`)).map(node=>Array.from(node.getElementsByTagName('c:pt')).map(pt=>Number(pt.getElementsByTagName('c:v')[0]?.textContent)));
describe('renderer correctness regressions',()=>{
 it('rejects invalid formulas during HTML export',()=>{const deck=parseDeck({id:'invalid',title:'Math',slides:[{id:'math',title:'Math',blocks:[{id:'formula',type:'formula',latex:'\\notARealMacro{x}'}]}]});expect(()=>renderDeckHtml(layoutDeck(deck))).toThrow(/Formula formula could not render/);});
 it.each(['bar','line','scatter'] as const)('preserves negative and zero values in native %s charts',async(chartType)=>{const d=parseDeck({id:'charts',title:'Chart values',slides:[{id:'chart-slide',title:'Values',blocks:[{id:'chart',type:'chart',chartType,labels:['10','20','30'],series:[{name:'Mixed',values:[-2,0,3]},{name:'Zero',values:[0,0,0]}]}]}]});const original=structuredClone(d);const html=renderDeckHtml(layoutDeck(d));expect(html).toContain('data-value="-2"');expect(html.slice(html.indexOf('<body>'))).not.toMatch(/NaN|Infinity/);const zip=await zipFor(d,chartType);const chartPath=Object.keys(zip.files).find(path=>/^ppt\/charts\/chart\d+\.xml$/.test(path))!;const chart=await zip.file(chartPath)!.async('string');expect(values(chart,chartType==='scatter'?'yVal':'val')).toEqual([[-2,0,3],[0,0,0]]);if(chartType==='scatter')expect(values(chart,'xVal')).toEqual([[1,2,3],[1,2,3]]);expect(d).toEqual(original);});
 it.each(['contain','cover'] as const)('uses actual image ratio and preserves %s behavior in PPTX',async(fit)=>{const d=parseDeck({id:'images',title:'Image ratio',slides:[{id:'image-slide',title:'Actual pixels',blocks:[{id:'image',type:'image',src:tinyPng,alt:'Square pixels',naturalWidth:200,naturalHeight:100,fit,layout:{x:64,y:200,width:400,height:200}}]}]});const zip=await zipFor(d,fit);const xml=await zip.file('ppt/slides/slide1.xml')!.async('string');const doc=parser.parseFromString(xml,'text/xml');const pic=doc.getElementsByTagName('p:pic')[0]!;const extent=pic.getElementsByTagName('a:ext')[0]!;const ratio=Number(extent.getAttribute('cx'))/Number(extent.getAttribute('cy'));if(fit==='contain')expect(ratio).toBeCloseTo(1,5);else{expect(ratio).toBeCloseTo(2,5);const crop=pic.getElementsByTagName('a:srcRect')[0]!;expect(crop.getAttribute('t')).toBe('25000');expect(crop.getAttribute('b')).toBe('25000');}});
 it('keeps 16-node cyclic architecture boxes positive and includes every node',()=>{const nodes=Array.from({length:16},(_,i)=>({id:`n${i}`,label:`Node ${i}`}));const d=parseDeck({id:'graph',title:'Graph',slides:[{id:'graph-slide',title:'Cycle',blocks:[{id:'architecture',type:'architecture',nodes,edges:nodes.map((n,i)=>({from:n.id,to:nodes[(i+1)%nodes.length]!.id}))}]}]});const html=renderDeckHtml(layoutDeck(d));expect(html).not.toMatch(/height="-\d/);for(const n of nodes)expect(html).toContain(`data-node-id="${n.id}"`);});
});
