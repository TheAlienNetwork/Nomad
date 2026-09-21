import { Share } from 'react-native';

export async function shareOrCopy(label: string, text: string): Promise<string> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return 'Copied coordinates';
  }
  await Share.share({ message: text, title: label });
  return 'Shared coordinates';
}
