// files tab: intake, options, model meter, file list
import { h, dropTarget, pickFiles } from './dom.js';
import { state, save } from '../state.js';
import { addLoose, addZip, addFolder, removeFile } from '../ingest.js';
import { model, onModel } from '../whisper.js';

let table = null;
let meterRow = null;

onModel(() => { if (meterRow?.isConnected) drawMeter(); });

export function render(el) {
  const drop = h('div', { class: 'box drop', onclick: async () => addLoose(await pickFiles({ multiple: true })) }, 'Drop files or folders');
  dropTarget(drop, files => addLoose(files));
  const canFolder = 'showDirectoryPicker' in window;
  const folder = h('button', { class: 'box', disabled: !canFolder, onclick: () => addFolder().catch(() => {}) }, 'Pick folder', h('small', {}, 'Chrome and Edge only'));
  const zip = h('button', { class: 'box', onclick: async () => { for (const f of await pickFiles({ accept: '.zip', multiple: true })) await addZip(f); } }, 'Upload zip');

  el.append(
    h('div', { class: 'intake' }, drop, folder, zip),
    h('div', { class: 'row', style: 'margin-top:14px;font-size:12px' },
      h('label', { class: 'row', style: 'gap:6px' }, h('input', { type: 'checkbox', checked: state.ocr, onchange: e => { state.ocr = e.target.checked; save(); } }), 'Read text in images (slow)'),
      h('label', { class: 'row', style: 'gap:6px' }, h('input', { type: 'checkbox', checked: state.transcribe, onchange: e => { state.transcribe = e.target.checked; save(); } }), 'Transcribe audio')),
    meterRow = h('div', { class: 'row', style: 'margin-top:10px;font-size:12px' }),
    table = h('table', { class: 'list' }),
  );
  drawMeter();
  update();
}

function drawMeter() {
  if (model.status === 'idle') { meterRow.replaceChildren(); return; }
  if (model.status === 'ready') { meterRow.replaceChildren(h('span', { class: 'mute' }, `Transcription model · ready · ${model.device}`)); return; }
  const fill = h('div', { style: `width:${model.percent}%` });
  meterRow.replaceChildren(h('span', {}, 'Transcription model · first-time download'), h('div', { class: 'meter' }, fill), h('span', {}, `${model.percent}%`));
}

function status(f) {
  if (f.status === 'done' || f.status === 'working') return f.note;
  if (f.status === 'error') return h('span', { class: 'pill err' }, `${f.note} · not exported`);
  return h('span', { class: 'pill' }, 'Pending · not exported');
}

export function update() {
  if (!table?.isConnected) return;
  table.replaceChildren(
    h('tr', {}, h('th', {}, 'FILE'), h('th', {}, 'ID'), h('th', {}, 'TYPE'), h('th', {}, 'STATUS'), h('th', {})),
    ...state.files.map(f => h('tr', {},
      h('td', { title: f.source }, f.name),
      h('td', { class: 'mute' }, f.id),
      h('td', {}, f.kind === 'kept' ? 'kept as-is' : f.kind),
      h('td', {}, status(f)),
      h('td', { style: 'text-align:right' }, f.status === 'working' ? '' : h('button', { class: 'link', title: 'Remove', onclick: () => removeFile(f.id) }, '×')),
    )),
  );
}
