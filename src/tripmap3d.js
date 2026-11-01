// "Góc kỷ niệm": bản đồ Việt Nam nổi khối trên mặt đất, mỗi nơi hai bạn từng đến là một ghim trái tim.
import * as THREE from 'three';
import { VN_LAND, HOANG_SA, TRUONG_SA } from './vnmap.js';
import { canvasTexture, drawHeart, FONT, SCRIPT } from './textures.js';

const K = Math.cos((16 * Math.PI) / 180);

export function buildTripMap({ scene, venue, trips, couple, center = { x: 30, z: 33.6 }, scale = 0.68 }) {
  const LON_C = 108.6;
  const LAT_C = 15.8;
  // Bản đồ quay về phía lối đi chính: khách đứng ở mép gần lối đi nhìn thấy đúng chiều (Bắc ở phía xa, Đông bên phải)
  const P = (lon, lat) => [center.x - (lon - LON_C) * K * scale, center.z + (lat - LAT_C) * scale];
  const root = new THREE.Group();
  scene.add(root);

  // Nền biển bo góc + viền trắng
  const rounded = (w, h, r) => {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  const BW = 10.4;
  const BH = 11.6;
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(rounded(BW + 0.5, BH + 0.5, 0.9), { depth: 0.05, bevelEnabled: false }).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#fff7f2', roughness: 0.6 }));
  rim.position.set(center.x, 0.0, center.z);
  rim.receiveShadow = true;
  root.add(rim);
  const seaTex = canvasTexture(512, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#9fdcf5'); g.addColorStop(1, '#5ab4dc');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3;
    for (let i = 0; i < 40; i++) { const x = Math.random() * w; const y = Math.random() * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 12, y - 6, x + 24, y); ctx.stroke(); }
  });
  const sea = new THREE.Mesh(new THREE.ExtrudeGeometry(rounded(BW, BH, 0.7), { depth: 0.07, bevelEnabled: false }).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: seaTex, roughness: 0.25, metalness: 0.1 }));
  sea.position.set(center.x, 0.0, center.z);
  sea.receiveShadow = true;
  root.add(sea);

  // Đất liền nổi khối
  const landTop = new THREE.MeshStandardMaterial({ color: '#f7efe1', roughness: 0.8 });
  const landSide = new THREE.MeshStandardMaterial({ color: '#e7b9c5', roughness: 0.7 });
  const shapes = VN_LAND.map((ring) => {
    const s = new THREE.Shape();
    ring.forEach(([lo, la], i) => { const [x, z] = P(lo, la); if (i) s.lineTo(x, -z); else s.moveTo(x, -z); });
    return s;
  });
  const land = new THREE.Mesh(new THREE.ExtrudeGeometry(shapes, { depth: 0.16, bevelEnabled: false }).rotateX(-Math.PI / 2), [landTop, landSide]);
  land.position.y = 0.07;
  land.castShadow = true;
  land.receiveShadow = true;
  root.add(land);

  // Hoàng Sa, Trường Sa
  const islGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.12, 8);
  for (const [lo, la] of [...HOANG_SA, ...TRUONG_SA]) {
    const [x, z] = P(lo, la);
    const m = new THREE.Mesh(islGeo, landTop);
    m.position.set(x, 0.12, z);
    root.add(m);
  }
  const flatText = (lines, x, z, w = 2.4, size = 1) => {
    const tex = canvasTexture(512, 160, (ctx, cw, ch) => {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1f4f6e';
      ctx.font = `800 ${46 * size}px ${FONT}`;
      ctx.fillText(lines[0], cw / 2, 62);
      if (lines[1]) { ctx.font = `600 ${36 * size}px ${FONT}`; ctx.fillText(lines[1], cw / 2, 114); }
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * (160 / 512)), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.set(-Math.PI / 2, 0, Math.PI);
    m.position.set(x, 0.09, z);
    root.add(m);
  };
  const avg = (list) => list.reduce((a, [lo, la]) => [a[0] + lo / list.length, a[1] + la / list.length], [0, 0]);
  const [hsLo, hsLa] = avg(HOANG_SA);
  const [tsLo, tsLa] = avg(TRUONG_SA);
  { const [x, z] = P(hsLo, hsLa + 1.1); flatText(['QĐ Hoàng Sa', '(Việt Nam)'], x, z, 2.1); }
  { const [x, z] = P(tsLo, tsLa + 2.0); flatText(['QĐ Trường Sa', '(Việt Nam)'], x, z, 2.1); }
  { const [x, z] = P(112.2, 13.6); flatText(['BIỂN ĐÔNG'], x, z, 2.6, 1.1); }

  // Bảng tiêu đề ở mép phía bắc (hướng lối đi chính)
  {
    const tex = canvasTexture(1024, 300, (ctx, w, h) => {
      ctx.fillStyle = '#fffaf5'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#ff8fab'; ctx.lineWidth = 12; ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#c75b7a'; ctx.font = `110px ${SCRIPT}`;
      ctx.fillText(`Hành trình của ${couple}`, w / 2, 135);
      ctx.fillStyle = '#6d597a'; ctx.font = `600 40px ${FONT}`;
      ctx.fillText(`${trips.length} nơi đã cùng nhau đi qua · chạm trái tim để xem ảnh`, w / 2, 220);
      drawHeart(ctx, 80, 150, 50, '#ff8fab'); drawHeart(ctx, w - 80, 150, 50, '#ff8fab');
    });
    const g = new THREE.Group();
    g.position.set(center.x, 0, center.z - BH / 2 - 0.6);
    g.rotation.y = Math.PI;
    const wood = new THREE.MeshStandardMaterial({ color: '#c8a27a', roughness: 0.8 });
    for (const sx of [-1.7, 1.7]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), wood); l.position.set(sx, 0.45, 0); g.add(l); }
    // Bảng thấp, ngả về sau để không che bản đồ
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.05), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }));
    board.position.y = 0.8;
    board.rotation.x = 0.35;
    g.add(board);
    root.add(g);
    venue.addCircle(center.x - 1.7, center.z - BH / 2 - 0.6, 0.2);
    venue.addCircle(center.x + 1.7, center.z - BH / 2 - 0.6, 0.2);
  }

  // Ghim trái tim
  const hs = new THREE.Shape();
  hs.moveTo(0, -0.5); hs.bezierCurveTo(-0.9, 0.2, -0.6, 0.85, 0, 0.45); hs.bezierCurveTo(0.6, 0.85, 0.9, 0.2, 0, -0.5);
  const heartGeo = new THREE.ExtrudeGeometry(hs, { depth: 0.18, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 }).center();
  const heartMat = new THREE.MeshStandardMaterial({ color: '#ff4d7a', emissive: '#ff2d6a', emissiveIntensity: 0.35, roughness: 0.35 });
  const stickGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 6);
  const stickMat = new THREE.MeshStandardMaterial({ color: '#ffd6e0' });
  const pins = trips.map((t, i) => {
    const [x, z] = P(t.lon, t.lat);
    const g = new THREE.Group();
    g.position.set(x, 0.23, z);
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.position.y = 0.5;
    g.add(stick);
    const heart = new THREE.Mesh(heartGeo, heartMat);
    heart.scale.setScalar(0.32);
    heart.position.y = 1.1;
    heart.castShadow = true;
    heart.userData.trip = i;
    g.add(heart);
    const tex = canvasTexture(512, 128, (ctx, w, h) => {
      ctx.font = `700 54px ${FONT}`;
      const tw = Math.min(w - 20, ctx.measureText(t.name).width + 60);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.roundRect((w - tw) / 2, 20, tw, 88, 44); ctx.fill();
      ctx.fillStyle = '#c75b7a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.name, w / 2, 66);
    });
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    label.scale.set(1.6, 0.4, 1);
    label.position.y = 1.65;
    label.visible = false;
    g.add(label);
    root.add(g);
    return { i, trip: t, heart, label, pos: g.position };
  });

  // Đường hành trình nét đứt nối các điểm
  {
    const pts = pins.map((p) => new THREE.Vector3(p.pos.x, 0.26, p.pos.z));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: '#ff6f91', dashSize: 0.18, gapSize: 0.12 }));
    line.computeLineDistances();
    root.add(line);
  }

  const near = { x: center.x, z: center.z, r: 7.5 };
  return {
    pins,
    hearts: pins.map((p) => p.heart),
    near,
    update(t, me) {
      for (const p of pins) {
        p.heart.rotation.y = t * 1.2 + p.i;
        p.heart.position.y = 1.1 + Math.sin(t * 2 + p.i) * 0.05;
        p.label.visible = !!me && Math.hypot(me.x - p.pos.x, me.z - p.pos.z) < 3.2;
      }
    },
  };
}
