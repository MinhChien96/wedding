// Album ảnh cưới dùng chung cho thiệp và tiệc 3D.
// Ảnh thật nằm trong src/album.json (tạo bằng `npm run album -- <thư-mục-ảnh>`), trống thì vẽ ảnh mẫu bằng canvas.
import RAW from './album.json';
import { WEDDING, INVITE } from './config.js';

const SHAPES = [[4, 5], [3, 2], [3, 4], [4, 5], [3, 2], [2, 3], [4, 5], [3, 2], [3, 4], [4, 5], [3, 2], [2, 3]];
const CAPTIONS = ['Ngày chung đôi', 'Hoàng hôn trên biển', 'Cánh đồng hoa', 'Nụ hôn đầu tiên', 'Dạo phố cổ', 'Bó hoa cưới',
  'Dưới tán cây', 'Đồi cỏ lộng gió', 'Mãi bên nhau', 'Tay trong tay', 'Chiều thu Hà Nội', 'Ánh đèn đêm'];
const PALETTES = [
  { sky: ['#f6c28b', '#f49b8a', '#b9799b'], sun: '#fff1c9', ground: ['#5b3c4f', '#2e2033'] },
  { sky: ['#8fb8de', '#f3c6d3', '#ffe3c2'], sun: '#fffaf0', ground: ['#e9cfa5', '#c8a77d'], sea: '#7fa9c9' },
  { sky: ['#ffe2ec', '#ffc8d8', '#f6a6bf'], sun: '#ffffff', ground: ['#c35b84', '#7a3355'], flowers: true },
  { sky: ['#2b2350', '#7b4f8e', '#f08fa4'], sun: '#ffd8b0', ground: ['#2b1d38', '#150f20'] },
];

function rng(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Bóng cô dâu chú rể ngược sáng. x: giữa hai người, y: mặt đất, s: chiều cao người (px)
// Toạ độ trong hàm vẽ: đơn vị = 1% chiều cao, y tính từ mặt đất lên.
const GROOM = [[2.6, 84], [8.5, 82], [10.8, 78.5], [11.4, 66], [11.2, 52], [10, 48], [8.4, 51], [7.9, 66], [7.2, 52], [6.7, 27], [6.1, 2.5], [8.6, 0], [1.3, 0], [1.1, 45]];
function couple(g, x, y, s, facing, ink) {
  const u = s / 100;
  g.fillStyle = ink;
  g.lineJoin = 'round';
  const P = (cx, px, py) => [cx + px * u, y - py * u];
  const poly = (cx, pts) => {
    g.beginPath();
    const all = [...pts, ...pts.slice().reverse().map(([px, py]) => [-px, py])];
    all.forEach(([px, py], i) => (i ? g.lineTo : g.moveTo).call(g, ...P(cx, px, py)));
    g.closePath(); g.fill();
  };
  const ell = (cx, px, py, rx, ry) => { g.beginPath(); g.ellipse(...P(cx, px, py), rx * u, ry * u, 0, 0, Math.PI * 2); g.fill(); };
  const groom = (cx) => {
    poly(cx, GROOM);
    g.fillRect(cx - 2.4 * u, y - 87 * u, 4.8 * u, 4 * u);
    ell(cx, 0, 91.5, 5.9, 7.3);
    // Tóc vuốt lên
    g.beginPath(); g.ellipse(...P(cx, 0.4, 95.5), 6.4 * u, 4.6 * u, -0.12, Math.PI * 0.95, Math.PI * 2.05); g.fill();
  };
  const bride = (cx) => {
    // Voan mỏng phía sau
    g.save(); g.globalAlpha = 0.42;
    g.beginPath(); g.moveTo(...P(cx, 1, 97));
    g.bezierCurveTo(...P(cx, 14, 84), ...P(cx, 19, 40), ...P(cx, 27, 2));
    g.lineTo(...P(cx, 9, 2)); g.bezierCurveTo(...P(cx, 12, 40), ...P(cx, 8, 80), ...P(cx, 1, 97));
    g.fill(); g.restore();
    // Váy xoè từ eo
    g.beginPath(); g.moveTo(...P(cx, -4.6, 62)); g.lineTo(...P(cx, 4.6, 62));
    g.bezierCurveTo(...P(cx, 9, 46), ...P(cx, 19, 18), ...P(cx, 25, 0));
    g.lineTo(...P(cx, -23, 0));
    g.bezierCurveTo(...P(cx, -18, 18), ...P(cx, -9, 46), ...P(cx, -4.6, 62));
    g.fill();
    // Thân áo, vai hẹp
    poly(cx, [[2.2, 83], [6.6, 80.5], [7.6, 77], [5.2, 66], [4.4, 61]]);
    // Hai tay ôm bó hoa trước bụng
    g.lineWidth = 2.6 * u; g.strokeStyle = ink; g.lineCap = 'round';
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(...P(cx, sd * 7, 77)); g.quadraticCurveTo(...P(cx, sd * 9, 64), ...P(cx, sd * 2, 61)); g.stroke(); }
    ell(cx, 0, 60, 5.4, 4.6);
    g.fillRect(cx - 2 * u, y - 86 * u, 4 * u, 4 * u);
    ell(cx, 0, 90.5, 5.4, 6.8);
    ell(cx, 1.5, 97, 4.3, 3.6); // búi tóc
  };
  // Hai người hơi nghiêng vào nhau quanh điểm chân
  const lean = (cx, a, draw) => { g.save(); g.translate(cx, y); g.rotate(a); g.translate(-cx, -y); draw(cx); g.restore(); };
  if (facing) {
    lean(x - 14 * u, 0.075, groom);
    lean(x + 14 * u, -0.075, bride);
  } else {
    lean(x - 10 * u, 0.02, groom);
    lean(x + 11 * u, -0.02, bride);
    // Nắm tay
    g.lineWidth = 2.8 * u; g.strokeStyle = ink; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 0.5 * u, y - 50 * u); g.quadraticCurveTo(x + 2 * u, y - 47 * u, x + 4 * u, y - 62 * u); g.stroke();
  }
}

