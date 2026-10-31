import * as THREE from 'three';
import { Avatar, PALETTE, HAIR_COLORS } from './avatar.js';
import { ZONES, zoneById } from './venue.js';

// Khách mời ảo cho không khí đông vui (chỉ chạy trên máy mỗi người, không đồng bộ)
const NAMES = ['Hùng', 'Mai', 'Tuấn', 'Thảo', 'Long', 'Ngọc', 'Phong', 'Hà', 'Dũng', 'Trang', 'Quân', 'Linh', 'Khoa', 'Vy', 'Nam', 'Yến', 'Bảo', 'Hân'];
const SUBS = ['Nhà trai', 'Nhà gái', 'Bạn cô dâu', 'Bạn chú rể', 'Đồng nghiệp'];
const LINES = {
  welcome: ['Chúc mừng hai bạn! 🎉', 'Cô dâu hôm nay xinh quá!', 'Ký sổ lưu bút chưa mọi người?', 'Đông vui ghê 😍', 'Thả đèn trời đi mọi người 🏮'],
  ceremony: ['Trăm năm hạnh phúc nha 💕', 'Xúc động quá 🥹', 'Hôn đi! Hôn đi! 😆', 'Đẹp đôi quá trời', 'Ai bắt được hoa cưới thì sắp cưới nha 💐'],
  banquet: ['Zô zô zô! 🍻', 'Một hai ba dô!', 'Món này ngon ghê', 'Bàn mình đủ người chưa?', 'Chúc sớm có em bé nha 👶', 'Bánh cưới đẹp quá 🍰'],
  photo: ['Chụp chung tấm nè 📸', 'Góc này lên hình đẹp ghê', 'Ai cầm máy giùm cái', 'Cười lên nào 😁'],
  party: ['Quẩy lên nào! 🕺', 'Bài này hay quá', 'DJ ơi cho bài nữa!', 'Ai lên hát đi 🎤', 'Bắn pháo hoa đi! 🎆'],
};
const ACTS = {
  welcome: ['wave', 'idle', 'clap', 'bow'],
  ceremony: ['clap', 'idle', 'heart'],
  banquet: ['toast', 'clap', 'idle', 'toast'],
  photo: ['heart', 'wave', 'cheer', 'selfie', 'selfie', 'kiss'],
  party: ['dance', 'dance2', 'cheer', 'dance'],
};
const REPLIES = {
  wave: ['Chào bạn! 👋', 'Hi hi 😄', 'Chào nha!'],
  toast: ['Zô! 🥂', 'Trăm phần trăm! 🍻', 'Cạn ly nào!'],
  heart: ['Thương thương 💕', 'Ui dễ thương ghê 🥰', '💖💖💖'],
  dance: ['Quẩy luôn! 💃', 'Nhảy thì nhảy 🕺', 'Lên nhạc nào!'],
  hug: ['Ôm cái nè 🤗', 'Lâu quá mới gặp!', '🤗'],
  bow: ['Dạ chào bạn 🙇', 'Hân hạnh!'],
  kiss: ['Ối 😳', 'Hihi 😚'],
};
const REACT_ACT = { wave: 'wave', toast: 'toast', heart: 'heart', dance: 'dance', hug: 'hug', bow: 'bow', kiss: 'heart', cheer: 'cheer', dance2: 'dance2', clap: 'clap' };
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const lerpAngle = (a, b, t) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * t;

export class Bots {
  constructor(scene, venue, count, onSay, onAction) {
    this.venue = venue;
    this.onSay = onSay;
    this.onAction = onAction;
    this.list = [];
    this.taken = new Set();
    const names = [...NAMES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
      const outfit = pick(['suit', 'suit', 'dress', 'dress', 'aodai']);
      const look = { outfit, color: pick(PALETTE), skin: Math.floor(Math.random() * 3), hair: pick(HAIR_COLORS) };
      const av = new Avatar(look, names[i % names.length], pick(SUBS));
      scene.add(av.root);
      const zone = pick(ZONES);
      const bot = { av, pos: new THREE.Vector3(), yaw: rand(0, 6), face: null, target: null, path: [], state: 'act', timer: rand(0, 5), act: 'idle', zone, stuck: 0, chair: null };
      const p = this.randomPoint(bot, zone);
      if (p.chair) this.sitOn(bot, p.chair);
      else bot.pos.set(p.x, 0, p.z);
      if (!bot.chair) this.setAct(bot);
      this.list.push(bot);
    }
  }

