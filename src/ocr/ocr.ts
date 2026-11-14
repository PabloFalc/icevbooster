import { createWorker, PSM, type Block } from 'tesseract.js';
import type { OcrWord } from '../domain/types';

/** Flattens tesseract blocks into words, dividing coordinates by `scale` so they refer to the original image. */
export function flattenBlocks(blocks: Block[] | null, scale = 1): OcrWord[] {
  const words: OcrWord[] = [];
  for (const block of blocks ?? [])
    for (const para of block.paragraphs)
      for (const line of para.lines)
        for (const w of line.words) {
          const text = w.text.trim();
          if (!text) continue;
          const { x0, y0, x1, y1 } = w.bbox;
          words.push({ text, x0: x0 / scale, y0: y0 / scale, x1: x1 / scale, y1: y1 / scale });
        }
  return words;
}

/**
 * In place: converts RGBA pixels to grayscale, inverts every pixel row whose median luminance
 * is dark (white header text on the portal's gray bar becomes dark-on-light), then stretches
 * each row so its median (the background) is pure white. Tesseract binarizes globally, so a
 * mid-gray background would otherwise swallow the header text.
 */
export function normalizeContrast(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): void {
  const row = new Uint8Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      row[x] = Math.round(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]);
    }
    let median = Uint8Array.from(row).sort()[width >> 1];
    const invert = median < 128;
    if (invert) median = 255 - median;
    const gain = 255 / Math.max(median, 1);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = invert ? 255 - row[x] : row[x];
      rgba[i] = rgba[i + 1] = rgba[i + 2] = Math.min(255, Math.round(v * gain));
      rgba[i + 3] = 255;
    }
  }
}

async function prepareCanvas(file: Blob, scale: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  normalizeContrast(img.data, canvas.width, canvas.height);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export interface OcrOptions {
  /** Canvas upscale factor (default 2). */
  upscale?: number;
  /** Sparse-text page segmentation: finds scattered text such as grid cells (used for the horário print). */
  sparse?: boolean;
}

/** OCR settings for the horário print: its small serif cell text reads best at 3× with sparse segmentation. */
export const HORARIO_OCR: OcrOptions = { upscale: 3, sparse: true };

/** Browser OCR: upscales the image on a canvas and returns word boxes in original-image pixels. */
export async function runOcr(file: Blob, opts: OcrOptions = {}): Promise<OcrWord[]> {
  const scale = opts.upscale ?? 2;
  const canvas = await prepareCanvas(file, scale);
  const worker = await createWorker('por');
  try {
    if (opts.sparse) await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const { data } = await worker.recognize(canvas, {}, { blocks: true });
    return flattenBlocks(data.blocks, scale);
  } finally {
    await worker.terminate();
  }
}
