// taxonomies tab: list, name, description
import { h } from './dom.js';
import { state, save } from '../state.js';

let wrap = null;
let sel = null;

export function render(el) {
  wrap = h('div', { class: 'split' });
  el.append(wrap);
  draw();
}

function draw() {
  const list = state.taxonomies;
  if (!list.find(t => t.id === sel)) sel = list[0]?.id || null;
  const t = list.find(x => x.id === sel);
  const sideBtn = {};
  const side = h('div', { class: 'side' },
    list.map(x => (sideBtn[x.id] = h('button', { class: x.id === sel ? 'on' : '', onclick: () => { sel = x.id; draw(); } }, x.name || 'Untitled'))),
    h('button', { class: 'add', onclick: add }, '+ Add taxonomy'));

  if (!t) { wrap.replaceChildren(side, h('div', { class: 'mute' }, 'No taxonomies')); return; }

  wrap.replaceChildren(side, h('div', {},
    h('div', { class: 'cap', style: 'margin-top:0' }, 'Name'),
    h('input', { type: 'text', value: t.name, oninput: e => { t.name = e.target.value; sideBtn[t.id].textContent = t.name || 'Untitled'; save(); } }),
    h('div', { class: 'cap' }, 'Description'),
    h('textarea', { oninput: e => { t.description = e.target.value; save(); } }, t.description),
    h('div', { style: 'margin-top:24px' }, h('button', { class: 'link', onclick: () => del(t) }, 'Delete taxonomy')),
  ));
}

function add() {
  const t = { id: 't' + Date.now().toString(36), name: '', description: '' };
  state.taxonomies.push(t);
  sel = t.id;
  save();
  draw();
  wrap.querySelector('input[type=text]')?.focus();
}

function del(t) {
  if (!confirm(`Delete "${t.name || 'Untitled'}"?`)) return;
  state.taxonomies = state.taxonomies.filter(x => x.id !== t.id);
  for (const f of state.files) if (f.tax) f.tax = f.tax.filter(id => id !== t.id);
  save();
  draw();
}
