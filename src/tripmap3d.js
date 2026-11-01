// "Góc kỷ niệm": bức tường lớn vẽ bản đồ Việt Nam, mỗi nơi hai bạn từng đến là một trái tim nổi trên tường.
import * as THREE from 'three';
import { VN_LAND, HOANG_SA, TRUONG_SA } from './vnmap.js';
import { canvasTexture, drawHeart, FONT, SCRIPT } from './textures.js';
import { haversine } from './trips.js';

const K = Math.cos((16 * Math.PI) / 180);

export function buildTripWall({ scene, venue, trips, couple, x = 27, z = 40.3, width = 13, height = 8.2 }) {
  const root = new THREE.Group();
  scene.add(root);
  const PX = 2048;
  const PY = Math.round((PX * height) / width);
  const ppm = PX / width;

  // Vùng bản đồ (bên trái tường) tính bằng pixel trên texture
  const MAP = { x: 70, y: 70, w: PX * 0.53, h: PY - 140 };
  const LON_MIN = 101.6;
  const LON_MAX = 115.9;
  const LAT_MAX = 23.8;
  const LAT_MIN = 7.4;
  const sc = Math.min(MAP.w / ((LON_MAX - LON_MIN) * K), MAP.h / (LAT_MAX - LAT_MIN));
  const offX = MAP.x + (MAP.w - (LON_MAX - LON_MIN) * K * sc) / 2;
  const offY = MAP.y + (MAP.h - (LAT_MAX - LAT_MIN) * sc) / 2;
  const toPx = (lon, lat) => [offX + (lon - LON_MIN) * K * sc, offY + (LAT_MAX - lat) * sc];
  // Pixel trên texture → toạ độ thế giới (tường quay mặt về phía Bắc, người xem nhìn về phía Nam)
  const faceZ = z - 0.22;
  const toWorld = (px, py) => new THREE.Vector3(x + width / 2 - px / ppm, height - py / ppm, faceZ);

  let km = 0;
  for (let i = 1; i < trips.length; i++) km += haversine(trips[i - 1], trips[i]);

  const tex = canvasTexture(PX, PY, (ctx, w, h) => {
    // Nền tường sơn kem + khung
    ctx.fillStyle = '#fbf3ea';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 2500; i++) { ctx.fillStyle = Math.random() < 0.5 ? '#8a6d5a' : '#ffffff'; ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#d4a373';
    ctx.lineWidth = 18;
    ctx.strokeRect(9, 9, w - 18, h - 18);

    // Biển
    const sea = ctx.createLinearGradient(MAP.x, MAP.y, MAP.x + MAP.w, MAP.y + MAP.h);
    sea.addColorStop(0, '#d6effb');
    sea.addColorStop(1, '#a9dbf2');
    ctx.fillStyle = sea;
    ctx.beginPath(); ctx.roundRect(MAP.x, MAP.y, MAP.w, MAP.h, 40); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 70; i++) { const sx = MAP.x + 30 + Math.random() * (MAP.w - 60); const sy = MAP.y + 30 + Math.random() * (MAP.h - 60); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 12, sy - 6, sx + 24, sy); ctx.stroke(); }
    ctx.save();
    ctx.beginPath(); ctx.roundRect(MAP.x, MAP.y, MAP.w, MAP.h, 40); ctx.clip();

    // Đất liền
    ctx.beginPath();
    for (const ring of VN_LAND) ring.forEach(([lo, la], i) => { const [px, py] = toPx(lo, la); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.closePath();
    ctx.shadowColor = 'rgba(120,60,80,0.25)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    const land = ctx.createLinearGradient(0, MAP.y, 0, MAP.y + MAP.h);
    land.addColorStop(0, '#fff8ee');
    land.addColorStop(1, '#ffe9ef');
    ctx.fillStyle = land;
    ctx.fill('evenodd');
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#e39ab0';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Hoàng Sa, Trường Sa
    ctx.fillStyle = '#fff8ee';
    ctx.strokeStyle = '#e39ab0';
    ctx.lineWidth = 2;
    for (const [lo, la] of [...HOANG_SA, ...TRUONG_SA]) { const [px, py] = toPx(lo, la); ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    const center = (l) => l.reduce((a, [lo, la]) => [a[0] + lo / l.length, a[1] + la / l.length], [0, 0]);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1f4f6e';
    const islLabel = (list, dy) => {
      const [lo, la] = center(list);
      const [px, py] = toPx(lo, la);
      ctx.font = `800 30px ${FONT}`;
      ctx.fillText('Quần đảo', px, py + dy);
      ctx.fillText(list === HOANG_SA ? 'Hoàng Sa' : 'Trường Sa', px, py + dy + 34);
      ctx.font = `600 26px ${FONT}`;
      ctx.fillText('(Việt Nam)', px, py + dy + 66);
    };
    islLabel(HOANG_SA, -120);
    islLabel(TRUONG_SA, -175);
    { const [px, py] = toPx(111.6, 13.4); ctx.font = `800 40px ${FONT}`; ctx.fillStyle = 'rgba(31,79,110,0.35)'; ctx.fillText('B I Ể N   Đ Ô N G', px, py); }

    // Đường hành trình
    ctx.setLineDash([16, 12]);
    ctx.strokeStyle = 'rgba(255,94,135,0.85)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    trips.forEach((t, i) => { const [px, py] = toPx(t.lon, t.lat); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.stroke();
    ctx.setLineDash([]);

    // Tên địa điểm
    for (const t of trips) {
      const [px, py] = toPx(t.lon, t.lat);
      ctx.fillStyle = '#ff4d7a';
      ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();
      ctx.font = `800 30px ${FONT}`;
      ctx.textAlign = t.lx < 0 ? 'right' : t.lx > 0 ? 'left' : 'center';
      const tx = px + (t.lx || 0) * 34;
      const ty = py + (t.ly || 0) * 30 + 11;
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineJoin = 'round';
      ctx.strokeText(t.name, tx, ty);
      ctx.fillStyle = '#8a2f4f';
      ctx.fillText(t.name, tx, ty);
    }
    ctx.restore();

    // Bảng chữ bên phải
    const RX = MAP.x + MAP.w + 70;
    const RW = w - RX - 70;
    const cx = RX + RW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c75b7a';
    ctx.font = `150px ${SCRIPT}`;
    ctx.fillText('Hành trình', cx, 250);
    ctx.font = `110px ${SCRIPT}`;
    ctx.fillText(`của ${couple}`, cx, 380);
    drawHeart(ctx, cx, 470, 60, '#ff8fab');
    ctx.fillStyle = '#6d597a';
    ctx.font = `700 52px ${FONT}`;
    ctx.fillText(`${trips.length} nơi đã cùng nhau đi qua`, cx, 590);
    ctx.font = `500 40px ${FONT}`;
    ctx.fillText(`khoảng ${Math.round(km / 10) * 10} km dọc dải đất hình chữ S`, cx, 650);
    // Danh sách 2 cột
    ctx.font = `600 34px ${FONT}`;
    ctx.textAlign = 'left';
    const half = Math.ceil(trips.length / 2);
    trips.forEach((t, i) => {
      const col = i < half ? 0 : 1;
      const row = i < half ? i : i - half;
      const lx = RX + 30 + col * (RW / 2);
      const ly = 760 + row * 52;
      drawHeart(ctx, lx + 14, ly - 12, 26, '#ff6f91');
      ctx.fillStyle = '#5b4b5f';
      ctx.fillText(t.name, lx + 40, ly);
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    const by = h - 170;
    ctx.fillStyle = '#ff6f91';
    ctx.beginPath(); ctx.roundRect(cx - 360, by, 720, 92, 46); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText('💕 Chạm vào trái tim để xem ảnh', cx, by + 60);
  });
  tex.anisotropy = 8;

  // Khối tường + mặt tranh
  const wallMat = new THREE.MeshStandardMaterial({ color: '#efe2d3', roughness: 0.9 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, height + 0.5, 0.4), wallMat);
  wall.position.set(x, (height + 0.5) / 2, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  root.add(wall);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.28 }));
  face.position.set(x, height / 2 + 0.05, faceZ - 0.005);
  face.rotation.y = Math.PI;
  root.add(face);
  // Mái che nhỏ + đèn rọi
  const cap = new THREE.Mesh(new THREE.BoxGeometry(width + 1, 0.18, 0.9), new THREE.MeshStandardMaterial({ color: '#c8a27a', roughness: 0.7 }));
  cap.position.set(x, height + 0.6, z - 0.2);
  root.add(cap);
  for (const sx of [-width * 0.3, 0, width * 0.3]) {
    const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#333', side: THREE.DoubleSide }));
    lamp.position.set(x + sx, height + 0.35, z - 0.7);
    lamp.rotation.x = -0.6;
    root.add(lamp);
  }
  const wash = new THREE.PointLight('#fff1dc', 25, 16, 1.6);
  wash.position.set(x, height * 0.6, z - 4);
  root.add(wash);
  venue.addBox(x - width / 2 - 0.3, x + width / 2 + 0.3, z - 0.25, z + 0.25);

  // Trái tim nổi trên tường
  const hs = new THREE.Shape();
  hs.moveTo(0, -0.5); hs.bezierCurveTo(-0.9, 0.2, -0.6, 0.85, 0, 0.45); hs.bezierCurveTo(0.6, 0.85, 0.9, 0.2, 0, -0.5);
  const heartGeo = new THREE.ExtrudeGeometry(hs, { depth: 0.14, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }).center();
  const heartMat = new THREE.MeshStandardMaterial({ color: '#ff4d7a', emissive: '#ff2d6a', emissiveIntensity: 0.45, roughness: 0.35 });
  const pins = trips.map((t, i) => {
    const [px, py] = toPx(t.lon, t.lat);
    const pos = toWorld(px, py).add(new THREE.Vector3(0, 0.22, -0.1));
    const heart = new THREE.Mesh(heartGeo, heartMat);
    heart.scale.setScalar(0.3);
    heart.position.copy(pos);
    heart.rotation.y = Math.PI;
    heart.userData.trip = i;
    root.add(heart);
    return { i, trip: t, heart, pos };
  });

  return {
    pins,
    hearts: pins.map((p) => p.heart),
    // Vùng đứng trước tường
    front: { x, z: z - 3.5, r: 5.5 },
    update(t) {
      for (const p of pins) {
        const k = 0.3 * (1 + Math.max(0, Math.sin(t * 3 + p.i * 0.7)) * 0.18);
        p.heart.scale.setScalar(k);
      }
    },
  };
}
