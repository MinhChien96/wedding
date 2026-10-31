// Server realtime cho đám cưới 3D: đồng bộ vị trí/biểu cảm, chat theo khu, sổ lưu bút.
// Production: chạy `npm run build` rồi `npm start` – server phục vụ luôn thư mục dist/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const DIST = path.resolve(__dirname, '../dist');
const WISHES_FILE = path.resolve(__dirname, 'wishes.json');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.json': 'application/json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/health') { res.end('ok'); return; }
  let file = path.join(DIST, path.normalize(url).replace(/^([/\\])+/, ''));
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Wedding realtime server đang chạy. Dev: mở http://localhost:5173 (npm run dev).');
    return;
  }
  // Hỗ trợ Range để trình duyệt phát/lặp file nhạc mượt
  const type = MIME[path.extname(file)] || 'application/octet-stream';
  const size = fs.statSync(file).size;
  const m = /^bytes=(d*)-(d*)$/.exec(req.headers.range || '');
  if (m && size) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) { res.writeHead(416, { 'content-range': `bytes */${size}` }); res.end(); return; }
    res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes' });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(file).pipe(res);
});

// ---------- Sổ lưu bút (lưu file JSON) ----------
let wishes = [];
try { wishes = JSON.parse(fs.readFileSync(WISHES_FILE, 'utf8')); } catch { /* chưa có file */ }
let saveTimer = null;
const saveWishes = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => fs.writeFile(WISHES_FILE, JSON.stringify(wishes.slice(-1000), null, 1), () => {}), 1000);
};

// ---------- Realtime ----------
const ZONES = new Set(['welcome', 'ceremony', 'banquet', 'photo', 'party']);
const ANIMS = new Set(['idle', 'walk', 'jump', 'wave', 'clap', 'dance', 'dance2', 'toast', 'heart', 'cheer', 'bow', 'kiss', 'sit', 'catch', 'selfie', 'sing', 'hug', 'piano']);
// Hiệu ứng đồng bộ cho mọi người: pháo hoa, đèn trời, bóng bay, tung hoa, tương tác giữa khách...
const FX = new Set(['firework', 'show', 'disco', 'lantern', 'balloon', 'petals', 'social', 'kiss', 'bouquet', 'bell', 'honk', 'coin', 'champagne', 'lock', 'swan']);
const SOCIAL = new Set(['wave', 'toast', 'heart', 'dance', 'hug']);
const OUTFITS = new Set(['suit', 'dress', 'aodai']);
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const num = (v, lo, hi) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : 0);
const color = (c, d) => (/^#[0-9a-f]{6}$/i.test(c) ? c : d);

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
const clients = new Map(); // ws -> { id, peer, lastChat, lastWish, lastFx, alive }
let nextId = 1;

const send = (ws, obj) => ws.readyState === 1 && ws.send(JSON.stringify(obj));
const broadcast = (obj, except) => {
  const data = JSON.stringify(obj);
  for (const ws of clients.keys()) if (ws !== except && ws.readyState === 1) ws.send(data);
};
const countMsg = () => {
  let joined = 0;
  for (const c of clients.values()) if (c.peer) joined++;
  return { t: 'count', joined, watching: clients.size - joined };
};

wss.on('connection', (ws) => {
  const me = { id: String(nextId++), peer: null, lastChat: 0, lastWish: 0, lastFx: 0, alive: true };
  clients.set(ws, me);
  send(ws, {
    t: 'welcome',
    id: me.id,
    peers: [...clients.values()].filter((c) => c.peer).map((c) => c.peer),
    wishes: wishes.slice(-200),
  });
  broadcast(countMsg());

  ws.on('pong', () => { me.alive = true; });
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    switch (m.t) {
      case 'join': {
        const lk = m.look || {};
        me.peer = {
          id: me.id,
          name: clean(m.name, 20) || 'Khách',
          sub: clean(m.sub, 20),
          look: { outfit: OUTFITS.has(lk.outfit) ? lk.outfit : 'suit', color: color(lk.color, '#2b3a67'), skin: num(lk.skin, 0, 3) | 0, hair: color(lk.hair, '#2a1a12') },
          p: Array.isArray(m.p) ? m.p.slice(0, 3).map((v) => num(v, -100, 100)) : [0, 0, 30],
          r: num(m.r, -10, 10),
          a: 'idle',
          zone: ZONES.has(m.zone) ? m.zone : 'welcome',
        };
        broadcast({ t: 'join', peer: me.peer }, ws);
        broadcast(countMsg());
        break;
      }
      case 's': {
        if (!me.peer) return;
        const p = me.peer;
        if (Array.isArray(m.p)) p.p = m.p.slice(0, 3).map((v) => num(v, -100, 100));
        p.r = num(m.r, -10, 10);
        if (ANIMS.has(m.a)) p.a = m.a;
        if (ZONES.has(m.z)) p.zone = m.z;
        broadcast({ t: 's', id: me.id, p: p.p, r: p.r, a: p.a, z: p.zone }, ws);
        break;
      }
      case 'chat': {
        if (!me.peer) return;
        const now = Date.now();
        if (now - me.lastChat < 600) return;
        me.lastChat = now;
        const text = clean(m.text, 120);
        if (text) broadcast({ t: 'chat', id: me.id, text, zone: me.peer.zone }, ws);
        break;
      }
      case 'wish': {
        const now = Date.now();
        if (now - me.lastWish < 5000) return;
        me.lastWish = now;
        const text = clean(m.text, 300);
        if (!text) return;
        const wish = { name: clean(m.name, 20) || 'Khách', sub: clean(m.sub, 20), text, gift: !!m.gift, time: now, id: me.id };
        wishes.push(wish);
        saveWishes();
        broadcast({ t: 'wish', wish });
        break;
      }
      case 'fx': {
        if (!me.peer || !FX.has(m.k)) return;
        const now = Date.now();
        if (now - me.lastFx < 300) return;
        me.lastFx = now;
        const out = { t: 'fx', id: me.id, k: m.k, p: Array.isArray(m.p) ? m.p.slice(0, 3).map((v) => num(v, -100, 100)) : me.peer.p, r: num(m.r, -10, 10) };
        if (m.c) out.c = color(m.c, '#ffffff');
        if (m.to) out.to = clean(m.to, 12);
        if (m.k === 'social') { if (!SOCIAL.has(m.a)) return; out.a = m.a; }
        broadcast(out, ws);
        break;
      }
      case 'leave': {
        if (!me.peer) return;
        me.peer = null;
        broadcast({ t: 'leave', id: me.id }, ws);
        broadcast(countMsg());
        break;
      }
      default:
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    if (me.peer) broadcast({ t: 'leave', id: me.id });
    broadcast(countMsg());
  });
});

setInterval(() => {
  for (const [ws, c] of clients) {
    if (!c.alive) { ws.terminate(); continue; }
    c.alive = false;
    ws.ping();
  }
}, 15000);

server.listen(PORT, () => {
  console.log(`💒 Wedding realtime server: http://localhost:${PORT}  (WebSocket: /ws)`);
});
