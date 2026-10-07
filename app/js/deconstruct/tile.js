// tile: quadrants for pages whose long edge passes the threshold
export const TILE_ABOVE = 2000;

export const needsTiles = (w, h) => Math.max(w, h) > TILE_ABOVE;

export const toBlob = canvas => new Promise(res => canvas.toBlob(res, 'image/png'));

export async function quadrants(canvas) {
  const w = Math.ceil(canvas.width / 2), h = Math.ceil(canvas.height / 2);
  const out = [];
  for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
    const c = document.createElement('canvas');
    c.width = Math.min(w, canvas.width - x);
    c.height = Math.min(h, canvas.height - y);
    c.getContext('2d').drawImage(canvas, x, y, c.width, c.height, 0, 0, c.width, c.height);
    out.push(await toBlob(c));
  }
  return out;
}
