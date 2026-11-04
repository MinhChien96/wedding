// ====== Thông tin đám cưới – sửa ở đây cho đám cưới của bạn ======
export const WEDDING = {
  groom: 'Chiến',
  bride: 'Xim',
  date: '20.12.2026',
  dateLong: 'Chủ nhật, ngày 20 tháng 12 năm 2026',
  time: '17:30',
  venue: 'Vườn tiệc Ocean Garden',
  hashtag: '#ChienXimWedding',

  // Nhạc nền: đặt file bài hát vào public/music/i-do.mp3 (bạn cần có bản quyền/quyền sử dụng file).
  // Nếu không có file, web tự phát nhạc nền tự sinh.
  music: {
    // Video YouTube phát lặp liên tục trên màn hình LED sân khấu và làm nhạc nền cho cả web.
    // Để trống nếu không dùng; khi video không phát được (bị chặn nhúng...) web tự dùng nhạc dự phòng bên dưới.
    youtube: 'https://youtu.be/IOe0tNoUGv8',
    // Âm lượng nhạc nền (0–100). Khi bật voice / có người nói / có người hát, nhạc tự hạ thấp hơn nữa.
    volume: 35,
    // Âm lượng nhạc trên thiệp mời (0–100), thiệp phát cùng bài YouTube ở trên.
    cardVolume: 70,
    title: 'I Do – Đức Phúc',
    src: '/music/i-do.mp3',
  },

  // Thông tin nhận mừng cưới (hiện trong hộp "Mừng cưới").
  // Để trống account nếu không muốn hiển thị.
  // bankId: mã ngân hàng cho mã VietQR (ví dụ 'VCB', 'TCB', 'MB', 'ACB', 'VPB'...) – có thì hiện mã QR chuyển khoản kèm số tiền.
  gift: {
    bank: 'TPBank',
    bankId: '970423', // mã BIN của TPBank cho VietQR
    account: '0363605867',
    owner: 'NGUYEN MINH CHIEN',
  },
};

// ====== Thiệp cưới online (trang đầu tiên khi mở link) ======
// Ảnh cưới: chạy `npm run album -- <thư-mục-ảnh-gốc>` để thu nhỏ ảnh vào public/album/ và tạo src/album.json.
// Chưa có ảnh thật thì thiệp hiện ảnh mẫu vẽ sẵn.
// Link riêng cho từng khách: ?to=Anh%20Tuấn&side=trai (side: trai | gai) – tạo hàng loạt ở trang ?admin.
export const INVITE = {
  // Ảnh bìa, ví dụ '/album/01.webp'. Để trống → dùng ảnh đầu tiên trong album.
  cover: '',
  // Ngày giờ chính (đếm ngược), theo giờ Việt Nam
  at: '2026-12-20T17:30:00+07:00',
  lunar: 'Tức ngày 12 tháng 11 năm Bính Ngọ',
  quote: 'Yêu là cùng nhau nhìn về một hướng – và từ hôm nay, chúng mình cùng đi chung một con đường.',
  groomFull: 'Nguyễn Minh Chiến',
  brideFull: 'Nguyễn Thị Xim',
  families: [
    { side: 'trai', title: 'Nhà trai', father: 'Ông Nguyễn Văn A', mother: 'Bà Trần Thị B', address: 'Xã Yên Thường, Gia Lâm, Hà Nội', child: 'Trưởng nam' },
    { side: 'gai', title: 'Nhà gái', father: 'Ông Nguyễn Văn C', mother: 'Bà Phạm Thị D', address: 'Phường Hồng Hải, Hạ Long, Quảng Ninh', child: 'Út nữ' },
  ],
  // side: 'trai' | 'gai' | 'all' – link có &side=... chỉ hiện lễ của bên đó (và các lễ 'all')
  // start/end: giờ Việt Nam dạng YYYY-MM-DDTHH:mm. map: true → nhúng bản đồ Google ngay dưới lễ này.
  events: [
    { side: 'gai', icon: '🏮', name: 'Lễ Vu Quy', start: '2026-12-20T08:00', end: '2026-12-20T10:00', place: 'Tư gia nhà gái', address: 'Phường Hồng Hải, Hạ Long, Quảng Ninh' },
    { side: 'trai', icon: '💒', name: 'Lễ Thành Hôn', start: '2026-12-20T11:00', end: '2026-12-20T13:00', place: 'Tư gia nhà trai', address: 'Xã Yên Thường, Gia Lâm, Hà Nội' },
    { side: 'all', icon: '🥂', name: 'Tiệc cưới', start: '2026-12-20T17:30', end: '2026-12-20T21:00', place: WEDDING.venue, address: 'Ocean Park, Gia Lâm, Hà Nội', map: true },
  ],
  dress: 'Tông pastel nhẹ nhàng (hồng, kem, xanh nhạt) – không bắt buộc',
  rsvpBy: '10.12.2026',
};

