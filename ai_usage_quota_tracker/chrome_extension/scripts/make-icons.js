// Generates icon16/48/128 PNGs with zero external dependencies (pure
// Node zlib + a hand-rolled PNG encoder) so the repo doesn't need to ship
// binary assets or pull in an image library just for three small icons.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgbaPixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk("IHDR", ihdrData);

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    rgbaPixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idatData = zlib.deflateSync(raw, { level: 9 });
  const idat = chunk("IDAT", idatData);

  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.46;
  const cornerRadius = size * 0.22;

  // Bolt polygon points scaled to icon size (roughly centered lightning bolt).
  const bolt = [
    [0.56, 0.08],
    [0.28, 0.58],
    [0.46, 0.58],
    [0.4, 0.94],
    [0.74, 0.4],
    [0.54, 0.4]
  ].map(([x, y]) => [x * size, y * size]);

  function pointInPolygon(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      const intersect =
        yi > py !== yj > py &&
        px < ((xj - xi) * (py - yi)) / (yj - yi + 0.0000001) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function roundedRectAlpha(x, y) {
    const dx = Math.max(0, Math.abs(x - cx) - (cx - cornerRadius));
    const dy = Math.max(0, Math.abs(y - cy) - (cy - cornerRadius));
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist <= cornerRadius ? 1 : 0;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const bg = roundedRectAlpha(x + 0.5, y + 0.5);
      if (!bg) {
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
        continue;
      }
      const t = y / size;
      const r = Math.round(lerp(0x6d, 0x8b, t));
      const g = Math.round(lerp(0x5e, 0x7b, t));
      const b = Math.round(lerp(0xfc, 0xff, t));

      const isBolt = pointInPolygon(x + 0.5, y + 0.5, bolt);
      pixels[idx] = isBolt ? 255 : r;
      pixels[idx + 1] = isBolt ? 255 : g;
      pixels[idx + 2] = isBolt ? 255 : b;
      pixels[idx + 3] = 255;
    }
  }

  return pixels;
}

function main() {
  const outDir = path.join(__dirname, "..", "icons");
  fs.mkdirSync(outDir, { recursive: true });
  [16, 48, 128].forEach((size) => {
    const pixels = drawIcon(size);
    const png = encodePng(size, size, pixels);
    fs.writeFileSync(path.join(outDir, `icon${size}.png`), png);
    console.log(`icons/icon${size}.png written`);
  });
}

main();
