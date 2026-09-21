import { Directory, File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import { preparePagePhoto, shrinkForSketch } from './page-photo';
import { encodePngRgba } from './sketch-png';

/** Parchment — matches memoir page paper. */
const PAPER = [241, 226, 192] as const;
/** Walnut graphite. */
const INK = [42, 28, 16] as const;
const WEB_EDGE = 360;
/** Working edge after a tiny on-disk JPEG — higher = more “drawn,” still OOM-safe. */
const SKETCH_EDGE = 176;
/** Android sketch only if we already have a modest on-disk JPEG. */
const ANDROID_SKETCH_MAX_BYTES = 400_000;

type PixelFrame = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export { preparePagePhoto, prepareSketchSource } from './page-photo';

export function friendlySketchError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/maxMemoryUsageInMB|memory usage|too large|heap|OutOfMemory|OOM/i.test(message)) {
    return new Error('That photo is too large to sketch on this phone. Try a tighter crop.');
  }
  if (/Buffer|Property '/i.test(message)) {
    return new Error('Could not sketch that photo. Try another image.');
  }
  if (/heic|heif|png|jpeg from the camera roll/i.test(message)) {
    return new Error('Could not turn that photo into a sketch. Try another image from the camera roll.');
  }
  if (error instanceof Error && error.message.trim() && !/at |Exception/i.test(error.message)) {
    return error;
  }
  return new Error('Could not sketch that photo.');
}

/**
 * Convert a placed photo into parchment graphite.
 * Prefer calling after preparePagePhoto / shrinkForSketch so Android never decodes a roll original.
 */
export async function photoToPencilSketch(uri: string): Promise<string> {
  try {
    let source = uri;
    if (Platform.OS === 'android') {
      let size = probeSize(source);
      if (size <= 0 || size > ANDROID_SKETCH_MAX_BYTES) {
        const shrunk = await shrinkForSketch(source);
        if (!shrunk) {
          throw new Error(
            'Sketch needs a smaller placed photo on this phone. Place the photo, or pick a tighter crop.',
          );
        }
        source = shrunk;
        size = probeSize(source);
        if (size <= 0 || size > ANDROID_SKETCH_MAX_BYTES) {
          throw new Error('That photo is still too large to sketch on this phone.');
        }
      }
    } else {
      source = await preparePagePhoto(uri);
    }
    if (typeof document !== 'undefined') {
      const frame = await loadWithCanvas(source);
      drawGraphite(frame.data, frame.width, frame.height);
      return encodeCanvas(frame);
    }
    return await nativePencilSketch(source);
  } catch (error) {
    throw friendlySketchError(error);
  }
}

async function nativePencilSketch(uri: string): Promise<string> {
  let source = uri;
  try {
    const shrunk = await manipulateAsync(uri, [{ resize: { width: SKETCH_EDGE } }], {
      compress: 0.52,
      format: SaveFormat.JPEG,
    });
    source = shrunk.uri;
  } catch {
    if (Platform.OS === 'android') {
      throw new Error('Could not shrink that photo enough to sketch on this phone.');
    }
    source = uri;
  }

  // Deferred load — static jpeg-js import keeps a large module resident while placing photos.
  // Documented exception to the no-inline-import rule for Android OOM isolation.
  const jpegJs = (await import('jpeg-js')).default;
  const jpegBytes = await readBytes(source);
  if (jpegBytes.byteLength > ANDROID_SKETCH_MAX_BYTES && Platform.OS === 'android') {
    throw new Error('That photo is still too large to sketch on this phone.');
  }
  const decoded = jpegJs.decode(jpegBytes, {
    useTArray: true,
    formatAsRGBA: true,
    maxResolutionInMP: 0.08,
    maxMemoryUsageInMB: 6,
  });
  const width = decoded.width;
  const height = decoded.height;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('Could not read that photo.');
  }
  const pixels =
    decoded.data instanceof Uint8ClampedArray
      ? decoded.data
      : new Uint8ClampedArray(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength);
  drawGraphite(pixels, width, height);
  const png = encodePngRgba(pixels, width, height);
  return writeSketchPng(png);
}

function probeSize(uri: string): number {
  try {
    const file = new File(uri);
    return typeof file.size === 'number' ? file.size : 0;
  } catch {
    return 0;
  }
}

