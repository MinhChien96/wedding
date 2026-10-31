import * as THREE from 'three';
import { BOUNDS } from './venue.js';

// Không khí: sao lấp lánh trên trời, đom đóm phát sáng và cánh hoa rơi quanh người xem.
const rand = (a, b) => a + Math.random() * (b - a);

export class Ambient {
  constructor(scene, sparkTex, lite = false) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // ---------- Sao ----------
    const NS = 700;
    const sp = new Float32Array(NS * 3);
    this.starCol = new Float32Array(NS * 3);
    this.starInfo = [];
    const v = new THREE.Vector3();
    for (let i = 0; i < NS; i++) {
      do v.set(rand(-1, 1), rand(0.1, 1), rand(-1, 1)); while (v.lengthSq() > 1);
      v.normalize();
      if (v.y < 0.14) v.y += 0.14;
      v.normalize().multiplyScalar(420);
      sp.set([v.x, v.y, v.z], i * 3);
      const warm = Math.random();
      this.starInfo.push({ b: rand(0.3, 1.2) * Math.min(1, (v.y / 420 - 0.1) * 3), ph: rand(0, 6), sp: rand(1, 4), r: 0.85 + warm * 0.15, g: 0.88 + warm * 0.07, bl: 1 - warm * 0.15 });
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(this.starCol, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({
      size: 2.6, sizeAttenuation: false, map: sparkTex, vertexColors: true, transparent: true,
      depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    }));
    this.stars.frustumCulled = false;
    this.group.add(this.stars);

    // ---------- Đom đóm ----------
    const NF = lite ? 70 : 150;
    this.ff = [];
    const fp = new Float32Array(NF * 3);
    this.ffCol = new Float32Array(NF * 3);
    for (let i = 0; i < NF; i++) {
      this.ff.push({
        x: rand(BOUNDS.x0, BOUNDS.x1), y: rand(0.4, 3.8), z: rand(BOUNDS.z0, BOUNDS.z1),
        ph: rand(0, 6), sp: rand(0.3, 0.8), r: rand(0.4, 1.4),
        c: new THREE.Color(Math.random() < 0.75 ? '#ffe9a8' : '#ffc2e0'),
      });
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    fg.setAttribute('color', new THREE.BufferAttribute(this.ffCol, 3));
    this.fireflies = new THREE.Points(fg, new THREE.PointsMaterial({
      size: 0.16, map: sparkTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.fireflies.frustumCulled = false;
    this.group.add(this.fireflies);

    // ---------- Cánh hoa rơi ----------
    const NP = lite ? 140 : 320;
    this.petals = [];
    const geo = new THREE.CircleGeometry(0.065, 6).scale(1, 0.6, 1);
    this.petalMesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.92 }), NP);
    this.petalMesh.frustumCulled = false;
    const colors = ['#ff7aa2', '#ffc2d4', '#ffffff', '#ffd6e5', '#ff9fbe'];
    for (let i = 0; i < NP; i++) {
      this.petals.push({ x: rand(-30, 30), y: rand(0, 16), z: rand(-30, 30), vy: rand(0.4, 0.9), ph: rand(0, 6), spin: rand(1, 4), rx: rand(0, 6), ry: rand(0, 6) });
      this.petalMesh.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    }
    this.group.add(this.petalMesh);
    this.dummy = new THREE.Object3D();
    this.R = 30;
  }

  update(t, dt, focus) {
    // Sao lấp lánh
    const sc = this.starCol;
    for (let i = 0; i < this.starInfo.length; i++) {
      const s = this.starInfo[i];
      const k = Math.max(0, s.b * (0.65 + 0.35 * Math.sin(t * s.sp + s.ph)));
      sc[i * 3] = s.r * k; sc[i * 3 + 1] = s.g * k; sc[i * 3 + 2] = s.bl * k;
    }
    this.stars.geometry.attributes.color.needsUpdate = true;

    // Đom đóm bay lượn
    const fp = this.fireflies.geometry.attributes.position.array;
    const fc = this.ffCol;
    for (let i = 0; i < this.ff.length; i++) {
      const f = this.ff[i];
      const a = t * f.sp + f.ph;
      fp[i * 3] = f.x + Math.sin(a) * f.r;
      fp[i * 3 + 1] = f.y + Math.sin(a * 1.7) * 0.35;
      fp[i * 3 + 2] = f.z + Math.cos(a * 0.8) * f.r;
      const glow = Math.max(0, Math.sin(t * 2.2 + f.ph * 3)) ** 2 * 1.7 + 0.1;
      fc[i * 3] = f.c.r * glow; fc[i * 3 + 1] = f.c.g * glow; fc[i * 3 + 2] = f.c.b * glow;
    }
    this.fireflies.geometry.attributes.position.needsUpdate = true;
    this.fireflies.geometry.attributes.color.needsUpdate = true;

    // Cánh hoa rơi quanh điểm nhìn
    const R = this.R;
    const d = this.dummy;
    for (let i = 0; i < this.petals.length; i++) {
      const p = this.petals[i];
      p.y -= p.vy * dt;
      p.x += (Math.sin(t * 0.9 + p.ph) * 0.5 + 0.35) * dt;
      p.z += Math.cos(t * 0.7 + p.ph) * 0.4 * dt;
      if (p.y < 0.02) { p.y = rand(12, 17); p.x = focus.x + rand(-R, R); p.z = focus.z + rand(-R, R); }
      if (p.x - focus.x > R) p.x -= 2 * R; else if (focus.x - p.x > R) p.x += 2 * R;
      if (p.z - focus.z > R) p.z -= 2 * R; else if (focus.z - p.z > R) p.z += 2 * R;
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(p.rx + t * p.spin, p.ry + t * p.spin * 0.7, Math.sin(t * 2 + p.ph));
      d.updateMatrix();
      this.petalMesh.setMatrixAt(i, d.matrix);
    }
    this.petalMesh.instanceMatrix.needsUpdate = true;
  }
}
