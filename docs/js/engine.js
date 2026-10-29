// Show Me engine.
//
// Input:  OCR words from a screenshot + the raw pixels + the task the person
//         chose.
// Output: which step they are on and the exact box to point at, or "scroll
//         down", or "I don't recognise this screen".
//
// Design rule: the engine can only point at things that a verified step guide
// (tasks.js) names. OCR finds where text is; pixels find the real edges of the
// button or box; the step guide decides what is correct. Nothing is generated.
//
// Pure functions, no DOM. The same file runs in the browser and in Node (eval).

// ---------------------------------------------------------------- text utils

export function normalize(s) {
  return s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s) {
  const n = normalize(s);
  return n ? n.split(' ') : [];
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

// 1 = identical, 0 = nothing alike. Short words must match exactly-ish.
export function tokenSim(a, b) {
  if (a === b) return 1;
  const len = Math.max(a.length, b.length);
  if (len <= 3) return 0;
  return 1 - levenshtein(a, b) / len;
}

// ------------------------------------------------------------------ OCR lines

// words: [{ text, conf, x0, y0, x1, y1 }] in image pixels.
export function buildLines(words) {
  const ws = words
    .filter((w) => w.text && w.text.trim() && (w.conf ?? 100) >= 30)
    .map((w) => ({ ...w, tok: tokens(w.text), cy: (w.y0 + w.y1) / 2, h: w.y1 - w.y0 }))
    .filter((w) => w.tok.length && w.h > 4)
    .sort((a, b) => a.cy - b.cy || a.x0 - b.x0);

  const rows = [];
  for (const w of ws) {
    const row = rows.find((r) => Math.abs(r.cy - w.cy) < Math.max(r.h, w.h) * 0.5);
    if (row) {
      row.words.push(w);
      row.cy = (row.cy * (row.words.length - 1) + w.cy) / row.words.length;
      row.h = Math.max(row.h, w.h);
    } else {
      rows.push({ words: [w], cy: w.cy, h: w.h });
    }
  }

  // Split a row where there is a big horizontal gap (two separate things side
  // by side), then turn each piece into a line.
  const lines = [];
  for (const row of rows) {
    row.words.sort((a, b) => a.x0 - b.x0);
    let piece = [row.words[0]];
    for (let i = 1; i < row.words.length; i++) {
      const gap = row.words[i].x0 - row.words[i - 1].x1;
      if (gap > row.h * 2.2) {
        lines.push(makeLine(piece));
        piece = [];
      }
      piece.push(row.words[i]);
    }
    lines.push(makeLine(piece));
  }
  return lines.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
}

function makeLine(words) {
  // Drop junk at the start of a line: radio circles and bullets read as "c",
  // "o", "e", "|" and so on.
  while (words.length > 1 && /^[^a-z0-9]*[a-z0-9]?[^a-z0-9]*$/i.test(words[0].text) && !/^[ai]$/i.test(words[0].text.trim())) {
    words = words.slice(1);
  }
  const x0 = Math.min(...words.map((w) => w.x0));
  const y0 = Math.min(...words.map((w) => w.y0));
  const x1 = Math.max(...words.map((w) => w.x1));
  const y1 = Math.max(...words.map((w) => w.y1));
  const toks = [];
  const tokWord = [];
  for (const w of words) for (const t of w.tok) { toks.push(t); tokWord.push(w); }
  return { words, toks, tokWord, x0, y0, x1, y1, h: y1 - y0, text: words.map((w) => w.text).join(' ') };
}

// Lines that belong together (a button label that wraps onto two lines).
function lineGroups(lines, maxLines = 3) {
  const groups = [];
  for (let i = 0; i < lines.length; i++) {
    const g = [lines[i]];
    groups.push(g.slice());
    for (let j = i + 1; j < lines.length && g.length < maxLines; j++) {
      const last = g[g.length - 1];
      const next = lines[j];
      const vGap = next.y0 - last.y1;
      const overlap = Math.min(last.x1, next.x1) - Math.max(last.x0, next.x0);
      if (vGap < -last.h * 0.3) continue; // same row, different piece
      if (vGap > last.h * 0.9 || overlap < Math.min(last.x1 - last.x0, next.x1 - next.x0) * 0.2) break;
      g.push(next);
      groups.push(g.slice());
    }
  }
  return groups;
}

// Approximate substring search (Sellers): the best place in `text` where
// `pat` appears with the fewest typos. Works on letters with spaces removed,
// so OCR that joins or splits words ("nationalidentity") still matches.
function fuzzySubstring(pat, text) {
  const m = pat.length, n = text.length;
  let prev = new Array(n + 1).fill(0);
  let prevStart = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = new Array(n + 1);
    const curStart = new Array(n + 1);
    cur[0] = i; curStart[0] = 0;
    for (let j = 1; j <= n; j++) {
      const sub = prev[j - 1] + (pat[i - 1] === text[j - 1] ? 0 : 1);
      const del = prev[j] + 1;
      const ins = cur[j - 1] + 1;
      if (sub <= del && sub <= ins) { cur[j] = sub; curStart[j] = prevStart[j - 1]; }
      else if (del <= ins) { cur[j] = del; curStart[j] = prevStart[j]; }
      else { cur[j] = ins; curStart[j] = curStart[j - 1]; }
    }
    prev = cur; prevStart = curStart;
  }
  let bestJ = 0;
  for (let j = 1; j <= n; j++) if (prev[j] < prev[bestJ]) bestJ = j;
  return { dist: prev[bestJ], start: prevStart[bestJ], end: bestJ };
}

