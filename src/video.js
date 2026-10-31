// Phát video YouTube lên màn hình LED sân khấu.
// Cách làm: iframe YouTube đặt trong lớp CSS3D nằm SAU canvas WebGL; trên canvas, tại vị trí màn hình
// ta "khoét lỗ" (ghi alpha = 0, có kiểm tra độ sâu) để nhìn xuyên xuống video. Nhờ vậy người đứng trên
// sân khấu vẫn che được video đúng như vật thật.
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

const PX_W = 960;
const PX_H = 540;

export function parseYouTubeId(url) {
  if (!url) return '';
  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : /^[\w-]{11}$/.test(url) ? url : '';
}

export class ScreenVideo {
  constructor({ videoId, center, width, camera }) {
    this.videoId = videoId;
    this.camera = camera;
    this.ok = false; // video đã sẵn sàng phát
    this.failed = !videoId;
    this.wantSound = false;
    this.volume = 35;
    this.onFail = null;
    this.onReady = null;
    if (this.failed) return;

    const height = (width * PX_H) / PX_W;
    // Lớp CSS3D nằm dưới canvas
    this.css = new CSS3DRenderer();
    this.css.setSize(innerWidth, innerHeight);
    Object.assign(this.css.domElement.style, { position: 'fixed', inset: '0', zIndex: '-1', pointerEvents: 'none' });
    document.body.prepend(this.css.domElement);
    this.cssScene = new THREE.Scene();
    const el = document.createElement('div');
    Object.assign(el.style, { width: `${PX_W}px`, height: `${PX_H}px`, background: '#000', backfaceVisibility: 'hidden' });
    const holder = document.createElement('div');
    holder.id = 'ytScreen';
    el.append(holder);
    this.holder = holder;
    this.obj = new CSS3DObject(el);
    this.obj.position.copy(center);
    this.obj.scale.setScalar(width / PX_W);
    this.cssScene.add(this.obj);

    // Mặt "khoét lỗ" trong cảnh WebGL
    this.holeScene = new THREE.Scene();
    this.hole = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending }),
    );
    this.hole.position.copy(center);
    this.holeScene.add(this.hole);
    this.hole.updateMatrixWorld();
    this.frustum = new THREE.Frustum();
    this.mat = new THREE.Matrix4();

    this.loadApi();
    // Không tải được trong 15 giây → coi như lỗi, dùng nhạc dự phòng
    this.failTimer = setTimeout(() => { if (!this.ok) this.fail('timeout'); }, 15000);
  }

  loadApi() {
    const create = () => {
      this.player = new window.YT.Player(this.holder, {
        width: PX_W,
        height: PX_H,
        videoId: this.videoId,
        playerVars: {
          autoplay: 1, mute: 1, loop: 1, playlist: this.videoId, controls: 0, playsinline: 1,
          rel: 0, modestbranding: 1, disablekb: 1, iv_load_policy: 3, fs: 0,
        },
        events: {
          onReady: (e) => {
            clearTimeout(this.failTimer);
            this.ok = true;
            e.target.mute();
            e.target.playVideo();
            this.applySound();
            this.onReady?.();
          },
          onStateChange: (e) => {
            // Dự phòng lặp lại khi video kết thúc
            if (e.data === window.YT.PlayerState.ENDED) { e.target.seekTo(0); e.target.playVideo(); }
          },
          onError: (e) => this.fail(e.data),
        },
      });
    };
    if (window.YT?.Player) { create(); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); create(); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => this.fail('script');
    document.head.append(s);
  }

  fail(reason) {
    if (this.failed) return;
    console.warn('YouTube screen unavailable:', reason);
    clearTimeout(this.failTimer);
    this.failed = true;
    this.ok = false;
    this.css?.domElement.remove();
    this.onFail?.(reason);
  }

  // Bật/tắt tiếng (phải gọi trong thao tác của người dùng để iOS cho phép)
  setSound(on) {
    this.wantSound = on;
    this.applySound();
  }

  setVolume(v) {
    this.volume = v;
    if (this.ok) this.player.setVolume(v);
  }

  applySound() {
    if (!this.ok) return;
    this.player.setVolume(this.volume);
    if (this.wantSound) { this.player.unMute(); this.player.playVideo(); } else this.player.mute();
  }

  // Người dùng chạm lần đầu: thử phát lại nếu trình duyệt đã chặn tự phát
  kick() {
    if (this.ok && this.player.getPlayerState?.() !== 1) this.player.playVideo();
  }

  get active() { return !this.failed; }

  visible() {
    if (this.failed) return false;
    this.mat.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.mat);
    return this.frustum.intersectsObject(this.hole);
  }

  resize() { this.css?.setSize(innerWidth, innerHeight); }

  renderCss() { if (!this.failed) this.css.render(this.cssScene, this.camera); }
}
