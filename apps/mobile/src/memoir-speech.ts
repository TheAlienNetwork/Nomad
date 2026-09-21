import * as Speech from 'expo-speech';

import type { MemoirLeaf } from '@/components/memoir-page';
import { contentsLabel } from '@/src/memoir-leaves';

export const SPEECH_RATES = [0.75, 1, 1.25, 1.5] as const;
export type SpeechRate = (typeof SPEECH_RATES)[number];

export function chapterSpeechText(leaf: MemoirLeaf): string {
  const title = contentsLabel(leaf);
  const author = leaf.kind === 'title' && leaf.author?.trim() ? ` by ${leaf.author.trim()}` : '';
  const body = leaf.notes.trim();
  if (!body) return `${title}${author}.`;
  return `${title}${author}. ${body}`;
}

export function speakableLeaves(leaves: MemoirLeaf[]): MemoirLeaf[] {
  return leaves.filter((leaf) => contentsLabel(leaf).trim() || leaf.notes.trim());
}

type SpeakOptions = {
  rate: number;
  onDone: () => void;
  onStopped?: () => void;
};

export function speakMemoirChapter(text: string, options: SpeakOptions): void {
  const trimmed = text.trim();
  if (!trimmed) {
    options.onDone();
    return;
  }
  stopMemoirSpeech();
  Speech.speak(trimmed, {
    rate: options.rate,
    pitch: 0.96,
    onDone: options.onDone,
    onStopped: options.onStopped,
    onError: options.onDone,
  });
}

export function stopMemoirSpeech(): void {
  Speech.stop();
}
