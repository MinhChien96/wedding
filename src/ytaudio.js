// Nhạc nền thiệp: phát tiếng của video YouTube (cùng link với màn hình sân khấu tiệc 3D), khung video được ẩn đi.
// Không phụ thuộc Three.js để thiệp vẫn nhẹ. Tiệc 3D (video.js) dùng chung bộ tải YouTube API ở đây.

export function parseYouTubeId(url) {
  if (!url) return '';
  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : /^[\w-]{11}$/.test(url) ? url : '';
}

let ytP = null;
export function loadYT() {
  return (ytP ||= new Promise((resolve, reject) => {
    if (window.YT?.Player) { resolve(window.YT); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { ytP = null; reject(new Error('script')); };
    document.head.append(s);
  }));
}

export class YTAudio {
  constructor(url, volume = 70) {
    this.id = parseYouTubeId(url);
    this.volume = volume;
    this.ok = false;
    this.failed = !this.id;
    this.want = false; // người dùng muốn nghe
    this.onFail = null;
  }

  // Tạo sẵn trình phát (chưa phát) để lần chạm đầu tiên phát được ngay – iOS chỉ cho phát trong thao tác của người dùng
  load() {
    if (this.failed || this.box) return;
    this.box = document.createElement('div');
    this.box.className = 'yt-audio';
    this.box.setAttribute('aria-hidden', 'true');
    const holder = document.createElement('div');
    this.box.append(holder);
    document.body.append(this.box);
    this.timer = setTimeout(() => { if (!this.ok) this.fail('timeout'); }, 15000);
    loadYT().then((YT) => {
      if (this.failed) return;
      this.player = new YT.Player(holder, {
        width: 200,
        height: 200,
        videoId: this.id,
        playerVars: { autoplay: 0, loop: 1, playlist: this.id, controls: 0, playsinline: 1, rel: 0, disablekb: 1, iv_load_policy: 3, fs: 0 },
        events: {
          onReady: () => {
            clearTimeout(this.timer);
            this.ok = true;
            this.player.setVolume(this.volume);
            if (this.want) this.play();
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) { this.player.seekTo(0); this.player.playVideo(); }
          },
          onError: (e) => this.fail(e.data),
        },
      });
    }, () => this.fail('script'));
  }

  play() {
    this.want = true;
    if (!this.ok) { this.load(); return; }
    this.player.unMute();
    this.player.setVolume(this.volume);
    this.player.playVideo();
  }

  pause() {
    this.want = false;
    if (this.ok) this.player.pauseVideo();
  }

  // Trình duyệt chặn lần phát đầu (chạm khi trình phát chưa sẵn sàng) → thử lại ở lần chạm kế tiếp
  kick() {
    if (this.want && this.ok && this.player.getPlayerState?.() !== 1) this.play();
  }

  fail(reason) {
    if (this.failed) return;
    console.warn('YouTube music unavailable:', reason);
    this.failed = true;
    this.ok = false;
    clearTimeout(this.timer);
    try { this.player?.destroy(); } catch { /* bỏ qua */ }
    this.box?.remove();
    this.onFail?.(reason);
  }
}
