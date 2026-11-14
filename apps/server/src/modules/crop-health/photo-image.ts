import { CropHealthError } from "./crop-health-error.js";

// Checks that a farmer's photo is the format it claims, within the Claude API
// limits (at most 8000 px a side; accuracy drops under 200 px), and removes
// metadata before it leaves the server: phone photos carry GPS position,
// device and time in EXIF/XMP/IPTC blocks and text chunks. Pixels are never
// decoded or changed. Limits: Claude vision documentation, read 2026-11-03.
export const PHOTO_MAX_EDGE_PX = 8000;
export const PHOTO_MIN_EDGE_PX = 200;
export type PhotoMediaType = "image/jpeg" | "image/png" | "image/webp";
export type CleanPhoto = {
  mediaType: PhotoMediaType;
  base64: string;
  width: number;
  height: number;
  removedBytes: number;
};
const invalid = () => new CropHealthError("PHOTO_INVALID");

function cleanJpeg(b: Buffer) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) throw invalid();
  const kept: Buffer[] = [b.subarray(0, 2)];
  let width = 0,
    height = 0,
    i = 2;
  for (;;) {
    if (b[i] !== 0xff) throw invalid();
    let k = i;
    while (b[k] === 0xff) k++;
    const marker = b[k];
    if (marker === undefined || marker === 0xd9) throw invalid();
    // Markers without a length: TEM and the restart markers.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(Buffer.from([0xff, marker]));
      i = k + 1;
      continue;
    }
    if (k + 3 > b.length) throw invalid();
    const length = b.readUInt16BE(k + 1);
    const end = k + 1 + length;
    if (length < 2 || end > b.length) throw invalid();
    if (marker === 0xda) {
      // Start of scan: the compressed image follows; keep the rest as is.
      kept.push(Buffer.from([0xff]), b.subarray(k));
      break;
    }
    const frame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (frame) {
      if (length < 7) throw invalid();
      height = b.readUInt16BE(k + 4);
      width = b.readUInt16BE(k + 6);
    }
    // Dropped: APP1 (EXIF, XMP), APP3-APP13 (including IPTC), APP15 and
    // comments. Kept: APP0 (JFIF), APP2 (colour profile), APP14 (Adobe colour).
    const metadata =
      marker === 0xe1 ||
      (marker >= 0xe3 && marker <= 0xed) ||
      marker === 0xef ||
      marker === 0xfe;
    if (!metadata) kept.push(Buffer.from([0xff]), b.subarray(k, end));
    i = end;
  }
  return { bytes: Buffer.concat(kept), width, height };
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const PNG_METADATA = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
function cleanPng(b: Buffer) {
  if (b.length < 8 || !b.subarray(0, 8).equals(PNG_SIGNATURE)) throw invalid();
  const kept: Buffer[] = [PNG_SIGNATURE];
  let width = 0,
    height = 0,
    i = 8,
    ended = false;
  while (i < b.length) {
    if (i + 12 > b.length) throw invalid();
    const length = b.readUInt32BE(i);
    const type = b.toString("latin1", i + 4, i + 8);
    const end = i + 12 + length;
    if (end > b.length) throw invalid();
    if (i === 8) {
      if (type !== "IHDR" || length < 8) throw invalid();
      width = b.readUInt32BE(i + 8);
      height = b.readUInt32BE(i + 12);
    }
    if (!PNG_METADATA.has(type)) kept.push(b.subarray(i, end));
    i = end;
    if (type === "IEND") {
      ended = true;
      break;
    }
  }
  if (!ended) throw invalid();
  return { bytes: Buffer.concat(kept), width, height };
}

function cleanWebp(b: Buffer) {
  if (
    b.length < 20 ||
    b.toString("latin1", 0, 4) !== "RIFF" ||
    b.toString("latin1", 8, 12) !== "WEBP"
  )
    throw invalid();
  const riffEnd = 8 + b.readUInt32LE(4);
  if (riffEnd > b.length) throw invalid();
  const kept: Buffer[] = [];
  let canvas: { width: number; height: number } | null = null;
  let frame: { width: number; height: number } | null = null;
  let i = 12;
  while (i < riffEnd) {
    if (i + 8 > riffEnd) throw invalid();
    const type = b.toString("latin1", i, i + 4);
    const size = b.readUInt32LE(i + 4);
    const end = i + 8 + size + (size % 2);
    if (i + 8 + size > riffEnd) throw invalid();
    const data = b.subarray(i + 8, i + 8 + size);
    if (type === "VP8X") {
      if (size < 10) throw invalid();
      canvas = {
        width: data.readUIntLE(4, 3) + 1,
        height: data.readUIntLE(7, 3) + 1,
      };
      // Clear the EXIF (0x08) and XMP (0x04) flags; those chunks are dropped.
      const chunk = Buffer.from(b.subarray(i, Math.min(end, riffEnd)));
      chunk[8] = chunk[8]! & ~0x0c;
      kept.push(chunk);
    } else if (type === "EXIF" || type === "XMP ") {
      // Dropped.
    } else {
      if (type === "VP8 " && !frame) {
        if (
          size < 10 ||
          data[3] !== 0x9d ||
          data[4] !== 0x01 ||
          data[5] !== 0x2a
        )
          throw invalid();
        frame = {
          width: data.readUInt16LE(6) & 0x3fff,
          height: data.readUInt16LE(8) & 0x3fff,
        };
      } else if (type === "VP8L" && !frame) {
        if (size < 5 || data[0] !== 0x2f) throw invalid();
        const bits = data.readUInt32LE(1);
        frame = {
          width: (bits & 0x3fff) + 1,
          height: ((bits >>> 14) & 0x3fff) + 1,
        };
      }
      kept.push(b.subarray(i, Math.min(end, riffEnd)));
    }
    i = end;
  }
  const size = canvas ?? frame;
  if (!size) throw invalid();
  const body = Buffer.concat(kept);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "latin1");
  header.writeUInt32LE(4 + body.length, 4);
  header.write("WEBP", 8, "latin1");
  return { bytes: Buffer.concat([header, body]), ...size };
}

export function cleanPhoto(
  mediaType: PhotoMediaType,
  base64: string,
): CleanPhoto {
  const input = Buffer.from(base64, "base64");
  const cleaned =
    mediaType === "image/jpeg"
      ? cleanJpeg(input)
      : mediaType === "image/png"
        ? cleanPng(input)
        : cleanWebp(input);
  const { width, height } = cleaned;
  if (!width || !height) throw invalid();
  if (width > PHOTO_MAX_EDGE_PX || height > PHOTO_MAX_EDGE_PX)
    throw new CropHealthError("PHOTO_TOO_LARGE");
  if (Math.min(width, height) < PHOTO_MIN_EDGE_PX)
    throw new CropHealthError("PHOTO_TOO_SMALL");
  return {
    mediaType,
    base64: cleaned.bytes.toString("base64"),
    width,
    height,
    removedBytes: input.length - cleaned.bytes.length,
  };
}
