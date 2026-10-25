#!/usr/bin/env node
import { Command } from 'commander';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, join, extname, basename } from 'node:path';
import { createServer } from 'node:http';
import { fileEvidence, prepareOutput as prepare } from './artifacts.js';
import { parseInput, RuleBasedNarrativePlanner } from '../../narrative/src/index.js';
import { layoutDeck } from '../../core/src/index.js';
import { parseDeck, type Deck } from '../../schema/src/index.js';
import { renderDeckHtml } from '../../renderer-web/src/index.js';
import { renderPptx } from '../../renderer-pptx/src/index.js';
import { auditLayout, captureBrowser, repairDeck, type AuditReport } from '../../auditor/src/index.js';

const program=new Command().name('renderkit').description('RenderKit 2D — offline semantic rendering, audit and repair').version('0.1.0');
async function load(input:string):Promise<Deck>{
 const path=resolve(input);
 if((await stat(path)).size>10*1024*1024)throw new Error('Input exceeds the 10 MiB CLI limit');
 const raw=await readFile(path,'utf8');
 return new RuleBasedNarrativePlanner().plan(parseInput(raw,/\.md$/i.test(input)?'markdown':'json'));
}
async function json(path:string,data:unknown){await writeFile(path,JSON.stringify(data,null,2)+'\n');}
function reportStatus(report:AuditReport){console.log(`Audit: ${report.passed?'PASS':'FAIL'}; ${report.issues.length} issue(s); heuristic score ${report.score}/100`);if(!report.passed)process.exitCode=2;}
program.command('build').argument('<input>').option('--target <target>','web, pptx or all','all').option('--out <directory>','output directory','artifacts/build').option('--screenshots','capture all slides and audit browser geometry').action(async(input:string,options:{target:string;out:string;screenshots?:boolean})=>{
 if(!['web','pptx','all'].includes(options.target))throw new Error('Target must be web, pptx or all');
 const deck=await load(input),dir=await prepare(input,options.out),layout=layoutDeck(deck);
 await json(join(dir,'planned.json'),deck);
 const artifacts=[];
 if(options.target!=='pptx'||options.screenshots){const path=join(dir,'index.html');await writeFile(path,renderDeckHtml(layout));artifacts.push(await fileEvidence(path));}
 if(options.target!=='web'){const path=join(dir,'deck.pptx');await renderPptx(layout,path);artifacts.push(await fileEvidence(path));}
 let report=auditLayout(layout);
 if(options.screenshots){const result=await captureBrowser(join(dir,'index.html'),join(dir,'screenshots'));report=auditLayout(layout,result.observations);for(const shot of result.screenshots)artifacts.push(await fileEvidence(shot));}
 await json(join(dir,'audit-report.json'),report);
 await json(join(dir,'manifest.json'),{version:'0.1',createdAt:new Date().toISOString(),slideCount:deck.slides.length,artifacts,pptxVisualValidation:'not performed; package structure checked',audit:report.passed?'passed':'failed'});
 console.log(`Built ${deck.slides.length} slides in ${dir}`);reportStatus(report);
});
program.command('audit').argument('<input>').option('--out <directory>','output directory','artifacts/audit').option('--browser','measure the actual DOM and capture PNGs').action(async(input:string,options:{out:string;browser?:boolean})=>{
 const deck=await load(input),dir=await prepare(input,options.out),layout=layoutDeck(deck);let report=auditLayout(layout);
 if(options.browser){await writeFile(join(dir,'index.html'),renderDeckHtml(layout));const result=await captureBrowser(join(dir,'index.html'),join(dir,'screenshots'));report=auditLayout(layout,result.observations);}
 await json(join(dir,'audit-report.json'),report);reportStatus(report);
});
program.command('repair').argument('<input>').option('--out <directory>','output directory','artifacts/repair').option('--max-iterations <count>','bounded repair iterations','3').option('--element <id>','repair a single stable component ID').option('--browser','re-audit the repaired HTML in Chromium').action(async(input:string,options:{out:string;maxIterations:string;element?:string;browser?:boolean})=>{
 const iterations=Number(options.maxIterations);if(!Number.isInteger(iterations)||iterations<0||iterations>10)throw new Error('--max-iterations must be an integer from 0 to 10');
 const deck=await load(input),dir=await prepare(input,options.out),result=repairDeck(deck,{maxIterations:iterations,elementId:options.element});
 await json(join(dir,'repaired.json'),parseDeck(result.deck));await json(join(dir,'repair-history.json'),{iterations:result.iterations,changes:result.changes,history:result.history});
 await writeFile(join(dir,'index.html'),renderDeckHtml(layoutDeck(result.deck)));
 let report=result.report;
 if(options.browser){const capture=await captureBrowser(join(dir,'index.html'),join(dir,'screenshots'));report=auditLayout(layoutDeck(result.deck),capture.observations);report.issues=report.issues.map(issue=>({...issue,status:issue.severity==='error'?'manual-review':issue.status}));}
 await json(join(dir,'audit-report.json'),report);
 console.log(`Repair iterations: ${result.iterations}. Original input retained.`);reportStatus(report);
});
program.command('preview').argument('<input>').option('--port <number>','local HTTP port','4173').action(async(input:string,options:{port:string})=>{
 const port=Number(options.port);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid port');
 const html=renderDeckHtml(layoutDeck(await load(input)));
 const server=createServer((req,res)=>{if(req.method!=='GET'||req.url!=='/'){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:;"});res.end(html);});
 server.listen(port,'127.0.0.1',()=>console.log(`Preview server listening on port ${port}. Press Ctrl+C to stop.`));
 const stop=()=>server.close();process.on('SIGINT',stop);process.on('SIGTERM',stop);
});
program.parseAsync().catch((error:unknown)=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
