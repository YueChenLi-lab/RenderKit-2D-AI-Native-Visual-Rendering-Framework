import { parseDeck, type Block, type Box, type Deck } from '../../schema/src/index.js';
import { getTheme } from '../../design-system/src/index.js';
import type { LayoutDeck, LayoutElement } from './types.js';
export type * from './types.js';

/** Stable semantic layout, expressed in pixels on a 1280 × 720 canvas. */
export function layoutDeck(input: Deck): LayoutDeck {
  const deck = parseDeck(input);
  const theme = getTheme(deck.theme);
  const { width, height } = deck.render;
  const usedIds = new Set(deck.slides.flatMap(slide => [slide.id, ...slide.blocks.map(block => block.id)]));
  const auxiliaryId = (preferred: string): string => {
    let id = preferred;
    while (usedIds.has(id)) id += ':auto';
    usedIds.add(id);
    return id;
  };
  const margin = theme.spacing.page;
  const gap = theme.spacing.gap;
  const contentWidth = width - 2 * margin;
  const clampFont = (value: number) => Math.max(deck.render.minFontSize, Math.min(deck.render.maxFontSize, value));
  const slides = deck.slides.map((slide, slideIndex) => {
    const elements: LayoutElement[] = [];
    const textElement = (id: string, text: string, role: LayoutElement['role'], box: Box, fontSize: number, color: string): LayoutElement => ({
      id, slideId: slide.id, role, kind: role === 'title' ? 'title' : role === 'footer' ? 'footer' : 'text', ...box,
      fontSize, color, block: { id, type: 'text', text, required: true },
    });
    elements.push(textElement(auxiliaryId(`${slide.id}::title`), slide.title, 'title', { x: margin, y: 48, width: contentWidth, height: 72 }, clampFont(theme.typography.title), theme.colors.text));
    if (slide.keyMessage) elements.push(textElement(auxiliaryId(`${slide.id}::message`), slide.keyMessage, 'subtitle', { x: margin, y: 132, width: contentWidth, height: 46 }, clampFont(22), theme.colors.muted));
    const count = slide.blocks.length;
    const columns = slide.type === 'two-column' || slide.type === 'comparison' || slide.type === 'experiment';
    const defaultBox = (index: number): Box => {
      if (columns) {
        const columnCount = Math.min(count, 2);
        const rows = Math.ceil(count / 2);
        const cellWidth = (contentWidth - gap * (columnCount - 1)) / columnCount;
        const cellHeight = Math.max(72, (430 - gap * (rows - 1)) / rows);
        return { x: margin + (index % 2) * (cellWidth + gap), y: 200 + Math.floor(index / 2) * (cellHeight + gap), width: cellWidth, height: cellHeight };
      }
      if (count === 2) {
        if (slide.type === 'title') return index === 0
          ? { x: margin, y: 230, width: contentWidth, height: 184 }
          : { x: margin, y: 442, width: contentWidth, height: 166 };
        if (slide.type === 'formula') return index === 0
          ? { x: margin, y: 200, width: contentWidth, height: 230 }
          : { x: margin, y: 458, width: contentWidth, height: 162 };
        if (slide.type === 'architecture') return index === 0
          ? { x: margin, y: 200, width: contentWidth, height: 330 }
          : { x: margin, y: 558, width: contentWidth, height: 72 };
        if (slide.type === 'timeline') return index === 0
          ? { x: margin, y: 214, width: contentWidth, height: 250 }
          : { x: margin, y: 492, width: contentWidth, height: 138 };
      }
      // Dense inputs intentionally overflow rather than receiving invalid negative boxes.
      // The auditor can diagnose them and the repair engine can split the content.
      const rowHeight = Math.max(72, (430 - gap * (count - 1)) / Math.max(count, 1));
      return { x: margin, y: 200 + index * (rowHeight + gap), width: contentWidth, height: rowHeight };
    };
    slide.blocks.forEach((block, index) => {
      elements.push({
        id: block.id, slideId: slide.id, role: 'content', kind: block.type,
        ...defaultBox(index), ...block.layout,
        fontSize: block.fontSize ?? clampFont(theme.typography.body),
        color: block.color ?? theme.colors.text, background: theme.colors.surface,
        block: structuredClone(block),
      });
    });
    const simulated = slide.blocks.some(block => (block.type === 'table' || block.type === 'chart') && block.simulated);
    const footer = `${simulated ? 'SIMULATED DATA · ' : ''}RENDERKIT 2D / ${deck.version}   ·   ${String(slideIndex + 1).padStart(2, '0')} / ${String(deck.slides.length).padStart(2, '0')}`;
    elements.push(textElement(auxiliaryId(`${slide.id}::footer`), footer, 'footer', { x: margin, y: 660, width: contentWidth, height: 28 }, clampFont(theme.typography.small), theme.colors.muted));
    const references = slide.sources.map(source => [source.title, source.url, source.note].filter(Boolean).join(' — '));
    return {
      id: slide.id, title: slide.title, width, height, elements, source: structuredClone(slide),
      notes: [slide.contract?.speakerNotes || slide.speakerNotes, references.length ? `Sources:\n${references.join('\n')}` : ''].filter(Boolean).join('\n\n'),
    };
  });
  return { deck, theme, slides };
}

/** All payloads are retained; supported formatting is interpreted by the renderers. */
export function blockText(block: Block): string {
  switch (block.type) {
    case 'text': return block.text;
    case 'formula': return [block.latex, block.caption].filter(Boolean).join('\n');
    case 'process': return block.steps.join(' → ');
    case 'architecture': return block.nodes.map(node => node.label).join('\n');
    case 'table': return [block.columns.join(' | '), ...block.rows.map(row => row.join(' | '))].join('\n');
    case 'chart': return block.series.map(series => `${series.name}: ${series.values.join(', ')}`).join('\n');
    case 'image': return [block.alt, block.caption].filter(Boolean).join('\n');
  }
}
