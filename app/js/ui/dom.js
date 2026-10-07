// dom: element builder, drop target, file picker
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

// drop: files and folders, walked recursively → [{ file, source }]
export function dropTarget(el, onFiles) {
  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', async e => {
    e.preventDefault();
    el.classList.remove('over');
    const entries = [...(e.dataTransfer?.items || [])].map(i => i.webkitGetAsEntry?.()).filter(Boolean);
    const files = [...(e.dataTransfer?.files || [])];
    const out = [];
    if (entries.length) for (const entry of entries) await readEntry(entry, out);
    else out.push(...files.map(file => ({ file })));
    if (out.length) onFiles(out);
  });
}

async function readEntry(entry, out) {
  if (entry.isFile) {
    const file = await new Promise((res, rej) => entry.file(res, rej));
    out.push({ file, source: entry.fullPath.replace(/^\//, '') });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    for (;;) {
      const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const child of batch) await readEntry(child, out);
    }
  }
}

export function pickFiles({ accept = '', multiple = false } = {}) {
  return new Promise(res => {
    const input = h('input', { type: 'file', accept, multiple });
    input.onchange = () => res([...input.files]);
    input.click();
  });
}

export const mb = n => (n < 0.1 ? n.toFixed(2) : n.toFixed(1));
