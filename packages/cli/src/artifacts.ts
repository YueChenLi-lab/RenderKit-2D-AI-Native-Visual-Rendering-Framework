import { readFile, mkdir, writeFile, rename, realpath, stat } from 'node:fs/promises';
import { resolve, join, basename, extname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
const generated=['index.html','deck.pptx','planned.json','repaired.json','audit-report.json','repair-history.json','manifest.json','screenshots'];
async function exists(path:string){try{await stat(path);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}}
/** Retain the original and archive earlier generated versions before refreshing outputs. */
export async function prepareOutput(input:string,out:string):Promise<string>{
 const originalPath=await realpath(resolve(input));
 await mkdir(resolve(out),{recursive:true});const dir=await realpath(resolve(out));
 for(const name of generated){const path=join(dir,name);if(await exists(path)&&await realpath(path)===originalPath)throw new Error('Output would overwrite the input; choose a different --out directory.');}
 const original=await readFile(originalPath);
 const existing:string[]=[];for(const name of generated)if(await exists(join(dir,name)))existing.push(name);
 if(existing.length){const archive=join(dir,'versions',`${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`);await mkdir(archive,{recursive:true});for(const name of existing)await rename(join(dir,name),join(archive,name));}
 const snapshot=join(dir,`source-${createHash('sha256').update(original).digest('hex').slice(0,12)}${extname(input)}`);
 await writeFile(snapshot,original,{flag:'wx'}).catch((error:NodeJS.ErrnoException)=>{if(error.code!=='EEXIST')throw error;});
 return dir;
}
/** Validate actual bytes and Office XML; this is not a PowerPoint visual check. */
export async function fileEvidence(path:string){
 const bytes=await readFile(path);if(!bytes.length)throw new Error(`Empty artifact: ${path}`);
 if(path.endsWith('.pptx')){
  const zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
  if(!zip.file('[Content_Types].xml')||!zip.file('ppt/presentation.xml')||!Object.keys(zip.files).some(p=>/^ppt\/slides\/slide\d+\.xml$/.test(p)))throw new Error('PPTX package is incomplete');
  for(const [name,file] of Object.entries(zip.files))if(!file.dir&&/\.(xml|rels|svg)$/.test(name)){
   const xml=await file.async('string');
   if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error(`Unexpected DTD in generated artifact: ${name}`);
   new DOMParser({onError:(level,message)=>{throw new Error(`Invalid ${name}: ${level}: ${message}`);}}).parseFromString(xml,'application/xml');
  }
 }
 if(path.endsWith('.html')&&!bytes.toString().includes('data-slide-id'))throw new Error('HTML has no slide content');
 return {path:basename(path),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),status:'passed'};
}
