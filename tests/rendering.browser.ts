import { test, expect, type Page } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DeckView } from '../packages/renderer-web/src/components.js';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { layoutDeck } from '../packages/core/src/index.js';
import { renderDeckHtml } from '../packages/renderer-web/src/index.js';
import { parseDeck } from '../packages/schema/src/index.js';
import { fixture } from './fixtures.js';
import { auditLayout, captureBrowser } from '../packages/auditor/src/index.js';

const folder = resolve('.cache/browser-tests');
let fixturePath: string;
let demoPath: string;
// Generated HTML embeds every font and asset. Loading its exact bytes also works
// in managed Chromium installations that prohibit navigation to file:// URLs.
async function openGenerated(page: Page, path: string) {
  await page.route(/^https?:/, route => route.abort());
  await page.setContent(await readFile(path, 'utf8'), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
}
test.beforeAll(async () => {
  await mkdir(folder, { recursive: true });
  fixturePath = resolve(folder, 'fixture.html');
  demoPath = resolve(folder, 'demo.html');
  await writeFile(fixturePath, renderDeckHtml(layoutDeck(fixture())));
  const demo = parseDeck(JSON.parse(await readFile('examples/demo.json', 'utf8')));
  await writeFile(demoPath, renderDeckHtml(layoutDeck(demo)));
});

test('opens offline HTML with real formula glyphs and correct chart values', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openGenerated(page, fixturePath);
  await expect(page.locator('[data-renderkit-slide]')).toHaveCount(4);
  await expect(page.locator('[data-element-id="equation"] .katex')).toBeVisible();
  await expect(page.locator('[data-formula-error]')).toHaveCount(0);
  const values = await page.locator('[data-element-id="chart"] [data-value]').evaluateAll(nodes => nodes.map(n => Number(n.getAttribute('data-value'))));
  expect(values).toContain(0.82);
  expect(values).toContain(0.91);
  expect(errors).toEqual([]);
});

test('preserves image ratio with contain and loads the embedded raster', async ({ page }) => {
  await openGenerated(page, fixturePath);
  const image = page.locator('[data-element-id="image"] img');
  await expect(image).toBeVisible();
  await expect(image).toHaveCSS('object-fit', 'contain');
  const loaded = await image.evaluate((img: HTMLImageElement) => ({ complete: img.complete, width: img.naturalWidth, height: img.naturalHeight }));
  expect(loaded).toEqual({ complete: true, width: 1, height: 1 });
});

test('measures actual text overflow in browser, not just source length', async ({ page }) => {
  const deck = fixture();
  deck.slides = [deck.slides[0]!];
  deck.slides[0]!.blocks = deck.slides[0]!.blocks.slice(0, 1);
  deck.slides[0]!.constraints.preserve = ['body'];
  const text = deck.slides[0]!.blocks[0]!;
  if (text.type === 'text') text.text = 'This important retained claim must remain visible. '.repeat(30);
  text.layout = { x: 64, y: 200, width: 200, height: 70 };
  const html = resolve(folder, 'overflow.html');
  await writeFile(html, renderDeckHtml(layoutDeck(deck)));
  await openGenerated(page, html);
  const sizes = await page.locator('[data-element-id="body"]').evaluate(node => ({ scroll: node.scrollHeight, height: node.clientHeight, content: node.querySelector('[data-content]')?.getBoundingClientRect().height ?? 0 }));
  expect(Math.max(sizes.scroll, sizes.content)).toBeGreaterThan(sizes.height);
});

test('renders every demo slide and writes a page PNG', async ({ page }) => {
  await openGenerated(page, demoPath);
  const slides = page.locator('[data-renderkit-slide]');
  expect(await slides.count()).toBeGreaterThanOrEqual(6);
  await expect(page.locator('[data-formula-error]')).toHaveCount(0);
  for (const slide of await slides.all()) {
    const box = await slide.boundingBox();
    expect(box?.width).toBe(1280);
    expect(box?.height).toBe(720);
  }
  await slides.first().screenshot({ path: 'artifacts/tests/demo-title.png' });
});

test('Studio switches themes, navigates slides, shows notes and exports the shared IR', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5178');
  await expect(page.getByRole('heading', { name: 'One idea. Every surface.' })).toBeVisible();
  const canvas = page.locator('[data-renderkit-slide]');
  await expect(canvas).toHaveCount(1);
  const firstTitle = await canvas.getAttribute('data-slide-id');
  await page.getByLabel('DESIGN SYSTEM').selectOption('tech-dashboard');
  await expect(canvas).toHaveCSS('background-color', 'rgb(11, 20, 36)');
  await page.getByRole('button', { name: 'Next slide', exact: true }).click();
  await expect(canvas).not.toHaveAttribute('data-slide-id', firstTitle!);
  await page.getByRole('button', { name: 'Speaker notes' }).click();
  await expect(page.locator('.notes p')).not.toBeEmpty();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const exported = parseDeck(JSON.parse(await readFile(path!, 'utf8')));
  expect(exported.theme).toBe('tech-dashboard');
  const original = parseDeck(JSON.parse(await readFile('examples/demo.json', 'utf8')));
  expect(exported.slides).toEqual(original.slides);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/tests/studio-tech.png', fullPage: true });
});


test('browser audit rejects Studio formula diagnostics and broken embedded image payloads', async () => {
  const deck = fixture();
  const formula = deck.slides[0]!.blocks.find(block => block.type === 'formula')!;
  if (formula.type === 'formula') formula.latex = '\\thisCommandDoesNotExist{x}';
  const image = deck.slides[2]!.blocks[0]!;
  if (image.type === 'image') image.src = 'data:image/png;base64,AAAA';
  const layout = layoutDeck(deck);
  const html = resolve(folder, 'invalid-content.html');
  expect(() => renderDeckHtml(layout)).toThrow(/Formula equation could not render/);
  // Studio can show a diagnostic; the browser auditor must not count it as content.
  await writeFile(html, '<!doctype html><html><body>' + renderToStaticMarkup(createElement(DeckView, { layout })) + '</body></html>');
  const result = await captureBrowser(html, resolve(folder, 'invalid-content-images'));
  const report = auditLayout(layout, result.observations);
  expect(report.passed).toBe(false);
  expect(report.issues.some(issue => issue.elementId === 'equation' && issue.category === 'missing-content')).toBe(true);
  expect(report.issues.some(issue => issue.elementId === 'image' && issue.category === 'missing-content')).toBe(true);
});
