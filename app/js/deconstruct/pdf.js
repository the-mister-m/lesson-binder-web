// pdf: text + page png + tiles; ocr on textless pages if on
import * as pdfjs from '../../vendor/pdf.min.mjs';
import { needsTiles, quadrants, toBlob } from './tile.js';
import { state } from '../state.js';
import { ocr } from '../ocr.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdf.worker.min.mjs', import.meta.url).href;

const DPI_SCALE = 150 / 72;
const MAX_EDGE = 4000;

export async function runPdf(file, rec, ctx, buf) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const n = doc.numPages;
  rec.meta.pages = n;

  // pass 1: text and layout
  const pages = [];
  for (let i = 1; i <= n; i++) {
    ctx.status(`Reading page ${i} of ${n}`);
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(DPI_SCALE, MAX_EDGE / Math.max(base.width, base.height));
    const vp = page.getViewport({ scale });
    const tc = await page.getTextContent();
    const text = tc.items.map(t => t.str + (t.hasEOL ? '\n' : '')).join('').replace(/\n{3,}/g, '\n\n').trim();
    pages.push({ page, vp, text, tiles: needsTiles(vp.width, vp.height), ocr: '' });
  }

  const render = () => {
    const md = [`# ${rec.id} · ${rec.name}`, ''];
    pages.forEach((p, k) => {
      const pid = `${rec.id}.p${k + 1}`;
      md.push(`## Page ${k + 1}`, '', `![](${pid}.png)`);
      if (p.tiles) md.push(`Tiles: ${[1, 2, 3, 4].map(t => `${pid}.t${t}.png`).join(', ')}`);
      md.push('', p.text || '', '');
      if (p.ocr) md.push('### Text read from image', '', p.ocr, '');
    });
    return md.join('\n');
  };

  // markdown first
  await ctx.md(render());

  // pass 2: images
  let gotOcr = false;
  for (let k = 0; k < pages.length; k++) {
    const p = pages[k];
    const pid = `${rec.id}.p${k + 1}`;
    ctx.status(`Processing page ${k + 1} of ${n}`);
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(p.vp.width);
    canvas.height = Math.floor(p.vp.height);
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, canvas.width, canvas.height);
    await p.page.render({ canvasContext: g, viewport: p.vp }).promise;
    await ctx.put(pid, 'png', await toBlob(canvas), 'page');
    if (p.tiles) {
      const tiles = await quadrants(canvas);
      for (let t = 0; t < 4; t++) await ctx.put(`${pid}.t${t + 1}`, 'png', tiles[t], 'tile');
    }
    if (state.ocr && p.text.length < 20) {
      ctx.status(`Reading text in page ${k + 1} of ${n}`);
      p.ocr = await ocr(canvas);
      gotOcr = gotOcr || !!p.ocr;
    }
    p.page.cleanup();
  }
  if (gotOcr) await ctx.md(render());
  await doc.destroy();
}
