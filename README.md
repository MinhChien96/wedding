# 💒 Đám cưới 3D online

Web 3D cho khách mời tham dự đám cưới online: mỗi người tạo nhân vật, đi lại giữa các khu, chat, nhảy, nâng ly và gửi lời chúc. Lấy cảm hứng từ các trang 3D map đi concert.

## Thiệp cưới online (trang đầu tiên khi mở link)

Mở link là thấy **thiệp cưới 2D** nhẹ, mở nhanh trên điện thoại (chưa tải Three.js). Bấm "🎉 Vào tiệc cưới 3D" mới tải tiệc 3D; trong tiệc có nút "💌 Thiệp" để xem lại thiệp.

- **Bì thư mở đầu**: "Thân gửi <tên khách>", chạm vào con dấu 囍 → nắp thư lật, thư trượt ra, hoa bung (lần chạm này cũng bật nhạc nền).
- **Nhạc nền**: dùng chung bài YouTube với màn hình sân khấu tiệc 3D (`WEDDING.music.youtube`, âm lượng `cardVolume`), khung video được ẩn. YouTube lỗi/bị chặn thì tự dùng file `music.src` hoặc nhạc tự sinh. Nút nhạc góc trên có sóng nhạc chạy khi đang phát.
- **Bìa thiệp**: monogram chữ cái đầu tên, ảnh cưới tự đổi kiểu Ken Burns, tên viết tay hiện dần, ảnh trôi chậm khi cuộn (parallax), cánh hoa rơi khắp thiệp.
- **Hiệu ứng**: từng phần hiện dần khi cuộn (trượt, phóng, mờ → rõ, lật số đếm ngược, đóng dấu chữ Hỷ, đường thời gian tự vẽ), nút có gợn sóng và ánh sáng lướt, chạm chỗ trống nảy trái tim, thanh tiến độ đọc. Tự tắt khi máy bật "Giảm chuyển động".
- **Responsive**: điện thoại nhỏ (320px), điện thoại xoay ngang, máy tính bảng (2 cột lịch trình, 3 cột album) và máy tính (ảnh bìa cố định bên trái, nội dung cuộn bên phải).
- **Lời mời**: chữ Hỷ, câu trích dẫn, thông tin bố mẹ hai họ, tên khách được mời, ngày giờ cả âm lịch.
- **Đếm ngược** tới giờ cưới.
- **Lịch trình**: Lễ Vu Quy / Lễ Thành Hôn / Tiệc cưới (giờ, địa điểm) với nút 🧭 Chỉ đường (Google Maps), 📅 thêm vào Google Lịch, 🍎 lịch iPhone (.ics), bản đồ nhúng.
- **Album ảnh cưới**: lưới ảnh, chạm để xem toàn màn hình, vuốt chuyển ảnh, tải ảnh.
- **Chuyện tình yêu**: các mốc thời gian (`STORY` trong `src/config.js`).
- **Xác nhận tham dự (RSVP)**: có đến không, mấy người, khách nhà trai/nhà gái, lời nhắn. Lưu ở Firebase `wedding/rsvp`.
- **Lời chúc**: gửi từ thiệp, dùng chung sổ lưu bút với tiệc 3D.
- **Hộp mừng cưới**: mã VietQR + số tài khoản (nút copy).
- **Link riêng từng khách**: `?to=Anh%20Tuấn&side=trai` → thiệp ghi "Kính mời Anh Tuấn", chỉ hiện lễ của nhà trai (và các lễ chung), thứ tự hai họ / tên cô dâu chú rể theo bên mời; vào tiệc 3D được điền sẵn tên.
- **Trang quản lý `?admin`**: tạo link mời hàng loạt (mỗi dòng `Tên | trai/gai`, copy từng link hoặc tất cả), thống kê xác nhận tham dự (số người, theo từng bên), tải file CSV mở bằng Excel, xem toàn bộ lời chúc.
- **Ảnh xem trước khi gửi link** qua Zalo / Messenger / Facebook (`og:image` = `public/og.jpg`).
- **Ảnh cưới trong tiệc 3D**: 6 giá vẽ trưng ảnh hai bên lối vào ở Cổng đón khách, tự đổi ảnh; bấm vào khung (hoặc lại gần → "🖼️ Xem album ảnh cưới") để xem ảnh lớn.
- Vào thẳng tiệc 3D, bỏ qua thiệp: thêm `?3d` vào link.

### Thêm ảnh cưới thật

