// ingest: files, folder, zip → queue → deconstruct
import { state, nextId, changed, hashIndex, putBlob, dropBlobs, fileById } from './state.js';
import { runPdf } from './deconstruct/pdf.js';
import { runPptx } from './deconstruct/pptx.js';
import { runDocx } from './deconstruct/docx.js';
import { runXlsx } from './deconstruct/xlsx.js';
import { runAudio, runVideo } from './deconstruct/media.js';
import { runImage, runKept } from './deconstruct/kept.js';

const KINDS = {
  pdf: 'pdf', pptx: 'pptx', docx: 'docx', xlsx: 'xlsx',
  mp3: 'audio', m4a: 'audio', wav: 'audio', ogg: 'audio', aac: 'audio', flac: 'audio',
  mp4: 'video', mov: 'video', webm: 'video', m4v: 'video',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
};
const RUNNERS = { pdf: runPdf, pptx: runPptx, docx: runDocx, xlsx: runXlsx, audio: runAudio, video: runVideo, image: runImage, kept: runKept };

export const extOf = name => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');
export const kindOf = name => KINDS[extOf(name)] || 'kept';
const capKey = kind => (kind in state.caps ? kind : 'other');

// queue
const queue = [];
let running = false;

export function addFiles(list) {
  for (const { file, source } of list) {
    const kind = kindOf(file.name);
    const rec = {
      id: nextId(), name: file.name, source: source || file.name, ext: extOf(file.name),
      kind, size: file.size, hash: null, status: 'queued', note: '',
      tax: [], description: '', used: '', children: [], rejected: [], meta: {},
    };
    state.files.push(rec);
    queue.push({ rec, file });
  }
  changed();
  pump();
}

async function pump() {
  if (running) return;
  running = true;
  while (queue.length) {
    const { rec, file } = queue.shift();
    try { await process(rec, file); }
    catch (e) { console.error(e); rec.status = 'error'; rec.note = String(e.message || e).slice(0, 80); }
    changed();
  }
  running = false;
}

async function process(rec, file) {
  rec.status = 'working';
  if (file.size > state.caps[capKey(rec.kind)] * 1048576) throw new Error('Over size cap');
  rec.note = 'Hashing';
  changed();
  const buf = await file.arrayBuffer();
  const hash = await sha256(buf);
  const dup = hashIndex().get(hash);
  if (dup && dup !== rec.id) throw new Error('Duplicate of ' + dup);
  rec.hash = hash;
  await RUNNERS[rec.kind](file, rec, ctxFor(rec), buf);
  rec.status = 'done';
  rec.note = rec.kind === 'kept' ? 'Copied unchanged' : rec.rejected?.length ? `Done · ${rec.rejected.length} filtered` : 'Done';
}

// filter: image parts that are tiny or one color
const SCREEN = new Set(['media', 'tile']);
const IMG = /^(png|jpe?g|gif|webp|bmp)$/i;
const MIN_PX = 8;

async function screen(blob) {
  let bmp;
  try { bmp = await createImageBitmap(blob); } catch { return null; }
  const { width: w, height: h } = bmp;
  if (Math.min(w, h) < MIN_PX) { bmp.close(); return `Tiny ${w}×${h}`; }
  const s = 64;
  const g = new OffscreenCanvas(s, s).getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0, s, s);
  bmp.close();
  const d = g.getImageData(0, 0, s, s).data;
  const lo = [255, 255, 255, 255];
  const hi = [0, 0, 0, 0];
  let clear = true;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 8) clear = false;
    for (let k = 0; k < 4; k++) { lo[k] = Math.min(lo[k], d[i + k]); hi[k] = Math.max(hi[k], d[i + k]); }
  }
  if (clear) return 'Blank · transparent';
  if (hi.every((v, k) => v - lo[k] <= 6)) return 'Blank · one color';
  return null;
}

// ctx: what a deconstructor may do to its record
function ctxFor(rec) {
  const dir = `files/${rec.id}/`;
  return {
    path: name => dir + name,
    async md(text) {
      const blob = new Blob([text], { type: 'text/markdown' });
      await putBlob(dir + rec.id + '.md', blob);
      rec.md = dir + rec.id + '.md';
      rec.mdSize = blob.size;
    },
    async put(id, ext, blob, kind) {
      const path = `${dir}${id}.${ext}`;
      await putBlob(path, blob);
      const part = { id, kind, path, size: blob.size };
      const why = SCREEN.has(kind) && IMG.test(ext) ? await screen(blob) : null;
      if (why) (rec.rejected ||= []).push({ ...part, reason: why });
      else rec.children.push(part);
      return path;
    },
    async keep(blob) {
      const path = `${dir}${rec.id}.${rec.ext || 'bin'}`;
      await putBlob(path, blob);
      rec.original = path;
      rec.originalSize = blob.size;
      return path;
    },
    status(text) { rec.note = text; changed(); },
  };
}

async function sha256(buf) {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// intake sources
const skip = path => path.split('/').some(p => p.startsWith('.') || p === '__MACOSX');

// loose files: zips unpack, the rest queue
export async function addLoose(list) {
  const plain = [];
  for (const item of list) {
    const { file, source } = item instanceof File ? { file: item } : item;
    if (skip(source || file.name)) continue;
    if (extOf(file.name) === 'zip') await addZip(file);
    else plain.push({ file, source });
  }
  if (plain.length) addFiles(plain);
}

export async function addZip(file) {
  const zip = await JSZip.loadAsync(file);
  const out = [];
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || skip(entry.name)) continue;
    const blob = await entry.async('blob');
    const base = entry.name.split('/').pop();
    out.push({ file: new File([blob], base), source: `${file.name}/${entry.name}` });
  }
  addFiles(out);
}

export async function addFolder() {
  const root = await window.showDirectoryPicker();
  const out = [];
  async function walk(dir, prefix) {
    for await (const [name, handle] of dir.entries()) {
      const path = prefix + name;
      if (skip(path)) continue;
      if (handle.kind === 'directory') await walk(handle, path + '/');
      else out.push({ file: await handle.getFile(), source: `${root.name}/${path}` });
    }
  }
  await walk(root, '');
  addFiles(out);
}

export async function removeFile(id) {
  const rec = fileById(id);
  if (!rec || rec.status === 'working') return;
  state.files = state.files.filter(f => f.id !== id);
  const q = queue.findIndex(x => x.rec.id === id);
  if (q >= 0) queue.splice(q, 1);
  await dropBlobs(`files/${id}/`);
  changed();
}
