import { describe,expect,it,beforeAll,afterAll } from 'vitest';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { join } from 'node:path';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { layoutDeck } from '../packages/core/src/index.js';
import { renderDeckHtml } from '../packages/renderer-web/src/index.js';
import { renderPptx } from '../packages/renderer-pptx/src/index.js';
import { fixture } from './fixtures.js';
let temp:string;
beforeAll(async()=>{temp=await mkdtemp(join(process.cwd(),'.cache/render-tests-'));});
afterAll(async()=>{if(temp)await rm(temp,{recursive:true,force:true});});
describe('real HTML and PPTX rendering',()=>{
 it('renders real KaTeX, semantic IDs and safely escapes user text',()=>{const d=fixture();d.slides[0]!.title='<script>alert("x")</script>';const html=renderDeckHtml(layoutDeck(d));expect(html).toContain('katex');expect(html).toContain('class="katex');expect(html).toContain('data-element-id="equation"');expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>alert(');expect(html).toContain('0.82');expect(html).toContain('0.91');expect(html).toContain('object-fit:contain');});
 it('packages editable native text, tables, charts, connectors and SVG formulas',async()=>{const out=join(temp,'fixture.pptx');const source=fixture();const unchanged=structuredClone(source);await renderPptx(layoutDeck(source),out);const zip=await JSZip.loadAsync(await readFile(out));const xmlFiles=Object.keys(zip.files).filter(p=>/\.(xml|rels|svg)$/.test(p));expect(xmlFiles.length).toBeGreaterThan(10);for(const path of xmlFiles){const xml=await zip.file(path)!.async('string');const problems:string[]=[];const document=new DOMParser({onError:(level,message)=>{problems.push(`${level}: ${message}`);}}).parseFromString(xml,'application/xml');expect(problems,`Malformed XML: ${path}`).toEqual([]);expect(document.documentElement,`Missing root: ${path}`).not.toBeNull();}expect(zip.file('[Content_Types].xml')).not.toBeNull();expect(zip.file('ppt/presentation.xml')).not.toBeNull();const slides=Object.keys(zip.files).filter(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p));expect(slides).toHaveLength(source.slides.length);const slideXml=(await Promise.all(slides.map(p=>zip.file(p)!.async('string')))).join('\n');expect(slideXml).toContain('Preserve every meaningful claim.');expect(slideXml).toContain('<a:tbl>');expect(slideXml).toContain('graphicData');expect(slideXml).toContain('Parse');expect(slideXml).toContain('Render');const chartFiles=Object.keys(zip.files).filter(p=>/^ppt\/charts\/chart\d+\.xml$/.test(p));expect(chartFiles.length).toBeGreaterThan(0);const chart=(await Promise.all(chartFiles.map(p=>zip.file(p)!.async('string')))).join('');expect(chart).toContain('0.82');expect(chart).toContain('0.91');expect(chart).toContain('barChart');expect(Object.keys(zip.files).some(p=>p.endsWith('.svg'))).toBe(true);expect(Object.keys(zip.files).some(p=>p.endsWith('.png'))).toBe(true);expect(source).toEqual(unchanged);});
});
