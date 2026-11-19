// Vice Cover Studio editor: photo slots, drag-to-pan panels, layouts, colour
// grades, caption editing and one-click PNG export in three post sizes.
// A `?shot=` query sets up a fixed scene for a screenshot instead (shots.js).
import { drawCover, renderOffscreen, panelRects, panLimits, SIZES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const SAMPLES = ['samples/boulevard.jpg', 'samples/pier.jpg'];

const state = {
  layout: 'poster',
  grade: 'sunset',
  sizeKey: 'square',
  title: 'VICE NIGHTS',
  subtitle: 'SUNSET HEIST',
  titleScale: 1,
  captionPos: 'bottom',
  photos: [null, null, null],
};
let activeSlot = 0;
let drag = null;

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function redraw() {
  if (!document.body.classList.contains('shot-cover')) {
    const size = SIZES[state.sizeKey];
    if (canvas.width !== size.w || canvas.height !== size.h) {
      canvas.width = size.w;
      canvas.height = size.h;
    }
  }
  drawCover(canvas, state);
}

function syncSlots() {
  document.querySelectorAll('.slot').forEach((el, i) => {
    el.classList.toggle('active', i === activeSlot);
    const slider = el.querySelector('input[type=range]');
    if (slider) slider.value = String(state.photos[i]?.zoom ?? 1);
  });
}

async function setSamplePhoto(slot, name) {
  const photo = { img: await loadImage(`samples/${name}.jpg`), zoom: 1, ox: 0, oy: 0 };
  state.photos[slot] = photo;
  return photo;
}

async function loadDefaults() {
  applyDefaultPan(0, await setSamplePhoto(0, 'boulevard'));
  applyDefaultPan(1, await setSamplePhoto(1, 'pier'));
  applyDefaultPan(2, await setSamplePhoto(2, 'boulevard'));
}

// Default crops: the boulevard photo's face sits near its top, so its panels
// start panned down; the pier photo's subject is centred.
const DEFAULT_PAN = [
  { zoom: 1, ox: 0, oy: 0.15 },
  { zoom: 1, ox: 0, oy: 0 },
  { zoom: 1.35, ox: -0.08, oy: 0.12 },
];

function applyDefaultPan(slot, photo) {
  const pan = DEFAULT_PAN[slot];
  photo.zoom = pan.zoom;
  photo.ox = pan.ox;
  photo.oy = pan.oy;
  return photo;
}

/** Applies a screenshot scene: layout, grade, caption and sample photos. */
export async function setupShot(patch) {
  state.layout = patch.layout;
  state.grade = patch.grade;
  state.title = patch.title;
  state.subtitle = patch.subtitle;
  state.sizeKey = patch.sizeKey;
  titleInput.value = patch.title;
  subtitleInput.value = patch.subtitle;
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b.dataset.layout === patch.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b.dataset.grade === patch.grade));
  document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('active', b.dataset.size === patch.sizeKey));
  await setSamplePhoto(0, patch.photos[0]);
  await setSamplePhoto(1, patch.photos[1]);
  await setSamplePhoto(2, patch.photos[2]);
  applyDefaultPan(0, state.photos[0]);
  applyDefaultPan(1, state.photos[1]);
  applyDefaultPan(2, state.photos[2]);
  redraw();
}

function wirePicker(selector, onPick) {
  document.querySelectorAll(selector).forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll(selector).forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
      onPick(button);
      redraw();
    });
  });
}

wirePicker('[data-layout]', (b) => { state.layout = b.dataset.layout; });
wirePicker('[data-grade]', (b) => { state.grade = b.dataset.grade; });
wirePicker('[data-size]', (b) => { state.sizeKey = b.dataset.size; });

