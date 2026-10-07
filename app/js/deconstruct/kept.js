// kept: images (ocr if on) and pass-through copies
import { state } from '../state.js';
import { ocr } from '../ocr.js';

export async function runImage(file, rec, ctx) {
  const path = await ctx.keep(file);
  const name = path.split('/').pop();
  let text = '';
  if (state.ocr) {
    ctx.status('Reading text in image');
    text = await ocr(file);
  }
  await ctx.md([`# ${rec.id} · ${rec.name}`, '', `![](${name})`, '', ...(text ? ['## Text read from image', '', text, ''] : [])].join('\n'));
}

export async function runKept(file, rec, ctx) {
  ctx.status('Copying');
  await ctx.keep(file);
}
