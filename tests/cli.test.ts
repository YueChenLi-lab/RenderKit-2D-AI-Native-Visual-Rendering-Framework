import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileEvidence,prepareOutput } from '../packages/cli/src/artifacts.js';
import JSZip from 'jszip';
let temp:string;
beforeAll(async()=>{await mkdir('.cache',{recursive:true});temp=await mkdtemp(join(process.cwd(),'.cache/cli-tests-'));});
afterAll(async()=>{await rm(temp,{recursive:true,force:true});});
describe('artifact integrity and retained versions',()=>{
 it('retains exact source bytes and archives earlier generated versions',async()=>{
  const input=join(temp,'source.json'),out=join(temp,'retained');const raw='{"slides":[]}\n';await writeFile(input,raw);await prepareOutput(input,out);
  await writeFile(join(out,'repaired.json'),'old derived version');await writeFile(join(out,'audit-report.json'),'old report');
  await prepareOutput(input,out);const versions=await readdir(join(out,'versions'));expect(versions).toHaveLength(1);
  expect(await readFile(join(out,'versions',versions[0],'repaired.json'),'utf8')).toBe('old derived version');
  const snapshot=(await readdir(out)).find(name=>name.startsWith('source-'))!;expect(await readFile(join(out,snapshot),'utf8')).toBe(raw);expect(await readFile(input,'utf8')).toBe(raw);
 });
 it('refuses to overwrite an input that is also a generated output',async()=>{
  const out=join(temp,'guard');await mkdir(out);const input=join(out,'repaired.json');await writeFile(input,'original');
  await expect(prepareOutput(input,out)).rejects.toThrow('overwrite');expect(await readFile(input,'utf8')).toBe('original');
 });
 it('rejects missing files, corrupt ZIPs and malformed Office XML',async()=>{
  await expect(fileEvidence(join(temp,'missing.pptx'))).rejects.toThrow();const bad=join(temp,'bad.pptx');await writeFile(bad,'not a zip');await expect(fileEvidence(bad)).rejects.toThrow();
  const zip=new JSZip();zip.file('[Content_Types].xml','<Types/>');zip.file('ppt/presentation.xml','<presentation/>');zip.file('ppt/slides/slide1.xml','<slide><broken></slide>');await writeFile(bad,await zip.generateAsync({type:'nodebuffer'}));await expect(fileEvidence(bad)).rejects.toThrow('Invalid');
 });
});
