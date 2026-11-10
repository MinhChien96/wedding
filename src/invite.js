// Thiệp cưới online: trang đầu tiên khi mở link. Nhẹ (không tải Three.js) – bấm "Vào tiệc cưới 3D" mới tải main.js.
// Link riêng: ?to=<tên khách>&side=trai|gai · Bỏ qua thiệp vào thẳng tiệc 3D: ?3d · Trang quản lý: ?admin
import './style.css';
import './card.css';
import { WEDDING, INVITE, STORY } from './config.js';
import { PHOTOS, ALBUM_DEMO, coverSrc } from './album.js';
import { openLightbox } from './lightbox.js';
import { Music } from './audio.js';
import { YTAudio } from './ytaudio.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bỏ qua */ } },
};
const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const SIDES = { trai: 'Nhà trai', gai: 'Nhà gái' };
const couple = `${WEDDING.groom} & ${WEDDING.bride}`;

// ---------- Khách được mời (từ link riêng, nhớ lại cho lần mở sau) ----------
const params = new URLSearchParams(location.search);
const saved = store.get('wedding-guest') || {};
const guest = {
  to: (params.get('to') || saved.to || '').trim().slice(0, 40),
  side: SIDES[params.get('side')] ? params.get('side') : (params.has('to') ? '' : saved.side || ''),
};
if (params.has('to')) store.set('wedding-guest', guest);

// ---------- Firebase (tải khi cần) ----------
let fbP = null;
const firebase = () => (fbP ||= Promise.all([import('./firebase.js'), import('firebase/database')])
  .then(([f, d]) => ({ ...d, db: f.getDb(), ROOT: f.ROOT, uid: f.deviceUid() })));

// ---------- Ngày giờ ----------
const parts = (s) => { const [d, t = '00:00'] = s.split('T'); const [Y, M, D] = d.split('-').map(Number); return { Y, M, D, t }; };
const vnDate = (s) => new Date(`${s.length === 16 ? `${s}:00` : s}+07:00`);
const utcStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const weekday = ({ Y, M, D }) => WEEKDAYS[new Date(Date.UTC(Y, M - 1, D)).getUTCDay()];
const pad = (n) => String(n).padStart(2, '0');

