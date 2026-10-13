import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
await mkdir('public/icons', { recursive: true });
for (const size of [192, 512]) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const segments = [[125, 335, 210, 235], [210, 235, 285, 280], [285, 280, 385, 165], [330, 165, 385, 165], [385, 165, 385, 225]];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = x * 512 / size; const py = y * 512 / size;
    const ink = segments.some(([ax, ay, bx, by]) => {
      const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
      return Math.hypot(px - ax - t * (bx - ax), py - ay - t * (by - ay)) < 14;
    });
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    raw.set(ink ? [96, 165, 250, 255] : [9, 13, 22, 255], offset);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  await writeFile(`public/icons/markets-${size}.png`, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
