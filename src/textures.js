import * as THREE from 'three';

export const FONT = '"Be Vietnam Pro", system-ui, "Segoe UI", sans-serif';
export const SCRIPT = '"Great Vibes", "Segoe Script", cursive';

export function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw?.(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.userData = { canvas, ctx };
  return tex;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawHeart(ctx, cx, cy, size, color) {
  const s = size / 2;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.4, cy - s * 0.1, cx - s * 0.8, cy - s * 1.25, cx, cy - s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.8, cy - s * 1.25, cx + s * 1.4, cy - s * 0.1, cx, cy + s * 0.9);
  ctx.fill();
  ctx.restore();
}

export function wrapText(ctx, text, maxW, maxLines = 4) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxW) { line = test; continue; }
    if (line) lines.push(line);
    line = word;
    while (ctx.measureText(line).width > maxW) {
      let i = line.length;
      while (i > 1 && ctx.measureText(line.slice(0, i)).width > maxW) i--;
      lines.push(line.slice(0, i));
      line = line.slice(i);
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, '…');
  }
  return lines;
}

function spriteFrom(tex, height) {
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  const { width, height: h } = tex.userData.canvas;
  sprite.scale.set((width / h) * height, height, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export function makeLabel(name, sub = '', accent = '#ff6f91') {
  const tex = canvasTexture(512, 132, (ctx, w, h) => {
    ctx.font = `700 46px ${FONT}`;
    const nameW = ctx.measureText(name).width;
    ctx.font = `500 28px ${FONT}`;
    const subW = sub ? ctx.measureText(sub).width : 0;
    const bw = Math.min(w - 8, Math.max(nameW, subW) + 56);
    const x = (w - bw) / 2;
    ctx.fillStyle = 'rgba(30, 16, 36, 0.62)';
    roundRect(ctx, x, 4, bw, sub ? 120 : 70, 30);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(x + 24, 14, 6, sub ? 100 : 50);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = `700 46px ${FONT}`;
    ctx.fillText(name, w / 2 + 6, 56, bw - 50);
    if (sub) {
      ctx.fillStyle = '#ffd1dc';
      ctx.font = `500 28px ${FONT}`;
      ctx.fillText(sub, w / 2 + 6, 102, bw - 50);
    }
  });
  return spriteFrom(tex, 0.5);
}

export function makeBubble(text) {
  const font = `600 34px ${FONT}`;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const lines = wrapText(probe, text, 520, 4);
  const textW = Math.max(...lines.map((l) => probe.measureText(l).width));
  const w = Math.ceil(textW + 60);
  const h = lines.length * 44 + 56;
  const tex = canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    roundRect(ctx, 4, 4, w - 8, h - 30, 22);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w / 2 - 14, h - 27);
    ctx.lineTo(w / 2, h - 4);
    ctx.lineTo(w / 2 + 14, h - 27);
    ctx.fill();
    ctx.fillStyle = '#3a2340';
    ctx.font = font;
    ctx.textAlign = 'center';
    lines.forEach((l, i) => ctx.fillText(l, w / 2, 48 + i * 44));
  });
  const sprite = spriteFrom(tex, (h / 132) * 0.55);
  sprite.center.set(0.5, 0);
  return sprite;
}
