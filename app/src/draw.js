// draw.js — Vice Cover Studio renderer.
// drawCover paints, in order: panel photos (cover-fit, per-panel pan + zoom,
// clipped to each polygon), light divider strokes, the colour grade, my own
// palm-and-sun decoration, and finally the big caption lettering with its
// subtitle bar. Everything here is drawn with canvas paths — no artwork,
// logos or fonts are borrowed from anywhere.

import { getLayout, panelPath } from './panels.js';
import { applyGrade, getGrade } from './grades.js';

const INK = '#160826';
const PAPER = '#fff7ea';

function trace(ctx, points) {
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

/** Draws img so it covers the box (bw x bh at bx, by), honouring zoom + pan. */
function drawCoverFit(ctx, img, bx, by, bw, bh, zoom, dx, dy, sat) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(bw / iw, bh / ih) * (zoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  const x = bx + (bw - dw) / 2 + (dx || 0) * bw;
  const y = by + (bh - dh) / 2 + (dy || 0) * bh;
  ctx.save();
  if (sat && sat !== 1 && 'filter' in ctx) ctx.filter = `saturate(${sat}) contrast(1.06)`;
  ctx.drawImage(img, x, y, dw, dh);
  ctx.restore();
}

/** A placeholder sky for a panel that has no photo yet. */
function drawPlaceholder(ctx, panel, seedHue) {
  const { minX, minY, maxX, maxY } = panel;
  const grad = ctx.createLinearGradient(minX, minY, maxX, maxY);
  grad.addColorStop(0, `hsl(${seedHue}, 70%, 42%)`);
  grad.addColorStop(1, `hsl(${seedHue + 50}, 78%, 20%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
}

/** My own low sun: a disc sliced by horizon bands, drawn with plain arcs. */
function drawSun(ctx, cx, cy, r) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  grad.addColorStop(0, '#ffd23e');
  grad.addColorStop(0.55, '#ff7a1a');
  grad.addColorStop(1, '#ff2d78');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = grad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = 'rgba(22, 8, 38, 0.85)';
  for (let i = 0; i < 4; i++) {
    const y = cy + r * (0.08 + i * 0.2);
    ctx.fillRect(cx - r, y, r * 2, r * (0.035 + i * 0.016));
  }
  ctx.restore();
}

/** A palm silhouette from bezier fronds — drawn, never traced from an image. */
function drawPalm(ctx, x, y, s, flip = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip * s, s);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(10, -52, 26, -96);
  ctx.stroke();
  ctx.translate(26, -96);
  const fronds = [[-58, -16], [-34, -30], [0, -38], [36, -28], [60, -10], [-48, 8], [50, 10]];
  ctx.lineWidth = 5;
  for (const [fx, fy] of fronds) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(fx * 0.55, fy - 12, fx, fy + 10);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(-4, 3, 5, 0, Math.PI * 2);
  ctx.arc(5, 4, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDecor(ctx, w, h) {
  // Sun sits high in the frame; palms anchor both bottom corners, kept
  // modest so they frame the photos instead of swallowing them.
  drawSun(ctx, w * 0.845, h * 0.145, Math.min(w, h) * 0.068);
  const s = Math.min(w, h) / 470;
  drawPalm(ctx, w * 0.028, h * 0.998, s, 1);
  drawPalm(ctx, w * 0.972, h * 0.998, s * 0.86, -1);
}

/** Fits a font size so `text` spans at most maxW, starting from startSize. */
function fitSize(ctx, text, fontOf, startSize, maxW) {
  let size = startSize;
  ctx.font = fontOf(size);
  while (size > 14 && ctx.measureText(text).width > maxW) {
    size -= 3;
    ctx.font = fontOf(size);
  }
  return size;
}

/** Big condensed italic title with gradient fill, dark outline, slight skew. */
function drawLettering(ctx, w, h, title, subtitle) {
  const text = (title || '').trim().toUpperCase();
  const sub = (subtitle || '').trim().toUpperCase();
  if (text) {
    // A whisper of shade at the very top so the masthead reads on any photo.
    const scrim = ctx.createLinearGradient(0, 0, 0, h * 0.24);
    scrim.addColorStop(0, 'rgba(10, 2, 24, 0.34)');
    scrim.addColorStop(1, 'rgba(10, 2, 24, 0)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h * 0.24);
  }
  ctx.save();
  if (text) {
    const fontOf = (s) => `italic 900 ${s}px "Arial Narrow", "Liberation Sans Narrow", Impact, "Helvetica Neue", Arial, sans-serif`;
    const size = fitSize(ctx, text, fontOf, h * 0.135, w * 0.92);
    ctx.font = fontOf(size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // Slight forward lean + lift, like poster masthead lettering.
    ctx.translate(w / 2, h * 0.045 + size);
    ctx.transform(1, 0, -0.09, 1, 0, 0);
    ctx.rotate(-0.018);
    const grad = ctx.createLinearGradient(0, -size, 0, size * 0.25);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.52, '#ffe9b8');
    grad.addColorStop(0.78, '#ff9d5c');
    grad.addColorStop(1, '#ff2d78');
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(10, 2, 24, 0.55)';
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.045;
    ctx.strokeStyle = INK;
    ctx.lineWidth = size * 0.16;
    ctx.strokeText(text, 0, 0);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = grad;
    ctx.fillText(text, 0, 0);
    ctx.lineWidth = size * 0.028;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.strokeText(text, 0, 0);
  }
  ctx.restore();

  if (sub) {
    ctx.save();
    const size = Math.max(13, h * 0.028);
    const fontOf = (s) => `700 ${s}px "Helvetica Neue", Arial, sans-serif`;
    ctx.font = fontOf(size);
    const tw = ctx.measureText(sub.split('').join('  ')).width;
    const bw = Math.min(w * 0.86, tw + size * 2.4);
    const bh = size * 2.05;
    const bx = (w - bw) / 2;
    const by = h - bh - h * 0.035;
    ctx.fillStyle = 'rgba(16, 4, 32, 0.88)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.strokeStyle = '#ff7a1a';
    ctx.lineWidth = Math.max(1.5, size * 0.09);
    ctx.stroke();
    ctx.fillStyle = PAPER;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Letter-spaced by hand so it works without ctx.letterSpacing support.
    ctx.fillText(sub.split('').join('  '), w / 2, by + bh / 2 + 1);
    ctx.restore();
  }
}

/**
 * The whole cover. state = { photos, panels: [{photoIndex, dx, dy, zoom}],
 * layout, grade, title, subtitle, onePhoto, selected, showSelection }.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const panels = getLayout(state.layout, w, h);
  const grade = getGrade(state.grade);
  ctx.save();
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, h);

  const photos = state.photos || [];
  const spread = state.onePhoto && photos.length > 0;

  panels.forEach((panel, i) => {
    const cfg = (state.panels && state.panels[i]) || { photoIndex: i, dx: 0, dy: 0, zoom: 1 };
    ctx.save();
    ctx.clip(panelPath(panel.points));
    if (spread) {
      // One photo stretched across the whole canvas, sliced by the panels.
      drawCoverFit(ctx, photos[0], 0, 0, w, h, cfg.zoom || 1, cfg.dx || 0, cfg.dy || 0, grade.sat);
    } else {
      const img = photos.length ? photos[((cfg.photoIndex % photos.length) + photos.length) % photos.length] : null;
      if (img) {
        drawCoverFit(ctx, img, panel.minX, panel.minY, panel.maxX - panel.minX, panel.maxY - panel.minY, cfg.zoom, cfg.dx, cfg.dy, grade.sat);
      } else {
        drawPlaceholder(ctx, panel, 268 + i * 28);
      }
    }
    // A soft inner shadow along each panel gives the slices depth.
    ctx.strokeStyle = 'rgba(10, 2, 24, 0.22)';
    ctx.lineWidth = Math.max(4, w * 0.006);
    trace(ctx, panel.points);
    ctx.stroke();
    ctx.restore();
  });

  applyGrade(ctx, w, h, grade);

  // Crisp light dividers over the grade, so the cuts stay graphic.
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 244, 224, 0.96)';
  ctx.lineWidth = Math.max(2, w * 0.0042);
  ctx.lineJoin = 'round';
  for (const panel of panels) {
    trace(ctx, panel.points);
    ctx.stroke();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(3, w * 0.007);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  // A gold hairline just inside the frame gives it a printed-poster finish.
  ctx.strokeStyle = 'rgba(255, 210, 62, 0.75)';
  ctx.lineWidth = Math.max(1.2, w * 0.0016);
  const inset = w * 0.009;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.restore();

  // A faint diagonal sheen, like light across a glossy sleeve.
  ctx.save();
  const sheen = ctx.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0, 'rgba(255,255,255,0.07)');
  sheen.addColorStop(0.35, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(255,255,255,0.03)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  drawDecor(ctx, w, h);

  if (state.showSelection && typeof state.selected === 'number' && panels[state.selected]) {
    ctx.save();
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = Math.max(3, w * 0.006);
    ctx.setLineDash([w * 0.02, w * 0.012]);
    trace(ctx, panels[state.selected].points);
    ctx.stroke();
    ctx.restore();
  }

  drawLettering(ctx, w, h, state.title, state.subtitle);
  ctx.restore();
  return panels;
}