function calendarLinks(ev) {
  const s = vnDate(ev.start);
  const e = ev.end ? vnDate(ev.end) : new Date(s.getTime() + 2 * 3600e3);
  const title = `${ev.name} – ${couple}`;
  const where = [ev.place, ev.address].filter(Boolean).join(', ');
  const details = `${ev.name} của ${couple}. Thiệp mời: ${location.origin}${location.pathname}`;
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${utcStamp(s)}/${utcStamp(e)}&location=${encodeURIComponent(where)}&details=${encodeURIComponent(details)}&ctz=Asia/Ho_Chi_Minh`;
  const icsEsc = (t) => t.replace(/[\\,;]/g, (c) => `\\${c}`);
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//wedding//vi', 'BEGIN:VEVENT',
    `UID:${utcStamp(s)}-${ev.name.length}@wedding`, `DTSTAMP:${utcStamp(new Date())}`, `DTSTART:${utcStamp(s)}`, `DTEND:${utcStamp(e)}`,
    `SUMMARY:${icsEsc(title)}`, `LOCATION:${icsEsc(where)}`, `DESCRIPTION:${icsEsc(details)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT3H', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return { google, ics: `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}` };
}
const mapQuery = (ev) => encodeURIComponent([ev.place, ev.address].filter(Boolean).join(', '));

// ---------- Dựng thiệp ----------
const card = $('#card');
const order = guest.side === 'gai' ? [1, 0] : [0, 1];
const families = order.map((i) => INVITE.families[i]).filter(Boolean);
const people = [
  { name: INVITE.groomFull || WEDDING.groom, short: WEDDING.groom, role: 'Chú rể', child: INVITE.families[0]?.child },
  { name: INVITE.brideFull || WEDDING.bride, short: WEDDING.bride, role: 'Cô dâu', child: INVITE.families[1]?.child },
];
const names = order.map((i) => people[i]);
const events = INVITE.events.filter((e) => !guest.side || e.side === 'all' || e.side === guest.side);
const main = parts(INVITE.at.slice(0, 16));
const plainEvents = events.filter((e) => !e.map);
const soloEvent = plainEvents.length % 2 ? plainEvents[plainEvents.length - 1] : null;

// Hiệu ứng: phần tử có data-a="up|left|right|zoom|blur|flip|write|stamp|h" hiện ra khi cuộn tới, --d là độ trễ
const dl = (s) => `style="--d:${+s.toFixed(2)}s"`;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const desktop = matchMedia('(min-width: 1024px)');
let animIO = null;
// Chữ "viết tay" bị clip-path che hết nên IntersectionObserver coi là không thấy → theo dõi phần tử cha thay cho nó
const animTargets = new Map();
const animate = (root) => root.querySelectorAll('[data-a]:not(.in)').forEach((el) => {
  const t = el.dataset.a === 'write' ? el.parentElement : el;
  if (!animTargets.has(t)) animTargets.set(t, []);
  animTargets.get(t).push(el);
  animIO.observe(t);
});

function renderCard() {
  const withEnvelope = !(params.has('3d') || location.hash === '#3d');
  let secNo = 0;
  // Nhãn nhỏ đánh số phía trên tiêu đề từng phần: "01 · Đếm ngược"
  const eyebrow = (label) => `<p class="cd-eyebrow" data-a="up"><b>${pad(++secNo)}</b>${esc(label)}</p>`;
  const dateDots = `${pad(main.D)} · ${pad(main.M)} · ${main.Y}`;
  const ribbon = [`${names[0].short} & ${names[1].short}`, 'Save the date', dateDots, "We're getting married", WEDDING.hashtag].filter(Boolean)
    .map((t) => `<span>${esc(t)}</span><i>✦</i>`).join('');
  const acc = String(WEDDING.gift?.account || '').replace(/(\d{4})(?=\d)/g, '$1 ');
  card.innerHTML = `
  <div class="cd-aurora" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  <main class="cd" id="cdScroll">
    <section class="cd-cover" id="cdTop">
      <div class="cd-cover-inner" id="cdCoverText">
        <div class="cd-mono" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" /></svg><span>${esc([...names[0].short][0] || '')}<i>&</i>${esc([...names[1].short][0] || '')}</span></div>
        <p class="cd-kicker">Save the date</p>
        <div class="cd-arch-wrap" id="cdArch">
          <div class="cd-arch" id="cdMedia"><img class="cd-slide on" src="${esc(coverSrc())}" alt="Ảnh cưới ${esc(couple)}" /></div>
          <svg class="cd-badge" viewBox="0 0 120 120" aria-hidden="true">
            <defs><path id="cdCirc" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" /></defs>
            <circle cx="60" cy="60" r="58" />
            <text><textPath href="#cdCirc" textLength="272">SAVE THE DATE ✦ ${esc(dateDots.replace(/ /g, ''))} ✦</textPath></text>
            <text class="cd-badge-heart" x="60" y="68" text-anchor="middle">♥</text>
          </svg>
        </div>
        <h1 class="script"><span class="nm">${esc(names[0].short)}</span> <span class="amp">&</span> <span class="nm">${esc(names[1].short)}</span></h1>
        <p class="cd-date"><span>${weekday(main)}</span>${dateDots}</p>
        ${guest.to ? `<p class="cd-to">Thân gửi <b>${esc(guest.to)}</b></p>` : ''}
        <button class="cd-btn primary magnet cd-open" id="cdOpen">💌 Xem thiệp mời</button>
      </div>
      <button class="cd-scroll-hint" id="cdHint" aria-label="Cuộn xuống"><i></i></button>
    </section>

    <div class="cd-ribbon" aria-hidden="true"><div class="cd-ribbon-track">${ribbon}${ribbon}</div></div>

    <section class="cd-sec cd-card cd-paper" id="cdInvite">
      <div class="cd-hy" data-a="stamp">囍</div>
      <p class="cd-quote" data-a="blur" ${dl(0.3)}>“${esc(INVITE.quote)}”</p>
      <div class="cd-families">
        ${families.map((f, i) => `<div class="cd-fam" data-a="${i ? 'right' : 'left'}" ${dl(0.15 + i * 0.15)}><h4>${esc(f.title)}</h4><p>${esc(f.father)}</p><p>${esc(f.mother)}</p><small>${esc(f.address)}</small></div>`).join('')}
      </div>
      <p class="cd-small" data-a="up">Trân trọng báo tin lễ thành hôn của con chúng tôi</p>
      <div class="cd-names">
        <div><span class="script" data-a="write" ${dl(0.1)}>${esc(names[0].name)}</span><small data-a="up" ${dl(0.5)}>${esc(names[0].child || names[0].role)}</small></div>
        <span class="cd-amp script" data-a="zoom" ${dl(0.6)}>&</span>
        <div><span class="script" data-a="write" ${dl(0.8)}>${esc(names[1].name)}</span><small data-a="up" ${dl(1.2)}>${esc(names[1].child || names[1].role)}</small></div>
      </div>
      <div class="cd-invitee">
        <p data-a="up">Trân trọng kính mời</p>
        <p class="script cd-guest" data-a="write" ${dl(0.25)}>${esc(guest.to || 'Quý khách')}</p>
        <p data-a="up" ${dl(0.5)}>tới dự bữa tiệc chung vui cùng gia đình chúng tôi</p>
      </div>
      <div class="cd-when">
        <span data-a="left" ${dl(0.2)}>${weekday(main)}</span>
        <b data-a="zoom">${pad(main.D)}</b>
        <span data-a="right" ${dl(0.2)}>Tháng ${main.M}<br />${main.Y}</span>
      </div>
      <p class="cd-time" data-a="up">Vào lúc <b>${esc(main.t.replace(':', ' giờ '))}</b> · ${esc(WEDDING.venue)}</p>
      ${INVITE.lunar ? `<p class="cd-lunar" data-a="up" ${dl(0.15)}>(${esc(INVITE.lunar)})</p>` : ''}
      <p class="cd-small" data-a="up" ${dl(0.25)}>Sự hiện diện của ${guest.to ? esc(guest.to) : 'quý khách'} là niềm vinh hạnh cho gia đình chúng tôi!</p>
    </section>

    <section class="cd-sec" id="cdCount">
      ${eyebrow('Đếm ngược')}
      <h2 class="cd-h" data-a="h">Chỉ còn</h2>
      <div class="cd-count" id="cdCountBox">${['Ngày', 'Giờ', 'Phút', 'Giây'].map((l, i) => `<div data-a="flip" ${dl(0.1 + i * 0.1)}>
        <svg viewBox="0 0 64 64" aria-hidden="true">${i ? '' : '<defs><linearGradient id="cdRingG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6a5c0" /><stop offset="1" stop-color="#c98bd9" /></linearGradient></defs>'}<circle class="bg" cx="32" cy="32" r="29" /><circle class="fg" cx="32" cy="32" r="29" /></svg>
        <b>00</b><span>${l}</span></div>`).join('')}</div>
      <p class="cd-count-date" data-a="up" ${dl(0.5)}>${weekday(main)} · ${dateDots} · ${esc(main.t)}</p>
    </section>

    <section class="cd-sec" id="cdEvents">
      ${eyebrow('Lịch trình')}
      <h2 class="cd-h" data-a="h">Ngày chung đôi</h2>
      <div class="cd-events">
      ${events.map((ev, i) => {
        const p = parts(ev.start);
        const end = ev.end ? parts(ev.end).t : '';
        const cal = calendarLinks(ev);
        // Máy tính bảng trở lên: 2 cột, sự kiện có bản đồ và sự kiện lẻ cuối cùng chiếm cả hàng
        const wide = ev.map || (soloEvent && ev === soloEvent);
        return `<article class="cd-event${wide ? ' has-map' : ''}" data-a="${i % 2 ? 'right' : 'left'}" ${dl(0.1)}>
          <div class="tk-top">
            <div class="tk-time"><b>${esc(p.t)}</b>${end ? `<small>đến ${esc(end)}</small>` : ''}</div>
            <div class="tk-info">
              <span class="cd-ev-ic">${ev.icon || '💍'}</span>
              <h3>${esc(ev.name)}</h3>
              ${ev.side !== 'all' ? `<em class="tk-tag">${esc(SIDES[ev.side] || '')}</em>` : '<em class="tk-tag all">Hai họ</em>'}
              <p class="tk-day">${weekday(p)}, ${pad(p.D)}.${pad(p.M)}.${p.Y}</p>
              <p class="tk-place"><b>${esc(ev.place)}</b><br />${esc(ev.address || '')}</p>
            </div>
          </div>
          <div class="tk-bot">
            <div class="cd-ev-btns">
              <a class="cd-btn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${mapQuery(ev)}">🧭 Chỉ đường</a>
              <a class="cd-btn" target="_blank" rel="noopener" href="${cal.google}">📅 Google Lịch</a>
              <a class="cd-btn" href="${cal.ics}" download="dam-cuoi-${i + 1}.ics">🍎 Lịch iPhone</a>
            </div>
            ${ev.map ? `<div class="cd-map" data-q="${mapQuery(ev)}"></div>` : ''}
          </div>
        </article>`;
      }).join('')}
      </div>
      ${INVITE.dress ? `<p class="cd-dress" data-a="up"><span>👗</span>Trang phục gợi ý: ${esc(INVITE.dress)}</p>` : ''}
    </section>

    <section class="cd-sec" id="cdAlbum">
      ${eyebrow('Album')}
      <h2 class="cd-h" data-a="h">Khoảnh khắc</h2>
      ${ALBUM_DEMO ? '<p class="cd-note" data-a="up">Đây là ảnh mẫu – thêm ảnh cưới thật bằng <code>npm run album</code>.</p>' : ''}
      <div class="cd-grid" id="cdGrid"></div>
      <button class="cd-btn wide" id="cdAllPhotos" data-a="up">🖼️ Xem tất cả ${PHOTOS.length} ảnh</button>
    </section>

    ${STORY.length ? `<section class="cd-sec" id="cdStory">
      ${eyebrow('Chuyện tình')}
      <h2 class="cd-h" data-a="h">Chuyện của chúng mình</h2>
      <ol class="cd-story" id="cdStoryList">${STORY.map((s) => `<li data-a="left" ${dl(0.1)}><span class="cd-st-ic">${s.icon || '💗'}</span><small>${esc(s.when)}</small><h4>${esc(s.title)}</h4><p>${esc(s.text)}</p></li>`).join('')}</ol>
    </section>` : ''}

    <section class="cd-sec cd-card" id="cdRsvp">
      ${eyebrow('RSVP')}
      <h2 class="cd-h" data-a="h">Xác nhận tham dự</h2>
      <p class="cd-note" data-a="up">Để chuẩn bị chu đáo, bạn xác nhận giúp chúng mình${INVITE.rsvpBy ? ` trước ngày <b>${esc(INVITE.rsvpBy)}</b>` : ''} nhé!</p>
      <div id="rsvpBox" data-a="up" ${dl(0.15)}></div>
    </section>

    <section class="cd-sec" id="cdWish">
      ${eyebrow('Sổ lưu bút')}
      <h2 class="cd-h" data-a="h">Gửi lời chúc</h2>
      <form class="cd-form cd-glass" id="wishForm" data-a="up">
        <input id="wName" maxlength="20" required placeholder="Tên của bạn" autocomplete="nickname" />
        <textarea id="wText" maxlength="300" rows="3" required placeholder="Chúc hai bạn trăm năm hạnh phúc..."></textarea>
        <button class="cd-btn primary wide magnet">💌 Gửi lời chúc</button>
      </form>
      <div class="cd-wishes" id="wishList"><p class="cd-note">Đang tải lời chúc...</p></div>
    </section>

    ${WEDDING.gift?.account ? `<section class="cd-sec" id="cdGift">
      ${eyebrow('Mừng cưới')}
      <h2 class="cd-h" data-a="h">Hộp mừng cưới</h2>
      <p class="cd-note" data-a="up">Sự có mặt của bạn là món quà lớn nhất. Nếu ở xa không đến được, bạn có thể gửi quà mừng qua đây.</p>
      <div data-a="zoom" ${dl(0.15)}><button class="cd-btn wide cd-gift-btn" id="giftToggle"><span>🎁</span> Mở hộp mừng cưới</button></div>
      <div class="cd-gift hidden" id="giftBox">
        <div class="cd-bank" id="cdBank">
          <div class="bk-top"><b>${esc(WEDDING.gift.bank)}</b><i class="bk-chip"></i></div>
          <div class="bk-num">${esc(acc)}</div>
          <div class="bk-foot"><span>${esc(WEDDING.gift.owner)}</span><span>💍 ${esc(WEDDING.date)}</span></div>
        </div>
        ${WEDDING.gift.bankId ? `<img loading="lazy" alt="Mã QR chuyển khoản" src="https://img.vietqr.io/image/${encodeURIComponent(WEDDING.gift.bankId)}-${encodeURIComponent(WEDDING.gift.account)}-compact2.png?addInfo=${encodeURIComponent(`Mung cuoi ${WEDDING.groom} ${WEDDING.bride}`)}&accountName=${encodeURIComponent(WEDDING.gift.owner || '')}" />` : ''}
        <button class="cd-btn primary" id="copyAcc">📋 Copy số tài khoản</button>
      </div>
    </section>` : ''}

    <section class="cd-sec" id="cdParty">
      <div class="cd-party">
        <div data-a="zoom"><div class="cd-party-ic">🏰</div></div>
        <h2 class="cd-h" data-a="h">Tiệc cưới 3D online</h2>
        <p data-a="up" ${dl(0.1)}>Không đến được, hoặc muốn “quẩy” trước? Tạo nhân vật của riêng bạn, đi dạo khuôn viên tiệc, chụp ảnh với cô dâu chú rể, nhảy, chat và voice với mọi người – ngay trên trình duyệt.</p>
        <div data-a="up" ${dl(0.2)}><button class="cd-btn wide big magnet cd-party-btn" id="cdEnter">🎉 Vào tiệc cưới 3D</button></div>
        <small data-a="up" ${dl(0.3)}>Nên dùng Wi‑Fi · chạy tốt trên điện thoại và máy tính</small>
      </div>
    </section>

    <footer class="cd-foot">
      <p class="script" data-a="write">Thank you!</p>
      <p data-a="up" ${dl(0.3)}>${esc(couple)} · ${esc(WEDDING.date)}</p>
      <p class="cd-tag" data-a="up" ${dl(0.4)}>${esc(WEDDING.hashtag || '')}</p>
      <button class="cd-btn" id="cdShare" data-a="zoom" ${dl(0.5)}>📤 Gửi thiệp cho bạn bè</button>
    </footer>
  </main>
  <div class="cd-petals" aria-hidden="true">${'<i></i>'.repeat(12)}</div>
  <div class="cd-progress" id="cdProg"></div>
  <nav class="cd-dock hidden" id="cdDock">
    <i class="cd-dock-ind" id="cdDockInd"></i>
    <button data-go="cdInvite">💌<span>Thiệp</span></button>
    <button data-go="cdEvents">📅<span>Lịch</span></button>
    <button data-go="cdAlbum">🖼️<span>Ảnh</span></button>
    <button data-go="cdRsvp">✅<span>Xác nhận</span></button>
    <button data-go="cdParty" class="hot">🎉<span>Tiệc 3D</span></button>
  </nav>
  <button class="cd-music" id="cdMusic" aria-label="Bật/tắt nhạc"><span class="ic">🎵</span><span class="cd-eq"><i></i><i></i><i></i><i></i></span></button>
  ${WEDDING.music?.title ? `<div class="cd-np" id="cdNp">🎵 Đang phát: <b>${esc(WEDDING.music.title)}</b></div>` : ''}
  ${withEnvelope ? `<div class="cd-env" id="cdEnv">
    <div class="env-hearts" aria-hidden="true">${'<i>❤</i>'.repeat(10)}</div>
    <div class="env-head">
      <p class="env-kicker">Wedding Invitation</p>
      ${guest.to ? `<p class="env-to">Thân gửi</p><p class="script env-name">${esc(guest.to)}</p>` : '<p class="script env-name">Thiệp mời</p>'}
    </div>
    <div class="env" id="envBox" role="button" tabindex="0" aria-label="Mở thiệp">
      <div class="env-back"></div>
      <div class="env-letter"><small>Save the date</small><b class="script">${esc(names[0].short)} & ${esc(names[1].short)}</b><span>${dateDots}</span></div>
      <div class="env-front"></div>
      <div class="env-flap"></div>
      <span class="env-seal">囍</span>
    </div>
    <p class="env-hint">Chạm vào thiệp để mở</p>
  </div>` : ''}`;

  const scroller = $('#cdScroll');
  card.querySelectorAll('.cd-h').forEach(splitHeading);
  // Cuộn trong khung thiệp (scrollIntoView ở các mục cuối sẽ kéo lệch cả khung #card)
  const goTo = (id) => { const el = $(`#${id}`); if (el) scroller.scrollTo({ top: el.offsetTop, behavior: reduceMotion.matches ? 'auto' : 'smooth' }); };
  $('#cdOpen').onclick = () => { if (!musicTouched) setMusic(true); goTo('cdInvite'); };
  $('#cdHint').onclick = () => goTo('cdInvite');
  $('#cdDock').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) goTo(b.dataset.go); });
  $('#cdEnter').onclick = enter3d;
  $('#cdAllPhotos').onclick = () => openLightbox(PHOTOS, 0);
  $('#cdShare').onclick = share;
  $('#cdMusic').onclick = () => { musicTouched = true; setMusic(!musicOn); };
  $('#giftToggle')?.addEventListener('click', openGift);
  $('#copyAcc')?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    try { await navigator.clipboard.writeText(WEDDING.gift.account); b.textContent = '✅ Đã copy'; } catch { /* trình duyệt chặn */ }
  });

  // Bì thư: chạm để mở (cũng là cử chỉ người dùng để trình duyệt cho phát nhạc)
  const envBox = $('#envBox');
  if (envBox) {
    $('#cdEnv').addEventListener('click', openEnvelope);
    envBox.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEnvelope(); } });
    requestAnimationFrame(() => envBox.focus({ preventScroll: true }));
  } else {
    card.classList.add('go');
    startSlides();
  }

  // Chạm vào chỗ trống: nảy một trái tim nhỏ (dùng click để không bắn tim khi đang vuốt cuộn)
  card.addEventListener('click', (e) => {
    if (reduceMotion.matches || e.target.closest('button, a, input, textarea, select, label, iframe, .cd-env, .cd-dock, #lightbox')) return;
    const h = document.createElement('i');
    h.className = 'cd-tap';
    h.textContent = ['❤', '💗', '🌸', '✨'][Math.floor(Math.random() * 4)];
    h.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;--r:${Math.round((Math.random() - 0.5) * 50)}deg`;
    card.append(h);
    setTimeout(() => h.remove(), 1000);
  });

  // Máy tính: nút chính "hút" nhẹ theo con trỏ, thẻ ngân hàng nghiêng 3D theo chuột
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion.matches) {
    let magnet = null;
    card.addEventListener('pointermove', (e) => {
      const m = e.target.closest('.magnet');
      if (magnet && magnet !== m) magnet.style.translate = '';
      magnet = m;
      if (m) {
        const r = m.getBoundingClientRect();
        m.style.translate = `${((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px`;
      }
      const bank = e.target.closest('.cd-bank');
      if (bank) {
        const r = bank.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        bank.style.setProperty('--rx', `${((0.5 - y) * 16).toFixed(1)}deg`);
        bank.style.setProperty('--ry', `${((x - 0.5) * 20).toFixed(1)}deg`);
        bank.style.setProperty('--mx', `${(x * 100).toFixed(0)}%`);
        bank.style.setProperty('--my', `${(y * 100).toFixed(0)}%`);
      }
    }, { passive: true });
    card.addEventListener('pointerout', (e) => {
      const bank = e.target.closest('.cd-bank');
      if (bank && !bank.contains(e.relatedTarget)) ['--rx', '--ry'].forEach((k) => bank.style.removeProperty(k));
    });
  }

  // Gợn sóng khi bấm nút
  card.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.cd-btn');
    if (!b || reduceMotion.matches) return;
    const r = b.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const s = document.createElement('span');
    s.className = 'cd-ripple';
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    b.append(s);
    setTimeout(() => s.remove(), 700);
  });

  // Hiện dần khi cuộn tới
  animIO = new IntersectionObserver((list) => {
    for (const en of list) {
      if (!en.isIntersecting) continue;
      animIO.unobserve(en.target);
      animTargets.get(en.target)?.forEach((el) => el.classList.add('in'));
      animTargets.delete(en.target);
    }
  }, { root: scroller, rootMargin: '0px 0px -6% 0px', threshold: 0.12 });
  animate(card);

  // Tải dần album, lời chúc, bản đồ khi sắp cuộn tới
  const lazy = new IntersectionObserver((list) => {
    for (const en of list) {
      if (!en.isIntersecting) continue;
      lazy.unobserve(en.target);
      if (en.target.id === 'cdAlbum') renderAlbum();
      if (en.target.id === 'cdWish') loadWishes();
      if (en.target.id === 'cdEvents') loadMaps();
    }
  }, { root: scroller, rootMargin: '0px 0px 400px 0px' });
  ['cdAlbum', 'cdWish', 'cdEvents'].forEach((id) => lazy.observe($(`#${id}`)));

  // Dock chỉ hiện khi đã qua ảnh bìa (máy tính: bìa nằm cố định bên trái nên luôn hiện)
  new IntersectionObserver(([en]) => {
    coverOn = en.isIntersecting;
    $('#cdDock').classList.toggle('hidden', en.isIntersecting && !desktop.matches);
  }, { root: scroller, threshold: 0.35 }).observe($('#cdTop'));
  const ind = $('#cdDockInd');
  const moveInd = () => {
    const b = $('#cdDock .on');
    ind.style.opacity = b ? 1 : 0;
    if (b) ind.style.transform = `translateX(${b.offsetLeft}px)`, ind.style.width = `${b.offsetWidth}px`;
  };
  const spy = new IntersectionObserver((list) => {
    for (const en of list) {
      if (!en.isIntersecting) continue;
      card.querySelectorAll('[data-go]').forEach((b) => b.classList.toggle('on', b.dataset.go === en.target.id));
      moveInd();
    }
  }, { root: scroller, rootMargin: '-45% 0px -50% 0px' });
  addEventListener('resize', moveInd);
  ['cdInvite', 'cdEvents', 'cdAlbum', 'cdRsvp', 'cdParty'].forEach((id) => spy.observe($(`#${id}`)));

  // Cuộn: thanh tiến độ, ảnh bìa trôi chậm (parallax), đường thời gian chuyện tình tự vẽ
  const prog = $('#cdProg');
  const media = $('#cdMedia');
  const coverText = $('#cdCoverText');
  const story = $('#cdStoryList');
  let ticking = false;
  const update = () => {
    ticking = false;
    const st = scroller.scrollTop;
    const h = scroller.clientHeight;
    const max = Math.max(1, scroller.scrollHeight - h);
    const sr = story?.getBoundingClientRect();
    prog.style.transform = `scaleX(${Math.min(1, st / max).toFixed(4)})`;
    if (!desktop.matches && !reduceMotion.matches) {
      if (st < h * 1.2) {
        const k = Math.min(1, st / h);
        media.style.transform = `scale(${(1 + k * 0.12).toFixed(4)})`;
        coverText.style.transform = `translate3d(0, ${(st * 0.32).toFixed(1)}px, 0) scale(${(1 - k * 0.06).toFixed(4)})`;
        coverText.style.opacity = Math.max(0, 1 - st / (h * 0.7)).toFixed(3);
      }
    } else if (coverText.style.transform) {
      media.style.transform = coverText.style.transform = coverText.style.opacity = '';
    }
    if (sr) story.style.setProperty('--p', Math.min(1, Math.max(0, (h * 0.8 - sr.top) / sr.height)).toFixed(3));
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  scroller.addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();

  startCountdown();
  renderRsvp();
  $('#wName').value = (store.get('wedding-profile')?.name || guest.to || '').slice(0, 20);
  $('#wishForm').addEventListener('submit', sendWish);
}

// Tiêu đề hiện từng chữ: tách theo từ (không xuống dòng giữa từ) rồi theo ký tự (giữ nguyên dấu tiếng Việt)
const seg = window.Intl?.Segmenter ? new Intl.Segmenter('vi', { granularity: 'grapheme' }) : null;
function splitHeading(el) {
  const text = el.textContent.trim();
  let i = 0;
  el.setAttribute('aria-label', text);
  el.innerHTML = text.split(/\s+/).map((w) => `<span class="w" aria-hidden="true">${(seg ? [...seg.segment(w)].map((x) => x.segment) : [...w])
    .map((c) => `<span class="ch" style="--i:${i++}">${esc(c)}</span>`).join('')}</span>`).join(' ');
}

function openEnvelope() {
  const env = $('#cdEnv');
  if (!env || env.classList.contains('open')) return;
  env.classList.add('open');
  setMusic(true);
  navigator.vibrate?.(25);
  const t = reduceMotion.matches ? 0 : 1;
  setTimeout(() => { env.classList.add('done'); card.classList.add('go'); startSlides(); burst(['🌸', '💮', '✨', '💗']); }, 1750 * t);
  setTimeout(() => env.remove(), 2600 * t + 50);
}

// Ảnh bìa đổi dần qua các ảnh cưới (hiệu ứng Ken Burns), chỉ chạy khi bìa đang hiện
let coverOn = true;
let slideTimer = 0;
const KB = ['kb-in', 'kb-left', 'kb-right', 'kb-up'];
function startSlides() {
  if (reduceMotion.matches) return;
  const cover = coverSrc();
  const srcs = [() => cover, ...PHOTOS.slice(0, 6).map((p) => () => p.src)];
  if (srcs.length < 2) return;
  const media = $('#cdMedia');
  let k = 0;
  clearInterval(slideTimer);
  slideTimer = setInterval(() => {
    if (!coverOn || document.hidden || card.classList.contains('hidden') || !media.isConnected) return;
    k = (k + 1) % srcs.length;
    const src = srcs[k]();
    if (src === media.lastElementChild?.getAttribute('src')) return;
    const img = new Image();
    img.className = 'cd-slide';
    img.alt = '';
    img.style.animationName = KB[k % KB.length];
    img.onload = () => {
      const old = [...media.children];
      media.append(img);
      requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('on')));
      setTimeout(() => old.forEach((o) => o.remove()), 1900);
    };
    img.src = src;
  }, 6500);
}

function openGift(e) {
  e.currentTarget.parentElement.remove();
  $('#giftBox').classList.remove('hidden');
  $('#giftBox').classList.add('pop');
  burst(['🎁', '✨', '💝', '🎉']);
}

let albumDone = false;
function renderAlbum() {
  if (albumDone) return;
  albumDone = true;
  const shown = PHOTOS.slice(0, 9);
  $('#cdGrid').innerHTML = shown.map((p, i) => {
    const shape = i === 0 ? 'ph-xl' : (p.w || 4) > (p.h || 5) * 1.1 ? 'ph-land' : 'ph-port';
    return `<button class="cd-ph ${shape}" data-i="${i}" data-a="curtain" style="--d:${(i % 3) * 0.1}s"><img loading="lazy" src="${esc(p.thumb)}" alt="${esc(p.caption || 'Ảnh cưới')}" />${p.caption ? `<span>${esc(p.caption)}</span>` : ''}</button>`;
  }).join('');
  animate($('#cdGrid'));
  $('#cdGrid').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) openLightbox(PHOTOS, +b.dataset.i); });
}

