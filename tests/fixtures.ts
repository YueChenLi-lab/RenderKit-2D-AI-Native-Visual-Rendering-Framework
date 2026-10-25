import { parseDeck, type Deck } from '../packages/schema/src/index.js';
export const tinyPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
export function fixture():Deck{return parseDeck({id:'fixture',title:'RenderKit test',slides:[
 {id:'s-text',title:'Content and formula',type:'two-column',keyMessage:'Keep claims traceable',blocks:[{id:'body',type:'text',text:'Preserve every meaningful claim.'},{id:'equation',type:'formula',latex:'E = mc^2',caption:'Mass–energy equivalence'}],constraints:{preserve:['body','equation']}},
 {id:'s-data',title:'Simulated results',type:'comparison',blocks:[{id:'table',type:'table',columns:['Algorithm','Score'],rows:[['A',0.82],['B',0.91]],simulated:true},{id:'chart',type:'chart',chartType:'bar',labels:['A','B'],series:[{name:'Score',values:[0.82,0.91]}],simulated:true}]},
 {id:'s-image',title:'Image',type:'experiment',blocks:[{id:'image',type:'image',src:tinyPng,alt:'Square fixture',naturalWidth:1,naturalHeight:1,fit:'contain'}]},
 {id:'s-graph',title:'Directed graph',type:'architecture',blocks:[{id:'graph',type:'architecture',nodes:[{id:'a',label:'Parse'},{id:'b',label:'Render'}],edges:[{from:'a',to:'b',label:'IR'}]}]}
]});}
