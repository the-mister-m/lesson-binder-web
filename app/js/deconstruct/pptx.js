// pptx: slide xml → markdown; media copied out by id
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const MEDIA = /\/(image|video|audio|media)$/;

const parse = s => new DOMParser().parseFromString(s, 'application/xml');
const all = (el, name) => [...el.getElementsByTagNameNS('*', name)];
const first = (el, name) => el.getElementsByTagNameNS('*', name)[0];
const relId = (el, name) => el.getAttributeNS(REL_NS, name) || el.getAttribute('r:' + name);

function resolve(dir, target) {
  if (target.startsWith('/')) return target.slice(1);
  const out = [];
  for (const p of (dir + target).split('/')) {
    if (p === '..') out.pop();
    else if (p !== '.' && p !== '') out.push(p);
  }
  return out.join('/');
}

async function readRels(zip, part) {
  const dir = part.slice(0, part.lastIndexOf('/') + 1);
  const xml = await zip.file(`${dir}_rels/${part.slice(dir.length)}.rels`)?.async('string');
  const map = {};
  if (!xml) return map;
  for (const r of all(parse(xml), 'Relationship')) {
    const external = r.getAttribute('TargetMode') === 'External';
    map[r.getAttribute('Id')] = {
      type: r.getAttribute('Type') || '',
      target: external ? null : resolve(dir, r.getAttribute('Target')),
      url: external ? r.getAttribute('Target') : null,
    };
  }
  return map;
}

// paragraph → { lvl, text }
function paras(txBody) {
  if (!txBody) return [];
  const out = [];
  for (const p of all(txBody, 'p')) {
    let text = '';
    for (const c of p.children) {
      if (c.localName === 'r' || c.localName === 'fld') text += first(c, 't')?.textContent || '';
      else if (c.localName === 'br') text += ' ';
    }
    text = text.trim();
    if (!text) continue;
    const lvl = Number(first(p, 'pPr')?.getAttribute('lvl') || 0);
    out.push({ lvl, text });
  }
  return out;
}

function table(tbl) {
  const rows = all(tbl, 'tr').map(tr => all(tr, 'tc').map(tc => paras(first(tc, 'txBody')).map(x => x.text).join(' ').replace(/\|/g, '\\|')));
  if (!rows.length) return '';
  const w = Math.max(...rows.map(r => r.length));
  const line = r => '| ' + [...r, ...Array(w - r.length).fill('')].join(' | ') + ' |';
  return [line(rows[0]), '|' + ' --- |'.repeat(w), ...rows.slice(1).map(line)].join('\n');
}

export async function runPptx(file, rec, ctx, buf) {
  const zip = await JSZip.loadAsync(buf);
  const pres = parse(await zip.file('ppt/presentation.xml').async('string'));
  const presRels = await readRels(zip, 'ppt/presentation.xml');
  const slides = all(pres, 'sldId').map(s => presRels[relId(s, 'id')]?.target).filter(Boolean);

  const mediaIds = new Map(); // zip path → child id
  const mediaRef = target => {
    if (!mediaIds.has(target)) mediaIds.set(target, `${rec.id}.m${mediaIds.size + 1}`);
    const id = mediaIds.get(target);
    return `${id}.${target.split('.').pop().toLowerCase()}`;
  };

  const md = [`# ${rec.id} · ${rec.name}`, ''];
  for (let i = 0; i < slides.length; i++) {
    ctx.status(`Slide ${i + 1} of ${slides.length}`);
    const part = slides[i];
    const doc = parse(await zip.file(part).async('string'));
    const rels = await readRels(zip, part);
    const hidden = doc.documentElement.getAttribute('show') === '0';
    let title = '';
    const body = [];

    const walk = tree => {
      for (const el of tree.children) {
        const n = el.localName;
        if (n === 'grpSp') walk(el);
        else if (n === 'AlternateContent') { const alt = first(el, 'Fallback') || first(el, 'Choice'); if (alt) walk(alt); }
        else if (n === 'sp') {
          const ph = first(el, 'ph')?.getAttribute('type') || '';
          const lines = paras(first(el, 'txBody'));
          if (!title && (ph === 'title' || ph === 'ctrTitle')) { title = lines.map(l => l.text).join(' '); continue; }
          for (const l of lines) body.push(`${'  '.repeat(l.lvl)}- ${l.text}`);
        } else if (n === 'pic') {
          const alt = (first(el, 'cNvPr')?.getAttribute('descr') || '').replace(/\s+/g, ' ').trim();
          const links = [first(el, 'blip') && relId(first(el, 'blip'), 'embed')];
          for (const tag of ['videoFile', 'audioFile']) { const v = first(el, tag); if (v) links.push(relId(v, 'link')); }
          const m = first(el, 'media'); if (m) links.push(relId(m, 'embed'));
          for (const id of links.filter(Boolean)) {
            const r = rels[id];
            if (r?.target && MEDIA.test(r.type)) body.push('', `![${alt}](${mediaRef(r.target)})`, '');
            else if (r?.url) body.push('', `[linked media](${r.url})`, '');
          }
        } else if (n === 'graphicFrame') {
          const tbl = first(el, 'tbl');
          const uri = first(el, 'graphicData')?.getAttribute('uri') || '';
          if (tbl) body.push('', table(tbl), '');
          else if (uri.includes('chart')) body.push('[chart]');
          else if (uri.includes('diagram')) body.push('[diagram]');
        }
      }
    };
    const tree = first(doc, 'spTree');
    if (tree) walk(tree);

    md.push(`## Slide ${i + 1}${title ? ' · ' + title : ''}${hidden ? ' (hidden)' : ''}`, '', ...body, '');

    const notesRel = Object.values(rels).find(r => r.type.endsWith('/notesSlide') && r.target);
    if (notesRel && zip.file(notesRel.target)) {
      const ndoc = parse(await zip.file(notesRel.target).async('string'));
      const notes = all(ndoc, 'sp')
        .filter(sp => first(sp, 'ph')?.getAttribute('type') === 'body')
        .flatMap(sp => paras(first(sp, 'txBody')).map(l => l.text));
      if (notes.length) md.push('### Notes', '', ...notes, '');
    }
  }
  rec.meta.slides = slides.length;

  // markdown first, then media
  await ctx.md(md.join('\n'));
  let n = 0;
  for (const [target, id] of mediaIds) {
    ctx.status(`Media ${++n} of ${mediaIds.size}`);
    const f = zip.file(target);
    if (f) await ctx.put(id, target.split('.').pop().toLowerCase(), await f.async('blob'), 'media');
  }
}