let mapsDone = false;
function loadMaps() {
  if (mapsDone) return;
  mapsDone = true;
  card.querySelectorAll('.cd-map').forEach((m) => {
    m.innerHTML = `<iframe loading="lazy" title="Bản đồ" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${m.dataset.q}&z=15&output=embed"></iframe>`;
  });
}

// ---------- Đếm ngược ----------
function startCountdown() {
  const target = new Date(INVITE.at).getTime();
  const box = $('#cdCountBox');
  const cells = [...box.querySelectorAll('b')];
  const rings = [...box.querySelectorAll('.fg')];
  const tick = () => {
    let s = Math.floor((target - Date.now()) / 1000);
    if (s <= 0) {
      box.innerHTML = s > -86400 ? '<p class="cd-today">💒 Hôm nay là ngày vui của chúng mình!</p>' : '<p class="cd-today">💕 Cảm ơn bạn đã cùng chung vui!</p>';
      return;
    }
    if (!box.isConnected) return;
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    [d / 365, h / 24, m / 60, s / 60].forEach((f, i) => rings[i]?.style.setProperty('--f', Math.min(1, f).toFixed(4)));
    // Số nào đổi thì lật nhẹ
    [d, h, m, s].forEach((v, i) => {
      const b = cells[i];
      if (!b || b.textContent === pad(v)) return;
      b.textContent = pad(v);
      b.classList.remove('tick');
      void b.offsetWidth;
      b.classList.add('tick');
    });
    setTimeout(tick, 1000 - (Date.now() % 1000));
  };
  tick();
}