  freeChair(kind) {
    const list = this.venue.chairs.filter((c) => c.kind === kind && !this.taken.has(c) && !c.byPlayer);
    return list.length ? pick(list) : null;
  }

  randomPoint(bot, zone) {
    const v = this.venue;
    if (zone.id === 'party' && Math.random() < 0.7) {
      const d = v.danceFloor;
      return { x: rand(d.x0, d.x1), z: rand(d.z0, d.z1), face: Math.PI };
    }
    if (zone.id === 'banquet') {
      const c = Math.random() < 0.6 && this.freeChair('banquet');
      if (c) return { x: c.x, z: c.z, chair: c };
      const t = pick(v.tables);
      const a = rand(0, Math.PI * 2);
      return { x: t.x + Math.sin(a) * 2.4, z: t.z + Math.cos(a) * 2.4, face: a + Math.PI };
    }
    if (zone.id === 'ceremony') {
      const c = Math.random() < 0.5 && this.freeChair('ceremony');
      if (c) {
        // Đi vào lối giữa rồi mới rẽ vào hàng ghế
        const fz = c.z - 0.75;
        return { x: c.x, z: c.z, chair: c, via: [{ x: 0, z: 22.5 }, { x: 0, z: fz }, { x: c.x, z: fz }] };
      }
      const x = pick([-1, 1]) * rand(6.5, 9);
      const z = rand(-2, 20);
      return { x, z, face: Math.atan2(0 - x, -9 - z) };
    }
    const [x0, x1, z0, z1] = zone.rect;
    return { x: rand(x0 + 2, x1 - 2), z: rand(z0 + 2, z1 - 2), face: null };
  }

  sitOn(b, chair) {
    b.chair = chair;
    this.taken.add(chair);
    b.pos.set(chair.x, 0, chair.z);
    b.yaw = chair.ry;
    b.face = chair.ry;
    b.state = 'act';
    b.act = 'sit';
    b.timer = rand(12, 30);
  }

  standUp(b) {
    if (!b.chair) return;
    const c = b.chair;
    this.taken.delete(c);
    b.chair = null;
    if (c.kind === 'ceremony') b.pos.set(c.x, 0, c.z - 0.75);
    else b.pos.set(c.x + Math.sin(c.ry + Math.PI) * 0.6, 0, c.z + Math.cos(c.ry + Math.PI) * 0.6);
  }

  setAct(b) {
    b.act = pick(ACTS[b.zone.id]);
    b.timer = rand(6, 15);
  }

  botOf(av) {
    return this.list.find((b) => b.av === av);
  }

  // Phản hồi khi người chơi tương tác trực tiếp
  respond(av, act, from) {
    const b = this.botOf(av);
    if (!b) return false;
    if (b.chair && act !== 'toast' && act !== 'wave' && act !== 'heart') this.standUp(b);
    if (b.reserved) { this.taken.delete(b.reserved); b.reserved = null; }
    b.state = 'act';
    b.path = [];
    b.face = Math.atan2(from.x - b.pos.x, from.z - b.pos.z);
    if (!b.chair) b.act = REACT_ACT[act] || 'wave';
    else b.act = act === 'toast' ? 'toast' : 'sit';
    b.timer = act === 'dance' ? 10 : rand(3.5, 5);
    b.reactUntil = performance.now() + b.timer * 1000;
    setTimeout(() => {
      const text = pick(REPLIES[act] || REPLIES.wave);
      b.av.say(text, 4000);
      this.onSay?.(b.av, text);
    }, 350 + Math.random() * 400);
    return true;
  }

