import { parseDeck, type Block, type Deck, type Slide, type SlideContract } from '../../schema/src/index.js';

export interface NarrativePlanner {
  /** Returns a new validated IR. Never changes experiment values or required content. */
  plan(deck: Deck): Deck | Promise<Deck>;
}

export function selectRepresentation(intent: string): string {
  const mappings: Record<string, string> = {
    comparison: 'table / bar chart', trend: 'line chart', relationship: 'scatter plot',
    process: 'process flow', architecture: 'architecture diagram', mathematics: 'formula block',
    formula: 'formula block', experiment: 'image panel + metrics', timeline: 'roadmap',
    title: 'title slide', summary: 'summary slide', 'two-column': 'two-column comparison',
    teaching: 'explanation + process flow', technical: 'architecture diagram',
    results: 'table / chart', content: 'content slide',
  };
  return mappings[intent.toLowerCase()] ?? 'content slide';
}

export class RuleBasedNarrativePlanner implements NarrativePlanner {
  plan(input: Deck): Deck {
    const deck = parseDeck(input);
    return parseDeck({ ...deck, slides: deck.slides.map(slide => {
      if (slide.contract) return slide;
      const keyMessage = slide.keyMessage || slide.title;
      const contract: SlideContract = {
        audience: deck.audience,
        purpose: slide.type === 'title' ? 'Introduce the topic and scope' : `Explain: ${slide.title}`,
        keyMessage,
        claims: [keyMessage],
        evidence: slide.sources.map(source => source.id),
        visualRepresentation: selectRepresentation(slide.type),
        speakerNotes: slide.speakerNotes || `${keyMessage}${slide.sources.length ? '\nReference the sources attached to this slide.' : '\nNo external evidence supplied; do not present this as a validated empirical claim.'}`,
        acceptanceCriteria: ['A single explicit key message', 'Preserve all supplied content and numeric values', ...slide.constraints.preserve.map(id => `Retain block ${id}`)],
      };
      return { ...slide, contract };
    }) });
  }
}

/** Parse Markdown headings, paragraph/list text and display-math without executing HTML. */
export function parseMarkdown(input: string): Deck {
  const normalized = input.replace(/\r\n?/g, '\n');
  let deckTitle = 'Untitled presentation';
  let sawDeckTitle = false;
  const sections: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | undefined;
  let inMath = false;
  let inCode = false;
  for (const line of normalized.split('\n')) {
    if (/^\s*```/.test(line)) inCode = !inCode;
    if (!inCode && /^\s*\$\$/.test(line) && (line.match(/\$\$/g)?.length ?? 0) % 2 === 1) inMath = !inMath;
    if (!inMath && !inCode && /^#\s+/.test(line) && !sawDeckTitle && sections.length === 0 && !current) {
      deckTitle = line.replace(/^#\s+/, '').trim();
      sawDeckTitle = true;
      continue;
    }
    const heading = !inMath && !inCode ? line.match(/^##\s+(.+)$/) : null;
    const divider = !inMath && !inCode && /^\s*---+\s*$/.test(line);
    if (heading || divider) {
      if (current && (current.lines.some(value => value.trim()) || current.title)) sections.push(current);
      current = { title: heading ? heading[1].trim() : '', lines: [] };
      continue;
    }
    if (!current && line.trim()) current = { title: deckTitle, lines: [] };
    current?.lines.push(line);
  }
  if (current && (current.lines.some(value => value.trim()) || current.title)) sections.push(current);
  if (!sections.length) sections.push({ title: deckTitle, lines: [] });
  const slides = sections.map((section, index) => {
    const id = `slide-${index + 1}`;
    const blocks: unknown[] = [];
    const body = section.lines.join('\n').trim();
    // Display math is a semantic block. Text outside it remains verbatim.
    const math = /\$\$([\s\S]+?)\$\$/g;
    let offset = 0;
    for (const match of body.matchAll(math)) {
      const prefix = body.slice(offset, match.index).trim();
      if (prefix) blocks.push({ id: `${id}-block-${blocks.length + 1}`, type: 'text', text: prefix });
      blocks.push({ id: `${id}-block-${blocks.length + 1}`, type: 'formula', latex: match[1].trim() });
      offset = (match.index ?? 0) + match[0].length;
    }
    const suffix = body.slice(offset).trim();
    if (suffix) blocks.push({ id: `${id}-block-${blocks.length + 1}`, type: 'text', text: suffix });
    return { id, title: section.title || `Section ${index + 1}`, type: blocks.some(block => (block as Block).type === 'formula') ? 'formula' : 'content', blocks };
  });
  return parseDeck({ version: '0.1', id: 'markdown-deck', title: deckTitle, slides });
}

export function parseInput(input: string, format: 'json' | 'markdown'): Deck {
  return format === 'json' ? parseDeck(JSON.parse(input) as unknown) : parseMarkdown(input);
}