// ---------- Xác nhận tham dự ----------
function renderRsvp() {
  const box = $('#rsvpBox');
  const mine = store.get('wedding-rsvp');
  if (mine && !box.dataset.edit) {
    box.innerHTML = `<div class="cd-done pop">
      <p>${mine.go ? '🥳' : '💐'} <b>${esc(mine.name)}</b> ${mine.go ? `sẽ tham dự cùng <b>${mine.n}</b> người` : 'không thể tham dự'}${mine.side ? ` · ${esc(SIDES[mine.side])}` : ''}</p>
      ${mine.note ? `<p class="cd-note">“${esc(mine.note)}”</p>` : ''}
      <p class="cd-note">${mine.go ? 'Hẹn gặp bạn tại tiệc cưới nhé!' : 'Cảm ơn bạn đã báo – chúng mình vẫn rất vui khi nhận được lời chúc của bạn.'}</p>
      <button class="cd-btn sm" id="rsvpEdit">✏️ Sửa lại</button></div>`;
    $('#rsvpEdit').onclick = () => { box.dataset.edit = '1'; renderRsvp(); };
    return;
  }
  const v = mine || { name: guest.to, go: true, n: 1, side: guest.side, note: '' };
  box.innerHTML = `<form class="cd-form" id="rsvpForm">
    <input id="rName" maxlength="40" required placeholder="Họ tên *" value="${esc(v.name || '')}" />
    <div class="cd-seg" id="rGo" style="--n:2;--i:${v.go ? 0 : 1}">
      <button type="button" data-v="1" class="${v.go ? 'on' : ''}">🥳 Mình sẽ đến</button>
      <button type="button" data-v="0" class="${v.go ? '' : 'on'}">😢 Rất tiếc, không đến được</button>
    </div>
    <label class="cd-row ${v.go ? '' : 'hidden'}" id="rCountRow">Số người tham dự
      <span class="cd-step"><button type="button" data-d="-1">−</button><b id="rN">${v.n || 1}</b><button type="button" data-d="1">+</button></span>
    </label>
    <label class="cd-row">Bạn là khách của
      <select id="rSide"><option value="">Cả hai bên</option><option value="trai" ${v.side === 'trai' ? 'selected' : ''}>Nhà trai</option><option value="gai" ${v.side === 'gai' ? 'selected' : ''}>Nhà gái</option></select>
    </label>
    <textarea id="rNote" maxlength="200" rows="2" placeholder="Lời nhắn (ăn chay, đi cùng em bé...)">${esc(v.note || '')}</textarea>
    <button class="cd-btn primary wide">Gửi xác nhận</button>
    <p class="cd-err hidden" id="rErr"></p>
  </form>`;
  let go = !!v.go;
  let n = v.n || 1;
  $('#rGo').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    go = b.dataset.v === '1';
    $('#rGo').style.setProperty('--i', go ? 0 : 1);
    $('#rGo').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    $('#rCountRow').classList.toggle('hidden', !go);
  });
  $('#rCountRow').addEventListener('click', (e) => {
    const b = e.target.closest('[data-d]');
    if (!b) return;
    e.preventDefault();
    n = Math.min(10, Math.max(1, n + +b.dataset.d));
    $('#rN').textContent = n;
    $('#rN').classList.remove('tick');
    void $('#rN').offsetWidth;
    $('#rN').classList.add('tick');
  });
  $('#rsvpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter || $('#rsvpForm button.primary');
    const data = { name: $('#rName').value.trim().slice(0, 40), go, n: go ? n : 0, side: $('#rSide').value, note: $('#rNote').value.trim().slice(0, 200), to: guest.to, at: Date.now() };
    if (!data.name) return;
    btn.disabled = true;
    btn.textContent = 'Đang gửi...';
    try {
      const fb = await firebase();
      await fb.set(fb.ref(fb.db, `${fb.ROOT}/rsvp/${fb.uid}`), data);
      store.set('wedding-rsvp', data);
      delete $('#rsvpBox').dataset.edit;
      renderRsvp();
      if (go) burst();
    } catch (err) {
      console.warn('RSVP failed', err);
      btn.disabled = false;
      btn.textContent = 'Gửi lại';
      $('#rErr').textContent = 'Chưa gửi được, bạn kiểm tra mạng rồi thử lại giúp mình nhé.';
      $('#rErr').classList.remove('hidden');
    }
  });
}

