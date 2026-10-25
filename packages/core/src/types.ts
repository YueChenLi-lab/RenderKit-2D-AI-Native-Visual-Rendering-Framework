import type { Block, Deck, Slide, Box } from '../../schema/src/index.js';
import type { Theme } from '../../design-system/src/index.js';
export interface LayoutElement extends Box {id:string;slideId:string;role:'title'|'subtitle'|'content'|'footer';kind:Block['type']|'title'|'footer';fontSize:number;color:string;background?:string;allowOverlap?:boolean;block:Block;}
export interface LayoutSlide {id:string;title:string;width:number;height:number;elements:LayoutElement[];notes:string;source:Slide;}
export interface LayoutDeck {deck:Deck;theme:Theme;slides:LayoutSlide[];}
export interface RendererAdapter<T> {render(layout:LayoutDeck):T|Promise<T>;}
