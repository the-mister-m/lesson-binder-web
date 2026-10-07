// roundtrip: edges in, checked, versioned
import { state, changed, nodeIds, hashIndex } from './state.js';

// line numbers match the input as given
export function check(text) {
  const ids = nodeIds();
  const hashes = hashIndex();
  const res = { read: 0, good: [], unknown: [], bad: [] };
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('```')) return;
    res.read += 1;
    let e;
    try { e = JSON.parse(line); } catch { res.bad.push(i + 1); return; }
    if (!e || typeof e !== 'object' || typeof e.from !== 'string' || typeof e.to !== 'string') { res.bad.push(i + 1); return; }
    e.from = hashes.get(e.from) || e.from;
    e.to = hashes.get(e.to) || e.to;
    const missing = [e.from, e.to].filter(id => !ids.has(id));
    if (missing.length) res.unknown.push({ line: i + 1, ids: missing });
    else res.good.push(e);
  });
  return res;
}

// a version only when something landed
export function commit(res, source) {
  if (!res.good.length) return null;
  const v = state.edgeVersions.length + 1;
  state.edgeVersions.push({ v, at: new Date().toISOString(), source, edges: res.good, unknown: res.unknown, bad: res.bad });
  state.currentEdges = v;
  changed();
  return v;
}

export function rollback(v) {
  state.currentEdges = v;
  changed();
}
