// Show Me – the website. Everything runs in the browser: the screenshot is
// read with Tesseract (self-hosted in /vendor) and never uploaded anywhere.

import { LANGUAGES, TASKS, UI } from './tasks.js';
import { guide } from './engine.js';
import { readScreen, TARGET_WIDTH } from './ocr.js';
import { EXAMPLES } from './examples.js';

// ---------------------------------------------------------------- words
const T = {
  headline: {
    en: 'Stuck on a website? Send a screenshot and I’ll show you what to tap.',
    ar: 'هل توقفت في موقع إلكتروني؟ أرسل صورة للشاشة وسأريك أين تضغط.',
    ur: 'ویب سائٹ پر الجھ گئے؟ اسکرین شاٹ بھیجیں، میں دکھاؤں گا کہاں دبانا ہے۔',
    pl: 'Utknąłeś na stronie? Wyślij zrzut ekranu, a pokażę, co kliknąć.',
  },
  lede: {
    en: 'For GOV.UK and NHS websites. I circle the button and say it out loud, in your language.',
    ar: 'لمواقع GOV.UK و NHS. أضع دائرة حول الزر وأقرأ التعليمات بصوت عالٍ بلغتك.',
    ur: 'GOV.UK اور NHS کی ویب سائٹس کے لیے۔ میں بٹن کے گرد دائرہ بناتا ہوں اور آپ کی زبان میں بول کر بتاتا ہوں۔',
    pl: 'Dla stron GOV.UK i NHS. Zaznaczam przycisk i czytam polecenie na głos, w twoim języku.',
  },
  chooseTask: { en: 'What are you trying to do?', ar: 'ماذا تريد أن تفعل؟', ur: 'آپ کیا کرنا چاہتے ہیں؟', pl: 'Co chcesz zrobić?' },
  privacy: {
    en: 'Your screenshot never leaves your phone.',
    ar: 'صورة الشاشة لا تغادر هاتفك أبداً.',
    ur: 'آپ کا اسکرین شاٹ آپ کے فون سے باہر نہیں جاتا۔',
    pl: 'Zrzut ekranu nigdy nie opuszcza twojego telefonu.',
  },
  back: { en: 'Back', ar: 'رجوع', ur: 'واپس', pl: 'Wstecz' },
  how1: { en: 'Open the website:', ar: 'افتح الموقع:', ur: 'ویب سائٹ کھولیں:', pl: 'Otwórz stronę:' },
  how2: {
    en: 'When you are not sure what to do, take a screenshot.',
    ar: 'عندما لا تعرف ماذا تفعل، التقط صورة للشاشة.',
    ur: 'جب سمجھ نہ آئے کیا کرنا ہے، اسکرین شاٹ لیں۔',
    pl: 'Gdy nie wiesz, co zrobić, zrób zrzut ekranu.',
  },
  how3: {
    en: 'Come back here and add it. I’ll show you what to tap.',
    ar: 'ارجع إلى هنا وأضفها. سأريك أين تضغط.',
    ur: 'یہاں واپس آ کر اسے شامل کریں۔ میں دکھاؤں گا کہاں دبانا ہے۔',
    pl: 'Wróć tutaj i dodaj go. Pokażę, co kliknąć.',
  },
  addShot: { en: 'Add a screenshot', ar: 'أضف صورة الشاشة', ur: 'اسکرین شاٹ شامل کریں', pl: 'Dodaj zrzut ekranu' },
  tryExample: { en: 'Try an example first', ar: 'جرّب مثالاً أولاً', ur: 'پہلے ایک مثال آزمائیں', pl: 'Najpierw wypróbuj przykład' },
  reading: { en: 'Reading your screen…', ar: 'أقرأ شاشتك…', ur: 'آپ کی اسکرین پڑھ رہا ہوں…', pl: 'Czytam twój ekran…' },
  readingFirst: {
    en: 'The first time can take up to a minute.',
    ar: 'قد تستغرق المرة الأولى حتى دقيقة.',
    ur: 'پہلی بار ایک منٹ تک لگ سکتا ہے۔',
    pl: 'Za pierwszym razem może to potrwać do minuty.',
  },
  readAloud: { en: 'Read it again', ar: 'اقرأها مرة أخرى', ur: 'دوبارہ سنیں', pl: 'Przeczytaj ponownie' },
  nextShot: { en: 'Add the next screenshot', ar: 'أضف صورة الشاشة التالية', ur: 'اگلا اسکرین شاٹ شامل کریں', pl: 'Dodaj następny zrzut ekranu' },
  nextExample: { en: 'Next example', ar: 'المثال التالي', ur: 'اگلی مثال', pl: 'Następny przykład' },
  shotLabel: { en: 'Your screenshot with the button circled', ar: 'صورة شاشتك مع دائرة حول الزر', ur: 'آپ کا اسکرین شاٹ، بٹن کے گرد دائرہ', pl: 'Twój zrzut ekranu z zaznaczonym przyciskiem' },
  howWorks: { en: 'How it works and how well it works', ar: 'كيف يعمل ومدى دقته', ur: 'یہ کیسے کام کرتا ہے', pl: 'Jak to działa i jak dobrze' },
  failed: {
    en: 'That picture could not be read. Try a screenshot (not a photo of the screen).',
    ar: 'تعذّرت قراءة هذه الصورة. جرّب صورة شاشة وليس صورة بالكاميرا.',
    ur: 'یہ تصویر نہیں پڑھی جا سکی۔ اسکرین شاٹ آزمائیں، کیمرے کی تصویر نہیں۔',
    pl: 'Nie udało się odczytać obrazu. Użyj zrzutu ekranu, a nie zdjęcia ekranu.',
  },
};

