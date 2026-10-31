import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WEDDING } from './config.js';
import { canvasTexture, drawHeart, roundRect, FONT, SCRIPT } from './textures.js';

export const BOUNDS = { x0: -47, x1: 47, z0: -15, z1: 41 };

// rect = [x0, x1, z0, z1]; spawn = điểm xuất hiện; view = góc "Xem từ khu này"
export const ZONES = [
  {
    id: 'welcome', icon: '💐', name: 'Cổng đón khách', color: '#ff9db5',
    desc: 'Cổng hoa có chuông cưới, đài phun nước ước nguyện, xe hoa "Just Married", bảng chào mừng và hòm mừng cưới. Có cả chú cún corgi đang chạy chơi!',
    rect: [-14, 14, 26, 41], spawn: [0, 37], view: { p: [0, 2.2, 39.5], t: [0, 1.5, 10] },
  },
  {
    id: 'ceremony', icon: '💒', name: 'Lễ đường', color: '#ffd27a',
    desc: 'Lối đi trải cánh hoa dẫn tới cổng hoa – nơi cô dâu chú rể trao nhẫn.',
    rect: [-14, 14, -15, 24], spawn: [0, 21], view: { p: [0, 2, 22], t: [0, 1.5, -9] },
  },
  {
    id: 'banquet', icon: '🥂', name: 'Tiệc cưới', color: '#7fe0b5',
    desc: '12 bàn tiệc tròn, bánh cưới 5 tầng, tháp champagne và xe kem. Ngồi vào bàn rồi bấm phím 4 để nâng ly "zô"!',
    rect: [-47, -16, -15, 24], spawn: [-31, 23], view: { p: [-31, 2.6, 24], t: [-31, 0.8, -9] },
  },
  {
    id: 'photo', icon: '📸', name: 'Góc check-in', color: '#8fc8ff',
    desc: 'Khung trái tim, xích đu hoa, tường khóa tình yêu, bóng bay và backdrop ảnh cưới. Bấm phím 6 để bắn tim!',
    rect: [-47, -16, 26, 41], spawn: [-31, 29], view: { p: [-31, 1.8, 28], t: [-31, 2.2, 40] },
  },
  {
    id: 'party', icon: '🎶', name: 'Sân khấu & Sàn nhảy', color: '#c3a6ff',
    desc: 'Sân khấu có đàn piano, sàn nhảy LED, hồ thiên nga và quầy bar. Bấm phím 3, 5 để quẩy!',
    rect: [16, 47, -15, 41], spawn: [31, 20], view: { p: [31, 2, 22], t: [31, 3, -12] },
  },
];

export const zoneById = (id) => ZONES.find((z) => z.id === id);

export function zoneAt(x, z) {
  let best = null;
  let bestD = 2.5;
  for (const zn of ZONES) {
    const [x0, x1, z0, z1] = zn.rect;
    const d = Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
    if (d === 0) return zn;
    if (d < bestD) { bestD = d; best = zn; }
  }
  return best;
}

const FLOWER_COLORS = ['#ff7aa2', '#ffffff', '#ffc2d4', '#ff4f79', '#fff0b3', '#e6a8ff', '#ffb38a'];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

class HeartCurve extends THREE.Curve {
  constructor(s) { super(); this.s = s; }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * Math.PI * 2;
    const x = 16 * Math.sin(a) ** 3;
    const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
    return target.set(x * this.s, y * this.s, 0);
  }
}

function chairGeometry() {
  const parts = [];
  const seat = new THREE.BoxGeometry(0.46, 0.06, 0.44);
  seat.translate(0, 0.46, 0);
  parts.push(seat);
  const back = new THREE.BoxGeometry(0.46, 0.5, 0.05);
  back.translate(0, 0.74, -0.2);
  parts.push(back);
  for (const [x, z] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]]) {
    const leg = new THREE.CylinderGeometry(0.025, 0.025, 0.46, 6);
    leg.translate(x, 0.23, z);
    parts.push(leg);
  }
  return mergeGeometries(parts);
}

