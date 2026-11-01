// Realtime qua Firebase Realtime Database (chạy được trên hosting tĩnh như Vercel).
// Giữ nguyên interface cũ (on / send / join / leave / id / online) nên main.js không phải đổi nhiều.
// Nếu không kết nối được Firebase, app vẫn chạy ở chế độ offline.
import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, child, push, set, update, remove, get, query, orderByKey, startAfter, limitToLast,
  onValue, onChildAdded, onChildChanged, onChildRemoved, onDisconnect,
} from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyCACOtPmdFAb73y0QWaB3wofi385k-s-xA',
  authDomain: 'wedding-f08d3.firebaseapp.com',
  databaseURL: 'https://wedding-f08d3-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'wedding-f08d3',
  storageBucket: 'wedding-f08d3.firebasestorage.app',
  messagingSenderId: '525677830386',
  appId: '1:525677830386:web:19039c5fd13ebc1549b06b',
};

const ROOT = 'wedding';
const ZONES = new Set(['welcome', 'ceremony', 'banquet', 'photo', 'party', 'memory']);
const OUTFITS = new Set(['suit', 'dress', 'aodai']);
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const num = (v, lo, hi) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : 0);
const color = (c, d) => (/^#[0-9a-f]{6}$/i.test(c) ? c : d);
const vec = (p, d) => (Array.isArray(p) ? p.slice(0, 3).map((v) => +num(v, -100, 100).toFixed(2)) : d);
// Firebase không nhận giá trị undefined
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export class Net {
  constructor() {
    this.handlers = {};
    this.id = null;
    this.online = false;
    this.joined = false;
    this.joinPayload = null;
    this.zone = 'welcome';
    this.last = { chat: 0, wish: 0, fx: 0 };
    this.started = false;
    // id cố định theo thiết bị: dùng cho thả tim lời chúc, bảng xếp hạng (mỗi máy một dòng)
    try {
      this.uid = localStorage.getItem('wedding-uid');
      if (!this.uid) { this.uid = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; localStorage.setItem('wedding-uid', this.uid); }
    } catch { this.uid = `u${Math.random().toString(36).slice(2, 12)}`; }
    this.last.react = 0;
  }

  on(type, fn) { (this.handlers[type] ||= []).push(fn); }
  emit(type, data) { for (const fn of this.handlers[type] || []) fn(data); }

  connect() {
    try {
      const app = initializeApp(firebaseConfig);
      this.db = getDatabase(app);
    } catch (e) {
      console.warn('Firebase init failed, offline mode', e);
      return;
    }
    this.root = ref(this.db, ROOT);
    this.id = push(child(this.root, 'presence')).key;
    onValue(ref(this.db, '.info/connected'), (snap) => {
      if (snap.val() === true) this.onConnected().catch((e) => console.warn('Realtime error', e));
      else if (this.online) {
        this.online = false;
        this.emit('status', false);
      }
    });
  }

  r(path) { return child(this.root, path); }

  async onConnected() {
    // onDisconnect phải đăng ký lại mỗi lần kết nối lại
    const pres = this.r(`presence/${this.id}`);
    await onDisconnect(pres).remove();
    await set(pres, { j: !!this.joinPayload });
    if (this.joinPayload) await this.writePeer();
    if (!this.started) {
      this.started = true;
      await this.start();
    }
    this.online = true;
    this.emit('status', true);
  }

  async start() {
    const [peersSnap, wishesSnap] = await Promise.all([
      get(this.r('peers')),
      get(query(this.r('wishes'), orderByKey(), limitToLast(200))),
    ]);
    const known = new Set();
    const peers = [];
    peersSnap.forEach((s) => { known.add(s.key); if (s.key !== this.id) peers.push(s.val()); });
    const wishes = [];
    let lastWish = null;
    wishesSnap.forEach((s) => { wishes.push({ ...s.val(), k: s.key }); lastWish = s.key; });
    this.emit('welcome', { t: 'welcome', id: this.id, peers, wishes });

    // Khách vào / ra
    onChildAdded(this.r('peers'), (s) => {
      if (s.key === this.id || known.has(s.key)) return;
      known.add(s.key);
      this.emit('join', { t: 'join', peer: s.val() });
    });
    onChildRemoved(this.r('peers'), (s) => {
      known.delete(s.key);
      if (s.key !== this.id) this.emit('leave', { t: 'leave', id: s.key });
    });

    // Vị trí / animation
    const onState = (s) => {
      if (s.key === this.id) return;
      const v = s.val() || {};
      this.emit('s', { t: 's', id: s.key, p: v.p || [0, 0, 0], r: v.r || 0, a: v.a || 'idle', z: v.z });
    };
    onChildAdded(this.r('st'), onState);
    onChildChanged(this.r('st'), onState);

    // Số người online
    onValue(this.r('presence'), (s) => {
      let joined = 0;
      let total = 0;
      s.forEach((c) => { total++; if (c.val()?.j) joined++; });
      this.emit('count', { t: 'count', joined, watching: total - joined });
    });

    // Chat + hiệu ứng: chỉ nghe sự kiện mới từ lúc vào trang
    const startKey = push(this.r('events')).key;
    onChildAdded(query(this.r('events'), orderByKey(), startAfter(startKey)), (s) => {
      const v = s.val();
      if (!v || v.id === this.id) return;
      this.emit(v.t, v);
    });

    // Sổ lưu bút: lời chúc mới (kể cả của chính mình, giống server cũ)
    const wq = lastWish ? query(this.r('wishes'), orderByKey(), startAfter(lastWish)) : this.r('wishes');
    onChildAdded(wq, (s) => this.emit('wish', { t: 'wish', wish: { ...s.val(), k: s.key } }));

    // Lượt thả tim cho từng lời chúc
    onValue(this.r('likes'), (s) => {
      const counts = {};
      const mine = new Set();
      s.forEach((w) => {
        let n = 0;
        w.forEach((u) => { n++; if (u.key === this.uid) mine.add(w.key); });
        counts[w.key] = n;
      });
      this.emit('likes', { counts, mine });
    });
  }

  async writePeer() {
    const m = this.joinPayload;
    const lk = m.look || {};
    this.zone = ZONES.has(m.zone) ? m.zone : 'welcome';
    const peer = {
      id: this.id,
      name: clean(m.name, 20) || 'Khách',
      sub: clean(m.sub, 20),
      look: { outfit: OUTFITS.has(lk.outfit) ? lk.outfit : 'suit', color: color(lk.color, '#2b3a67'), skin: num(lk.skin, 0, 3) | 0, hair: color(lk.hair, '#2a1a12') },
      p: vec(m.p, [0, 0, 30]),
      r: num(m.r, -10, 10),
      a: 'idle',
      zone: this.zone,
    };
    await onDisconnect(this.r(`peers/${this.id}`)).remove();
    await onDisconnect(this.r(`st/${this.id}`)).remove();
    await set(this.r(`peers/${this.id}`), peer);
    await update(this.r(`presence/${this.id}`), { j: true });
    this.joined = true;
  }

  pushEvent(obj) {
    const r = push(this.r('events'));
    set(r, compact({ ...obj, id: this.id })).catch(() => {});
    // dọn sự kiện cũ cho nhẹ database
    setTimeout(() => remove(r).catch(() => {}), 15000);
  }

  send(m) {
    if (!this.online || !m) return;
    const now = Date.now();
    switch (m.t) {
      case 's': {
        if (!this.joined) return;
        if (ZONES.has(m.z)) this.zone = m.z;
        set(this.r(`st/${this.id}`), { p: vec(m.p, [0, 0, 0]), r: +num(m.r, -10, 10).toFixed(2), a: clean(m.a, 12) || 'idle', z: this.zone }).catch(() => {});
        break;
      }
      case 'chat': {
        if (!this.joined || now - this.last.chat < 600) return;
        this.last.chat = now;
        const text = clean(m.text, 120);
        if (text) this.pushEvent({ t: 'chat', text, zone: this.zone });
        break;
      }
      case 'wish': {
        if (now - this.last.wish < 5000) return;
        this.last.wish = now;
        const text = clean(m.text, 300);
        if (!text) return;
        set(push(this.r('wishes')), { name: clean(m.name, 20) || 'Khách', sub: clean(m.sub, 20), text, gift: !!m.gift, time: now, id: this.id }).catch(() => {});
        break;
      }
      case 'fx': {
        if (!this.joined || now - this.last.fx < 300) return;
        this.last.fx = now;
        this.pushEvent({
          t: 'fx', k: clean(m.k, 12), p: vec(m.p, undefined), r: m.r === undefined ? undefined : +num(m.r, -10, 10).toFixed(2),
          c: m.c ? color(m.c, '#ffffff') : undefined, to: m.to ? clean(m.to, 30) : undefined, a: m.a ? clean(m.a, 12) : undefined,
        });
        break;
      }
      case 'react': {
        if (!this.joined || now - this.last.react < 400) return;
        this.last.react = now;
        this.pushEvent({ t: 'react', e: clean(m.e, 8) });
        break;
      }
      case 'lucky': {
        if (!this.joined) return;
        this.pushEvent({ t: 'lucky', name: clean(m.name, 20), prize: clean(m.prize, 80), big: !!m.big });
        break;
      }
      case 'leave': this.leave(); break;
      default:
    }
  }

  // Thả / bỏ tim một lời chúc
  like(wishKey, on) {
    if (!this.online || !wishKey) return;
    const r = this.r(`likes/${wishKey}/${this.uid}`);
    (on ? set(r, true) : remove(r)).catch(() => {});
  }

  // Bảng vàng: mỗi thiết bị một dòng, chỉ ghi đè khi thành tích tốt hơn (better(cũ, mới))
  async submitScore(board, data, better = () => true) {
    if (!this.online) return false;
    const r = this.r(`boards/${board}/${this.uid}`);
    try {
      const old = (await get(r)).val();
      if (old && !better(old, data)) return false;
      await set(r, compact({ ...data, at: Date.now() }));
      return true;
    } catch { return false; }
  }

  async getBoard(board) {
    if (!this.online) return null;
    try {
      const s = await get(this.r(`boards/${board}`));
      const rows = [];
      s.forEach((c) => { rows.push({ ...c.val(), me: c.key === this.uid }); });
      return rows;
    } catch { return null; }
  }

  join(payload) {
    this.joinPayload = payload;
    if (this.online) this.writePeer().catch(() => {});
  }

  leave() {
    this.joinPayload = null;
    if (!this.joined) return;
    this.joined = false;
    remove(this.r(`peers/${this.id}`)).catch(() => {});
    remove(this.r(`st/${this.id}`)).catch(() => {});
    update(this.r(`presence/${this.id}`), { j: false }).catch(() => {});
  }
}
