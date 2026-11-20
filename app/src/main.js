// main.js — Vice Cover Studio editor wiring + screenshot scenes.
// Owns the state, keeps the preview live on every change, and renders exports
// on an offscreen canvas at the exact pixel size the user picked.

import { drawCover } from './draw.js';
import { LAYOUTS, panelCount, hitTest, getLayout } from './panels.js';
import { GRADES as GRADES_LIST } from './grades.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const statusEl = $('status');

const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};
const SAMPLES = { pier: 'samples/pier.jpg', boulevard: 'samples/boulevard.jpg', 'neon-mile': 'samples/neon-mile.jpg' };

const state = {
  photos: [],
  photoNames: [],
  panels: [],
  layout: 'wedge',
  grade: 'vice',
  title: 'VICE HEAT',
  subtitle: 'One last score in Leonida',
  size: '1080x1080',
  onePhoto: false,
  selected: 0,
  showSelection: true,
};

function freshPanels() {
  state.panels = Array.from({ length: panelCount(state.layout) }, (_, i) => ({
    photoIndex: state.photos.length ? i % state.photos.length : 0,
    dx: 0,
    dy: 0,
    zoom: 1,
  }));
  if (state.selected >= state.panels.length) state.selected = 0;
}

function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function redraw() {
  const [w, h] = SIZES[state.size] || SIZES['1080x1080'];
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  drawCover(canvas, state);
  syncPanelControls();
}

function syncPanelControls() {
  const sel = $('panel-select');
  const photoSel = $('panel-photo');
  const zoom = $('zoom');
  if (!sel) return;
  if (sel.options.length !== state.panels.length) {
    sel.innerHTML = state.panels.map((_, i) => `<option value="${i}">Panel ${i + 1}</option>`).join('');
  }
  sel.value = String(state.selected);
  const names = state.photoNames.length ? state.photoNames : ['(no photo)'];
  if (photoSel.options.length !== names.length) {
    photoSel.innerHTML = names.map((n, i) => `<option value="${i}">${n}</option>`).join('');
  }
  const cfg = state.panels[state.selected];
  if (cfg) {
    photoSel.value = String(Math.min(cfg.photoIndex, Math.max(0, names.length - 1)));
    zoom.value = String(cfg.zoom);
    $('zoom-value').textContent = `${Number(cfg.zoom).toFixed(2)}×`;
  }
  $('photo-count').textContent = state.photos.length
    ? `${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} loaded: ${state.photoNames.join(', ')}`
    : 'No photos yet — try a sample.';
}

async function addPhoto(url, name) {
  const img = await loadImage(url);
  state.photos.push(img);
  state.photoNames.push(name);
  state.panels.forEach((p, i) => { if (state.photos.length > 1) p.photoIndex = i % state.photos.length; });
  redraw();
  return img;
}

