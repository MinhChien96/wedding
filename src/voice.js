// Voice chat theo khoảng cách + mic sân khấu (karaoke), WebRTC kết nối trực tiếp giữa các máy.
// Firebase Realtime Database chỉ làm "người đưa thư" trao đổi offer/answer/ICE (signaling).
//  - voice/{id} = { mic, stage }   : ai đang bật voice, có mic không, có đang cầm mic sân khấu không
//  - rtc/{toId}/{key} = { from, type, sdp | c } : hộp thư tín hiệu của từng người
// Quy tắc kết nối (hai bên tính giống nhau): gần nhau trong `range` mét, hoặc một trong hai đang cầm mic sân khấu.
// Người có id nhỏ hơn là người gửi offer → không bị "đụng" offer hai chiều.
import { ref, child, push, set, remove, onValue, onChildAdded, onDisconnect } from 'firebase/database';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export class Voice {
  constructor({ net, iceServers, turnUrl = '', range = 15, maxPeers = 8, maxListeners = 14, getPos, myPos }) {
    this.net = net;
    this.iceServers = iceServers;
    this.turnUrl = turnUrl;
    this.hasTurn = iceServers.some((s) => [].concat(s.urls).some((u) => String(u).startsWith('turn')));
    this.onFail = null; // (id) => void : không kết nối được với ai đó
    this.range = range;
    this.maxPeers = maxPeers;
    this.maxListeners = maxListeners;
    this.getPos = getPos;
    this.myPos = myPos;
    this.joined = false;
    this.micOn = false;
    this.hasMic = false;
    this.stage = false;
    this.links = new Map(); // id -> link
    this.members = new Map(); // id -> { mic, stage }
    this.cooldown = new Map(); // id -> thời điểm được thử lại
    this.nextManage = 0;
    this.unsubs = [];
    this.onChange = null; // () => void
    this.onSpeaking = null; // (id | 'me', on) => void
    this.onStage = null; // (id, on) => void
    this.onSinging = null; // (anyoneSingingNearMe) => void
    this.singing = false;
  }

  // Chỉ cần WebRTC để nghe; micro là tuỳ chọn
  get supported() {
    return !!window.RTCPeerConnection;
  }

  // Xin quyền micro – PHẢI gọi ngay trong sự kiện bấm của người dùng để trình duyệt hiện hộp hỏi quyền
  requestMic() {
    this.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    this.ctx.resume();
    if (!navigator.mediaDevices?.getUserMedia) {
      const e = new Error('getUserMedia unsupported');
      e.name = 'Unsupported';
      return Promise.reject(e);
    }
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  }

  // Trạng thái quyền micro nếu trình duyệt cho biết: 'granted' | 'denied' | 'prompt' | 'unknown'
  async micPermission() {
    try { return (await navigator.permissions.query({ name: 'microphone' })).state; } catch { return 'unknown'; }
  }

  // Đang chỉ nghe mà vừa được cấp micro → vào lại voice kèm micro
  async upgrade(stream) {
    if (this.joined) this.leave();
    return this.join(stream);
  }

  r(path) { return child(ref(this.net.db, 'wedding'), path); }

  // Gọi trong thao tác của người dùng (bấm nút) để được cấp quyền micro / phát âm thanh
  // stream = luồng micro đã xin được; null = chỉ nghe
  async join(stream = null) {
    if (this.joined || !this.net.online || !this.net.id) return false;
    this.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    this.ctx.resume();
    this.local = stream;
    this.hasMic = !!stream;
    this.micOn = !!stream;
    this.localLevel = stream ? this.makeAnalyser(stream) : null;
    // Lấy máy chủ TURN (Metered) để kết nối được cả khi mạng 4G chặn kết nối trực tiếp
    if (this.turnUrl && !this.turnLoaded) {
      try {
        const list = await (await fetch(this.turnUrl)).json();
        if (Array.isArray(list) && list.length) { this.iceServers = [...this.iceServers, ...list]; this.hasTurn = true; }
        this.turnLoaded = true;
      } catch (e) { console.warn('TURN fetch failed', e); }
    }
    this.id = this.net.id;
    this.joined = true;
    const me = this.r(`voice/${this.id}`);
    try {
      await onDisconnect(me).remove();
      await onDisconnect(this.r(`rtc/${this.id}`)).remove();
      await set(me, { mic: this.micOn, stage: false });
    } catch (e) {
      // Thường do luật Firebase chưa cho phép voice/ và rtc/
      this.joined = false;
      this.local?.getTracks().forEach((t) => t.stop());
      this.local = null;
      const err = new Error(String(e?.message || e));
      err.name = /permission/i.test(err.message) ? 'RulesError' : 'JoinError';
      throw err;
    }
    this.unsubs.push(onValue(this.r('voice'), (s) => {
      const prevStage = new Set([...this.members].filter(([, v]) => v.stage).map(([k]) => k));
      this.members.clear();
      s.forEach((c) => { if (c.key !== this.id) this.members.set(c.key, c.val() || {}); });
      this.membersLoaded = true;
      for (const [k, v] of this.members) if (v.stage && !prevStage.has(k)) this.onStage?.(k, true);
      for (const k of prevStage) if (!this.members.get(k)?.stage) this.onStage?.(k, false);
      this.nextManage = 0;
      this.onChange?.();
    }));
    this.unsubs.push(onChildAdded(this.r(`rtc/${this.id}`), (s) => {
      const m = s.val();
      remove(s.ref).catch(() => {});
      if (m) this.signal(m).catch((e) => console.warn('voice signal', e));
    }));
    this.onChange?.();
    return true;
  }

  leave() {
    if (!this.joined) return;
    this.joined = false;
    for (const id of [...this.links.keys()]) this.drop(id);
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.members.clear();
    remove(this.r(`voice/${this.id}`)).catch(() => {});
    remove(this.r(`rtc/${this.id}`)).catch(() => {});
    this.local?.getTracks().forEach((t) => t.stop());
    this.local = null;
    this.localLevel = null;
    this.micOn = this.hasMic = this.stage = false;
    if (this.meSpeaking) { this.meSpeaking = false; this.onSpeaking?.('me', false); }
    this.setSinging(false);
    this.onChange?.();
  }

  setMic(on) {
    if (!this.joined || !this.hasMic) return;
    this.micOn = on;
    this.local.getAudioTracks().forEach((t) => { t.enabled = on; });
    set(this.r(`voice/${this.id}`), { mic: on, stage: this.stage }).catch(() => {});
    this.onChange?.();
  }

  setStage(on) {
    if (!this.joined || !this.hasMic || this.stage === on) return;
    this.stage = on;
    if (on && !this.micOn) this.setMic(true);
    set(this.r(`voice/${this.id}`), { mic: this.micOn, stage: on }).catch(() => {});
    this.nextManage = 0;
    this.onChange?.();
  }

  send(to, msg) {
    return set(push(this.r(`rtc/${to}`)), { ...msg, from: this.id }).catch(() => {});
  }

  // ---------- Quản lý kết nối ----------
  wants(id, info) {
    const me = this.myPos();
    const p = this.getPos(id);
    if (!me || !p) return false;
    if (this.stage || info.stage) return true;
    return Math.hypot(p.x - me.x, p.z - me.z) < (this.links.has(id) ? this.range + 6 : this.range);
  }

  manage(now) {
    const me = this.myPos();
    if (!me) return;
    // Kết nối quá lâu không thành (mất offer/answer, mạng chặn...) → huỷ và thử lại
    for (const [id, l] of this.links) {
      if (l.pc.connectionState !== 'connected' && now - l.born > 12000) {
        if (now - l.born > 12000 && l.pc.iceConnectionState === 'checking') this.onFail?.(id);
        this.cooldown.set(id, now + 2500);
        this.drop(id);
      }
    }
    if (!this.membersLoaded) return;
    const cand = [];
    for (const [id, info] of this.members) {
      if (!this.wants(id, info)) {
        // Chưa biết vị trí người đó (chưa tải xong nhân vật) thì giữ kết nối, đừng vội đóng
        if (this.links.has(id) && this.getPos(id)) this.drop(id);
        continue;
      }
      const p = this.getPos(id);
      cand.push({ id, info, d: Math.hypot(p.x - me.x, p.z - me.z) });
    }
    // Ưu tiên người cầm mic sân khấu, rồi tới người gần nhất
    cand.sort((a, b) => (b.info.stage - a.info.stage) || a.d - b.d);
    const limit = this.stage ? this.maxListeners : this.maxPeers;
    cand.forEach((c, i) => {
      if (i >= limit && !c.info.stage) { if (this.links.has(c.id)) this.drop(c.id); return; }
      if (!this.links.has(c.id) && this.id < c.id && (this.cooldown.get(c.id) || 0) < now) this.call(c.id);
    });
    // Chỉ đóng khi người đó đã thật sự rời voice (đã có danh sách và một lúc không còn tên họ)
    for (const [id, l] of this.links) if (!this.members.has(id) && now - l.born > 5000) this.drop(id);
  }

  makeLink(id) {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const link = { id, pc, level: null, el: null, gain: null, speaking: false, lastLoud: 0, pending: [], born: performance.now() };
    this.links.set(id, link);
    pc.onicecandidate = (e) => { if (e.candidate) this.send(id, { type: 'ice', c: JSON.stringify(e.candidate.toJSON()) }); };
    pc.ontrack = (e) => this.attach(link, e.streams[0] || new MediaStream([e.track]));
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) {
        if (pc.connectionState === 'failed') this.onFail?.(id);
        this.cooldown.set(id, performance.now() + 6000);
        this.drop(id);
      }
    };
    return link;
  }

  async call(id) {
    const link = this.makeLink(id);
    const track = this.local?.getAudioTracks()[0];
    link.pc.addTransceiver(track || 'audio', track ? { direction: 'sendrecv', streams: [this.local] } : { direction: 'recvonly' });
    const offer = await link.pc.createOffer();
    await link.pc.setLocalDescription(offer);
    this.send(id, { type: 'offer', sdp: offer.sdp });
  }

  async signal(m) {
    if (!this.joined) return;
    const id = m.from;
    let link = this.links.get(id);
    if (m.type === 'offer') {
      // Luôn nhận lời mời kết nối (danh sách người bật voice có thể chưa tải xong)
      if (link) this.drop(id);
      link = this.makeLink(id);
      await link.pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
      const tr = link.pc.getTransceivers()[0];
      const track = this.local?.getAudioTracks()[0];
      if (tr) {
        if (track) { await tr.sender.replaceTrack(track); tr.direction = 'sendrecv'; } else tr.direction = 'recvonly';
      }
      const answer = await link.pc.createAnswer();
      await link.pc.setLocalDescription(answer);
      this.send(id, { type: 'answer', sdp: answer.sdp });
      this.flush(link);
    } else if (m.type === 'answer' && link) {
      await link.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp });
      this.flush(link);
    } else if (m.type === 'ice' && link) {
      const c = JSON.parse(m.c);
      if (link.pc.remoteDescription) await link.pc.addIceCandidate(c).catch(() => {});
      else link.pending.push(c);
    }
  }

  flush(link) {
    for (const c of link.pending) link.pc.addIceCandidate(c).catch(() => {});
    link.pending = [];
  }

  drop(id) {
    const link = this.links.get(id);
    if (!link) return;
    this.links.delete(id);
    try { link.pc.close(); } catch { /* đã đóng */ }
    if (link.el) { link.el.srcObject = null; link.el.remove(); }
    try { link.src?.disconnect(); link.gain?.disconnect(); } catch { /* bỏ qua */ }
    if (link.speaking) this.onSpeaking?.(id, false);
  }

  makeAnalyser(stream) {
    try {
      const a = this.ctx.createAnalyser();
      a.fftSize = 512;
      const src = this.ctx.createMediaStreamSource(stream);
      src.connect(a);
      return { a, buf: new Uint8Array(a.fftSize), src };
    } catch { return null; }
  }

  level(an) {
    if (!an) return 0;
    an.a.getByteTimeDomainData(an.buf);
    let sum = 0;
    for (const v of an.buf) { const x = (v - 128) / 128; sum += x * x; }
    return Math.sqrt(sum / an.buf.length);
  }

  attach(link, stream) {
    if (link.el) return;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.playsInline = true;
    el.srcObject = stream;
    document.body.append(el);
    link.el = el;
    if (isIOS) {
      // iOS bỏ qua volume của thẻ audio → phát trực tiếp, tắt/bật theo khoảng cách
      el.muted = false;
      link.level = this.makeAnalyser(stream);
    } else {
      // Trình duyệt khác: phát qua WebAudio để chỉnh âm lượng theo khoảng cách
      el.muted = true;
      try {
        link.src = this.ctx.createMediaStreamSource(stream);
        link.gain = this.ctx.createGain();
        link.gain.gain.value = 0;
        link.src.connect(link.gain).connect(this.ctx.destination);
        const a = this.ctx.createAnalyser();
        a.fftSize = 512;
        link.src.connect(a);
        link.level = { a, buf: new Uint8Array(a.fftSize) };
      } catch {
        el.muted = false;
      }
    }
    el.play().catch(() => {});
  }

  // iOS chỉ cho phát âm thanh sau thao tác chạm → gọi lại play() mỗi lần người dùng chạm màn hình
  unlockAudio() {
    if (!this.joined) return;
    this.ctx?.resume();
    for (const l of this.links.values()) if (l.el && l.el.paused) l.el.play().catch(() => {});
  }

  // Thông tin chẩn đoán: trạng thái kết nối, kiểu đường truyền, mức âm nhận được
  async diagnose() {
    const rows = [];
    for (const [id, l] of this.links) {
      let route = '';
      try {
        const stats = await l.pc.getStats();
        let pair = null;
        stats.forEach((r) => { if (r.type === 'transport' && r.selectedCandidatePairId) pair = stats.get(r.selectedCandidatePairId); });
        if (!pair) stats.forEach((r) => { if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') pair = r; });
        const rc = pair && stats.get(pair.remoteCandidateId);
        const lc = pair && stats.get(pair.localCandidateId);
        if (rc || lc) route = (rc?.candidateType === 'relay' || lc?.candidateType === 'relay') ? 'relay' : 'direct';
      } catch { /* bỏ qua */ }
      rows.push({ id, state: l.pc.connectionState, ice: l.pc.iceConnectionState, route, level: this.level(l.level), audio: !!l.el, paused: l.el?.paused, gain: l.gain ? l.gain.gain.value : (l.el && !l.el.muted ? 1 : 0), mic: !!this.members.get(id)?.mic });
    }
    return { members: [...this.members.keys()], rows, myLevel: this.level(this.localLevel), micOn: this.micOn, hasMic: this.hasMic, hasTurn: this.hasTurn, ctx: this.ctx?.state };
  }

  setSinging(on) {
    if (on === this.singing) return;
    this.singing = on;
    this.onSinging?.(on);
  }

  // Gọi mỗi khung hình
  update(now) {
    if (!this.joined) return;
    if (now > this.nextManage) { this.nextManage = now + 1000; this.manage(now); }
    const me = this.myPos();
    let singing = false;
    for (const [id, link] of this.links) {
      const info = this.members.get(id) || {};
      const p = this.getPos(id);
      let vol = 0;
      if (info.stage) vol = 1;
      else if (p && me) {
        const d = Math.hypot(p.x - me.x, p.z - me.z);
        vol = Math.max(0, Math.min(1, 1 - (d - 3) / (this.range - 3)));
      }
      if (info.stage) singing = true;
      if (link.gain) link.gain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
      else if (link.el) link.el.muted = vol < 0.05;
      const loud = info.mic && this.level(link.level) > 0.035;
      if (loud) link.lastLoud = now;
      const sp = now - link.lastLoud < 350;
      if (sp !== link.speaking) { link.speaking = sp; this.onSpeaking?.(id, sp); }
    }
    this.setSinging(singing || this.stage);
    if (this.localLevel) {
      const loud = this.micOn && this.level(this.localLevel) > 0.035;
      if (loud) this.meLoud = now;
      const sp = now - (this.meLoud || 0) < 350;
      if (sp !== this.meSpeaking) { this.meSpeaking = sp; this.onSpeaking?.('me', sp); }
    }
  }

  get connectedCount() {
    let n = 0;
    for (const l of this.links.values()) if (l.pc.connectionState === 'connected') n++;
    return n;
  }
}