```bash
npm i -D sharp                       # một lần (hoặc: yarn add -D sharp)
npm run album -- ~/Pictures/anh-cuoi  # thư mục ảnh gốc (jpg/png/heic...)
npm run album -- ~/Pictures/anh-cuoi --cover "05 - Bien.jpg"   # chọn ảnh làm og:image
```

Script thu nhỏ ảnh (WebP 1600px + ảnh nhỏ 640px) vào `public/album/`, tạo `src/album.json` và `public/og.jpg` (1200×630). Ảnh xếp theo tên file; tên kiểu `03 - Dạo phố cổ.jpg` thành chú thích "Dạo phố cổ". Ảnh bìa thiệp: `INVITE.cover` trong `src/config.js` (để trống = ảnh đầu tiên). Chưa có ảnh thật thì thiệp hiện ảnh mẫu vẽ bằng canvas.

## Tính năng tiệc 3D

- **Bản đồ 3D toàn cảnh**: xoay, zoom, có 4 góc nhìn sẵn (Toàn cảnh, Nhìn từ trên, Từ lễ đài, Từ sân khấu). Bấm vào khu để xem mô tả, số người, "Vào khu này" hoặc "Xem từ khu này".
- **5 khu vực**: Cổng đón khách · Lễ đường · Tiệc cưới (12 bàn, bánh cưới) · Góc check-in · Sân khấu & sàn nhảy LED.
- **Thiệp mời / tạo nhân vật**: tên, vai trò (nhà trai, nhà gái...), trang phục (vest, đầm, áo dài), màu áo, màu da.
- **Đi lại góc nhìn thứ ba**: WASD/phím mũi tên, Shift để chạy, Space để nhảy, kéo chuột để xoay camera, V để chuyển góc nhìn thứ nhất. Trên điện thoại có joystick.
- **Biểu cảm (phím 1–9)**: vẫy tay, vỗ tay, quẩy, nâng ly, disco, bắn tim, hò reo, cúi chào, hôn gió. Nhân vật biết chớp mắt, quay đầu nhìn người lại gần, nhún khi tiếp đất, tà áo/tóc đung đưa.
- **Tương tác với đồ vật (E/R khi lại gần)**: ngồi ghế lễ đường/bàn tiệc, xin cô dâu tung hoa cưới (bắt hoa!), hô "Hôn đi!" để cô dâu chú rể trao nụ hôn, ăn bánh cưới, gọi cocktail ở Love Bar, bắn pháo hoa sân khấu, cầm mic hát, bật đèn Disco sàn nhảy, thả bóng bay, thả đèn trời ở cổng hoa, bỏ phong bì, xem sổ lưu bút.
- **Hành động nhanh**: F pháo hoa · G tung cánh hoa · L đèn trời · U bóng bay · P chụp ảnh. Mọi người online đều thấy.
- **Giao lưu**: bấm vào khách khác (kể cả cô dâu chú rể, khách ảo) để Chào, Cụng ly, Gửi tim, Mời nhảy, Ôm, Chụp chung. Nhân vật tự đi tới gần, khách ảo đáp lại, khách online nhận thông báo.
- **Chụp ảnh kỷ niệm**: selfie, chụp ở backdrop check-in hoặc trong khung trái tim – đếm ngược 3-2-1, đèn flash, xuất ảnh khung polaroid có tên cô dâu chú rể để tải về.
- **Đồ hoạ**: bloom phát sáng cho đèn/LED/pháo hoa, trời hoàng hôn có mặt trời và sao lấp lánh, đom đóm, cánh hoa rơi. Nút "✨ Đồ hoạ cao/nhẹ" để tắt bớt trên máy yếu (mặc định nhẹ trên điện thoại).
- **Âm thanh hiệu ứng** tự sinh: pháo hoa, cụng ly, màn trập máy ảnh, chuông...
- **Chat bong bóng**: chỉ người cùng khu mới thấy, tự ẩn sau 20 giây, có thể tắt.
- **Mừng cưới + sổ lưu bút**: lời chúc được phát cho mọi người (kèm pháo giấy) và lưu lâu dài trong Firebase Realtime Database.
- **Nhạc nền "I Do – Đức Phúc"**: đặt file vào `public/music/i-do.mp3` (cần có quyền sử dụng bài hát). Nếu chưa có file, web tự phát nhạc nền tự sinh bằng Web Audio. Đổi bài trong `WEDDING.music` ở `src/config.js`.
- **Vật trang trí & tương tác mới**: đài phun nước (ném đồng xu ước nguyện), xe hoa "Just Married" (bấm còi, chụp ảnh), chuông cưới trên cổng hoa, đèn lồng đỏ dọc lối đi, bảng chữ Hỷ, xích đu hoa, tường khóa tình yêu, tháp champagne (rót cho cả tiệc), xe kem, đàn piano trên sân khấu, hồ thiên nga (cho ăn), bướm bay, chú cún corgi (xoa đầu, rủ đi dạo).
- **Săn trái tim vàng**: 10 trái tim vàng trốn quanh tiệc, tìm đủ để nhận danh hiệu "Thám tử tình yêu".
- **Chương trình MC**: cứ 2 phút có một tiết mục chung cho mọi người (trao nụ hôn, nâng ly, pháo hoa, điệu nhảy đầu tiên, tung hoa cưới, thả đèn trời), đồng bộ theo giờ thực.
- **Cô dâu chú rể** đứng ở lễ đài và chào khi bạn lại gần. Có thêm khách ảo đi lại cho đông vui.
- **Góc kỷ niệm** (khu mới cạnh Love Bar): bức tường lớn vẽ bản đồ Việt Nam (đủ quần đảo Hoàng Sa, Trường Sa của Việt Nam) với trái tim nổi tại mỗi nơi hai bạn từng đến; chạm trái tim để xem ảnh, hoặc mở bản đồ lớn để phóng to. Danh sách nơi đến trong `TRIPS` (`src/config.js`); thêm ảnh thật vào `public/trips/<id>/` rồi ghi đường dẫn vào `photos`, để trống thì hiện ảnh minh hoạ.
- **Voice chat & karaoke** (nút 🎧): nói chuyện theo khoảng cách (đứng gần ai nghe người đó, xa dần nhỏ dần), biểu tượng 🎙️ hiện trên đầu người đang nói. Lên sân khấu chọn "🎤 Cầm mic hát" để cả tiệc nghe, nhạc nền tự giảm nhỏ. Dùng WebRTC kết nối trực tiếp, Firebase làm signaling (`voice/`, `rtc/`). Cấu hình trong `VOICE` (`src/config.js`), có thể thêm máy chủ TURN cho mạng 4G khó kết nối.
- **Màn hình LED phát video YouTube**: video trong `WEDDING.music.youtube` phát lặp liên tục trên màn hình sân khấu và làm nhạc nền cho cả web (nút 🎵 bật/tắt tiếng). Người đứng trên sân khấu che video đúng như thật. Nếu video bị chặn nhúng, web tự dùng nhạc dự phòng.
- **Phong cách cưới Việt**: băng rôn "Tân Hôn" chữ Hỷ trên cổng hoa, bảng Hỷ "Lễ Thành Hôn" sau cô dâu chú rể, mâm cỗ trên từng bàn (gà luộc, xôi gấc, nem rán, tôm hấp, rau xào, canh).
- **Ngồi bàn tiệc**: xem thực đơn (sửa trong `MENU`), gắp món, "1-2-3 Dô cả bàn!" – khách ở cùng bàn (người thật lẫn khách ảo) nâng ly theo.
- **Trao phong bì tận tay cô dâu chú rể**: lại gần cô dâu chú rể → "🧧 Trao phong bì", nhân vật đi tới cúi chào, phong bì bay sang, cô dâu chú rể cảm ơn; lời chúc vào sổ lưu bút. Điền `gift.bankId` + `gift.account` để hiện mã VietQR có sẵn số tiền.
- **Cô dâu chú rể đi chào bàn**: tiết mục mới trong chương trình MC, hai người đi tới từng bàn nâng ly, đồng bộ cho mọi người.
- **Giao lưu thêm**: ✋ Đập tay, 🧧 Lì xì (kèm câu chúc lộc), 🌹 Tặng hoa; người nhận có nút "↩️ Đáp lại" ngay trên thông báo. Phím C bắn 🎊 pháo giấy. Nút "📤 Mời bạn bè" chia sẻ link.
- **Photobooth ở góc check-in**: thợ ảnh đứng sau máy ảnh trên chân máy, 2 đèn softbox nháy flash, bảng hiệu, bàn đạo cụ và dấu "đứng đây". Chụp 4 kiểu liên tiếp (mỗi kiểu một dáng), ghép thành ảnh lưới 2x2 có khung tên cô dâu chú rể. Khách ảo đứng gần tạo dáng theo, khách online trong khu được báo để chạy vào chụp chung. Bấm vào thợ ảnh hoặc lại gần backdrop để chụp.
- **Ảnh chụp góc rộng**: mọi kiểu chụp được render riêng ở 1600×1200 (4:3), không bị cắt hẹp khi dùng điện thoại dọc; có khung ngắm để thấy trước phần sẽ lên ảnh.
- **Thả cảm xúc**: 8 emoji (😂😍👏🎉🥹🔥😮🙏) bay lên trên đầu nhân vật, mọi người đều thấy. Trên điện thoại bấm 💬 để mở.
- **Đi theo**: bấm vào khách khác → "🚶 Đi theo" để tự động đi cùng họ, di chuyển là dừng.
- **Đố vui "Ai hiểu cô dâu chú rể nhất?"**: 6 câu ngẫu nhiên, tính điểm và thời gian. Thêm câu hỏi riêng của hai bạn vào `CUSTOM_QUIZ` trong `src/config.js`.
- **Bốc thăm may mắn**: mỗi máy 1 lượt/ngày, giải lớn có pháo hoa và báo cho cả tiệc. Sửa giải thưởng trong `LUCKY_PRIZES`.
- **Bảng vàng**: xếp hạng đố vui và danh sách "Thám tử tình yêu" tìm đủ 10 trái tim vàng.
- **Thả tim lời chúc** trong sổ lưu bút.
- **Realtime nhiều người** qua Firebase Realtime Database (không cần server riêng). Nếu không kết nối được, web tự chạy ở chế độ offline.

