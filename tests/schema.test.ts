import { describe,expect,it } from 'vitest';
import { parseDeck, DeckSchema } from '../packages/schema/src/index.js';
import { getTheme } from '../packages/design-system/src/index.js';
import { layoutDeck } from '../packages/core/src/index.js';
import { fixture } from './fixtures.js';
describe('validated shared IR',()=>{
 it('accepts supported data and fills repeatable rendering defaults',()=>{const d=fixture();expect(d.render).toEqual({width:1280,height:720,minFontSize:18,maxFontSize:64});expect(DeckSchema.parse(d)).toEqual(d);});
 it.each([{width:0},{height:-1},{x:Infinity},{width:NaN}])('rejects invalid layout %o',layout=>{const d=fixture();d.slides[0]!.blocks[0]!.layout=layout;expect(()=>parseDeck(d)).toThrow();});
 it('rejects duplicate IDs across slides',()=>{const d=fixture();d.slides[1]!.blocks[0]!.id='body';expect(()=>parseDeck(d)).toThrow(/Duplicate/);});
 it('rejects missing preservation requirements',()=>{const d=fixture();d.slides[0]!.constraints.preserve.push('missing');expect(()=>parseDeck(d)).toThrow(/Preserved block missing/);});
 it('rejects chart data length mismatch and ragged tables',()=>{const d=fixture();const b=d.slides[1]!.blocks[1]!;if(b.type==='chart')b.series[0]!.values.pop();expect(()=>parseDeck(d)).toThrow(/length mismatch/);const t=fixture();const tb=t.slides[1]!.blocks[0]!;if(tb.type==='table')tb.rows[0]!.pop();expect(()=>parseDeck(t)).toThrow(/row width mismatch/);});
 it('rejects dangling directed edges',()=>{const d=fixture();const b=d.slides[3]!.blocks[0]!;if(b.type==='architecture')b.edges[0]!.to='missing';expect(()=>parseDeck(d)).toThrow(/edge references/);});
 it('rejects scripts and remote URLs as image input',()=>{for(const src of ['javascript:alert(1)','https://example.com/image.png','data:image/svg+xml,<svg onload="alert(1)"/>']){const d=fixture();const b=d.slides[2]!.blocks[0]!;if(b.type==='image')b.src=src;expect(()=>parseDeck(d)).toThrow();}});
 it('switches theme without mutating source content',()=>{const d=fixture();const before=structuredClone(d);const academic=layoutDeck(d);const tech=layoutDeck({...d,theme:'tech-dashboard'});expect(academic.theme.colors.background).not.toBe(tech.theme.colors.background);expect(tech.deck.slides).toEqual(d.slides);expect(d).toEqual(before);expect(tech.slides.flatMap(s=>s.elements).filter(e=>e.role==='content').map(e=>e.id)).toEqual(d.slides.flatMap(s=>s.blocks).map(b=>b.id));});
 it('returns independent theme values',()=>{const one=getTheme('academic-minimal');one.colors.text='#FFFFFF';expect(getTheme('academic-minimal').colors.text).not.toBe('#FFFFFF');});
});