function wireEditor() {
  const layoutSel = $('layout');
  layoutSel.innerHTML = LAYOUTS.map((l) => `<option value="${l.id}">${l.name} — ${l.blurb}</option>`).join('');
  layoutSel.value = state.layout;
  const gradeSel = $('grade');
  gradeSel.innerHTML = GRADES_LIST.map((g) => `<option value="${g.id}">${g.name}</option>`).join('');
  gradeSel.value = state.grade;

  layoutSel.addEventListener('change', () => { state.layout = layoutSel.value; freshPanels(); redraw(); });
  gradeSel.addEventListener('change', () => { state.grade = gradeSel.value; redraw(); });
  $('size').addEventListener('change', (e) => { state.size = e.target.value; redraw(); });
  $('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
  $('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  $('one-photo').addEventListener('change', (e) => { state.onePhoto = e.target.checked; redraw(); });
  $('panel-select').addEventListener('change', (e) => { state.selected = Number(e.target.value); redraw(); });
  $('panel-photo').addEventListener('change', (e) => {
    const cfg = state.panels[state.selected];
    if (cfg) cfg.photoIndex = Number(e.target.value);
    redraw();
  });
  $('zoom').addEventListener('input', (e) => {
    const cfg = state.panels[state.selected];
    if (cfg) cfg.zoom = Number(e.target.value);
    redraw();
  });

  $('photo').addEventListener('change', async (e) => {
    for (const file of e.target.files) await addPhoto(URL.createObjectURL(file), file.name);
    setStatus(state.photos.length ? 'Photos loaded — pick a panel and make it yours.' : '');
  });
  document.querySelectorAll('[data-sample]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await addPhoto(SAMPLES[btn.dataset.sample], btn.dataset.sample);
      setStatus(`Sample “${btn.dataset.sample}” added.`);
    });
  });

  // Canvas: click selects, drag pans, wheel zooms the selected panel.
  let drag = null;
  const toCanvas = (ev) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * canvas.width, y: ((ev.clientY - r.top) / r.height) * canvas.height };
  };
  canvas.addEventListener('pointerdown', (ev) => {
    const p = toCanvas(ev);
    const idx = hitTest(getLayout(state.layout, canvas.width, canvas.height), p.x, p.y);
    if (idx >= 0) state.selected = idx;
    drag = { x: p.x, y: p.y };
    canvas.setPointerCapture(ev.pointerId);
    redraw();
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const p = toCanvas(ev);
    const cfg = state.panels[state.selected];
    if (cfg) {
      cfg.dx += (p.x - drag.x) / canvas.width;
      cfg.dy += (p.y - drag.y) / canvas.height;
    }
    drag = p;
    redraw();
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('dblclick', (ev) => {
    if (!state.photos.length) return;
    const p = toCanvas(ev);
    const idx = hitTest(getLayout(state.layout, canvas.width, canvas.height), p.x, p.y);
    if (idx < 0) return;
    state.selected = idx;
    const cfg = state.panels[idx];
    cfg.photoIndex = (cfg.photoIndex + 1) % state.photos.length;
    setStatus(`Panel ${idx + 1} now shows ${state.photoNames[cfg.photoIndex]}.`);
    redraw();
  });
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const cfg = state.panels[state.selected];
    if (!cfg) return;
    cfg.zoom = Math.min(2.6, Math.max(1, cfg.zoom * (ev.deltaY < 0 ? 1.07 : 0.93)));
    redraw();
  }, { passive: false });
  canvas.addEventListener('dragover', (ev) => ev.preventDefault());
  canvas.addEventListener('drop', async (ev) => {
    ev.preventDefault();
    for (const file of ev.dataTransfer.files) {
      if (file.type.startsWith('image/')) await addPhoto(URL.createObjectURL(file), file.name);
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const cfg = state.panels[state.selected];
    if (!cfg) return;
    const step = ev.shiftKey ? 0.02 : 0.006;
    if (ev.key === 'ArrowLeft') cfg.dx -= step;
    else if (ev.key === 'ArrowRight') cfg.dx += step;
    else if (ev.key === 'ArrowUp') cfg.dy -= step;
    else if (ev.key === 'ArrowDown') cfg.dy += step;
    else return;
    ev.preventDefault();
    redraw();
  });

  $('export').addEventListener('click', () => {
    const [w, h] = SIZES[state.size];
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    drawCover(off, { ...state, showSelection: false });
    off.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-cover-${w}x${h}.png`;
      a.click();
      setStatus(`Saved vice-cover-${w}x${h}.png`);
    }, 'image/png');
  });
}

// --- screenshot scenes -----------------------------------------------------
async function runShot(params) {
  const shot = params.get('shot');
  const sizeKey = params.get('size') || '1080x1080';
  if (SIZES[sizeKey]) state.size = sizeKey;
  if (params.get('layout')) state.layout = params.get('layout');
  if (params.get('grade')) state.grade = params.get('grade');
  if (params.get('title') !== null) state.title = params.get('title');
  if (params.get('sub') !== null) state.subtitle = params.get('sub');
  if (params.get('onephoto') === '1') state.onePhoto = true;
  freshPanels();
  const wanted = (params.get('photos') || params.get('photo') || 'pier').split(',').map((s) => s.trim()).filter(Boolean);
  for (const name of wanted) {
    if (SAMPLES[name]) await addPhoto(SAMPLES[name], name);
  }
  state.panels.forEach((p, i) => { p.photoIndex = state.photos.length ? i % state.photos.length : 0; });
  const assign = (params.get('assign') || '').split(',').map((s) => Number(s)).filter((n) => Number.isInteger(n));
  assign.forEach((photoIdx, i) => { if (state.panels[i] && state.photos.length) state.panels[i].photoIndex = photoIdx % state.photos.length; });
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    state.showSelection = false;
    const [w, h] = SIZES[state.size];
    canvas.width = w; canvas.height = h;
  } else {
    // Editor scene: reflect the composed state back into the controls.
    $('title').value = state.title;
    $('subtitle').value = state.subtitle;
    $('layout').value = state.layout;
    $('grade').value = state.grade;
    $('size').value = state.size;
    if (state.onePhoto) $('one-photo').checked = true;
  }
  redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

freshPanels();
wireEditor();
const params = new URLSearchParams(location.search);
if (params.get('shot')) {
  runShot(params).catch((err) => { setStatus(String(err)); window.__shotReady = true; });
} else {
  // A normal visit opens with the three samples already composed, so the
  // first cover is one click from an export; swap in your own photos anytime.
  redraw();
  (async () => {
    for (const name of Object.keys(SAMPLES)) await addPhoto(SAMPLES[name], name);
    setStatus('Samples loaded — drop your own photos in to make it yours.');
  })().catch(() => {});
}