  // Phản ứng chung với sự kiện gần đó (pháo hoa, người chơi vẫy tay...)
  react(pos, act, radius = 8, chance = 0.6, lines = null) {
    for (const b of this.list) {
      if (b.state === 'walk' || b.pos.distanceTo(pos) > radius || Math.random() > chance) continue;
      if (b.chair) { if (act === 'cheer' || act === 'clap') b.timer = Math.max(b.timer, 3); continue; }
      b.act = REACT_ACT[act] || act;
      b.face = Math.atan2(pos.x - b.pos.x, pos.z - b.pos.z);
      b.timer = rand(3, 5);
      if (lines && Math.random() < 0.4) {
        const text = pick(lines);
        setTimeout(() => { b.av.say(text, 4000); this.onSay?.(b.av, text); }, Math.random() * 1200);
      }
    }
  }

  update(dt) {
    for (const b of this.list) {
      let anim = b.act;
      let speed = 0;
      if (b.state === 'walk') {
        const goal = b.path[0] || b.target;
        const dx = goal.x - b.pos.x;
        const dz = goal.z - b.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.4) {
          if (b.path.length) b.path.shift();
          else if (b.target.chair && b.reserved === b.target.chair && !b.target.chair.byPlayer) { b.reserved = null; this.sitOn(b, b.target.chair); }
          else {
            b.state = 'act';
            b.face = b.target.face;
            this.setAct(b);
          }
        } else {
          speed = 1.5;
          const px = b.pos.x;
          const pz = b.pos.z;
          b.pos.x += (dx / dist) * speed * dt;
          b.pos.z += (dz / dist) * speed * dt;
          if (!(b.target.chair && !b.path.length && dist < 0.9)) this.venue.resolve(b.pos, 0.3);
          const moved = Math.hypot(b.pos.x - px, b.pos.z - pz);
          b.stuck = moved < speed * dt * 0.3 ? b.stuck + dt : 0;
          if (b.stuck > 1.5) { b.stuck = 0; this.newTarget(b, true); }
          b.yaw = lerpAngle(b.yaw, Math.atan2(dx, dz), 1 - Math.exp(-8 * dt));
          anim = 'walk';
        }
      } else {
        b.timer -= dt;
        if (b.face != null) b.yaw = lerpAngle(b.yaw, b.face, 1 - Math.exp(-4 * dt));
        if (b.chair) anim = b.act === 'toast' ? 'toast' : 'sit';
        if (b.chair && b.act === 'toast' && b.timer < 0) { b.act = 'sit'; b.timer = rand(6, 20); }
        else if (b.timer < 0) {
          if (b.chair) this.standUp(b);
          this.newTarget(b);
        }
        // Thỉnh thoảng làm gì đó vui vui
        if (!b.chair && Math.random() < dt * 0.006) this.onAction?.(b, b.zone.id);
        if (b.chair && b.chair.kind === 'banquet' && Math.random() < dt * 0.02) { b.act = 'toast'; b.timer = 3; }
      }
      if (Math.random() < dt * 0.012) {
        const text = pick(LINES[b.zone.id]);
        b.av.say(text, 7000);
        this.onSay?.(b.av, text);
      }
      b.pos.y = b.chair ? 0 : this.venue.heightAt(b.pos.x, b.pos.z);
      b.av.root.position.copy(b.pos);
      b.av.root.rotation.y = b.yaw;
      b.av.update(dt, anim, speed);
    }
  }

  newTarget(b, sameZone = Math.random() < 0.6) {
    if (b.reserved) { this.taken.delete(b.reserved); b.reserved = null; }
    if (!sameZone) b.zone = pick(ZONES);
    b.target = this.randomPoint(b, zoneById(b.zone.id));
    if (b.target.chair) { b.reserved = b.target.chair; this.taken.add(b.reserved); }
    b.path = b.target.via ? b.target.via.map((p) => ({ ...p })) : [];
    b.state = 'walk';
  }
}