// ---------------------------------------------------------------- state
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const state = {
  lang: LANGUAGES.find((l) => l.code === store.get('showme.lang'))?.code
    || LANGUAGES.find((l) => (navigator.language || 'en').toLowerCase().startsWith(l.code))?.code
    || 'en',
  task: null,
  exampleIndex: 0,
  lastSay: '',
  last: null, // { img, result } for redraw on language change
};
const lang = () => LANGUAGES.find((l) => l.code === state.lang);
const tr = (obj) => obj[state.lang] || obj.en;

// ---------------------------------------------------------------- views
function show(id) {
  for (const v of $$('.view')) v.hidden = v.id !== `view-${id}`;
  window.scrollTo(0, 0);
  const h = $(`#view-${id} h1, #view-${id} .say`);
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}

function renderLanguage() {
  const l = lang();
  document.documentElement.lang = l.code;
  document.documentElement.dir = l.dir;
  for (const el of $$('[data-t]')) el.textContent = tr(T[el.dataset.t]);
  for (const el of $$('[data-t-aria]')) el.setAttribute('aria-label', tr(T[el.dataset.tAria]));
  for (const b of $$('.langs button')) b.setAttribute('aria-pressed', String(b.dataset.lang === l.code));
  renderTasks();
  if (state.task) renderTask();
  if (state.last && !$('#view-result').hidden) presentResult(state.last.img, state.last.result, false);
}

function renderLangPicker() {
  const nav = $('.langs');
  for (const l of LANGUAGES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.lang = l.code;
    b.lang = l.code;
    b.textContent = l.name;
    b.addEventListener('click', () => { state.lang = l.code; store.set('showme.lang', l.code); renderLanguage(); });
    nav.append(b);
  }
}

