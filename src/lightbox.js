// Xem ảnh toàn màn hình: vuốt / phím ← → để chuyển, Esc hoặc chạm nền để đóng. Dùng chung cho thiệp và tiệc 3D.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let el = null;
let list = [];
let idx = 0;
let drag = null;

function build() {
  el = document.createElement('div');
  el.id = 'lightbox';
  el.className = 'hidden';
  el.innerHTML = `
    <div class="lb-top"><span class="lb-count"></span><a class="lb-dl" download title="Tải ảnh">⬇️</a><button class="lb-x" aria-label="Đóng">✕</button></div>
    <div class="lb-stage"><img alt="" draggable="false" /></div>
    <button class="lb-nav prev" aria-label="Ảnh trước">‹</button>
    <button class="lb-nav next" aria-label="Ảnh sau">›</button>
    <p class="lb-cap"></p>`;
  document.body.append(el);
  const stage = el.querySelector('.lb-stage');
  el.querySelector('.lb-x').onclick = close;
  el.querySelector('.prev').onclick = () => go(-1);
  el.querySelector('.next').onclick = () => go(1);
  stage.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    el.querySelector('img').style.transform = `translateX(${e.clientX - drag.x}px)`;
  });
  const end = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    const img = el.querySelector('img');
    img.style.transform = '';
    const tap = Math.hypot(dx, dy) < 8;
    drag = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    else if (dy > 90) close();
    else if (tap && e.target === stage) close();
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  addEventListener('keydown', (e) => {
    if (el.classList.contains('hidden')) return;
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'Escape') close();
    else return;
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);
}

function show() {
  const p = list[idx];
  const img = el.querySelector('img');
  img.classList.remove('in');
  img.src = p.src;
  img.alt = p.caption || 'Ảnh cưới';
  img.onload = () => img.classList.add('in');
  if (img.complete) img.classList.add('in');
  el.querySelector('.lb-count').textContent = `${idx + 1} / ${list.length}`;
  el.querySelector('.lb-cap').innerHTML = esc(p.caption || '');
  const dl = el.querySelector('.lb-dl');
  dl.href = p.src;
  dl.download = `anh-cuoi-${String(idx + 1).padStart(2, '0')}.${p.demo ? 'jpg' : (p.src.split('.').pop() || 'jpg')}`;
  // Tải trước ảnh kế tiếp cho mượt
  const n = list[(idx + 1) % list.length];
  if (n && !n.demo) new Image().src = n.src;
}

function go(d) {
  idx = (idx + d + list.length) % list.length;
  show();
}

export function openLightbox(photos, start = 0) {
  if (!photos.length) return;
  if (!el) build();
  list = photos;
  idx = start;
  el.classList.remove('hidden');
  document.body.classList.add('overlay-open');
  show();
}

function close() {
  el.classList.add('hidden');
  if (!document.querySelector('#card:not(.hidden)')) document.body.classList.remove('overlay-open');
}
