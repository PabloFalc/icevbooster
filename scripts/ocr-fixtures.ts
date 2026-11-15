// OCRs the portal screenshots in examples/ (Node, tesseract.js 'por') and writes word boxes
// to tests/fixtures/*.json. Mirrors the browser runOcr: bilinear upscale, then normalizeContrast,
// with the same per-print options (HORARIO_OCR for the horário).
// Run: npx tsx scripts/ocr-fixtures.ts [name ...]   (no names → every fixture)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { createWorker, PSM } from 'tesseract.js';
import { flattenBlocks, normalizeContrast, HORARIO_OCR, type OcrOptions } from '../src/ocr/ocr';

const FIXTURES: Record<string, string> = {
  'Screenshot 2026-11-14 151505.png': 'faltas',
  'Screenshot 2026-11-14 153848.png': 'historico',
  'Screenshot 2026-11-14 151516.png': 'notas',
  'Screenshot 2026-11-14 153714.png': 'horario',
};
const OPTIONS: Record<string, OcrOptions> = { horario: HORARIO_OCR };
const only = process.argv.slice(2);

function upscale(src: PNG, scale: number): PNG {
  const out = new PNG({ width: src.width * scale, height: src.height * scale });
  for (let y = 0; y < out.height; y++) {
    const sy = Math.min(Math.max((y + 0.5) / scale - 0.5, 0), src.height - 1);
    const y0 = Math.floor(sy), y1 = Math.min(y0 + 1, src.height - 1), fy = sy - y0;
    for (let x = 0; x < out.width; x++) {
      const sx = Math.min(Math.max((x + 0.5) / scale - 0.5, 0), src.width - 1);
      const x0 = Math.floor(sx), x1 = Math.min(x0 + 1, src.width - 1), fx = sx - x0;
      for (let c = 0; c < 4; c++) {
        const p = (xx: number, yy: number) => src.data[(yy * src.width + xx) * 4 + c];
        const top = p(x0, y0) * (1 - fx) + p(x1, y0) * fx;
        const bottom = p(x0, y1) * (1 - fx) + p(x1, y1) * fx;
        out.data[(y * out.width + x) * 4 + c] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
  }
  return out;
}

mkdirSync('tests/fixtures', { recursive: true });
const worker = await createWorker('por');
try {
  for (const [file, name] of Object.entries(FIXTURES)) {
    if (only.length && !only.includes(name)) continue;
    const { upscale: scale = 2, sparse = false } = OPTIONS[name] ?? {};
    const img = upscale(PNG.sync.read(readFileSync(`examples/${file}`)), scale);
    normalizeContrast(img.data, img.width, img.height);
    await worker.setParameters({ tessedit_pageseg_mode: sparse ? PSM.SPARSE_TEXT : PSM.AUTO });
    const { data } = await worker.recognize(PNG.sync.write(img), {}, { blocks: true });
    const words = flattenBlocks(data.blocks, scale).map((w) => ({
      ...w,
      x0: Math.round(w.x0), y0: Math.round(w.y0), x1: Math.round(w.x1), y1: Math.round(w.y1),
    }));
    writeFileSync(`tests/fixtures/${name}.json`, JSON.stringify(words, null, 1) + '\n');
    console.log(`${name}: ${words.length} words`);
  }
} finally {
  await worker.terminate();
}
