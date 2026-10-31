# 💒 Đám cưới 3D online

Web 3D cho khách mời tham dự đám cưới online: mỗi người tạo nhân vật, đi lại giữa các khu, chat, nhảy, nâng ly và gửi lời chúc. Lấy cảm hứng từ các trang 3D map đi concert.

## Tính năng

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
- **Mừng cưới + sổ lưu bút**: lời chúc được phát cho mọi người (kèm pháo giấy) và lưu vào `server/wishes.json`.
- **Nhạc nền "I Do – Đức Phúc"**: đặt file vào `public/music/i-do.mp3` (cần có quyền sử dụng bài hát). Nếu chưa có file, web tự phát nhạc nền tự sinh bằng Web Audio. Đổi bài trong `WEDDING.music` ở `src/config.js`.
- **Vật trang trí & tương tác mới**: đài phun nước (ném đồng xu ước nguyện), xe hoa "Just Married" (bấm còi, chụp ảnh), chuông cưới trên cổng hoa, đèn lồng đỏ dọc lối đi, bảng chữ Hỷ, xích đu hoa, tường khóa tình yêu, tháp champagne (rót cho cả tiệc), xe kem, đàn piano trên sân khấu, hồ thiên nga (cho ăn), bướm bay, chú cún corgi (xoa đầu, rủ đi dạo).
- **Săn trái tim vàng**: 10 trái tim vàng trốn quanh tiệc, tìm đủ để nhận danh hiệu "Thám tử tình yêu".
- **Chương trình MC**: cứ 2 phút có một tiết mục chung cho mọi người (trao nụ hôn, nâng ly, pháo hoa, điệu nhảy đầu tiên, tung hoa cưới, thả đèn trời), đồng bộ theo giờ thực.
- **Cô dâu chú rể** đứng ở lễ đài và chào khi bạn lại gần. Có thêm khách ảo đi lại cho đông vui.
- **Realtime nhiều người** qua WebSocket. Nếu không có server, web tự chạy ở chế độ offline.

## Chạy thử

```bash
npm install
npm run dev
```

Mở http://localhost:5173. Lệnh này chạy cả Vite (5173) và server realtime (3001). Mở thêm vài tab để thấy nhiều người cùng lúc. Máy khác trong cùng mạng LAN truy cập qua `http://<IP-máy>:5173`.

## Tuỳ biến

- Tên cô dâu chú rể, ngày, giờ, địa điểm, hashtag, thông tin nhận mừng cưới: sửa trong `src/config.js`.
- Bố cục khu vực: `ZONES` trong `src/venue.js`. Mô hình sân khấu, bàn tiệc, cổng hoa... nằm trong `buildVenue()` ở cùng file.
- Nhân vật và biểu cảm: `src/avatar.js`. Vật trang trí mới (xe hoa, đài phun nước, piano, cún...): `src/decor.js`. Hiệu ứng (pháo hoa, đèn trời, bóng bay...): `src/effects.js`. Sao, đom đóm, cánh hoa rơi: `src/ambient.js`.
- Điểm tương tác (E/R) và hành động nhanh: `INTERACTS`, `ACTIONS` trong `src/main.js`. Mở trang với `?debug` để truy cập `window.__wedding` trong console.
- Câu nói và hành vi của khách ảo: `src/bots.js`. Đổi số lượng trong `src/main.js` (`new Bots(...)`).

## Deploy

Server realtime cần một máy chủ Node chạy liên tục. Vercel không giữ được kết nối WebSocket.

**Cách 1: một server làm tất cả** (Render, Railway, Fly.io, VPS):

```bash
npm install && npm run build
npm start            # phục vụ dist/ và WebSocket /ws trên PORT (mặc định 3001)
```

**Cách 2: frontend trên Vercel/Netlify, realtime ở nơi khác**: deploy `server/` lên Render/Railway, rồi build frontend với biến môi trường:

```
VITE_WS_URL=wss://ten-server-cua-ban.onrender.com/ws
```

## Cấu trúc

```
src/
  main.js      – vòng lặp chính, camera, điều khiển, UI, kết nối mạng
  venue.js     – dựng khung cảnh 3D, khu vực, va chạm
  avatar.js    – nhân vật low-poly và animation
  bots.js      – khách ảo
  effects.js   – trái tim, pháo giấy
  audio.js     – nhạc nền Web Audio
  network.js   – client WebSocket
  textures.js  – chữ, nhãn tên, bong bóng chat vẽ bằng canvas
server/index.js – WebSocket server + phục vụ file tĩnh
```