// Find `phrase` in the OCR. Returns the best match or null.
//   coverage: how much of the matched line(s) must be the phrase. Buttons use a
//   high value so "Search" does not match the heading "Search for a property".
export function findPhrase(lines, phrase, { coverage = 0, minScore = 0.8 } = {}) {
  const want = tokens(phrase).join('');
  if (!want) return null;
  const nTok = tokens(phrase).length;
  if (want.length >= 18) minScore = Math.min(minScore, 0.75);
  let best = null;
  for (const group of lineGroups(lines, nTok > 3 ? 3 : 2)) {
    // Letters of the group with a map back to the word each letter came from.
    let text = '';
    const owner = [];
    for (const l of group) for (const w of l.words) for (const t of w.tok) {
      for (const ch of t) { text += ch; owner.push(w); }
    }
    if (text.length < want.length * 0.6) continue;
    const { dist: d, start, end } = fuzzySubstring(want, text);
    const score = 1 - d / want.length;
    if (score < minScore) continue;
    const cov = want.length / text.length;
    if (cov < coverage) continue;
    const ws = [...new Set(owner.slice(start, Math.max(start + 1, end)))];
    {
      const box = {
        x0: Math.min(...ws.map((w) => w.x0)),
        y0: Math.min(...ws.map((w) => w.y0)),
        x1: Math.max(...ws.map((w) => w.x1)),
        y1: Math.max(...ws.map((w) => w.y1)),
      };
      const cand = { score, cov, box, lines: group };
      if (
        !best ||
        cand.score > best.score + 0.01 ||
        (Math.abs(cand.score - best.score) <= 0.01 && cand.cov > best.cov + 0.01) ||
        (Math.abs(cand.score - best.score) <= 0.01 && Math.abs(cand.cov - best.cov) <= 0.01 && box.y0 < best.box.y0)
      ) best = cand;
    }
  }
  return best;
}

// All separate matches of a phrase (e.g. every "Register online with this GP").
export function findAll(lines, phrase, opts) {
  const out = [];
  let remaining = lines.slice();
  for (let i = 0; i < 20; i++) {
    const m = findPhrase(remaining, phrase, opts);
    if (!m) break;
    out.push(m);
    const used = new Set(m.lines);
    remaining = remaining.filter((l) => !used.has(l));
  }
  return out.sort((a, b) => a.box.y0 - b.box.y0);
}

// ------------------------------------------------------- OCR pre-processing

// Plain OCR often misses text on coloured buttons (white on green, black on
// orange). So we also find the solid-coloured areas of the screen (buttons,
// banners), crop each one, turn it into dark text on a white background and
// OCR the crops separately. The word lists are then merged.

