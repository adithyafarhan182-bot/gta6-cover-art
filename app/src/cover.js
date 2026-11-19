// Vice Cover Studio renderer: turns photos + a caption into a multi-panel
// GTA-style poster cover on a canvas. Pure Canvas 2D, offline, no network.
// The poster look comes from comic panel gutters with double borders, a
// Vice City colour grade over every photo, and bold Anton caption lettering
// over a scrim at the foot (or head) of the cover.

export const SIZES = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  wide: { w: 1920, h: 1080 },
};

export const LAYOUTS = ['poster', 'comic', 'triptych', 'stack'];
export const GRADES = ['sunset', 'neon', 'beach', 'noir'];

const GRADE_FILTERS = {
  sunset: 'saturate(1.18) contrast(1.06)',
  neon: 'saturate(1.35) contrast(1.08)',
  beach: 'saturate(1.12) contrast(1.04)',
  noir: 'saturate(0.45) contrast(1.12) brightness(0.96)',
};

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** How far a photo may pan inside a panel (fractions of the panel) before a gap shows. */
export function panLimits(photo, rect) {
  if (!photo || !photo.img) return { maxOx: 0, maxOy: 0 };
  const base = Math.max(rect.w / photo.img.naturalWidth, rect.h / photo.img.naturalHeight);
  const s = base * (photo.zoom || 1);
  const dw = photo.img.naturalWidth * s;
  const dh = photo.img.naturalHeight * s;
  return {
    maxOx: Math.max(0, (dw - rect.w) / (2 * rect.w)),
    maxOy: Math.max(0, (dh - rect.h) / (2 * rect.h)),
  };
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Panel rectangles for a layout inside a W x H cover. Panel 0 is the hero. */
export function panelRects(layout, w, h) {
  const m = Math.round(w * 0.018);
  const g = Math.max(4, Math.round(w * 0.012));
  const iw = w - m * 2;
  const ih = h - m * 2;
  if (layout === 'comic') {
    const heroW = Math.round(iw * 0.6);
    const sideW = iw - heroW - g;
    const halfH = Math.round((ih - g) / 2);
    return [
      { x: m, y: m, w: heroW, h: ih },
      { x: m + heroW + g, y: m, w: sideW, h: halfH },
      { x: m + heroW + g, y: m + halfH + g, w: sideW, h: ih - halfH - g },
    ];
  }
  if (layout === 'triptych') {
    const colW = Math.floor((iw - g * 2) / 3);
    return [
      { x: m, y: m, w: colW, h: ih },
      { x: m + colW + g, y: m, w: colW, h: ih },
      { x: m + 2 * (colW + g), y: m, w: iw - 2 * (colW + g), h: ih },
    ];
  }
  if (layout === 'stack') {
    const heroH = Math.round(ih * 0.72);
    return [
      { x: m, y: m, w: iw, h: heroH },
      { x: m, y: m + heroH + g, w: iw, h: ih - heroH - g },
    ];
  }
  // poster: big hero on top, two panels in a strip below it.
  const heroH = Math.round(ih * 0.62);
  const stripH = ih - heroH - g;
  const halfW = Math.round((iw - g) / 2);
  return [
    { x: m, y: m, w: iw, h: heroH },
    { x: m, y: m + heroH + g, w: halfW, h: stripH },
    { x: m + halfW + g, y: m + heroH + g, w: iw - halfW - g, h: stripH },
  ];
}

/** Draws the whole cover onto the canvas at its own size. */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#12061d';
  ctx.fillRect(0, 0, w, h);
  const rects = panelRects(state.layout, w, h);
  rects.forEach((rect, i) => drawPanel(ctx, rect, state.photos[i] ?? null, state.grade, w));
  drawCaption(ctx, state, w, h);
}

