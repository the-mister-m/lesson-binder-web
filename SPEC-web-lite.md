# Teacher Materials Packager — Web Lite Spec (as built)
2026-10-06 · Brandon with O · (O) = O's call, awaiting ruling

## Purpose
- Test packages in the browser. Not a replacement for the desktop app.
- Everything runs client-side. Files never leave the machine.
- Single-package mode only. No library.

## Run
- `cd ~/Desktop/"Web Lite Mockups"/app && python3 -m http.server 8765`
- Open http://localhost:8765 in Chrome. Cmd+Shift+R after code changes.
- Needs a local server: ES modules, workers, and SHA-256 fail on file://.

## Layout
```
Web Lite Mockups/
  *.svg                  Brandon's mockups (source of the UI)
  Colonie-*.png, SC_*.jpg  official logos (unaltered)
  SPEC-web-lite.md       this file
  app/
    index.html, app.css
    assets/              logos copied unaltered
    vendor/              pdf.js 4.10.38, JSZip 3.10.1, mammoth 1.8.0,
                         SheetJS 0.20.3, tesseract.js 5.1.1, transformers.js 3.8.1
    js/main.js           tab routing
    js/state.js          state, stable IDs, IndexedDB (meta + blobs)
    js/ingest.js         intake (files/folders/zip), hash, queue, ctx
    js/deconstruct/      pptx, pdf, tile, docx, xlsx, media, kept
    js/whisper.js        worker handle, model progress, 16 kHz decode
    js/whisper-worker.js whisper-small via transformers.js
    js/ocr.js            tesseract, opt-in
    js/render-index.js   INDEX.md, nodes/taxonomies jsonl, INSTRUCTIONS stub
    js/export.js         stats vs limits, zip download
    js/roundtrip.js      edge validator, versions, rollback
    js/ui/               dom, start, files, taxonomies, nodes, edges, export
  test/
    make_fixtures.py     minimal pptx/pdf/docx/xlsx/.ai fixtures
    walk.py              headless walk; --whisper for audio
    folder_drop.py       simulated folder drop
    fixtures/            generated files + lesson.m4a (say + afconvert)
```

## Brand
- Palette: #6B1D3A maroon, #FBAE2D gold (mockup values; logo values look identical)
- Header: side-facing wolf PNG on maroon. Start tab: shield + wordmark JPG. Favicon: forward wolf.
- UI copy: labels only. Sentences only where required (storage warning, platform-limits warning).

## Tabs
- Start: wordmark, per-file size caps (MB), storage warning, Begin, New package
- Files: Drop files or folders (any browser, recursive), Pick folder (Chromium), Upload zip;
  OCR toggle, Transcribe toggle, model download meter; table FILE · ID · TYPE · STATUS · ×
- Taxonomies: list, name, description, label chips (+ to add, × to remove)
- Nodes: per file — labels per taxonomy, description, how it WAS used, contents (markdown, original, part thumbnails)
- Edges: drop file / paste box → check results (lines read, unknown refs, unreadable lines) → versions with roll back
- Export: target platform, editable limits vs package stats, pending count, warning, Download package (.zip)

## Deconstruction
- .pptx → markdown per slide: title, bullets by level, tables, [chart]/[diagram] markers,
  alt text on images, speaker notes, hidden-slide flag; media copied out (F-001.m1…)
- .pdf → text per page + PNG per page at 150 DPI (long edge ≤ 4000);
  pages over 2000px long edge tiled 2×2 (O); embedded images skipped (O);
  OCR on textless pages if toggled
- .docx → mammoth markdown; images copied out (.m1…)
- .xlsx → one CSV per sheet (.s1…)
- Audio → kept + transcript (whisper-small) if toggled
- Video → kept + stills every 30s, max 20 (.k1…) + transcript of audio track
- Images → kept; OCR if toggled
- Anything else → copied unchanged ("kept as-is"), still gets a node
- Zips unpack whether dropped or uploaded (O). Hidden files and __MACOSX skipped.
- Markdown written before images; images referenced by ID.

## IDs
- Stable, assigned at queue time, never reused: F-001; parts F-001.p3, F-001.p3.t2, .m1, .s1, .k1
- SHA-256 is a node field. Same hash already in package → row flagged "Duplicate of F-00X".
- Not done (queued/working/error) → pending: not in INDEX.md, not exported.
- Desktop adoption of stable IDs: DRAFT.

## Package (zip)
```
INDEX.md
INSTRUCTIONS.md            stub (DRAFT) — gap rounds, two headers, edge format
files/F-001/F-001.md       + parts, + original if kept
.package/nodes.jsonl
.package/taxonomies.jsonl
.package/edges/v001.jsonl  every version
.package/manifest.json     current_edges pointer
```
- Node line: id, hash, kind, source_name, source, labels {taxonomy: [labels]}, description, used, markdown, file, children[{id, kind, path}], meta
- Edge line: {"from": "F-001", "to": "F-002.p3", "note": "…"}; LLM names its own kinds

## Round trip
- Code fences skipped; line numbers match the input
- Accepts IDs or full hashes (hash → ID)
- Unknown IDs and unreadable lines listed by line, never dropped silently
- Version created only if at least one edge lands; roll back moves the current pointer

## Whisper
- onnx-community/whisper-small; WebGPU: encoder fp32 + decoder q4; else WASM q8 (~250 MB)
- Downloads on first use; cached by the browser after
- No language set → defaults to English

## Defaults (O, editable)
- Caps MB: PDF 100, PPTX 200, DOCX 50, XLSX 25, Audio 200, Video 500, Other 200
- Limits: Claude 20 files/30 MB/200 MB; ChatGPT 10/25/200; NotebookLM 50/200/1000; Custom 20/25/200
  — placeholders, not verified platform numbers

## Verified (headless, 2026-10-06)
- pptx, pdf (+ tiles on poster page only), docx, xlsx, pass-through, duplicate flag
- taxonomy + labels, edges (good / unknown / unreadable), versions, zip contents
- whisper-small transcript word-perfect on a spoken clip (WASM path)
- simulated folder drop: recursive, .DS_Store skipped, source path kept

## Not verified
- Video (no fixture tool), OCR, WebGPU path, model meter percentages
- Real teacher files; real folder drag; hidden .package/ surviving harness upload

## Open
- Label chips on Nodes: every label shows on every node (outline = available, fill = applied);
  reads as applied. Brandon to pick: A) applied only + picker, B) faded unapplied chips
- Tiling threshold, size caps, limit defaults, zip-on-drop behavior
- Map HTML data slot (not built)

## Headed test checklist
1. Start: wordmark shows, caps editable, New package clears everything
2. Drop a real folder with subfolders → every file Done; hover shows source path
3. Real .pptx: Nodes → Markdown matches the slides; notes and alt text present
4. Real .pdf: page images correct; big pages tiled; scanned page + OCR on → text
5. Audio and a short video: meter shows download, transcript appears, stills look right
6. Same file twice → duplicate row; × removes it
7. Taxonomies → labels → Nodes: applied labels stick per node after reload
8. Edges: paste with fences, one bad ID, one bad line → listed; roll back works
9. Export: limits turn red when over; zip opens; INDEX.md reads right
10. Upload the zip's contents to Claude / ChatGPT: does .package/ survive?
