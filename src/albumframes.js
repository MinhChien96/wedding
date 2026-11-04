// Ảnh cưới trưng trên giá vẽ dọc lối vào ở cổng đón khách. Bấm vào khung để xem ảnh lớn.
// Có nhiều ảnh hơn số khung thì cứ vài giây các khung lần lượt đổi sang ảnh khác.
import * as THREE from 'three';

// [x, z]: hai hàng hai bên lối đi, giữa đài phun nước / xe hoa và hàng rào
const SPOTS = [[-9.4, 33.6], [-10.1, 36.1], [-10.8, 38.6], [9.4, 33.8], [10.1, 36.2], [10.8, 38.6]];
const MAX = 1.25; // cạnh dài nhất của ảnh (m)
const CYCLE = 9; // giây giữa hai lần đổi ảnh

export function buildAlbumFrames({ scene, venue, photos }) {
  const wood = new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.7 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d8b46a', metalness: 0.6, roughness: 0.32 });
  const mat = new THREE.MeshStandardMaterial({ color: '#fffaf2', roughness: 0.9 });
  const loader = new THREE.TextureLoader();
  const texCache = new Map();
  // Texture chỉ gắn vào khung khi ảnh đã tải xong (tránh khung đen lúc chờ)
  const texFor = (i) => {
    if (!texCache.has(i)) {
      const p = photos[i];
      const ready = () => { t.userData.ready = true; t.userData.wait.forEach((fn) => fn()); t.userData.wait = []; };
      const t = p.canvas ? new THREE.CanvasTexture(p.canvas()) : loader.load(p.thumb, ready);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      t.userData = { ready: false, wait: [] };
      if (p.canvas) t.userData.ready = true;
      texCache.set(i, t);
    }
    return texCache.get(i);
  };
  const leg = new THREE.CylinderGeometry(0.025, 0.03, 1.9, 6);
  const frames = [];
  const meshes = [];
  const n = Math.min(SPOTS.length, photos.length);

  for (let k = 0; k < n; k++) {
    const [x, z] = SPOTS[k];
    const side = Math.sign(x);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    // Quay mặt ra lối đi, hơi nghiêng về phía cổng để khách mới vào nhìn thấy
    g.rotation.y = -side * Math.PI / 2 + side * 0.5;
    scene.add(g);
    // Giá vẽ 3 chân
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(leg, wood);
      l.position.set(s * 0.42, 0.92, -0.06);
      l.rotation.set(-0.1, 0, s * 0.12);
      l.castShadow = true;
      g.add(l);
    }
    const back = new THREE.Mesh(leg, wood);
    back.position.set(0, 0.86, -0.36);
    back.rotation.x = 0.32;
    g.add(back);
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.12), wood);
    ledge.position.set(0, 0.72, 0.03);
    g.add(ledge);
    // Khung ảnh (nghiêng ra sau theo chân giá)
    const holder = new THREE.Group();
    holder.position.set(0, 0.75, 0.04);
    holder.rotation.x = -0.1;
    g.add(holder);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.04), gold);
    board.castShadow = true;
    const pass = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    pass.position.z = 0.021;
    pic.position.z = 0.023;
    holder.add(board, pass, pic);
    pic.userData.frame = k;
    meshes.push(pic);
    const f = { k, holder, board, pass, pic, photo: -1 };
    frames.push(f);
    setPhoto(f, k);
    venue.addCircle(x, z, 0.55);
  }

  function setPhoto(f, i) {
    const p = photos[i];
    const a = (p.w || 4) / (p.h || 5);
    const w = a >= 1 ? MAX : MAX * a;
    const h = a >= 1 ? MAX / a : MAX;
    f.pic.scale.set(w, h, 1);
    f.pass.scale.set(w + 0.12, h + 0.12, 1);
    f.board.scale.set(w + 0.2, h + 0.2, 1);
    f.pic.position.y = f.pass.position.y = f.board.position.y = h / 2 + 0.1;
    f.photo = i;
    const t = texFor(i);
    const apply = () => {
      if (f.photo !== i) return;
      f.pic.material.map = t;
      f.pic.material.needsUpdate = true;
    };
    if (t.userData.ready) apply(); else t.userData.wait.push(apply);
  }

  let next = CYCLE;
  let turn = 0;
  return {
    meshes,
    // Ảnh đang hiện trên khung (để mở đúng ảnh khi bấm)
    photoAt: (k) => frames[k]?.photo ?? 0,
    // Tâm hai hàng giá vẽ (cho điểm tương tác "Xem album")
    spots: [{ x: -10.1, z: 36.1 }, { x: 10.1, z: 36.2 }],
    update(t) {
      if (photos.length <= frames.length || t < next) return;
      // Mỗi lần đổi một khung, lần lượt để không bị nháy cả loạt
      const f = frames[turn % frames.length];
      turn++;
      const shown = new Set(frames.map((x) => x.photo));
      let i = f.photo;
      do i = (i + 1) % photos.length; while (shown.has(i));
      // Tải trước, lần sau tới lượt mới đổi để ảnh hiện ngay
      if (!texFor(i).userData.ready) { turn--; next = t + 1; return; }
      setPhoto(f, i);
      next = t + CYCLE / frames.length;
    },
  };
}