## Chạy thử

```bash
npm install
npm run dev
```

Mở http://localhost:5173. Mở thêm vài tab để thấy nhiều người cùng lúc. Máy khác trong cùng mạng LAN truy cập qua `http://<IP-máy>:5173`.

## Tuỳ biến

- Tên cô dâu chú rể, ngày, giờ, địa điểm, hashtag, thông tin nhận mừng cưới: sửa trong `src/config.js`.
- Nội dung thiệp (bố mẹ hai họ, các lễ, địa chỉ, giờ đếm ngược, âm lịch, trang phục, hạn xác nhận) trong `INVITE`, chuyện tình yêu trong `STORY` (`src/config.js`). Giao diện thiệp: `src/invite.js`, `src/card.css`. Tiêu đề / mô tả khi chia sẻ link được lấy từ `WEDDING` lúc build (`vite.config.js`).
- Bố cục khu vực: `ZONES` trong `src/venue.js`. Mô hình sân khấu, bàn tiệc, cổng hoa... nằm trong `buildVenue()` ở cùng file.
- Nhân vật và biểu cảm: `src/avatar.js`. Vật trang trí mới (xe hoa, đài phun nước, piano, cún...): `src/decor.js`. Hiệu ứng (pháo hoa, đèn trời, bóng bay...): `src/effects.js`. Sao, đom đóm, cánh hoa rơi: `src/ambient.js`.
- Điểm tương tác (E/R) và hành động nhanh: `INTERACTS`, `ACTIONS` trong `src/main.js`. Mở trang với `?debug` để truy cập `window.__wedding` trong console.
- Câu nói và hành vi của khách ảo: `src/bots.js`. Đổi số lượng trong `src/main.js` (`new Bots(...)`).

