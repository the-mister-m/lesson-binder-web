// xlsx: one csv per sheet
export async function runXlsx(file, rec, ctx, buf) {
  ctx.status('Reading workbook');
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const sheets = wb.SheetNames.map((name, i) => {
    const ws = wb.Sheets[name];
    const ref = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
    return {
      id: `${rec.id}.s${i + 1}`, name,
      rows: ref ? ref.e.r - ref.s.r + 1 : 0,
      cols: ref ? ref.e.c - ref.s.c + 1 : 0,
      csv: XLSX.utils.sheet_to_csv(ws),
    };
  });
  rec.meta.sheets = sheets.length;

  const md = [`# ${rec.id} · ${rec.name}`, ''];
  for (const s of sheets) md.push(`## Sheet · ${s.name}`, '', `${s.id}.csv · ${s.rows} rows × ${s.cols} columns`, '');
  await ctx.md(md.join('\n'));
  for (const s of sheets) await ctx.put(s.id, 'csv', new Blob([s.csv], { type: 'text/csv' }), 'sheet');
}
