import { defineConfig } from 'vite';
import { WEDDING } from './src/config.js';

// Điền tiêu đề / ảnh xem trước (Zalo, Messenger, Facebook không chạy JS nên phải có sẵn trong HTML).
// Ảnh og:image cần đường dẫn tuyệt đối: đặt VITE_SITE_URL=https://ten-mien-cua-ban trong .env,
// trên Vercel tự lấy tên miền production.
function weddingMeta() {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const couple = `${WEDDING.groom} & ${WEDDING.bride}`;
  const host = process.env.VITE_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  const vars = {
    SITE_URL: host.replace(/\/$/, ''),
    PAGE_TITLE: `Thiệp cưới ${couple} – ${WEDDING.date} 💒`,
    PAGE_DESC: `Trân trọng kính mời bạn tới dự lễ cưới của ${couple} – ${WEDDING.dateLong} · ${WEDDING.time} · ${WEDDING.venue}. Xem thiệp, album ảnh cưới, xác nhận tham dự và dự tiệc cưới 3D online.`,
    OG_TITLE: `💌 Thiệp cưới ${couple} – ${WEDDING.date}`,
    OG_DESC: `Trân trọng kính mời bạn tới chung vui cùng gia đình chúng mình. Bấm để xem thiệp, album ảnh cưới và xác nhận tham dự 💍`,
  };
  return {
    name: 'wedding-meta',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replace(/%(SITE_URL|PAGE_TITLE|PAGE_DESC|OG_TITLE|OG_DESC)%/g, (_, k) => esc(vars[k])),
    },
  };
}

export default defineConfig({
  plugins: [weddingMeta()],
  server: { port: 5173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
