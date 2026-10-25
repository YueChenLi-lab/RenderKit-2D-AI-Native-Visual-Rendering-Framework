import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { LayoutDeck } from '../../core/src/types.js';
import { DeckView, renderFormulaHtml } from './components.js';
export * from './components.js';
let mathCss: string | undefined;
function inlineKatexCss(): string {
 if(mathCss)return mathCss;
 const require=createRequire(import.meta.url);const cssPath=require.resolve('katex/dist/katex.min.css');
 mathCss=readFileSync(cssPath,'utf8').replace(/url\(([^)]+)\)/g,(_,raw:string)=>{const name=raw.replace(/["']/g,'');const extension=name.split('.').at(-1);const mime=extension==='woff2'?'font/woff2':extension==='woff'?'font/woff':'font/ttf';return `url(data:${mime};base64,${readFileSync(resolve(dirname(cssPath),name)).toString('base64')})`;});
 return mathCss;
}
export function renderDeckHtml(layout:LayoutDeck):string {
 // A visible React error is useful in Studio; exported documents must fail validation.
 for(const slide of layout.slides)for(const element of slide.elements)if(element.block.type==='formula') {
  try {renderFormulaHtml(element.block.latex);}catch(error){throw new Error(`Formula ${element.id} could not render: ${error instanceof Error?error.message:String(error)}`);}
 }
 const title=layout.deck.title.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${inlineKatexCss()}*{box-sizing:border-box}body{margin:0;background:#27303c}.rk-deck{display:flex;flex-direction:column;gap:24px;align-items:center;padding:24px}.rk-slide{flex:none;box-shadow:0 10px 40px #0003}.katex-display{margin:0}@media print{@page{size:13.333in 7.5in;margin:0}body{background:none}.rk-deck{display:block;padding:0}.rk-slide{break-after:page;box-shadow:none}}</style></head><body>${renderToStaticMarkup(React.createElement(DeckView,{layout}))}</body></html>`;
}
