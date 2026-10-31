import * as THREE from 'three';
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

export class Avatar {
  constructor(look = {}, name = '', sub = '') {
    this.look = { outfit: 'suit', color: '#2b3a67', skin: 1, hair: '#2a1a12', ...look };
    const L = this.look;
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

    const m = (color, o = {}) => {
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
      this.materials.push(mat);
      return mat;
    };
    const skin = m(SKIN_TONES[L.skin] ?? SKIN_TONES[1], { roughness: 0.65 });
    const cloth = m(L.color, { roughness: 0.55 });
    const hair = m(L.hair, { roughness: 0.8 });
    const dark = m('#1d1d22');
    const white = m('#f8f8f4');
    const add = (g, mat, x, y, z, parent = this.body) => {
      const mesh = new THREE.Mesh(g, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const pivot = (x, y, parent = this.body) => {
      const p = new THREE.Group();
      p.position.set(x, y, 0);
      parent.add(p);
      return p;
    };

    // Chân
    const legMat = L.outfit === 'suit' ? dark : L.outfit === 'aodai' ? white : skin;
    const shoeMat = L.outfit === 'dress' ? cloth : dark;
    this.legL = pivot(-0.11, 0.82);
    this.legR = pivot(0.11, 0.82);
    for (const leg of [this.legL, this.legR]) {
      add(geo('leg', () => new THREE.CylinderGeometry(0.075, 0.065, 0.78, 8)), legMat, 0, -0.39, 0, leg);
      add(geo('shoe', () => new THREE.BoxGeometry(0.13, 0.08, 0.24)), shoeMat, 0, -0.79, 0.04, leg);
    }

    // Thân
    let shoulderX = 0.24;
    let sleeve = cloth;
    if (L.outfit === 'suit') {
      shoulderX = 0.29;
      add(geo('torsoSuit', () => new THREE.CylinderGeometry(0.25, 0.2, 0.62, 12)), cloth, 0, 1.12, 0);
      add(geo('hips', () => new THREE.CylinderGeometry(0.2, 0.2, 0.14, 12)), dark, 0, 0.84, 0);
      add(geo('shirt', () => new THREE.BoxGeometry(0.14, 0.38, 0.02)), white, 0, 1.22, 0.222);
      add(geo('tie', () => new THREE.BoxGeometry(0.05, 0.3, 0.02)), m(L.groom ? '#e5989b' : '#8b1e3f'), 0, 1.18, 0.236);
      if (L.groom) add(geo('bout', () => new THREE.SphereGeometry(0.045, 8, 6)), m('#ff7aa2'), 0.14, 1.32, 0.215);
    } else if (L.outfit === 'dress') {
      sleeve = skin;
      add(geo('torsoDress', () => new THREE.CylinderGeometry(0.19, 0.16, 0.45, 12)), cloth, 0, 1.17, 0);
      if (L.veil) {
        add(geo('gown', () => new THREE.CylinderGeometry(0.18, 0.78, 0.95, 20)), cloth, 0, 0.5, -0.04);
        const train = add(geo('train', () => new THREE.BoxGeometry(0.9, 0.04, 1.1)), cloth, 0, 0.03, -0.6);
        train.rotation.x = 0.05;
      } else {
        this.skirt = add(geo('skirt', () => new THREE.CylinderGeometry(0.18, 0.5, 0.75, 16)), cloth, 0, 0.6, 0);
      }
    } else {
      add(geo('torsoAodai', () => new THREE.CylinderGeometry(0.19, 0.17, 0.55, 12)), cloth, 0, 1.13, 0);
      add(geo('hipsAodai', () => new THREE.CylinderGeometry(0.19, 0.19, 0.16, 12)), white, 0, 0.85, 0);
      this.flapF = add(geo('flap', () => new THREE.BoxGeometry(0.32, 0.95, 0.025)), cloth, 0, 0.52, 0.13);
      this.flapB = add(geo('flap', () => new THREE.BoxGeometry(0.32, 0.95, 0.025)), cloth, 0, 0.52, -0.13);
    }

    // Đầu (gắn vào khớp cổ để có thể quay đầu, gật đầu)
    this.head = pivot(0, 1.47);
    const H = this.head;
    add(geo('neck', () => new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8)), skin, 0, 0, 0, H);
    add(geo('head', () => new THREE.SphereGeometry(0.24, 18, 14)), skin, 0, 0.21, 0, H);
    this.eyes = [];
    for (const s of [-1, 1]) {
      const eye = add(geo('eye', () => new THREE.SphereGeometry(0.028, 8, 6)), dark, s * 0.08, 0.23, 0.215, H);
      eye.castShadow = false;
      this.eyes.push(eye);
      const glint = add(geo('glint', () => new THREE.SphereGeometry(0.009, 6, 4)), m('#ffffff', { roughness: 0.1 }), s * 0.08 + 0.01, 0.245, 0.24, H);
      glint.castShadow = false;
      this.eyes.push(glint);
      add(geo('blush', () => new THREE.SphereGeometry(0.035, 8, 6)), m('#ff9fb2', { transparent: true, opacity: 0.6 }), s * 0.14, 0.15, 0.19, H).castShadow = false;
    }
    this.mouth = add(geo('mouth', () => new THREE.TorusGeometry(0.045, 0.011, 6, 12, Math.PI)), m('#b0485e'), 0, 0.135, 0.222, H);
    this.mouth.rotation.z = Math.PI;
    this.mouth.castShadow = false;
    const cap = add(geo('hair', () => new THREE.SphereGeometry(0.258, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52)), hair, 0, 0.23, -0.01, H);
    cap.rotation.x = -0.25;
    if (L.outfit !== 'suit') this.longHair = add(geo('longHair', () => new THREE.BoxGeometry(0.42, 0.52, 0.12)), hair, 0, 0.03, -0.17, H);
    if (L.veil) {
      const veil = add(
        geo('veil', () => new THREE.CylinderGeometry(0.2, 0.62, 1.5, 18, 1, true)),
        m('#ffffff', { transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
        0, -0.32, -0.16, H,
      );
      veil.castShadow = false;
      this.veil = veil;
      add(geo('crown', () => new THREE.TorusGeometry(0.2, 0.025, 6, 20)), m('#ffd166', { metalness: 0.7, roughness: 0.3 }), 0, 0.39, 0, H).rotation.x = Math.PI / 2;
    }

    // Tay
    this.armL = pivot(-shoulderX, 1.38);
    this.armR = pivot(shoulderX, 1.38);
    for (const arm of [this.armL, this.armR]) {
      add(geo('arm', () => new THREE.CylinderGeometry(0.06, 0.055, 0.56, 8)), sleeve, 0, -0.28, 0, arm);
      add(geo('hand', () => new THREE.SphereGeometry(0.065, 8, 6)), skin, 0, -0.6, 0, arm);
    }
    // Đạo cụ trên tay phải: ly, điện thoại, micro
    this.glass = new THREE.Group();
    this.glass.position.set(0, -0.62, 0.07);
    add(geo('glass', () => new THREE.CylinderGeometry(0.045, 0.03, 0.16, 10)), m('#e8f7ff', { transparent: true, opacity: 0.5, roughness: 0.1 }), 0, 0.02, 0, this.glass);
    this.drinkMat = m('#f4c430', { roughness: 0.2 });
    add(geo('drink', () => new THREE.CylinderGeometry(0.038, 0.028, 0.1, 10)), this.drinkMat, 0, 0, 0, this.glass);
    this.phone = new THREE.Group();
    this.phone.position.set(0, -0.66, 0.04);
    add(geo('phone', () => new THREE.BoxGeometry(0.08, 0.15, 0.015)), m('#22222a', { roughness: 0.3, metalness: 0.4 }), 0, 0, 0, this.phone).rotation.x = Math.PI / 2;
    this.mic = new THREE.Group();
    this.mic.position.set(0, -0.62, 0.06);
    add(geo('micBody', () => new THREE.CylinderGeometry(0.022, 0.018, 0.2, 8)), dark, 0, 0, 0, this.mic).rotation.x = Math.PI / 2;
    add(geo('micHead', () => new THREE.SphereGeometry(0.045, 10, 8)), m('#c0c4cc', { metalness: 0.8, roughness: 0.3 }), 0, 0, 0.11, this.mic);
    this.hand = new THREE.Group();
    this.hand.position.set(0, -0.66, 0.05);
    for (const g of [this.glass, this.phone, this.mic, this.hand]) { g.visible = false; this.armR.add(g); }
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
    let lL = 0, lR = 0, aLx = 0, aRx = 0, aLz = -0.08, aRz = 0.08;
    let bob = 0, sway = 0, roll = 0, lean = 0, baseY = 0;
    let headX = 0, headZ = 0, headY = null, mouthOpen = 0;
    let glass = false, phone = false, mic = false;

    switch (anim) {
      case 'walk': {
        const run = speed > 5.5;
        this.phase += dt * (3 + speed * 1.6);
        const s = Math.sin(this.phase);
        const amp = run ? 0.85 : 0.6;
        lL = s * amp; lR = -s * amp; aLx = -s * (run ? 0.9 : 0.5); aRx = s * (run ? 0.9 : 0.5);
        if (run) { aLz = -0.2; aRz = 0.2; }
        bob = Math.abs(Math.cos(this.phase)) * (run ? 0.09 : 0.05);
        lean = Math.min(0.22, speed * 0.028);
        roll = Math.sin(this.phase) * 0.03;
        break;
      }
      case 'jump':
        lL = -0.6; lR = -0.2; aLz = -1.4; aRz = 1.4; lean = -0.05;
        mouthOpen = 1;
        break;
      case 'wave':
        aRz = 2.7 + Math.sin(t * 9) * 0.35;
        headZ = -0.12;
        roll = Math.sin(t * 4.5) * 0.03;
        break;
      case 'clap': {
        const c = Math.abs(Math.sin(t * 7));
        aLx = aRx = -1.25;
        aLz = 0.1 + 0.32 * c; aRz = -aLz;
        bob = c * 0.02;
        headX = 0.05 * c;
        break;
      }
      case 'dance': {
        const s = Math.sin(t * 7);
        bob = Math.abs(s) * 0.12;
        aLz = -2.3 - 0.4 * s; aRz = 2.3 - 0.4 * s;
        lL = Math.max(0, s) * -0.5; lR = Math.max(0, -s) * -0.5;
        sway = Math.sin(t * 3.5) * 0.35;
        headZ = Math.sin(t * 3.5) * 0.18;
        mouthOpen = 0.6;
        break;
      }
      case 'dance2': {
        const up = Math.sin(t * 4) > 0;
        aRz = up ? 2.6 : 0.5; aRx = up ? 0 : -0.6;
        aLz = up ? -0.3 : -1.0;
        roll = Math.sin(t * 4) * 0.12;
        bob = Math.abs(Math.sin(t * 8)) * 0.06;
        lL = up ? -0.3 : 0;
        headZ = up ? 0.15 : -0.1;
        break;
      }
      case 'toast': {
        glass = true;
        const c = (Math.sin(t * 2.2) + 1) / 2;
        aRx = -1.3 - c * 0.9; aRz = 0.25;
        headX = -0.15 * c;
        mouthOpen = c > 0.8 ? 0.7 : 0;
        break;
      }
      case 'heart':
        aLz = -2.75; aRz = 2.75; aLx = aRx = -0.35;
        bob = Math.abs(Math.sin(t * 3)) * 0.04;
        headZ = Math.sin(t * 1.5) * 0.15;
        break;
      case 'cheer': {
        const s = Math.abs(Math.sin(t * 6));
        aLz = -2.4 - 0.3 * s; aRz = 2.4 + 0.3 * s;
        bob = s * 0.15;
        headX = -0.2;
        mouthOpen = 1;
        break;
      }
      case 'bow': {
        const c = Math.max(0, Math.sin(t * 1.6));
        lean = c * 0.65;
        aRx = -0.9 * c; aRz = -0.55 * c;
        headX = c * 0.25;
        break;
      }
      case 'kiss': {
        const c = (Math.sin(t * 3) + 1) / 2;
        aRx = -2.5 + c * 1.3; aRz = -0.35 + c * 0.2;
        headZ = 0.12; headX = -0.05;
        mouthOpen = -1;
        lean = -0.05 + c * 0.08;
        break;
      }
      case 'sit': {
        baseY = -0.33;
        lL = lR = -1.45;
        aLx = aRx = -0.55; aLz = -0.12; aRz = 0.12;
        const b = Math.sin(t * 1.8);
        bob = b * 0.006;
        headZ = Math.sin(t * 0.5) * 0.08;
        break;
      }
      case 'piano': {
        baseY = -0.33;
        lL = lR = -1.45;
        aLx = -1.15 + Math.sin(t * 9) * 0.12; aRx = -1.15 + Math.sin(t * 7 + 1) * 0.12;
        aLz = 0.25 + Math.sin(t * 3) * 0.12; aRz = -0.25 + Math.sin(t * 2.4) * 0.12;
        sway = Math.sin(t * 1.5) * 0.12;
        lean = 0.12;
        headZ = Math.sin(t * 1.5) * 0.12; headX = 0.15;
        break;
      }
      case 'catch': {
        const s = Math.abs(Math.sin(t * 5));
        aRz = 2.3; aRx = -0.4;
        aLz = -2.3 - 0.3 * s;
        bob = s * 0.18;
        mouthOpen = 1;
        headX = -0.15;
        break;
      }
      case 'selfie':
        phone = true;
        aRx = -1.9; aRz = -0.15;
        aLz = -2.5; aLx = -0.2;
        headZ = 0.2; headX = -0.08;
        mouthOpen = 0.5;
        roll = 0.05;
        break;
      case 'sing': {
        mic = true;
        aRx = -2.0; aRz = -0.7;
        const s = Math.sin(t * 2.4);
        aLz = -1.2 - 0.5 * Math.abs(s); aLx = -0.4;
        sway = s * 0.25;
        headX = -0.1 + Math.abs(Math.sin(t * 4.8)) * -0.1;
        mouthOpen = Math.abs(Math.sin(t * 9));
        bob = Math.abs(Math.sin(t * 4.8)) * 0.03;
        break;
      }
      case 'hug':
        aLx = aRx = -1.35; aLz = 0.45; aRz = -0.45;
        lean = 0.15;
        headZ = 0.25;
        mouthOpen = -1;
        break;
      default: {
        const b = Math.sin(t * 1.8);
        aLz = -0.08 - 0.02 * b; aRz = 0.08 + 0.02 * b;
        bob = b * 0.008;
        headY = Math.sin(t * 0.37) * 0.35 * Math.max(0, Math.sin(t * 0.13));
      }
    }

    // Nhìn về phía một điểm (người chơi lại gần)
    if (this.lookTarget && anim !== 'sit' && anim !== 'bow' && anim !== 'piano') {
      this.root.getWorldPosition(tmpV);
      const yaw = Math.atan2(this.lookTarget.x - tmpV.x, this.lookTarget.z - tmpV.z);
      const rel = wrapPi(yaw - this.root.rotation.y - this.body.rotation.y);
      if (Math.abs(rel) < 1.6) headY = clamp(rel, -0.9, 0.9);
    }

    const k = 14;
    this.legL.rotation.x = damp(this.legL.rotation.x, lL, k, dt);
    this.legR.rotation.x = damp(this.legR.rotation.x, lR, k, dt);
    this.armL.rotation.x = damp(this.armL.rotation.x, aLx, k, dt);
    this.armR.rotation.x = damp(this.armR.rotation.x, aRx, k, dt);
    this.armL.rotation.z = damp(this.armL.rotation.z, aLz, k, dt);
    this.armR.rotation.z = damp(this.armR.rotation.z, aRz, k, dt);
    this.body.position.y = damp(this.body.position.y, baseY + bob, 20, dt);
    this.body.rotation.y = damp(this.body.rotation.y, sway, 8, dt);
    this.body.rotation.z = damp(this.body.rotation.z, roll, 8, dt);
    this.body.rotation.x = damp(this.body.rotation.x, lean, 8, dt);
    this.head.rotation.x = damp(this.head.rotation.x, headX, 8, dt);
    this.head.rotation.z = damp(this.head.rotation.z, headZ, 8, dt);
    this.head.rotation.y = damp(this.head.rotation.y, headY ?? 0, 5, dt);

    // Váy/vạt áo đung đưa theo chuyển động
    const flutter = anim === 'walk' ? Math.sin(this.phase * 2) * 0.06 + Math.min(0.25, speed * 0.03) : 0;
    if (this.flapB) this.flapB.rotation.x = damp(this.flapB.rotation.x, -flutter - (anim === 'sit' ? 0.2 : 0), 10, dt);
    if (this.flapF) this.flapF.rotation.x = damp(this.flapF.rotation.x, anim === 'sit' ? -1.3 : flutter * 0.5, 10, dt);
    if (this.skirt) this.skirt.rotation.z = damp(this.skirt.rotation.z, (anim === 'dance' || anim === 'dance2') ? Math.sin(t * 7) * 0.08 : 0, 10, dt);
    if (this.longHair) this.longHair.rotation.x = damp(this.longHair.rotation.x, -flutter * 1.2 - (anim === 'jump' ? 0.3 : 0), 10, dt);
    if (this.veil) this.veil.rotation.x = damp(this.veil.rotation.x, -flutter * 0.6, 6, dt);

    // Chớp mắt
    this.blink -= dt;
    let eyeY = 1;
    if (this.blink < 0) {
      eyeY = 0.12;
      if (this.blink < -0.12) this.blink = 1.8 + Math.random() * 3.5;
    }
    if (anim === 'kiss' || anim === 'hug') eyeY = 0.15;
    for (const e of this.eyes) e.scale.y = eyeY;

    // Miệng: cười / há / chu môi
    if (mouthOpen < 0) this.mouth.scale.set(0.45, 0.6, 1.4);
    else this.mouth.scale.set(1, 1 + mouthOpen * 1.4, 1);

    // Nhún khi tiếp đất
    if (this.squash > 0) {
      this.squash = Math.max(0, this.squash - dt * 5);
      const s = Math.sin(this.squash * Math.PI) * 0.12;
      this.body.scale.set(1 + s * 0.5, 1 - s, 1 + s * 0.5);
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
