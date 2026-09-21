import { Directory, File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { InteractionManager, Platform } from 'react-native';

/** Only used on iOS / small assets — Android must not full-decode via ImageManipulator. */
const IOS_PLACE_ATTEMPTS: Array<{ width: number; compress: number }> = [
  { width: 360, compress: 0.55 },
  { width: 240, compress: 0.48 },
];

const ANDROID_PLACE_ATTEMPTS: Array<{ width: number; compress: number }> = [
  { width: 260, compress: 0.4 },
  { width: 200, compress: 0.36 },
];

/** Above this many pixels, skip ImageManipulator even on iOS. */
const MANIP_PIXEL_CAP = 1_400_000;

/** Android may shrink when picker meta says the asset is already modest. */
const ANDROID_SAFE_BYTES = 1_500_000;
const ANDROID_SAFE_PIXELS = 3_000_000;

/** Above this many bytes, never load the whole file into JS. */
const JS_COPY_BYTE_CAP = 2_000_000;

/** Shrink for graphite when the on-disk file is under this (post-place path). */
const ANDROID_SHRINK_MAX_BYTES = 1_500_000;

export type PagePhotoMeta = {
  width?: number;
  height?: number;
  fileSize?: number;
};

export function friendlyPagePhotoError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/maxMemoryUsageInMB|memory usage|too large|heap|OutOfMemory|OOM/i.test(message)) {
    return new Error('That photo is too large for this phone. Try a smaller crop or another shot.');
  }
  if (/heic|heif|png|jpeg|manipulat|decode|read that photo/i.test(message)) {
    return new Error('Could not place that photo. Try another image from the camera roll.');
  }
  if (error instanceof Error && error.message.trim() && !/at |Exception/i.test(error.message)) {
    return error;
  }
  return new Error('Could not place that photo.');
}

/**
 * Place a memoir/cover photo without killing Android.
 * Android only uses ImageManipulator when picker meta proves the asset is modest.
 */
export async function preparePagePhoto(uri: string, meta: PagePhotoMeta = {}): Promise<string> {
  if (Platform.OS === 'web') return uri;
  await settleAfterPicker();

  const pixels =
    typeof meta.width === 'number' && typeof meta.height === 'number'
      ? meta.width * meta.height
      : 0;
  const size = typeof meta.fileSize === 'number' ? meta.fileSize : 0;

  if (Platform.OS === 'android') {
    const metaSafe =
      (size > 0 && size <= ANDROID_SAFE_BYTES) || (pixels > 0 && pixels <= ANDROID_SAFE_PIXELS);
    if (metaSafe && pixels <= MANIP_PIXEL_CAP) {
      let lastError: unknown;
      for (const attempt of ANDROID_PLACE_ATTEMPTS) {
        try {
          const result = await manipulateAsync(uri, [{ resize: { width: attempt.width } }], {
            compress: attempt.compress,
            format: SaveFormat.JPEG,
          });
          return persistPagePhoto(result.uri, undefined);
        } catch (error) {
          lastError = error;
        }
      }
      if (lastError) {
        // Fall through to persist without resize.
      }
    }
    return persistPagePhoto(uri, meta.fileSize);
  }

  if (pixels > MANIP_PIXEL_CAP) {
    return persistPagePhoto(uri, meta.fileSize);
  }

  let lastError: unknown;
  for (const attempt of IOS_PLACE_ATTEMPTS) {
    try {
      const result = await manipulateAsync(uri, [{ resize: { width: attempt.width } }], {
        compress: attempt.compress,
        format: SaveFormat.JPEG,
      });
      return persistPagePhoto(result.uri, undefined);
    } catch (error) {
      lastError = error;
    }
  }
  try {
    return await persistPagePhoto(uri, meta.fileSize);
  } catch (error) {
    throw friendlyPagePhotoError(lastError ?? error);
  }
}

/** @deprecated Prefer preparePagePhoto */
export async function prepareSketchSource(uri: string): Promise<string> {
  return preparePagePhoto(uri);
}

/**
 * Bounded shrink for graphite. Returns null when the file is too large/unknown
 * to risk ImageManipulator on Android (native OOM is uncatchable).
 */
export async function shrinkForSketch(uri: string): Promise<string | null> {
  if (Platform.OS === 'web') return uri;
  await settleAfterPicker();
  const size = probeSize(uri);
  if (size <= 0 || size > ANDROID_SHRINK_MAX_BYTES) return null;
  try {
    const result = await manipulateAsync(uri, [{ resize: { width: 280 } }], {
      compress: 0.42,
      format: SaveFormat.JPEG,
    });
    return persistPagePhoto(result.uri, undefined);
  } catch {
    return null;
  }
}

function settleAfterPicker(): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, Platform.OS === 'android' ? 180 : 0);
    });
  });
}

async function persistPagePhoto(uri: string, knownSize?: number): Promise<string> {
  const dir = pagePhotoDir();
  const ext = extensionFor(uri);
  const dest = new File(dir, `photo-${Date.now()}.${ext}`);
  if (dest.exists) dest.delete();

  try {
    new File(uri).copy(dest);
    return dest.uri;
  } catch {
    // content:// and some picker URIs cannot copy — avoid reading huge blobs into JS.
    const size = knownSize ?? probeSize(uri);
    if (size > JS_COPY_BYTE_CAP) {
      return uri;
    }
    try {
      const response = await fetch(uri);
      if (!response.ok) return uri;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > JS_COPY_BYTE_CAP) return uri;
      dest.create();
      dest.write(bytes);
      return dest.uri;
    } catch {
      return uri;
    }
  }
}

function probeSize(uri: string): number {
  try {
    const file = new File(uri);
    return typeof file.size === 'number' ? file.size : 0;
  } catch {
    return 0;
  }
}

function extensionFor(uri: string): string {
  const clean = uri.split('?')[0]?.toLowerCase() ?? '';
  if (clean.endsWith('.png')) return 'png';
  if (clean.endsWith('.webp')) return 'webp';
  if (clean.endsWith('.heic') || clean.endsWith('.heif')) return 'heic';
  return 'jpg';
}

function pagePhotoDir(): Directory {
  const dir = new Directory(Paths.document, 'memoir-sketches');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}