## Deploy

Web là site tĩnh (Vite), realtime dùng Firebase Realtime Database nên deploy được lên Vercel/Netlify/Cloudflare Pages.

- **Vercel**: Import repo → Framework Vite (tự nhận) → Deploy. Build `npm run build`, output `dist`.
- **Ảnh xem trước khi gửi link**: Zalo/Facebook cần đường dẫn ảnh tuyệt đối. Trên Vercel tự lấy tên miền production; nơi khác đặt `VITE_SITE_URL=https://ten-mien-cua-ban` trong `.env` (hoặc biến môi trường lúc build). Đổi ảnh xong có thể làm mới bộ nhớ đệm của Facebook ở developers.facebook.com/tools/debug.
- **Firebase**: cấu hình nằm trong `src/firebase.js`. Dán nội dung `database.rules.json` vào Firebase Console → Realtime Database → Rules → Publish (thay cho test mode, vốn hết hạn sau 30 ngày).
- Dữ liệu nằm dưới nhánh `wedding/`: `presence` (người đang mở trang), `peers` (khách đã vào), `st` (vị trí), `events` (chat/hiệu ứng/cảm xúc, tự dọn sau 15 giây), `wishes` (sổ lưu bút), `likes` (tim cho lời chúc), `boards` (Bảng vàng), `rsvp` (xác nhận tham dự từ thiệp, mỗi máy một dòng). ⚠️ Nhớ dán lại `database.rules.json` mới lên Firebase, nếu không nút "Gửi xác nhận" sẽ báo lỗi. Dữ liệu dưới `wedding/` ai cũng đọc được (giống sổ lưu bút) nên đừng hỏi số điện thoại/địa chỉ trong form xác nhận.
