import * as THREE from 'three';
import { canvasTexture, drawHeart, FONT, SCRIPT } from './textures.js';

// Vật trang trí & đồ vật tương tác thêm: đài phun nước, xe hoa, đèn lồng, chuông, xích đu,
// tường khóa tình yêu, tháp champagne, xe kem, đàn piano, hồ thiên nga, bướm, trái tim vàng, chú cún.
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const lerpAngle = (a, b, t) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * t;

export function buildDecor(scene, venue, sparkTex) {
  const updaters = [];
  const mats = {};
  const mat = (color, o = {}) => {
    const key = color + JSON.stringify(o);
    return mats[key] || (mats[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o }));
  };
  const glow = (color, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });
  const put = (geo, m, x, y, z, parent = scene) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const group = (x, y, z, ry = 0, parent = scene) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    parent.add(g);
    return g;
  };
  const flowerGeo = new THREE.IcosahedronGeometry(1, 1);
  const flowers = (parent, pts, size = 0.1, colors = ['#ff7aa2', '#ffffff', '#ffc2d4', '#ff4f79', '#fff0b3']) => {
    for (const p of pts) {
      const f = new THREE.Mesh(flowerGeo, mat(pick(colors)));
      f.position.copy(p);
      f.scale.setScalar(size * rand(0.7, 1.3));
      parent.add(f);
    }
  };

  // ========== ĐÀI PHUN NƯỚC (khu đón khách) ==========
  const fountain = { pos: V3(-9.5, 0, 29.5) };
  {
    const g = group(fountain.pos.x, 0, fountain.pos.z);
    const stone = mat('#f3eee6', { roughness: 0.7 });
    const water = new THREE.MeshStandardMaterial({ color: '#6ec3e0', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 });
    put(new THREE.CylinderGeometry(1.6, 1.75, 0.5, 32), stone, 0, 0.25, 0, g);
    put(new THREE.CylinderGeometry(1.45, 1.45, 0.06, 32), water, 0, 0.46, 0, g).castShadow = false;
    put(new THREE.CylinderGeometry(0.16, 0.24, 1.0, 12), stone, 0, 0.9, 0, g);
    put(new THREE.CylinderGeometry(0.62, 0.3, 0.2, 24), stone, 0, 1.38, 0, g);
    put(new THREE.CylinderGeometry(0.54, 0.54, 0.04, 24), water, 0, 1.47, 0, g).castShadow = false;
    put(new THREE.SphereGeometry(0.12, 12, 10), mat('#e9c46a', { metalness: 0.7, roughness: 0.3 }), 0, 1.62, 0, g);
    const pts = [];
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; pts.push(V3(Math.cos(a) * 1.68, 0.52, Math.sin(a) * 1.68)); }
    flowers(g, pts, 0.09);
    // Tia nước
    const N = 180;
    const pos = new Float32Array(N * 3);
    const vel = new Float32Array(N * 3);
    const reset = (i, t0 = 0) => {
      const a = Math.random() * Math.PI * 2;
      const r = rand(0.5, 1.0);
      pos.set([0, 1.6, 0], i * 3);
      vel.set([Math.cos(a) * r, rand(1.6, 2.3), Math.sin(a) * r], i * 3);
      for (let k = 0; k < t0; k += 0.05) step(i, 0.05);
    };
    const step = (i, dt) => {
      vel[i * 3 + 1] -= 6 * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
    };
    for (let i = 0; i < N; i++) reset(i, rand(0, 0.9));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const drops = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.11, map: sparkTex, color: new THREE.Color('#d6f3ff').multiplyScalar(1.4), transparent: true, depthWrite: false }));
    drops.frustumCulled = false;
    g.add(drops);
    const ripples = [0, 1, 2].map((i) => {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false }));
      r.rotation.x = -Math.PI / 2;
      r.position.y = 0.5;
      r.userData.ph = i / 3;
      g.add(r);
      return r;
    });
    let splash = 0;
    fountain.splash = () => { splash = 1.5; };
    updaters.push((t, dt) => {
      for (let i = 0; i < N; i++) {
        step(i, dt);
        if (pos[i * 3 + 1] < 0.5) reset(i);
      }
      geo.attributes.position.needsUpdate = true;
      for (const r of ripples) {
        const k = (t * 0.45 + r.userData.ph) % 1;
        r.scale.setScalar(1 + k * 3.2 + splash);
        r.material.opacity = 0.45 * (1 - k);
      }
      splash = Math.max(0, splash - dt * 2);
    });
    venue.addCircle(fountain.pos.x, fountain.pos.z, 1.8);
  }

  // ========== XE HOA ==========
  const car = { pos: V3(9.6, 0, 29.2) };
  {
    const g = group(car.pos.x, 0, car.pos.z);
    const body = g;
    const white = mat('#fdfdfd', { metalness: 0.35, roughness: 0.25 });
    const dark = mat('#20242b', { roughness: 0.5 });
    put(new THREE.BoxGeometry(3.8, 0.6, 1.7), white, 0, 0.58, 0, body);
    put(new THREE.BoxGeometry(1.9, 0.5, 1.52), mat('#2a3440', { metalness: 0.6, roughness: 0.15 }), -0.25, 1.12, 0, body);
    put(new THREE.BoxGeometry(2.0, 0.07, 1.58), white, -0.25, 1.4, 0, body);
    put(new THREE.BoxGeometry(3.86, 0.12, 1.74), mat('#c9a46a', { metalness: 0.7, roughness: 0.3 }), 0, 0.32, 0, body);
    for (const [x, z] of [[1.25, 0.82], [1.25, -0.82], [-1.25, 0.82], [-1.25, -0.82]]) {
      const w = put(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 18), dark, x, 0.33, z, body);
      w.rotation.x = Math.PI / 2;
      const hub = put(new THREE.CylinderGeometry(0.16, 0.16, 0.25, 12), mat('#d9d9e0', { metalness: 0.8, roughness: 0.2 }), x, 0.33, z, body);
      hub.rotation.x = Math.PI / 2;
    }
    const headMat = glow('#fff2c4', 1.4);
    const tailMat = glow('#ff3344', 1.2);
    for (const z of [-0.55, 0.55]) {
      put(new THREE.BoxGeometry(0.06, 0.16, 0.3), headMat, 1.91, 0.66, z, body);
      put(new THREE.BoxGeometry(0.06, 0.12, 0.3), tailMat, -1.91, 0.66, z, body);
    }
    // Hoa trái tim trên nắp capo + ruy băng chéo
    const heartPts = [];
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      const hx = 16 * Math.sin(a) ** 3;
      const hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
      heartPts.push(V3(1.25 - hy * 0.022, 0.92, hx * 0.022));
    }
    flowers(body, heartPts, 0.07, ['#ff4f79', '#ff7aa2', '#ffffff']);
    for (const s of [-1, 1]) {
      const rib = put(new THREE.BoxGeometry(1.5, 0.02, 0.07), mat('#ff8fab'), 1.15, 0.89, s * 0.42, body);
      rib.rotation.y = s * 0.55;
    }
    const plate = canvasTexture(320, 90, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c75b7a';
      ctx.font = `62px ${SCRIPT}`;
      ctx.textAlign = 'center';
      ctx.fillText('Just Married', w / 2, 66);
    });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.25), new THREE.MeshStandardMaterial({ map: plate }));
    pl.position.set(-1.92, 0.55, 0);
    pl.rotation.y = -Math.PI / 2;
    body.add(pl);
    // Lon bia buộc dây phía sau
    for (let i = 0; i < 4; i++) {
      const cx = -2.5 - i * 0.28;
      const cz = rand(-0.5, 0.5);
      const can = put(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 10), mat(pick(['#d9d9e0', '#e9c46a', '#ff8fab']), { metalness: 0.8, roughness: 0.3 }), cx, 0.06, cz, body);
      can.rotation.z = Math.PI / 2;
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(-1.9, 0.4, cz * 0.3), V3(cx, 0.08, cz)]), new THREE.LineBasicMaterial({ color: '#ffffff' }));
      body.add(line);
    }
    // Bóng bay buộc gương xe
    for (const z of [-0.9, 0.9]) {
      for (let i = 0; i < 3; i++) {
        const b = put(new THREE.SphereGeometry(0.2, 12, 10), mat(pick(['#ffafcc', '#ffffff', '#ffc8dd', '#cdb4db']), { roughness: 0.25 }), 0.5 + rand(-0.25, 0.25), 2.0 + i * 0.25, z * 1.2 + rand(-0.2, 0.2), body);
        b.scale.y = 1.15;
        b.userData.base = b.position.y;
        b.userData.ph = rand(0, 6);
        body.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(0.6, 1.0, z * 0.85), b.position.clone().add(V3(0, -0.22, 0))]), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 })));
      }
    }
    let honk = 0;
    car.honk = () => { honk = 1.4; };
    updaters.push((t, dt) => {
      for (const c of body.children) if (c.userData.base) c.position.y = c.userData.base + Math.sin(t * 1.4 + c.userData.ph) * 0.08;
      if (honk > 0) {
        honk -= dt;
        const on = Math.sin(honk * 25) > 0;
        headMat.color.set('#fff2c4').multiplyScalar(on ? 4 : 1.4);
        tailMat.color.set('#ff3344').multiplyScalar(on ? 3 : 1.2);
        body.position.y = Math.abs(Math.sin(honk * 18)) * 0.04;
      } else body.position.y = 0;
    });
    venue.addBox(car.pos.x - 1.95, car.pos.x + 1.95, car.pos.z - 0.9, car.pos.z + 0.9);
  }

  // ========== ĐÈN LỒNG ĐỎ dọc lối đi chính ==========
  const lanterns = [];
  {
    const xs = [-40, -24, -8, 8, 24, 40];
    for (let i = 0; i < xs.length - 1; i++) {
      const a = V3(xs[i], 3.15, 24.2);
      const b = V3(xs[i + 1], 3.15, 24.2);
      const pts = [];
      const n = 24;
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const p = a.clone().lerp(b, t);
        p.y -= 0.9 * 4 * t * (1 - t);
        pts.push(p);
        if (k % 4 === 2) lanterns.push({ p: p.clone(), ph: rand(0, 6) });
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#4a2a20' })));
    }
    const body = new THREE.InstancedMesh(new THREE.SphereGeometry(0.26, 14, 10).scale(1, 0.85, 1), glow('#e8232a', 1.3), lanterns.length);
    const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.44, 10, 1, true), mat('#ffd166', { metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide }), lanterns.length);
    const tassel = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.04, 0.25, 6), mat('#ffd166'), lanterns.length);
    for (const m of [body, caps, tassel]) { m.frustumCulled = false; scene.add(m); }
    const d = new THREE.Object3D();
    const set = (t) => {
      lanterns.forEach((l, i) => {
        const sw = Math.sin(t * 1.3 + l.ph) * 0.08;
        d.position.set(l.p.x, l.p.y - 0.3, l.p.z);
        d.rotation.set(sw, 0, sw * 0.7);
        d.updateMatrix();
        body.setMatrixAt(i, d.matrix);
        caps.setMatrixAt(i, d.matrix);
        d.position.y -= 0.36;
        d.updateMatrix();
        tassel.setMatrixAt(i, d.matrix);
      });
      body.instanceMatrix.needsUpdate = caps.instanceMatrix.needsUpdate = tassel.instanceMatrix.needsUpdate = true;
    };
    set(0);
    updaters.push((t) => set(t));
  }

  // Bảng chữ Hỷ hai bên cổng hoa
  {
    const tex = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#c81d25';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 124, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 150px serif';
      ctx.textAlign = 'center';
      ctx.fillText('囍', w / 2, 180);
    });
    for (const s of [-1, 1]) {
      const g = group(s * 4.2, 0, 39.6);
      put(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8), mat('#6b4f3a'), 0, 1.1, -0.05, g);
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }));
      m.position.set(0, 2.1, 0);
      g.add(m);
      venue.addCircle(s * 4.2, 39.6, 0.3);
    }
  }

  // ========== CHUÔNG CƯỚI trên cổng hoa ==========
  const bell = {};
  {
    const pivot = group(0, 4.72, 40);
    const prof = [V3(0, -0.5, 0), V3(0.28, -0.48, 0), V3(0.26, -0.4, 0), V3(0.2, -0.25, 0), V3(0.16, -0.08, 0), V3(0.12, 0, 0), V3(0, 0.02, 0)].map((v) => new THREE.Vector2(v.x, v.y));
    put(new THREE.LatheGeometry(prof, 24), mat('#e9c46a', { metalness: 0.85, roughness: 0.25, side: THREE.DoubleSide }), 0, 0, 0, pivot);
    put(new THREE.SphereGeometry(0.06, 10, 8), mat('#b88a3a', { metalness: 0.8 }), 0, -0.48, 0, pivot);
    put(new THREE.TorusGeometry(0.1, 0.03, 6, 16), mat('#ff8fab'), 0, 0.08, 0, pivot);
    let amp = 0;
    bell.ring = () => { amp = 0.7; };
    bell.pos = V3(0, 4.3, 40);
    updaters.push((t, dt) => {
      amp = Math.max(0, amp - dt * 0.25);
      pivot.rotation.z = Math.sin(t * 7) * amp;
    });
  }

  // ========== XÍCH ĐU HOA (góc check-in) ==========
  const swing = { pos: V3(-29, 0, 30.6), ry: Math.PI, occupied: false };
  {
    const g = group(swing.pos.x, 0, swing.pos.z, swing.ry);
    const wood = mat('#fffaf0');
    for (const s of [-1, 1]) {
      put(new THREE.CylinderGeometry(0.07, 0.09, 3.1, 10), wood, s * 1.2, 1.55, 0, g);
      const v = new THREE.Vector3(s * 1.2, 0, 0).applyAxisAngle(V3(0, 1, 0), swing.ry).add(swing.pos);
      venue.addCircle(v.x, v.z, 0.25);
    }
    const bar = put(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 10), wood, 0, 3.1, 0, g);
    bar.rotation.z = Math.PI / 2;
    const top = [];
    for (let i = 0; i < 40; i++) top.push(V3(rand(-1.3, 1.3), 3.15 + rand(-0.12, 0.15), rand(-0.15, 0.15)));
    for (let i = 0; i < 24; i++) { const s = pick([-1, 1]); top.push(V3(s * 1.2 + rand(-0.12, 0.12), rand(0.3, 3), rand(-0.12, 0.12))); }
    flowers(g, top, 0.1);
    const pivot = group(0, 3.05, 0, 0, g);
    for (const s of [-1, 1]) {
      put(new THREE.CylinderGeometry(0.012, 0.012, 2.5, 6), mat('#e8dcc4'), s * 0.6, -1.25, 0, pivot);
      const vine = [];
      for (let i = 0; i < 8; i++) vine.push(V3(s * 0.6, -0.2 - i * 0.3, 0));
      flowers(pivot, vine, 0.05, ['#ffffff', '#ffc2d4']);
    }
    put(new THREE.BoxGeometry(1.4, 0.07, 0.5), mat('#c9a46a', { roughness: 0.5 }), 0, -2.52, 0, pivot);
    let ang = 0;
    swing.seatWorld = (target = new THREE.Vector3()) => {
      pivot.updateWorldMatrix(true, false);
      return target.set(0, -2.48, 0).applyMatrix4(pivot.matrixWorld);
    };
    updaters.push((t, dt) => {
      const amp = swing.occupied ? 0.32 : 0.04;
      ang = damp(ang, amp, 1.2, dt);
      pivot.rotation.x = Math.sin(t * 2.0) * ang;
    });
  }

  // ========== TƯỜNG KHÓA TÌNH YÊU ==========
  const lockWall = { pos: V3(-19.5, 0, 27.3) };
  {
    const g = group(lockWall.pos.x, 0, lockWall.pos.z);
    const iron = mat('#2f2a35', { metalness: 0.6, roughness: 0.4 });
    const W = 5;
    for (let x = -W / 2; x <= W / 2 + 0.01; x += 1.25) put(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), iron, x, 0.65, 0, g);
    for (const y of [0.35, 0.7, 1.05]) {
      const r = put(new THREE.CylinderGeometry(0.025, 0.025, W, 6), iron, 0, y, 0, g);
      r.rotation.z = Math.PI / 2;
    }
    for (let x = -W / 2; x <= W / 2; x += 0.18) put(new THREE.BoxGeometry(0.015, 1.0, 0.015), iron, x, 0.7, 0, g).castShadow = false;
    const sign = canvasTexture(320, 100, (ctx, w, h) => {
      ctx.fillStyle = '#fff8f1';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c75b7a';
      ctx.font = `56px ${SCRIPT}`;
      ctx.textAlign = 'center';
      ctx.fillText('Love Locks', w / 2 - 10, 66);
      drawHeart(ctx, w - 40, 46, 36, '#ff6f91');
    });
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.38), new THREE.MeshStandardMaterial({ map: sign, side: THREE.DoubleSide }));
    sm.position.set(0, 1.45, 0);
    g.add(sm);
    put(new THREE.BoxGeometry(0.04, 0.3, 0.04), iron, 0, 1.25, 0, g);
    const lockGeo = new THREE.BoxGeometry(0.1, 0.09, 0.035);
    const shackleGeo = new THREE.TorusGeometry(0.032, 0.008, 6, 10, Math.PI);
    const pops = [];
    lockWall.addLock = (color = pick(['#ff4f79', '#ffd166', '#7cc6fe', '#c77dff', '#ff9f1c', '#e5e5e5', '#06d6a0']), animate = true) => {
      const l = new THREE.Group();
      const y = pick([0.35, 0.7, 1.05]);
      l.position.set(rand(-W / 2 + 0.15, W / 2 - 0.15), y - 0.07, pick([-1, 1]) * 0.03);
      const b = new THREE.Mesh(lockGeo, mat(color, { metalness: 0.7, roughness: 0.3 }));
      const s = new THREE.Mesh(shackleGeo, mat('#c0c4cc', { metalness: 0.9, roughness: 0.2 }));
      s.position.y = 0.045;
      l.add(b, s);
      l.rotation.z = rand(-0.3, 0.3);
      g.add(l);
      if (animate) { l.scale.setScalar(0.01); pops.push({ l, t: 0 }); }
      const wp = l.position.clone();
      g.localToWorld(wp);
      return wp;
    };
    for (let i = 0; i < 34; i++) lockWall.addLock(undefined, false);
    updaters.push((t, dt) => {
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i];
        p.t += dt * 3;
        const k = Math.min(1, p.t);
        p.l.scale.setScalar(k < 1 ? 1 + Math.sin(k * Math.PI) * 0.8 : 1);
        if (k >= 1) pops.splice(i, 1);
      }
    });
    venue.addBox(lockWall.pos.x - W / 2 - 0.1, lockWall.pos.x + W / 2 + 0.1, lockWall.pos.z - 0.12, lockWall.pos.z + 0.12);
  }

  // ========== THÁP CHAMPAGNE (tiệc cưới) ==========
  const champagne = { pos: V3(-24.5, 0, -12.6), pouring: 0 };
  {
    const g = group(champagne.pos.x, 0, champagne.pos.z);
    put(new THREE.CylinderGeometry(0.85, 0.9, 0.76, 28), mat('#fffdf8'), 0, 0.38, 0, g);
    put(new THREE.CylinderGeometry(0.9, 0.9, 0.012, 28), mat('#f7c6d0'), 0, 0.766, 0, g);
    const glassMat = new THREE.MeshStandardMaterial({ color: '#eaf7ff', transparent: true, opacity: 0.35, roughness: 0.05, side: THREE.DoubleSide });
    const liquidMat = new THREE.MeshStandardMaterial({ color: '#f4d27a', roughness: 0.15, transparent: true, opacity: 0.9, emissive: '#5a4310' });
    const coupe = new THREE.LatheGeometry([[0, 0], [0.05, 0], [0.012, 0.01], [0.008, 0.1], [0.014, 0.112], [0.065, 0.13], [0.085, 0.165]].map(([x, y]) => new THREE.Vector2(x, y)), 14);
    const liqGeo = new THREE.CylinderGeometry(0.078, 0.02, 0.045, 12).translate(0, 0.0225, 0);
    const tiers = [[9, 0.3], [5, 0.17], [1, 0]];
    const glasses = [];
    const tw = group(0, 0.78, 0, 0, g);
    tw.scale.setScalar(1.7);
    tiers.forEach(([n, r], k) => {
      const y = k * 0.165;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        put(coupe, glassMat, x, y, z, tw).castShadow = false;
        const l = new THREE.Mesh(liqGeo, liquidMat);
        l.position.set(x, y + 0.118, z);
        l.scale.y = 0.01;
        l.visible = false;
        tw.add(l);
        glasses.push({ l, tier: 2 - k });
      }
    });
    const bottle = group(0.25, 0.77, 0, 0, tw);
    put(new THREE.CylinderGeometry(0.07, 0.07, 0.32, 12), mat('#1f4d2e', { metalness: 0.4, roughness: 0.2 }), 0, 0, 0, bottle);
    put(new THREE.CylinderGeometry(0.025, 0.06, 0.14, 10), mat('#1f4d2e', { metalness: 0.4, roughness: 0.2 }), 0, 0.22, 0, bottle);
    put(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8), mat('#e9c46a', { metalness: 0.8 }), 0, 0.31, 0, bottle);
    bottle.rotation.z = 2.0;
    bottle.visible = false;
    let fill = 0; // 0..3 tầng đã đầy
    let hold = 0;
    champagne.topPos = V3(champagne.pos.x, 0, champagne.pos.z);
    champagne.pour = () => {
      if (champagne.pouring > 0) return false;
      champagne.pouring = 4.5;
      fill = 0;
      return true;
    };
    updaters.push((t, dt) => {
      if (champagne.pouring > 0) {
        champagne.pouring -= dt;
        fill = Math.min(3, fill + dt * 0.75);
        bottle.visible = champagne.pouring > 0.6;
        bottle.rotation.z = 2.0 + Math.sin(t * 3) * 0.08;
        if (champagne.pouring <= 0) hold = 25;
      } else if (hold > 0) {
        hold -= dt;
        if (hold <= 0) fill = 3;
      } else if (fill > 0) {
        fill = Math.max(0, fill - dt * 0.4);
      }
      for (const gl of glasses) {
        const k = Math.min(1, Math.max(0, fill - gl.tier));
        gl.l.visible = k > 0.01;
        gl.l.scale.y = Math.max(0.01, k);
      }
    });
    venue.addCircle(champagne.pos.x, champagne.pos.z, 1.0);
  }

  // ========== XE KEM (tiệc cưới) ==========
  const cart = { pos: V3(-44.6, 0, 15.5) };
  {
    const g = group(cart.pos.x, 0, cart.pos.z, Math.PI / 2);
    put(new THREE.BoxGeometry(1.6, 0.75, 0.9), mat('#ffd6e0', { roughness: 0.4 }), 0, 0.68, 0, g);
    put(new THREE.BoxGeometry(1.66, 0.08, 0.96), mat('#ffffff'), 0, 1.08, 0, g);
    put(new THREE.BoxGeometry(1.62, 0.1, 0.92), mat('#7cc6fe'), 0, 0.42, 0, g);
    for (const s of [-1, 1]) {
      const w = put(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16), mat('#e9c46a', { metalness: 0.6 }), s * 0.5, 0.28, 0.5, g);
      w.rotation.x = Math.PI / 2;
    }
    put(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8), mat('#ffffff'), 0, 1.8, 0, g);
    const stripes = canvasTexture(256, 64, (ctx, w, h) => {
      for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#ff8fab'; ctx.fillRect((i * w) / 12, 0, w / 12 + 1, h); }
    });
    put(new THREE.ConeGeometry(1.1, 0.5, 24, 1, true), new THREE.MeshStandardMaterial({ map: stripes, side: THREE.DoubleSide }), 0, 2.55, 0, g);
    const sign = canvasTexture(256, 80, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ff6f91';
      ctx.font = `800 40px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('🍦 KEM', w / 2, 55);
    });
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.28), new THREE.MeshStandardMaterial({ map: sign }));
    sg.position.set(0, 0.72, 0.452);
    g.add(sg);
    for (let i = 0; i < 5; i++) {
      const c = put(new THREE.ConeGeometry(0.05, 0.16, 10), mat('#d9a066'), -0.6 + i * 0.3, 1.2, -0.2, g);
      c.rotation.x = Math.PI;
      put(new THREE.SphereGeometry(0.065, 10, 8), mat(pick(['#ffc2d4', '#b9f3d0', '#fff3b0', '#c9a7ff', '#8d5a3b'])), -0.6 + i * 0.3, 1.32, -0.2, g);
    }
    venue.addBox(cart.pos.x - 0.5, cart.pos.x + 0.5, cart.pos.z - 0.85, cart.pos.z + 0.85);
  }

  // ========== ĐÀN PIANO trên sân khấu ==========
  const piano = { pos: V3(36.5, 1, -10.2), seat: { x: 36.5, z: -8.65, ry: Math.PI, y: 1, kind: 'piano', standOff: -0.85 } };
  {
    const g = group(piano.pos.x, 1, piano.pos.z);
    const black = mat('#0e0e12', { metalness: 0.3, roughness: 0.15 });
    put(new THREE.BoxGeometry(1.5, 0.36, 1.9), black, 0, 0.82, 0, g);
    const lid = put(new THREE.BoxGeometry(1.5, 0.03, 1.8), black, 0, 1.25, -0.25, g);
    lid.rotation.x = -0.12;
    lid.rotation.z = 0.5;
    lid.position.x = -0.35;
    for (const [x, z] of [[-0.62, 0.8], [0.62, 0.8], [0, -0.8]]) put(new THREE.CylinderGeometry(0.05, 0.04, 0.64, 8), black, x, 0.32, z, g);
    const keys = canvasTexture(512, 64, (ctx, w, h) => {
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, w, h);
      const n = 26;
      ctx.fillStyle = '#222';
      for (let i = 0; i <= n; i++) ctx.fillRect((i * w) / n, 0, 1.5, h);
      for (let i = 0; i < n; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) ctx.fillRect(((i + 0.65) * w) / n, 0, (0.7 * w) / n, h * 0.62);
    });
    const kb = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.05, 0.2), [mat('#fafafa'), mat('#fafafa'), new THREE.MeshStandardMaterial({ map: keys }), mat('#fafafa'), mat('#fafafa'), mat('#fafafa')]);
    kb.position.set(0, 0.78, 1.02);
    g.add(kb);
    put(new THREE.BoxGeometry(0.8, 0.06, 0.36), black, 0, 0.47, 1.55, g);
    for (const s of [-1, 1]) put(new THREE.BoxGeometry(0.05, 0.45, 0.3), black, s * 0.36, 0.22, 1.55, g);
    const vase = [];
    for (let i = 0; i < 12; i++) vase.push(V3(0.5 + rand(-0.12, 0.12), 1.12 + rand(0, 0.15), -0.5 + rand(-0.12, 0.12)));
    flowers(g, vase, 0.06);
    venue.addBox(piano.pos.x - 0.78, piano.pos.x + 0.78, piano.pos.z - 0.98, piano.pos.z + 1.15);
  }

  // ========== HỒ THIÊN NGA (khu sân khấu) ==========
  const pond = { pos: V3(19.4, 0, 18), rx: 2.5, rz: 3.7, feed: null };
  {
    const g = group(pond.pos.x, 0, pond.pos.z);
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48).scale(pond.rx, pond.rz, 1), new THREE.MeshStandardMaterial({ color: '#4fa8c9', roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.92 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.04;
    water.receiveShadow = true;
    g.add(water);
    const rock = new THREE.DodecahedronGeometry(0.22, 0);
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2;
      const r = put(rock, mat(pick(['#b9b4ab', '#cfc9bf', '#a8a39a']), { roughness: 0.95, flatShading: true }), Math.cos(a) * (pond.rx + 0.12), 0.08, Math.sin(a) * (pond.rz + 0.12), g);
      r.scale.set(rand(0.8, 1.4), rand(0.5, 0.9), rand(0.8, 1.4));
      r.rotation.y = rand(0, 6);
    }
    for (let i = 0; i < 6; i++) {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.24, 16, 0.3, Math.PI * 1.8), mat('#4f8f45', { side: THREE.DoubleSide }));
      pad.rotation.x = -Math.PI / 2;
      const a = rand(0, 6);
      const rr = rand(0.4, 0.8);
      pad.position.set(Math.cos(a) * pond.rx * rr, 0.06, Math.sin(a) * pond.rz * rr);
      g.add(pad);
      if (i % 2 === 0) flowers(g, [pad.position.clone().add(V3(0, 0.06, 0))], 0.07, ['#ffc2d4', '#ffffff']);
    }
    // Đôi thiên nga cổ cong thành hình trái tim
    const pair = group(0, 0.05, 0, 0, g);
    const white = mat('#ffffff', { roughness: 0.45 });
    const neckCurve = new THREE.CatmullRomCurve3([V3(0, 0.12, 0.22), V3(0, 0.42, 0.3), V3(0, 0.66, 0.2), V3(0, 0.7, 0.05), V3(0, 0.6, -0.02)].map((v) => V3(v.z, v.y, 0)));
    const neckGeo = new THREE.TubeGeometry(neckCurve, 20, 0.045, 8, false);
    for (const s of [-1, 1]) {
      const sw = group(-s * 0.42, 0, 0, s > 0 ? 0 : Math.PI, pair);
      const b = put(new THREE.SphereGeometry(0.3, 16, 12), white, 0, 0.12, 0, sw);
      b.scale.set(1.5, 0.75, 1);
      const tail = put(new THREE.ConeGeometry(0.12, 0.25, 10), white, -0.45, 0.22, 0, sw);
      tail.rotation.z = Math.PI / 2 + 0.6;
      for (const w of [-1, 1]) {
        const wing = put(new THREE.SphereGeometry(0.2, 12, 8), white, -0.05, 0.25, w * 0.17, sw);
        wing.scale.set(1.5, 0.6, 0.6);
        wing.rotation.z = 0.35;
      }
      put(neckGeo, white, 0, 0, 0, sw);
      const p = neckCurve.getPoint(1);
      put(new THREE.SphereGeometry(0.075, 10, 8), white, p.x, p.y + 0.02, 0, sw);
      const beak = put(new THREE.ConeGeometry(0.03, 0.12, 8), mat('#ff8c2b'), p.x - 0.03, p.y - 0.06, 0, sw);
      beak.rotation.z = Math.PI + 0.3;
      for (const e of [-1, 1]) put(new THREE.SphereGeometry(0.014, 6, 4), mat('#111111'), p.x + 0.03, p.y + 0.04, e * 0.06, sw);
    }
    let a = 0;
    pond.feedAt = (world) => { pond.feed = { x: world.x - pond.pos.x, z: world.z - pond.pos.z, t: 8 }; };
    updaters.push((t, dt) => {
      let tx;
      let tz;
      if (pond.feed && pond.feed.t > 0) {
        pond.feed.t -= dt;
        const len = Math.hypot(pond.feed.x / pond.rx, pond.feed.z / pond.rz) || 1;
        tx = (pond.feed.x / len) * pond.rx * 0.55;
        tz = (pond.feed.z / len) * pond.rz * 0.55;
      } else {
        a += dt * 0.12;
        tx = Math.cos(a) * pond.rx * 0.45;
        tz = Math.sin(a) * pond.rz * 0.45;
      }
      const px = pair.position.x;
      const pz = pair.position.z;
      pair.position.x = damp(px, tx, 0.6, dt);
      pair.position.z = damp(pz, tz, 0.6, dt);
      const vx = pair.position.x - px;
      const vz = pair.position.z - pz;
      if (Math.hypot(vx, vz) > 1e-4) pair.rotation.y = lerpAngle(pair.rotation.y, Math.atan2(vx, vz) - Math.PI / 2, 1 - Math.exp(-2 * dt));
      pair.position.y = 0.05 + Math.sin(t * 1.6) * 0.015;
    });
    for (const dz of [-1.7, 0, 1.7]) venue.addCircle(pond.pos.x, pond.pos.z + dz, 2.3);
  }

  // ========== BƯỚM ==========
  {
    const wingTex = ['#ff8fab', '#ffd166', '#a0c4ff', '#cdb4db', '#ffffff', '#ffadad'].map((c) => canvasTexture(64, 64, (ctx) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(30, 22, 26, 18, -0.3, 0, Math.PI * 2);
      ctx.ellipse(24, 46, 16, 14, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.arc(34, 20, 5, 0, Math.PI * 2);
      ctx.fill();
    }));
    const wingGeo = new THREE.PlaneGeometry(0.2, 0.2).translate(0.1, 0, 0).rotateX(-Math.PI / 2);
    const anchors = [V3(-9.5, 0, 29.5), V3(0, 0, 38), V3(-31, 0, 36), V3(-23.5, 0, 34), V3(0, 0, -6), V3(19.4, 0, 18), V3(-29, 0, 31)];
    const list = [];
    for (let i = 0; i < 18; i++) {
      const b = new THREE.Group();
      const m = new THREE.MeshBasicMaterial({ map: pick(wingTex), transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.3 });
      const wr = new THREE.Group();
      const wl = new THREE.Group();
      wr.add(new THREE.Mesh(wingGeo, m));
      const lm = new THREE.Mesh(wingGeo, m);
      lm.scale.x = -1;
      wl.add(lm);
      b.add(wr, wl);
      scene.add(b);
      list.push({ b, wr, wl, anchor: pick(anchors), ph: rand(0, 50), sp: rand(0.4, 0.8), r: rand(1, 2.8), h: rand(0.8, 2.4) });
    }
    const prev = new THREE.Vector3();
    updaters.push((t) => {
      for (const f of list) {
        const k = t * f.sp + f.ph;
        prev.copy(f.b.position);
        f.b.position.set(f.anchor.x + Math.sin(k) * f.r + Math.sin(k * 2.3) * 0.4, f.h + Math.sin(k * 1.7) * 0.4, f.anchor.z + Math.cos(k * 0.8) * f.r);
        f.b.rotation.y = Math.atan2(f.b.position.x - prev.x, f.b.position.z - prev.z);
        const flap = Math.sin(t * 22 + f.ph) * 0.9;
        f.wr.rotation.z = flap;
        f.wl.rotation.z = -flap;
      }
    });
  }

  // ========== TRÁI TIM VÀNG ẨN (mini game) ==========
  const hearts = [];
  {
    const hs = new THREE.Shape();
    hs.moveTo(0, -0.35);
    hs.bezierCurveTo(-0.55, 0.0, -0.35, 0.48, 0, 0.2);
    hs.bezierCurveTo(0.35, 0.48, 0.55, 0.0, 0, -0.35);
    const geo = new THREE.ExtrudeGeometry(hs, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    geo.center();
    const gold = new THREE.MeshStandardMaterial({ color: '#ffcf4d', metalness: 0.85, roughness: 0.2, emissive: '#8a5a00', emissiveIntensity: 0.6 });
    const spots = [[-12.2, 39], [4.6, -13.6], [-46, -14], [-45.6, 40.2], [46, 40], [18.6, -13], [19.4, 23.2], [12.6, 10.5], [-16.2, 3], [44.5, 10]];
    spots.forEach(([x, z], i) => {
      const m = new THREE.Mesh(geo, gold);
      m.position.set(x, 1, z);
      m.castShadow = true;
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color: new THREE.Color('#ffd166').multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      h.scale.setScalar(1.2);
      m.add(h);
      scene.add(m);
      hearts.push({ i, pos: V3(x, 0, z), mesh: m, taken: false });
    });
    updaters.push((t) => {
      for (const h of hearts) {
        if (h.taken) continue;
        h.mesh.rotation.y = t * 1.8 + h.i;
        h.mesh.position.y = 1 + Math.sin(t * 2 + h.i) * 0.15;
      }
    });
  }
  const setHeartTaken = (i, taken = true) => {
    const h = hearts[i];
    if (!h) return;
    h.taken = taken;
    h.mesh.visible = !taken;
  };

  // ========== CHÚ CÚN CORGI ==========
  const dog = new Dog(scene, venue, mat);

  return {
    fountain, car, bell, swing, lockWall, champagne, cart, piano, pond, hearts, setHeartTaken, dog,
    update(t, dt, player) {
      for (const u of updaters) u(t, dt);
      dog.update(t, dt, player);
    },
  };
}

class Dog {
  constructor(scene, venue, mat) {
    this.venue = venue;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    scene.add(this.root);
    const orange = mat('#e0954a', { roughness: 0.8 });
    const white = mat('#fff8ee', { roughness: 0.8 });
    const dark = mat('#2a1f1a');
    const put = (g, m, x, y, z, p = this.body) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
    put(new THREE.BoxGeometry(0.36, 0.28, 0.66), orange, 0, 0.36, 0);
    put(new THREE.BoxGeometry(0.3, 0.1, 0.6), white, 0, 0.25, 0.02);
    this.head = new THREE.Group();
    this.head.position.set(0, 0.52, 0.36);
    this.body.add(this.head);
    put(new THREE.BoxGeometry(0.3, 0.26, 0.26), orange, 0, 0.05, 0.05, this.head);
    put(new THREE.BoxGeometry(0.16, 0.12, 0.16), white, 0, -0.02, 0.24, this.head);
    put(new THREE.SphereGeometry(0.035, 8, 6), dark, 0, 0.03, 0.33, this.head);
    for (const s of [-1, 1]) {
      const ear = put(new THREE.ConeGeometry(0.07, 0.16, 4), orange, s * 0.1, 0.24, 0.02, this.head);
      ear.rotation.z = -s * 0.2;
      put(new THREE.SphereGeometry(0.028, 8, 6), dark, s * 0.08, 0.1, 0.18, this.head);
    }
    this.tongue = put(new THREE.BoxGeometry(0.05, 0.015, 0.07), mat('#ff6f91'), 0, -0.08, 0.3, this.head);
    this.legs = [];
    for (const [x, z] of [[-0.12, 0.22], [0.12, 0.22], [-0.12, -0.22], [0.12, -0.22]]) {
      const p = new THREE.Group();
      p.position.set(x, 0.24, z);
      this.body.add(p);
      put(new THREE.CylinderGeometry(0.045, 0.04, 0.22, 8), white, 0, -0.11, 0, p);
      this.legs.push(p);
    }
    this.tail = put(new THREE.SphereGeometry(0.07, 8, 6), orange, 0, 0.45, -0.36);
    this.pos = V3(3, 0, 31);
    this.yaw = 0;
    this.target = null;
    this.wait = 2;
    this.followT = 0;
    this.sitT = 0;
    this.phase = 0;
    this.barkCd = 0;
    this.onBark = null;
  }

  pet() { this.sitT = 3; this.target = null; }
  follow(sec = 90) { this.followT = sec; this.sitT = 0; }

  update(t, dt, player) {
    let speed = 0;
    let goal = null;
    if (this.sitT > 0) {
      this.sitT -= dt;
      if (player) this.yaw = lerpAngle(this.yaw, Math.atan2(player.x - this.pos.x, player.z - this.pos.z), 1 - Math.exp(-6 * dt));
    } else if (this.followT > 0 && player) {
      this.followT -= dt;
      const d = Math.hypot(player.x - this.pos.x, player.z - this.pos.z);
      if (d > 1.6) { goal = player; speed = Math.min(6.5, 1.5 + d * 1.2); }
      if (d > 25) { this.pos.set(player.x - 1, 0, player.z - 1); }
    } else {
      this.wait -= dt;
      if (!this.target && this.wait <= 0) this.target = V3(rand(-12, 12), 0, rand(-2, 38));
      if (this.target) {
        goal = this.target;
        speed = 2;
        if (Math.hypot(this.target.x - this.pos.x, this.target.z - this.pos.z) < 0.4) { this.target = null; this.wait = rand(2, 6); }
      }
    }
    if (goal) {
      const dx = goal.x - this.pos.x;
      const dz = goal.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const px = this.pos.x;
      const pz = this.pos.z;
      this.pos.x += (dx / d) * speed * dt;
      this.pos.z += (dz / d) * speed * dt;
      this.venue.resolve(this.pos, 0.3);
      if (Math.hypot(this.pos.x - px, this.pos.z - pz) < speed * dt * 0.2 && this.target) { this.target = null; this.wait = 1; }
      this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-8 * dt));
    }
    this.pos.y = this.venue.heightAt(this.pos.x, this.pos.z);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    // Chân, đuôi, đầu
    this.phase += dt * (speed > 0 ? 6 + speed * 3 : 0);
    const s = Math.sin(this.phase);
    const amp = speed > 0 ? 0.7 : 0;
    this.legs[0].rotation.x = this.legs[3].rotation.x = s * amp;
    this.legs[1].rotation.x = this.legs[2].rotation.x = -s * amp;
    const sit = this.sitT > 0;
    this.body.rotation.x = damp(this.body.rotation.x, sit ? -0.45 : 0, 8, dt);
    this.body.position.y = damp(this.body.position.y, sit ? 0.08 : Math.abs(Math.cos(this.phase)) * (speed > 0 ? 0.04 : 0), 10, dt);
    this.tail.position.x = Math.sin(t * (sit || this.followT > 0 ? 28 : 10)) * 0.07;
    this.head.rotation.z = sit ? Math.sin(t * 2) * 0.2 : 0;
    this.tongue.visible = sit || speed > 3;
    this.barkCd -= dt;
    if (player && this.barkCd <= 0 && Math.hypot(player.x - this.pos.x, player.z - this.pos.z) < 3 && Math.random() < dt * 0.3) {
      this.barkCd = 12;
      this.onBark?.(this.pos);
    }
  }
}
