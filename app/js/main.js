// main: load package, tab routing
import { load, on } from './state.js';
import * as start from './ui/start.js';
import * as files from './ui/files.js';
import * as taxonomies from './ui/taxonomies.js';
import * as nodes from './ui/nodes.js';
import * as edges from './ui/edges.js';
import * as exp from './ui/export.js';

const TABS = { start, files, taxonomies, nodes, edges, export: exp };
const view = document.getElementById('view');
const buttons = [...document.querySelectorAll('#tabs button')];
let current = null;

function go(tab) {
  if (!(tab in TABS)) tab = 'start';
  history.replaceState(null, '', '#' + tab);
  buttons.forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  view.replaceChildren();
  current = TABS[tab];
  current.render(view, go);
}

buttons.forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));
on(() => current?.update?.());

window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());

await load();
go(location.hash.slice(1));
