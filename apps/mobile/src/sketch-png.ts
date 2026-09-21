/** Uncompressed RGBA PNG — no Buffer, no zlib native. */

const PNG_SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = makeCrcTable();

export function encodePngRgba(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const stride = width * 4 + 1;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), row + 1);
  }
  const ihdr = new Uint8Array(13);
  writeU32(ihdr, 0, width);
  writeU32(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return concat([PNG_SIG, chunk('IHDR', ihdr), chunk('IDAT', zlibStore(raw)), chunk('IEND', new Uint8Array(0))]);
}

function zlibStore(data: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  let offset = 0;
  while (offset < data.length) {
    const remaining = data.length - offset;
    const len = Math.min(65535, remaining);
    const last = offset + len >= data.length;
    const header = new Uint8Array(5);
    header[0] = last ? 1 : 0;
    header[1] = len & 255;
    header[2] = (len >> 8) & 255;
    const nlen = 65535 - len;
    header[3] = nlen & 255;
    header[4] = (nlen >> 8) & 255;
    blocks.push(header, data.subarray(offset, offset + len));
    offset += len;
  }
  const adler = adler32(data);
  const trailer = new Uint8Array(4);
  writeU32(trailer, 0, adler);
  blocks.push(trailer);
  return concat(blocks);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = new Uint8Array(4 + data.length);
  body[0] = type.charCodeAt(0);
  body[1] = type.charCodeAt(1);
  body[2] = type.charCodeAt(2);
  body[3] = type.charCodeAt(3);
  body.set(data, 4);
  const out = new Uint8Array(12 + data.length);
  writeU32(out, 0, data.length);
  out.set(body, 4);
  writeU32(out, 8 + data.length, crc32(body));
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function writeU32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 24) & 255;
  target[offset + 1] = (value >>> 16) & 255;
  target[offset + 2] = (value >>> 8) & 255;
  target[offset + 3] = value & 255;
}

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ (bytes[i] ?? 0)) & 255]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    a += bytes[i] ?? 0;
    if (a >= 65521) a -= 65521;
    b += a;
    if (b >= 65521) b -= 65521;
  }
  return ((b << 16) | a) >>> 0;
}
