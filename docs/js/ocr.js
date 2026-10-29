// Read a screenshot into OCR words. Shared by the website and the evaluation
// so both run exactly the same pipeline.
//
//   img        { width, height, data } RGBA pixels of the screenshot
//   recognize  async (input, { psm }) => tesseract.js result `data`
//   toInput    (rgbaImage) => something tesseract.js accepts (canvas, buffer…)
//
// Pass 1 reads the whole screen. Pass 2 finds solid-colour buttons and banners,
// cleans each into dark-on-white and reads it as one block (plain OCR often
// misses white text on green buttons).

import { colourRegions, cropForOcr, mergeWords } from './engine.js';

const asWords = (data, dx = 0, dy = 0) =>
  data.words.map((w) => ({
    text: w.text,
    conf: w.confidence,
    x0: w.bbox.x0 + dx, y0: w.bbox.y0 + dy, x1: w.bbox.x1 + dx, y1: w.bbox.y1 + dy,
  }));

export async function readScreen(img, recognize, toInput) {
  const full = asWords(await recognize(toInput(img), { psm: '3' }));
  const crops = [];
  for (const r of colourRegions(img)) {
    const c = cropForOcr(img, r);
    crops.push(...asWords(await recognize(toInput(c.img), { psm: '6' }), c.offsetX, c.offsetY));
  }
  return mergeWords(crops, full);
}

// Phone screenshots come in many sizes. The engine works best around 750px
// wide (a 375pt phone at 2x), so larger images are scaled down first.
export const TARGET_WIDTH = 750;
