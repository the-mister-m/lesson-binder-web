// nodes tab: per-file taxonomies, description, use, contents
import { h } from './dom.js';
import { state, save, getBlob } from '../state.js';
import { metaLine } from '../render-index.js';

const THUMBS = 24;
let wrap = null;
let side = null;
let sel = null;
let goTo = null;
let urls = [];

export function render(el, go) {
  goTo = go;
  wrap = h('div', { class: 'split' });
  el.append(wrap);
  draw();
}

// files finishing in the background: side list only
export function update() {
  if (!side?.isConnected) return;
  const fresh = sideList();
  side.replaceWith(fresh);
  side = fresh;
}

function sideList() {
  return h('div', { class: 'side' }, state.files.map(f => h('button', {
    class: f.id === sel ? 'on' : '',
    style: f.status === 'done' ? '' : 'color:#888',
    title: f.status === 'done' ? f.id : 'Pending',
    onclick: () => { if (f.status === 'done') { sel = f.id; draw(); } },
  }, f.name)));
}

function draw() {
  urls.forEach(URL.revokeObjectURL);
  urls = [];
  const done = state.files.filter(f => f.status === 'done');
  if (!done.find(f => f.id === sel)) sel = done[0]?.id || null;
  side = sideList();
  const f = done.find(x => x.id === sel);
  if (!f) { wrap.replaceChildren(side, h('div', { class: 'mute' }, 'No finished files')); return; }

  const tax = state.taxonomies.length
    ? h('div', {}, state.taxonomies.map(t => {
        const on = (f.tax || []).includes(t.id);
        return h('span', { class: 'chip' + (on ? ' on' : ''), onclick: e => toggle(f, t, e.currentTarget) }, t.name || 'Untitled');
      }))
    : h('button', { class: 'link', onclick: () => goTo('taxonomies') }, 'Add taxonomies');

  const mdBox = h('div', {});
  const parts = h('div', { class: 'parts' });
  const rejected = f.rejected || [];
  const filtered = h('div', { class: 'parts' });

  wrap.replaceChildren(side, h('div', {},
    h('div', { class: 'name' }, f.name),
    h('div', { class: 'cap', style: 'margin-top:2px' }, `${f.id} · ${metaLine(f)}`),
    h('div', { class: 'cap' }, 'Taxonomies'),
    tax,
    h('div', { class: 'cap' }, 'Description'),
    h('textarea', { oninput: e => { f.description = e.target.value; save(); } }, f.description),
    h('div', { class: 'cap' }, 'How it was used'),
    h('textarea', { oninput: e => { f.used = e.target.value; save(); } }, f.used),
    h('div', { class: 'cap' }, 'Contents'),
    h('div', { class: 'row' },
      f.md ? h('button', { class: 'link', onclick: () => showMd(f, mdBox) }, 'Markdown') : null,
      f.original ? h('button', { class: 'link', onclick: () => openBlob(f.original) }, 'Original') : null,
      h('span', { class: 'mute' }, `${f.children.length} part${f.children.length === 1 ? '' : 's'}`)),
    mdBox,
    parts,
    rejected.length ? h('div', { class: 'cap' }, `Filtered · ${rejected.length} · not exported`) : null,
    rejected.length ? filtered : null,
  ));
  fillParts(f, parts);
  if (rejected.length) fillFiltered(f, filtered);
}

// filtered: thumbnail, reason, restore
async function fillFiltered(f, box) {
  for (const r of f.rejected) {
    if (!box.isConnected) return;
    const blob = await getBlob(r.path);
    const u = blob ? URL.createObjectURL(blob) : '';
    if (u) urls.push(u);
    box.append(h('div', { class: 'filtered', title: r.id },
      u ? h('img', { src: u, alt: r.id }) : null,
      h('div', { class: 'mute' }, r.id),
      h('div', { class: 'mute' }, r.reason),
      h('button', { class: 'link', onclick: () => restore(f, r) }, 'Restore')));
  }
}

function restore(f, r) {
  f.rejected = f.rejected.filter(x => x.id !== r.id);
  const { reason, ...part } = r;
  f.children.push(part);
  f.children.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  save();
  draw();
}

function toggle(f, t, chip) {
  const cur = new Set(f.tax || []);
  cur.has(t.id) ? cur.delete(t.id) : cur.add(t.id);
  f.tax = [...cur];
  chip.classList.toggle('on', cur.has(t.id));
  save();
}

async function showMd(f, box) {
  if (box.firstChild) { box.replaceChildren(); return; }
  const blob = await getBlob(f.md);
  box.replaceChildren(h('pre', { class: 'md' }, blob ? await blob.text() : ''));
}

async function openBlob(path) {
  const blob = await getBlob(path);
  if (!blob) return;
  const u = URL.createObjectURL(blob);
  urls.push(u);
  window.open(u, '_blank');
}

async function fillParts(f, box) {
  const isImg = p => /\.(png|jpe?g|gif|webp|svg)$/i.test(p);
  const shown = f.children.slice(0, THUMBS);
  for (const c of shown) {
    if (!box.isConnected) return;
    if (isImg(c.path)) {
      const blob = await getBlob(c.path);
      if (!blob) continue;
      const u = URL.createObjectURL(blob);
      urls.push(u);
      box.append(h('a', { href: u, target: '_blank', title: c.id }, h('img', { src: u, alt: c.id })));
    } else {
      box.append(h('button', { class: 'link', onclick: () => openBlob(c.path) }, c.id));
    }
  }
  if (f.children.length > THUMBS) box.append(h('span', { class: 'mute' }, `+${f.children.length - THUMBS} more`));
}
