// whisper: worker handle, model download progress
let worker = null;
let seq = 0;
const waiting = new Map();
const files = new Map(); // model file → { loaded, total }

export const model = { status: 'idle', percent: 0, device: '' };
const subs = new Set();
export function onModel(fn) { subs.add(fn); }
const tell = () => subs.forEach(fn => fn(model));

function boot() {
  if (worker) return worker;
  worker = new Worker(new URL('./whisper-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') {
      const p = data.p;
      if (p.file && p.total) files.set(p.file, { loaded: p.loaded || 0, total: p.total });
      if (p.status === 'done' && files.has(p.file)) files.get(p.file).loaded = files.get(p.file).total;
      let l = 0, t = 0;
      for (const f of files.values()) { l += f.loaded; t += f.total; }
      model.status = 'loading';
      model.percent = t ? Math.round((l / t) * 100) : 0;
      tell();
    } else if (data.type === 'ready') {
      Object.assign(model, { status: 'ready', percent: 100, device: data.device });
      tell();
    } else {
      const w = waiting.get(data.id);
      if (!w) return;
      waiting.delete(data.id);
      data.type === 'done' ? w.res(data.out) : w.rej(new Error(data.message));
    }
  };
  return worker;
}

// audio: Float32Array, 16 kHz mono
export function transcribe(audio) {
  const id = ++seq;
  if (model.status === 'idle') { model.status = 'loading'; tell(); }
  return new Promise((res, rej) => {
    waiting.set(id, { res, rej });
    boot().postMessage({ id, audio }, [audio.buffer]);
  });
}

export async function decode16k(buf) {
  const ac = new AudioContext({ sampleRate: 16000 });
  try {
    const audio = await ac.decodeAudioData(buf.slice(0));
    if (audio.numberOfChannels === 1) return audio.getChannelData(0);
    const out = new Float32Array(audio.length);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const ch = audio.getChannelData(c);
      for (let i = 0; i < ch.length; i++) out[i] += ch[i] / audio.numberOfChannels;
    }
    return out;
  } finally {
    ac.close();
  }
}

const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function transcriptMd(out) {
  const chunks = out?.chunks || [];
  if (!chunks.length) return (out?.text || '').trim();
  return chunks.map(c => `[${mmss(c.timestamp?.[0] || 0)}] ${c.text.trim()}`).join('\n');
}
