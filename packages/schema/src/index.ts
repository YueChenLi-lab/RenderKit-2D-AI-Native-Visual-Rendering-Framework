import { z } from 'zod';
export const BoxSchema = z.object({x:z.number().finite(),y:z.number().finite(),width:z.number().positive().finite(),height:z.number().positive().finite()});
const base={id:z.string().min(1),layout:BoxSchema.partial().optional(),fontSize:z.number().min(12).max(72).optional(),color:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),required:z.boolean().default(true)};
const Text=z.object({...base,type:z.literal('text'),text:z.string().min(1)});
const Formula=z.object({...base,type:z.literal('formula'),latex:z.string().min(1),caption:z.string().optional()});
const Node=z.object({id:z.string().min(1),label:z.string().min(1)});
const Edge=z.object({from:z.string(),to:z.string(),label:z.string().optional()});
const Process=z.object({...base,type:z.literal('process'),steps:z.array(z.string().min(1)).min(2).max(12)});
const Architecture=z.object({...base,type:z.literal('architecture'),nodes:z.array(Node).min(1).max(16),edges:z.array(Edge)});
const Table=z.object({...base,type:z.literal('table'),columns:z.array(z.string()).min(1),rows:z.array(z.array(z.union([z.string(),z.number().finite()]))).min(1),simulated:z.boolean().default(false)});
const Chart=z.object({...base,type:z.literal('chart'),chartType:z.enum(['bar','line','scatter']),labels:z.array(z.string()).min(1),series:z.array(z.object({name:z.string(),values:z.array(z.number().finite())})).min(1),simulated:z.boolean().default(false)});
const Image=z.object({...base,type:z.literal('image'),src:z.string().refine(v=>/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v),'Use an embedded PNG/JPEG data URI; remote assets are disabled'),alt:z.string().min(1),naturalWidth:z.number().positive(),naturalHeight:z.number().positive(),fit:z.enum(['contain','cover']).default('contain'),caption:z.string().optional()});
export const BlockSchema=z.discriminatedUnion('type',[Text,Formula,Process,Architecture,Table,Chart,Image]);
export const ContractSchema=z.object({audience:z.string(),purpose:z.string(),keyMessage:z.string(),claims:z.array(z.string()),evidence:z.array(z.string()),visualRepresentation:z.string(),speakerNotes:z.string(),acceptanceCriteria:z.array(z.string())});
export const SlideSchema=z.object({id:z.string().min(1),type:z.enum(['title','content','two-column','formula','architecture','comparison','timeline','summary','experiment']).default('content'),title:z.string().min(1),keyMessage:z.string().default(''),blocks:z.array(BlockSchema).default([]),sources:z.array(z.object({id:z.string(),title:z.string(),url:z.string().url().optional(),note:z.string().optional()})).default([]),constraints:z.object({preserve:z.array(z.string()).default([]),maxDensity:z.number().min(0).max(1).default(0.85)}).prefault({}),contract:ContractSchema.optional(),speakerNotes:z.string().default('')});
export const DeckSchema=z.object({version:z.literal('0.1').default('0.1'),id:z.string().min(1),title:z.string().min(1),theme:z.enum(['academic-minimal','tech-dashboard']).default('academic-minimal'),audience:z.string().default('Technical audience'),slides:z.array(SlideSchema).min(1),render:z.object({width:z.literal(1280).default(1280),height:z.literal(720).default(720),minFontSize:z.number().min(12).max(32).default(18),maxFontSize:z.number().min(32).max(72).default(64)}).prefault({})}).superRefine((deck,ctx)=>{
 const ids=new Set<string>();
 deck.slides.forEach((s,si)=>{for(const id of [s.id,...s.blocks.map(b=>b.id)]){if(ids.has(id))ctx.addIssue({code:'custom',message:`Duplicate stable ID: ${id}`,path:['slides',si]}); ids.add(id);}
 s.blocks.forEach((b,bi)=>{const path=['slides',si,'blocks',bi];if(b.type==='table'&&b.rows.some(r=>r.length!==b.columns.length))ctx.addIssue({code:'custom',message:'Table row width mismatch',path});if(b.type==='chart'&&b.series.some(v=>v.values.length!==b.labels.length))ctx.addIssue({code:'custom',message:'Chart data/label length mismatch',path});if(b.type==='architecture'){const nodes=new Set(b.nodes.map(n=>n.id));if(nodes.size!==b.nodes.length||b.edges.some(e=>!nodes.has(e.from)||!nodes.has(e.to)))ctx.addIssue({code:'custom',message:'Invalid architecture node IDs or edge references',path});}});
 for(const id of s.constraints.preserve)if(!s.blocks.some(b=>b.id===id))ctx.addIssue({code:'custom',message:`Preserved block missing: ${id}`,path:['slides',si,'constraints']});
 });
 if(deck.render.minFontSize>deck.render.maxFontSize)ctx.addIssue({code:'custom',message:'Invalid font range'});
});
export type Block=z.infer<typeof BlockSchema>;
export type Slide=z.infer<typeof SlideSchema>;
export type Deck=z.infer<typeof DeckSchema>;
export type SlideContract=z.infer<typeof ContractSchema>;
export type Box=z.infer<typeof BoxSchema>;
export function parseDeck(input:unknown):Deck{return DeckSchema.parse(input);}
