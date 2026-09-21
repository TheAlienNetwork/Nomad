import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

export async function saveJpegToCameraRoll(uri: string): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Save to camera roll is on the phone.');
  }
  // Write-only — do not request READ_MEDIA_* broad photo access.
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) {
    throw new Error('Camera roll permission denied.');
  }
  const file = await asLocalFile(uri);
  await MediaLibrary.saveToLibraryAsync(file.uri);
}

async function asLocalFile(uri: string): Promise<{ uri: string }> {
  if (uri.startsWith('file:') || uri.startsWith('content:')) {
    return { uri };
  }
  const target = new File(Paths.cache, 'nomad-sketch.jpg');
  if (target.exists) target.delete();
  if (uri.startsWith('data:')) {
    const comma = uri.indexOf(',');
    const payload = comma >= 0 ? uri.slice(comma + 1) : uri;
    target.create();
    target.write(payload, { encoding: 'base64' });
    return target;
  }
  const downloaded = await File.downloadFileAsync(uri, target, { idempotent: true });
  return { uri: downloaded.uri };
}
