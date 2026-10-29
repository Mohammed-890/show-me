// Evaluate Show Me on real GOV.UK / NHS / UKVI screenshots.
//
// For every labelled screenshot:
//   1. run the same OCR the website uses (tesseract.js, English model)
//   2. run the Show Me engine for the task, and the naive baseline
//   3. a prediction is correct if the centre of the box it points at lands
//      inside the real button (taken from the page itself when captured), or,
//      for "scroll" cases, if it says to scroll.
//
// Usage: node eval/run-eval.mjs [--set original|augmented|all]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';
import { createWorker } from 'tesseract.js';
import { guide, baseline } from '../docs/js/engine.js';
import { readScreen } from '../docs/js/ocr.js';
import { TASKS } from '../docs/js/tasks.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const arg = process.argv.indexOf('--set');
const which = arg > 0 ? process.argv[arg + 1] : 'all';

function readLabels(file, dir) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => ({ ...JSON.parse(l), dir }));
}
let cases = [];
if (which === 'original' || which === 'all') cases.push(...readLabels(path.join(here, 'labels.jsonl'), 'screens').map((c) => ({ ...c, set: 'original' })));
if (which === 'augmented' || which === 'all') cases.push(...readLabels(path.join(here, 'labels-augmented.jsonl'), 'screens-augmented').map((c) => ({ ...c, set: 'augmented' })));

const cacheDir = path.join(here, 'ocr-cache');
fs.mkdirSync(cacheDir, { recursive: true });
const worker = await createWorker('eng', 1, {
  langPath: path.join(root, 'docs', 'vendor', 'lang'),
  gzip: false,
  cachePath: path.join(root, '.tess-cache'),
});

// Exactly the same OCR pipeline as the website (docs/js/ocr.js).
function toJpeg(im) {
  return jpeg.encode({ width: im.width, height: im.height, data: Buffer.from(im.data.buffer) }, 95).data;
}
let currentPsm = '3';
async function recognize(input, { psm }) {
  if (psm !== currentPsm) { await worker.setParameters({ tessedit_pageseg_mode: psm }); currentPsm = psm; }
  return (await worker.recognize(input)).data;
}
async function ocr(file, img) {
  const key = path.join(cacheDir, path.basename(path.dirname(file)) + '__' + path.basename(file) + '.json');
  if (fs.existsSync(key)) return JSON.parse(fs.readFileSync(key, 'utf8'));
  const words = await readScreen(img, recognize, toJpeg);
  fs.writeFileSync(key, JSON.stringify(words));
  return words;
}

const inside = (b, t, pad = 6) => {
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  return cx >= t.x - pad && cx <= t.x + t.w + pad && cy >= t.y - pad && cy <= t.y + t.h + pad;
};
function judge(pred, c) {
  if (c.expect === 'scroll_down') return pred.status === 'scroll';
  return pred.status === 'ok' && pred.box && inside(pred.box, c.target);
}

const rows = [];
for (const c of cases) {
  const file = path.join(here, c.dir, c.file);
  const img = jpeg.decode(fs.readFileSync(file), { useTArray: true });
  const words = await ocr(file, img);
  const task = TASKS.find((t) => t.id === c.task);
  const t0 = performance.now();
  const sm = guide(task, words, img);
  const ms = performance.now() - t0;
  const noState = guide(task, words, img, { useState: false });
  const base = baseline(words);
  rows.push({
    set: c.set, file: c.file, task: c.task, step: c.step,
    showMe: judge(sm, c), showMeStep: sm.stepId, showMeStatus: sm.status,
    noState: judge(noState, c),
    baseline: judge(base, c),
    engineMs: +ms.toFixed(1),
  });
}
await worker.terminate();

function summary(rs) {
  const n = rs.length;
  const pct = (k) => (n ? Math.round((100 * rs.filter((r) => r[k]).length) / n) : 0);
  const count = (k) => rs.filter((r) => r[k]).length;
  return { n, showMe: `${count('showMe')}/${n} (${pct('showMe')}%)`, noState: `${count('noState')}/${n} (${pct('noState')}%)`, baseline: `${count('baseline')}/${n} (${pct('baseline')}%)` };
}

const sets = [...new Set(rows.map((r) => r.set))];
const out = { generatedAt: new Date().toISOString(), overall: summary(rows), bySet: {}, byTask: {}, failures: [], rows };
for (const s of sets) out.bySet[s] = summary(rows.filter((r) => r.set === s));
for (const t of TASKS) out.byTask[t.id] = summary(rows.filter((r) => r.task === t.id));
out.failures = rows.filter((r) => !r.showMe).map((r) => `${r.set}/${r.file}: expected ${r.step}, got ${r.showMeStatus} ${r.showMeStep}`);
const ms = rows.map((r) => r.engineMs).sort((a, b) => a - b);
out.engineLatencyMs = { median: ms[Math.floor(ms.length / 2)], p95: ms[Math.floor(ms.length * 0.95)] };

fs.mkdirSync(path.join(here, 'results'), { recursive: true });
fs.writeFileSync(path.join(here, 'results', 'latest.json'), JSON.stringify(out, null, 2));

console.log('Overall      ', out.overall);
for (const s of sets) console.log('Set', s.padEnd(10), out.bySet[s]);
for (const t of TASKS) console.log('Task', t.id.padEnd(12), out.byTask[t.id]);
console.log('Engine latency ms', out.engineLatencyMs);
if (out.failures.length) console.log('Show Me failures:\n  ' + out.failures.join('\n  '));
for (const r of rows.filter((r) => r.set === 'original')) console.log(`${r.showMe ? 'PASS' : 'FAIL'} ${r.file.padEnd(28)} step=${r.step.padEnd(16)} got=${r.showMeStatus}/${r.showMeStep}  baseline=${r.baseline ? 'pass' : 'fail'}`);
