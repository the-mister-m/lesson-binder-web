// state: one package, persisted to IndexedDB

export const CAP_DEFAULTS = { pdf: 100, pptx: 200, docx: 50, xlsx: 25, audio: 200, video: 500, other: 200 };

export const TARGETS = {
  claude:     { label: 'Claude',     files: 20, fileMB: 30,  totalMB: 200 },
  chatgpt:    { label: 'ChatGPT',    files: 10, fileMB: 25,  totalMB: 200 },
  notebooklm: { label: 'NotebookLM', files: 100, fileMB: 200, totalMB: 1000 },
  custom:     { label: 'Custom',     files: 20, fileMB: 25,  totalMB: 200 },
};

function fresh() {
  return {
    seq: 0,
    taxonomies: [],
    files: [],
    edgeVersions: [],
    currentEdges: 0,
    caps: { ...CAP_DEFAULTS },
    ocr: false,
    transcribe: true,
    target: 'claude',
    limits: JSON.parse(JSON.stringify(TARGETS)),
  };
}

export const state = fresh();

// change events
const subs = new Set();
export function on(fn) { subs.add(fn); return () => subs.delete(fn); }
export function changed() { subs.forEach(fn => fn()); save(); }

// ids
export function nextId() {
  state.seq += 1;
  return 'F-' + String(state.seq).padStart(3, '0');
}
export function fileById(id) { return state.files.find(f => f.id === id); }
export function nodeIds() {
  const ids = new Set();
  for (const f of state.files) {
    if (f.status !== 'done') continue;
    ids.add(f.id);
    for (const c of f.children || []) ids.add(c.id);
  }
  return ids;
}
export function hashIndex() {
  const m = new Map();
  for (const f of state.files) if (f.hash) m.set(f.hash, f.id);
  return m;
}

// indexeddb
const DB = 'tmp-weblite';
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('meta'); r.result.createObjectStore('blobs'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
}

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => tx('meta', 'readwrite', s => s.put(JSON.stringify(state), 'state')), 250);
}

export async function load() {
  const raw = await tx('meta', 'readonly', s => s.get('state'));
  if (!raw) return;
  Object.assign(state, fresh(), JSON.parse(raw));
  // interrupted work comes back pending
  for (const f of state.files) {
    if (!['done', 'error'].includes(f.status)) { f.status = 'error'; f.note = 'Interrupted'; }
  }
}

export function putBlob(path, blob) { return tx('blobs', 'readwrite', s => s.put(blob, path)); }
export function getBlob(path) { return tx('blobs', 'readonly', s => s.get(path)); }
export function dropBlobs(prefix) {
  return tx('blobs', 'readwrite', s => s.delete(IDBKeyRange.bound(prefix, prefix + '￿')));
}

export async function resetAll() {
  await tx('blobs', 'readwrite', s => s.clear());
  await tx('meta', 'readwrite', s => s.clear());
  Object.assign(state, fresh());
  subs.forEach(fn => fn());
}
