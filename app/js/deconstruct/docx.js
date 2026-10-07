// docx: mammoth → markdown; images copied out by id
const b64Blob = (b64, type) => {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type });
};

export async function runDocx(file, rec, ctx, buf) {
  ctx.status('Reading document');
  const imgs = [];
  const convertImage = mammoth.images.imgElement(async image => {
    const id = `${rec.id}.m${imgs.length + 1}`;
    const type = image.contentType || 'image/png';
    const ext = type.split('/')[1].replace('jpeg', 'jpg').replace(/^x-/, '');
    imgs.push({ id, ext, type, b64: await image.read('base64') });
    return { src: `${id}.${ext}` };
  });
  const res = await mammoth.convertToMarkdown({ arrayBuffer: buf }, { convertImage });

  // markdown first, then images
  await ctx.md(`# ${rec.id} · ${rec.name}\n\n${res.value}`);
  for (let i = 0; i < imgs.length; i++) {
    ctx.status(`Image ${i + 1} of ${imgs.length}`);
    await ctx.put(imgs[i].id, imgs[i].ext, b64Blob(imgs[i].b64, imgs[i].type), 'media');
  }
}
