// media: audio + video kept; stills; transcript if on
import { state } from '../state.js';
import { transcribe, decode16k, transcriptMd } from '../whisper.js';
import { toBlob } from './tile.js';

const STILL_EVERY = 30;
const STILL_MAX = 20;
const STILL_WIDTH = 1280;

const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function transcript(buf, ctx) {
  if (!state.transcribe) return '';
  ctx.status('Decoding audio');
  let audio;
  try { audio = await decode16k(buf); }
  catch { return '_No readable audio track._'; }
  ctx.status('Transcribing');
  return transcriptMd(await transcribe(audio));
}

export async function runAudio(file, rec, ctx, buf) {
  const path = await ctx.keep(file);
  const head = [`# ${rec.id} · ${rec.name}`, '', `Audio: ${path.split('/').pop()}`, ''];
  await ctx.md(head.join('\n'));
  const t = await transcript(buf, ctx);
  if (t) await ctx.md([...head, '## Transcript', '', t, ''].join('\n'));
}

function seek(video, t) {
  return new Promise(res => { video.onseeked = () => res(); video.currentTime = t; });
}

export async function runVideo(file, rec, ctx, buf) {
  const path = await ctx.keep(file);
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.src = url;
  const stills = [];
  try {
    await new Promise((res, rej) => { video.onloadeddata = res; video.onerror = () => rej(new Error('Video not playable here')); });
    const dur = video.duration || 0;
    rec.meta.seconds = Math.round(dur);
    const count = Math.max(1, Math.min(STILL_MAX, Math.floor(dur / STILL_EVERY)));
    const times = Array.from({ length: count }, (_, i) => Math.min(dur - 0.1, count === 1 ? Math.min(1, dur / 2) : (i + 0.5) * (dur / count)));
    const scale = Math.min(1, STILL_WIDTH / (video.videoWidth || STILL_WIDTH));
    for (let i = 0; i < times.length; i++) {
      ctx.status(`Still ${i + 1} of ${times.length}`);
      await seek(video, times[i]);
      const c = document.createElement('canvas');
      c.width = Math.round(video.videoWidth * scale);
      c.height = Math.round(video.videoHeight * scale);
      c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
      const id = `${rec.id}.k${i + 1}`;
      stills.push({ id, t: times[i], blob: await toBlob(c) });
    }
  } finally {
    URL.revokeObjectURL(url);
  }

  const head = [`# ${rec.id} · ${rec.name}`, '', `Video: ${path.split('/').pop()}`, '', '## Stills', '', ...stills.map(s => `![${mmss(s.t)}](${s.id}.png)`), ''];
  await ctx.md(head.join('\n'));
  for (const s of stills) await ctx.put(s.id, 'png', s.blob, 'still');
  const t = await transcript(buf, ctx);
  if (t) await ctx.md([...head, '## Transcript', '', t, ''].join('\n'));
}