// Chuyện tình yêu (mốc thời gian trên thiệp)
export const STORY = [
  { when: '2019', icon: '☕', title: 'Lần đầu gặp nhau', text: 'Một buổi cà phê cuối tuần do bạn chung rủ – không ai nghĩ đó là khởi đầu.' },
  { when: '2020', icon: '💌', title: 'Chính thức hẹn hò', text: 'Sau rất nhiều tin nhắn chúc ngủ ngon, một người đã dũng cảm nói lời yêu.' },
  { when: '2021 – 2025', icon: '🗺️', title: 'Cùng nhau đi khắp Việt Nam', text: 'Mộc Châu, Hạ Long, Hội An, Mũi Né... mỗi chuyến đi là một trái tim trên bản đồ kỷ niệm.' },
  { when: '2026', icon: '💍', title: 'Lời cầu hôn', text: 'Một chiếc nhẫn, một câu hỏi và một cái gật đầu.' },
  { when: '20.12.2026', icon: '💒', title: 'Về chung một nhà', text: 'Và chúng mình rất mong có bạn ở đó.' },
];

// ====== Đố vui "Ai hiểu Chiến & Xim nhất?" ======
// Mỗi lượt chơi lấy ngẫu nhiên 6 câu. c = vị trí đáp án đúng (bắt đầu từ 0).
// 👉 Thêm câu hỏi riêng về hai bạn vào CUSTOM_QUIZ (ví dụ: quen nhau ở đâu, ai tỏ tình trước...).
export const CUSTOM_QUIZ = [
  // { q: 'Chiến và Xim quen nhau ở đâu?', a: ['Ở trường', 'Ở công ty', 'Qua bạn bè', 'Trên mạng'], c: 2 },
];

export const QUIZ = [
  { q: `Đám cưới của ${WEDDING.groom} & ${WEDDING.bride} diễn ra vào ngày nào?`, a: [WEDDING.date, '14.02.2027', '08.03.2026', '01.01.2027'], c: 0 },
  { q: 'Tiệc cưới được tổ chức ở đâu?', a: ['Nhà văn hoá phường', WEDDING.venue, 'Bãi biển Mỹ Khê', 'Nhà hàng Hoa Sen'], c: 1 },
  { q: 'Hashtag chính thức của đám cưới là gì?', a: ['#HappyWedding', '#ChungDoi2026', WEDDING.hashtag, '#TramNamHanhPhuc'], c: 2 },
  { q: 'Tiệc cưới bắt đầu lúc mấy giờ?', a: ['11:00', '18:30', '16:00', WEDDING.time], c: 3 },
  { q: 'Nhẫn cưới thường được đeo ở ngón nào?', a: ['Ngón trỏ', 'Ngón giữa', 'Ngón áp út', 'Ngón út'], c: 2 },
  { q: 'Kỷ niệm 25 năm ngày cưới được gọi là gì?', a: ['Đám cưới bạc', 'Đám cưới vàng', 'Đám cưới ngọc trai', 'Đám cưới giấy'], c: 0 },
  { q: 'Kỷ niệm 50 năm ngày cưới được gọi là gì?', a: ['Đám cưới kim cương', 'Đám cưới vàng', 'Đám cưới bạc', 'Đám cưới đồng'], c: 1 },
  { q: 'Theo phong tục phương Tây, ai là người tung hoa cưới?', a: ['Chú rể', 'Phù dâu', 'Mẹ cô dâu', 'Cô dâu'], c: 3 },
  { q: 'Trong đám cưới Việt, mâm lễ ăn hỏi thường gọi là gì?', a: ['Tráp', 'Mâm cỗ', 'Mâm ngũ quả', 'Lễ vu quy'], c: 0 },
  { q: 'Trên thiệp cưới, chữ "Vu quy" dùng cho bên nào?', a: ['Nhà trai', 'Nhà gái', 'Cả hai', 'Người chủ hôn'], c: 1 },
  { q: 'Trong web này, có bao nhiêu trái tim vàng đang trốn quanh tiệc?', a: ['5', '8', '10', '12'], c: 2 },
  ...CUSTOM_QUIZ,
];

