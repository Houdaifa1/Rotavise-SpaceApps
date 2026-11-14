import { inflateSync } from "node:zlib";

// A strict reader for the GeoTIFF the SoilGrids WCS returns: little-endian,
// one band of signed 16-bit integers, deflate, horizontal predictor, tiled.
// Anything else is rejected rather than guessed.
export class GeoTiffError extends Error {}
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 12: 8 };
export function readSoilTiff(raw: Uint8Array) {
  const b = Buffer.from(raw);
  if (
    b.length < 8 ||
    b.toString("latin1", 0, 2) !== "II" ||
    b.readUInt16LE(2) !== 42
  )
    throw new GeoTiffError("HEADER");
  const start = b.readUInt32LE(4);
  const count = b.readUInt16LE(start);
  const tags = new Map<number, number[]>();
  for (let i = 0; i < count; i++) {
    const at = start + 2 + i * 12;
    const tag = b.readUInt16LE(at);
    const type = b.readUInt16LE(at + 2);
    const n = b.readUInt32LE(at + 4);
    const size = TYPE_SIZE[type];
    if (!size || n > 100000) continue;
    const from = size * n <= 4 ? at + 8 : b.readUInt32LE(at + 8);
    if (from + size * n > b.length) throw new GeoTiffError("BOUNDS");
    if (type === 2) continue;
    const values: number[] = [];
    for (let k = 0; k < n; k++) {
      const p = from + k * size;
      values.push(
        type === 1
          ? b.readUInt8(p)
          : type === 3
            ? b.readUInt16LE(p)
            : type === 4
              ? b.readUInt32LE(p)
              : b.readDoubleLE(p),
      );
    }
    tags.set(tag, values);
  }
  const one = (tag: number) => {
    const v = tags.get(tag)?.[0];
    if (v === undefined) throw new GeoTiffError(`TAG_${tag}`);
    return v;
  };
  const width = one(256);
  const height = one(257);
  if (
    width < 1 ||
    height < 1 ||
    width * height > 10000 ||
    one(258) !== 16 ||
    one(259) !== 8 ||
    one(277) !== 1 ||
    one(339) !== 2
  )
    throw new GeoTiffError("FORMAT");
  const predictor = tags.get(317)?.[0] ?? 1;
  if (predictor !== 1 && predictor !== 2) throw new GeoTiffError("PREDICTOR");
  const tileWidth = one(322);
  const tileHeight = one(323);
  const offsets = tags.get(324);
  const sizes = tags.get(325);
  const across = Math.ceil(width / tileWidth);
  const down = Math.ceil(height / tileHeight);
  if (!offsets || !sizes || offsets.length !== across * down)
    throw new GeoTiffError("TILES");
  const values = new Array<number>(width * height);
  for (let t = 0; t < offsets.length; t++) {
    const data = inflateSync(b.subarray(offsets[t]!, offsets[t]! + sizes[t]!), {
      maxOutputLength: tileWidth * tileHeight * 2,
    });
    if (data.length !== tileWidth * tileHeight * 2)
      throw new GeoTiffError("TILE_SIZE");
    const col = t % across;
    const row = Math.floor(t / across);
    for (let y = 0; y < tileHeight; y++) {
      let previous = 0;
      for (let x = 0; x < tileWidth; x++) {
        let v = data.readInt16LE((y * tileWidth + x) * 2);
        if (predictor === 2) {
          v = ((v + previous + 32768) & 0xffff) - 32768;
          previous = v;
        }
        const px = col * tileWidth + x;
        const py = row * tileHeight + y;
        if (px < width && py < height) values[py * width + px] = v;
      }
    }
  }
  return { width, height, values };
}