// ---------- Lời chúc (dùng chung sổ lưu bút với tiệc 3D) ----------
let wishes = [];
let wishesLoaded = false;
// Từ 4 lời chúc trở lên: "bức tường yêu thương" 2 hàng chạy ngang ngược chiều nhau (chạm/rê chuột để dừng)
function renderWishes(fresh = false) {
  const list = [...wishes].reverse().slice(0, 30);
  const item = (w, i, dup) => `<div class="cd-wish${fresh && !i && !dup ? ' new' : ''}"${dup ? ' aria-hidden="true"' : ''}><p>${esc(w.text)}</p><small>— <b>${esc(w.name)}</b>${w.sub ? ` · ${esc(w.sub)}` : ''}</small></div>`;
  const box = $('#wishList');
  box.classList.toggle('wall', list.length >= 4);
  if (!list.length) {
    box.innerHTML = '<p class="cd-note">Chưa có lời chúc nào. Hãy là người đầu tiên! ✍️</p>';
  } else if (list.length < 4) {
    box.innerHTML = `<div data-a="up">${list.map((w, i) => item(w, i)).join('')}</div>`;
  } else {
    const rows = [list.filter((_, i) => i % 2 === 0), list.filter((_, i) => i % 2 === 1)];
    box.innerHTML = rows.map((r, k) => `<div class="cd-wall-row${k ? ' rev' : ''}" data-a="${k ? 'right' : 'left'}" ${dl(k * 0.15)}>
      <div class="cd-wall-track" style="--t:${Math.max(24, r.length * 7)}s">${r.map((w) => item(w, list.indexOf(w))).join('')}${r.map((w) => item(w, 1, true)).join('')}</div></div>`).join('');
  }
  animate(box);
}
async function loadWishes() {
  if (wishesLoaded) return;
  wishesLoaded = true;
  try {
    const fb = await firebase();
    const snap = await fb.get(fb.query(fb.ref(fb.db, `${fb.ROOT}/wishes`), fb.orderByKey(), fb.limitToLast(30)));
    wishes = [];
    snap.forEach((s) => { wishes.push(s.val()); });
  } catch (err) {
    console.warn('Wishes failed', err);
  }
  renderWishes();
}
let lastWish = 0;
async function sendWish(e) {
  e.preventDefault();
  if (Date.now() - lastWish < 10000) return;
  const w = { name: $('#wName').value.trim().slice(0, 20) || 'Khách', sub: guest.side ? `Khách ${SIDES[guest.side].toLowerCase()}` : 'Thiệp mời', text: $('#wText').value.trim().slice(0, 300), gift: false, time: Date.now(), id: 'card' };
  if (!w.text) return;
  const btn = $('#wishForm button');
  btn.disabled = true;
  try {
    const fb = await firebase();
    await fb.set(fb.push(fb.ref(fb.db, `${fb.ROOT}/wishes`)), w);
    lastWish = Date.now();
    wishes.push(w);
    renderWishes(true);
    $('#wishList').scrollTop = 0;
    $('#wText').value = '';
    btn.textContent = '💖 Đã gửi, cảm ơn bạn!';
    burst();
  } catch (err) {
    console.warn('Wish failed', err);
    btn.textContent = 'Chưa gửi được – thử lại';
  }
  btn.disabled = false;
  setTimeout(() => { btn.textContent = '💌 Gửi lời chúc'; }, 3000);
}