async function readBytes(uri: string): Promise<Uint8Array> {
  try {
    return await new File(uri).bytes();
  } catch {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Could not read that photo.');
    return new Uint8Array(await response.arrayBuffer());
  }
}

function writeSketchPng(bytes: Uint8Array): string {
  const dir = sketchDir();
  const file = new File(dir, `sketch-${Date.now()}.png`);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  return file.uri;
}

function sketchDir(): Directory {
  const dir = new Directory(Paths.document, 'memoir-sketches');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

async function loadWithCanvas(uri: string): Promise<PixelFrame> {
  const image = await loadImage(uri);
  const scale = Math.min(1, WEB_EDGE / Math.max(image.width, image.height));
  const width = Math.max(64, Math.round(image.width * scale));
  const height = Math.max(64, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Pencil sketch unavailable in this browser.');
  ctx.drawImage(image, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height);
  return { data: pixels.data, width, height };
}

function encodeCanvas(frame: PixelFrame): string {
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Pencil sketch unavailable in this browser.');
  const imageData = ctx.createImageData(frame.width, frame.height);
  imageData.data.set(frame.data);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = document.createElement('img');
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read that photo.'));
    image.src = uri;
  });
}

/**
 * Color dodge + edge emphasis + paper grain so wildlife photos read as
 * hand graphite on parchment rather than a flat Instagram filter.
 */
function drawGraphite(data: Uint8ClampedArray, width: number, height: number): void {
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = Math.round((data[i] ?? 0) * 0.299 + (data[i + 1] ?? 0) * 0.587 + (data[i + 2] ?? 0) * 0.114);
  }
  const softBlur = boxBlur(gray, width, height, 2);
  const wideBlur = boxBlur(gray, width, height, 4);

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const tone = gray[p] ?? 0;
    const soft = softBlur[p] ?? tone;
    const wide = wideBlur[p] ?? soft;
    const dodge = Math.min(255, (tone * 255) / (soft + 1));
    const localEdge = Math.abs(tone - soft) * 2.35;
    const formEdge = Math.abs(tone - wide) * 0.85;
    const edges = Math.max(255 - dodge, localEdge + formEdge);

    // Open / bright areas stay closer to paper (sky, bokeh); subjects hold ink.
    const paperBias = Math.max(0, (tone - 168) / 87);
    let t = Math.min(1, edges / 118);
    t = t * t * (3 - 2 * t);
    let amount = Math.min(1, t * 1.38) * (1 - paperBias * 0.72);

    // Subtle grain so it doesn’t look digital-flat.
    const gx = p % width;
    const gy = (p / width) | 0;
    const noise = Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453;
    const grain = (noise - Math.floor(noise)) * 0.07 - 0.035;
    amount = Math.min(1, Math.max(0, amount + grain));

    // Slight midtone lift into walnut for fur/body mass.
    const mid = 1 - Math.abs(tone - 110) / 110;
    amount = Math.min(1, amount + Math.max(0, mid) * 0.08 * (1 - paperBias));

    data[i] = Math.round(PAPER[0] + (INK[0] - PAPER[0]) * amount);
    data[i + 1] = Math.round(PAPER[1] + (INK[1] - PAPER[1]) * amount);
    data[i + 2] = Math.round(PAPER[2] + (INK[2] - PAPER[2]) * amount);
    data[i + 3] = 255;
  }
}

function boxBlur(source: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
  const temp = new Uint32Array(source.length);
  const out = new Uint8ClampedArray(source.length);
  const span = radius * 2 + 1;
  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    for (let k = -radius; k <= radius; k += 1) {
      sum += source[y * width + clamp(k, 0, width - 1)] ?? 0;
    }
    for (let x = 0; x < width; x += 1) {
      temp[y * width + x] = sum;
      const leave = source[y * width + clamp(x - radius, 0, width - 1)] ?? 0;
      const enter = source[y * width + clamp(x + radius + 1, 0, width - 1)] ?? 0;
      sum += enter - leave;
    }
  }
  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let k = -radius; k <= radius; k += 1) {
      sum += temp[clamp(k, 0, height - 1) * width + x] ?? 0;
    }
    for (let y = 0; y < height; y += 1) {
      out[y * width + x] = Math.round(sum / (span * span));
      const leave = temp[clamp(y - radius, 0, height - 1) * width + x] ?? 0;
      const enter = temp[clamp(y + radius + 1, 0, height - 1) * width + x] ?? 0;
      sum += enter - leave;
    }
  }
  return out;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
