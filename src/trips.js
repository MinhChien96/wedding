// Bản đồ hành trình (2D) + thư viện ảnh từng chuyến đi.
// Ảnh thật lấy từ TRIPS[i].photos; nếu trống thì vẽ ảnh minh hoạ demo bằng canvas.
import { VN_LAND, HOANG_SA, TRUONG_SA } from './vnmap.js';

const K = Math.cos((16 * Math.PI) / 180);
const S = 60;
const LON0 = 101.6;
const LAT0 = 23.9;
const W = (115.8 - LON0) * K * S;
const H = (LAT0 - 7.4) * S;
export const project = (lon, lat) => [(lon - LON0) * K * S, (LAT0 - lat) * S];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Khoảng cách theo đường chim bay (km)
export function haversine(a, b) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// ---------------- Ảnh demo vẽ bằng canvas ----------------
function rng(seed) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const PALETTES = [
  { sky: ['#9fd3ff', '#fff3dc'], sun: '#fff6c9', sea: ['#3fa7d6', '#1f6f9f'], hill: ['#7cc47f', '#3f8f5a'], light: 1 },
  { sky: ['#ff9a8b', '#ffd6a5'], sun: '#fff0c2', sea: ['#f08a7d', '#7a5c8e'], hill: ['#8e6f8f', '#5a4767'], light: 0.85 },
  { sky: ['#1d2b53', '#7b5ea7'], sun: '#fdf6d8', sea: ['#2b3f73', '#16224a'], hill: ['#2e3a5f', '#1c2442'], light: 0.55, night: true },
];

