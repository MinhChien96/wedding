// Thu nhỏ ảnh cưới cho web: node scripts/album.mjs <thư-mục-ảnh-gốc> [--cover tên-ảnh.jpg]
//  → public/album/NN.webp (cạnh dài 1600px), public/album/thumb/NN.webp (640px),
//    public/og.jpg (1200×630, ảnh hiện khi gửi link qua Zalo/Messenger) và src/album.json.
// Chú thích ảnh: đặt tên file kiểu "03 - Dạo phố cổ.jpg" → chú thích "Dạo phố cổ". Ảnh xếp theo tên file.
// Cần sharp: npm i -D sharp (hoặc yarn add -D sharp)
import { readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, extname, basename, resolve } from 'node:path';

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith('--'));
const coverArg = args.includes('--cover') ? args[args.indexOf('--cover') + 1] : null;
if (!src) {
  console.log('Cách dùng: npm run album -- <thư-mục-ảnh-gốc> [--cover ten-anh.jpg]');
  process.exit(1);
}
let sharp;
try { sharp = (await import('sharp')).default; } catch {
  console.error('Thiếu thư viện sharp. Cài bằng: npm i -D sharp   (hoặc: yarn add -D sharp)');
  process.exit(1);
}

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'public/album');
await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'thumb'), { recursive: true });

const files = (await readdir(src)).filter((f) => /\.(jpe?g|png|webp|heic|avif|tiff?)$/i.test(f)).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
if (!files.length) { console.error('Không thấy ảnh nào trong', src); process.exit(1); }

const list = [];
for (const [i, f] of files.entries()) {
  const id = String(i + 1).padStart(2, '0');
  const img = sharp(join(src, f)).rotate(); // xoay theo EXIF
  const big = await img.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(out, `${id}.webp`));
  await img.clone().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(join(out, 'thumb', `${id}.webp`));
  const caption = basename(f, extname(f)).replace(/^[\d\s._-]+/, '').replace(/[_]+/g, ' ').trim();
  list.push({ src: `/album/${id}.webp`, thumb: `/album/thumb/${id}.webp`, w: big.width, h: big.height, caption, file: f });
  console.log(`✔ ${f} → ${id}.webp (${big.width}×${big.height}, ${Math.round(big.size / 1024)} KB)`);
}

const cover = list.find((p) => p.file === coverArg) || list.find((p) => p.w >= p.h) || list[0];
await sharp(join(src, cover.file)).rotate().resize(1200, 630, { fit: 'cover', position: 'attention' }).jpeg({ quality: 84, mozjpeg: true }).toFile(join(root, 'public/og.jpg'));
console.log(`✔ Ảnh xem trước khi gửi link: public/og.jpg (từ ${cover.file})`);

await writeFile(join(root, 'src/album.json'), `${JSON.stringify(list.map(({ file, ...p }) => p), null, 1)}\n`);
console.log(`\nXong ${list.length} ảnh → src/album.json. Muốn đổi ảnh bìa thiệp: sửa INVITE.cover trong src/config.js (ví dụ '/album/01.webp').`);