// Find solid-colour rectangles at least `minW` of the screen wide.
export function colourRegions(img, { minW = 0.18 } = {}) {
  const { width: W, height: H } = img;
  const rows = [];
  for (let y = 0; y < H; y += 2) {
    const counts = new Map();
    for (let x = 0; x < W; x += 2) {
      const c = px(img, x, y);
      if (lum(c) > 232 && Math.max(...c) - Math.min(...c) < 18) continue; // page white / light grey
      const key = (c[0] >> 5) * 64 + (c[1] >> 5) * 8 + (c[2] >> 5);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    let bestKey = -1, best = 0;
    for (const [k, n] of counts) if (n > best) { best = n; bestKey = k; }
    if (best * 2 < W * minW) { rows.push(null); continue; }
    let x0 = W, x1 = 0;
    for (let x = 0; x < W; x += 2) {
      const c = px(img, x, y);
      if ((c[0] >> 5) * 64 + (c[1] >> 5) * 8 + (c[2] >> 5) === bestKey) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    }
    const fill = (best * 2) / Math.max(1, x1 - x0);
    rows.push(fill > 0.5 ? { y, x0, x1, key: bestKey } : null);
  }
  // Join rows of the same colour and similar width into rectangles (allowing
  // short gaps where a line of text crosses the button).
  const regions = [];
  let cur = null, gap = 0;
  for (const r of rows) {
    if (r && cur && r.key === cur.key && Math.abs(r.x0 - cur.x0) < 24 && Math.abs(r.x1 - cur.x1) < 24) {
      cur.y1 = r.y; gap = 0;
      continue;
    }
    if (!r && cur && gap < 10) { gap++; continue; }
    if (cur) regions.push(cur);
    cur = r ? { x0: r.x0, x1: r.x1, y0: r.y, y1: r.y, key: r.key } : null;
    gap = 0;
  }
  if (cur) regions.push(cur);
  return regions.filter((r) => r.y1 - r.y0 >= 24 && r.y1 - r.y0 <= 420);
}

// Crop a region and make it dark text on white, stretched to full contrast.
export function cropForOcr(img, r, inset = 5) {
  // Crop just inside the button so its border and shadow are not read as text.
  const x0 = Math.max(0, r.x0 + inset), y0 = Math.max(0, r.y0 + inset);
  const x1 = Math.min(img.width - 1, r.x1 - inset), y1 = Math.min(img.height - 1, r.y1 - inset);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const L = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) L[y * w + x] = lum(px(img, x0 + x, y0 + y));
  // Background = the most common brightness; text = whatever is far from it.
  const hist = new Uint32Array(256);
  for (const v of L) hist[Math.round(v)]++;
  let bg = 0;
  for (let i = 1; i < 256; i++) if (hist[i] > hist[bg]) bg = i;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < L.length; i++) {
    const d = Math.abs(L[i] - bg); // distance from background
    const v = d > 60 ? 0 : d < 20 ? 255 : Math.round(255 - ((d - 20) / 40) * 255);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { img: { width: w, height: h, data }, offsetX: x0, offsetY: y0 };
}

// Merge word lists from several OCR passes, dropping duplicates.
export function mergeWords(...passes) {
  const out = [];
  const iou = (a, b) => {
    const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
    const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    const inter = ix * iy;
    const ua = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - inter;
    return ua > 0 ? inter / ua : 0;
  };
  for (const words of passes) {
    for (const w of words) {
      if (!w.text || !w.text.trim()) continue;
      const clash = out.findIndex((o) => iou(o, w) > 0.3);
      if (clash < 0) out.push(w);
      else if ((w.conf ?? 0) > (out[clash].conf ?? 0) + 10) out[clash] = w;
    }
  }
  return out;
}

// ---------------------------------------------------------------- pixel utils

// img: { width, height, data } with RGBA bytes (canvas ImageData or jpeg-js).
function px(img, x, y) {
  x = Math.max(0, Math.min(img.width - 1, Math.round(x)));
  y = Math.max(0, Math.min(img.height - 1, Math.round(y)));
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}
const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

// Grow from the text to the real edges of the button it sits on. If the text
// sits on the page background (a plain link), keep a padded text box.
export function buttonBox(img, box) {
  const h = box.y1 - box.y0;
  const cy = (box.y0 + box.y1) / 2;
  const left = px(img, box.x0 - Math.max(6, h * 0.35), cy);
  const right = px(img, box.x1 + Math.max(6, h * 0.35), cy);
  const pad = Math.round(h * 0.45);
  const padded = { x0: box.x0 - pad, y0: box.y0 - pad, x1: box.x1 + pad, y1: box.y1 + pad };
  const isFilled = dist(left, right) < 45 && lum(left) < 225;
  if (!img || !isFilled) return clamp(img, padded);

  const bg = left;
  const same = (x, y) => dist(px(img, x, y), bg) < 60;
  let x0 = box.x0, x1 = box.x1, y0 = box.y0, y1 = box.y1;
  const step = 2;
  // Grow sideways, hopping over small icons inside the button (e.g. the
  // chevron on GOV.UK "Start now").
  const saturated = Math.max(...bg) - Math.min(...bg) > 40; // a coloured button, not a grey page
  const hop = saturated ? Math.round(h * 1.3) : 0;
  const grow = (x, dir) => {
    for (;;) {
      let k = step;
      while (k <= Math.max(step, hop) && !same(x + dir * k, cy)) k += step;
      const nx = x + dir * k;
      if (k > Math.max(step, hop) || nx <= 0 || nx >= img.width - 1) return x;
      x = nx;
    }
  };
  x0 = grow(x0, -1);
  x1 = grow(x1, 1);
  const cx = (box.x0 + box.x1) / 2;
  const probeX = [x0 + (box.x0 - x0) / 2, x1 - (x1 - box.x1) / 2];
  while (y0 > 0 && probeX.every((x) => same(x, y0 - step))) y0 -= step;
  while (y1 < img.height - 1 && probeX.every((x) => same(x, y1 + step))) y1 += step;
  // Sanity: a button is not more than ~5 text heights tall.
  if (y1 - y0 > h * 5 || x1 - x0 < box.x1 - box.x0) return clamp(img, padded);
  void cx;
  return clamp(img, { x0, y0, x1, y1 });
}