function demoPhoto(trip, idx) {
  const c = document.createElement('canvas');
  c.width = 960;
  c.height = 720;
  const g = c.getContext('2d');
  const R = rng(`${trip.id}-${idx}`);
  const pal = PALETTES[idx % PALETTES.length];
  const w = c.width;
  const h = c.height;
  const horizon = h * (0.5 + R() * 0.1);
  const lin = (y0, y1, a, b) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
  // Bầu trời
  g.fillStyle = lin(0, horizon, pal.sky[0], pal.sky[1]);
  g.fillRect(0, 0, w, h);
  if (pal.night) for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.7})`; g.fillRect(R() * w, R() * horizon * 0.8, 2, 2); }
  g.fillStyle = pal.sun;
  g.beginPath(); g.arc(w * (0.2 + R() * 0.6), horizon * (0.3 + R() * 0.3), pal.night ? 34 : 52, 0, Math.PI * 2); g.fill();
  // Mây
  g.fillStyle = pal.night ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 4; i++) { const cx = R() * w; const cy = R() * horizon * 0.5 + 40; for (let j = 0; j < 4; j++) { g.beginPath(); g.ellipse(cx + j * 38, cy + (j % 2) * 8, 46, 22, 0, 0, Math.PI * 2); g.fill(); } }
  const hills = (base, amp, col, n = 6) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, h); g.lineTo(0, base);
    for (let i = 0; i <= n; i++) g.quadraticCurveTo((i - 0.5) * w / n, base - amp * (0.5 + R()), i * w / n, base - amp * R() * 0.4);
    g.lineTo(w, h); g.fill();
  };
  const sea = (y) => { g.fillStyle = lin(y, h, pal.sea[0], pal.sea[1]); g.fillRect(0, y, w, h - y); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; for (let i = 0; i < 26; i++) { const yy = y + 10 + R() * (h - y); const xx = R() * w; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + 30 + R() * 50, yy); g.stroke(); } };
  const karst = (x, base, tw, th, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x - tw / 2, base); g.bezierCurveTo(x - tw / 2, base - th * 0.8, x - tw * 0.3, base - th, x, base - th); g.bezierCurveTo(x + tw * 0.35, base - th, x + tw / 2, base - th * 0.7, x + tw / 2, base); g.fill(); };
  const boat = (x, y, s = 1) => { g.fillStyle = '#6b3f22'; g.beginPath(); g.moveTo(x - 40 * s, y); g.lineTo(x + 40 * s, y); g.lineTo(x + 28 * s, y + 12 * s); g.lineTo(x - 28 * s, y + 12 * s); g.fill(); g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(x, y - 50 * s); g.lineTo(x + 26 * s, y - 6 * s); g.lineTo(x, y - 6 * s); g.fill(); g.fillRect(x - 2 * s, y - 50 * s, 3 * s, 50 * s); };
  const palm = (x, y, s = 1) => { g.strokeStyle = '#6d4c2f'; g.lineWidth = 10 * s; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 20 * s, y - 90 * s, x + 6 * s, y - 170 * s); g.stroke(); g.fillStyle = pal.night ? '#24402f' : '#2f8f4e'; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.55; g.beginPath(); g.ellipse(x + 6 * s + Math.cos(a) * 50 * s, y - 170 * s + Math.sin(a) * 26 * s, 60 * s, 12 * s, a, 0, Math.PI * 2); g.fill(); } };
  const windows = (x, y, bw, bh) => { for (let yy = y + 10; yy < y + bh - 10; yy += 18) for (let xx = x + 8; xx < x + bw - 8; xx += 14) { g.fillStyle = pal.night ? (R() < 0.6 ? '#ffd86b' : '#2a2f4f') : 'rgba(255,255,255,0.35)'; g.fillRect(xx, yy, 7, 10); } };

  switch (trip.scene) {
    case 'mountain': {
      hills(horizon - 40, 120, pal.night ? '#3a4466' : '#a7c9b4', 5);
      hills(horizon + 10, 90, pal.hill[0], 6);
      // Đồi chè xếp tầng
      g.strokeStyle = 'rgba(30,90,50,0.45)'; g.lineWidth = 6;
      for (let y = horizon + 60; y < h; y += 26) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 60) g.quadraticCurveTo(x + 30, y - 14, x + 60, y); g.stroke(); }
      hills(h - 60, 60, pal.hill[1], 4);
      g.fillStyle = pal.night ? 'rgba(200,210,255,0.08)' : 'rgba(255,255,255,0.35)'; g.fillRect(0, horizon - 20, w, 40);
      break;
    }
    case 'bay': {
      sea(horizon);
      for (let i = 0; i < 9; i++) karst(R() * w, horizon + 30 + R() * 140, 60 + R() * 90, 120 + R() * 200, i < 4 ? (pal.night ? '#2a3557' : '#7fa79a') : (pal.night ? '#1d2742' : '#4f7d6c'));
      boat(w * 0.65, h - 120, 1.2);
      break;
    }
    case 'karst': {
      for (let i = 0; i < 7; i++) karst(R() * w, horizon + 40, 90 + R() * 120, 160 + R() * 220, pal.night ? '#25304f' : '#5f8f6f');
      g.fillStyle = pal.night ? '#24402f' : '#9ccc65'; g.fillRect(0, horizon + 40, w, h);
      g.fillStyle = lin(horizon + 120, h, pal.sea[0], pal.sea[1]);
      g.beginPath(); g.moveTo(0, h - 160); g.quadraticCurveTo(w * 0.5, horizon + 90, w, h - 220); g.lineTo(w, h - 120); g.quadraticCurveTo(w * 0.5, horizon + 180, 0, h - 40); g.fill();
      boat(w * 0.45, h - 210, 0.9);
      break;
    }
    case 'city': {
      for (let i = 0; i < 18; i++) { const bw = 40 + R() * 70; const bh = 80 + R() * 280; const x = (i / 18) * w + R() * 20; g.fillStyle = pal.night ? '#283358' : (i % 2 ? '#9fb3c8' : '#b8c7d6'); g.fillRect(x, horizon + 40 - bh, bw, bh); windows(x, horizon + 40 - bh, bw, bh); }
      sea(horizon + 40);
      // Cầu
      g.strokeStyle = pal.night ? '#ffd86b' : '#e9b44c'; g.lineWidth = 8; g.beginPath(); g.moveTo(0, horizon + 110); for (let x = 0; x <= w; x += 120) g.quadraticCurveTo(x + 60, horizon + 70, x + 120, horizon + 110); g.stroke();
      g.fillStyle = pal.night ? '#ffd86b' : '#6b5b4f'; g.fillRect(0, horizon + 108, w, 8);
      break;
    }
    case 'cave': {
      g.fillStyle = '#1b1612'; g.fillRect(0, 0, w, h);
      g.fillStyle = lin(0, h, '#ffe8a3', '#4ea8c9');
      g.beginPath(); g.ellipse(w / 2, h * 0.62, w * 0.36, h * 0.45, 0, Math.PI, 0); g.fill();
      g.fillStyle = 'rgba(255,240,200,0.18)'; g.beginPath(); g.moveTo(w * 0.5, 0); g.lineTo(w * 0.3, h); g.lineTo(w * 0.7, h); g.fill();
      g.fillStyle = '#2a211b'; for (let i = 0; i < 24; i++) { const x = R() * w; const l = 40 + R() * 140; g.beginPath(); g.moveTo(x - 12, 0); g.lineTo(x + 12, 0); g.lineTo(x, l); g.fill(); }
      g.fillStyle = lin(h * 0.62, h, '#2e7ea3', '#0f3b52'); g.fillRect(0, h * 0.62, w, h);
      boat(w * 0.5, h * 0.7, 1);
      break;
    }
    case 'citadel': {
      g.fillStyle = pal.night ? '#2c3a2a' : '#8bc28c'; g.fillRect(0, horizon + 60, w, h);
      g.fillStyle = '#b23a2b'; g.fillRect(w * 0.2, horizon - 60, w * 0.6, 120);
      g.fillStyle = '#d8a13a'; for (let i = 0; i < 3; i++) { const x = w * (0.28 + i * 0.22); g.fillRect(x - 40, horizon - 150, 80, 90); g.beginPath(); g.moveTo(x - 70, horizon - 150); g.lineTo(x, horizon - 200); g.lineTo(x + 70, horizon - 150); g.fill(); }
      g.fillStyle = '#5a2a1f'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(w * (0.33 + i * 0.17), horizon + 60, 26, Math.PI, 0); g.fill(); }
      g.fillStyle = lin(horizon + 120, h, pal.sea[0], pal.sea[1]); g.fillRect(0, horizon + 140, w, h);
      g.fillStyle = '#4caf50'; for (let i = 0; i < 26; i++) { g.beginPath(); g.ellipse(R() * w, horizon + 160 + R() * (h - horizon - 170), 22, 9, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#ff8fab'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(R() * w, horizon + 170 + R() * (h - horizon - 190), 8, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'ancient': {
      for (let i = 0; i < 7; i++) { const bw = 110 + R() * 40; const x = i * w / 6.4; const bh = 150 + R() * 60; g.fillStyle = pal.night ? '#8a7140' : '#f2c14e'; g.fillRect(x, horizon + 80 - bh, bw, bh); g.fillStyle = '#7b3f2a'; g.beginPath(); g.moveTo(x - 12, horizon + 80 - bh); g.lineTo(x + bw / 2, horizon + 40 - bh); g.lineTo(x + bw + 12, horizon + 80 - bh); g.fill(); g.fillStyle = '#4a2e22'; g.fillRect(x + bw * 0.35, horizon + 20, bw * 0.3, 60); }
      g.fillStyle = lin(horizon + 80, h, pal.sea[0], pal.sea[1]); g.fillRect(0, horizon + 80, w, h);
      const cols = ['#ff4d4d', '#ffb703', '#fb5607', '#ff006e', '#8338ec'];
      for (let row = 0; row < 2; row++) { const y0 = 60 + row * 70; g.strokeStyle = 'rgba(60,40,30,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y0); g.quadraticCurveTo(w / 2, y0 + 50, w, y0); g.stroke(); for (let i = 1; i < 12; i++) { const x = (i / 12) * w; const t = i / 12; const y = y0 + 4 * 50 * t * (1 - t) * 0.5 + 24; g.fillStyle = cols[(i + row) % cols.length]; g.beginPath(); g.ellipse(x, y, 16, 22, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,240,180,0.35)'; g.beginPath(); g.ellipse(x, y, 30, 34, 0, 0, Math.PI * 2); g.fill(); } }
      for (let i = 0; i < 12; i++) { g.fillStyle = cols[i % 5]; g.globalAlpha = 0.6; g.beginPath(); g.arc(R() * w, horizon + 110 + R() * (h - horizon - 120), 6, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
      break;
    }
    case 'island': {
      sea(horizon);
      g.fillStyle = pal.night ? '#24402f' : '#5aa469';
      g.beginPath(); g.moveTo(w * 0.15, horizon + 20); g.quadraticCurveTo(w * 0.3, horizon - 170, w * 0.5, horizon - 120); g.quadraticCurveTo(w * 0.65, horizon - 210, w * 0.85, horizon + 20); g.fill();
      g.fillStyle = '#c9a26b'; g.fillRect(w * 0.15, horizon + 10, w * 0.7, 18);
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(0, horizon + 140, w, 4);
      g.fillStyle = '#7fd1c7'; g.globalAlpha = 0.5; g.fillRect(0, h - 140, w, 140); g.globalAlpha = 1;
      break;
    }
    case 'dunes': {
      for (let i = 0; i < 3; i++) { g.fillStyle = ['#f4c27a', '#e9a35b', '#d98944'][i]; g.beginPath(); g.moveTo(0, h); g.lineTo(0, horizon + i * 70); g.bezierCurveTo(w * 0.3, horizon - 80 + i * 60, w * 0.6, horizon + 80 + i * 50, w, horizon - 20 + i * 70); g.lineTo(w, h); g.fill(); }
      g.strokeStyle = 'rgba(120,70,30,0.25)'; g.lineWidth = 3; for (let i = 0; i < 18; i++) { const y = horizon + 80 + R() * (h - horizon - 90); g.beginPath(); g.moveTo(R() * w, y); g.quadraticCurveTo(R() * w, y - 10, R() * w, y + 6); g.stroke(); }
      g.fillStyle = '#5b3b26'; g.beginPath(); g.arc(w * 0.55, horizon + 60, 6, 0, Math.PI * 2); g.arc(w * 0.57, horizon + 62, 6, 0, Math.PI * 2); g.fill();
      break;
    }
    default: { // beach
      sea(horizon);
      g.fillStyle = lin(h - 220, h, '#f6dcae', '#e8c28a');
      g.beginPath(); g.moveTo(0, h - 160); g.quadraticCurveTo(w * 0.5, h - 260, w, h - 200); g.lineTo(w, h); g.lineTo(0, h); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, h - 170); g.quadraticCurveTo(w * 0.5, h - 268, w, h - 210); g.stroke();
      palm(w * 0.12, h - 110, 1.1);
      palm(w * 0.88, h - 150, 0.9);
      if (R() < 0.6) boat(w * 0.55, horizon + 70, 0.7);
    }
  }
  // Lớp chữ "ảnh demo"
  g.fillStyle = lin(h - 150, h, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.55)');
  g.fillRect(0, h - 150, w, 150);
  g.fillStyle = '#fff';
  g.font = '700 46px "Be Vietnam Pro", system-ui, sans-serif';
  g.fillText(trip.name, 34, h - 52);
  g.font = '500 24px "Be Vietnam Pro", system-ui, sans-serif';
  g.fillText(`Ảnh minh hoạ ${idx + 1}/3 · sẽ thay bằng ảnh thật`, 36, h - 18);
  return c.toDataURL('image/jpeg', 0.85);
}

const demoCache = new Map();
export function tripPhotos(trip) {
  if (trip.photos?.length) return trip.photos;
  if (!demoCache.has(trip.id)) demoCache.set(trip.id, [0, 1, 2].map((i) => demoPhoto(trip, i)));
  return demoCache.get(trip.id);
}

// ---------------- Bản đồ 2D ----------------
export function initTripMap({ trips, couple, openModal, sfx, onOpenTrip }) {
  const pathD = VN_LAND.map((ring) => `M${ring.map(([lo, la]) => project(lo, la).map((v) => v.toFixed(1)).join(',')).join('L')}Z`).join('');
  const route = trips.map((t) => project(t.lon, t.lat));
  let km = 0;
  for (let i = 1; i < trips.length; i++) km += haversine(trips[i - 1], trips[i]);
  const islandDots = (list) => list.map(([lo, la]) => { const [x, y] = project(lo, la); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2"/>`; }).join('');
  const center = (list) => { const p = list.map(([lo, la]) => project(lo, la)); return [p.reduce((a, b) => a + b[0], 0) / p.length, p.reduce((a, b) => a + b[1], 0) / p.length]; };
  const [hsx, hsy] = center(HOANG_SA);
  const [tsx, tsy] = center(TRUONG_SA);
  const [bdx, bdy] = project(111.2, 13.2);

  const modal = document.createElement('div');
  modal.id = 'tripModal';
  modal.className = 'modal hidden';
  modal.innerHTML = `
    <div class="card trip-card">
      <div class="trip-head">
        <div><h2>📍 Hành trình của ${esc(couple)}</h2><p class="muted">${trips.length} điểm đến · khoảng ${Math.round(km / 10) * 10} km · chạm vào trái tim để xem ảnh</p></div>
        <button class="ghost x" data-close aria-label="Đóng">✕</button>
      </div>
      <div class="trip-map">
        <svg id="tripSvg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="tSea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9f1ff"/><stop offset="1" stop-color="#b9e2f7"/></linearGradient>
            <linearGradient id="tLand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8ef"/><stop offset="1" stop-color="#ffeef2"/></linearGradient>
            <path id="tHeart" d="M0,6 C-9,-2 -9,-11 -3,-11 C0,-11 0,-8 0,-7 C0,-8 0,-11 3,-11 C9,-11 9,-2 0,6Z"/>
          </defs>
          <rect x="-2000" y="-2000" width="${W + 4000}" height="${H + 4000}" fill="url(#tSea)"/>
          <path d="${pathD}" fill="url(#tLand)" stroke="#e7a9b9" stroke-width="2" stroke-linejoin="round"/>
          <g class="isl">${islandDots(HOANG_SA)}${islandDots(TRUONG_SA)}</g>
          <text class="isl-t" x="${hsx.toFixed(0)}" y="${(hsy - 28).toFixed(0)}">Quần đảo Hoàng Sa</text>
          <text class="isl-t sub" x="${hsx.toFixed(0)}" y="${(hsy - 10).toFixed(0)}">(Việt Nam)</text>
          <text class="isl-t" x="${tsx.toFixed(0)}" y="${(tsy - 74).toFixed(0)}">Quần đảo Trường Sa</text>
          <text class="isl-t sub" x="${tsx.toFixed(0)}" y="${(tsy - 56).toFixed(0)}">(Việt Nam)</text>
          <text class="sea-t" x="${bdx.toFixed(0)}" y="${bdy.toFixed(0)}">BIỂN ĐÔNG</text>
          <polyline class="route" points="${route.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}"/>
          <g id="tripPins">${trips.map((t, i) => {
            const [x, y] = project(t.lon, t.lat);
            const anchor = t.lx < 0 ? 'end' : t.lx > 0 ? 'start' : 'middle';
            const tx = (t.lx || 0) * 14;
            const ty = (t.ly || 0) * 14 + 5;
            return `<g class="pin" data-trip="${i}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><g class="pin-s"><circle r="16" class="hit"/><use href="#tHeart" class="heart" transform="translate(0,2) scale(1.25)"/><text x="${tx}" y="${ty}" text-anchor="${anchor}">${esc(t.name)}</text></g></g>`;
          }).join('')}</g>
        </svg>
        <div class="zoom-ctl"><button data-z="1" aria-label="Phóng to">+</button><button data-z="-1" aria-label="Thu nhỏ">−</button><button data-z="0" aria-label="Xem toàn bộ">⤢</button></div>
      </div>
      <div class="trip-chips">${trips.map((t, i) => `<button data-trip="${i}">${esc(t.name)}</button>`).join('')}</div>
    </div>`;
  document.body.append(modal);

  // ----- Thư viện ảnh -----
  const gal = document.createElement('div');
  gal.id = 'tripGallery';
  gal.className = 'gallery hidden';
  gal.innerHTML = `
    <div class="g-top"><div><b id="gName"></b><small id="gWhen"></small></div><button class="g-x" aria-label="Đóng">✕</button></div>
    <div class="g-stage"><button class="g-nav prev" aria-label="Ảnh trước">‹</button><img id="gImg" alt=""/><button class="g-nav next" aria-label="Ảnh sau">›</button></div>
    <div class="g-dots" id="gDots"></div>
    <p class="g-story" id="gStory"></p>
    <div class="g-trips"><button class="ghost" data-step="-1">‹ Nơi trước</button><button class="ghost" data-step="1">Nơi tiếp theo ›</button></div>`;
  document.body.append(gal);
  const gs = { trip: 0, img: 0, photos: [] };
  const showImg = () => {
    const img = gal.querySelector('#gImg');
    img.classList.remove('in');
    void img.offsetWidth;
    img.src = gs.photos[gs.img];
    img.classList.add('in');
    gal.querySelector('#gDots').innerHTML = gs.photos.map((_, i) => `<i class="${i === gs.img ? 'on' : ''}"></i>`).join('');
  };
  function openTrip(i) {
    const t = trips[i];
    gs.trip = i;
    gs.img = 0;
    gs.photos = tripPhotos(t);
    gal.querySelector('#gName').textContent = `📍 ${t.name}`;
    gal.querySelector('#gWhen').textContent = t.when ? ` · ${t.when}` : '';
    const story = gal.querySelector('#gStory');
    story.textContent = t.story || '';
    story.classList.toggle('hidden', !t.story);
    showImg();
    gal.classList.remove('hidden');
    sfx?.('pop');
    onOpenTrip?.(t);
    modal.querySelectorAll('.pin').forEach((p) => p.classList.toggle('active', +p.dataset.trip === i));
  }
  const step = (d) => { gs.img = (gs.img + d + gs.photos.length) % gs.photos.length; showImg(); };
  gal.querySelector('.prev').addEventListener('click', () => step(-1));
  gal.querySelector('.next').addEventListener('click', () => step(1));
  gal.querySelector('.g-x').addEventListener('click', () => gal.classList.add('hidden'));
  gal.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => openTrip((gs.trip + +b.dataset.step + trips.length) % trips.length)));
  // Vuốt trái/phải để chuyển ảnh
  let sx = null;
  const stage = gal.querySelector('.g-stage');
  stage.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  stage.addEventListener('pointerup', (e) => { if (sx !== null && Math.abs(e.clientX - sx) > 40) step(e.clientX < sx ? 1 : -1); sx = null; });
  addEventListener('keydown', (e) => {
    if (gal.classList.contains('hidden')) return;
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'Escape') gal.classList.add('hidden');
  });

  // ----- Kéo / phóng to bản đồ -----
  const svg = modal.querySelector('#tripSvg');
  const full = { x: 0, y: 0, w: W, h: H };
  let vb = { ...full };
  const apply = () => {
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    // Giữ ghim và chữ cùng kích thước trên màn hình khi phóng to
    const k = Math.max(0.25, vb.w / W);
    svg.style.setProperty('--k', k);
    modal.querySelectorAll('.pin-s').forEach((p) => p.setAttribute('transform', `scale(${k})`));
  };
  const zoomAt = (f, cx, cy) => {
    const nw = Math.min(full.w * 1.05, Math.max(full.w / 7, vb.w / f));
    const nh = nw * (vb.h / vb.w);
    vb = { x: cx - (cx - vb.x) * (nw / vb.w), y: cy - (cy - vb.y) * (nh / vb.h), w: nw, h: nh };
    apply();
  };
  const toSvg = (clientX, clientY) => {
    const r = svg.getBoundingClientRect();
    // preserveAspectRatio meet: tính tỉ lệ thực tế
    const s = Math.max(vb.w / r.width, vb.h / r.height);
    const ox = (r.width * s - vb.w) / 2;
    const oy = (r.height * s - vb.h) / 2;
    return [vb.x - ox + (clientX - r.left) * s, vb.y - oy + (clientY - r.top) * s, s];
  };
  const ptrs = new Map();
  let pinch = null;
  let moved = 0;
  svg.addEventListener('pointerdown', (e) => {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  });
  addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const [, , s] = toSvg(e.clientX, e.clientY);
    if (ptrs.size === 1) {
      vb.x -= (e.clientX - p.x) * s;
      vb.y -= (e.clientY - p.y) * s;
      moved += Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y);
      apply();
    }
    p.x = e.clientX;
    p.y = e.clientY;
    if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const [cx, cy] = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomAt(d / pinch.d, cx, cy);
      pinch.d = d;
      moved += 20;
    }
  });
  const up = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (moved < 8 && ptrs.size === 0) {
      const pin = e.target.closest?.('[data-trip]');
      if (pin) openTrip(+pin.dataset.trip);
    }
  };
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
  svg.addEventListener('wheel', (e) => { e.preventDefault(); const [cx, cy] = toSvg(e.clientX, e.clientY); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, cx, cy); }, { passive: false });
  modal.querySelector('.zoom-ctl').addEventListener('click', (e) => {
    const b = e.target.closest('[data-z]');
    if (!b) return;
    const z = +b.dataset.z;
    if (!z) { vb = { ...full }; apply(); return; }
    zoomAt(z > 0 ? 1.5 : 1 / 1.5, vb.x + vb.w / 2, vb.y + vb.h / 2);
  });
  modal.querySelector('.trip-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-trip]');
    if (!b) return;
    const i = +b.dataset.trip;
    const [x, y] = project(trips[i].lon, trips[i].lat);
    vb = { w: full.w / 3, h: full.h / 3, x: x - full.w / 6, y: y - full.h / 6 };
    apply();
    openTrip(i);
  });
  apply();

  return {
    open(i = null) {
      openModal('#tripModal');
      if (i !== null) openTrip(i);
    },
    openTrip,
  };
}
