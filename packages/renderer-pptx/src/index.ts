import PptxGenJS from 'pptxgenjs';
import { imageSize } from 'image-size';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js';
import type { LayoutDeck, LayoutElement } from '../../core/src/types.js';
import type { Theme } from '../../design-system/src/index.js';

// CSS pixels -> inches / points. The canvas is 1280 × 720 at 96 dpi.
const inch = (px: number): number => px / 96;
const color = (hex: string): string => hex.replace(/^#/, '');
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const mathDocument = mathjax.document('', {
  InputJax: new TeX({ packages: ['base', 'ams'], formatError: (_jax: unknown, error: Error) => { throw error; } }),
  OutputJax: new SVG({ fontCache: 'none' }),
});

/** Formula assets contain SVG paths, never raw LaTeX placeholders. */
export function formulaToSvg(latex: string, textColor = '#152C36'): { svg: string; width: number; height: number } {
  const container = mathDocument.convert(latex, { display: true });
  let svg = adaptor.outerHTML(adaptor.firstChild(container) as Parameters<typeof adaptor.outerHTML>[0]);
  if (svg.includes('data-mml-node="merror"')) throw new Error('MathJax could not render formula');
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1]?.split(/\s+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || !viewBox.every(Number.isFinite)) throw new Error('Formula has no valid SVG viewBox');
  const width = viewBox[2];
  const height = viewBox[3];
  svg = svg.replace(/width="[^"]*"/, `width="${Math.ceil(width / 50)}px"`)
    .replace(/height="[^"]*"/, `height="${Math.ceil(height / 50)}px"`)
    .replaceAll('currentColor', textColor);
  return { svg, width, height };
}

function addText(slide: PptxGenJS.Slide, text: string, e: LayoutElement, options: PptxGenJS.TextPropsOptions = {}): void {
  slide.addText(text, {
    x: inch(e.x), y: inch(e.y), w: inch(e.width), h: inch(e.height),
    fontFace: 'Arial', fontSize: e.fontSize * 0.75, color: color(e.color),
    margin: 0, breakLine: false, valign: 'top', paraSpaceAfter: 5,
    bold: e.role === 'title', objectName: e.id, ...options,
  });
}

function panel(slide: PptxGenJS.Slide, e: LayoutElement, theme: Theme): void {
  slide.addShape('roundRect', { x: inch(e.x), y: inch(e.y), w: inch(e.width), h: inch(e.height),
    fill: { color: color(e.background ?? theme.colors.surface) },
    line: { color: color(theme.colors.border), width: theme.border }, rectRadius: 0.12,
    objectName: `${e.id}:background` });
}

function arrow(slide: PptxGenJS.Slide, x1: number, y1: number, x2: number, y2: number, theme: Theme, id: string, arrowHead=true): void {
  slide.addShape('line', { x: inch(Math.min(x1, x2)), y: inch(Math.min(y1, y2)),
    w: inch(Math.max(0.01, Math.abs(x2 - x1))), h: inch(Math.max(0.01, Math.abs(y2 - y1))),
    flipH: x2 < x1, flipV: y2 < y1,
    line: { color: color(theme.colors.primary), width: 1.6, ...(arrowHead?{endArrowType:'triangle' as const}:{}) }, objectName: id });
}

function node(slide: PptxGenJS.Slide, label: string, e: LayoutElement, theme: Theme): void {
  panel(slide, e, theme);
  addText(slide, label, { ...e, x: e.x + 10, y: e.y + 8, width: e.width - 20, height: e.height - 16 }, { align: 'center', valign: 'middle' });
}

