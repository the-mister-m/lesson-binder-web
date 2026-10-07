// export: package stats, zip download
import { state, getBlob } from './state.js';
import { doneFiles, indexMd, nodesJsonl, taxonomiesJsonl, INSTRUCTIONS } from './render-index.js';

// visible files only; hidden .package/ not counted
export function stats() {
  const sizes = [new Blob([indexMd()]).size, new Blob([INSTRUCTIONS]).size];
  for (const f of doneFiles()) {
    if (f.md) sizes.push(f.mdSize || 0);
    if (f.original) sizes.push(f.originalSize || 0);
    for (const c of f.children) sizes.push(c.size || 0);
  }
  return {
    files: sizes.length,
    largestMB: Math.max(0, ...sizes) / 1048576,
    totalMB: sizes.reduce((a, b) => a + b, 0) / 1048576,
    pending: state.files.length - doneFiles().length,
  };
}

// flat: notebooklm — files only, no folders, no .package/
export async function download(onStep, flat = false) {
  const zip = new JSZip();
  zip.file('INDEX.md', indexMd(flat));
  zip.file('INSTRUCTIONS.md', INSTRUCTIONS);
  const files = doneFiles();
  for (const f of files) {
    for (const path of [f.md, f.original, ...f.children.map(c => c.path)].filter(Boolean)) {
      const blob = await getBlob(path);
      if (blob) zip.file(flat ? path.split('/').pop() : path, blob);
    }
  }
  if (flat) return writeZip(zip, onStep, '-notebooklm');
  zip.file('.package/nodes.jsonl', nodesJsonl());
  zip.file('.package/taxonomies.jsonl', taxonomiesJsonl());
  for (const v of state.edgeVersions) {
    zip.file(`.package/edges/v${String(v.v).padStart(3, '0')}.jsonl`, v.edges.map(e => JSON.stringify(e)).join('\n') + '\n');
  }
  zip.file('.package/manifest.json', JSON.stringify({
    app: 'teacher-materials-packager/web-lite', created: new Date().toISOString(),
    current_edges: state.currentEdges ? `v${String(state.currentEdges).padStart(3, '0')}` : null,
  }, null, 2));
  return writeZip(zip, onStep, '');
}

async function writeZip(zip, onStep, suffix) {
  const blob = await zip.generateAsync({ type: 'blob' }, m => onStep?.(Math.round(m.percent)));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `package-${new Date().toISOString().slice(0, 10)}${suffix}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
