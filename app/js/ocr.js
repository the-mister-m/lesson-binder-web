// ocr: tesseract.js, one worker, opt-in
let worker = null;

export async function ocr(image) {
  if (!worker) worker = await Tesseract.createWorker('eng');
  const { data } = await worker.recognize(image);
  return (data.text || '').trim();
}