function renderTasks() {
  const ul = $('.tasks');
  ul.replaceChildren();
  for (const t of TASKS) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span class="icon" aria-hidden="true"></span><span class="label"></span><span class="chev" aria-hidden="true">›</span>`;
    $('.icon', b).textContent = t.icon;
    $('.label', b).textContent = tr(t.title);
    b.addEventListener('click', () => { state.task = t; state.exampleIndex = 0; renderTask(); show('task'); });
    li.append(b);
    ul.append(li);
  }
}

function renderTask() {
  $('.task-title').textContent = tr(state.task.title);
  const a = $('.open-site');
  a.href = state.task.startUrl;
  a.textContent = new URL(state.task.startUrl).hostname.replace(/^www\./, '');
}

// ---------------------------------------------------------------- OCR
let workerPromise = null;
let currentPsm = '3';
function getWorker() {
  if (!workerPromise) {
    const base = new URL('vendor/', location.href).href;
    workerPromise = Tesseract.createWorker('eng', 1, {
      workerPath: base + 'worker.min.js',
      corePath: base + 'core/',
      langPath: base + 'lang',
      gzip: false,
      cacheMethod: 'none',
    });
  }
  return workerPromise;
}
async function recognize(input, { psm }) {
  const w = await getWorker();
  if (psm !== currentPsm) { await w.setParameters({ tessedit_pageseg_mode: psm }); currentPsm = psm; }
  return (await w.recognize(input)).data;
}
function toCanvas(im) {
  const c = document.createElement('canvas');
  c.width = im.width; c.height = im.height;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(im.data.buffer, im.data.byteOffset, im.data.length), im.width, im.height), 0, 0);
  return c;
}

async function loadImage(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  const k = img.naturalWidth > 900 ? TARGET_WIDTH / img.naturalWidth : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  return { width: c.width, height: c.height, data: d.data, canvas: c };
}

async function run(src) {
  show('working');
  speechSynthesis?.cancel?.();
  try {
    const img = await loadImage(src);
    const words = await readScreen(img, recognize, toCanvas);
    const result = guide(state.task, words, img);
    state.last = { img, result };
    presentResult(img, result, true);
  } catch (err) {
    console.error(err);
    state.last = null;
    $('.say').textContent = tr(T.failed);
    $('.shot').width = 0;
    show('result');
  }
}

// ---------------------------------------------------------------- result
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function presentResult(img, result, fresh) {
  const say = result.status === 'ok' ? tr(result.step.say)
    : result.status === 'scroll' ? tr(UI.scroll) : tr(UI.unknown);
  state.lastSay = say;
  $('.say').textContent = say;
  $('.example-next').hidden = !state.usingExample;
  if (fresh) show('result');
  draw(img, result, fresh && !reduceMotion());
  if (fresh) speak(say);
}

// A hand-drawn highlighter loop: an ellipse that wobbles slightly and
// overshoots its start, drawn on over ~600ms.
function loopPath(box, w, h) {
  const pad = 14;
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  const rx = Math.min((box.x1 - box.x0) / 2 + pad * 1.6, cx - 8, w - cx - 8);
  const ry = Math.min((box.y1 - box.y0) / 2 + pad, h / 2);
  const pts = [];
  const start = -2.6, sweep = Math.PI * 2 + 0.45;
  for (let i = 0; i <= 90; i++) {
    const t = start + (sweep * i) / 90;
    const wob = 1 + 0.035 * Math.sin(t * 3 + 0.7) + (i / 90) * 0.06; // spiral out a touch
    const sq = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.6); // squarish loop hugs buttons
    pts.push([cx + sq(Math.cos(t)) * rx * wob, cy + sq(Math.sin(t)) * ry * wob - (i / 90) * 4]);
  }
  return pts;
}

function draw(img, result, animate) {
  const canvas = $('.shot');
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  const frame = $('.shot-frame');
  const base = () => ctx.drawImage(img.canvas, 0, 0);
  base();

  if (result.status === 'ok' && result.box) {
    const b = result.box;
    const pts = loopPath(b, img.width, img.height);
    // dim everything a little so the loop stands out
    const paint = (n) => {
      base();
      ctx.fillStyle = 'rgba(20,33,61,0.18)';
      ctx.fillRect(0, 0, img.width, img.height);
      ctx.drawImage(img.canvas, b.x0 - 10, b.y0 - 10, b.x1 - b.x0 + 20, b.y1 - b.y0 + 20, b.x0 - 10, b.y0 - 10, b.x1 - b.x0 + 20, b.y1 - b.y0 + 20);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255,212,59,0.95)';
      ctx.lineWidth = Math.max(7, img.width / 75);
      ctx.beginPath();
      pts.slice(0, n).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    };
    // bring the target into view inside the scroll frame
    requestAnimationFrame(() => {
      const scale = canvas.clientWidth / img.width;
      const y = ((b.y0 + b.y1) / 2) * scale - frame.clientHeight / 2;
      frame.scrollTo({ top: Math.max(0, y), behavior: animate ? 'smooth' : 'auto' });
    });
    if (!animate) return paint(pts.length);
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 650);
      const eased = 1 - Math.pow(1 - k, 3);
      paint(Math.max(2, Math.round(eased * pts.length)));
      if (k < 1) requestAnimationFrame(tick);
    };
    setTimeout(() => requestAnimationFrame(tick), 250);
  } else if (result.status === 'scroll') {
    // a big arrow at the bottom pointing down
    const s = img.width / 750;
    const x = img.width / 2, y = img.height - 150 * s;
    ctx.fillStyle = 'rgba(20,33,61,0.18)';
    ctx.fillRect(0, 0, img.width, img.height);
    ctx.fillStyle = '#FFD43B'; ctx.strokeStyle = '#14213D'; ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.moveTo(x - 34 * s, y - 70 * s); ctx.lineTo(x + 34 * s, y - 70 * s); ctx.lineTo(x + 34 * s, y);
    ctx.lineTo(x + 80 * s, y); ctx.lineTo(x, y + 90 * s); ctx.lineTo(x - 80 * s, y); ctx.lineTo(x - 34 * s, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    requestAnimationFrame(() => frame.scrollTo({ top: frame.scrollHeight, behavior: 'auto' }));
  } else {
    requestAnimationFrame(() => frame.scrollTo({ top: 0 }));
  }
}

// ---------------------------------------------------------------- voice
function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[“”]/g, '"'));
  const l = lang();
  u.lang = l.voice;
  const voice = speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith(l.code));
  if (voice) u.voice = voice;
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

// ---------------------------------------------------------------- wiring
function onFile(e) {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  state.usingExample = false;
  const url = URL.createObjectURL(f);
  run(url).finally(() => setTimeout(() => URL.revokeObjectURL(url), 2000));
}
function runExample() {
  const list = EXAMPLES[state.task.id];
  const file = list[state.exampleIndex % list.length];
  state.exampleIndex++;
  state.usingExample = true;
  run(`examples/${file}`);
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-action]');
  if (!a) return;
  const act = a.dataset.action;
  if (act === 'home') { state.task = null; show('home'); }
  else if (act === 'task') show('task');
  else if (act === 'example') runExample();
  else if (act === 'speak') speak(state.lastSay);
});
for (const input of $$('.file-input')) input.addEventListener('change', onFile);
speechSynthesis?.addEventListener?.('voiceschanged', () => {});

renderLangPicker();
renderLanguage();
// Start loading the OCR engine as soon as someone picks a task.
$('.tasks').addEventListener('click', () => getWorker(), { once: true });