// ====== Bốc thăm may mắn (mỗi máy 1 lượt/ngày) ======
// w = trọng số (càng lớn càng dễ trúng). big = giải lớn: pháo hoa và báo cho cả tiệc.
export const LUCKY_PRIZES = [
  { text: '🧧 Lì xì may mắn: năm nay tiền vào như nước', w: 18 },
  { text: '🍰 Thêm một miếng bánh cưới thật to', w: 16 },
  { text: '💃 Được mời nhảy cặp cùng cô dâu chú rể', w: 12 },
  { text: '📸 Một tấm ảnh chụp chung với cô dâu chú rể', w: 14 },
  { text: '🎤 Thử thách: hát tặng cô dâu chú rể một bài', w: 12 },
  { text: '🥂 Được nâng ly chúc mừng đầu tiên', w: 14 },
  { text: '💐 Ưu tiên đứng hàng đầu khi tung hoa cưới', w: 10 },
  { text: '🌟 GIẢI ĐẶC BIỆT: Khách mời danh dự của đám cưới', w: 3, big: true },
  { text: '💍 GIẢI ĐẶC BIỆT: Người tiếp theo lên xe hoa', w: 3, big: true },
];

// ====== Thực đơn tiệc cưới (xem khi ngồi vào bàn) ======
export const MENU = [
  { group: 'Khai vị', items: ['Súp cua gà ngô non', 'Gỏi ngó sen tôm thịt', 'Nem rán Hà Nội'] },
  { group: 'Món chính', items: ['Gà ta luộc lá chanh', 'Tôm sú hấp nước dừa', 'Bò xào rau cải', 'Cá song hấp xì dầu', 'Xôi gấc đỏ may mắn'] },
  { group: 'Lẩu', items: ['Lẩu hải sản chua cay', 'Rau và bún ăn kèm'] },
  { group: 'Tráng miệng', items: ['Chè hạt sen long nhãn', 'Trái cây theo mùa'] },
  { group: 'Đồ uống', items: ['Bia, rượu vang, nước ngọt', 'Trà nóng'] },
];

// ====== Voice chat & karaoke ======
// Kết nối trực tiếp giữa các máy (WebRTC). STUN giúp các máy tìm thấy nhau qua Internet.
// Một số mạng 4G/công ty chặn kết nối trực tiếp → cần thêm máy chủ TURN, ví dụ:
//   { urls: 'turn:your-turn-server:3478', username: '...', credential: '...' }
export const VOICE = {
  range: 15, // mét: đứng trong khoảng này mới nghe nhau, càng xa càng nhỏ
  maxPeers: 8, // tối đa số người nói chuyện cùng lúc với một máy
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
  // Máy chủ TURN miễn phí của Metered (Open Relay): đăng ký metered.ca → TURN Server → copy link
  // "https://<tên-app>.metered.live/api/v1/turn/credentials?apiKey=<API key>" dán vào đây.
  turnUrl: '',
};

