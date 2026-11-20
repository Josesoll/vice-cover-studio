// grades.js — Vice Cover Studio colour grades.
// A grade is plain data (a wash gradient, a tint, a mood) plus applyGrade,
// which paints that wash over a finished panel composite, then finishes the
// frame with a vignette and a whisper of film grain.

export const GRADES = [
  {
    id: 'vice',
    name: 'Vice Sunset',
    wash: [[0, 'rgba(255, 122, 26, 0.30)'], [0.48, 'rgba(255, 45, 120, 0.26)'], [1, 'rgba(64, 16, 120, 0.38)']],
    lift: 'rgba(255, 170, 90, 0.10)',
    mode: 'overlay',
    sat: 1.18,
    grain: 0.05,
  },
  {
    id: 'neon',
    name: 'Neon Nights',
    wash: [[0, 'rgba(0, 220, 200, 0.34)'], [0.55, 'rgba(24, 16, 110, 0.30)'], [1, 'rgba(255, 0, 140, 0.40)']],
    lift: 'rgba(0, 180, 255, 0.12)',
    mode: 'overlay',
    sat: 1.25,
    grain: 0.06,
  },
  {
    id: 'golden',
    name: 'Golden Hour',
    wash: [[0, 'rgba(255, 190, 60, 0.26)'], [0.6, 'rgba(255, 110, 40, 0.18)'], [1, 'rgba(90, 30, 10, 0.26)']],
    lift: 'rgba(255, 220, 140, 0.12)',
    mode: 'soft-light',
    sat: 1.1,
    grain: 0.04,
  },
  {
    id: 'noir',
    name: 'Noir',
    wash: [[0, 'rgba(20, 20, 30, 0.18)'], [1, 'rgba(0, 0, 0, 0.42)']],
    lift: 'rgba(200, 200, 220, 0.05)',
    mode: 'overlay',
    sat: 0.35,
    grain: 0.09,
  },
  {
    id: 'clean',
    name: 'Clean',
    wash: [],
    lift: null,
    mode: 'source-over',
    sat: 1,
    grain: 0.02,
  },
];

export function getGrade(id) {
  return GRADES.find((g) => g.id === id) || GRADES[0];
}

/** Darkens the frame edges so the eye stays on the cover's centre. */
export function drawVignette(ctx, w, h, strength = 0.42) {
  const r = Math.hypot(w, h) * 0.62;
  const grad = ctx.createRadialGradient(w / 2, h * 0.46, r * 0.35, w / 2, h * 0.5, r);
  grad.addColorStop(0, 'rgba(8, 2, 20, 0)');
  grad.addColorStop(1, `rgba(8, 2, 20, ${strength})`);
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Deterministic speckle (seeded, so exports and previews match exactly). */
export function drawGrain(ctx, w, h, amount = 0.05) {
  if (amount <= 0) return;
  const step = Math.max(3, Math.round(Math.min(w, h) / 220));
  let seed = 1234567;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  ctx.save();
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const v = next();
      if (v < 0.5) continue;
      ctx.fillStyle = v > 0.82 ? `rgba(255,255,255,${amount * 0.7})` : `rgba(0,0,0,${amount * 0.8})`;
      ctx.fillRect(x + next() * step, y + next() * step, 1.4, 1.4);
    }
  }
  ctx.restore();
}

/**
 * Applies preset `gradeId` over whatever is already drawn on ctx.
 * Saturation is handled by the caller via a CSS-like filter pass in draw.js
 * for photos; here we paint the wash, the warm lift, vignette and grain.
 */
export function applyGrade(ctx, w, h, gradeId) {
  const preset = typeof gradeId === 'string' ? getGrade(gradeId) : gradeId;
  ctx.save();
  if (preset.wash.length) {
    const grad = ctx.createLinearGradient(0, 0, w * 0.25, h);
    for (const [at, colour] of preset.wash) grad.addColorStop(at, colour);
    ctx.globalCompositeOperation = preset.mode === 'source-over' ? 'overlay' : preset.mode;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  if (preset.lift) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = preset.lift;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
  drawVignette(ctx, w, h, preset.id === 'noir' ? 0.58 : 0.4);
  drawGrain(ctx, w, h, preset.grain);
}
