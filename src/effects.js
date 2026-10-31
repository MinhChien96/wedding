import * as THREE from 'three';
import { canvasTexture, drawHeart } from './textures.js';

const COLORS = ['#ff6f91', '#ffd166', '#06d6a0', '#118ab2', '#ffffff', '#c77dff', '#ff9f1c'];
export const FW_COLORS = ['#ff5fa2', '#ffd166', '#7cf3ff', '#b892ff', '#ff8a5c', '#9dff8a', '#ffffff', '#ff3d6e'];
const PETAL_COLORS = ['#ff7aa2', '#ffc2d4', '#ffffff', '#ff4f79', '#ffe0ea'];
const BALLOON_COLORS = ['#ffafcc', '#cdb4db', '#bde0fe', '#ffffff', '#ffc8dd', '#fde68a', '#ff8fab'];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const UP = new THREE.Vector3(0, 1, 0);

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.onSound = null; // (kind, position) => void
    this.heartTex = canvasTexture(128, 128, (ctx) => drawHeart(ctx, 64, 70, 104, '#ff4d7a'));
    this.sparkTex = canvasTexture(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.22, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.25)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    });
    this.noteTex = ['♪', '♫', '♬'].map((ch) => canvasTexture(128, 128, (ctx) => {
      ctx.font = 'bold 100px serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(ch, 64, 100);
    }));
    this.confGeo = new THREE.PlaneGeometry(0.12, 0.2);
    this.confMats = COLORS.map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    this.petalGeo = new THREE.CircleGeometry(0.07, 6).scale(1, 0.6, 1);
    this.petalMats = PETAL_COLORS.map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    this.ringGeo = new THREE.RingGeometry(0.4, 0.55, 32);
    this.lanternGeo = new THREE.CylinderGeometry(0.24, 0.17, 0.5, 12, 1, true);
    this.balloonGeo = new THREE.SphereGeometry(0.3, 16, 12);
    // Ánh chớp của pháo hoa (một đèn dùng chung để không phải biên dịch lại shader)
    this.flash = new THREE.PointLight('#ffffff', 0, 70, 1.6);
    this.flash.position.set(0, 20, 0);
    scene.add(this.flash);
    this.flashI = 0;
  }

  add(obj, life, tick, dispose) {
    if (obj) this.scene.add(obj);
    this.items.push({ obj, life, max: life, tick, dispose });
  }

  sprite(tex, color, size, additive = false) {
    const mat = new THREE.SpriteMaterial({
      map: tex, color, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const s = new THREE.Sprite(mat);
    s.scale.set(size, size, 1);
    return s;
  }

  sound(kind, pos) { this.onSound?.(kind, pos); }

  // ---------- Hiệu ứng cơ bản ----------
  hearts(pos, n = 6) {
    for (let i = 0; i < n; i++) {
      const s = this.sprite(this.heartTex, 0xffffff, 0.22 + Math.random() * 0.22);
      s.position.set(pos.x + rand(-0.4, 0.4), pos.y + 1.6 + Math.random() * 0.4, pos.z + rand(-0.4, 0.4));
      const vel = new THREE.Vector3(rand(-0.25, 0.25), 0.9 + Math.random() * 0.8, rand(-0.25, 0.25));
      const base = s.scale.x;
      const ph = rand(0, 6);
      this.add(s, 2.2, (it, dt) => {
        s.position.addScaledVector(vel, dt);
        s.position.x += Math.sin(it.life * 5 + ph) * dt * 0.3;
        const grow = Math.min(1, (it.max - it.life) * 6);
        s.scale.setScalar(base * grow);
        s.material.opacity = Math.min(1, it.life / 0.8);
      }, () => s.material.dispose());
    }
  }

  // Emoji cảm xúc bay lên trên đầu nhân vật
  emoji(pos, ch, n = 3) {
    this.emojiTex ||= new Map();
    let tex = this.emojiTex.get(ch);
    if (!tex) {
      tex = canvasTexture(128, 128, (ctx) => {
        ctx.font = '100px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch, 64, 70);
      });
      this.emojiTex.set(ch, tex);
    }
    for (let i = 0; i < n; i++) {
      const s = this.sprite(tex, 0xffffff, i ? 0.4 : 0.75);
      s.position.set(pos.x + (i ? rand(-0.5, 0.5) : 0), pos.y + 2.3, pos.z + (i ? rand(-0.5, 0.5) : 0));
      const vel = new THREE.Vector3(rand(-0.2, 0.2), i ? 1 + Math.random() * 0.6 : 0.7, rand(-0.2, 0.2));
      const base = s.scale.x;
      const delay = i * 0.12;
      this.add(s, 2.4 + delay, (it, dt) => {
        const age = it.max - it.life;
        if (age < delay) { s.visible = false; return; }
        s.visible = true;
        s.position.addScaledVector(vel, dt);
        const k = Math.min(1, (age - delay) * 7);
        s.scale.setScalar(base * (k < 1 ? k * 1.25 : 1 + Math.sin(age * 9) * 0.04));
        s.material.opacity = Math.min(1, it.life / 0.7);
      }, () => s.material.dispose());
    }
  }

  confetti(pos, n = 140) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.confGeo, this.confMats[i % this.confMats.length]);
      m.position.set(pos.x, pos.y + 2, pos.z);
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 4;
      const vel = new THREE.Vector3(Math.cos(a) * sp, 4 + Math.random() * 6, Math.sin(a) * sp);
      const spin = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      this.add(m, 4 + Math.random() * 2, (it, dt) => this.fall(m, vel, spin, it, dt, 6, 1.6));
    }
  }

  fall(m, vel, spin, it, dt, g, drag) {
    if (m.position.y > 0.03) {
      vel.y -= g * dt;
      vel.multiplyScalar(1 - drag * dt);
      m.position.addScaledVector(vel, dt);
      m.position.x += Math.sin(it.life * 6 + spin.x) * dt * 0.4;
      m.rotation.x += spin.x * dt;
      m.rotation.y += spin.y * dt;
    } else {
      m.position.y = 0.03;
      m.rotation.x = -Math.PI / 2;
    }
    if (it.life < 0.5) m.scale.setScalar(Math.max(0.01, it.life / 0.5));
  }

  ring(pos, color = '#ffd6e8', life = 0.8, size = 3) {
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, pos.y + 0.05, pos.z);
    this.add(ring, life, (it) => {
      const k = 1 + (1 - it.life / it.max) * size;
      ring.scale.set(k, k, k);
      ring.material.opacity = it.life / it.max;
    }, () => ring.material.dispose());
  }

  sparkle(pos) {
    this.ring(pos);
    this.hearts(pos, 4);
    for (let i = 0; i < 14; i++) {
      const s = this.sprite(this.sparkTex, new THREE.Color(pick(['#ffe6a3', '#ffc2d4', '#ffffff'])).multiplyScalar(2.2), rand(0.12, 0.25), true);
      const a = rand(0, Math.PI * 2);
      s.position.set(pos.x + Math.cos(a) * 0.5, pos.y + rand(0.2, 1.8), pos.z + Math.sin(a) * 0.5);
      const vel = new THREE.Vector3(Math.cos(a) * 0.6, rand(0.4, 1.2), Math.sin(a) * 0.6);
      this.add(s, rand(0.7, 1.2), (it, dt) => {
        s.position.addScaledVector(vel, dt);
        s.material.opacity = (it.life / it.max) * (0.6 + 0.4 * Math.sin(it.life * 30));
      }, () => s.material.dispose());
    }
  }

  puff(pos, color = '#efe2d2') {
    const s = this.sprite(this.sparkTex, color, 0.25);
    s.material.opacity = 0.5;
    s.position.set(pos.x + rand(-0.1, 0.1), pos.y + 0.08, pos.z + rand(-0.1, 0.1));
    this.add(s, 0.6, (it, dt) => {
      const k = 1 - it.life / it.max;
      s.scale.setScalar(0.25 + k * 0.5);
      s.position.y += dt * 0.3;
      s.material.opacity = 0.45 * (1 - k);
    }, () => s.material.dispose());
  }

  // Trái tim bay theo đường cong từ người này sang người kia
  heartsTo(from, to, n = 6) {
    for (let i = 0; i < n; i++) {
      const s = this.sprite(this.heartTex, 0xffffff, 0.3);
      const a = from.clone().add(new THREE.Vector3(0, 1.6, 0));
      const delay = i * 0.12;
      const side = rand(-1, 1);
      s.visible = false;
      let popped = false;
      this.add(s, 1.2 + delay, (it) => {
        const k = Math.min(1, Math.max(0, (it.max - it.life - delay) / 1.2));
        s.visible = k > 0;
        const b = to.clone().add(new THREE.Vector3(0, 1.7, 0));
        const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(side * 0.6, 1.4, 0));
        const p0 = a.clone().lerp(mid, k);
        const p1 = mid.clone().lerp(b, k);
        s.position.copy(p0.lerp(p1, k));
        s.scale.setScalar(0.25 + Math.sin(k * Math.PI) * 0.2);
        if (it.life <= 0.03 && i === n - 1 && !popped) { popped = true; this.hearts(to, 5); }
      }, () => s.material.dispose());
    }
  }

  kissHeart(pos, yaw) {
    const s = this.sprite(this.heartTex, 0xffffff, 0.15);
    const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    s.position.copy(pos).addScaledVector(f, 0.35).add(new THREE.Vector3(0, 1.62, 0));
    const vel = f.multiplyScalar(2.2).add(new THREE.Vector3(0, 0.5, 0));
    this.add(s, 1.6, (it, dt) => {
      s.position.addScaledVector(vel, dt);
      vel.multiplyScalar(1 - dt * 0.8);
      const k = 1 - it.life / it.max;
      s.scale.setScalar(0.15 + k * 0.35);
      s.material.opacity = Math.min(1, it.life / 0.5);
    }, () => s.material.dispose());
  }

  note(pos) {
    const c = new THREE.Color().setHSL(Math.random(), 0.8, 0.7);
    const s = this.sprite(pick(this.noteTex), c, 0.32);
    s.position.set(pos.x + rand(-0.3, 0.3), pos.y + 1.9, pos.z + rand(-0.3, 0.3));
    const ph = rand(0, 6);
    this.add(s, 1.8, (it, dt) => {
      s.position.y += dt * 0.8;
      s.position.x += Math.sin(it.life * 4 + ph) * dt * 0.5;
      s.material.opacity = Math.min(1, it.life / 0.6);
      s.material.rotation = Math.sin(it.life * 3 + ph) * 0.3;
    }, () => s.material.dispose());
  }

  // ---------- Tung cánh hoa về phía trước ----------
  petals(pos, yaw, n = 60) {
    const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const r = new THREE.Vector3().crossVectors(f, UP);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.petalGeo, pick(this.petalMats));
      m.position.set(pos.x, pos.y + 1.7, pos.z).addScaledVector(f, 0.3);
      m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
      const vel = f.clone().multiplyScalar(rand(2, 5.5)).addScaledVector(r, rand(-2, 2)).add(new THREE.Vector3(0, rand(2.5, 5), 0));
      const spin = new THREE.Vector3(rand(2, 9), rand(2, 9), rand(0, 3));
      this.add(m, rand(5, 8), (it, dt) => this.fall(m, vel, spin, it, dt, 2.2, 2.4));
    }
    this.sound('pop', pos);
  }

  // ---------- Pháo hoa ----------
  firework(pos, color, height = rand(13, 20)) {
    const c = new THREE.Color(color || pick(FW_COLORS));
    const s = this.sprite(this.sparkTex, c.clone().multiplyScalar(3), 0.6, true);
    s.position.set(pos.x, pos.y + 0.5, pos.z);
    const dur = 1.1 + Math.random() * 0.3;
    const v0 = (height + 4 * dur * dur) / dur;
    const vel = new THREE.Vector3(rand(-0.8, 0.8), v0, rand(-0.8, 0.8));
    let trail = 0;
    this.sound('whistle', pos);
    this.add(s, dur, (it, dt) => {
      vel.y -= 8 * dt;
      s.position.addScaledVector(vel, dt);
      trail -= dt;
      if (trail <= 0) {
        trail = 0.025;
        const t = this.sprite(this.sparkTex, new THREE.Color('#ffcf8a').multiplyScalar(2), 0.22, true);
        t.position.copy(s.position);
        this.add(t, 0.5, (jt) => { t.material.opacity = jt.life / jt.max; t.position.y -= 0.01; }, () => t.material.dispose());
      }
      if (it.life <= 0) this.burst(s.position.clone(), c);
    }, () => s.material.dispose());
  }

  burst(p, c) {
    const N = 170;
    const pattern = pick(['sphere', 'sphere', 'ring', 'heart', 'willow']);
    const c2 = new THREE.Color(pick(FW_COLORS));
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const vel = new Float32Array(N * 3);
    const tilt = new THREE.Euler(rand(-0.6, 0.6), rand(0, 6), rand(-0.6, 0.6));
    const v = new THREE.Vector3();
    const speed = pattern === 'willow' ? 6 : 9;
    for (let i = 0; i < N; i++) {
      if (pattern === 'ring') {
        const a = (i / N) * Math.PI * 2;
        v.set(Math.cos(a), 0, Math.sin(a)).applyEuler(tilt).multiplyScalar(speed * rand(0.95, 1.05));
      } else if (pattern === 'heart') {
        const a = (i / N) * Math.PI * 2;
        v.set(16 * Math.sin(a) ** 3, 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a), rand(-1, 1))
          .multiplyScalar(speed / 17).applyAxisAngle(UP, tilt.y);
      } else {
        v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.75, 1));
      }
      pos.set([p.x, p.y, p.z], i * 3);
      vel.set([v.x, v.y, v.z], i * 3);
      const cc = (i % 3 === 0 ? c2 : c).clone().multiplyScalar(3.4);
      col.set([cc.r, cc.g, cc.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: pattern === 'willow' ? 0.8 : 1.1, map: this.sparkTex, vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    const gravity = pattern === 'willow' ? 2.2 : 3.2;
    const drag = pattern === 'willow' ? 1.2 : 1.9;
    this.add(pts, pattern === 'willow' ? 3.2 : 2.3, (it, dt) => {
      const k = 1 - drag * dt;
      for (let i = 0; i < N * 3; i += 3) {
        vel[i] *= k; vel[i + 1] = vel[i + 1] * k - gravity * dt; vel[i + 2] *= k;
        pos[i] += vel[i] * dt; pos[i + 1] += vel[i + 1] * dt; pos[i + 2] += vel[i + 2] * dt;
      }
      g.attributes.position.needsUpdate = true;
      const f = it.life / it.max;
      mat.opacity = Math.min(1, f * 1.6) * (f < 0.35 ? 0.6 + 0.4 * Math.sin(it.life * 40) : 1);
    }, () => { g.dispose(); mat.dispose(); });
    // Quầng sáng lúc nổ
    const glow = this.sprite(this.sparkTex, c.clone().multiplyScalar(2.5), 9, true);
    glow.position.copy(p);
    this.add(glow, 0.6, (it) => {
      const k = it.life / it.max;
      glow.material.opacity = k * k;
      glow.scale.setScalar(9 + (1 - k) * 6);
    }, () => glow.material.dispose());
    this.flash.position.copy(p);
    this.flash.color.copy(c);
    this.flashI = 90;
    this.sound('boom', p);
  }

  fireworkShow(center, n = 6, spread = 8) {
    for (let i = 0; i < n; i++) {
      setTimeout(() => this.firework(new THREE.Vector3(center.x + rand(-spread, spread), center.y, center.z + rand(-2, 2))), i * rand(250, 450));
    }
  }

  // ---------- Đèn trời ----------
  lantern(pos) {
    const g = new THREE.Group();
    const warm = new THREE.Color('#ffa94d').multiplyScalar(2.4);
    const bodyMat = new THREE.MeshBasicMaterial({ color: warm, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
    const body = new THREE.Mesh(this.lanternGeo, bodyMat);
    const glow = this.sprite(this.sparkTex, new THREE.Color('#ff9f45').multiplyScalar(1.6), 1.6, true);
    glow.material.opacity = 0.7;
    g.add(body, glow);
    g.position.set(pos.x, pos.y + 1.9, pos.z);
    const vel = new THREE.Vector3(rand(-0.25, 0.25), rand(0.9, 1.3), rand(-0.25, 0.25));
    const ph = rand(0, 6);
    this.add(g, 30, (it, dt) => {
      const age = it.max - it.life;
      const v = Math.min(1, age / 2);
      g.position.addScaledVector(vel, dt * v);
      g.position.x += Math.sin(age * 0.7 + ph) * dt * 0.25;
      g.rotation.z = Math.sin(age * 1.2 + ph) * 0.08;
      const flick = 0.85 + Math.sin(age * 17 + ph) * 0.08 + Math.sin(age * 5.3) * 0.07;
      glow.material.opacity = 0.7 * flick * Math.min(1, it.life / 5);
      bodyMat.opacity = 0.95 * Math.min(1, it.life / 5);
    }, () => { bodyMat.dispose(); glow.material.dispose(); });
    this.sound('chime', pos);
  }

  // ---------- Bóng bay ----------
  balloon(pos, color = pick(BALLOON_COLORS)) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.1, transparent: true });
    const b = new THREE.Mesh(this.balloonGeo, mat);
    b.scale.y = 1.15;
    b.castShadow = true;
    const lineMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.34, 0), new THREE.Vector3(0.05, -1.2, 0)]);
    g.add(b, new THREE.Line(lineGeo, lineMat));
    g.position.set(pos.x, pos.y + 2.2, pos.z);
    const ph = rand(0, 6);
    this.add(g, 16, (it, dt) => {
      const age = it.max - it.life;
      g.position.y += dt * Math.min(1.8, 0.4 + age * 0.6);
      g.position.x += Math.sin(age * 1.1 + ph) * dt * 0.5;
      g.rotation.z = Math.sin(age * 1.5 + ph) * 0.15;
      mat.opacity = lineMat.opacity = Math.min(1, it.life / 3);
    }, () => { mat.dispose(); lineMat.dispose(); lineGeo.dispose(); });
    this.sound('pop', pos);
  }

  // ---------- Bó hoa cưới ----------
  makeBouquet() {
    const g = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 10, 1, true), new THREE.MeshStandardMaterial({ color: '#fffaf0', side: THREE.DoubleSide }));
    paper.rotation.x = Math.PI;
    paper.position.y = -0.1;
    g.add(paper);
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 14), new THREE.MeshStandardMaterial({ color: '#ff8fab' }));
    ribbon.rotation.x = Math.PI / 2;
    ribbon.position.y = -0.12;
    g.add(ribbon);
    const fg = new THREE.IcosahedronGeometry(0.06, 1);
    for (let i = 0; i < 14; i++) {
      const f = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: pick(['#ff4f79', '#ffffff', '#ffc2d4', '#ff7aa2', '#fff0b3']), roughness: 0.6 }));
      const a = rand(0, Math.PI * 2);
      const r = rand(0, 0.12);
      f.position.set(Math.cos(a) * r, 0.08 + rand(0, 0.08) - r * 0.4, Math.sin(a) * r);
      g.add(f);
    }
    g.userData.dispose = () => {
      g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      g.removeFromParent();
    };
    return g;
  }

  makeIceCream() {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 10), new THREE.MeshStandardMaterial({ color: '#d9a066' }));
    cone.rotation.x = Math.PI;
    cone.position.y = 0.02;
    g.add(cone);
    ['#ffc2d4', '#b9f3d0', '#fff3b0'].slice(0, 2 + (Math.random() < 0.5 ? 1 : 0)).forEach((c, i) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
      s.position.y = 0.12 + i * 0.08;
      g.add(s);
    });
    g.userData.dispose = () => { g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); g.removeFromParent(); };
    return g;
  }

  // Phong bì đỏ mừng cưới / lì xì
  makeEnvelope() {
    this.envTex ||= canvasTexture(128, 80, (ctx, w, h) => {
      ctx.fillStyle = '#d62828';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#b5161b';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w / 2, h * 0.55); ctx.lineTo(w, 0); ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 34px serif';
      ctx.textAlign = 'center';
      ctx.fillText('囍', w / 2, h * 0.86);
    });
    const front = new THREE.MeshStandardMaterial({ map: this.envTex, roughness: 0.5 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.012), [front, front, front, front, front, front]);
    m.userData.dispose = () => { m.geometry.dispose(); front.dispose(); };
    return m;
  }

  makeCoin() {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.015, 14), new THREE.MeshStandardMaterial({ color: '#ffcf4d', metalness: 0.9, roughness: 0.2, emissive: '#5a3a00' }));
    m.userData.dispose = () => { m.geometry.dispose(); m.material.dispose(); };
    return m;
  }

  splash(pos, color = '#cfefff') {
    for (let i = 0; i < 18; i++) {
      const s = this.sprite(this.sparkTex, new THREE.Color(color).multiplyScalar(1.5), rand(0.08, 0.16));
      s.position.copy(pos);
      const a = rand(0, Math.PI * 2);
      const vel = new THREE.Vector3(Math.cos(a) * rand(0.5, 1.4), rand(1.5, 3), Math.sin(a) * rand(0.5, 1.4));
      this.add(s, 0.8, (it, dt) => { vel.y -= 9 * dt; s.position.addScaledVector(vel, dt); s.material.opacity = it.life / it.max; }, () => s.material.dispose());
    }
    this.ring(pos, '#ffffff', 0.8, 2);
  }

  // Ném vật theo đường parabol; toFn() trả về điểm đến (đối tượng có thể di chuyển)
  throwArc(obj, from, toFn, dur, height, onArrive) {
    obj.position.copy(from);
    let done = false;
    this.add(obj, dur, (it) => {
      const k = 1 - it.life / it.max;
      const to = toFn();
      obj.position.lerpVectors(from, to, k);
      obj.position.y += Math.sin(k * Math.PI) * height;
      obj.rotation.x += 0.25;
      obj.rotation.z += 0.12;
      if (it.life <= 0 && !done) {
        done = true;
        this.scene.remove(obj);
        onArrive?.(obj);
      }
    }, () => {});
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      it.tick?.(it, dt);
      if (it.life <= 0) {
        if (it.obj) this.scene.remove(it.obj);
        it.dispose?.();
        this.items.splice(i, 1);
      }
    }
    this.flashI *= Math.exp(-7 * dt);
    this.flash.intensity = this.flashI < 0.5 ? 0 : this.flashI;
  }
}
