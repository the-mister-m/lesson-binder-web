// index: INDEX.md, nodes/taxonomies jsonl, instructions stub
import { state } from './state.js';

export const doneFiles = () => state.files.filter(f => f.status === 'done');

const KIND_LABEL = { pdf: 'PDF', pptx: 'PowerPoint', docx: 'Word', xlsx: 'Excel', audio: 'Audio', video: 'Video', image: 'Image', kept: 'Kept as-is' };

export function metaLine(f) {
  const m = f.meta || {};
  const bits = [KIND_LABEL[f.kind] || f.kind];
  const n = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
  if (m.slides) bits.push(n(m.slides, 'slide'));
  if (m.pages) bits.push(n(m.pages, 'page'));
  if (m.sheets) bits.push(n(m.sheets, 'sheet'));
  if (m.seconds) bits.push(`${Math.round(m.seconds / 60)} min`);
  return bits.join(' · ');
}

const taxNames = f => state.taxonomies.filter(t => (f.tax || []).includes(t.id)).map(t => t.name || 'Untitled');

// flat: file name only, no folders
const at = (path, flat) => (flat ? path.split('/').pop() : path);

function partsLine(f) {
  const groups = {};
  for (const c of f.children) (groups[c.kind] ||= []).push(c.id);
  const show = ids => (ids.length <= 12 ? ids.join(', ') : `${ids[0]} … ${ids[ids.length - 1]}`);
  return Object.entries(groups).map(([k, ids]) => `${k}: ${ids.length} (${show(ids)})`).join('; ');
}

export function indexMd(flat = false) {
  const files = doneFiles();
  const out = ['# Package Index', '', flat ? `${files.length} files` : `${files.length} files · edges: .package/edges/`, ''];
  out.push('## Taxonomies', '');
  for (const t of state.taxonomies) {
    out.push(`### ${t.name}`, '', t.description || '—', '');
  }
  out.push('## Files', '');
  for (const f of files) {
    out.push(`### ${f.id} · ${f.name}`, '');
    out.push(`- Type: ${metaLine(f)}`);
    if (f.source && f.source !== f.name) out.push(`- Source: ${f.source}`);
    out.push(`- Taxonomies: ${taxNames(f).join(', ') || '—'}`);
    out.push(`- Description: ${f.description || '—'}`);
    out.push(`- How it was used: ${f.used || '—'}`);
    if (f.md) out.push(`- Markdown: ${at(f.md, flat)}`);
    if (f.original) out.push(`- File: ${at(f.original, flat)}`);
    if (f.children.length) out.push(`- Parts: ${partsLine(f)}`);
    out.push('');
  }
  return out.join('\n');
}

export function nodesJsonl() {
  return doneFiles().map(f => JSON.stringify({
    id: f.id, hash: f.hash, kind: f.kind, source_name: f.name, source: f.source,
    taxonomies: taxNames(f), description: f.description, used: f.used,
    markdown: f.md || null, file: f.original || null,
    children: f.children.map(({ id, kind, path }) => ({ id, kind, path })), meta: f.meta,
  })).join('\n') + '\n';
}

export function taxonomiesJsonl() {
  return state.taxonomies.map(t => JSON.stringify({ id: t.id, name: t.name, description: t.description })).join('\n') + '\n';
}

export const INSTRUCTIONS = `# Instructions (DRAFT)

Read INDEX.md first.

1. Before reading any materials, list your gaps: what you would need to know that the index does not tell you.
2. Round one: ask the teacher questions from those gaps.
3. Round two: if a strong idea appears, ask the questions it needs.
4. Write the index spec and the edges.
5. Ask: "Do you want a separate markdown of this session's ideas, not the index?"

Keep two headers, never merged:

## LESSON OBJECTIVES
## SESSION OBJECTIVES

## Edge format

One JSON object per line. IDs come from INDEX.md (F-001, F-001.p3, F-001.m2 …).

{"from": "F-001", "to": "F-002.p3", "note": "why these connect"}
`;