// Tim bay lên khi gửi xong
function burst(icons = ['💗', '💖', '💕', '🌸']) {
  if (reduceMotion.matches) return;
  for (let i = 0; i < 18; i++) {
    const h = document.createElement('i');
    h.className = 'cd-burst';
    h.textContent = icons[i % icons.length];
    h.style.left = `${40 + Math.random() * 20}%`;
    h.style.setProperty('--dx', `${(Math.random() - 0.5) * 260}px`);
    h.style.animationDelay = `${Math.random() * 0.3}s`;
    card.append(h);
    setTimeout(() => h.remove(), 2200);
  }
}

// ---------- Nhạc: dùng chung bài YouTube với màn hình sân khấu tiệc 3D, lỗi thì dùng file nhạc / nhạc tự sinh ----------
const music = new Music();
const yt = new YTAudio(WEDDING.music?.youtube, WEDDING.music?.cardVolume ?? 70);
let musicOn = false;
let musicTouched = false;
if (WEDDING.music?.src) {
  // Dev server trả về index.html khi thiếu file → kiểm tra đúng là file nhạc
  fetch(WEDDING.music.src, { method: 'HEAD' }).then((r) => {
    if (r.ok && /audio|mpeg|ogg|mp4|octet/.test(r.headers.get('content-type') || '')) music.setTrack(WEDDING.music.src, WEDDING.music.title);
  }).catch(() => {});
}
function setMusic(on) {
  if (on === musicOn) return;
  musicOn = on;
  // Luôn mở khoá âm thanh trong thao tác chạm, để nếu YouTube lỗi về sau vẫn phát được nhạc dự phòng
  if (!music.ctx) music.init();
  music.ctx.resume();
  if (!yt.failed) {
    if (on) yt.play(); else yt.pause();
  } else if (on) music.start(); else music.stop();
  $('#cdMusic')?.classList.toggle('on', on);
  if (on) nowPlaying();
}
yt.onFail = () => {
  if (!musicOn) return;
  musicOn = false;
  setMusic(true);
};
addEventListener('pointerdown', () => { if (musicOn && !card.classList.contains('hidden')) yt.kick(); }, { passive: true });
let npTimer = 0;
function nowPlaying() {
  const np = $('#cdNp');
  if (!np || !WEDDING.music?.title) return;
  np.classList.add('show');
  clearTimeout(npTimer);
  npTimer = setTimeout(() => np.classList.remove('show'), 3800);
}