export function buildVenue(scene) {
  const circles = [];
  const boxes = [];
  const updaters = [];
  const flowers = [];
  const bulbs = [];
  const ceremonyChairs = [];
  const banquetChairs = [];
  const plates = [];

  const mats = {};
  const mat = (color, o = {}) => {
    const key = color + JSON.stringify(o);
    return mats[key] || (mats[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o }));
  };
  const put = (geo, m, x, y, z, parent = scene) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const flat = (w, d, x, z, color, y = 0.02) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color, { roughness: 1 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  const circle = (x, z, r) => circles.push({ x, z, r });
  const box = (x0, x1, z0, z1, h = 99) => boxes.push({ x0, x1, z0, z1, h });
  const flowerCluster = (x, y, z, n = 8, spread = 0.3, size = 0.13, colors = FLOWER_COLORS) => {
    for (let i = 0; i < n; i++) {
      flowers.push({
        x: x + rand(-spread, spread), y: y + rand(-spread, spread) * 0.7, z: z + rand(-spread, spread),
        s: size * rand(0.7, 1.3), c: pick(colors),
      });
    }
  };
  const picture = (tex, w, h, x, y, z, ry = 0, glow = 0) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      glow ? new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(glow, glow, glow) }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }),
    );
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
    return m;
  };
  const pole = (x, z, h = 4.6) => {
    put(new THREE.CylinderGeometry(0.06, 0.08, h, 8), mat('#3b2f2a'), x, h / 2, z);
    circle(x, z, 0.2);
    return new THREE.Vector3(x, h, z);
  };
  const stringLights = (a, b, sag = 0.7, spacing = 0.7) => {
    const n = Math.max(2, Math.round(a.distanceTo(b) / spacing));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = a.clone().lerp(b, t);
      p.y -= sag * 4 * t * (1 - t);
      pts.push(p);
      if (i > 0 && i < n) bulbs.push(p.clone().add(new THREE.Vector3(0, -0.08, 0)));
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#2b2420' })));
  };
  const flowerArch = (x, z, ry, r = 3, tube = 0.12, n = 90) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
    const white = mat('#fffaf0');
    for (const s of [-1, 1]) put(new THREE.CylinderGeometry(tube, tube, 2.2, 10), white, s * r, 1.1, 0, g);
    put(new THREE.TorusGeometry(r, tube, 8, 40, Math.PI), white, 0, 2.2, 0, g);
    g.updateMatrixWorld();
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const onArc = Math.random() < 0.7;
      if (onArc) {
        const a = Math.random() < 0.6 ? rand(0, 0.9) : rand(0, Math.PI);
        const side = Math.random() < 0.5 ? a : Math.PI - a; // dày hơn ở hai vai
        v.set(Math.cos(side) * r, 2.2 + Math.sin(side) * r, rand(-0.2, 0.2));
      } else {
        v.set(pick([-1, 1]) * r + rand(-0.15, 0.15), rand(0.2, 2.2), rand(-0.2, 0.2));
      }
      g.localToWorld(v);
      flowerCluster(v.x, v.y, v.z, 2, 0.12, 0.14);
    }
    for (const s of [-1, 1]) {
      v.set(s * r, 0, 0);
      g.localToWorld(v);
      circle(v.x, v.z, tube + 0.25);
    }
  };
  const signBoard = (tex, w, h, x, z, ry, y0 = 0.7) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
    put(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.05), mat('#c9a46a', { metalness: 0.4, roughness: 0.4 }), 0, y0 + h / 2, -0.03, g);
    const p = picture(tex, w, h, 0, y0 + h / 2, 0, 0);
    g.add(p);
    for (const s of [-1, 1]) {
      const leg = put(new THREE.CylinderGeometry(0.03, 0.03, y0 + h * 0.8, 6), mat('#6b4f3a'), s * w * 0.35, (y0 + h * 0.8) / 2, -0.08, g);
      leg.rotation.x = 0.08;
    }
    circle(x, z, Math.max(0.6, w * 0.45));
    return g;
  };

  // ---------- Bầu trời hoàng hôn ----------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(450, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color('#1d1d4f') },
        mid: { value: new THREE.Color('#d9779a') },
        bot: { value: new THREE.Color('#ffc796') },
        sunDir: { value: new THREE.Vector3(-0.35, 0.07, -1).normalize() },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir; varying vec3 vP;
        void main(){ float h = vP.y;
          vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(bot, mid, smoothstep(-0.05, 0.12, h));
          float s = max(dot(normalize(vP), sunDir), 0.0);
          c += vec3(1.0, 0.62, 0.42) * pow(s, 8.0) * 0.25 + vec3(1.0, 0.8, 0.55) * pow(s, 90.0) * 0.45 + vec3(1.0, 0.92, 0.75) * smoothstep(0.9995, 0.9997, s) * 1.4;
          float band = sin(vP.x * 9.0 + vP.z * 3.0) * 0.5 + 0.5;
          c = mix(c, c * vec3(1.08, 0.9, 1.0), smoothstep(0.08, 0.2, h) * (1.0 - smoothstep(0.2, 0.32, h)) * band * 0.5);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  scene.add(sky);

  // ---------- Mặt đất & lối đi ----------
  const ground = flat(240, 200, 0, 13, '#6c9f57', 0);
  ground.material = new THREE.MeshStandardMaterial({ color: '#6c9f57', roughness: 1 });
  flat(94, 2, 0, 25, '#e6d6bb');
  flat(2, 56, -15, 13, '#e6d6bb');
  flat(2, 56, 15, 13, '#e6d6bb');
  flat(4, 16, 0, 49, '#e6d6bb');

  // ---------- Lớp phủ khu vực (hiện ở chế độ bản đồ) ----------
  const zoneMeshes = ZONES.map((zn) => {
    const [x0, x1, z0, z1] = zn.rect;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0, z1 - z0),
      new THREE.MeshBasicMaterial({ color: zn.color, transparent: true, opacity: 0, depthWrite: false }),
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(cx, 0.06, cz);
    fill.userData.zone = zn;
    fill.renderOrder = 1;
    scene.add(fill);
    const edge = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x0, 0.08, z0), new THREE.Vector3(x1, 0.08, z0),
        new THREE.Vector3(x1, 0.08, z1), new THREE.Vector3(x0, 0.08, z1),
      ]),
      new THREE.LineBasicMaterial({ color: zn.color, transparent: true, opacity: 0 }),
    );
    scene.add(edge);
    const tex = canvasTexture(640, 150, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      roundRect(ctx, 4, 4, w - 8, h - 8, 70);
      ctx.fill();
      ctx.fillStyle = zn.color;
      ctx.fillRect(40, h - 26, w - 80, 8);
      ctx.font = `800 60px ${FONT}`;
      ctx.fillStyle = '#3a2340';
      ctx.textAlign = 'center';
      ctx.fillText(`${zn.icon} ${zn.name}`, w / 2, 92, w - 60);
    });
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    label.scale.set(12, 2.8, 1);
    label.position.set(cx, 8, cz);
    label.renderOrder = 20;
    scene.add(label);
    return { zone: zn, fill, edge, label, center: new THREE.Vector3(cx, 0, cz) };
  });

  // ========== KHU ĐÓN KHÁCH ==========
  flowerArch(0, 40, 0, 2.6, 0.11, 80);
  flat(4, 14, 0, 33, '#efe3cc', 0.025);
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd58a').multiplyScalar(2.4) });
  for (let z = 28; z <= 39; z += 2.75) {
    for (const s of [-1, 1]) {
      put(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6), mat('#3b2f2a'), s * 2.6, 0.35, z);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.22), lampMat);
      lamp.position.set(s * 2.6, 0.82, z);
      scene.add(lamp);
    }
  }
  const welcomeTex = canvasTexture(512, 720, (ctx, w, h) => {
    ctx.fillStyle = '#fff8f1';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c9a46a';
    ctx.lineWidth = 6;
    ctx.strokeRect(22, 22, w - 44, h - 44);
    for (const [x, y] of [[60, 70], [w - 60, 70], [60, h - 70], [w - 60, h - 70]]) drawHeart(ctx, x, y, 40, '#ff8fab');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b5838d';
    ctx.font = `90px ${SCRIPT}`;
    ctx.fillText('Welcome', w / 2, 180);
    ctx.font = `500 28px ${FONT}`;
    ctx.fillStyle = '#6d597a';
    ctx.fillText('TO THE WEDDING OF', w / 2, 240);
    ctx.font = `110px ${SCRIPT}`;
    ctx.fillStyle = '#e5989b';
    ctx.fillText(WEDDING.groom, w / 2, 380);
    ctx.font = `60px ${SCRIPT}`;
    ctx.fillText('&', w / 2, 450);
    ctx.font = `110px ${SCRIPT}`;
    ctx.fillText(WEDDING.bride, w / 2, 560);
    ctx.font = `600 30px ${FONT}`;
    ctx.fillStyle = '#6d597a';
    ctx.fillText(WEDDING.date, w / 2, 640);
  });
  signBoard(welcomeTex, 1.6, 2.25, -6, 34, 0.35);
  for (let i = 0; i < 6; i++) flowerCluster(-6 + rand(-0.8, 0.8), 0.25, 34.2, 4, 0.25, 0.15);

  put(new THREE.BoxGeometry(2.4, 0.8, 1), mat('#fffaf2'), 6, 0.4, 33);
  box(4.8, 7.2, 32.5, 33.5);
  put(new THREE.BoxGeometry(0.7, 0.6, 0.6), mat('#c81d25'), 6.4, 1.1, 33);
  put(new THREE.BoxGeometry(0.72, 0.08, 0.62), mat('#e9c46a', { metalness: 0.5, roughness: 0.35 }), 6.4, 1.2, 33);
  put(new THREE.BoxGeometry(0.4, 0.06, 0.5), mat('#fffaf0'), 5.1, 0.83, 33);
  const giftTex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c81d25';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.font = `bold 120px serif`;
    ctx.fillText('囍', w / 2, 140);
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText('Mừng cưới', w / 2, 215);
  });
  picture(giftTex, 0.56, 0.56, 6.4, 1.08, 33.31);
  for (const s of [-1, 1]) {
    put(new THREE.BoxGeometry(1, 1, 13), mat('#3f7d3a', { roughness: 0.95 }), s * 13.4, 0.5, 33.5);
    box(s * 13.4 - 0.5, s * 13.4 + 0.5, 27, 40);
    for (let z = 28; z < 40; z += 1.2) flowerCluster(s * 13.4, 1.05, z, 2, 0.4, 0.12);
  }

  // ========== LỄ ĐƯỜNG ==========
  put(new THREE.CylinderGeometry(3.5, 3.6, 0.25, 40), mat('#fbf7f0'), 0, 0.125, -8);
  flowerArch(0, -10, 0, 3.2, 0.14, 150);
  const drape = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 5.2),
    new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  drape.position.set(0, 2.7, -10.35);
  scene.add(drape);
  for (const s of [-1, 1]) {
    put(new THREE.CylinderGeometry(0.35, 0.22, 0.9, 16), mat('#f2e9e1'), s * 4.6, 0.45, -9);
    flowerCluster(s * 4.6, 1.2, -9, 26, 0.45, 0.16);
    circle(s * 4.6, -9, 0.6);
  }
  flat(2.4, 29, 0, 9.5, '#fbf5ec', 0.03);
  const petals = Array.from({ length: 360 }, () => ({ x: rand(-1.15, 1.15), z: rand(-5, 24), c: pick(['#ff7aa2', '#ff4f79', '#ffffff', '#ffc2d4']) }));
  for (let z = -3; z <= 21; z += 4) {
    for (const s of [-1, 1]) {
      put(new THREE.CylinderGeometry(0.1, 0.14, 1, 10), mat('#fffaf0'), s * 1.65, 0.5, z);
      flowerCluster(s * 1.65, 1.12, z, 10, 0.2, 0.1);
      circle(s * 1.65, z, 0.25);
    }
  }
  for (let z = 20; z >= -1; z -= 1.9) {
    for (const s of [-1, 1]) {
      for (let k = 0; k < 5; k++) ceremonyChairs.push({ x: s * (2.1 + k * 0.62), z, ry: Math.PI });
      box(s > 0 ? 1.8 : -4.98, s > 0 ? 4.98 : -1.8, z - 0.28, z + 0.28, 0.9);
    }
  }
  {
    const pA = [-12, 4, 20].map((z) => pole(-11.5, z, 5));
    const pB = [-12, 4, 20].map((z) => pole(11.5, z, 5));
    for (let i = 0; i < 3; i++) stringLights(pA[i], pB[i], 1.2);
    for (let i = 0; i < 2; i++) { stringLights(pA[i], pA[i + 1], 0.8); stringLights(pB[i], pB[i + 1], 0.8); }
    stringLights(pA[0], pB[1], 1.6);
    stringLights(pB[0], pA[1], 1.6);
  }

  // ========== TIỆC CƯỚI ==========
  const tables = [];
  let num = 1;
  for (const z of [-7, 2, 11, 20]) for (const x of [-40, -31, -22]) tables.push({ x, z, n: num++ });
  const glass = new THREE.MeshStandardMaterial({ color: '#d8f3ff', transparent: true, opacity: 0.5, roughness: 0.1 });
  const flame = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf70').multiplyScalar(3) });
  for (const t of tables) {
    put(new THREE.CylinderGeometry(1.3, 1.38, 0.76, 28), mat('#fffdf8'), t.x, 0.38, t.z);
    put(new THREE.CylinderGeometry(0.75, 0.75, 0.012, 28), mat('#f7c6d0'), t.x, 0.766, t.z);
    put(new THREE.CylinderGeometry(0.11, 0.07, 0.35, 10), glass, t.x, 0.95, t.z);
    flowerCluster(t.x, 1.25, t.z, 12, 0.22, 0.09);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      put(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), mat('#fff8e7'), t.x + Math.sin(a) * 0.45, 0.86, t.z + Math.cos(a) * 0.45);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), flame);
      f.position.set(t.x + Math.sin(a) * 0.45, 0.97, t.z + Math.cos(a) * 0.45);
      scene.add(f);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      banquetChairs.push({ x: t.x + Math.sin(a) * 1.85, z: t.z + Math.cos(a) * 1.85, ry: a + Math.PI });
      plates.push({ x: t.x + Math.sin(a) * 1.0, z: t.z + Math.cos(a) * 1.0 });
    }
    circle(t.x, t.z, 1.55);
    const nTex = canvasTexture(256, 96, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      roundRect(ctx, 4, 4, w - 8, h - 8, 40);
      ctx.fill();
      ctx.fillStyle = '#b5838d';
      ctx.font = `700 50px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(`Bàn ${t.n}`, w / 2, 66);
    });
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: nTex, transparent: true }));
    tag.scale.set(1.1, 0.41, 1);
    tag.position.set(t.x, 1.95, t.z);
    scene.add(tag);
  }
  // Bánh cưới
  {
    const cx = -31;
    const cz = -12.3;
    put(new THREE.CylinderGeometry(0.9, 0.95, 0.76, 24), mat('#fffdf8'), cx, 0.38, cz);
    let y = 0.76;
    for (const r of [0.55, 0.45, 0.36, 0.27, 0.19]) {
      put(new THREE.CylinderGeometry(r, r, 0.28, 24), mat('#fffaf3', { roughness: 0.5 }), cx, y + 0.14, cz);
      const ribbon = put(new THREE.TorusGeometry(r, 0.025, 6, 32), mat('#ff8fab'), cx, y + 0.03, cz);
      ribbon.rotation.x = Math.PI / 2;
      flowerCluster(cx + r * 0.9, y + 0.2, cz + r * 0.3, 2, 0.05, 0.05);
      y += 0.28;
    }
    flowerCluster(cx, y + 0.08, cz, 7, 0.1, 0.07, ['#ff4f79', '#ff7aa2', '#ffffff']);
    circle(cx, cz, 1.1);
  }
  {
    const zs = [-11.5, -2.5, 6.5, 15.5, 23];
    const left = zs.map((z) => pole(-46.3, z, 4.8));
    const right = zs.map((z) => pole(-16.7, z, 4.8));
    zs.forEach((_, i) => stringLights(left[i], right[i], 1.5, 0.75));
  }

  // ========== GÓC CHECK-IN ==========
  const backdropTex = canvasTexture(1024, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#ffe5ec');
    g.addColorStop(1, '#e8dff5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const x = i % 2 ? rand(0, 180) : rand(w - 180, w);
      drawHeart(ctx, x, rand(0, h), rand(14, 40), `rgba(255,${Math.floor(rand(110, 180))},${Math.floor(rand(150, 190))},0.55)`);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b5838d';
    ctx.font = `150px ${SCRIPT}`;
    ctx.fillText(`${WEDDING.groom} & ${WEDDING.bride}`, w / 2, 250);
    ctx.font = `600 40px ${FONT}`;
    ctx.fillStyle = '#6d597a';
    ctx.fillText(`${WEDDING.date}  ·  ${WEDDING.hashtag}`, w / 2, 350);
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText('Save the moment 📸', w / 2, 420);
  });
  put(new THREE.BoxGeometry(10.3, 5.3, 0.2), mat('#ffffff'), -31, 2.75, 40.6);
  picture(backdropTex, 10, 5, -31, 2.75, 40.48, Math.PI);
  box(-36.2, -25.8, 40.4, 40.9);
  for (let x = -36; x <= -26; x += 0.5) flowerCluster(x, 5.4, 40.4, 2, 0.2, 0.15);
  for (let y = 0.3; y <= 5.4; y += 0.45) { flowerCluster(-36.1, y, 40.4, 2, 0.2, 0.15); flowerCluster(-25.9, y, 40.4, 2, 0.2, 0.15); }

  {
    const curve = new HeartCurve(0.13);
    const heart = put(new THREE.TubeGeometry(curve, 100, 0.09, 8, true), mat('#ff8fab', { roughness: 0.4 }), -23.5, 2.35, 35.5);
    heart.rotation.y = -0.5;
    heart.updateMatrixWorld();
    const v = new THREE.Vector3();
    for (let i = 0; i < 60; i++) {
      curve.getPoint(i / 60, v);
      heart.localToWorld(v);
      flowerCluster(v.x, v.y, v.z, 2, 0.1, 0.11, ['#ff4f79', '#ffffff', '#ffc2d4']);
    }
    circle(-23.5, 35.5, 0.4);
  }
  const balloonGroups = [];
  for (const [bx, bz] of [[-41, 29.5], [-20, 39], [-43, 39]]) {
    const g = new THREE.Group();
    g.position.set(bx, 0, bz);
    scene.add(g);
    for (let i = 0; i < 8; i++) {
      const b = put(new THREE.SphereGeometry(0.33, 16, 12), mat(pick(['#ffafcc', '#cdb4db', '#bde0fe', '#ffffff', '#ffc8dd', '#fde68a']), { roughness: 0.25, metalness: 0.1 }), rand(-0.7, 0.7), rand(2.6, 4), rand(-0.7, 0.7), g);
      b.scale.y = 1.15;
      b.userData.base = b.position.y;
      b.userData.ph = rand(0, 6);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.4, 0), b.position.clone().add(new THREE.Vector3(0, -0.38, 0))]),
        new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 }),
      );
      g.add(line);
    }
    put(new THREE.BoxGeometry(0.3, 0.4, 0.3), mat('#e9c46a', { metalness: 0.6, roughness: 0.3 }), 0, 0.2, 0, g);
    circle(bx, bz, 0.4);
    balloonGroups.push(g);
  }
  updaters.push((t) => {
    for (const g of balloonGroups) for (const c of g.children) if (c.userData.base) c.position.y = c.userData.base + Math.sin(t * 1.3 + c.userData.ph) * 0.12;
  });
  const loveTex = canvasTexture(512, 180, (ctx, w, h) => {
    ctx.fillStyle = '#2a1b2e';
    roundRect(ctx, 0, 0, w, h, 24);
    ctx.fill();
    ctx.font = `900 140px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd6a5';
    ctx.shadowColor = '#ff9f6b';
    ctx.shadowBlur = 30;
    ctx.fillText('LOVE', w / 2, 140);
  });
  picture(loveTex, 3, 1.05, -44.6, 1.6, 33, Math.PI / 2, 1.9);
  put(new THREE.BoxGeometry(0.2, 1.3, 3.2), mat('#2a1b2e'), -44.75, 1.45, 33);
  box(-45, -44.4, 31.3, 34.7);
  put(new THREE.BoxGeometry(2.2, 0.45, 0.6), mat('#ffffff'), -36, 0.42, 29.6);
  put(new THREE.BoxGeometry(2.2, 0.6, 0.08), mat('#ffffff'), -36, 0.85, 29.32);
  box(-37.1, -34.9, 29.2, 29.9);

  // ========== SÂN KHẤU & SÀN NHẢY ==========
  put(new THREE.BoxGeometry(18, 1, 8), mat('#3a2a3a', { roughness: 0.5 }), 31, 0.5, -10);
  const edgeStrip = new THREE.Mesh(new THREE.BoxGeometry(18, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: '#ff6fd8' }));
  edgeStrip.position.set(31, 1.0, -5.98);
  scene.add(edgeStrip);
  box(22, 40, -14, -6, 0.6);
  {
    const ramp = put(new THREE.BoxGeometry(6, 0.1, Math.hypot(2.5, 1)), mat('#4a3648'), 31, 0.47, -4.75);
    ramp.rotation.x = Math.atan2(1, 2.5);
  }
  const led = canvasTexture(1024, 384);
  const lctx = led.userData.ctx;
  const ledHearts = Array.from({ length: 16 }, (_, i) => ({ x: rand(0, 1024), sp: rand(30, 90), y: rand(0, 384), s: rand(18, 46), i }));
  let ledClock = 0;
  const drawLED = (t) => {
    const hue = (t * 18) % 360;
    const g = lctx.createLinearGradient(0, 0, 1024, 384);
    g.addColorStop(0, `hsl(${hue}, 75%, 42%)`);
    g.addColorStop(1, `hsl(${(hue + 70) % 360}, 75%, 36%)`);
    lctx.fillStyle = g;
    lctx.fillRect(0, 0, 1024, 384);
    for (const hrt of ledHearts) {
      const y = 420 - ((t * hrt.sp + hrt.y) % 470);
      drawHeart(lctx, hrt.x, y, hrt.s, 'rgba(255,255,255,0.3)');
    }
    lctx.textAlign = 'center';
    lctx.fillStyle = '#ffffff';
    lctx.shadowColor = 'rgba(0,0,0,0.35)';
    lctx.shadowBlur = 16;
    lctx.font = `140px ${SCRIPT}`;
    lctx.fillText(`${WEDDING.groom} ♥ ${WEDDING.bride}`, 512, 215);
    lctx.font = `600 36px ${FONT}`;
    lctx.fillText(`${WEDDING.date}  ·  ${WEDDING.hashtag}`, 512, 300);
    lctx.shadowBlur = 0;
    led.needsUpdate = true;
  };
  drawLED(0);
  picture(led, 16, 6, 31, 4.2, -13.85, 0, 1.25);
  put(new THREE.BoxGeometry(16.6, 6.6, 0.25), mat('#141018'), 31, 4.2, -14.05);
  const trussMat = mat('#9aa0a8', { metalness: 0.7, roughness: 0.35 });
  for (const s of [21.3, 40.7]) {
    put(new THREE.BoxGeometry(0.3, 9, 0.3), trussMat, s, 4.5, -5.3);
    put(new THREE.BoxGeometry(0.3, 9, 0.3), trussMat, s, 4.5, -14.2);
    circle(s, -5.3, 0.3);
  }
  put(new THREE.BoxGeometry(19.7, 0.3, 0.3), trussMat, 31, 9, -5.3);
  put(new THREE.BoxGeometry(19.7, 0.3, 0.3), trussMat, 31, 9, -14.2);
  for (const sx of [20.6, 41.4]) {
    put(new THREE.BoxGeometry(1.1, 2.2, 1), mat('#18161c'), sx, 1.1, -7.5);
    const cone = put(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 20), mat('#3b3b46'), sx, 1.4, -6.98);
    cone.rotation.x = Math.PI / 2;
    box(sx - 0.55, sx + 0.55, -8, -7);
  }
  const beams = [];
  ['#ff5fd2', '#62d6ff', '#ffe066', '#9b7bff', '#ff8a5c'].forEach((c, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(23 + i * 4, 8.8, -5.3);
    const g = new THREE.ConeGeometry(1.6, 10, 24, 1, true);
    g.translate(0, -5, 0);
    const cone = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    pivot.add(cone);
    scene.add(pivot);
    beams.push({ pivot, ph: i * 1.3 });
  });
  const DF = { x0: 22.6, x1: 39.4, z0: -2, z1: 12, nx: 12, nz: 10 };
  const tileW = (DF.x1 - DF.x0) / DF.nx;
  const tileD = (DF.z1 - DF.z0) / DF.nz;
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(tileW - 0.05, 0.08, tileD - 0.05), new THREE.MeshBasicMaterial({ color: '#ffffff' }), DF.nx * DF.nz);
  {
    const d = new THREE.Object3D();
    let i = 0;
    for (let a = 0; a < DF.nx; a++) {
      for (let b = 0; b < DF.nz; b++) {
        d.position.set(DF.x0 + tileW * (a + 0.5), 0.04, DF.z0 + tileD * (b + 0.5));
        d.updateMatrix();
        tiles.setMatrixAt(i, d.matrix);
        tiles.setColorAt(i++, new THREE.Color('#ff66cc'));
      }
    }
  }
  tiles.receiveShadow = true;
  scene.add(tiles);
  const partyLight = new THREE.PointLight('#ff66cc', 80, 30);
  partyLight.position.set(31, 6, 5);
  scene.add(partyLight);
  const tmpColor = new THREE.Color();
  let boost = 0;
  let beamT = 0;
  let waveT = 0;
  updaters.push((t, dt) => {
    ledClock += dt;
    if (ledClock > 0.08) { ledClock = 0; drawLED(t); }
    const bb = Math.min(1, boost); // chế độ Disco: đèn nháy nhanh và sáng hơn
    waveT += dt * (4 + bb * 6);
    beamT += dt * (1 + bb * 2.5);
    const beat = bb > 0 ? (Math.sin(t * 12) > 0 ? 1 : 0) : 0;
    let i = 0;
    for (let a = 0; a < DF.nx; a++) {
      for (let b = 0; b < DF.nz; b++) {
        const dx = a - DF.nx / 2;
        const dz = b - DF.nz / 2;
        const wave = Math.sin(Math.hypot(dx, dz) * 0.9 - waveT);
        const checker = (a + b + beat) % 2 === 0 ? bb : 0;
        tmpColor.setHSL(((a + b) * 0.04 + t * (0.12 + bb * 0.4)) % 1, 0.85, 0.35 + wave * 0.18)
          .multiplyScalar(1 + Math.max(0, wave) * (1.2 - bb * 0.6) + checker * 1.1);
        tiles.setColorAt(i++, tmpColor);
      }
    }
    tiles.instanceColor.needsUpdate = true;
    for (const b of beams) {
      b.pivot.rotation.x = -0.55 + Math.sin(beamT * 0.9 + b.ph) * 0.35;
      b.pivot.rotation.z = Math.sin(beamT * 0.7 + b.ph * 2) * (0.45 + bb * 0.25);
      b.pivot.children[0].material.opacity = 0.13 + bb * 0.12;
    }
    partyLight.color.setHSL((t * (0.1 + bb * 0.5)) % 1, 0.8, 0.6);
    partyLight.intensity = 80 + bb * 140 * (0.6 + 0.4 * beat);
    edgeStrip.material.color.setHSL((t * 0.2) % 1, 0.9, 0.6).multiplyScalar(2.5);
    boost = Math.max(0, boost - dt * 0.6);
  });
  // Quầy bar
  put(new THREE.BoxGeometry(1.6, 1.1, 6), mat('#5b3a29'), 40.5, 0.55, 30);
  put(new THREE.BoxGeometry(1.8, 0.06, 6.2), mat('#e8dcc4'), 40.5, 1.13, 30);
  put(new THREE.BoxGeometry(0.5, 2.2, 6), mat('#3d2a20'), 44, 1.1, 30);
  box(39.6, 41.4, 26.9, 33.1);
  box(43.7, 44.3, 27, 33);
  for (let i = 0; i < 14; i++) {
    put(new THREE.CylinderGeometry(0.06, 0.07, rand(0.28, 0.4), 8), mat(pick(['#2d6a4f', '#9d0208', '#e9c46a', '#264653', '#ffffff']), { roughness: 0.2 }), 43.6, 1.45 + (i % 2) * 0.6, 27.6 + Math.floor(i / 2) * 0.75);
  }
  const barTex = canvasTexture(512, 160, (ctx, w, h) => {
    ctx.fillStyle = '#120c16';
    ctx.fillRect(0, 0, w, h);
    ctx.font = `110px ${SCRIPT}`;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff4fd8';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#ffb3f0';
    ctx.fillText('Love Bar', w / 2, 115);
  });
  picture(barTex, 3.2, 1, 43.7, 2.9, 30, -Math.PI / 2, 1.9);
  for (const [x, z] of [[25, 24], [30, 28.5], [25, 33.5], [34, 34], [35, 23]]) {
    put(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 20), mat('#ffffff'), x, 1.1, z);
    put(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8), mat('#c9a46a', { metalness: 0.7, roughness: 0.3 }), x, 0.55, z);
    put(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 16), mat('#c9a46a', { metalness: 0.7, roughness: 0.3 }), x, 0.02, z);
    flowerCluster(x, 1.2, z, 3, 0.08, 0.06);
    circle(x, z, 0.5);
  }

  // ========== Cột đèn dọc lối đi chính ==========
  for (const x of [-40, -24, -8, 8, 24, 40]) {
    put(new THREE.CylinderGeometry(0.06, 0.1, 3.2, 8), mat('#2f2a2a'), x, 1.6, 24.2);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2a8').multiplyScalar(2.6) }));
    head.position.set(x, 3.3, 24.2);
    scene.add(head);
    circle(x, 24.2, 0.25);
  }

  // ========== Cây xanh bao quanh ==========
  const trees = [];
  for (let i = 0; i < 110; i++) {
    let x;
    let z;
    const side = Math.floor(Math.random() * 4);
    if (side === 0) { x = rand(-65, 65); z = BOUNDS.z0 - rand(3, 18); }
    else if (side === 1) { x = rand(-65, 65); z = BOUNDS.z1 + rand(3, 18); if (Math.abs(x) < 4) x += 8 * Math.sign(x || 1); }
    else { x = (side === 2 ? BOUNDS.x0 - 1 : BOUNDS.x1 + 1) + (side === 2 ? -1 : 1) * rand(3, 16); z = rand(-30, 55); }
    trees.push({ x, z, s: rand(0.8, 1.5), c: pick(['#3e7b3a', '#4f8f45', '#2f6b37', '#5a9a4c']) });
  }

  // ========== Gộp instanced mesh ==========
  const instanced = (geo, material, items, setup, colorOf, shadows = true) => {
    const im = new THREE.InstancedMesh(geo, material, items.length);
    const d = new THREE.Object3D();
    items.forEach((it, i) => {
      d.position.set(0, 0, 0);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
      setup(it, d);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
      if (colorOf) im.setColorAt(i, new THREE.Color(colorOf(it)));
    });
    im.castShadow = shadows;
    im.receiveShadow = true;
    scene.add(im);
    return im;
  };
  const chairGeo = chairGeometry();
  instanced(chairGeo, mat('#fdfcf8'), ceremonyChairs, (c, d) => { d.position.set(c.x, 0, c.z); d.rotation.y = c.ry; });
  instanced(chairGeo, new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.6, roughness: 0.35 }), banquetChairs, (c, d) => { d.position.set(c.x, 0, c.z); d.rotation.y = c.ry; });
  instanced(new THREE.CylinderGeometry(0.17, 0.15, 0.02, 16), mat('#ffffff', { roughness: 0.3 }), plates, (p, d) => d.position.set(p.x, 0.78, p.z), null, false);
  instanced(new THREE.CircleGeometry(0.07, 6), new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide }), petals, (p, d) => { d.position.set(p.x, 0.04, p.z); d.rotation.set(-Math.PI / 2, 0, rand(0, 6)); }, (p) => p.c, false);
  instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }), flowers, (f, d) => { d.position.set(f.x, f.y, f.z); d.scale.setScalar(f.s); }, (f) => f.c, false);
  instanced(new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe6a3').multiplyScalar(2.6) }), bulbs, (b, d) => d.position.copy(b), null, false);
  instanced(new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6), mat('#6b4a32'), trees, (t, d) => { d.position.set(t.x, 1.2 * t.s, t.z); d.scale.setScalar(t.s); });
  instanced(new THREE.IcosahedronGeometry(1.9, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true }), trees, (t, d) => { d.position.set(t.x, 3.4 * t.s, t.z); d.scale.set(t.s, t.s * 1.25, t.s); d.rotation.y = t.x; }, (t) => t.c);

  // ========== Đèn ấm từng khu ==========
  for (const [x, y, z, c, i] of [[0, 5, 6, '#ffd59e', 70], [0, 4, 33, '#ffd59e', 40], [-31, 5, 4, '#ffd59e', 90], [-31, 4, 34, '#ffc6d9', 50]]) {
    const l = new THREE.PointLight(c, i, 32);
    l.position.set(x, y, z);
    scene.add(l);
  }

  function heightAt(x, z) {
    if (x > 22 && x < 40 && z > -14 && z < -6) return 1;
    if (x > 28 && x < 34 && z >= -6 && z < -3.5) return 1 - (z + 6) / 2.5;
    if (x * x + (z + 8) * (z + 8) < 3.5 * 3.5) return 0.25;
    return 0;
  }

  function resolve(p, r = 0.35) {
    for (const c of circles) {
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const m = c.r + r;
      const d2 = dx * dx + dz * dz;
      if (d2 < m * m) {
        const d = Math.sqrt(d2) || 1e-4;
        p.x = c.x + (dx / d) * m;
        p.z = c.z + (dz / d) * m;
      }
    }
    for (const b of boxes) {
      if (p.y > b.h) continue;
      const x0 = b.x0 - r, x1 = b.x1 + r, z0 = b.z0 - r, z1 = b.z1 + r;
      if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) {
        const pen = [p.x - x0, x1 - p.x, p.z - z0, z1 - p.z];
        const i = pen.indexOf(Math.min(...pen));
        if (i === 0) p.x = x0; else if (i === 1) p.x = x1; else if (i === 2) p.z = z0; else p.z = z1;
      }
    }
    p.x = Math.min(BOUNDS.x1, Math.max(BOUNDS.x0, p.x));
    p.z = Math.min(BOUNDS.z1, Math.max(BOUNDS.z0, p.z));
  }

  return {
    zoneMeshes,
    tables,
    chairs: [...ceremonyChairs.map((c) => ({ ...c, kind: 'ceremony' })), ...banquetChairs.map((c) => ({ ...c, kind: 'banquet' }))],
    cake: new THREE.Vector3(-31, 0, -12.3),
    heartFrame: { pos: new THREE.Vector3(-23.5, 2.35, 35.5), ry: -0.5 },
    balloonSpots: balloonGroups.map((g) => g.position.clone()),
    partyBoost(v = 1) { boost = Math.max(boost, v); },
    danceFloor: { x0: DF.x0 + 0.6, x1: DF.x1 - 0.6, z0: DF.z0 + 0.6, z1: DF.z1 - 0.6 },
    altar: new THREE.Vector3(0, 1.5, -9),
    heightAt,
    resolve,
    addCircle: circle,
    addBox: box,
    update(t, dt) { for (const u of updaters) u(t, dt); },
  };
}