function heart(g, x, y, r) {
  g.beginPath();
  g.moveTo(x, y + r * 0.9);
  g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.3, x, y - r * 0.4);
  g.bezierCurveTo(x + r * 0.6, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  g.fill();
}

function drawDemo(i, long, aw, ah, asCanvas = false) {
  const c = document.createElement('canvas');
  const k = long / Math.max(aw, ah);
  const w = (c.width = Math.round(aw * k));
  const h = (c.height = Math.round(ah * k));
  const g = c.getContext('2d');
  const R = rng(i + 7);
  const pal = PALETTES[i % PALETTES.length];
  const m = Math.min(w, h);
  const horizon = h * (0.62 + R() * 0.1);
  const lin = (y0, y1, stops) => { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach((s, j) => gr.addColorStop(j / (stops.length - 1), s)); return gr; };
  g.fillStyle = lin(0, horizon, pal.sky);
  g.fillRect(0, 0, w, h);
  // Mặt trời toả sáng
  const sx = w * (0.3 + R() * 0.4);
  const sy = horizon - m * (0.08 + R() * 0.12);
  const glow = g.createRadialGradient(sx, sy, 0, sx, sy, m * 0.55);
  glow.addColorStop(0, pal.sun); glow.addColorStop(0.12, `${pal.sun}cc`); glow.addColorStop(1, `${pal.sun}00`);
  g.fillStyle = glow; g.fillRect(0, 0, w, h);
  // Bokeh
  for (let j = 0; j < 26; j++) {
    const r = m * (0.01 + R() * 0.04);
    g.fillStyle = `rgba(255,255,255,${0.06 + R() * 0.16})`;
    g.beginPath(); g.arc(R() * w, R() * horizon, r, 0, Math.PI * 2); g.fill();
  }
  // Mặt đất / biển
  if (pal.sea) {
    g.fillStyle = lin(horizon, horizon + h * 0.12, [pal.sea, '#cfe0ea']);
    g.fillRect(0, horizon, w, h * 0.12);
  }
  const gy = pal.sea ? horizon + h * 0.1 : horizon;
  g.fillStyle = lin(gy, h, pal.ground);
  g.beginPath(); g.moveTo(0, gy + m * 0.03);
  g.quadraticCurveTo(w * 0.5, gy - m * 0.05, w, gy + m * 0.02); g.lineTo(w, h); g.lineTo(0, h); g.fill();
  if (pal.flowers) {
    for (let j = 0; j < 160; j++) {
      const yy = gy + R() ** 0.7 * (h - gy);
      g.fillStyle = ['#ffd1dc', '#fff', '#ff9fb7', '#ffe9a8'][j % 4];
      g.globalAlpha = 0.5 + R() * 0.5;
      g.beginPath(); g.arc(R() * w, yy, m * 0.004 * (1 + (yy - gy) / (h - gy) * 3), 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }
  // Cô dâu chú rể
  const ink = 'rgba(38,24,40,0.92)';
  couple(g, w * (0.42 + R() * 0.16), gy + m * 0.05, Math.min(h * (0.34 + R() * 0.08), w * 0.62), i % 3 === 0, ink);
  // Vài trái tim bay
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (let j = 0; j < 4; j++) heart(g, w * (0.2 + R() * 0.6), h * (0.12 + R() * 0.3), m * (0.012 + R() * 0.018));
  // Viền mờ góc (vignette)
  const vg = g.createRadialGradient(w / 2, h / 2, m * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,10,30,0.35)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
  g.font = `600 ${Math.round(m * 0.03)}px "Be Vietnam Pro", sans-serif`;
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.textAlign = 'right';
  g.fillText(`Ảnh mẫu · ${WEDDING.groom} & ${WEDDING.bride}`, w - m * 0.04, h - m * 0.04);
  return asCanvas ? c : c.toDataURL('image/jpeg', 0.86);
}

function demoItem(i) {
  const [w, h] = SHAPES[i % SHAPES.length];
  const cache = {};
  return {
    w, h, caption: CAPTIONS[i % CAPTIONS.length], demo: true,
    get thumb() { return (cache.t ||= drawDemo(i, 560, w, h)); },
    get src() { return (cache.f ||= drawDemo(i, 1400, w, h)); },
    // Cho texture 3D: dùng thẳng canvas, khỏi giải mã lại ảnh
    canvas: () => (cache.c ||= drawDemo(i, 640, w, h, true)),
  };
}

export const ALBUM_DEMO = !RAW.length;
export const PHOTOS = ALBUM_DEMO ? SHAPES.map((_, i) => demoItem(i)) : RAW.map((p) => ({ ...p, thumb: p.thumb || p.src }));
// Ảnh bìa mẫu vẽ riêng khổ dọc cho vừa màn hình điện thoại
let demoCover = '';
export const coverSrc = () => INVITE.cover || (ALBUM_DEMO ? (demoCover ||= drawDemo(1, 1400, 9, 16)) : PHOTOS[0]?.src) || '';
