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
