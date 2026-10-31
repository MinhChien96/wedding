// Kết nối realtime tới server WebSocket. Nếu không có server, app vẫn chạy ở chế độ offline.
export class Net {
  constructor() {
    this.handlers = {};
    this.ws = null;
    this.id = null;
    this.online = false;
    this.joinPayload = null;
    this.retry = 0;
  }

  on(type, fn) {
    (this.handlers[type] ||= []).push(fn);
  }

  emit(type, data) {
    for (const fn of this.handlers[type] || []) fn(data);
  }

  url() {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/ws`;
  }

  connect() {
    let ws;
    try {
      ws = new WebSocket(this.url());
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'welcome') {
        this.id = msg.id;
        this.online = true;
        this.retry = 0;
        this.emit('status', true);
        if (this.joinPayload) this.send({ t: 'join', ...this.joinPayload });
      }
      this.emit(msg.t, msg);
    };
    ws.onclose = () => {
      const was = this.online;
      this.online = false;
      this.id = null;
      if (was) this.emit('status', false);
      this.emit('reset');
      this.scheduleReconnect();
    };
    ws.onerror = () => {};
  }

  scheduleReconnect() {
    this.retry = Math.min(this.retry + 1, 6);
    setTimeout(() => this.connect(), 1000 * this.retry * 1.5);
  }

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  join(payload) {
    this.joinPayload = payload;
    this.send({ t: 'join', ...payload });
  }

  leave() {
    this.joinPayload = null;
    this.send({ t: 'leave' });
  }
}