// The text box directly under a label: find its dark border.
export function inputBox(img, label) {
  const h = label.y1 - label.y0;
  const x = label.x0 + h * 0.8;
  let top = -1;
  for (let y = Math.round(label.y1 + 2); y < label.y1 + h * 5 && y < img.height; y++) {
    if (lum(px(img, x, y)) < 120) { top = y; break; }
  }
  if (top < 0) return null;
  // Walk along the top border to find the left and right edges.
  let x0 = Math.round(x), x1 = Math.round(x);
  const dark = (xx, yy) => lum(px(img, xx, yy)) < 140;
  const onBorder = (xx) => dark(xx, top) || dark(xx, top + 1) || dark(xx, top + 2);
  while (x0 > 0 && onBorder(x0 - 1)) x0--;
  while (x1 < img.width - 1 && onBorder(x1 + 1)) x1++;
  // Find the bottom border: next dark row after a light gap, inside the box.
  const mid = Math.round((x0 + x1) / 2);
  let y = top;
  while (y < img.height - 1 && dark(mid, y)) y++;
  let bottom = -1;
  for (; y < top + h * 6 && y < img.height; y++) {
    if (dark(x0 + 4, y) && dark(mid, y)) { bottom = y; break; }
  }
  if (bottom < 0 || x1 - x0 < h * 2) return null;
  while (bottom < img.height - 1 && dark(mid, bottom + 1)) bottom++;
  return { x0, y0: top, x1, y1: bottom };
}

// Is there typed text inside a box?
export function boxHasText(lines, box) {
  const inner = shrink(box, 6);
  return lines.some((l) => l.words.some((w) => {
    const cx = (w.x0 + w.x1) / 2, cy = (w.y0 + w.y1) / 2;
    return cx > inner.x0 && cx < inner.x1 && cy > inner.y0 && cy < inner.y1 && (w.conf ?? 100) > 40;
  }));
}

// Is the radio circle to the left of this option filled in?
export function radioSelected(img, line) {
  const h = line.y1 - line.y0;
  const cy = (line.y0 + line.y1) / 2;
  const sx0 = Math.max(0, line.x0 - h * 4.5), sx1 = line.x0 - h * 0.3;
  const sy0 = cy - h * 1.6, sy1 = cy + h * 1.6;
  let rx0 = Infinity, rx1 = -Infinity, ry0 = Infinity, ry1 = -Infinity, n = 0;
  for (let y = sy0; y < sy1; y += 2) {
    for (let x = sx0; x < sx1; x += 2) {
      if (lum(px(img, x, y)) < 90) {
        n++;
        rx0 = Math.min(rx0, x); rx1 = Math.max(rx1, x);
        ry0 = Math.min(ry0, y); ry1 = Math.max(ry1, y);
      }
    }
  }
  if (n < 8 || rx1 - rx0 < h * 0.8) return null; // no radio found
  const ccx = (rx0 + rx1) / 2, ccy = (ry0 + ry1) / 2;
  const r = Math.min(rx1 - rx0, ry1 - ry0) * 0.12;
  let darkN = 0, total = 0;
  for (let y = ccy - r; y <= ccy + r; y += 1) {
    for (let x = ccx - r; x <= ccx + r; x += 1) {
      total++;
      if (lum(px(img, x, y)) < 90) darkN++;
    }
  }
  return darkN / total > 0.5;
}

function shrink(b, d) { return { x0: b.x0 + d, y0: b.y0 + d, x1: b.x1 - d, y1: b.y1 - d }; }
function union(boxes) {
  return {
    x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)),
  };
}
function clamp(img, b) {
  if (!img) return b;
  return {
    x0: Math.max(0, Math.round(b.x0)), y0: Math.max(0, Math.round(b.y0)),
    x1: Math.min(img.width - 1, Math.round(b.x1)), y1: Math.min(img.height - 1, Math.round(b.y1)),
  };
}

// ------------------------------------------------------------- step matching