document.querySelectorAll('.slot').forEach((slotEl, i) => {
  slotEl.querySelector('input[type=file]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    state.photos[i] = { img: await loadImage(URL.createObjectURL(file)), zoom: 1, ox: 0, oy: 0 };
    activeSlot = i;
    syncSlots();
    redraw();
  });
  slotEl.querySelector('.sample-btn').addEventListener('click', async () => {
    await setSamplePhoto(i, SAMPLES[i % SAMPLES.length].replace('samples/', '').replace('.jpg', ''));
    activeSlot = i;
    syncSlots();
    redraw();
  });
  slotEl.querySelector('.reset-btn').addEventListener('click', async () => {
    const photo = await setSamplePhoto(i, SAMPLES[i % SAMPLES.length].replace('samples/', '').replace('.jpg', ''));
    applyDefaultPan(i, photo);
    activeSlot = i;
    syncSlots();
    redraw();
  });
  slotEl.querySelector('input[type=range]').addEventListener('input', (e) => {
    const photo = state.photos[i];
    if (!photo) return;
    photo.zoom = Number(e.target.value);
    redraw();
  });
  slotEl.addEventListener('click', () => {
    activeSlot = i;
    syncSlots();
  });
});

titleInput.addEventListener('input', () => {
  state.title = titleInput.value;
  redraw();
});
subtitleInput.addEventListener('input', () => {
  state.subtitle = subtitleInput.value;
  redraw();
});
document.getElementById('title-scale').addEventListener('input', (e) => {
  state.titleScale = Number(e.target.value);
  redraw();
});
document.getElementById('pos-bottom').addEventListener('click', () => {
  state.captionPos = 'bottom';
  document.getElementById('pos-bottom').classList.add('active');
  document.getElementById('pos-top').classList.remove('active');
  redraw();
});
document.getElementById('pos-top').addEventListener('click', () => {
  state.captionPos = 'top';
  document.getElementById('pos-top').classList.add('active');
  document.getElementById('pos-bottom').classList.remove('active');
  redraw();
});

/** Which panel (if any) sits under a pointer position, in canvas pixels. */
function panelAt(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  const x = (clientX - box.left) * (canvas.width / box.width);
  const y = (clientY - box.top) * (canvas.height / box.height);
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  const index = rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  if (index === -1) return null;
  return { index, x, y, rect: rects[index] };
}

canvas.addEventListener('pointerdown', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (!hit) return;
  activeSlot = hit.index;
  syncSlots();
  drag = { x: hit.x, y: hit.y, ox: state.photos[hit.index]?.ox || 0, oy: state.photos[hit.index]?.oy || 0 };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const hit = panelAt(e.clientX, e.clientY);
  if (!hit) return;
  const photo = state.photos[activeSlot];
  if (!photo) return;
  const limits = panLimits(photo, hit.rect);
  photo.ox = clamp(drag.ox + (hit.x - drag.x) / hit.rect.w, -limits.maxOx, limits.maxOx);
  photo.oy = clamp(drag.oy + (hit.y - drag.y) / hit.rect.h, -limits.maxOy, limits.maxOy);
  redraw();
});
canvas.addEventListener('pointerup', () => {
  drag = null;
});
canvas.addEventListener('wheel', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (!hit) return;
  e.preventDefault();
  const photo = state.photos[hit.index];
  if (!photo) return;
  photo.zoom = clamp((photo.zoom || 1) * Math.exp(-e.deltaY * 0.0012), 1, 3);
  const slider = document.querySelector(`#slot-${hit.index} input[type=range]`);
  if (slider) slider.value = String(photo.zoom);
  redraw();
}, { passive: false });

async function downloadCanvas(offscreen, filename) {
  const blob = await new Promise((resolve) => offscreen.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

document.getElementById('export-one').addEventListener('click', async () => {
  const size = SIZES[state.sizeKey];
  await downloadCanvas(renderOffscreen(state, size.w, size.h), `vice-cover-${size.w}x${size.h}.png`);
  statusEl.textContent = `Saved vice-cover-${size.w}x${size.h}.png`;
});
document.getElementById('export-all').addEventListener('click', async () => {
  for (const key of Object.keys(SIZES)) {
    const size = SIZES[key];
    await downloadCanvas(renderOffscreen(state, size.w, size.h), `vice-cover-${size.w}x${size.h}.png`);
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  statusEl.textContent = 'Saved all 3 sizes — 1080x1080, 1080x1350, 1920x1080.';
});

if (document.fonts) {
  document.fonts.load('100px Anton').catch(() => {}).then(redraw);
  document.fonts.ready.then(redraw);
}

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), setupShot);
} else {
  loadDefaults().then(redraw);
}
