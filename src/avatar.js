import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeLabel, makeBubble } from './textures.js';

export const SKIN_TONES = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642'];
export const HAIR_COLORS = ['#1a120c', '#2a1a12', '#4a2e1c', '#7a4a2a', '#c49a6c'];
export const OUTFITS = [
  { id: 'suit', name: '🤵 Vest' },
  { id: 'dress', name: '👗 Đầm' },
  { id: 'aodai', name: '👘 Áo dài' },
];
export const PALETTE = ['#2b3a67', '#1f1f24', '#8b1e3f', '#e5989b', '#f6bd60', '#84a59d', '#5e60ce', '#ffffff', '#d62828', '#90e0ef', '#ffafcc', '#606c38'];

// Biểu cảm: phím số → animation
export const EMOTES = [
  { key: '1', id: 'wave', icon: '👋', name: 'Vẫy tay' },
  { key: '2', id: 'clap', icon: '👏', name: 'Vỗ tay' },
  { key: '3', id: 'dance', icon: '💃', name: 'Quẩy' },
  { key: '4', id: 'toast', icon: '🥂', name: 'Nâng ly' },
  { key: '5', id: 'dance2', icon: '🕺', name: 'Disco' },
  { key: '6', id: 'heart', icon: '💖', name: 'Bắn tim' },
  { key: '7', id: 'cheer', icon: '🙌', name: 'Hò reo' },
  { key: '8', id: 'bow', icon: '🙇', name: 'Cúi chào' },
  { key: '9', id: 'kiss', icon: '😘', name: 'Hôn gió' },
];

const geoCache = {};
const geo = (key, make) => geoCache[key] || (geoCache[key] = make());
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const tmpV = new THREE.Vector3();

// ====== Khung xương (toạ độ lúc đứng thẳng, tính từ mặt đất, mét) ======
// Tỉ lệ người thật ~6.7 đầu: hông 0.9, vai 1.42, cằm 1.53, đỉnh đầu 1.78.
const HIP = 0.9; // khớp háng
const KNEE = 0.47;
const SPINE = 0.98; // eo: thân trên cúi/xoay quanh đây
const SHOULDER = 1.42;
const ELBOW = 1.13;
const WRIST = 0.885;
const NECK = 1.47;

// ====== Dựng hình ======
// Ellipsoid: hình cầu kéo giãn theo 3 trục
const ellipsoid = (rx, ry, rz, w = 16, h = 12) => new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz);
// Khối tròn xoay theo profile [[r, y], ...] (từ dưới lên), dẹt theo trục z để có tiết diện bầu dục
const lathe = (pts, segs = 20, depth = 0.7) => {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)), segs);
  g.scale(1, 1, depth);
  return g;
};
// Ống từ khớp (gốc, bán kính r0) chạy xuống dưới dài len (bán kính r1) – bo tròn hai đầu
const limb = (r0, r1, len, segs = 10) => {
  const g = new THREE.CylinderGeometry(r0, r1, len, segs, 3);
  g.translate(0, -len / 2, 0);
  const cap0 = new THREE.SphereGeometry(r0, segs, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const cap1 = new THREE.SphereGeometry(r1, segs, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, -len, 0);
  return mergeGeometries([g, cap0, cap1]);
};
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0) => {
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  return g.translate(x, y, z);
};
// Biến dạng từng đỉnh: f(v) sửa trực tiếp vector
const warp = (g, f) => {
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    f(v);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
};
// Tô màu đỉnh (cho vật liệu chi tiết dùng chung: mắt, cúc áo, cà vạt...)
const tint = (g, hex) => {
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
};
// Gộp nhiều mảnh cùng vật liệu thành 1 mesh (ít draw call). Mảnh nào thiếu uv/color thì bỏ cho đồng nhất.
const merge = (parts) => {
  const withColor = parts.some((g) => g.attributes.color);
  const list = parts.map((g) => {
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (withColor && !g.attributes.color) tint(g, '#ffffff');
    return g;
  });
  const m = mergeGeometries(list);
  m.computeBoundingSphere();
  return m;
};