function signatureScore(lines, step) {
  if (step.require && !step.require.some((p) => findPhrase(lines, p, { minScore: 0.85 }))) return 0;
  let n = 0;
  for (const group of step.signature) {
    if (group.some((p) => findPhrase(lines, p, { minScore: 0.85 }))) n++;
  }
  return n;
}

// Find the thing to press for a step. Returns { box, state } or null.
export function locate(step, lines, img) {
  const t = step.target;
  if (t.kind === 'button') {
    let cands = [];
    for (const p of t.phrases) cands.push(...findAll(lines, p, { coverage: 0.6 }));
    if (t.below) {
      const label = findPhrase(lines, t.below, { minScore: 0.85 });
      if (label) cands = cands.filter((c) => c.box.y0 > label.box.y1);
    }
    if (!cands.length) return null;
    cands.sort((a, b) => b.score - a.score || a.box.y0 - b.box.y0);
    const top = cands.filter((c) => c.score >= cands[0].score - 0.05).sort((a, b) => a.box.y0 - b.box.y0)[0];
    return { box: buttonBox(img, top.box), textBox: top.box };
  }
  if (t.kind === 'input') {
    const label = findPhrase(lines, t.label, { minScore: 0.85, coverage: 0.6 });
    if (!label) return null;
    const box = img ? inputBox(img, label.box) : null;
    if (!box) return null;
    return { box, done: boxHasText(lines, box) };
  }
  if (t.kind === 'options') {
    const found = [];
    for (const p of t.phrases) {
      const m = findPhrase(lines, p, { coverage: 0.6, minScore: 0.85 });
      if (m) found.push(m);
    }
    if (found.length < 2) return null;
    const selected = img ? found.some((m) => radioSelected(img, m.lines[0])) : false;
    // The whole list, including the circles on the left.
    const u = union(found.map((m) => m.box));
    const h = found[0].box.y1 - found[0].box.y0;
    return { box: clamp(img, { x0: u.x0 - h * 4, y0: u.y0 - h, x1: u.x1 + h, y1: u.y1 + h }), done: selected };
  }
  return null;
}

// Main entry point.
//   task:  one entry of TASKS
//   words: OCR words [{ text, conf, x0, y0, x1, y1 }]
//   img:   { width, height, data } RGBA, or null (text-only mode)
export function guide(task, words, img, { useState = true } = {}) {
  const lines = buildLines(words);
  const byId = Object.fromEntries(task.steps.map((s) => [s.id, s]));

  // 1. Pop-ups that sit on top of any page (cookie banner, robot check) win if
  //    their button is actually on screen.
  const urgent = task.steps.filter((s) => s.priority && signatureScore(lines, s) >= s.minSignature);
  for (const s of urgent) {
    const hit = locate(s, lines, img);
    if (hit) return result('ok', s, hit, lines);
  }

  // 2. Which page of the task is this?
  const scored = task.steps
    .filter((s) => !s.priority && !s.hidden)
    .map((s) => ({ s, score: signatureScore(lines, s) }))
    .filter((x) => x.score >= x.s.minSignature)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return result('unknown', null, null, lines);

  // Prefer a candidate whose target is visible; otherwise the best page match.
  for (const { s } of scored) {
    const hit = locate(s, lines, img);
    if (!hit) continue;
    // 3. Already done on this screen? Move to the follow-up step.
    if (useState && hit.done && s.next) {
      const nextStep = byId[s.next];
      const nextHit = locate(nextStep, lines, img);
      if (nextHit) return result('ok', nextStep, nextHit, lines);
      return result('scroll', nextStep, null, lines);
    }
    return result('ok', s, hit, lines);
  }
  // 4. We know the page, but the button is not on screen: scroll.
  return result('scroll', scored[0].s, null, lines);
}

function result(status, step, hit, lines) {
  return {
    status,
    stepId: step ? step.id : null,
    step,
    box: hit ? hit.box : null,
    lineCount: lines.length,
  };
}

// ---------------------------------------------------------------- baseline

// What a generic "find the button" helper does without a step guide: point at
// the first thing on screen that looks like an action button.
const ACTION_WORDS = ['accept', 'start now', 'continue', 'search', 'next', 'submit', 'sign in', 'register', 'begin', 'apply', 'log in', 'view', 'find'];
export function baseline(words) {
  const lines = buildLines(words);
  for (const l of lines) {
    const t = normalize(l.text);
    if (ACTION_WORDS.some((a) => t.startsWith(a)) && l.toks.length <= 8) {
      return { status: 'ok', box: { x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1 } };
    }
  }
  return { status: 'unknown', box: null };
}