// ====== Bản đồ hành trình du lịch của hai bạn ======
// photos: danh sách đường dẫn ảnh, ví dụ ['/trips/hoi-an/1.jpg', '/trips/hoi-an/2.jpg'] (đặt file trong public/trips/...)
//   Để trống [] → hiện ảnh minh hoạ demo.
// when: thời gian đi (ví dụ '04/2023'), story: vài dòng kể chuyện. lx/ly: dời nhãn tên trên bản đồ cho khỏi đè nhau.
// scene: kiểu ảnh demo (mountain, bay, karst, city, beach, cave, citadel, ancient, island, dunes)
export const TRIPS = [
  { id: 'moc-chau', name: 'Mộc Châu', lat: 20.85, lon: 104.63, scene: 'mountain', lx: -1, ly: 0, when: '', story: '', photos: [] },
  { id: 'tam-dao', name: 'Tam Đảo', lat: 21.46, lon: 105.65, scene: 'mountain', lx: 0, ly: -1, when: '', story: '', photos: [] },
  { id: 'hai-phong', name: 'Hải Phòng', lat: 20.86, lon: 106.68, scene: 'city', lx: 1, ly: 0.9, when: '', story: '', photos: [] },
  { id: 'ha-long', name: 'Hạ Long', lat: 20.95, lon: 107.08, scene: 'bay', lx: 1, ly: -0.9, when: '', story: '', photos: [] },
  { id: 'ninh-binh', name: 'Ninh Bình', lat: 20.25, lon: 105.97, scene: 'karst', lx: 1, ly: 0.2, when: '', story: '', photos: [] },
  { id: 'thanh-hoa', name: 'Thanh Hoá', lat: 19.81, lon: 105.78, scene: 'beach', lx: -1, ly: 0, when: '', story: '', photos: [] },
  { id: 'nghe-an', name: 'Nghệ An', lat: 18.68, lon: 105.68, scene: 'beach', lx: -1, ly: 0, when: '', story: '', photos: [] },
  { id: 'ha-tinh', name: 'Hà Tĩnh', lat: 18.34, lon: 105.90, scene: 'beach', lx: 1, ly: 0.2, when: '', story: '', photos: [] },
  { id: 'quang-binh', name: 'Quảng Bình', lat: 17.47, lon: 106.62, scene: 'cave', lx: 1, ly: 0, when: '', story: '', photos: [] },
  { id: 'hue', name: 'Huế', lat: 16.46, lon: 107.59, scene: 'citadel', lx: -1, ly: -0.2, when: '', story: '', photos: [] },
  { id: 'da-nang', name: 'Đà Nẵng', lat: 16.05, lon: 108.21, scene: 'city', lx: 1, ly: -0.3, when: '', story: '', photos: [] },
  { id: 'hoi-an', name: 'Hội An', lat: 15.88, lon: 108.33, scene: 'ancient', lx: 1, ly: 0.4, when: '', story: '', photos: [] },
  { id: 'ly-son', name: 'Lý Sơn', lat: 15.38, lon: 109.12, scene: 'island', lx: 1, ly: 0, when: '', story: '', photos: [] },
  { id: 'nha-trang', name: 'Nha Trang', lat: 12.24, lon: 109.19, scene: 'beach', lx: 1, ly: 0, when: '', story: '', photos: [] },
  { id: 'mui-ne', name: 'Mũi Né', lat: 10.95, lon: 108.29, scene: 'dunes', lx: 1, ly: -0.3, when: '', story: '', photos: [] },
  { id: 'phan-thiet', name: 'Phan Thiết', lat: 10.93, lon: 108.10, scene: 'beach', lx: 0.3, ly: 1, when: '', story: '', photos: [] },
  { id: 'ho-chi-minh', name: 'TP. Hồ Chí Minh', lat: 10.78, lon: 106.70, scene: 'city', lx: -1, ly: 0.2, when: '', story: '', photos: [] },
];