async function share() {
  const url = location.origin + location.pathname;
  const text = `Thiệp cưới ${couple} – ${WEDDING.dateLong} 💍`;
  try {
    if (navigator.share) { await navigator.share({ title: couple, text, url }); return; }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    $('#cdShare').textContent = '📋 Đã copy link thiệp';
  } catch { /* người dùng huỷ */ }
}

// ---------- Chuyển qua lại giữa thiệp và tiệc 3D ----------
let party = null;
function showCard(on) {
  card.classList.toggle('hidden', !on);
  document.body.classList.toggle('card-open', on);
  document.body.classList.toggle('overlay-open', on);
}
async function enter3d() {
  setMusic(false);
  showCard(false);
  if (!party) {
    $('#loading')?.classList.remove('hidden');
    party = import('./main.js').catch((err) => {
      console.error(err);
      party = null;
      $('#loading')?.classList.add('hidden');
      showCard(true);
      alert('Không tải được tiệc 3D, bạn kiểm tra mạng rồi thử lại nhé.');
    });
  }
  await party;
}
$('#btnCard')?.addEventListener('click', () => showCard(true));

// ---------- Trang quản lý: ?admin ----------
async function renderAdmin() {
  card.classList.add('admin');
  const lines = store.get('wedding-guest-list') || 'Anh Tuấn | trai\nChị Hoa | gai\nGia đình bác Minh | trai';
  card.innerHTML = `<main class="cd ad">
    <h1 class="script">${esc(couple)}</h1>
    <p class="cd-note">Trang quản lý thiệp mời – chỉ mình bạn biết đường dẫn này.</p>
    <div class="cd-seg" id="adTabs" style="--n:3;--i:0"><button class="on" data-t="links">🔗 Tạo link mời</button><button data-t="rsvp">✅ Xác nhận</button><button data-t="wish">💌 Lời chúc</button></div>
    <section data-p="links">
      <p class="cd-note">Mỗi dòng một khách: <code>Tên hiển thị | trai</code> hoặc <code>| gai</code> (bỏ trống = cả hai bên).</p>
      <textarea id="adList" rows="7">${esc(lines)}</textarea>
      <label class="cd-row">Địa chỉ web <input id="adBase" value="${esc(location.origin + location.pathname)}" /></label>
      <div class="cd-row"><button class="cd-btn primary" id="adMake">Tạo link</button><button class="cd-btn" id="adCopyAll">📋 Copy tất cả</button></div>
      <div id="adLinks"></div>
    </section>
    <section data-p="rsvp" class="hidden"><div id="adStats"></div><button class="cd-btn" id="adCsv">⬇️ Tải file Excel (CSV)</button><div id="adRsvp" class="ad-table"></div></section>
    <section data-p="wish" class="hidden"><div id="adWish"></div></section>
  </main>`;
  $('#adTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    $('#adTabs').querySelectorAll('button').forEach((x, i) => { x.classList.toggle('on', x === b); if (x === b) $('#adTabs').style.setProperty('--i', i); });
    card.querySelectorAll('[data-p]').forEach((p) => p.classList.toggle('hidden', p.dataset.p !== b.dataset.t));
  });
  let made = [];
  const make = () => {
    store.set('wedding-guest-list', $('#adList').value);
    const base = $('#adBase').value.trim();
    made = $('#adList').value.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter(([n]) => n).map(([name, side = '']) => {
      const s = side.toLowerCase().replace('nhà ', '').replace('nha ', '');
      const sd = s.startsWith('t') ? 'trai' : s.startsWith('g') ? 'gai' : '';
      return { name, side: sd, url: `${base}?to=${encodeURIComponent(name)}${sd ? `&side=${sd}` : ''}` };
    });
    $('#adLinks').innerHTML = made.map((m, i) => `<div class="ad-link"><b>${esc(m.name)}</b>${m.side ? ` <small>${SIDES[m.side]}</small>` : ''}<input readonly value="${esc(m.url)}" /><button class="cd-btn sm" data-c="${i}">📋</button><a class="cd-btn sm" target="_blank" href="${esc(m.url)}">👀</a></div>`).join('');
  };
  $('#adMake').onclick = make;
  $('#adLinks').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    const m = made[+b.dataset.c];
    try { await navigator.clipboard.writeText(`Thân mời ${m.name} tới dự đám cưới ${couple} 💍\n${m.url}`); b.textContent = '✅'; } catch { /* bỏ qua */ }
  });
  $('#adCopyAll').onclick = async (e) => {
    if (!made.length) make();
    try { await navigator.clipboard.writeText(made.map((m) => `${m.name}: ${m.url}`).join('\n')); e.target.textContent = '✅ Đã copy'; } catch { /* bỏ qua */ }
  };
  make();

  let rows = [];
  const fb = await firebase();
  fb.onValue(fb.ref(fb.db, `${fb.ROOT}/rsvp`), (snap) => {
    rows = [];
    snap.forEach((s) => { rows.push(s.val()); });
    rows.sort((a, b) => b.at - a.at);
    const yes = rows.filter((r) => r.go);
    const people = (side) => yes.filter((r) => side === undefined || r.side === side).reduce((a, r) => a + (r.n || 0), 0);
    $('#adStats').innerHTML = `<div class="ad-stats">
      <div><b>${rows.length}</b><span>phản hồi</span></div><div><b>${people()}</b><span>người sẽ đến</span></div>
      <div><b>${people('trai')}</b><span>nhà trai</span></div><div><b>${people('gai')}</b><span>nhà gái</span></div>
      <div><b>${people('')}</b><span>cả hai bên</span></div><div><b>${rows.length - yes.length}</b><span>không đến</span></div></div>`;
    $('#adRsvp').innerHTML = rows.length ? `<table><tr><th>Tên</th><th>Đến?</th><th>Số người</th><th>Bên</th><th>Lời nhắn</th><th>Lúc</th></tr>${rows.map((r) => `<tr>
      <td>${esc(r.name)}${r.to && r.to !== r.name ? `<br><small>link: ${esc(r.to)}</small>` : ''}</td><td>${r.go ? '✅' : '❌'}</td><td>${r.n || 0}</td>
      <td>${esc(SIDES[r.side] || 'Cả hai')}</td><td>${esc(r.note || '')}</td><td><small>${new Date(r.at).toLocaleString('vi-VN')}</small></td></tr>`).join('')}</table>` : '<p class="cd-note">Chưa có ai xác nhận.</p>';
  }, (err) => { $('#adStats').innerHTML = `<p class="cd-err">Không đọc được dữ liệu (${esc(err.message)}). Bạn đã cập nhật Rules trong database.rules.json lên Firebase chưa?</p>`; });
  $('#adCsv').onclick = () => {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [['Tên', 'Link mời', 'Tham dự', 'Số người', 'Bên', 'Lời nhắn', 'Thời gian']]
      .concat(rows.map((r) => [r.name, r.to, r.go ? 'Có' : 'Không', r.n || 0, SIDES[r.side] || 'Cả hai', r.note, new Date(r.at).toLocaleString('vi-VN')]))
      .map((r) => r.map(q).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    a.download = 'xac-nhan-tham-du.csv';
    a.click();
  };
  const ws = await fb.get(fb.ref(fb.db, `${fb.ROOT}/wishes`)).catch(() => null);
  const list = [];
  ws?.forEach((s) => { list.push(s.val()); });
  $('#adWish').innerHTML = `<p class="cd-note">${list.length} lời chúc (gồm cả lời chúc gửi trong tiệc 3D)</p>${list.reverse().map((w) => `<div class="cd-wish"><p>${esc(w.text)}</p><small>— <b>${esc(w.name)}</b> · ${esc(w.sub || '')} · ${new Date(w.time).toLocaleString('vi-VN')}${w.gift ? ' · 🧧' : ''}</small></div>`).join('')}`;
}

// ---------- Khởi động ----------
if (params.has('admin')) {
  renderAdmin();
} else {
  renderCard();
  if (params.has('3d') || location.hash === '#3d') enter3d();
  else {
    showCard(true);
    setTimeout(() => yt.load(), 600);
  }
}
