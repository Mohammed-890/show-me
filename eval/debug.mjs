// Print what the engine sees for one screenshot: node eval/debug.mjs <dir/file> <task>
import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { buildLines, guide, findPhrase, locate } from '../docs/js/engine.js';
import { TASKS } from '../docs/js/tasks.js';

const [rel, taskId] = process.argv.slice(2);
const file = path.resolve('eval', rel);
const cache = path.resolve('eval/ocr-cache', path.basename(path.dirname(file)) + '__' + path.basename(file) + '.json');
const words = JSON.parse(fs.readFileSync(cache, 'utf8'));
const img = jpeg.decode(fs.readFileSync(file), { useTArray: true });
const lines = buildLines(words);
for (const l of lines) console.log(`[${l.x0},${l.y0},${l.x1},${l.y1}] ${l.toks.join(' ')}`);
const task = TASKS.find((t) => t.id === taskId);
for (const s of task.steps) {
  const sig = s.signature.map((g) => g.map((p) => !!findPhrase(lines, p, { minScore: 0.85 })).some(Boolean));
  console.log('step', s.id, 'sig', sig.join(','), 'locate', JSON.stringify(locate(s, lines, img)));
}
console.log('guide', JSON.stringify(guide(task, words, img), (k, v) => (k === 'step' ? undefined : v)));
