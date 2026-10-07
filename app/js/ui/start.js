// start tab: wordmark, size caps, storage warning
import { h } from './dom.js';
import { state, save, resetAll, CAP_DEFAULTS } from '../state.js';

const LABELS = { pdf: 'PDF', pptx: 'PPTX', docx: 'DOCX', xlsx: 'XLSX', audio: 'Audio', video: 'Video', other: 'Other' };

export function render(el, go) {
  el.append(
    h('img', { class: 'wordmark', src: 'assets/SC_DistrictLogo_FullColor_NoStroke-WithWordmark.jpg', alt: 'South Colonie Central School District' }),
    h('div', { class: 'h' }, 'Local only'),
    h('div', { class: 'cap' }, 'Per-file size caps · MB'),
    h('div', { class: 'panel caps' }, Object.keys(LABELS).map(k =>
      h('label', {}, LABELS[k], h('input', {
        type: 'number', min: 1, value: state.caps[k],
        oninput: e => { state.caps[k] = Math.max(1, Number(e.target.value) || CAP_DEFAULTS[k]); save(); },
      })))),
    h('div', { class: 'warn' }, 'Saved in this browser · clearing browser data deletes it'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => go('files') }, 'Begin'),
      h('button', {
        class: 'btn ghost',
        onclick: async () => { if (confirm('Delete this package and start over?')) { await resetAll(); go('start'); } },
      }, 'New package')),
  );
}
