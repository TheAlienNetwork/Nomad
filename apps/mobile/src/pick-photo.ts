import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { parseMemoryExif } from '@/src/memory-exif';
import type { PagePhotoMeta } from '@/src/page-photo';

export type PickedPhoto = {
  uri: string;
  width?: number;
  height?: number;
  fileSize?: number;
};

export type PickedMemoryPhoto = PickedPhoto & {
  latitude?: number;
  longitude?: number;
  takenAt?: string;
};

export async function pickPhotoUri(): Promise<string | null> {
  const picked = await pickPhoto();
  return picked?.uri ?? null;
}

/** Memoir/cover picks — never use allowsEditing (Android crop OOM crashes are uncatchable). */
export async function pickMemoirPhoto(): Promise<PickedPhoto | null> {
  return pickPhoto({ quality: 0.2 });
}

export async function pickMemoryPhotos(): Promise<PickedMemoryPhoto[]> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const uri = await pickOnWeb();
    return uri ? [{ uri }] : [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.42,
    exif: true,
    base64: false,
    allowsMultipleSelection: true,
    selectionLimit: 12,
  });
  if (result.canceled) return [];
  return result.assets.flatMap((asset) => {
    if (!asset.uri) return [];
    const geo = parseMemoryExif(asset.exif as Record<string, unknown> | null | undefined);
    return [
      {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
        latitude: geo.latitude,
        longitude: geo.longitude,
        takenAt: geo.takenAt,
      },
    ];
  });
}

export async function captureMemoryPhoto(): Promise<PickedMemoryPhoto | null> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const uri = await pickOnWeb();
    return uri ? { uri } : null;
  }
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Camera permission denied.');
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.5,
    exif: true,
    base64: false,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets[0]?.uri) return null;
  const asset = result.assets[0];
  const geo = parseMemoryExif(asset.exif as Record<string, unknown> | null | undefined);
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    fileSize: asset.fileSize,
    latitude: geo.latitude,
    longitude: geo.longitude,
    takenAt: geo.takenAt,
  };
}

export async function pickPhoto(options?: { quality?: number }): Promise<PickedPhoto | null> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const uri = await pickOnWeb();
    return uri ? { uri } : null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    // Android cropper can native-crash on large images — do not enable editing.
    allowsEditing: false,
    quality: options?.quality ?? 0.35,
    exif: false,
    base64: false,
    allowsMultipleSelection: false,
  });
  if (result.canceled || !result.assets[0]?.uri) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    fileSize: asset.fileSize,
  };
}

export function toPagePhotoMeta(picked: PickedPhoto): PagePhotoMeta {
  return {
    width: picked.width,
    height: picked.height,
    fileSize: picked.fileSize,
  };
}

export async function capturePhotoUri(): Promise<string | null> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return pickOnWeb();
  }
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Camera permission denied.');
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.45,
    exif: false,
    base64: false,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets[0]?.uri) return null;
  return result.assets[0].uri;
}

export async function prepareWaypointPhoto(uri: string): Promise<string> {
  // Waypoints tolerate failure better; keep a soft resize but catch and return original.
  try {
    const result = await manipulateAsync(uri, [{ resize: { width: 480 } }], {
      compress: 0.65,
      format: SaveFormat.JPEG,
    });
    if (result.uri.startsWith('data:')) return result.uri;
    try {
      const response = await fetch(result.uri);
      const blob = await response.blob();
      if (blob.size > 1_500_000) return result.uri;
      return await blobToDataUri(blob);
    } catch {
      return result.uri;
    }
  } catch {
    return uri;
  }
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Could not read that photo.'));
    reader.readAsDataURL(blob);
  });
}

function pickOnWeb(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => reject(new Error('Could not read that photo.'));
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
