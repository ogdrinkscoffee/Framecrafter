const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function isValidPngFile(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 45) return false;
    if (!buf.subarray(0, 8).equals(PNG_SIG)) return false;
    if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') return false;
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const bitDepth = buf[24];
    const colorType = buf[25];
    const iendTrailer = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
    if (!buf.subarray(buf.length - 12).equals(iendTrailer)) return false;
    return width >= 256 && height >= 256 && bitDepth === 8 && (colorType === 6 || colorType === 2);
  } catch {
    return false;
  }
}

function buildIconPngBuffer() {
  const W = 512;
  const H = 512;
  const rgba = Buffer.alloc(W * H * 4);

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function smoothstep(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function sdRoundRect(px, py, cx, cy, hw, hh, r) {
    const qx = Math.abs(px - cx) - hw + r;
    const qy = Math.abs(py - cy) - hh + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  }
  function blend(idx, r, g, b, a) {
    const alpha = clamp(a, 0, 1);
    const inv = 1 - alpha;
    rgba[idx] = Math.round(rgba[idx] * inv + r * alpha);
    rgba[idx + 1] = Math.round(rgba[idx + 1] * inv + g * alpha);
    rgba[idx + 2] = Math.round(rgba[idx + 2] * inv + b * alpha);
    rgba[idx + 3] = Math.round(
      clamp(rgba[idx + 3] / 255 + alpha * (1 - rgba[idx + 3] / 255), 0, 1) * 255
    );
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const idx = (y * W + x) * 4;

      const dOuter = sdRoundRect(px, py, 256, 256, 224, 224, 96);
      const outerAlpha = 1 - smoothstep(-1.2, 1.2, dOuter);
      if (outerAlpha <= 0) continue;

      const bgGrad = y / H;
      blend(
        idx,
        Math.round(14 + 6 * bgGrad),
        Math.round(16 + 7 * bgGrad),
        Math.round(24 + 12 * bgGrad),
        outerAlpha
      );

      const borderDist = Math.abs(dOuter + 5);
      const borderAlpha = (1 - smoothstep(0, 3.5, borderDist)) * outerAlpha * 0.45;
      blend(idx, 129, 140, 248, borderAlpha);

      const sx = (px - 76) / 15;
      const sy = (py - 76) / 15;

      const dFrame = sdRoundRect(sx, sy, 12, 12, 9, 9, 3.4);
      const strokeFrame = 1 - smoothstep(0.45, 0.85, Math.abs(dFrame));
      blend(idx, 241, 245, 249, strokeFrame * 0.92);

      if (dFrame < 0) {
        const hLine = 1 - smoothstep(0.35, 0.72, Math.abs(sy - 9.5));
        const vLine = 1 - smoothstep(0.35, 0.72, Math.abs(sx - 9.5));
        blend(idx, 203, 213, 225, Math.max(hLine, vLine) * 0.55);
      }

      const dInner = sdRoundRect(sx, sy, 15.25, 15.25, 5.75, 5.75, 2.2);
      const innerFill = (1 - smoothstep(-0.3, 0.3, dInner)) * 0.24;
      blend(idx, 99, 102, 241, innerFill);
      const innerStroke = 1 - smoothstep(0.42, 0.82, Math.abs(dInner));
      blend(idx, 129, 140, 248, innerStroke);

      const dDot = Math.hypot(sx - 15.25, sy - 15.25) - 1.55;
      const dotAlpha = 1 - smoothstep(-0.3, 0.35, dDot);
      blend(idx, 129, 140, 248, dotAlpha);
    }
  }

  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    const rowStart = y * (W * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * W * 4, (y + 1) * W * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const rootDir = path.resolve(__dirname, '..');
const targets = [
  path.join(rootDir, 'build', 'icon.png'),
  path.join(rootDir, 'electron', 'icon.png'),
];

const pngBuffer = buildIconPngBuffer();
for (const target of targets) {
  if (!isValidPngFile(target)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, pngBuffer);
    console.log('Generated valid PNG icon:', path.relative(rootDir, target));
  } else {
    console.log('Verified valid PNG icon:', path.relative(rootDir, target));
  }
}
