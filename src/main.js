import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { WEDDING } from './config.js';
import { buildVenue, ZONES, zoneAt, zoneById } from './venue.js';
import { Avatar, OUTFITS, PALETTE, SKIN_TONES, HAIR_COLORS, EMOTES } from './avatar.js';
import { Net } from './network.js';
import { Bots } from './bots.js';
import { Music } from './audio.js';
import { Effects, FW_COLORS } from './effects.js';
import { Ambient } from './ambient.js';
import { buildDecor } from './decor.js';
import { drawHeart, FONT, SCRIPT } from './textures.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const lerpAngle = (a, b, t) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (a, b) => a + Math.random() * (b - a);
const isTouch = matchMedia('(pointer: coarse)').matches;
// localStorage có thể bị chặn (VD: trang nhúng trong iframe sandbox) → không để lỗi làm hỏng trang
const store = {
  getItem(k) { try { return localStorage.getItem(k); } catch { return null; } },
  setItem(k, v) { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } },
};
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const arr3 = (v) => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)];

async function init() {
  await Promise.race([
    Promise.all([document.fonts.load('40px "Great Vibes"'), document.fonts.load('600 20px "Be Vietnam Pro"')]),
    new Promise((r) => setTimeout(r, 2000)),
  ]).catch(() => {});

  // ---------- Renderer & scene ----------
  const canvas = $('#scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#d98aa6', 110, 300);
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000);

  scene.add(new THREE.HemisphereLight('#ffe8d6', '#4d6b45', 1.1));
  const sun = new THREE.DirectionalLight('#ffd2a8', 2.0);
  sun.position.set(-40, 55, 45);
  sun.target.position.set(0, 0, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 45, bottom: -45, near: 1, far: 200 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  // Hậu kỳ: bloom cho đèn, LED, pháo hoa phát sáng
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: isTouch ? 0 : 4 }));
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.4, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const savedFx = store.getItem('wedding-fx');
  let hiFx = savedFx ? savedFx === '1' : !isTouch;

  const venue = buildVenue(scene);
  const fx = new Effects(scene);
  const ambient = new Ambient(scene, fx.sparkTex, isTouch);
  const decor = buildDecor(scene, venue, fx.sparkTex);
  decor.dog.onBark = (p) => fx.sound('bark', p);
  const music = new Music();
  const net = new Net();
  const avatars = new Set();

  // ---------- Cô dâu chú rể ----------
  const groom = new Avatar({ outfit: 'suit', color: '#1b1b22', skin: 1, hair: '#1a120c', groom: true }, `🤵 ${WEDDING.groom}`, 'Chú rể');
  const bride = new Avatar({ outfit: 'dress', color: '#fffdf8', skin: 0, hair: '#3b2416', veil: true }, `👰 ${WEDDING.bride}`, 'Cô dâu');
  groom.root.position.set(-0.85, 0.25, -8.4);
  bride.root.position.set(0.85, 0.25, -8.4);
  venue.addCircle(-0.85, -8.4, 0.35);
  venue.addCircle(0.85, -8.4, 0.35);
  scene.add(groom.root, bride.root);
  avatars.add(groom).add(bride);
  const couple = {
    greetCd: 0, act: 0, groomAnim: 'idle', brideAnim: 'idle', kiss: 0, kissFx: 0, bouquetAt: 0,
    over: new Map(), // avatar -> { anim, until, yaw }
  };

  // ---------- Khách ảo ----------
  const bots = new Bots(scene, venue, isTouch ? 10 : 16, (av, text) => {
    if (state.mode === 'play' && av.zoneId === state.zone?.id && !state.bubblesHidden) addChat(av.name, text);
  }, (b, zone) => {
    // Khách ảo thỉnh thoảng tự bắn pháo hoa, thả đèn trời, tung hoa, chụp ảnh...
    const f = V3(Math.sin(b.yaw), 0, Math.cos(b.yaw));
    if (zone === 'party' && Math.random() < 0.5) { fx.firework(b.pos.clone().addScaledVector(f, 2)); b.act = 'cheer'; b.timer = 3; }
    else if (zone === 'welcome') { fx.lantern(b.pos); b.act = 'heart'; b.timer = 3; }
    else if (zone === 'ceremony') { fx.petals(b.pos, b.yaw, 30); b.act = 'cheer'; b.timer = 2; }
    else if (zone === 'photo') { b.act = 'selfie'; b.timer = 4; }
    else if (Math.random() < 0.3) fx.balloon(b.pos);
  });
  for (const b of bots.list) avatars.add(b.av);

  // ---------- Trạng thái ----------
  const state = {
    mode: 'overview',
    selected: null,
    hover: null,
    zone: null,
    me: null,
    emote: null,
    emoteUntil: 0,
    firstPerson: false,
    bubblesHidden: false,
    camYaw: Math.PI,
    camPitch: 0.35,
    camDist: 6,
    fly: null,
    photo: null,
    lastPhoto: 'selfie',
    walkTo: null,
    social: null,
    cooldown: {},
    options: [],
    optSig: '',
    profile: JSON.parse(store.getItem('wedding-profile') || 'null') || {
      name: '', sub: 'Khách mời', look: { outfit: 'suit', color: PALETTE[0], skin: 1, hair: HAIR_COLORS[0] },
    },
    wishes: [],
    peers: new Map(),
    keys: {},
    joy: { x: 0, y: 0 },
  };

  // Âm thanh hiệu ứng: nhỏ dần theo khoảng cách tới camera
  fx.onSound = (kind, pos) => {
    if (!music.ctx && state.mode !== 'play') return;
    const d = pos ? camera.position.distanceTo(pos) : 0;
    music.sfx(kind, Math.max(0, 1 - d / 90));
  };

  // ---------- Camera bản đồ ----------
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 4;
  controls.maxDistance = 170;
  const PRESETS = {
    overview: { p: [0, 50, 84], t: [0, 0, 12] },
    top: { p: [0, 115, 14], t: [0, 0, 12] },
    altar: { p: [0, 3.4, -13.5], t: [0, 1.5, 20] },
    stage: { p: [31, 5.5, -11.5], t: [31, 0.5, 20] },
  };
  // Mở đầu: camera bay từ trên cao xuống toàn cảnh
  camera.position.set(-60, 120, 170);
  controls.target.set(...PRESETS.overview.t);

  function flyTo(p, t, dur = 1.3) {
    state.fly = {
      fromP: camera.position.clone(), fromT: controls.target.clone(),
      toP: new THREE.Vector3(...p), toT: new THREE.Vector3(...t), start: performance.now(), dur: dur * 1000,
    };
  }
  flyTo(PRESETS.overview.p, PRESETS.overview.t, 3.4);

  // ---------- UI tĩnh ----------
  $('#coupleTitle').textContent = `${WEDDING.groom} & ${WEDDING.bride}`;
  $('#weddingDate').textContent = `💍 ${WEDDING.date} · ${WEDDING.time} · ${WEDDING.venue}`;
  $('#inviteNames').textContent = `${WEDDING.groom} & ${WEDDING.bride}`;
  $('#inviteText').innerHTML = `trân trọng kính mời bạn tới dự tiệc cưới<br><b>${esc(WEDDING.dateLong)}</b> · ${esc(WEDDING.time)} · ${esc(WEDDING.venue)}`;

  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    const pr = PRESETS[b.dataset.preset];
    flyTo(pr.p, pr.t);
  }));

  const zoneList = $('#zoneList');
  for (const zn of ZONES) {
    const b = document.createElement('button');
    b.className = 'zone-card';
    b.style.setProperty('--c', zn.color);
    b.dataset.zone = zn.id;
    b.innerHTML = `<span class="ic">${zn.icon}</span><span class="nm">${zn.name}<br><span class="ct" data-count="${zn.id}">0 người</span></span>`;
    b.addEventListener('click', () => selectZone(zn));
    b.addEventListener('pointerenter', () => { state.hover = zn; });
    b.addEventListener('pointerleave', () => { state.hover = null; });
    zoneList.append(b);
  }

  function zoneCounts() {
    const c = Object.fromEntries(ZONES.map((z) => [z.id, 0]));
    for (const av of avatars) if (av.zoneId && av !== groom && av !== bride) c[av.zoneId]++;
    return c;
  }
  function refreshCounts() {
    const c = zoneCounts();
    document.querySelectorAll('[data-count]').forEach((el) => { el.textContent = `${c[el.dataset.count]} người`; });
    if (state.selected) $('#zdCount').textContent = `${state.selected.icon} ${c[state.selected.id]} người đang ở đây`;
  }
  setInterval(refreshCounts, 1000);

  function selectZone(zn) {
    state.selected = zn;
    $('#zoneDetail').classList.remove('hidden');
    $('#zdIcon').textContent = zn.icon;
    $('#zdName').textContent = zn.name;
    $('#zdDesc').textContent = zn.desc;
    document.querySelectorAll('.zone-card').forEach((el) => el.classList.toggle('sel', el.dataset.zone === zn.id));
    const [x0, x1, z0, z1] = zn.rect;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    flyTo([cx, 26, cz + 30], [cx, 0, cz]);
    refreshCounts();
  }
  function deselect() {
    state.selected = null;
    $('#zoneDetail').classList.add('hidden');
    document.querySelectorAll('.zone-card').forEach((el) => el.classList.remove('sel'));
  }
  $('#zdClose').addEventListener('click', deselect);
  $('#zdView').addEventListener('click', () => state.selected && flyTo(state.selected.view.p, state.selected.view.t));
  $('#zdEnter').addEventListener('click', () => openJoin(state.selected));
  $('#btnJoin').addEventListener('click', () => openJoin(state.selected));

  // Click chọn khu trên bản đồ / chọn khách khi đang chơi
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = null;
  const setRay = (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  };
  const pickZone = (e) => {
    setRay(e);
    const hit = raycaster.intersectObjects(venue.zoneMeshes.map((z) => z.fill))[0];
    return hit?.object.userData.zone || null;
  };
  const pickAvatar = (e) => {
    setRay(e);
    const list = [];
    for (const av of avatars) if (av !== state.me?.av && av.root.visible) list.push(av.body);
    const hit = raycaster.intersectObjects(list, true)[0];
    let o = hit?.object;
    while (o && !o.userData.avatar) o = o.parent;
    return o?.userData.avatar || null;
  };
  canvas.addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY };
    closeSocial();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (isTouch) return;
    if (state.mode === 'overview') {
      state.hover = pickZone(e);
      canvas.style.cursor = state.hover ? 'pointer' : '';
    } else if (!drag || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) {
      canvas.style.cursor = pickAvatar(e) ? 'pointer' : '';
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const click = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6;
    downAt = null;
    if (!click) return;
    if (state.mode === 'overview') {
      const zn = pickZone(e);
      if (zn) selectZone(zn);
    } else if (state.mode === 'play' && !state.photo) {
      const av = pickAvatar(e);
      if (av) openSocial(av, e.clientX, e.clientY);
    }
  });

  // ---------- Thiệp mời / tạo nhân vật ----------
  const prof = state.profile;
  const jOutfit = $('#jOutfit');
  const jColor = $('#jColor');
  const jSkin = $('#jSkin');
  const renderPicker = () => {
    jOutfit.innerHTML = '';
    for (const o of OUTFITS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = o.name;
      b.classList.toggle('on', prof.look.outfit === o.id);
      b.onclick = () => { prof.look.outfit = o.id; renderPicker(); };
      jOutfit.append(b);
    }
    jColor.innerHTML = '';
    for (const c of PALETTE) {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.background = c;
      b.title = c;
      b.classList.toggle('on', prof.look.color === c);
      b.onclick = () => { prof.look.color = c; renderPicker(); };
      jColor.append(b);
    }
    jSkin.innerHTML = '';
    SKIN_TONES.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.background = c;
      b.classList.toggle('on', prof.look.skin === i);
      b.onclick = () => { prof.look.skin = i; renderPicker(); };
      jSkin.append(b);
    });
  };
  $('#jZone').innerHTML = ZONES.map((z) => `<option value="${z.id}">${z.icon} ${z.name}</option>`).join('');

  function openJoin(zone) {
    renderPicker();
    $('#jName').value = prof.name;
    $('#jSub').value = prof.sub;
    $('#jZone').value = zone?.id || 'welcome';
    $('#joinModal').classList.remove('hidden');
    setTimeout(() => $('#jName').focus(), 50);
  }
  $('#jCancel').addEventListener('click', () => $('#joinModal').classList.add('hidden'));
  $('#joinForm').addEventListener('submit', (e) => {
    e.preventDefault();
    prof.name = $('#jName').value.trim().slice(0, 20);
    prof.sub = $('#jSub').value;
    if (!prof.name) return;
    prof.look.hair = prof.look.hair || HAIR_COLORS[0];
    store.setItem('wedding-profile', JSON.stringify(prof));
    $('#joinModal').classList.add('hidden');
    startPlay(zoneById($('#jZone').value));
  });

  // ---------- Vào tiệc ----------
  function spawnAt(zone) {
    const [sx, sz] = zone.spawn;
    const p = new THREE.Vector3(sx + (Math.random() - 0.5) * 3, 0, sz + (Math.random() - 0.5) * 2);
    venue.resolve(p);
    p.y = venue.heightAt(p.x, p.z);
    const [tx, , tz] = zone.view.t;
    return { p, yaw: Math.atan2(tx - p.x, tz - p.z) };
  }

  function startPlay(zone) {
    const av = new Avatar(prof.look, prof.name, prof.sub);
    scene.add(av.root);
    avatars.add(av);
    const { p, yaw } = spawnAt(zone);
    state.me = { av, pos: p, vy: 0, yaw, onGround: true, lastSend: 0, sent: '', sit: null, puff: 0, pianoT: 0 };
    updateHeartPill();
    $('#heartCount').classList.remove('hidden');
    state.camYaw = yaw;
    state.camPitch = 0.3;
    state.mode = 'play';
    state.zone = null;
    state.emote = null;
    controls.enabled = false;
    camera.position.set(p.x - Math.sin(yaw) * 8, p.y + 5, p.z - Math.cos(yaw) * 8);
    deselect();
    $('#overviewPanel').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    $('#chatLog').innerHTML = '';
    fx.sparkle(p);
    net.join({ name: prof.name, sub: prof.sub, look: prof.look, p: [p.x, p.y, p.z], r: yaw, zone: zone.id });
    if (!music.on) setMusic(true);
    music.sfx('chime');
    addChat('', `Chào mừng ${prof.name} đến dự đám cưới ${WEDDING.groom} & ${WEDDING.bride}! 💕`, null, true);
    setTimeout(() => addChat('', '💡 Mẹo: lại gần đồ vật để thấy nút tương tác (E/R), bấm vào khách khác để giao lưu, phím F/G/L/U/P cho pháo hoa, tung hoa, đèn trời, bóng bay, chụp ảnh.', null, true), 1500);
  }

  function leavePlay() {
    if (!state.me) return;
    if (state.me.sit) standUp();
    $('#heartCount').classList.add('hidden');
    endPhoto();
    closeSocial();
    net.leave();
    avatars.delete(state.me.av);
    state.me.av.dispose();
    state.me = null;
    state.walkTo = null;
    state.mode = 'overview';
    state.zone = null;
    controls.enabled = true;
    $('#hud').classList.add('hidden');
    $('#zoneMenu').classList.add('hidden');
    $('#overviewPanel').classList.remove('hidden');
    music.party = false;
    flyTo(PRESETS.overview.p, PRESETS.overview.t);
  }

  // ---------- HUD: biểu cảm ----------
  const emoteBar = $('#emoteBar');
  for (const em of EMOTES) {
    const b = document.createElement('button');
    b.dataset.emote = em.id;
    b.title = `${em.name} (phím ${em.key})`;
    b.innerHTML = `${em.icon}<small>${em.key} · ${em.name}</small>`;
    b.addEventListener('click', () => setEmote(state.emote === em.id ? null : em.id));
    emoteBar.append(b);
  }
  const EMOTE_LINES = {
    wave: ['Chào bạn! 👋', 'Hi 😄'],
    dance: ['Quẩy cùng nào! 💃', 'Lên nhạc!'],
    dance2: ['Disco nào 🕺'],
    cheer: ['Yeah! 🙌', 'Hú hú!'],
    toast: ['Zô! 🥂', 'Dô dô!'],
    bow: ['Dạ chào bạn 🙇'],
  };
  function setEmote(id, dur = 0) {
    const me = state.me;
    if (id && me?.sit && id !== 'sit') standUp();
    state.emote = id;
    state.emoteUntil = dur ? performance.now() + dur * 1000 : 0;
    emoteBar.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.emote === id));
    if (!id || !me) return;
    if (id === 'toast' && !dur) { me.av.say('Zô! 🥂', 3000); music.sfx('clink', 0.6); }
    if (!dur && EMOTE_LINES[id]) bots.react(me.pos, id, 7, 0.5, EMOTE_LINES[id]);
    fx.ring(me.pos, '#ffd6e8', 0.5, 1.5);
  }

  // ---------- HUD: hành động nhanh (đồng bộ cho mọi người) ----------
  const sendFx = (k, p, extra = {}) => net.send({ t: 'fx', k, p: arr3(p), ...extra });
  const forward = (d = 1) => V3(Math.sin(state.me.yaw) * d, 0, Math.cos(state.me.yaw) * d);
  const ACTIONS = [
    {
      id: 'firework', key: 'F', icon: '🎆', name: 'Pháo hoa', cd: 2.5,
      run: () => {
        const p = state.me.pos.clone().add(forward(14));
        p.y = 0;
        // Ngửa camera lên để ngắm pháo hoa
        if (!state.firstPerson) { state.camYaw = state.me.yaw; state.camPitch = Math.min(state.camPitch, -0.35); }
        const c = pick(FW_COLORS);
        fx.firework(p, c, rand(10, 13));
        sendFx('firework', p, { c });
        setEmote('cheer', 2);
        bots.react(p, 'cheer', 30, 0.5, ['Đẹp quá! 🎆', 'Woaaa 😍', 'Pháo hoa kìa!']);
      },
    },
    {
      id: 'petals', key: 'G', icon: '🌸', name: 'Tung hoa', cd: 1.5,
      run: () => {
        fx.petals(state.me.pos, state.me.yaw);
        sendFx('petals', state.me.pos, { r: +state.me.yaw.toFixed(2) });
        setEmote('cheer', 1.2);
      },
    },
    {
      id: 'lantern', key: 'L', icon: '🏮', name: 'Đèn trời', cd: 4,
      run: () => {
        fx.lantern(state.me.pos);
        sendFx('lantern', state.me.pos);
        setEmote('heart', 2.5);
        toast('🏮 Điều ước của bạn đang bay lên trời...');
      },
    },
    {
      id: 'balloon', key: 'U', icon: '🎈', name: 'Bóng bay', cd: 2,
      run: () => {
        const c = pick(['#ffafcc', '#cdb4db', '#bde0fe', '#ffc8dd', '#fde68a', '#ff8fab']);
        fx.balloon(state.me.pos, c);
        sendFx('balloon', state.me.pos, { c });
        setEmote('wave', 2);
      },
    },
    { id: 'photo', key: 'P', icon: '📸', name: 'Chụp ảnh', cd: 1, run: () => takePhoto('selfie') },
  ];
  const actionBar = $('#actionBar');
  for (const a of ACTIONS) {
    const b = document.createElement('button');
    b.dataset.action = a.id;
    b.title = `${a.name} (phím ${a.key})`;
    b.innerHTML = `${a.icon} ${a.name}<kbd>${a.key}</kbd>`;
    b.addEventListener('click', () => doAction(a));
    actionBar.append(b);
    a.btn = b;
  }
  function doAction(a) {
    if (!state.me || state.photo) return;
    const now = performance.now();
    if ((state.cooldown[a.id] || 0) > now) return;
    state.cooldown[a.id] = now + a.cd * 1000;
    a.btn.classList.remove('cd');
    void a.btn.offsetWidth;
    a.btn.style.setProperty('--cd', `${a.cd}s`);
    a.btn.classList.add('cd');
    setTimeout(() => a.btn.classList.remove('cd'), a.cd * 1000);
    a.run();
  }

  // ---------- Ghế ngồi ----------
  function sit(chair) {
    const me = state.me;
    const special = chair.kind === 'swing' || chair.kind === 'piano';
    if (!me || (!special && bots.taken.has(chair))) return;
    state.walkTo = null;
    setEmote(null);
    me.sit = chair;
    chair.byPlayer = true;
    me.pos.set(chair.x, chair.y || 0, chair.z);
    if (chair.kind === 'swing') decor.swing.occupied = true;
    if (chair.kind === 'piano') { music.duck(true); me.av.say('🎹 Một bản nhạc tặng cô dâu chú rể!', 3500); }
    me.yaw = chair.ry;
    me.vy = 0;
    state.camYaw = chair.ry;
    music.sfx('pop', 0.4);
  }
  function standUp() {
    const me = state.me;
    if (!me?.sit) return;
    const c = me.sit;
    c.byPlayer = false;
    me.sit = null;
    if (c.kind === 'swing') decor.swing.occupied = false;
    if (c.kind === 'piano') music.duck(false);
    const s = c.standOff ?? (c.kind === 'ceremony' ? 0.75 : -0.65);
    me.pos.set(c.x + Math.sin(c.ry) * s, c.y || 0, c.z + Math.cos(c.ry) * s);
    venue.resolve(me.pos, 0.35);
  }

  // ---------- Điểm tương tác trong bản đồ ----------
  const near = (p, it) => (it.rect
    ? p.x > it.rect[0] && p.x < it.rect[1] && p.z > it.rect[2] && p.z < it.rect[3]
    : Math.hypot(p.x - it.x, p.z - it.z) < it.r);
  const DF = venue.danceFloor;
  const swingSeat = { kind: 'swing', x: decor.swing.pos.x, z: decor.swing.pos.z, ry: decor.swing.ry, standOff: 1.0 };
  const pianoSeat = decor.piano.seat;
  const INTERACTS = [
    { x: decor.fountain.pos.x, z: decor.fountain.pos.z, r: 2.9, actions: [{ label: '🪙 Ném đồng xu ước nguyện', run: () => throwCoin() }] },
    { x: decor.car.pos.x, z: decor.car.pos.z, r: 3.0, actions: [{ label: '📯 Bấm còi xe hoa', run: () => honkCar() }, { label: '📸 Chụp ảnh với xe hoa', run: () => takePhoto('car') }] },
    { x: decor.swing.pos.x, z: decor.swing.pos.z, r: 1.8, actions: [{ label: '🪢 Ngồi xích đu', run: () => sit(swingSeat) }] },
    { x: decor.lockWall.pos.x, z: decor.lockWall.pos.z, r: 2.7, actions: [{ label: '🔒 Treo khóa tình yêu', run: () => addLove() }] },
    { x: decor.champagne.pos.x, z: decor.champagne.pos.z, r: 2.3, actions: [{ label: '🍾 Rót tháp champagne', run: () => pourChampagne() }] },
    { x: decor.cart.pos.x + 1.2, z: decor.cart.pos.z, r: 1.9, actions: [{ label: '🍦 Lấy một cây kem', run: getIceCream }] },
    { x: pianoSeat.x, z: pianoSeat.z, r: 1.3, actions: [{ label: '🎹 Chơi đàn piano', run: () => sit(pianoSeat) }] },
    { x: decor.pond.pos.x, z: decor.pond.pos.z, r: 5.4, actions: [{ label: '🦢 Cho thiên nga ăn', run: () => feedSwans() }] },
    { x: 0, z: -6.4, r: 3.3, actions: [{ label: '💐 Xin hoa cưới', run: () => bouquetToss() }, { label: '💋 Hô "Hôn đi!"', run: () => coupleKiss() }] },
    { x: venue.cake.x, z: venue.cake.z, r: 2.4, actions: [{ label: '🍰 Ăn bánh cưới', run: eatCake }] },
    { x: 38.4, z: 30, r: 2.3, actions: [{ label: '🍹 Gọi cocktail', run: orderDrink }] },
    { x: -31, z: 38, r: 3.6, actions: [{ label: '📸 Chụp ảnh check-in', run: () => takePhoto('backdrop') }] },
    { x: venue.heartFrame.pos.x, z: venue.heartFrame.pos.z, r: 2.2, actions: [{ label: '💞 Chụp trong khung tim', run: () => takePhoto('heart') }] },
    ...venue.balloonSpots.map((p) => ({ x: p.x, z: p.z, r: 1.9, actions: [{ label: '🎈 Thả bóng bay', run: () => doAction(ACTIONS[3]) }] })),
    { x: 6, z: 34.6, r: 1.9, actions: [{ label: '🧧 Bỏ phong bì mừng cưới', run: () => openModal('#giftModal') }] },
    { x: -6, z: 35.3, r: 1.9, actions: [{ label: '📖 Xem sổ lưu bút', run: () => { renderBook(); openModal('#bookModal'); } }] },
    { x: 0, z: 38.3, r: 2.8, actions: [{ label: '🏮 Thả đèn trời', run: () => doAction(ACTIONS[2]) }, { label: '🔔 Rung chuông cưới', run: () => ringBell() }] },
    { rect: [22, 40, -14, -2.6], actions: [{ label: '🎆 Bắn pháo hoa sân khấu', run: stageShow }, { label: '🎤 Cầm mic hát', run: () => setEmote('sing') }] },
    { rect: [DF.x0, DF.x1, DF.z0, DF.z1], actions: [{ label: '🪩 Bật đèn Disco', run: () => startDisco() }] },
  ];

  function findOptions() {
    const me = state.me;
    if (!me || state.photo) return [];
    if (me.sit) return [{ label: '🧍 Đứng dậy', run: standUp }];
    const dp = decor.dog.pos;
    if (Math.hypot(me.pos.x - dp.x, me.pos.z - dp.z) < 1.9) {
      return [{ label: '🐶 Xoa đầu cún', run: petDog }, { label: decor.dog.followT > 0 ? '🏠 Cho cún tự chơi' : '🦮 Rủ cún đi dạo', run: toggleDog }];
    }
    for (const it of INTERACTS) if (near(me.pos, it)) return it.actions;
    let best = null;
    let bd = 1.15;
    for (const c of venue.chairs) {
      const d = Math.hypot(me.pos.x - c.x, me.pos.z - c.z);
      if (d < bd && !bots.taken.has(c)) { bd = d; best = c; }
    }
    if (best) return [{ label: '🪑 Ngồi xuống', run: () => sit(best) }];
    return [];
  }
  const promptEl = $('#prompt');
  function updatePrompt() {
    const opts = findOptions();
    const sig = opts.map((o) => o.label).join('|');
    state.options = opts;
    if (sig === state.optSig) return;
    state.optSig = sig;
    promptEl.innerHTML = '';
    promptEl.classList.toggle('hidden', !opts.length);
    opts.slice(0, 2).forEach((o, i) => {
      const b = document.createElement('button');
      b.innerHTML = `<kbd>${i ? 'R' : 'E'}</kbd>${o.label}`;
      b.addEventListener('click', () => runOption(i));
      promptEl.append(b);
    });
    if (opts.length) music.sfx('tick', 0.4);
  }
  function runOption(i) {
    const o = state.options[i];
    if (!o) return;
    o.run();
    state.optSig = '';
  }

  // ---------- Các tương tác cụ thể ----------
  // ---------- Tương tác với vật trang trí mới ----------
  const FORTUNES = ['Sắp có người yêu 💘', 'Sắp được ăn cưới tiếp 😆', 'Tiền vào như nước 💰', 'Khỏe mạnh, cười suốt năm 😄', 'Gặp đúng người, đúng lúc 💞', 'Đi đâu cũng gặp may 🍀', 'Sớm có tin vui nha 👶', 'Điều ước sẽ thành hiện thực ✨', 'Năm nay thăng chức tăng lương 📈'];
  function throwCoin(remote = false, from = null) {
    const src = remote ? from : state.me.av.handWorld();
    const tgt = decor.fountain.pos.clone().add(V3(rand(-0.8, 0.8), 0.48, rand(-0.8, 0.8)));
    const coin = fx.makeCoin();
    fx.throwArc(coin, src, () => tgt, 0.9, 1.6, (o) => {
      o.userData.dispose();
      fx.splash(tgt);
      decor.fountain.splash();
      fx.sound('splash', tgt);
      if (!remote && state.me) {
        toast(`🪙 Điều ước của bạn: <b>${pick(FORTUNES)}</b>`, 5000);
        fx.sparkle(state.me.pos);
      }
    });
    if (!remote) { setEmote('wave', 1.2); sendFx('coin', state.me.pos); }
  }
  function honkCar(remote = false) {
    decor.car.honk();
    fx.sound('honk', decor.car.pos);
    bots.react(decor.car.pos, 'cheer', 12, 0.5, ['Xe hoa đẹp quá! 🚗', 'Bíp bíp! 😆', 'Just Married! 💕']);
    if (!remote) { sendFx('honk', decor.car.pos); setEmote('cheer', 1.5); }
  }
  function ringBell(remote = false) {
    decor.bell.ring();
    fx.sound('bell', decor.bell.pos);
    fx.hearts(V3(0, 2.6, 40), 8);
    bots.react(V3(0, 0, 36), 'clap', 14, 0.6, ['Chuông cưới vang rồi! 🔔', 'Trăm năm hạnh phúc! 💕']);
    if (!remote) { sendFx('bell', decor.bell.pos); setEmote('cheer', 1.5); }
  }
  function addLove(remote = false, color = null) {
    const c = color || pick(['#ff4f79', '#ffd166', '#7cc6fe', '#c77dff', '#ff9f1c', '#06d6a0']);
    const wp = decor.lockWall.addLock(c);
    fx.hearts(wp.clone().add(V3(0, -1.3, 0)), 4);
    fx.sound('clink', wp);
    if (!remote) {
      state.me.av.say(`🔒 Khóa chặt yêu thương cho ${WEDDING.groom} & ${WEDDING.bride}!`, 4000);
      toast('🔒 Bạn đã treo khóa tình yêu! Chìa khóa đã ném xuống hồ rồi nha 😉');
      setEmote('heart', 2);
      sendFx('lock', wp, { c });
    }
  }
  function pourChampagne(remote = false) {
    const ch = decor.champagne;
    if (!ch.pour()) { if (!remote) toast('🍾 Tháp đang được rót, chờ chút nhé!'); return; }
    fx.sound('pour', ch.topPos);
    [300, 1500, 3000].forEach((d) => setTimeout(() => fx.sparkle(ch.topPos), d));
    setTimeout(() => {
      fx.sound('clink', ch.topPos);
      bots.react(ch.pos, 'toast', 16, 0.8, ['Zô! 🥂', 'Cạn ly!', 'Champagne!! 🍾']);
    }, 4600);
    if (!remote) {
      state.me.av.say('Champagne cho cả nhà! 🍾', 3500);
      setEmote('toast', 5);
      sendFx('champagne', ch.pos);
    }
  }
  function getIceCream() {
    const me = state.me;
    const ic = fx.makeIceCream();
    me.av.hold(ic, false);
    me.av.say(pick(['Kem dâu ngon quá 🍓', 'Mát lạnh luôn 🍦', 'Thêm viên socola nữa 😋']), 3500);
    music.sfx('pop', 0.6);
    fx.sparkle(me.pos);
    setTimeout(() => { if (me.av.held === ic) me.av.drop(); ic.userData.dispose(); }, 25000);
  }
  function feedSwans(remote = false, at = null) {
    const p = remote ? at : state.me.pos;
    decor.pond.feedAt(p);
    const toward = decor.pond.pos.clone().sub(p).setY(0).normalize();
    for (let i = 0; i < 6; i++) fx.puff(p.clone().addScaledVector(toward, 1 + Math.random()), '#e8d2a6');
    fx.hearts(decor.pond.pos, 4);
    if (!remote) {
      toast('🦢 Đôi thiên nga đang bơi lại gần bạn...');
      setEmote('wave', 1.5);
      sendFx('swan', p);
    }
  }
  function petDog() {
    decor.dog.pet();
    fx.hearts(decor.dog.pos.clone().add(V3(0, -0.9, 0)), 5);
    fx.sound('bark', decor.dog.pos);
    state.me.av.say(pick(['Cún ngoan quá 🐶', 'Ai là bé ngoan nè 🥰', 'Bắt tay nào! 🐾']), 3000);
    setEmote('bow', 1.6);
  }
  function toggleDog() {
    if (decor.dog.followT > 0) { decor.dog.followT = 0; toast('🐶 Cún đi chơi tiếp đây!'); return; }
    decor.dog.follow(120);
    fx.sound('bark', decor.dog.pos);
    toast('🦮 Cún sẽ đi theo bạn trong 2 phút. Gâu gâu!');
  }

  // ---------- Trái tim vàng ẩn ----------
  const heartsKey = 'wedding-hearts';
  const heartsTaken = new Set(JSON.parse(store.getItem(heartsKey) || '[]'));
  for (const i of heartsTaken) decor.setHeartTaken(i);
  function updateHeartPill() {
    $('#heartCount').textContent = `💛 ${heartsTaken.size}/${decor.hearts.length}`;
  }
  function checkHearts() {
    const me = state.me;
    for (const h of decor.hearts) {
      if (h.taken || Math.hypot(me.pos.x - h.pos.x, me.pos.z - h.pos.z) > 1.3) continue;
      decor.setHeartTaken(h.i);
      heartsTaken.add(h.i);
      store.setItem(heartsKey, JSON.stringify([...heartsTaken]));
      updateHeartPill();
      const pill = $('#heartCount');
      pill.classList.remove('bump');
      void pill.offsetWidth;
      pill.classList.add('bump');
      fx.sparkle(h.pos);
      fx.ring(h.pos, '#ffd166', 0.9, 3);
      music.sfx('chime');
      const n = heartsTaken.size;
      const total = decor.hearts.length;
      if (n >= total) {
        music.sfx('fanfare');
        fx.confetti(me.pos, 160);
        fx.fireworkShow(me.pos.clone().add(forward(12)).setY(0), 6, 6);
        toast('🏆 Bạn đã tìm đủ tất cả trái tim vàng! Danh hiệu: <b>Thám tử tình yêu 🕵️💛</b>', 7000);
        me.av.say('Tìm đủ hết rồi nè! 💛🏆', 5000);
        setEmote('cheer', 3);
      } else {
        toast(`💛 Tìm thấy trái tim vàng ${n}/${total}! Còn ${total - n} trái tim đang trốn quanh tiệc...`);
      }
    }
  }

  // ---------- Chương trình đám cưới (MC dẫn, đồng bộ theo giờ thực cho mọi người) ----------
  const PROGRAM = [
    { name: 'Trao nụ hôn', mc: 'Xin mời cô dâu chú rể trao nhau nụ hôn ngọt ngào! 💋', run: () => coupleKiss(true) },
    { name: 'Nâng ly chúc mừng', mc: 'Mời toàn thể quan khách cùng nâng ly chúc mừng! 🥂 (bấm phím 4)', run: allToast },
    { name: 'Pháo hoa chúc mừng', mc: 'Mời mọi người hướng về sân khấu xem pháo hoa! 🎆', run: () => stageShow(true) },
    { name: 'Điệu nhảy đầu tiên', mc: 'Và đây là điệu nhảy đầu tiên của cô dâu chú rể! 💃🕺', run: () => { couple.firstDance = 20; } },
    { name: 'Tung hoa cưới', mc: 'Cô dâu chuẩn bị tung hoa cưới! Ai sẽ là người may mắn? 💐', run: bouquetToGuest },
    { name: 'Thả đèn trời', mc: 'Cùng thả đèn trời gửi lời chúc tới đôi uyên ương! 🏮 (bấm phím L)', run: lanternRelease },
  ];
  const PERIOD = 120000;
  let progIdx = Math.floor(Date.now() / PERIOD);
  let progShown = '';
  function updateProgram() {
    const now = Date.now();
    const idx = Math.floor(now / PERIOD);
    if (idx !== progIdx) {
      progIdx = idx;
      const ev = PROGRAM[idx % PROGRAM.length];
      ev.run();
      toast(`🎤 <b>MC:</b> ${ev.mc}`, 6500);
      if (state.mode === 'play') addChat('🎤 MC', ev.mc);
      if (state.mode === 'play' || music.on) music.sfx('fanfare', 0.5);
    }
    const next = PROGRAM[(idx + 1) % PROGRAM.length];
    const left = Math.ceil(((idx + 1) * PERIOD - now) / 1000);
    const txt = `🎤 Tiếp theo: ${next.name} · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (txt !== progShown) { progShown = txt; $('#program').textContent = txt; }
  }
  function allToast() {
    for (const b of bots.list) {
      if (b.state === 'walk' || Math.random() < 0.15) continue;
      b.act = 'toast';
      b.timer = 6;
      if (Math.random() < 0.3) { const line = pick(['Zô! 🥂', 'Một hai ba dô!', 'Chúc mừng hạnh phúc! 🥂']); setTimeout(() => b.av.say(line, 4000), Math.random() * 1500); }
    }
    for (const av of [groom, bride]) couple.over.set(av, { anim: 'toast', until: performance.now() + 6000, yaw: 0 });
    fx.sound('clink', V3(0, 0, -8));
  }
  function bouquetToGuest() {
    const free = bots.list.filter((b) => !b.chair);
    const near = free.filter((b) => b.pos.distanceTo(bride.root.position) < 30);
    const b = pick(near.length ? near : free);
    if (!b) return;
    b.state = 'act';
    b.path = [];
    b.act = 'catch';
    b.timer = 7;
    b.face = Math.atan2(bride.root.position.x - b.pos.x, bride.root.position.z - b.pos.z);
    throwBouquet(b.av, false);
    setTimeout(() => {
      toast(`💐 <b>${esc(b.av.name)}</b> đã bắt được hoa cưới! Sắp có tin vui rồi 😍`, 4500);
      b.av.say('Mình bắt được rồi!!! 💐😍', 4000);
      bots.react(b.pos, 'clap', 15, 0.8, ['Chúc mừng nha! 🎉', 'Sắp cưới rồi kìa 😆']);
    }, 2200);
  }
  function lanternRelease() {
    for (let i = 0; i < 14; i++) setTimeout(() => fx.lantern(V3(rand(-7, 7), 0, rand(29, 39))), i * 380);
  }

  function eatCake() {
    const me = state.me;
    me.av.say(pick(['Bánh ngon quá! 🍰😋', 'Ngọt ngào như cô dâu chú rể 🍰', 'Cho mình thêm miếng nữa 😆']), 4000);
    fx.sparkle(venue.cake);
    setEmote('cheer', 1.5);
    music.sfx('chime', 0.7);
  }
  const COCKTAILS = [['🍹 Mojito dâu', '#ff4f79'], ['🍸 Blue Lagoon', '#3fa9f5'], ['🥂 Champagne', '#f4d27a'], ['🍊 Sunset Mimosa', '#ff9f1c'], ['🍵 Matcha Latte', '#8bc34a'], ['🍇 Rượu vang', '#7b1e3a']];
  function orderDrink() {
    const [name, c] = pick(COCKTAILS);
    state.me.av.setDrink(c);
    state.me.av.say(`${name} ngon tuyệt!`, 4000);
    setEmote('toast', 4);
    music.sfx('clink', 0.8);
    toast(`Bartender mời bạn một ly <b>${name}</b> 🍸`);
  }
  function stageShow(remote = false) {
    fx.fireworkShow(V3(31, 1, -12), 7, 8);
    if (!remote && state.me && !state.firstPerson) state.camPitch = Math.min(state.camPitch, -0.25);
    venue.partyBoost(6);
    bots.react(V3(31, 0, 4), 'cheer', 30, 0.8, ['Đẹp quá trời! 🎆', 'Woooo!', 'Pháo hoa kìa 😍']);
    if (!remote) { sendFx('show', V3(31, 1, -12)); setEmote('cheer', 2.5); }
  }
  function startDisco(remote = false) {
    venue.partyBoost(10);
    fx.confetti(V3((DF.x0 + DF.x1) / 2, 0.5, (DF.z0 + DF.z1) / 2), 160);
    music.sfx('fanfare', 0.8);
    bots.react(V3(31, 0, 5), 'dance', 25, 0.9, ['Quẩy lên!!! 🪩', 'Disco time 🕺', 'Nhạc hay quá!']);
    if (!remote) { sendFx('disco', V3(31, 0, 5)); setEmote('dance2'); }
  }

  // Cô dâu tung hoa cưới
  function bouquetToss() {
    const now = performance.now();
    if (couple.bouquetAt > now) { toast('💐 Cô dâu đang chuẩn bị bó hoa mới, chờ chút nha!'); return; }
    couple.bouquetAt = now + 12000;
    state.me.av.say('Cô dâu ơi, tung hoa đi! 💐', 2500);
    throwBouquet(state.me.av, true);
    sendFx('bouquet', state.me.pos, { to: net.id || '' });
  }
  function throwBouquet(target, mine) {
    bride.say('Bắt lấy nhé! 💐', 3000);
    couple.over.set(bride, { anim: 'cheer', until: performance.now() + 1500, yaw: Math.atan2(target.root.position.x - bride.root.position.x, target.root.position.z - bride.root.position.z) });
    setTimeout(() => {
      const b = fx.makeBouquet();
      fx.throwArc(b, bride.handWorld(), () => target.handWorld(), 1.4, 4, (obj) => {
        target.hold(obj);
        fx.sparkle(target.root.position);
        if (mine) {
          setEmote('catch', 4);
          fx.confetti(state.me.pos, 90);
          music.sfx('fanfare');
          toast('🎉 Bạn đã bắt được hoa cưới! Sắp có tin vui rồi nha 😍', 5000);
          bots.react(state.me.pos, 'clap', 15, 0.8, ['Chúc mừng nha! 🎉', 'Sắp cưới rồi kìa 😆', 'Ghê chưa!']);
        }
        setTimeout(() => { if (target.held === obj) target.drop(); obj.userData.dispose?.(); }, 9000);
      });
    }, 600);
  }

  // Cô dâu chú rể trao nụ hôn
  function coupleKiss(remote = false) {
    if (couple.kiss > 0) return;
    couple.kiss = 4;
    couple.kissFx = 0;
    music.sfx('chime');
    bots.react(V3(0, 0, -8), 'cheer', 30, 0.8, ['Hôn đi! Hôn đi! 😆', 'Wooo! 💕', 'Đẹp đôi quá!', '🥰🥰🥰']);
    setTimeout(() => fx.confetti(V3(0, 0.5, -8.4), 120), 1200);
    if (!remote) {
      state.me.av.say('Hôn đi! Hôn đi! 😆', 3000);
      setEmote('cheer', 3);
      sendFx('kiss', V3(0, 0, -8.4));
    }
  }

  // ---------- Giao lưu với khách khác ----------
  const SOCIAL = [
    { id: 'wave', label: '👋 Chào', emote: 'wave', dist: 0 },
    { id: 'toast', label: '🥂 Cụng ly', emote: 'toast', dist: 1.5 },
    { id: 'heart', label: '💖 Gửi tim', emote: 'heart', dist: 0 },
    { id: 'dance', label: '💃 Mời nhảy', emote: 'dance', dist: 2 },
    { id: 'hug', label: '🤗 Ôm', emote: 'hug', dist: 1.05 },
    { id: 'photo', label: '📸 Chụp chung', dist: 2.2 },
  ];
  const socialEl = $('#socialMenu');
  const peerIdOf = (av) => { for (const [id, p] of state.peers) if (p.av === av) return id; return null; };
  function openSocial(av, x, y) {
    state.social = av;
    const d = state.me ? state.me.pos.distanceTo(av.root.position) : 0;
    const [nm, sub] = [av.name || 'Khách', av === bride ? 'Cô dâu' : av === groom ? 'Chú rể' : peerIdOf(av) ? 'Khách online' : 'Khách mời'];
    socialEl.innerHTML = `<h4>${esc(nm)}<small>${sub} · cách bạn ${d.toFixed(0)}m</small></h4>`;
    for (const s of SOCIAL) {
      const b = document.createElement('button');
      b.textContent = s.label;
      b.addEventListener('click', () => { closeSocial(); doSocial(av, s); });
      socialEl.append(b);
    }
    socialEl.style.left = `${Math.min(innerWidth - 130, Math.max(130, x))}px`;
    socialEl.style.top = `${Math.max(265, y - 16)}px`;
    socialEl.classList.remove('hidden');
  }
  function closeSocial() {
    state.social = null;
    socialEl.classList.add('hidden');
  }
  function walkTo(target, stop, cb) {
    const me = state.me;
    if (me.sit) standUp();
    if (Math.hypot(target.x - me.pos.x, target.z - me.pos.z) <= stop + 0.05) { cb(); return; }
    state.walkTo = { target, stop, cb, start: performance.now() };
  }
  function doSocial(av, s) {
    const me = state.me;
    if (!me) return;
    const tp = av.root.position;
    if (me.pos.distanceTo(tp) > 14) { toast('Lại gần hơn chút để giao lưu nha 😊'); return; }
    if (s.id === 'photo') { walkTo(tp, s.dist, () => takePhoto('selfie', av)); return; }
    const go = () => {
      me.yaw = Math.atan2(tp.x - me.pos.x, tp.z - me.pos.z);
      setEmote(s.emote, s.id === 'dance' ? 10 : 3.5);
      socialFx(me.av, av, s.id);
      const peerId = peerIdOf(av);
      if (peerId) net.send({ t: 'fx', k: 'social', a: s.id, to: peerId, p: arr3(me.pos) });
      else if (av === bride || av === groom) coupleRespond(av, s.id);
      else bots.respond(av, s.id, me.pos);
    };
    if (s.dist) walkTo(tp, s.dist, go); else go();
  }
  function socialFx(fromAv, toAv, act) {
    const a = fromAv.root.position;
    const b = toAv.root.position;
    const mid = a.clone().lerp(b, 0.5);
    if (act === 'heart') fx.heartsTo(a, b);
    else if (act === 'toast') setTimeout(() => { fx.sparkle(mid); fx.sound('clink', mid); }, 500);
    else if (act === 'hug') { fx.hearts(mid, 8); fx.ring(mid, '#ffc2d4', 0.9, 2); }
    else if (act === 'dance') { fx.note(a); fx.note(b); fx.sound('chime', mid); }
    else if (act === 'wave') fx.ring(b, '#fff3b0', 0.6, 1.5);
  }
  const COUPLE_REPLY = {
    wave: ['Chào bạn nha! 👋', 'Cảm ơn bạn đã đến! 💕'],
    toast: ['Zô! Cảm ơn bạn nhiều 🥂', 'Trăm phần trăm! 🍻'],
    heart: ['Thương bạn 💕', 'Cảm ơn bạn nhiều nha 🥰'],
    dance: ['Nhảy thôi! 💃', 'Lát ra sàn nhảy nha 🕺'],
    hug: ['Ôm cái nào 🤗', 'Vui quá đi 🥹'],
  };
  function coupleRespond(av, act) {
    const anim = { wave: 'wave', toast: 'toast', heart: 'heart', dance: 'dance', hug: 'hug' }[act] || 'wave';
    const me = state.me;
    couple.over.set(av, { anim, until: performance.now() + 4000, yaw: Math.atan2(me.pos.x - av.root.position.x, me.pos.z - av.root.position.z) });
    setTimeout(() => av.say(pick(COUPLE_REPLY[act] || COUPLE_REPLY.wave), 4000), 400);
  }

  // ---------- Chụp ảnh ----------
  const countdownEl = $('#countdown');
  function takePhoto(kind, withAv = null) {
    const me = state.me;
    if (!me || state.photo) return;
    if (me.sit && kind !== 'selfie') standUp();
    state.walkTo = null;
    closeSocial();
    state.lastPhoto = kind;
    let camP;
    let look;
    let pose = 'selfie';
    if (kind === 'backdrop') {
      me.pos.x = Math.min(-27.5, Math.max(-34.5, me.pos.x));
      me.pos.z = Math.min(38.8, Math.max(36.5, me.pos.z));
      me.yaw = Math.PI;
      camP = V3(me.pos.x, 1.8, me.pos.z - 5.4);
      look = V3(me.pos.x, 1.55, me.pos.z + 2);
      pose = pick(['heart', 'kiss', 'cheer', 'wave']);
    } else if (kind === 'heart') {
      const { pos: hp, ry } = venue.heartFrame;
      const n = V3(Math.sin(ry), 0, Math.cos(ry));
      me.pos.set(hp.x + n.x * 1.1, 0, hp.z + n.z * 1.1);
      me.yaw = Math.atan2(-n.x, -n.z);
      camP = V3(hp.x - n.x * 6, 1.7, hp.z - n.z * 6);
      look = V3(hp.x, 1.55, hp.z);
      pose = pick(['heart', 'kiss']);
    } else if (kind === 'car') {
      const c = decor.car.pos;
      me.pos.set(c.x + rand(-0.6, 0.6), 0, c.z + 1.9);
      me.yaw = 0;
      camP = V3(c.x - 1, 1.8, c.z + 7.6);
      look = V3(c.x, 0.95, c.z + 0.6);
      pose = pick(['heart', 'cheer', 'kiss', 'wave']);
    } else if (withAv) {
      const tp = withAv.root.position;
      const mid = me.pos.clone().lerp(tp, 0.5);
      const side = V3(-(tp.z - me.pos.z), 0, tp.x - me.pos.x).normalize();
      if (side.dot(camera.position.clone().sub(mid)) < 0) side.negate();
      camP = mid.clone().addScaledVector(side, 3.4).add(V3(0, 1.9, 0));
      look = mid.clone().add(V3(0, 1.3, 0));
      me.yaw = Math.atan2(camP.x - me.pos.x, camP.z - me.pos.z);
      pose = 'heart';
      if (withAv === bride || withAv === groom) couple.over.set(withAv, { anim: 'heart', until: performance.now() + 4500, yaw: Math.atan2(camP.x - tp.x, camP.z - tp.z) });
      else bots.respond(withAv, 'heart', camP);
    } else {
      const f = forward(1);
      const r = V3(f.z, 0, -f.x);
      camP = me.pos.clone().addScaledVector(f, 2.3).addScaledVector(r, -0.4).add(V3(0, 2.1, 0));
      look = me.pos.clone().add(V3(0, 1.45, 0));
    }
    state.photo = { camP, look, t: 3, last: 4, pose };
    document.body.classList.add('photo-mode');
    setEmote(pose);
  }
  function endPhoto() {
    if (!state.photo) return;
    state.photo = null;
    document.body.classList.remove('photo-mode');
    countdownEl.classList.add('hidden');
  }
  function capturePhoto() {
    const url = canvas.toDataURL('image/jpeg', 0.92);
    endPhoto();
    setEmote(null);
    const fl = $('#flash');
    fl.classList.remove('on');
    void fl.offsetWidth;
    fl.classList.add('on');
    music.sfx('shutter');
    const img = new Image();
    img.onload = () => {
      const W = 960;
      const H = 720;
      const pad = 36;
      const c = document.createElement('canvas');
      c.width = W + pad * 2;
      c.height = H + pad + 150;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fffdf9';
      ctx.fillRect(0, 0, c.width, c.height);
      const ar = W / H;
      let sw = img.width;
      let sh = img.height;
      if (sw / sh > ar) sw = sh * ar; else sh = sw / ar;
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, pad, pad, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#c75b7a';
      ctx.font = `64px ${SCRIPT}`;
      ctx.fillText(`${WEDDING.groom} & ${WEDDING.bride}`, c.width / 2, H + pad + 72);
      ctx.fillStyle = '#8a7690';
      ctx.font = `600 22px ${FONT}`;
      ctx.fillText(`${WEDDING.date} · ${WEDDING.hashtag} · 📸 ${prof.name}`, c.width / 2, H + pad + 116);
      drawHeart(ctx, pad + 40, H + pad + 70, 36, '#ff8fab');
      drawHeart(ctx, c.width - pad - 40, H + pad + 70, 36, '#ff8fab');
      const out = c.toDataURL('image/jpeg', 0.92);
      $('#photoImg').src = out;
      $('#photoDl').href = out;
      $('#photoDl').download = `${WEDDING.hashtag.replace(/\W/g, '') || 'wedding'}-${Date.now()}.jpg`;
      openModal('#photoModal');
    };
    img.src = url;
  }
  $('#photoAgain').addEventListener('click', () => { $('#photoModal').classList.add('hidden'); takePhoto(state.lastPhoto); });

  $('#hLeave').addEventListener('click', leavePlay);
  $('#hView').addEventListener('click', () => { state.firstPerson = !state.firstPerson; });
  $('#hBubble').addEventListener('click', () => {
    state.bubblesHidden = !state.bubblesHidden;
    $('#hBubble').textContent = state.bubblesHidden ? '💬 Hiện chat' : '💬 Ẩn chat';
  });
  const zoneMenu = $('#zoneMenu');
  for (const zn of ZONES) {
    const b = document.createElement('button');
    b.textContent = `${zn.icon} ${zn.name}`;
    b.addEventListener('click', () => {
      zoneMenu.classList.add('hidden');
      if (!state.me) return;
      standUp();
      const { p, yaw } = spawnAt(zn);
      state.me.pos.copy(p);
      state.me.yaw = yaw;
      state.camYaw = yaw;
      state.walkTo = null;
      fx.sparkle(p);
      music.sfx('chime', 0.6);
    });
    zoneMenu.append(b);
  }
  $('#hZone').addEventListener('click', () => zoneMenu.classList.toggle('hidden'));

  // Mừng cưới & sổ lưu bút
  const { gift } = WEDDING;
  if (gift.account) {
    $('#bankInfo').classList.remove('hidden');
    $('#bankInfo').innerHTML = `🏦 <b>${esc(gift.bank)}</b><br>STK: <b>${esc(gift.account)}</b><br>Chủ TK: ${esc(gift.owner)}`;
  }
  const openModal = (id) => $(id).classList.remove('hidden');
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('.modal').classList.add('hidden')));
  document.querySelectorAll('.modal').forEach((m) => m.addEventListener('pointerdown', (e) => { if (e.target === m) m.classList.add('hidden'); }));
  $('#hGift').addEventListener('click', () => openModal('#giftModal'));
  $('#bookWrite').addEventListener('click', () => { $('#bookModal').classList.add('hidden'); openModal('#giftModal'); });
  $('#hBook').addEventListener('click', () => { renderBook(); openModal('#bookModal'); });
  $('#giftForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#gText').value.trim();
    if (!text) return;
    const wish = { name: prof.name || 'Khách', sub: prof.sub, text, gift: $('#gEnvelope').checked, time: Date.now() };
    if (net.online) net.send({ t: 'wish', ...wish });
    else onWish({ ...wish, id: 'me' });
    $('#gText').value = '';
    $('#giftModal').classList.add('hidden');
    toast('💖 Đã gửi lời chúc tới cô dâu chú rể!');
  });
  function renderBook() {
    const list = $('#bookList');
    if (!state.wishes.length) { list.innerHTML = '<p class="muted">Chưa có lời chúc nào. Hãy là người đầu tiên! ✍️</p>'; return; }
    list.innerHTML = [...state.wishes].reverse().map((w) => `
      <div class="wish"><b>${esc(w.name)}</b> <span class="meta">${esc(w.sub || '')} · ${new Date(w.time).toLocaleString('vi-VN')}${w.gift ? ' · 🧧' : ''}</span>
      <p>${esc(w.text)}</p></div>`).join('');
  }
  function onWish(w) {
    state.wishes.push(w);
    if (!net.online) store.setItem('wedding-wishes', JSON.stringify(state.wishes.slice(-200)));
    toast(`${w.gift ? '🧧' : '💌'} <b>${esc(w.name)}</b>: ${esc(w.text.slice(0, 80))}`, 5000);
    fx.confetti(new THREE.Vector3(0, 0.3, -8.4));
    fx.firework(V3(rand(-6, 6), 0, -14), pick(FW_COLORS));
    const who = w.id === net.id || w.id === 'me' ? state.me?.av : state.peers.get(w.id)?.av;
    if (who) fx.hearts(who.root.position, 10);
    bride.say('Cảm ơn bạn nhiều nha! 💕', 5000);
    couple.over.set(bride, { anim: 'heart', until: performance.now() + 3000, yaw: 0 });
    couple.over.set(groom, { anim: 'bow', until: performance.now() + 3000, yaw: 0 });
  }

  // ---------- Chat ----------
  const chatInput = $('#chatInput');
  const chatLog = $('#chatLog');
  function addChat(name, text, av, sys = false) {
    const div = document.createElement('div');
    div.className = `msg${sys ? ' sys' : ''}`;
    div.innerHTML = name ? `<b>${esc(name)}:</b> ${esc(text)}` : esc(text);
    chatLog.append(div);
    while (chatLog.children.length > 30) chatLog.firstChild.remove();
    setTimeout(() => div.classList.add('old'), 20000);
  }
  $('#chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    chatInput.value = '';
    chatInput.blur();
    if (!text) return;
    if (!state.me) return;
    state.me.av.say(text);
    addChat(prof.name, text);
    net.send({ t: 'chat', text });
  });

  function toast(html, ms = 3500) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = html;
    $('#toasts').append(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 500); }, ms);
  }

  // ---------- Nhạc & đồ hoạ ----------
  function setMusic(on) {
    if (on) music.start(); else music.stop();
    $('#btnMusic').textContent = music.on ? '🔇 Tắt nhạc' : '🎵 Bật nhạc';
    if (on && music.playingTrack) toast(`🎵 Đang phát: <b>${esc(music.trackTitle)}</b>`);
  }
  if (WEDDING.music?.src) {
    // Chỉ dùng file nhạc nếu thực sự tồn tại (dev server trả về index.html khi thiếu file)
    fetch(WEDDING.music.src, { method: 'HEAD' }).then((r) => {
      const type = r.headers.get('content-type') || '';
      if (!r.ok || !/audio|mpeg|ogg|mp4|octet/.test(type)) return;
      music.setTrack(WEDDING.music.src, WEDDING.music.title);
      $('#btnMusic').title = `🎵 ${WEDDING.music.title}`;
      if (music.on) { music.stop(); setMusic(true); }
    }).catch(() => {});
  }
  $('#btnMusic').addEventListener('click', () => setMusic(!music.on));
  function setFx(on) {
    hiFx = on;
    store.setItem('wedding-fx', on ? '1' : '0');
    $('#btnFx').textContent = on ? '✨ Đồ hoạ cao' : '⚡ Đồ hoạ nhẹ';
    ambient.fireflies.visible = on;
    ambient.petalMesh.visible = on;
  }
  $('#btnFx').addEventListener('click', () => setFx(!hiFx));
  setFx(hiFx);

  // ---------- Mạng ----------
  const onlinePill = $('#online');
  const localWishes = JSON.parse(store.getItem('wedding-wishes') || '[]');
  state.wishes = localWishes;
  net.on('status', (on) => { if (!on) onlinePill.textContent = '⚪ Offline'; });
  net.on('welcome', (m) => {
    state.wishes = m.wishes || [];
    for (const p of m.peers) addPeer(p);
  });
  net.on('reset', () => { for (const id of [...state.peers.keys()]) removePeer(id); });
  net.on('count', (m) => { onlinePill.textContent = `🟢 ${m.joined} khách đang dự · ${m.watching} người xem`; });
  net.on('join', (m) => {
    addPeer(m.peer);
    if (state.mode === 'play') addChat('', `${m.peer.name} vừa đến dự tiệc 🎉`, null, true);
  });
  net.on('leave', (m) => removePeer(m.id));
  net.on('s', (m) => {
    const p = state.peers.get(m.id);
    if (!p) return;
    p.target.set(...m.p);
    p.tyaw = m.r;
    p.anim = m.a;
    p.zone = m.z;
  });
  net.on('chat', (m) => {
    const p = state.peers.get(m.id);
    if (!p) return;
    p.av.say(m.text);
    if (state.mode === 'play' && m.zone === state.zone?.id) addChat(p.name, m.text);
  });
  net.on('wish', (m) => onWish(m.wish));
  const SOCIAL_TEXT = { wave: 'vẫy chào', toast: 'cụng ly với', heart: 'gửi tim cho', dance: 'mời nhảy', hug: 'ôm' };
  net.on('fx', (m) => {
    const p = V3(...(m.p || [0, 0, 0]));
    const peer = state.peers.get(m.id);
    switch (m.k) {
      case 'firework': fx.firework(p, m.c); break;
      case 'show': stageShow(true); break;
      case 'disco': startDisco(true); break;
      case 'lantern': fx.lantern(p); break;
      case 'balloon': fx.balloon(p, m.c); break;
      case 'petals': fx.petals(p, m.r || 0); break;
      case 'kiss': coupleKiss(true); break;
      case 'bouquet': if (peer) throwBouquet(peer.av, false); break;
      case 'bell': ringBell(true); break;
      case 'honk': honkCar(true); break;
      case 'coin': throwCoin(true, peer ? peer.av.handWorld() : p.clone().add(V3(0, 1.4, 0))); break;
      case 'champagne': pourChampagne(true); break;
      case 'lock': addLove(true, m.c); break;
      case 'swan': feedSwans(true, p); break;
      case 'social': {
        if (!peer) return;
        const toMe = m.to === net.id;
        const target = toMe ? state.me?.av : state.peers.get(m.to)?.av;
        if (!target) return;
        socialFx(peer.av, target, m.a);
        if (toMe) {
          toast(`<b>${esc(peer.name)}</b> ${SOCIAL_TEXT[m.a] || 'chào'} bạn! <span class="muted">Bấm vào họ để đáp lại</span>`, 4500);
          music.sfx('pop', 0.6);
        }
        break;
      }
      default:
    }
  });

  function addPeer(p) {
    if (p.id === net.id || state.peers.has(p.id)) return;
    const av = new Avatar(p.look, p.name, p.sub);
    av.root.position.set(...p.p);
    scene.add(av.root);
    avatars.add(av);
    state.peers.set(p.id, { av, name: p.name, target: new THREE.Vector3(...p.p), yaw: p.r, tyaw: p.r, anim: p.a, zone: p.zone, lastHeart: 0 });
  }
  function removePeer(id) {
    const p = state.peers.get(id);
    if (!p) return;
    if (state.social === p.av) closeSocial();
    avatars.delete(p.av);
    p.av.dispose();
    state.peers.delete(id);
  }
  net.connect();

  // ---------- Điều khiển ----------
  addEventListener('keydown', (e) => {
    const typing = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'SELECT';
    if (typing) {
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }
    if (document.querySelector('.modal:not(.hidden)')) {
      if (e.key === 'Escape') document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden'));
      return;
    }
    state.keys[e.code] = true;
    if (state.mode !== 'play') return;
    if (e.key === 'Escape' && state.photo) { endPhoto(); setEmote(null); return; }
    if (e.key === 'Escape' && state.social) { closeSocial(); return; }
    if (e.repeat) return;
    if (e.key === 'Enter') { e.preventDefault(); chatInput.focus(); return; }
    if (e.code === 'Space') { e.preventDefault(); jump(); }
    const em = EMOTES.find((x) => x.key === e.key);
    if (em) setEmote(state.emote === em.id ? null : em.id);
    if (e.key === '0' || e.key === 'Escape') setEmote(null);
    if (e.code === 'KeyE') runOption(0);
    if (e.code === 'KeyR') runOption(1);
    const act = ACTIONS.find((a) => e.code === `Key${a.key}`);
    if (act) doAction(act);
    if (e.code === 'KeyV') state.firstPerson = !state.firstPerson;
    if (e.code === 'KeyB') $('#hBubble').click();
    if (e.code === 'KeyM') setMusic(!music.on);
  });
  addEventListener('keyup', (e) => { state.keys[e.code] = false; });
  addEventListener('blur', () => { state.keys = {}; });

  function jump() {
    const me = state.me;
    if (!me || state.photo) return;
    if (me.sit) { standUp(); return; }
    if (me.onGround) { me.vy = 6.2; me.onGround = false; fx.puff(me.pos); }
  }
  $('#btnJump').addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });

  // Kéo để xoay camera khi đang chơi
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'play') return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    state.camYaw -= (e.clientX - drag.x) * 0.006;
    state.camPitch = Math.min(1.2, Math.max(-0.4, state.camPitch + (e.clientY - drag.y) * 0.004));
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  const endDrag = (e) => { if (drag && drag.id === e.pointerId) drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    if (state.mode !== 'play') return;
    state.camDist = Math.min(14, Math.max(2.5, state.camDist + e.deltaY * 0.01));
  }, { passive: true });

  // Joystick cảm ứng
  const joy = $('#joystick');
  const knob = $('#knob');
  let joyId = null;
  const joyMove = (e) => {
    const r = joy.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    state.joy.x = dx / max;
    state.joy.y = -dy / max;
  };
  joy.addEventListener('pointerdown', (e) => { joyId = e.pointerId; joy.setPointerCapture(joyId); joyMove(e); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
  const joyEnd = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null;
    state.joy.x = state.joy.y = 0;
    knob.style.transform = '';
  };
  joy.addEventListener('pointerup', joyEnd);
  joy.addEventListener('pointercancel', joyEnd);

  // ---------- Cập nhật người chơi ----------
  const head = new THREE.Vector3();
  const seatTmp = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  function updatePlayer(dt, now) {
    const me = state.me;
    const typing = document.activeElement === chatInput;
    const k = state.keys;
    let ix = state.joy.x;
    let iz = state.joy.y;
    if (!typing) {
      if (k.KeyW || k.ArrowUp) iz += 1;
      if (k.KeyS || k.ArrowDown) iz -= 1;
      if (k.KeyA || k.ArrowLeft) ix -= 1;
      if (k.KeyD || k.ArrowRight) ix += 1;
    }
    if (state.photo) ix = iz = 0;
    const len = Math.min(1, Math.hypot(ix, iz));
    let moving = len > 0.08;
    const run = !typing && (k.ShiftLeft || k.ShiftRight);
    let speed = (run ? 7.5 : 4.2) * len;
    let mx = 0;
    let mz = 0;
    if (moving) {
      state.walkTo = null;
      const fx_ = Math.sin(state.camYaw);
      const fz_ = Math.cos(state.camYaw);
      mx = fx_ * iz - fz_ * ix;
      mz = fz_ * iz + fx_ * ix;
    } else if (state.walkTo) {
      // Tự đi tới chỗ người được mời giao lưu
      const w = state.walkTo;
      mx = w.target.x - me.pos.x;
      mz = w.target.z - me.pos.z;
      if (Math.hypot(mx, mz) <= w.stop || now - w.start > 6000) {
        state.walkTo = null;
        w.cb();
      } else {
        moving = true;
        speed = 4.2;
      }
    }
    if (moving) {
      if (me.sit) standUp();
      const dl = Math.hypot(mx, mz) || 1;
      me.pos.x += (mx / dl) * speed * dt;
      me.pos.z += (mz / dl) * speed * dt;
      me.yaw = lerpAngle(me.yaw, Math.atan2(mx, mz), 1 - Math.exp(-12 * dt));
      if (state.emote) setEmote(null);
    }

    let anim;
    if (me.sit) {
      if (me.sit.kind === 'swing') {
        decor.swing.seatWorld(seatTmp);
        me.pos.set(seatTmp.x, seatTmp.y - 0.49, seatTmp.z);
      } else me.pos.set(me.sit.x, me.sit.y || 0, me.sit.z);
      me.yaw = me.sit.ry;
      anim = me.sit.kind === 'piano' ? 'piano' : 'sit';
      if (anim === 'piano') {
        me.pianoT -= dt;
        if (me.pianoT <= 0) { me.pianoT = rand(0.16, 0.42); music.sfx('piano', 0.9); }
      }
    } else {
      const wasGround = me.onGround;
      const fallSpeed = me.vy;
      venue.resolve(me.pos, 0.35);
      const ground = venue.heightAt(me.pos.x, me.pos.z);
      me.vy -= 20 * dt;
      me.pos.y += me.vy * dt;
      if (me.pos.y <= ground || (me.onGround && me.vy <= 0 && me.pos.y - ground < 0.35)) {
        me.pos.y = ground;
        me.vy = 0;
        me.onGround = true;
      } else {
        me.onGround = false;
      }
      if (!wasGround && me.onGround && fallSpeed < -4) { for (let i = 0; i < 4; i++) fx.puff(me.pos); }
      if (moving && run && me.onGround) {
        me.puff -= dt;
        if (me.puff <= 0) { me.puff = 0.09; fx.puff(me.pos); }
      }
      anim = !me.onGround ? 'jump' : moving ? 'walk' : state.emote || 'idle';
    }
    if (state.emoteUntil && now > state.emoteUntil) setEmote(null);
    me.av.root.position.copy(me.pos);
    me.av.root.rotation.y = me.yaw;
    me.av.update(dt, anim, speed);
    me.av.root.visible = !state.firstPerson || !!state.photo;

    // Đổi khu
    const zn = zoneAt(me.pos.x, me.pos.z);
    if (zn && zn !== state.zone) {
      state.zone = zn;
      const badge = $('#zoneBadge');
      badge.textContent = `${zn.icon} ${zn.name}`;
      badge.classList.remove('bump');
      void badge.offsetWidth;
      badge.classList.add('bump');
      addChat('', `Bạn đã vào khu: ${zn.icon} ${zn.name}`, null, true);
      music.party = zn.id === 'party';
    }

    // Lời chào của cô dâu chú rể
    couple.greetCd -= dt;
    if (couple.greetCd <= 0 && me.pos.distanceTo(bride.root.position) < 5) {
      couple.greetCd = 40;
      bride.say(`Cảm ơn ${prof.name} đã đến chung vui! 💕`, 6000);
      groom.say('Ăn uống thật vui nhé! 🥂', 6000);
      couple.over.set(groom, { anim: 'wave', until: performance.now() + 2500, yaw: 0 });
    }

    updatePrompt();
    checkHearts();

    // Gửi trạng thái (tối đa 5 lần/giây, chỉ khi có thay đổi – Firebase giữ trạng thái cuối nên không cần gửi lại định kỳ)
    const sig = `${me.pos.x.toFixed(2)},${me.pos.y.toFixed(2)},${me.pos.z.toFixed(2)},${me.yaw.toFixed(2)},${anim}`;
    if (now - me.lastSend > 200 && sig !== me.sent) {
      me.lastSend = now;
      me.sent = sig;
      net.send({ t: 's', p: arr3(me.pos), r: +me.yaw.toFixed(2), a: anim, z: state.zone?.id });
    }

    // Camera
    if (state.photo) return;
    head.set(me.pos.x, me.pos.y + (me.sit ? 1.25 : 1.6), me.pos.z);
    const fx_ = Math.sin(state.camYaw);
    const fz_ = Math.cos(state.camYaw);
    const cp = Math.cos(state.camPitch);
    const sp = Math.sin(state.camPitch);
    if (state.firstPerson) {
      camera.position.set(head.x + fx_ * 0.15, head.y + 0.05, head.z + fz_ * 0.15);
      camTarget.set(head.x + fx_ * cp * 5, head.y - sp * 5, head.z + fz_ * cp * 5);
      camera.lookAt(camTarget);
    } else {
      const d = state.camDist;
      camTarget.set(head.x - fx_ * cp * d, Math.max(0.4, head.y + sp * d), head.z - fz_ * cp * d);
      camera.position.lerp(camTarget, 1 - Math.exp(-10 * dt));
      camera.lookAt(head.x, head.y + 0.1, head.z);
    }
  }

  function updatePhoto(dt) {
    const ph = state.photo;
    ph.t -= dt;
    camera.position.lerp(ph.camP, 1 - Math.exp(-6 * dt));
    camera.lookAt(ph.look);
    const n = Math.ceil(ph.t);
    if (n !== ph.last && n > 0) {
      ph.last = n;
      countdownEl.classList.remove('hidden');
      countdownEl.innerHTML = `<span>${n}</span>`;
      music.sfx('tick');
    }
    if (ph.t <= 0) {
      countdownEl.classList.add('hidden');
      ph.capture = true;
    }
  }

  function updatePeers(dt) {
    for (const p of state.peers.values()) {
      const before = p.av.root.position.clone();
      p.av.root.position.lerp(p.target, 1 - Math.exp(-10 * dt));
      p.yaw = lerpAngle(p.yaw, p.tyaw, 1 - Math.exp(-10 * dt));
      p.av.root.rotation.y = p.yaw;
      const sp = before.distanceTo(p.av.root.position) / Math.max(dt, 1e-3);
      p.av.update(dt, p.anim === 'walk' && sp < 0.2 ? 'idle' : p.anim, sp);
    }
  }

  function updateCouple(dt) {
    const now = performance.now();
    couple.act -= dt;
    if (couple.act <= 0) {
      couple.act = 4 + Math.random() * 5;
      couple.groomAnim = ['idle', 'wave', 'idle', 'clap', 'bow'][Math.floor(Math.random() * 5)];
      couple.brideAnim = ['idle', 'heart', 'wave', 'idle', 'kiss'][Math.floor(Math.random() * 5)];
    }
    let gx = -0.85;
    let bx = 0.85;
    let gz = -8.4;
    let bz = -8.4;
    let gyaw = 0;
    let byaw = 0;
    let ga = couple.groomAnim;
    let ba = couple.brideAnim;
    if (couple.firstDance > 0) {
      couple.firstDance -= dt;
      couple.danceAng = (couple.danceAng || 0) + dt * 0.7;
      const th = couple.danceAng;
      const r = 0.38;
      gx = -r * Math.cos(th); gz = -8.4 + r * Math.sin(th);
      bx = -gx; bz = -8.4 - r * Math.sin(th);
      gyaw = Math.atan2(bx - gx, bz - gz);
      byaw = gyaw + Math.PI;
      ga = ba = 'hug';
      couple.kissFx -= dt;
      if (couple.kissFx <= 0) { couple.kissFx = 0.5; fx.hearts(V3(0, 0.4, -8.4), 2); fx.note(V3(0, 0.3, -8.4)); }
    } else if (couple.kiss > 0) {
      couple.kiss -= dt;
      gx = -0.36; bx = 0.36; gyaw = Math.PI / 2; byaw = -Math.PI / 2;
      ga = ba = 'hug';
      couple.kissFx -= dt;
      if (couple.kissFx <= 0 && couple.kiss < 3.4) { couple.kissFx = 0.3; fx.hearts(V3(0, 0.4, -8.4), 3); }
    } else {
      for (const [av, o] of couple.over) {
        if (o.until < now) { couple.over.delete(av); continue; }
        if (av === groom) { ga = o.anim; gyaw = o.yaw; } else { ba = o.anim; byaw = o.yaw; }
      }
    }
    groom.root.position.x = damp(groom.root.position.x, gx, 3, dt);
    bride.root.position.x = damp(bride.root.position.x, bx, 3, dt);
    groom.root.position.z = damp(groom.root.position.z, gz, 3, dt);
    bride.root.position.z = damp(bride.root.position.z, bz, 3, dt);
    groom.root.rotation.y = lerpAngle(groom.root.rotation.y, gyaw, 1 - Math.exp(-5 * dt));
    bride.root.rotation.y = lerpAngle(bride.root.rotation.y, byaw, 1 - Math.exp(-5 * dt));
    groom.update(dt, ga);
    bride.update(dt, ba);
  }

  // ---------- Overlay khu vực ----------
  function updateOverlays(t) {
    const ov = state.mode === 'overview';
    for (const z of venue.zoneMeshes) {
      const sel = state.selected === z.zone;
      const hov = state.hover === z.zone;
      const pulse = sel ? 0.08 * Math.sin(t * 4) : 0;
      z.fill.material.opacity = ov ? (sel ? 0.42 + pulse : hov ? 0.34 : 0.18) : 0;
      z.edge.material.opacity = ov ? 0.9 : 0;
      z.label.visible = ov && camera.position.y > 12;
      z.label.position.y = 8 + Math.sin(t * 1.5 + z.center.x * 0.1) * 0.35 + (hov || sel ? 0.6 : 0);
      const s = hov || sel ? 1.12 : 1;
      z.label.scale.x = damp(z.label.scale.x, 12 * s, 8, 1 / 60);
      z.label.scale.y = damp(z.label.scale.y, 2.8 * s, 8, 1 / 60);
      z.fill.visible = ov;
      z.edge.visible = ov;
    }
  }

  // ---------- Vòng lặp chính ----------
  const clock = new THREE.Clock();
  let heartTimer = 0;
  let noteTimer = 0;
  let showTimer = 12;
  const focus = new THREE.Vector3();
  function render() {
    if (hiFx) composer.render(); else renderer.render(scene, camera);
  }
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const now = performance.now();

    venue.update(t, dt);
    decor.update(t, dt, state.me?.pos || null);
    updateProgram();
    bots.update(dt);
    updateCouple(dt);
    updatePeers(dt);

    if (state.mode === 'play' && state.me) {
      updatePlayer(dt, now);
      if (state.photo) updatePhoto(dt);
      focus.copy(state.me.pos);
    } else {
      if (state.fly) {
        const k = Math.min(1, (now - state.fly.start) / state.fly.dur);
        const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
        camera.position.lerpVectors(state.fly.fromP, state.fly.toP, e);
        controls.target.lerpVectors(state.fly.fromT, state.fly.toT, e);
        if (k >= 1) state.fly = null;
      }
      controls.update();
      focus.copy(controls.target);
      // Pháo hoa tự động cho đẹp khi đang xem bản đồ
      showTimer -= dt;
      if (showTimer <= 0) {
        showTimer = rand(14, 26);
        if (Math.random() < 0.5) fx.fireworkShow(V3(31, 1, -12), 4, 8);
        else fx.firework(V3(rand(-30, 30), 0, rand(-14, -10)));
      }
    }

    // Nhãn tên, bong bóng chat, hiệu ứng theo biểu cảm, ánh nhìn
    heartTimer -= dt;
    noteTimer -= dt;
    const emitHearts = heartTimer <= 0;
    const emitNotes = noteTimer <= 0;
    if (emitHearts) heartTimer = 0.7;
    if (emitNotes) noteTimer = 0.35;
    const mePos = state.me?.pos;
    for (const av of avatars) {
      const pos = av.root.position;
      const zn = zoneAt(pos.x, pos.z);
      if (zn) av.zoneId = zn.id;
      const dist = camera.position.distanceTo(pos);
      if (av.label) av.label.visible = !state.photo && dist < (state.mode === 'play' ? 26 : 45);
      av.bubbleAllowed = !state.bubblesHidden && !state.photo && dist < 40 && (state.mode !== 'play' || av.zoneId === state.zone?.id);
      if (dist < 40) {
        if (emitHearts && av.anim === 'heart') fx.hearts(pos, 2);
        if (emitHearts && av.anim === 'kiss') fx.kissHeart(pos, av.root.rotation.y + av.body.rotation.y);
        if (emitNotes && (av.anim === 'sing' || av.anim === 'piano')) fx.note(pos);
        if (emitNotes && av.anim === 'catch' && Math.random() < 0.5) fx.hearts(pos, 1);
      }
      if (mePos && av !== state.me.av) {
        if (!av.lookAt) av.lookAt = new THREE.Vector3();
        if (pos.distanceTo(mePos) < 5) { av.lookAt.set(mePos.x, mePos.y + 1.6, mePos.z); av.lookTarget = av.lookAt; } else av.lookTarget = null;
      } else av.lookTarget = null;
    }

    if (state.social) {
      const d = state.me ? state.me.pos.distanceTo(state.social.root.position) : 99;
      if (d > 20) closeSocial();
    }

    ambient.update(t, dt, focus);
    fx.update(dt);
    updateOverlays(t);
    render();
    if (state.photo?.capture) capturePhoto();
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });

  // Gỡ lỗi: mở trang với ?debug để truy cập trạng thái từ console
  if (new URLSearchParams(location.search).has('debug')) window.__wedding = { THREE, scene, camera, fx, state, venue, bots, ambient, music, decor };

  refreshCounts();
  frame();
  $('#loading').classList.add('done');
  setTimeout(() => $('#loading').remove(), 800);
}

init();
