// edges tab: drop, paste, check results, versions
import { h, dropTarget, pickFiles } from './dom.js';
import { state } from '../state.js';
import { check, commit, rollback } from '../roundtrip.js';

let low = null;
let last = null;

export function render(el) {
  const drop = h('div', { class: 'drop', onclick: async () => { const [f] = await pickFiles({ accept: '.jsonl,.json,.txt,.md' }); if (f) submit(await f.text(), 'file'); } }, 'Drop edges file');
  dropTarget(drop, async items => submit(await items[0].file.text(), 'file'));
  const ta = h('textarea', { placeholder: 'Paste edges here' });
  el.append(
    h('div', { class: 'edges-top' }, drop,
      h('div', { class: 'paste' }, ta, h('button', { class: 'btn', onclick: () => { if (ta.value.trim()) { submit(ta.value, 'paste'); ta.value = ''; } } }, 'Submit'))),
    low = h('div', { class: 'edges-low' }),
  );
  draw();
}

function submit(text, source) {
  last = check(text);
  last.version = commit(last, source);
  draw();
}

function draw() {
  const res = h('div', { class: 'panel' }, h('div', { class: 'cap', style: 'margin-top:0' }, 'Check results'));
  if (last) {
    res.append(h('div', { style: 'font-size:13px' }, `${last.read} lines read · ${last.good.length} edges${last.version ? ` → Version ${last.version}` : ''}`));
    if (last.unknown.length) res.append(h('div', { class: 'flag' }, h('b', {}, 'Unknown references'), last.unknown.map(u => h('div', {}, `Line ${u.line} · ${u.ids.join(', ')}`))));
    if (last.bad.length) res.append(h('div', { class: 'flag' }, h('b', {}, 'Could not read'), last.bad.map(n => h('div', {}, `Line ${n}`))));
  } else {
    res.append(h('div', { class: 'mute' }, '—'));
  }

  const vers = h('div', { class: 'panel' }, h('div', { class: 'cap', style: 'margin-top:0' }, 'Versions'));
  for (const v of [...state.edgeVersions].reverse()) {
    const cur = v.v === state.currentEdges;
    vers.append(h('div', { class: 'ver' + (cur ? ' on' : '') },
      h('span', {}, `Version ${v.v}${cur ? ' · current' : ''}`, h('span', { class: 'mute' }, ` · ${v.edges.length}`)),
      cur ? '' : h('button', { class: 'link', onclick: () => { rollback(v.v); draw(); } }, 'Roll back')));
  }
  if (!state.edgeVersions.length) vers.append(h('div', { class: 'mute' }, '—'));
  low.replaceChildren(res, vers);
}