function renderElement(slide: PptxGenJS.Slide, e: LayoutElement, theme: Theme): void {
  const b = e.block;
  if (b.type === 'text') {
    if (e.role === 'content' && e.background) panel(slide, e, theme);
    addText(slide, b.text, e);
    return;
  }
  if (b.type === 'formula') {
    panel(slide, e, theme);
    const asset = formulaToSvg(b.latex, e.color);
    const captionHeight = b.caption ? 56 : 0;
    const availableW = Math.max(1, e.width - 48);
    const availableH = Math.max(1, e.height - 48 - captionHeight);
    // MathJax viewBox uses 1000 units/em. Respect requested font size, then contain.
    const scale = Math.min(e.fontSize / 1000, availableW / asset.width, availableH / asset.height);
    const w = asset.width * scale;
    const h = asset.height * scale;
    slide.addImage({ data: `data:image/svg+xml;base64,${Buffer.from(asset.svg).toString('base64')}`,
      x: inch(e.x + (e.width - w) / 2), y: inch(e.y + 24 + (availableH - h) / 2), w: inch(w), h: inch(h),
      objectName: e.id, altText: `Formula: ${b.latex}` });
    if (b.caption) addText(slide, b.caption, { ...e, id: `${e.id}:caption`, x: e.x + 24, y: e.y + e.height - captionHeight,
      width: e.width - 48, height: captionHeight - 12, fontSize: theme.typography.small, color: theme.colors.muted }, { align: 'center' });
    return;
  }
  if (b.type === 'process') {
    const columns = Math.min(4, b.steps.length);
    const rows = Math.ceil(b.steps.length / columns);
    const gap = 40;
    const w = (e.width - gap * (columns - 1)) / columns;
    const h = Math.min(110, (e.height - gap * (rows - 1)) / rows);
    const boxes = b.steps.map((label, i) => ({ ...e, id: `${e.id}:step:${i}`, x: e.x + (i % columns) * (w + gap),
      y: e.y + Math.floor(i / columns) * (h + gap) + (e.height - rows * h - gap * (rows - 1)) / 2,
      width: w, height: h, label }));
    for (let i = 1; i < boxes.length; i++) {
      const prev = boxes[i - 1]; const next = boxes[i];
      if (i % columns) arrow(slide, prev.x + w, prev.y + h / 2, next.x, next.y + h / 2, theme, `${e.id}:edge:${i}`);
      else arrow(slide, prev.x + w / 2, prev.y + h, next.x + w / 2, next.y, theme, `${e.id}:edge:${i}`);
    }
    boxes.forEach((box, i) => node(slide, `${String(i + 1).padStart(2, '0')}\n${box.label}`, box, theme));
    return;
  }
  if (b.type === 'architecture') {
    const columns = Math.min(3, b.nodes.length);
    const rows = Math.ceil(b.nodes.length / columns);
    const gapX = 70; const gapY = 80;
    const w = (e.width - gapX * (columns - 1)) / columns;
    const h = Math.min(100, (e.height - gapY * (rows - 1)) / rows);
    const boxes = b.nodes.map((n, i) => ({ ...e, id: `${e.id}:node:${n.id}`, nodeId: n.id, label: n.label,
      x: e.x + (i % columns) * (w + gapX), y: e.y + Math.floor(i / columns) * (h + gapY) + (e.height - rows * h - gapY * (rows - 1)) / 2,
      width: w, height: h }));
    b.edges.forEach((edge, i) => {
      const from = boxes.find(n => n.nodeId === edge.from)!; const to = boxes.find(n => n.nodeId === edge.to)!;
      const sameRow = from.y === to.y;
      const rightward = to.x > from.x;
      const down = to.y > from.y;
      const x1 = sameRow ? from.x + (rightward ? w : 0) : from.x + w / 2;
      const y1 = sameRow ? from.y + h / 2 : from.y + (down ? h : 0);
      const x2 = sameRow ? to.x + (rightward ? 0 : w) : to.x + w / 2;
      const y2 = sameRow ? to.y + h / 2 : to.y + (down ? 0 : h);
      const loop=sameRow&&!rightward;const lane=from.y+h+24;
      if(loop){
        arrow(slide,from.x+w/2,from.y+h,from.x+w/2,lane,theme,`${e.id}:edge:${i}:out`,false);
        arrow(slide,from.x+w/2,lane,to.x+w/2,lane,theme,`${e.id}:edge:${i}:return`,false);
        arrow(slide,to.x+w/2,lane,to.x+w/2,to.y+h,theme,`${e.id}:edge:${i}`);
      }else arrow(slide, x1, y1, x2, y2, theme, `${e.id}:edge:${i}`);
      if (edge.label) addText(slide, edge.label, { ...e, id: `${e.id}:edge-label:${i}`, x: (x1 + x2) / 2 - 60,
        y: loop?lane-24:(y1 + y2) / 2 - 24, width: 120, height: 24, fontSize: theme.typography.small, color: theme.colors.muted }, { align: 'center' });
    });
    boxes.forEach(box => node(slide, box.label, box, theme));
    return;
  }
  if (b.type === 'table') {
    const foot = b.simulated ? 36 : 0;
    const rows: PptxGenJS.TableRow[] = [b.columns.map(text => ({ text, options: { bold: true, color: color(theme.colors.background), fill: { color: color(theme.colors.primary) } } })),
      ...b.rows.map(row => row.map(value => ({ text: String(value), options: { color: color(e.color), fill: { color: color(theme.colors.surface) } } })))];
    slide.addTable(rows, { x: inch(e.x), y: inch(e.y), w: inch(e.width), h: inch(e.height - foot),
      colW: Array(b.columns.length).fill(inch(e.width / b.columns.length)), rowH: inch((e.height - foot) / rows.length),
      border: { type: 'solid', color: color(theme.colors.border), pt: 0.8 },
      fontFace: 'Arial', fontSize: e.fontSize * 0.75, margin: 8, valign: 'middle', autoPage: false,
      objectName: e.id });
    if (b.simulated) addText(slide, 'SIMULATED DATA · NOT RESEARCH EVIDENCE', { ...e, id: `${e.id}:simulation`, y: e.y + e.height - 28, height: 28, fontSize: theme.typography.small, color: theme.colors.secondary });
    return;
  }
  if (b.type === 'chart') {
    const foot = b.simulated ? 36 : 0;
    const data = b.chartType === 'scatter'
      ? [{ name: 'Sample position (1-based)', values: b.labels.map((_, i) => i + 1) }, ...b.series.map(s => ({ name: s.name, labels: [...b.labels], values: [...s.values] }))]
      : b.series.map(s => ({ name: s.name, labels: [...b.labels], values: [...s.values] }));
    slide.addChart(b.chartType, data, { x: inch(e.x), y: inch(e.y), w: inch(e.width), h: inch(e.height - foot),
      objectName: e.id, altText: b.simulated ? 'Simulated example data; not research evidence' : b.series.map(s => s.name).join(', '),
      chartColors: theme.colors.chart.map(color), showLegend: true, legendPos: 'b', legendColor: color(e.color), legendFontSize: 12,
      showTitle: false, showValue: b.chartType === 'bar',
      catAxisLabelColor: color(e.color), valAxisLabelColor: color(e.color), catAxisLabelFontSize: 12, valAxisLabelFontSize: 12,
      catAxisLineColor: color(theme.colors.border), valAxisLineColor: color(theme.colors.border),
      catAxisLineShow: true, valAxisLineShow: true, valGridLine: { color: color(theme.colors.border), size: 0.5 },
      chartArea: { fill: { color: color(theme.colors.surface) }, roundedCorners: false },
      plotArea: { fill: { color: color(theme.colors.surface) } },
      dataLabelColor: color(e.color), dataLabelFormatCode: '0.###', dataLabelPosition: 'outEnd',
      lineDataSymbol: 'circle', lineDataSymbolSize: 7, lineSize: b.chartType === 'scatter' ? 0 : 2,
      barDir: 'col', barGrouping: 'clustered',
    });
    if (b.simulated) addText(slide, 'SIMULATED DATA · NOT RESEARCH EVIDENCE', { ...e, id: `${e.id}:simulation`, y: e.y + e.height - 28, height: 28, fontSize: theme.typography.small, color: theme.colors.secondary });
    return;
  }
  if (b.type === 'image') {
    const captionH = b.caption ? 44 : 0;
    const availableH = Math.max(1, e.height - captionH);
    // Keep real pixel ratio, independent of the component container ratio.
    const actual=imageSize(Buffer.from(b.src.slice(b.src.indexOf(',')+1),'base64'));
    if(!['png','jpg'].includes(actual.type??'')||!actual.width||!actual.height)throw new Error(`Invalid embedded PNG/JPEG: ${b.id}`);
    const scale = Math.min(e.width / actual.width, availableH / actual.height);
    const w = actual.width * scale; const h = actual.height * scale;
    if (b.fit === 'contain') slide.addImage({ data: b.src, x: inch(e.x + (e.width - w) / 2), y: inch(e.y + (availableH - h) / 2),
      w: inch(w), h: inch(h), objectName: e.id, altText: b.alt });
    else slide.addImage({ data: b.src, x: inch(e.x), y: inch(e.y), w: inch(w), h: inch(h),
      sizing: { type: 'cover', w: inch(e.width), h: inch(availableH) }, objectName: e.id, altText: b.alt });
    if (b.caption) addText(slide, b.caption, { ...e, id: `${e.id}:caption`, y: e.y + availableH + 8, height: captionH - 8, fontSize: theme.typography.small, color: theme.colors.muted });
  }
}

/** Native editable text, tables, shapes and charts; formulas are embedded SVG assets. */
export async function renderPptx(layout: LayoutDeck, outputPath: string): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'RENDERKIT', width: inch(1280), height: inch(720) });
  pptx.layout = 'RENDERKIT';
  pptx.author = 'RenderKit 2D'; pptx.subject = 'Semantic visual rendering'; pptx.title = layout.deck.title;
  pptx.company = 'RenderKit 2D';
  pptx.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' };
  for (const page of layout.slides) {
    const slide = pptx.addSlide();
    slide.background = { color: color(layout.theme.colors.background) };
    for (const element of page.elements) renderElement(slide, element, layout.theme);
    const sourceNotes = page.source.sources.map(s => `${s.id}: ${s.title}${s.url ? ` (${s.url})` : ''}${s.note ? ` — ${s.note}` : ''}`).join('\n');
    slide.addNotes([page.notes, sourceNotes, 'Editability: text, tables, charts and basic shapes are native PowerPoint objects. Formula objects are SVG vectors.'].filter(Boolean).join('\n\n'));
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await pptx.writeFile({ fileName: outputPath, compression: true });
}
