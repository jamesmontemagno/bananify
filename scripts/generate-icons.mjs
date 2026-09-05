import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

// Rasterize an original crescent at 4x resolution; no build dependencies.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const type = Buffer.from(name);
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length);
  type.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([type, data])), data.length + 8);
  return result;
}
function icon(size) {
  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const color = [0, 0, 0, 0];
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          const px = (x + (sx + .5) / 4) / size * 100;
          const py = (y + (sy + .5) / 4) / size * 100;
          const outer = Math.hypot((px - 49) / 43, (py - 45) / 47);
          const inner = Math.hypot((px - 62) / 38, (py - 24) / 41);
          const stem = px > 11 && px < 22 && py > 14 && py < 27;
          const tip = px > 81 && px < 91 && py > 46 && py < 54;
          let sample = [0, 0, 0, 0];
          if (outer < 1 && inner > 1) {
            sample = outer > .94 || inner < 1.065 ? [88, 53, 30, 255]
              : outer > .8 ? [255, 237, 137, 255] : [255, 214, 41, 255];
          }
          if (stem || tip) sample = [88, 53, 30, 255];
          for (let c = 0; c < 4; c++) color[c] += sample[c] / 16;
        }
      }
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      const alpha = color[3] / 255;
      for (let c = 0; c < 3; c++) scanlines[offset + c] = alpha ? Math.round(color[c] / alpha) : 0;
      scanlines[offset + 3] = Math.round(color[3]);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(scanlines)), chunk("IEND", Buffer.alloc(0)),
  ]);
}
await mkdir(new URL("../icons/", import.meta.url), { recursive: true });
for (const size of [16, 32, 48, 128]) {
  await writeFile(new URL(`../icons/banana-${size}.png`, import.meta.url), icon(size));
}
console.log("Generated banana icons at 16, 32, 48, and 128px.");
