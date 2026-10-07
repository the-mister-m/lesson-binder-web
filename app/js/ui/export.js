// export tab: target, limits vs package, download
import { h, mb } from './dom.js';
import { state, save, TARGETS } from '../state.js';
import { stats, download } from '../export.js';

let box = null;

export function render(el) {
  box = h('div', {});
  el.append(box);
  draw();
}

export function update() {
  if (box?.isConnected && !box.contains(document.activeElement)) draw();
}

function draw() {
  const lim = state.limits[state.target];
  const s = stats();
  const field = (key, label, now, fmt) => h('label', {}, label,
    h('input', { type: 'number', min: 1, value: lim[key], oninput: e => { lim[key] = Math.max(1, Number(e.target.value) || TARGETS[state.target][key]); save(); refresh(); } }),
    h('span', { class: now > lim[key] ? 'over' : 'mute', 'data-k': key }, `package ${fmt(now)}`));
  const refresh = () => box.querySelectorAll('[data-k]').forEach(n => {
    const now = { files: s.files, fileMB: s.largestMB, totalMB: s.totalMB }[n.dataset.k];
    n.className = now > lim[n.dataset.k] ? 'over' : 'mute';
  });
  const progress = h('span', { class: 'mute' });
  const zipBtn = (label, flat) => h('button', {
    class: 'btn',
    onclick: async e => {
      e.target.disabled = true;
      try { await download(p => { progress.textContent = `Zipping ${p}%`; }, flat); progress.textContent = ''; }
      finally { e.target.disabled = false; }
    },
  }, label);

  box.replaceChildren(
    h('div', { class: 'cap', style: 'margin-top:0' }, 'Target platform'),
    h('select', { style: 'width:240px', onchange: e => { state.target = e.target.value; save(); draw(); } },
      Object.entries(TARGETS).map(([k, t]) => h('option', { value: k, selected: k === state.target }, t.label))),
    h('div', { class: 'panel', style: 'margin-top:14px' },
      h('div', { class: 'cap', style: 'margin-top:0' }, 'Limits · editable · conservative defaults'),
      h('div', { class: 'limits' },
        field('files', 'Max files', s.files, n => n),
        field('fileMB', 'Max file size (MB)', s.largestMB, mb),
        field('totalMB', 'Max total (MB)', s.totalMB, mb),
        h('button', { class: 'link', onclick: () => { state.limits[state.target] = { ...TARGETS[state.target] }; save(); draw(); } }, 'Reset defaults'))),
    s.pending ? h('div', { style: 'margin-top:12px' }, h('span', { class: 'pill' }, `${s.pending} pending · not exported`)) : null,
    h('div', { class: 'warn' }, "Check your platform's file limits first."),
    h('div', { class: 'row' },
      zipBtn('Download package (.zip)', false),
      zipBtn('Download for NotebookLM (.zip)', true),
      progress),
  );
}