/** One comic panel: photo (cover-fit, panned and zoomed), grade wash, vignette, double border. */
function drawPanel(ctx, rect, photo, grade, w) {
  const r = Math.max(2, Math.round(w * 0.004));
  ctx.save();
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, r);
  ctx.clip();
  if (photo && photo.img) {
    const img = photo.img;
    const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
    const s = base * (photo.zoom || 1);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    const limits = panLimits(photo, rect);
    const ox = clamp(photo.ox || 0, -limits.maxOx, limits.maxOx) * rect.w;
    const oy = clamp(photo.oy || 0, -limits.maxOy, limits.maxOy) * rect.h;
    ctx.filter = GRADE_FILTERS[grade] || GRADE_FILTERS.sunset;
    ctx.drawImage(img, rect.x + (rect.w - dw) / 2 + ox, rect.y + (rect.h - dh) / 2 + oy, dw, dh);
    ctx.filter = 'none';
  } else {
    const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    grad.addColorStop(0, '#3b1150');
    grad.addColorStop(1, '#a1176e');
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = `bold ${Math.max(14, Math.round(rect.w * 0.05))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
  }
  gradeWash(ctx, rect, grade);
  vignette(ctx, rect);
  ctx.restore();
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0a0512';
  ctx.lineWidth = Math.max(3, Math.round(w * 0.005));
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, r);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = Math.max(1, Math.round(w * 0.0016));
  roundRectPath(ctx, rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8, Math.max(1, r - 2));
  ctx.stroke();
  ctx.restore();
}

/** The Vice City colour grade: a translucent wash over the photo. */
function gradeWash(ctx, rect, grade) {
  let grad;
  if (grade === 'neon') {
    grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    grad.addColorStop(0, 'rgba(255, 0, 160, 0.22)');
    grad.addColorStop(0.5, 'rgba(255, 0, 160, 0)');
    grad.addColorStop(1, 'rgba(0, 220, 255, 0.22)');
  } else if (grade === 'beach') {
    grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    grad.addColorStop(0, 'rgba(255, 200, 90, 0.16)');
    grad.addColorStop(1, 'rgba(0, 180, 170, 0.18)');
  } else if (grade === 'noir') {
    grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    grad.addColorStop(0, 'rgba(24, 10, 48, 0.12)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.34)');
  } else {
    grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    grad.addColorStop(0, 'rgba(255, 70, 130, 0.10)');
    grad.addColorStop(0.55, 'rgba(255, 110, 60, 0.06)');
    grad.addColorStop(1, 'rgba(255, 140, 40, 0.24)');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

function vignette(ctx, rect) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const rad = Math.hypot(rect.w, rect.h) / 2;
  const g = ctx.createRadialGradient(cx, cy, rad * 0.45, cx, cy, rad);
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0.30)');
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/** The caption: gradient rule, huge Anton title with a black keyline, gold subtitle. */
function drawCaption(ctx, state, w, h) {
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim().toUpperCase();
  if (!title && !subtitle) return;
  const top = state.captionPos === 'top';
  const bandH = Math.round(h * 0.3);
  const scrim = ctx.createLinearGradient(0, top ? 0 : h - bandH, 0, top ? bandH : h);
  if (top) {
    scrim.addColorStop(0, 'rgba(8, 3, 16, 0.88)');
    scrim.addColorStop(1, 'rgba(8, 3, 16, 0)');
  } else {
    scrim.addColorStop(0, 'rgba(8, 3, 16, 0)');
    scrim.addColorStop(1, 'rgba(8, 3, 16, 0.88)');
  }
  ctx.fillStyle = scrim;
  ctx.fillRect(0, top ? 0 : h - bandH, w, bandH);

  const cx = w / 2;
  const gap = Math.round(h * 0.014);
  const subSize = Math.max(12, Math.round(w * 0.026));
  const ruleW = Math.round(w * 0.16);
  const ruleH = Math.max(3, Math.round(w * 0.004));

  let size = Math.round(w * 0.105 * (state.titleScale || 1));
  const fontFor = (s) => `${s}px Anton, 'Arial Narrow', sans-serif`;
  ctx.font = fontFor(size);
  ctx.letterSpacing = '1px';
  while (title && ctx.measureText(title).width > w * 0.9 && size > 16) {
    size -= 2;
    ctx.font = fontFor(size);
  }

  let titleY;
  let subY;
  let ruleY;
  if (top) {
    ruleY = Math.round(h * 0.035);
    titleY = ruleY + ruleH + gap + size;
    subY = titleY + subSize + gap;
  } else {
    titleY = h - Math.round(h * 0.075);
    subY = titleY + subSize + gap;
    ruleY = titleY - size - gap - ruleH;
  }

  const rule = ctx.createLinearGradient(cx - ruleW / 2, 0, cx + ruleW / 2, 0);
  rule.addColorStop(0, '#ff2e88');
  rule.addColorStop(0.5, '#ff7a18');
  rule.addColorStop(1, '#ffd23f');
  ctx.fillStyle = rule;
  ctx.fillRect(cx - ruleW / 2, ruleY, ruleW, ruleH);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  if (title) {
    ctx.font = fontFor(size);
    ctx.strokeStyle = '#0a0512';
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = Math.round(size * 0.12);
    ctx.shadowOffsetY = Math.round(size * 0.03);
    ctx.strokeText(title, cx, titleY);
    ctx.fillText(title, cx, titleY);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  if (subtitle) {
    ctx.font = `700 ${subSize}px system-ui, sans-serif`;
    ctx.letterSpacing = '4px';
    while (ctx.measureText(subtitle).width > w * 0.86 && subSize > 10) {
      ctx.font = `700 ${subSize - 1}px system-ui, sans-serif`;
    }
    ctx.strokeStyle = '#0a0512';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#ffd23f';
    ctx.strokeText(subtitle, cx, subY);
    ctx.fillText(subtitle, cx, subY);
    ctx.letterSpacing = '0px';
  }
}

/** Renders the current state at W x H on a fresh canvas (for export). */
export function renderOffscreen(state, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas, state);
  return canvas;
}
