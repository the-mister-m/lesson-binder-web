// whisper worker: whisper-small via transformers.js
import { pipeline, env } from '../vendor/transformers.min.js';

env.allowLocalModels = false;
const MODEL = 'onnx-community/whisper-small';
let asr = null;

async function load() {
  if (asr) return asr;
  const adapter = navigator.gpu ? await navigator.gpu.requestAdapter().catch(() => null) : null;
  const device = adapter ? 'webgpu' : 'wasm';
  const dtype = adapter ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8';
  asr = await pipeline('automatic-speech-recognition', MODEL, {
    device, dtype,
    progress_callback: p => postMessage({ type: 'progress', p }),
  });
  postMessage({ type: 'ready', device });
  return asr;
}

onmessage = async e => {
  const { id, audio } = e.data;
  try {
    const run = await load();
    const out = await run(audio, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
    postMessage({ type: 'done', id, out });
  } catch (err) {
    postMessage({ type: 'error', id, message: String(err?.message || err) });
  }
};