// ====== Texture dùng chung ======
let hairTex = null;
function hairBump() {
  if (hairTex) return hairTex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  // Sợi tóc: vệt dọc sáng tối xen kẽ
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 256;
    const l = 40 + Math.random() * 200;
    const y = Math.random() * 256;
    const v = Math.floor(60 + Math.random() * 140);
    ctx.strokeStyle = `rgb(${v},${v},${v})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 3, y + l / 3, x - 3, y + (2 * l) / 3, x + (Math.random() - 0.5) * 6, y + l);
    ctx.stroke();
  }
  hairTex = new THREE.CanvasTexture(c);
  hairTex.wrapS = hairTex.wrapT = THREE.RepeatWrapping;
  hairTex.repeat.set(3, 1);
  return hairTex;
}
let clothTex = null;
function clothBump() {
  if (clothTex) return clothTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(128, 128);
  // Vân vải dệt chéo nhẹ
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const v = 128 + 38 * Math.sin((x + y) * 1.6) * Math.sin((x - y) * 0.4) + (Math.random() - 0.5) * 30;
      const i = (y * 128 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  clothTex = new THREE.CanvasTexture(c);
  clothTex.wrapS = clothTex.wrapT = THREE.RepeatWrapping;
  clothTex.repeat.set(6, 6);
  return clothTex;
}

// Vật liệu dùng chung cho mọi nhân vật (không dispose theo từng người)
const SHARED = {};
const shared = (key, make) => SHARED[key] || (SHARED[key] = make());
const detailMat = () => shared('detail', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }));
const eyeMat = () => shared('eye', () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }));
const goldMat = () => shared('gold', () => new THREE.MeshStandardMaterial({ color: '#f2d08a', metalness: 0.7, roughness: 0.3 }));

// ====== Các bộ phận (geometry cache theo kiểu dáng) ======
const FEMALE = (L) => L.outfit !== 'suit';

function headParts(fem) {
  return geo(`head-${fem}`, () => {
    // Hộp sọ: ellipsoid thon dần xuống cằm, má đầy, gáy tròn
    const skull = warp(ellipsoid(0.098, 0.128, 0.112, 24, 18), (v) => {
      const ny = v.y / 0.128;
      if (ny < -0.05) {
        const k = ((-0.05 - ny) / 0.95) ** 1.4; // 0 ở gò má → 1 ở cằm
        v.x *= 1 - k * (fem ? 0.3 : 0.2);
        v.z *= 1 - k * 0.12;
        if (v.z > 0) v.z += k * 0.01; // cằm hơi nhô
      }
      if (v.z < 0) v.z *= 1.06; // gáy
      if (v.y < 0) v.y *= 0.86; // mặt dưới ngắn lại (mũi → cằm)
      // Hốc mắt hơi lõm
      const dx = Math.abs(v.x) - 0.04;
      const dy = v.y - 0.018;
      if (v.z > 0.07) v.z -= 0.009 * Math.exp(-(dx * dx + dy * dy) / 0.0006);
    }).translate(0, 0.165, 0.005);
    const neck = new THREE.CylinderGeometry(fem ? 0.043 : 0.054, fem ? 0.05 : 0.064, 0.14, 14).translate(0, 0.05, -0.01);
    const nose = ellipsoid(0.0085, 0.032, 0.012, 10, 10).rotateX(-0.3).translate(0, 0.15, 0.105);
    const noseTip = ellipsoid(0.0105, 0.0095, 0.0095, 10, 8).translate(0, 0.13, 0.114);
    const wings = [-1, 1].map((s) => ellipsoid(0.0055, 0.0052, 0.006, 8, 6).translate(s * (fem ? 0.009 : 0.0105), 0.1275, 0.106));
    const ears = [-1, 1].map((s) => at(ellipsoid(0.014, 0.03, 0.022, 10, 8), s * 0.097, 0.158, -0.005, 0, s * 0.3, 0));
    return {
      skin: merge([skull, neck, nose, noseTip, ...wings, ...ears]),
      // Lông mày
      brows: merge([-1, 1].map((s) => at(new THREE.CapsuleGeometry(fem ? 0.0032 : 0.0048, 0.026, 3, 6), s * 0.038, 0.199, 0.103, 0, s * -0.25, s * (Math.PI / 2 - (fem ? 0.18 : 0.1))))),
    };
  });
}

function eyeGeo(fem) {
  return geo(`eye-${fem}`, () => {
    const parts = [
      tint(ellipsoid(0.0165, 0.0105, 0.011, 14, 10), '#efe9e2'),
      tint(new THREE.CircleGeometry(0.0085, 18).scale(1, 0.95, 1).translate(0, -0.0005, 0.0105), '#3b2414'),
      tint(new THREE.CircleGeometry(0.0042, 14).translate(0, -0.0005, 0.0108), '#0b0706'),
      tint(new THREE.CircleGeometry(0.0019, 8).translate(0.0028, 0.003, 0.0111), '#ffffff'),
    ];
    // Mi mắt trên (nữ: hàng mi dày hơn)
    parts.push(tint(at(new THREE.TorusGeometry(0.0158, fem ? 0.0026 : 0.0016, 4, 14, Math.PI).scale(1, 0.72, 1), 0, -0.0005, 0.003, 0.55, 0, 0), '#120c0a'));
    return merge(parts);
  });
}

function mouthGeo() {
  return geo('mouth', () => {
    // Môi trên / dưới: hai khối dẹt cong nhẹ thành nụ cười
    const smile = (v) => { v.y += v.x * v.x * 9; };
    const upper = warp(ellipsoid(0.02, 0.0042, 0.006, 16, 8), smile).translate(0, 0.0022, 0);
    const lower = warp(ellipsoid(0.016, 0.0052, 0.0065, 16, 8), smile).translate(0, -0.0046, 0);
    return merge([upper, lower]);
  });
}

function hairParts(L) {
  const style = L.veil ? 'bun' : L.groom ? 'undercut' : L.outfit === 'suit' ? 'short' : L.outfit === 'aodai' ? 'long' : 'wavy';
  return geo(`hair-${style}`, () => {
    const parts = [];
    const undercut = style === 'undercut';
    const short = style === 'short' || undercut;
    // Lớp tóc ôm đầu: đỉnh bán cầu, đỉnh nào nằm dưới đường chân tóc thì được kéo lên bám theo đường đó
    // → chân tóc cong mềm: cao ở trán, thấp dần về mai/gáy (nữ: phủ hai bên má xuống tới hàm)
    const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const cap = warp(new THREE.SphereGeometry(1, 30, 18, 0, Math.PI * 2, 0, Math.PI * 0.7), (v) => {
      const h = Math.hypot(v.x, v.z) || 1;
      const f = v.z / h; // 1 = phía trước, -1 = sau gáy
      const yh = short
        ? (f > 0 ? 0.62 * smooth(0.15, 0.85, f) - 0.02 : -0.02 - 0.5 * smooth(0, 0.8, -f))
        : (f > 0 ? -0.62 + 1.22 * smooth(0.5, 1.0, f) : -0.62);
      if (v.y < yh) {
        const r = Math.sqrt(Math.max(0, 1 - yh * yh));
        v.set((v.x / h) * r, yh, (v.z / h) * r);
      }
    });
    if (undercut) cap.scale(0.1015, 0.1315, 0.1215).translate(0, 0.1665, -0.002); // cạo sát: ôm sọ
    else if (short) cap.scale(0.106, 0.134, 0.124).translate(0, 0.168, -0.003);
    else cap.scale(0.122, 0.142, 0.134).translate(0, 0.166, -0.008);
    if (!undercut) parts.push(cap);
    if (undercut) {
      // Phần tóc dài trên đỉnh, vuốt ngược ra sau và hất sang phải, rẽ ngôi bên trái
      parts.push(at(ellipsoid(0.082, 0.05, 0.112, 20, 12), 0.01, 0.262, -0.004, 0.12, 0, -0.04));
      parts.push(at(ellipsoid(0.07, 0.038, 0.052, 16, 10), 0.012, 0.272, 0.072, -0.55, 0, -0.08));
      // Các lọn chải tạo vân
      for (let i = 0; i < 6; i++) {
        const x = -0.045 + i * 0.019;
        parts.push(at(ellipsoid(0.013, 0.011, 0.1, 8, 6), x + 0.01, 0.3 - Math.abs(x - 0.008) * 0.55, 0.0, 0.1, x * 1.5, -x * 0.6));
      }
    } else if (short) {
      // Mái vuốt nhẹ lên, hơi lệch, tóc mai gọn
      parts.push(at(ellipsoid(0.1, 0.032, 0.1, 18, 10), 0.004, 0.252, 0.012, -0.16, 0, -0.04));
      parts.push(at(ellipsoid(0.075, 0.022, 0.035, 14, 8), 0.01, 0.252, 0.074, -0.4, 0, -0.1));
      for (const s of [-1, 1]) parts.push(at(ellipsoid(0.01, 0.026, 0.018, 8, 6), s * 0.097, 0.17, 0.04));
    }
    if (style === 'bun') {
      // Búi tóc cô dâu sau gáy
      parts.push(at(ellipsoid(0.062, 0.052, 0.048, 16, 12), 0, 0.2, -0.122));
      parts.push(at(new THREE.TorusGeometry(0.042, 0.016, 8, 18), 0, 0.2, -0.138));
    }
    const res = { cap: merge(parts), fade: undercut ? cap : null };
    if (style === 'long' || style === 'wavy') {
      // Tóc dài xoã sau lưng (gắn vào đầu, có thể đung đưa)
      const len = style === 'long' ? 0.5 : 0.3;
      const back = warp(new THREE.CylinderGeometry(1, 1, len, 26, 12, true, Math.PI * 0.42, Math.PI * 1.16), (v) => {
        const t = (len / 2 - v.y) / len; // 0 trên → 1 dưới
        const w = 0.12 + t * 0.025 - (style === 'long' ? t * t * 0.045 : 0);
        const wave = style === 'wavy' ? Math.sin(t * 12 + Math.abs(v.x) * 6) * 0.008 * t : 0;
        v.x *= w;
        v.z = v.z * (0.128 - t * 0.04) - 0.008 - t * 0.05 + wave;
      });
      back.translate(0, 0.19 - len / 2, 0);
      res.long = back;
    }
    return res;
  });
}

// Kính gọng đen vuông bản to (chú rể): tròng vuông bo góc, cầu kính, càng kính vòng ra sau tai
// Tròng hình siêu elip (|x/a|^n + |y/b|^n = 1): n càng lớn càng vuông
class SquircleCurve extends THREE.Curve {
  constructor(a, b, n = 5) { super(); this.a = a; this.b = b; this.e = 2 / n; }
  getPoint(t, target = new THREE.Vector3()) {
    const th = t * Math.PI * 2;
    const c = Math.cos(th);
    const s = Math.sin(th);
    return target.set(this.a * Math.sign(c) * Math.abs(c) ** this.e, this.b * Math.sign(s) * Math.abs(s) ** this.e, 0);
  }
}
function glassesParts() {
  return geo('glasses', () => {
    const frame = [];
    const lens = [];
    const y = 0.172;
    const z = 0.118;
    const A = 0.026; // nửa bề ngang tròng
    const B = 0.019; // nửa chiều cao tròng
    const cx0 = 0.036;
    const black = '#121214';
    for (const s of [-1, 1]) {
      const cx = s * cx0;
      const curve = new SquircleCurve(A, B, 5);
      frame.push(tint(at(new THREE.TubeGeometry(curve, 48, 0.0028, 6, true), cx, y, z, 0, s * 0.12, 0), black));
      // Viền trên dày hơn
      const top = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(-A * 0.92, B - 0.0006, 0), new THREE.Vector3(A * 0.92, B - 0.0006, 0)), 4, 0.0036, 6, false);
      frame.push(tint(at(top, cx, y, z + 0.0005, 0, s * 0.12, 0), black));
      const pts = [];
      for (let i = 0; i < 48; i++) { const p = curve.getPoint(i / 48); pts.push(new THREE.Vector2(p.x, p.y)); }
      lens.push(at(new THREE.ShapeGeometry(new THREE.Shape(pts)), cx, y, z - 0.0005, 0, s * 0.12, 0));
      // Càng kính: từ mép ngoài tròng chạy ra sau tới tai
      const a = new THREE.Vector3(s * (cx0 + A * Math.cos(0.12) + 0.001), y + B * 0.55, z - A * Math.sin(0.12) - 0.002);
      const b = new THREE.Vector3(s * 0.106, y + 0.004, -0.012);
      const d = b.clone().sub(a);
      const arm = new THREE.BoxGeometry(0.0032, 0.0055, d.length());
      frame.push(tint(at(arm, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, 0, Math.atan2(d.x, d.z), 0), black));
      // Bản lề + đệm mũi
      frame.push(tint(new THREE.BoxGeometry(0.007, 0.008, 0.007).translate(a.x - s * 0.001, a.y, a.z + 0.002), black));
      frame.push(tint(ellipsoid(0.0028, 0.0045, 0.0016, 6, 4).translate(s * 0.0115, y - 0.008, z - 0.009), '#d8d8dc'));
    }
    // Cầu kính thẳng ngang
    const gap = cx0 - A * Math.cos(0.12);
    frame.push(tint(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(-gap - 0.001, y + B * 0.45, z + 0.001), new THREE.Vector3(gap + 0.001, y + B * 0.45, z + 0.001)), 2, 0.0026, 6, false), black));
    return { frame: merge(frame), lens: merge(lens) };
  });
}

// Thân trên theo trang phục, toạ độ tuyệt đối (sẽ dời về khớp eo khi gắn)
function torsoParts(L) {
  const fem = FEMALE(L);
  const key = `torso-${L.outfit}-${!!L.groom}-${!!L.veil}`;
  return geo(key, () => {
    const out = { cloth: [], trim: [], skin: [], detail: [], gold: [] };
    if (L.outfit === 'suit') {
      // Áo vest: vai rộng, eo thon (dáng chữ V)
      out.cloth.push(lathe([[0.12, 0.88], [0.135, 0.97], [0.142, 1.05], [0.16, 1.2], [0.172, 1.32], [0.172, 1.39], [0.152, 1.435], [0.1, 1.465], [0.06, 1.48]], 24, 0.66));
      // Sơ mi trắng lộ ra ở cổ chữ V + cổ áo
      const vTop = 1.455;
      const vBot = 1.235;
      // Mặt ngực áo vest (bán kính theo độ cao, khớp với profile lathe ở trên) – dùng để dán sơ mi/ve áo sát bề mặt
      const chestZ = (x, y, lift) => {
        const r = y > 1.435 ? 0.152 - (y - 1.435) * 1.7 : y > 1.39 ? 0.172 - (y - 1.39) * 0.44 : 0.165 + Math.min(1, (y - 1.2) / 0.12) * 0.007;
        return r * 0.66 * Math.sqrt(Math.max(0, 1 - (x / r) ** 2)) + lift;
      };
      const shirt = warp(new THREE.PlaneGeometry(1, 1, 6, 10), (v) => {
        // Tam giác chữ V: bề ngang thu hẹp dần xuống đáy
        const t = v.y + 0.5;
        v.x *= 0.116 * t;
        v.y = vBot + t * (vTop - vBot);
        v.z = chestZ(v.x, v.y, 0.0015);
      });
      out.trim.push(shirt);
      out.trim.push(at(new THREE.CylinderGeometry(0.058, 0.066, 0.045, 16, 1, true), 0, 1.475, -0.008, -0.12, 0, 0));
      // Ve áo chạy dọc hai cạnh chữ V
      for (const s of [-1, 1]) {
        // Ve áo bám theo mặt ngực: uốn từng đỉnh về sát bề mặt thân (r theo độ cao)
        const lap = warp(at(new THREE.BoxGeometry(0.03, 0.235, 0.006, 1, 8, 1), s * 0.044, (vTop + vBot) / 2, 0, 0, 0, -s * 0.27), (v) => {
          v.z += chestZ(v.x, v.y, 0.0035);
        });
        out.cloth.push(lap);
      }
      if (L.groom) {
        // Nơ cổ + hoa cài áo
        out.detail.push(tint(at(ellipsoid(0.026, 0.013, 0.008, 10, 6), -0.022, 1.432, 0.108, 0, 0, 0.2), '#1a1a1f'));
        out.detail.push(tint(at(ellipsoid(0.026, 0.013, 0.008, 10, 6), 0.022, 1.432, 0.108, 0, 0, -0.2), '#1a1a1f'));
        out.detail.push(tint(ellipsoid(0.009, 0.01, 0.008, 8, 6).translate(0, 1.432, 0.111), '#111114'));
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          out.detail.push(tint(ellipsoid(0.014, 0.014, 0.008, 8, 6).translate(0.1 + Math.cos(a) * 0.012, 1.34 + Math.sin(a) * 0.012, 0.118), '#fff4f0'));
        }
        out.detail.push(tint(ellipsoid(0.008, 0.008, 0.008, 6, 4).translate(0.1, 1.34, 0.124), '#ffd166'));
        out.detail.push(tint(at(new THREE.BoxGeometry(0.008, 0.04, 0.006), 0.1, 1.315, 0.118, 0, 0, 0.3), '#5a8f4a'));
      } else {
        // Cà vạt thắt nút
        out.detail.push(tint(at(new THREE.CylinderGeometry(0.013, 0.009, 0.022, 6).scale(1, 1, 0.5), 0, 1.438, 0.107), '#8b1e3f'));
        const tie = new THREE.CylinderGeometry(0.011, 0.022, 0.19, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.2);
        out.detail.push(tint(at(tie, 0, 1.33, 0.116, -0.03, 0, 0), '#8b1e3f'));
        // Khăn cài túi ngực
        out.detail.push(tint(at(new THREE.ConeGeometry(0.018, 0.025, 3), -0.1, 1.335, 0.105, -0.15, 0, 0), '#ffffff'));
      }
      // Cúc áo
      for (const y of [1.17, 1.1]) out.detail.push(tint(new THREE.SphereGeometry(0.009, 8, 6).translate(0, y, 0.098), '#141418'));
      // Đường túi áo
      for (const s of [-1, 1]) out.cloth.push(at(new THREE.BoxGeometry(0.07, 0.008, 0.01), s * 0.085, 1.04, 0.093, 0, s * -0.35, 0));
    } else if (L.outfit === 'dress') {
      // Thân váy ôm, ngực, eo nhỏ
      out.cloth.push(lathe([[0.1, 0.88], [0.112, 0.97], [0.106, 1.04], [0.118, 1.13], [0.14, 1.22], [0.143, 1.27], [0.134, 1.33], [0.128, 1.345]], 22, 0.72));
      // Vai, ngực, cổ để trần
      out.skin.push(lathe([[0.12, 1.31], [0.145, 1.36], [0.152, 1.405], [0.13, 1.44], [0.075, 1.47], [0.048, 1.49]], 22, 0.62));
      // Dây chuyền ngọc trai
      for (let i = 0; i <= 14; i++) {
        const a = Math.PI * (0.15 + (i / 14) * 0.7);
        out.detail.push(tint(new THREE.SphereGeometry(0.0055, 6, 4).translate(Math.cos(a) * 0.06, 1.405 - Math.sin(a) * 0.035, Math.sin(a) * 0.07), '#fbf6ee'));
      }
      if (L.veil) {
        // Đai lưng ánh vàng + hoa trên váy cưới
        out.gold.push(lathe([[0.108, 1.025], [0.11, 1.05], [0.108, 1.075]], 22, 0.73));
      } else {
        out.trim.push(lathe([[0.108, 1.03], [0.11, 1.05], [0.108, 1.065]], 22, 0.73));
      }
    } else {
      // Áo dài: ôm sát, cổ cao (cổ đứng), cúc chéo bên phải
      out.cloth.push(lathe([[0.11, 0.88], [0.115, 0.97], [0.108, 1.04], [0.118, 1.13], [0.138, 1.22], [0.14, 1.28], [0.15, 1.37], [0.14, 1.415], [0.1, 1.45], [0.05, 1.47]], 22, 0.7));
      out.cloth.push(new THREE.CylinderGeometry(0.045, 0.048, 0.06, 16).translate(0, 1.49, -0.005));
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        out.gold.push(new THREE.SphereGeometry(0.0065, 6, 4).translate(0.03 + t * 0.085, 1.45 - t * 0.12, 0.095 - t * 0.02 + Math.sin(t * Math.PI) * 0.01));
      }
    }
    // Bờ vai tròn nối thân với cánh tay
    const sh = L.outfit === 'suit' ? [0.168, 1.405, 0.07, 0.052, 0.07] : [0.146, 1.388, 0.058, 0.047, 0.053];
    for (const s of [-1, 1]) (L.outfit === 'dress' ? out.skin : out.cloth).push(ellipsoid(sh[2], sh[3], sh[4], 14, 10).translate(s * sh[0], sh[1], -0.005));
    for (const k of Object.keys(out)) out[k] = out[k].length ? merge(out[k]) : null;
    return out;
  });
}

// Hông + phần dưới (váy, vạt áo) gắn vào thân (không cúi theo eo)
function hipParts(L) {
  return geo(`hips-${L.outfit}-${!!L.veil}`, () => {
    const out = { cloth: null, trim: null, skirt: null, gown: null };
    if (L.outfit === 'suit') {
      out.trim = lathe([[0.15, 0.8], [0.158, 0.88], [0.14, 0.98]], 20, 0.72);
      // Tà áo vest phủ xuống hông
      out.cloth = lathe([[0.172, 0.79], [0.17, 0.88], [0.146, 0.98]], 22, 0.72);
    } else if (L.outfit === 'aodai') {
      out.trim = lathe([[0.15, 0.78], [0.162, 0.87], [0.12, 0.98]], 20, 0.72);
    } else if (L.veil) {
      // Váy cưới: chuông xoè chạm đất, có nếp gấp và đuôi váy kéo dài phía sau
      const g = lathe([[0.78, 0.01], [0.74, 0.08], [0.62, 0.3], [0.45, 0.55], [0.28, 0.78], [0.18, 0.9], [0.118, 0.99]], 48, 1);
      out.gown = warp(g, (v) => {
        const t = clamp((0.99 - v.y) / 0.98, 0, 1);
        const a = Math.atan2(v.z, v.x);
        const fold = 1 + Math.sin(a * 14) * 0.045 * t * t;
        const nx = v.x * fold;
        let nz = v.z * fold * 0.9;
        if (nz < 0) nz -= t * t * t * 0.75 * (-Math.sin(a)) ** 2; // đuôi váy
        v.set(nx, v.y < 0.08 && nz < -0.5 ? v.y * 0.4 : v.y, nz);
      });
    } else {
      // Váy xoè ngang gối, có nếp
      const g = lathe([[0.36, 0.5], [0.32, 0.62], [0.24, 0.78], [0.16, 0.9], [0.114, 0.99]], 40, 0.85);
      out.skirt = warp(g, (v) => {
        const t = clamp((0.99 - v.y) / 0.49, 0, 1);
        const a = Math.atan2(v.z, v.x);
        const fold = 1 + Math.sin(a * 11) * 0.06 * t * t;
        v.x *= fold;
        v.z *= fold;
      });
      out.skirt.translate(0, -0.99, 0); // gốc ở eo để xoay quanh eo
    }
    return out;
  });
}

function armParts(L, side) {
  const fem = FEMALE(L);
  return geo(`arm-${L.outfit}-${!!L.veil}-${side}`, () => {
    const up = L.outfit === 'suit' ? 0.052 : fem ? 0.038 : 0.045;
    const upper = limb(up * 1.05, up * 0.82, SHOULDER - ELBOW);
    const fore = limb(up * 0.82, up * 0.62, ELBOW - WRIST);
    // Bàn tay: lòng bàn tay + ngón khép + ngón cái
    const palm = ellipsoid(0.025, 0.042, 0.014, 12, 10).translate(0, -0.042, 0);
    const fingers = ellipsoid(0.021, 0.032, 0.011, 10, 8).translate(0, -0.088, 0.003);
    const thumb = at(new THREE.CapsuleGeometry(0.008, 0.03, 3, 6), side * -0.022, -0.045, 0.012, 0.3, 0, side * -0.5);
    const hand = merge([palm, fingers, thumb]).scale(fem ? 0.88 : 1, fem ? 0.9 : 1, fem ? 0.88 : 1).translate(0, -(ELBOW - WRIST) + 0.005, 0);
    const cuff = L.outfit === 'suit' ? new THREE.CylinderGeometry(up * 0.66, up * 0.66, 0.025, 12).translate(0, -(ELBOW - WRIST) + 0.01, 0) : null;
    return { upper, fore, hand, cuff };
  });
}

function legParts(L) {
  const fem = FEMALE(L);
  return geo(`leg-${L.outfit}`, () => {
    const thighLen = HIP - KNEE;
    const shinLen = KNEE - 0.075;
    let rt = 0.078, rk = 0.055, ra = 0.04;
    if (L.outfit === 'suit') { rt = 0.075; rk = 0.062; ra = 0.058; }
    if (L.outfit === 'aodai') { rt = 0.082; rk = 0.078; ra = 0.082; } // quần ống rộng
    if (L.outfit === 'dress') { rt = 0.068; rk = 0.046; ra = 0.032; }
    const thigh = limb(rt, rk, thighLen, 12);
    const shin = warp(limb(rk, ra, shinLen, 12), (v) => {
      // Bắp chân
      const t = -v.y / shinLen;
      if (L.outfit === 'dress' && v.z < 0) v.z *= 1 + Math.sin(clamp(t * 2.5, 0, Math.PI)) * 0.35;
    });
    let shoe;
    if (fem) {
      // Giày cao gót
      const toe = warp(ellipsoid(0.034, 0.03, 0.08, 12, 8), (v) => { if (v.y < 0) v.y *= 0.4; });
      const sole = at(new THREE.BoxGeometry(0.06, 0.012, 0.16), 0, -0.065, 0.025, 0.25, 0, 0);
      const heel = new THREE.CylinderGeometry(0.008, 0.012, 0.06, 6).translate(0, -0.045, -0.045);
      shoe = merge([at(toe, 0, -0.045, 0.045, 0.25, 0, 0), sole, heel]).translate(0, -shinLen, 0);
    } else {
      const upper = warp(ellipsoid(0.048, 0.042, 0.13, 14, 10), (v) => { if (v.y < 0) v.y *= 0.35; if (v.z < -0.05) v.y *= 1.2; });
      const sole = new THREE.BoxGeometry(0.094, 0.018, 0.26).translate(0, -0.016, 0.0);
      shoe = merge([upper, sole]).translate(0, -shinLen - 0.04, 0.04);
    }
    return { thigh, shin, shoe };
  });
}

// Vạt áo dài: tấm vải thon dài, cong ôm theo người, gốc ở eo
function flapGeo(front) {
  return geo(`flap-${front}`, () => {
    const len = 0.76;
    const g = new THREE.PlaneGeometry(1, len, 10, 14);
    g.translate(0, -len / 2, 0);
    return warp(g, (v) => {
      const t = -v.y / len;
      const w = 0.22 + Math.min(t, 0.25) * 0.4 + t * 0.03;
      v.x *= w;
      const d = 0.082 + Math.min(t, 0.25) * 0.2 + t * 0.02;
      v.z = (front ? 1 : -1) * (d - v.x * v.x * 2.2);
      if (!front) v.x = -v.x; // giữ mặt ngoài quay ra
    });
  });
}

export class Avatar {
  constructor(look = {}, name = '', sub = '') {
    this.look = { outfit: 'suit', color: '#2b3a67', skin: 1, hair: '#2a1a12', ...look };
    const L = this.look;
    const fem = FEMALE(L);
    this.root = new THREE.Group();
    this.root.userData.avatar = this;
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.t = Math.random() * 10;
    this.phase = 0;
    this.anim = 'idle';
    this.prevAnim = 'idle';
    this.zoneId = null;
    this.bubbleAllowed = true;
    this.materials = [];
    this.blink = 2 + Math.random() * 3;
    this.squash = 0;
    this.lookTarget = null;
    this.held = null;

    const m = (o, Kind = THREE.MeshStandardMaterial) => {
      const mat = new Kind(o);
      this.materials.push(mat);
      return mat;
    };
    const skinColor = new THREE.Color(SKIN_TONES[L.skin] ?? SKIN_TONES[1]);
    // Da: sheen đỏ ấm giả tán xạ dưới da, viền sáng mềm
    const skin = m({ color: skinColor, roughness: 0.52, sheen: 0.18, sheenRoughness: 0.55, sheenColor: new THREE.Color('#ffc4b0') }, THREE.MeshPhysicalMaterial);
    // Vải: sheen cho cảm giác vải thật (lụa áo dài bóng hơn, vest mịn hơn)
    const silk = L.outfit === 'aodai' || L.veil;
    const clothColor = new THREE.Color(L.color);
    const cloth = m({
      color: clothColor,
      roughness: silk ? 0.42 : L.outfit === 'suit' ? 0.72 : 0.55,
      sheen: silk ? 0.8 : 0.5,
      sheenRoughness: silk ? 0.3 : 0.7,
      sheenColor: clothColor.clone().lerp(new THREE.Color('#ffffff'), 0.5),
      bumpMap: L.outfit === 'suit' ? clothBump() : null,
      bumpScale: 0.6,
    }, THREE.MeshPhysicalMaterial);
    const trimColor = L.outfit === 'suit' ? '#f6f6f2' : L.outfit === 'aodai' ? '#fbfaf6' : clothColor.clone().multiplyScalar(0.8);
    const trim = m({ color: trimColor, roughness: 0.6, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff') }, THREE.MeshPhysicalMaterial);
    const pants = L.outfit === 'suit'
      ? m({ color: L.groom ? '#16161b' : clothColor.clone().multiplyScalar(0.55).lerp(new THREE.Color('#202026'), 0.5), roughness: 0.7, sheen: 0.4, sheenRoughness: 0.7, sheenColor: new THREE.Color('#8890a0'), bumpMap: clothBump(), bumpScale: 0.5 }, THREE.MeshPhysicalMaterial)
      : trim;
    const hairColor = new THREE.Color(L.hair);
    // Tóc: bóng theo sợi, có ánh sáng viền
    const hair = m({ color: hairColor, roughness: 0.45, bumpMap: hairBump(), bumpScale: 1.2, sheen: 1, sheenRoughness: 0.35, sheenColor: hairColor.clone().lerp(new THREE.Color('#d9b38c'), 0.45) }, THREE.MeshPhysicalMaterial);
    const shoeMat = fem
      ? m({ color: L.veil ? '#f4ecdf' : clothColor.clone().multiplyScalar(0.85), roughness: 0.3, metalness: 0.1 })
      : m({ color: '#121214', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15 }, THREE.MeshPhysicalMaterial);
    const lipMat = m({ color: fem ? '#c24d5f' : skinColor.clone().lerp(new THREE.Color('#9e4a4a'), 0.45), roughness: 0.35 });
    const innerMouth = shared('innerMouth', () => new THREE.MeshStandardMaterial({ color: '#4a1a1e', roughness: 0.8 }));

    const mesh = (g, mat, parent, shadow = true) => {
      if (!g) return null;
      const o = new THREE.Mesh(g, mat);
      o.castShadow = shadow;
      parent.add(o);
      return o;
    };
    const pivot = (x, y, z, parent, absY = 0) => {
      const p = new THREE.Group();
      p.position.set(x, y - absY, z);
      parent.add(p);
      return p;
    };
    // Geometry dựng theo toạ độ tuyệt đối → dời về toạ độ của khớp
    const local = (g, oy, key) => g && geo(`${key}@${oy}`, () => g.clone().translate(0, -oy, 0));

    // ---- Chân (khớp háng → khớp gối) ----
    const legMat = L.outfit === 'dress' ? skin : pants;
    const LP = legParts(L);
    const hipX = fem ? 0.08 : 0.088;
    this.legL = pivot(-hipX, HIP, 0, this.body);
    this.legR = pivot(hipX, HIP, 0, this.body);
    this.shinL = pivot(0, KNEE, 0, this.legL, HIP);
    this.shinR = pivot(0, KNEE, 0, this.legR, HIP);
    for (const [leg, shin] of [[this.legL, this.shinL], [this.legR, this.shinR]]) {
      mesh(LP.thigh, legMat, leg);
      mesh(LP.shin, legMat, shin);
      mesh(LP.shoe, shoeMat, shin);
    }
    // ---- Hông, váy, vạt áo (gắn vào thân, không cúi theo eo) ----
    const HP = hipParts(L);
    mesh(HP.trim, pants, this.body);
    mesh(HP.cloth, cloth, this.body);
    if (HP.gown) this.gown = mesh(HP.gown, cloth, this.body);
    if (HP.skirt) {
      this.skirt = mesh(HP.skirt, cloth, this.body);
      this.skirt.position.y = 0.99;
    }
    if (L.outfit === 'aodai') {
      this.flapF = pivot(0, 1.0, 0, this.body);
      this.flapB = pivot(0, 1.0, 0, this.body);
      const fm = m({ color: clothColor, roughness: 0.42, sheen: 0.8, sheenRoughness: 0.3, sheenColor: clothColor.clone().lerp(new THREE.Color('#ffffff'), 0.5), side: THREE.DoubleSide }, THREE.MeshPhysicalMaterial);
      mesh(flapGeo(true), fm, this.flapF);
      mesh(flapGeo(false), fm, this.flapB);
    }

    // ---- Thân trên (khớp eo) ----
    this.spine = pivot(0, SPINE, 0, this.body);
    const TP = torsoParts(L);
    const tk = `torso-${L.outfit}-${!!L.groom}-${!!L.veil}`;
    mesh(local(TP.cloth, SPINE, `${tk}c`), cloth, this.spine);
    mesh(local(TP.trim, SPINE, `${tk}t`), trim, this.spine);
    mesh(local(TP.skin, SPINE, `${tk}s`), skin, this.spine);
    mesh(local(TP.detail, SPINE, `${tk}d`), detailMat(), this.spine, false);
    mesh(local(TP.gold, SPINE, `${tk}g`), goldMat(), this.spine, false);

    // ---- Đầu (khớp cổ: quay, gật, nghiêng đầu) ----
    this.head = pivot(0, NECK, 0.005, this.spine, SPINE);
    const H = this.head;
    const HD = headParts(fem);
    mesh(HD.skin, skin, H);
    mesh(HD.brows, hair, H, false);
    this.eyes = [];
    for (const s of [-1, 1]) {
      const e = mesh(eyeGeo(fem), eyeMat(), H, false);
      e.position.set(s * 0.039, 0.172, 0.092);
      e.rotation.y = s * 0.12;
      this.eyes.push(e);
    }
    // Má hồng
    const blushMat = shared('blush', () => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,110,130,0.5)');
      g.addColorStop(1, 'rgba(255,110,130,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    });
    for (const s of fem ? [-1, 1] : []) {
      const b = mesh(geo('blush', () => new THREE.PlaneGeometry(0.05, 0.04)), blushMat, H, false);
      b.position.set(s * 0.06, 0.142, 0.092);
      b.rotation.y = s * 0.55;
    }
    this.mouth = new THREE.Group();
    this.mouth.position.set(0, 0.109, 0.102);
    this.mouth.rotation.x = -0.15;
    H.add(this.mouth);
    mesh(mouthGeo(), lipMat, this.mouth, false);
    this.mouthIn = mesh(geo('mouthIn', () => new THREE.CircleGeometry(0.013, 14).scale(1, 0.5, 1)), innerMouth, this.mouth, false);
    this.mouthIn.position.set(0, -0.002, 0.003);
    const HR = hairParts(L);
    mesh(HR.cap, hair, H);
    if (HR.fade) {
      // Hai bên + gáy cạo sát: màu tóc pha màu da, mờ, không bóng
      mesh(HR.fade, m({ color: hairColor.clone().lerp(skinColor, 0.12).multiplyScalar(0.6), roughness: 0.9, bumpMap: hairBump(), bumpScale: 0.4 }), H);
    }
    if (L.groom) {
      const GL = glassesParts();
      mesh(GL.frame, shared('glassFrame', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.3 })), H, false);
      mesh(GL.lens, shared('glassLens', () => new THREE.MeshPhysicalMaterial({ color: '#dfeaf2', transparent: true, opacity: 0.16, roughness: 0.02, clearcoat: 1, depthWrite: false })), H, false);
    }
    if (HR.long) this.longHair = mesh(HR.long, hair, H);
    if (L.veil) {
      // Khăn voan mỏng phủ từ búi tóc xuống gần chân + vương miện
      const veil = mesh(
        geo('veil', () => warp(new THREE.CylinderGeometry(0.07, 0.5, 1.45, 24, 6, true, Math.PI * 0.6, Math.PI * 0.8), (v) => {
          const t = (0.725 - v.y) / 1.45;
          v.z -= 0.08 + t * 0.15;
          v.x *= 1 + Math.sin(Math.atan2(v.z, v.x) * 9) * 0.04 * t;
        }).translate(0, -0.52, 0)),
        m({ color: '#ffffff', transparent: true, opacity: 0.32, roughness: 0.5, side: THREE.DoubleSide, depthWrite: false, sheen: 1, sheenColor: new THREE.Color('#ffffff') }, THREE.MeshPhysicalMaterial),
        H, false,
      );
      veil.position.set(0, 0.24, -0.1);
      this.veil = veil;
      const tiara = geo('tiara', () => {
        const parts = [new THREE.TorusGeometry(0.085, 0.004, 5, 24, Math.PI).rotateX(-Math.PI / 2 + 0.35)];
        for (let i = 0; i <= 6; i++) {
          const a = Math.PI * (i / 6);
          const hgt = i === 3 ? 0.02 : 0.012;
          parts.push(new THREE.ConeGeometry(0.005, hgt, 4).translate(Math.cos(a) * 0.085, hgt / 2 + Math.sin(a) * 0.03, Math.sin(a) * 0.08));
        }
        return merge(parts).translate(0, 0.275, -0.005);
      });
      mesh(tiara, goldMat(), H, false);
      const pearls = geo('pearls', () => merge([0, 2, 4, 6].map((i) => {
        const a = Math.PI * (i / 6);
        return tint(new THREE.SphereGeometry(0.006, 6, 4).translate(Math.cos(a) * 0.085, 0.29 + Math.sin(a) * 0.03, Math.sin(a) * 0.08 - 0.005), '#fffaf0');
      })));
      mesh(pearls, detailMat(), H, false);
    }

    // ---- Tay (vai → khuỷu → cổ tay) ----
    const shoulderX = L.outfit === 'suit' ? 0.19 : 0.158;
    const shoulderY = fem ? SHOULDER - 0.03 : SHOULDER - 0.01;
    const sleeveMat = L.outfit === 'dress' ? skin : cloth;
    const arms = [];
    for (const side of [-1, 1]) {
      const AP = armParts(L, side);
      const arm = pivot(side * shoulderX, shoulderY, 0, this.spine, SPINE);
      const fore = pivot(0, ELBOW, 0, arm, SHOULDER);
      mesh(AP.upper, sleeveMat, arm);
      mesh(AP.fore, sleeveMat, fore);
      mesh(AP.cuff, trim, fore, false);
      mesh(AP.hand, skin, fore);
      arms.push([arm, fore]);
    }
    [[this.armL, this.foreL], [this.armR, this.foreR]] = arms;

    // ---- Đạo cụ trên tay phải: ly, điện thoại, micro ----
    const handY = -(ELBOW - WRIST) - 0.07;
    this.glass = new THREE.Group();
    this.glass.position.set(0, handY, 0.04);
    const glassMat = m({ color: '#eef8ff', transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0, clearcoat: 1 }, THREE.MeshPhysicalMaterial);
    mesh(geo('glassBowl', () => new THREE.CylinderGeometry(0.032, 0.018, 0.07, 14, 1, true).translate(0, 0.06, 0)), glassMat, this.glass, false);
    mesh(geo('glassStem', () => merge([new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6).translate(0, 0, 0), new THREE.CylinderGeometry(0.022, 0.022, 0.004, 14).translate(0, -0.03, 0)])), glassMat, this.glass, false);
    this.drinkMat = m({ color: '#f4c430', roughness: 0.15, transparent: true, opacity: 0.85 });
    mesh(geo('drink', () => new THREE.CylinderGeometry(0.029, 0.019, 0.045, 14).translate(0, 0.05, 0)), this.drinkMat, this.glass, false);
    this.phone = new THREE.Group();
    this.phone.position.set(0, handY + 0.02, 0.025);
    mesh(geo('phone', () => new THREE.BoxGeometry(0.07, 0.14, 0.009, 1, 1, 1)), m({ color: '#1c1c22', roughness: 0.25, metalness: 0.5 }), this.phone, false).rotation.x = Math.PI / 2;
    this.mic = new THREE.Group();
    this.mic.position.set(0, handY + 0.02, 0.03);
    mesh(geo('micBody', () => new THREE.CylinderGeometry(0.016, 0.012, 0.17, 10)), m({ color: '#1d1d22', roughness: 0.4, metalness: 0.3 }), this.mic, false).rotation.x = Math.PI / 2;
    mesh(geo('micHead', () => new THREE.SphereGeometry(0.03, 12, 10)), m({ color: '#c0c4cc', metalness: 0.85, roughness: 0.35 }), this.mic, false).position.z = 0.1;
    this.hand = new THREE.Group();
    this.hand.position.set(0, handY, 0.03);
    for (const g of [this.glass, this.phone, this.mic, this.hand]) { g.visible = false; this.foreR.add(g); }
    this.hand.visible = true;

    if (name) this.setLabel(name, sub);
  }

  setLabel(name, sub = '') {
    this.name = name;
    if (this.label) {
      this.root.remove(this.label);
      this.label.material.map.dispose();
      this.label.material.dispose();
    }
    this.label = makeLabel(name, sub, this.look.veil || this.look.groom ? '#ffd166' : '#ff6f91');
    this.label.position.y = 2.2;
    this.root.add(this.label);
  }

  setDrink(color) {
    this.drinkMat.color.set(color);
  }

  // Cầm một vật (VD: bó hoa cưới) trên tay phải
  hold(obj, flip = true) {
    this.drop();
    if (!obj) return;
    this.held = obj;
    obj.position.set(0, 0, 0);
    obj.rotation.set(flip ? Math.PI : 0, 0, 0);
    this.hand.add(obj);
  }

  drop() {
    if (!this.held) return null;
    const o = this.held;
    this.hand.remove(o);
    this.held = null;
    return o;
  }

  handWorld(target = new THREE.Vector3()) {
    this.root.updateMatrixWorld(true);
    return this.hand.getWorldPosition(target);
  }

  say(text, ms = 20000) {
    this.clearBubble();
    this.bubble = makeBubble(text);
    this.bubble.position.y = 2.5;
    this.bubble.scale.multiplyScalar(0.01);
    this.bubbleScale = this.bubble.scale.clone().multiplyScalar(100);
    this.bubbleUntil = performance.now() + ms;
    this.root.add(this.bubble);
  }

  clearBubble() {
    if (!this.bubble) return;
    this.root.remove(this.bubble);
    this.bubble.material.map.dispose();
    this.bubble.material.dispose();
    this.bubble = null;
  }

  update(dt, anim = 'idle', speed = 0) {
    if (anim !== this.anim) {
      if (this.anim === 'jump' && anim !== 'jump') this.squash = 1;
      this.prevAnim = this.anim;
      this.anim = anim;
    }
    this.t += dt;
    const t = this.t;
    // l*: đùi, k*: gối (dương = gập ra sau), a*x/a*z: cánh tay, e*x/e*z: khuỷu (âm = gập ra trước)
    let lL = 0, lR = 0, kL = 0.04, kR = 0.04;
    let aLx = 0.04, aRx = 0.04, aLz = -0.1, aRz = 0.1;
    let eLx = -0.18, eRx = -0.18, eLz = 0, eRz = 0;
    let bob = 0, sway = 0, roll = 0, lean = 0, bend = 0, twist = 0, hipRoll = 0, baseY = 0;
    let headX = 0, headZ = 0, headY = null, mouthOpen = 0, breathe = 1;
    let glass = false, phone = false, mic = false;

    switch (anim) {
      case 'walk': {
        const run = speed > 5.5;
        this.phase += dt * (3 + speed * 1.6);
        const s = Math.sin(this.phase);
        const c = Math.cos(this.phase);
        const amp = run ? 0.75 : 0.45;
        lL = s * amp; lR = -s * amp;
        // Gối gập khi chân đưa ra trước (pha vung chân), thẳng khi đặt xuống
        kL = 0.08 + Math.max(0, -c) * (run ? 1.5 : 0.75) + Math.max(0, s) * 0.15;
        kR = 0.08 + Math.max(0, c) * (run ? 1.5 : 0.75) + Math.max(0, -s) * 0.15;
        aLx = -s * (run ? 0.85 : 0.4); aRx = s * (run ? 0.85 : 0.4);
        eLx = -0.25 - Math.max(0, s) * 0.35 - (run ? 1.0 : 0);
        eRx = -0.25 - Math.max(0, -s) * 0.35 - (run ? 1.0 : 0);
        aLz = run ? -0.15 : -0.08; aRz = -aLz;
        bob = Math.abs(c) * (run ? 0.07 : 0.03) - (run ? 0.04 : 0.01);
        lean = Math.min(0.18, speed * 0.024);
        twist = s * (run ? 0.22 : 0.12); // vai xoay ngược hông
        sway = -s * (run ? 0.1 : 0.06);
        hipRoll = c * 0.04;
        roll = s * 0.02;
        headY = -twist * 0.8;
        break;
      }
      case 'jump':
        lL = -0.8; lR = -0.25; kL = 1.3; kR = 0.5;
        aLz = -1.5; aRz = 1.5; eLx = eRx = -0.4;
        lean = -0.05;
        mouthOpen = 1;
        break;
      case 'wave':
        aRz = 2.05; aRx = -0.25; eRz = 0.85 + Math.sin(t * 9) * 0.4; eRx = -0.25;
        headZ = -0.1; headX = -0.05;
        roll = Math.sin(t * 4.5) * 0.02;
        hipRoll = 0.04;
        mouthOpen = 0.3;
        break;
      case 'clap': {
        const c = Math.abs(Math.sin(t * 7));
        // Hai cẳng tay đưa ra trước ngực, khép vào giữa rồi mở ra
        aLx = aRx = -0.45;
        aLz = -0.05; aRz = 0.05;
        eLx = eRx = -1.25;
        eLz = 0.62 - 0.3 * c; eRz = -eLz;
        bob = c * 0.012;
        headX = 0.05 * c;
        mouthOpen = 0.35;
        break;
      }
      case 'dance': {
        const s = Math.sin(t * 7);
        bob = Math.abs(s) * 0.07 - 0.04;
        aLz = -2.2 - 0.35 * s; aRz = 2.2 - 0.35 * s;
        eLz = -0.5 - 0.3 * s; eRz = 0.5 - 0.3 * s;
        lL = Math.max(0, s) * -0.55; lR = Math.max(0, -s) * -0.55;
        kL = 0.15 + Math.max(0, s) * 0.9; kR = 0.15 + Math.max(0, -s) * 0.9;
        sway = Math.sin(t * 3.5) * 0.3;
        hipRoll = Math.sin(t * 7) * 0.08;
        roll = -Math.sin(t * 7) * 0.05;
        headZ = Math.sin(t * 3.5) * 0.18;
        mouthOpen = 0.6;
        break;
      }
      case 'dance2': {
        const up = Math.sin(t * 4) > 0;
        aRz = up ? 2.6 : 0.6; aRx = up ? 0 : -0.5; eRx = up ? -0.1 : -0.9;
        aLz = up ? -0.4 : -0.9; eLx = up ? -1.4 : -0.6; aLx = -0.3;
        roll = Math.sin(t * 4) * 0.1;
        hipRoll = -Math.sin(t * 4) * 0.12;
        bob = Math.abs(Math.sin(t * 8)) * 0.04 - 0.02;
        lL = up ? -0.35 : 0; kL = up ? 0.6 : 0.1;
        kR = 0.12;
        headZ = up ? 0.15 : -0.1;
        mouthOpen = 0.4;
        break;
      }
      case 'toast': {
        glass = true;
        const c = (Math.sin(t * 2.2) + 1) / 2;
        aRx = -0.55 - c * 0.85; aRz = 0.15;
        eRx = -1.4 + c * 0.7;
        aLx = -0.1; eLx = -0.3;
        headX = -0.12 * c;
        mouthOpen = c > 0.8 ? 0.7 : 0.15;
        break;
      }
      case 'heart':
        aLz = -2.6; aRz = 2.6; aLx = aRx = -0.35;
        eLz = -1.25; eRz = 1.25; eLx = eRx = -0.2;
        bob = Math.abs(Math.sin(t * 3)) * 0.02;
        headZ = Math.sin(t * 1.5) * 0.15;
        hipRoll = Math.sin(t * 1.5) * 0.05;
        mouthOpen = 0.3;
        break;
      case 'cheer': {
        const s = Math.abs(Math.sin(t * 6));
        aLz = -2.5 - 0.25 * s; aRz = 2.5 + 0.25 * s;
        eLz = -0.15; eRz = 0.15; eLx = eRx = -0.3 * (1 - s);
        bob = s * 0.12;
        kL = kR = (1 - s) * 0.4;
        headX = -0.2;
        mouthOpen = 1;
        break;
      }
      case 'bow': {
        const c = Math.max(0, Math.sin(t * 1.6));
        bend = c * 0.7; // cúi từ eo, chân đứng thẳng
        aRx = -0.35 * c; aRz = -0.2 * c; eRx = -1.4 * c;
        aLx = 0.15 * c; eLx = -0.3;
        headX = c * 0.2;
        break;
      }
      case 'kiss': {
        const c = (Math.sin(t * 3) + 1) / 2;
        aRx = -1.1 - c * 0.5; aRz = -0.2 + c * 0.25;
        eRx = -2.1 + c * 1.6;
        headZ = 0.12; headX = -0.05;
        mouthOpen = -1;
        bend = -0.04 + c * 0.06;
        break;
      }
      case 'sit': {
        baseY = 0.56 - HIP;
        lL = lR = -1.5; kL = kR = 1.45;
        aLx = aRx = -0.35; eLx = eRx = -0.95; aLz = -0.05; aRz = 0.05;
        bend = 0.06;
        bob = Math.sin(t * 1.8) * 0.003;
        headZ = Math.sin(t * 0.5) * 0.08;
        headY = Math.sin(t * 0.31) * 0.3 * Math.max(0, Math.sin(t * 0.11));
        break;
      }
      case 'piano': {
        baseY = 0.56 - HIP;
        lL = lR = -1.5; kL = kR = 1.45;
        aLx = -0.75; aRx = -0.75;
        eLx = -0.75 + Math.sin(t * 9) * 0.1; eRx = -0.75 + Math.sin(t * 7 + 1) * 0.1;
        aLz = 0.12 + Math.sin(t * 3) * 0.1; aRz = -0.12 + Math.sin(t * 2.4) * 0.1;
        eLz = 0.3; eRz = -0.3;
        twist = Math.sin(t * 1.5) * 0.1;
        bend = 0.15;
        headZ = Math.sin(t * 1.5) * 0.12; headX = 0.15;
        break;
      }
      case 'catch': {
        const s = Math.abs(Math.sin(t * 5));
        aRz = 2.4; aRx = -0.4; eRx = -0.3;
        aLz = -2.4 - 0.25 * s; eLx = -0.3;
        bob = s * 0.15;
        kL = kR = (1 - s) * 0.5;
        mouthOpen = 1;
        headX = -0.2;
        break;
      }
      case 'selfie':
        phone = true;
        aRx = -1.55; aRz = -0.25; eRx = -0.35;
        aLz = -0.4; aLx = -0.4; eLx = -2.1; eLz = 0.6; // tay trái tạo dáng chữ V cạnh má
        headZ = 0.2; headX = -0.08;
        mouthOpen = 0.5;
        hipRoll = 0.06;
        roll = 0.04;
        break;
      case 'sing': {
        mic = true;
        aRx = -0.75; aRz = -0.3; eRx = -1.95;
        const s = Math.sin(t * 2.4);
        aLz = -1.1 - 0.5 * Math.abs(s); aLx = -0.4; eLx = -0.3;
        sway = s * 0.2;
        headX = -0.1 + Math.abs(Math.sin(t * 4.8)) * -0.1;
        mouthOpen = Math.abs(Math.sin(t * 9));
        bob = Math.abs(Math.sin(t * 4.8)) * 0.02;
        kL = 0.1 + Math.abs(Math.sin(t * 4.8)) * 0.15;
        break;
      }
      case 'hug':
        // Vòng tay ôm người đối diện
        aLx = aRx = -1.2; aLz = -0.12; aRz = 0.12;
        eLx = eRx = -0.45; eLz = 0.75; eRz = -0.75;
        bend = 0.12;
        headZ = 0.25;
        mouthOpen = -1;
        break;
      default: {
        // Đứng thở, dồn trọng tâm sang một chân thỉnh thoảng
        const b = Math.sin(t * 1.8);
        const shift = Math.sin(t * 0.21) > 0.3 ? 1 : 0;
        aLz = -0.1 - 0.015 * b; aRz = 0.1 + 0.015 * b;
        bob = b * 0.003;
        hipRoll = shift * 0.04;
        roll = -shift * 0.025;
        kL = 0.04 + shift * 0.14;
        breathe = 1 + b * 0.012;
        headY = Math.sin(t * 0.37) * 0.35 * Math.max(0, Math.sin(t * 0.13));
      }
    }

    // Nhìn về phía một điểm (người chơi lại gần)
    if (this.lookTarget && anim !== 'sit' && anim !== 'bow' && anim !== 'piano') {
      this.root.getWorldPosition(tmpV);
      const yaw = Math.atan2(this.lookTarget.x - tmpV.x, this.lookTarget.z - tmpV.z);
      const rel = wrapPi(yaw - this.root.rotation.y - this.body.rotation.y - this.spine.rotation.y);
      if (Math.abs(rel) < 1.6) headY = clamp(rel, -0.9, 0.9);
    }

    const k = 14;
    this.legL.rotation.x = damp(this.legL.rotation.x, lL, k, dt);
    this.legR.rotation.x = damp(this.legR.rotation.x, lR, k, dt);
    this.shinL.rotation.x = damp(this.shinL.rotation.x, kL, k, dt);
    this.shinR.rotation.x = damp(this.shinR.rotation.x, kR, k, dt);
    this.armL.rotation.x = damp(this.armL.rotation.x, aLx, k, dt);
    this.armR.rotation.x = damp(this.armR.rotation.x, aRx, k, dt);
    this.armL.rotation.z = damp(this.armL.rotation.z, aLz, k, dt);
    this.armR.rotation.z = damp(this.armR.rotation.z, aRz, k, dt);
    this.foreL.rotation.x = damp(this.foreL.rotation.x, eLx, k, dt);
    this.foreR.rotation.x = damp(this.foreR.rotation.x, eRx, k, dt);
    this.foreL.rotation.z = damp(this.foreL.rotation.z, eLz, k, dt);
    this.foreR.rotation.z = damp(this.foreR.rotation.z, eRz, k, dt);
    this.body.position.y = damp(this.body.position.y, baseY + bob, 20, dt);
    this.body.rotation.y = damp(this.body.rotation.y, sway, 8, dt);
    this.body.rotation.z = damp(this.body.rotation.z, hipRoll, 8, dt);
    this.body.rotation.x = damp(this.body.rotation.x, lean * 0.4, 8, dt);
    this.spine.rotation.x = damp(this.spine.rotation.x, bend + lean * 0.6, 8, dt);
    this.spine.rotation.y = damp(this.spine.rotation.y, twist, 10, dt);
    this.spine.rotation.z = damp(this.spine.rotation.z, roll - hipRoll, 8, dt);
    this.spine.scale.set(breathe, 1, breathe);
    this.head.rotation.x = damp(this.head.rotation.x, headX - bend * 0.3, 8, dt);
    this.head.rotation.z = damp(this.head.rotation.z, headZ, 8, dt);
    this.head.rotation.y = damp(this.head.rotation.y, headY ?? 0, 5, dt);

    // Váy/vạt áo/tóc đung đưa theo chuyển động
    const walking = anim === 'walk';
    const flutter = walking ? Math.sin(this.phase * 2) * 0.06 + Math.min(0.3, speed * 0.035) : 0;
    const sitting = anim === 'sit' || anim === 'piano';
    // Khi ngồi: vạt trước nằm trên đùi, vạt sau trải trên mặt ghế (thu ngắn lại cho khỏi chìa ra ngoài)
    if (this.flapB) {
      this.flapB.rotation.x = damp(this.flapB.rotation.x, sitting ? 1.5 : flutter + Math.max(lL, lR) * 0.4, 10, dt);
      this.flapB.scale.y = damp(this.flapB.scale.y, sitting ? 0.32 : 1, 10, dt);
    }
    if (this.flapF) {
      this.flapF.rotation.x = damp(this.flapF.rotation.x, sitting ? -1.42 : Math.min(lL, lR) * 0.55 + flutter * 0.3, 10, dt);
      this.flapF.scale.y = damp(this.flapF.scale.y, sitting ? 0.62 : 1, 10, dt);
    }
    if (this.skirt) {
      this.skirt.rotation.z = damp(this.skirt.rotation.z, (anim === 'dance' || anim === 'dance2') ? Math.sin(t * 7) * 0.08 : 0, 10, dt);
      this.skirt.rotation.x = damp(this.skirt.rotation.x, sitting ? -0.35 : -flutter * 0.25, 10, dt);
    }
    if (this.longHair) this.longHair.rotation.x = damp(this.longHair.rotation.x, -flutter * 0.5 - (anim === 'jump' ? 0.25 : 0) + bend * 0.5, 10, dt);
    if (this.veil) this.veil.rotation.x = damp(this.veil.rotation.x, -flutter * 0.6, 6, dt);

    // Chớp mắt
    this.blink -= dt;
    let eyeY = 1;
    if (this.blink < 0) {
      eyeY = 0.1;
      if (this.blink < -0.12) this.blink = 1.8 + Math.random() * 3.5;
    }
    if (anim === 'kiss' || anim === 'hug') eyeY = 0.12;
    else if (mouthOpen >= 0.9) eyeY *= 0.65; // cười tít mắt
    for (const e of this.eyes) e.scale.y = eyeY;

    // Miệng: cười / há / chu môi
    if (mouthOpen < 0) {
      this.mouth.scale.set(0.55, 0.9, 1.6);
      this.mouthIn.scale.set(0.4, 0.4, 1);
    } else {
      this.mouth.scale.set(1 + mouthOpen * 0.15, 1 + mouthOpen * 0.9, 1);
      this.mouthIn.scale.set(1, 0.1 + mouthOpen * 1.6, 1);
    }

    // Nhún khi tiếp đất
    if (this.squash > 0) {
      this.squash = Math.max(0, this.squash - dt * 5);
      const s = Math.sin(this.squash * Math.PI) * 0.1;
      this.body.scale.set(1 + s * 0.4, 1 - s, 1 + s * 0.4);
    } else this.body.scale.set(1, 1, 1);

    this.glass.visible = glass;
    this.phone.visible = phone;
    this.mic.visible = mic;

    if (this.bubble) {
      const left = this.bubbleUntil - performance.now();
      if (left <= 0) this.clearBubble();
      else {
        this.bubble.material.opacity = Math.min(1, left / 800);
        this.bubble.visible = this.bubbleAllowed;
        this.bubble.scale.lerp(this.bubbleScale, 1 - Math.exp(-14 * dt));
      }
    }
  }

  dispose() {
    this.clearBubble();
    if (this.label) { this.label.material.map.dispose(); this.label.material.dispose(); }
    for (const m of this.materials) m.dispose();
    this.root.removeFromParent();
  }
}
