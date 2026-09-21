import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { FieldButton } from '@/components/field-button';
import type { MemoirLeaf } from '@/components/memoir-page';
import { Fonts } from '@/constants/theme';
import { chapterKindLabel, contentsLabel, shortDate } from '@/src/memoir-leaves';
import {
  SPEECH_RATES,
  chapterSpeechText,
  speakMemoirChapter,
  speakableLeaves,
  stopMemoirSpeech,
  type SpeechRate,
} from '@/src/memoir-speech';

type MemoirListenProps = {
  leaves: MemoirLeaf[];
  currentId?: string;
  onJump: (leafId: string) => void;
};

export function MemoirListen({ leaves, currentId, onJump }: MemoirListenProps) {
  const chapters = useMemo(() => speakableLeaves(leaves), [leaves]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<SpeechRate>(1);
  const playingRef = useRef(false);
  const indexRef = useRef(0);
  const rateRef = useRef<SpeechRate>(1);
  const chaptersRef = useRef(chapters);

  useEffect(() => {
    chaptersRef.current = chapters;
    if (chapters.length === 0) {
      stopMemoirSpeech();
      setPlaying(false);
      playingRef.current = false;
      return;
    }
    if (index >= chapters.length) setIndex(0);
  }, [chapters, index]);

  useEffect(() => {
    if (!currentId) return;
    const next = chapters.findIndex((leaf) => leaf.id === currentId);
    if (next >= 0 && next !== indexRef.current) {
      indexRef.current = next;
      setIndex(next);
    }
  }, [chapters, currentId]);

  useEffect(
    () => () => {
      playingRef.current = false;
      stopMemoirSpeech();
    },
    [],
  );

  const safeIndex = chapters.length === 0 ? 0 : Math.min(index, chapters.length - 1);
  const current = chapters[safeIndex];

  const speakAt = (nextIndex: number) => {
    const list = chaptersRef.current;
    if (list.length === 0) return;
    const clamped = Math.max(0, Math.min(list.length - 1, nextIndex));
    indexRef.current = clamped;
    setIndex(clamped);
    const leaf = list[clamped];
    onJump(leaf.id);
    playingRef.current = true;
    setPlaying(true);
    speakMemoirChapter(chapterSpeechText(leaf), {
      rate: rateRef.current,
      onDone: () => {
        if (!playingRef.current) return;
        if (indexRef.current < chaptersRef.current.length - 1) {
          speakAt(indexRef.current + 1);
          return;
        }
        playingRef.current = false;
        setPlaying(false);
      },
      onStopped: () => {
        if (!playingRef.current) setPlaying(false);
      },
    });
  };

  const togglePlay = () => {
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      stopMemoirSpeech();
      return;
    }
    speakAt(safeIndex);
  };

  const skip = (direction: -1 | 1) => {
    if (chapters.length === 0) return;
    const next = Math.max(0, Math.min(chapters.length - 1, safeIndex + direction));
    if (playingRef.current) {
      speakAt(next);
      return;
    }
    indexRef.current = next;
    setIndex(next);
    onJump(chapters[next].id);
  };

  const cycleRate = () => {
    const position = SPEECH_RATES.indexOf(rate);
    const next = SPEECH_RATES[(position + 1) % SPEECH_RATES.length];
    rateRef.current = next;
    setRate(next);
    if (playingRef.current) speakAt(indexRef.current);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.now}>
        <Text style={styles.kicker}>Now playing</Text>
        <Text style={styles.title}>{current ? contentsLabel(current) : 'Nothing to read yet'}</Text>
        <Text style={styles.meta}>
          {chapters.length === 0
            ? 'Write a page, then come back to listen.'
            : `${safeIndex + 1} / ${chapters.length} · ${current ? chapterKindLabel(current) : ''}`}
        </Text>
        <View style={styles.controls}>
          <FieldButton accessibilityLabel="Previous chapter" style={styles.icon} onPress={() => skip(-1)}>
            <MaterialIcons name="skip-previous" size={22} color="#d8b56a" />
          </FieldButton>
          <FieldButton
            accessibilityLabel={playing ? 'Pause memoir' : 'Play memoir'}
            style={[styles.icon, styles.play]}
            onPress={togglePlay}>
            <MaterialIcons name={playing ? 'pause' : 'play-arrow'} size={28} color="#3b2414" />
          </FieldButton>
          <FieldButton accessibilityLabel="Next chapter" style={styles.icon} onPress={() => skip(1)}>
            <MaterialIcons name="skip-next" size={22} color="#d8b56a" />
          </FieldButton>
          <FieldButton accessibilityLabel={`Reading speed ${rate}`} style={styles.rate} onPress={cycleRate}>
            <Text style={styles.rateLabel}>{rate}×</Text>
          </FieldButton>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {chapters.map((leaf, pageIndex) => {
          const active = pageIndex === safeIndex;
          return (
            <FieldButton
              key={leaf.id}
              accessibilityLabel={`${contentsLabel(leaf)}, chapter ${pageIndex + 1}`}
              style={[styles.row, active && styles.rowOn]}
              onPress={() => {
                if (playingRef.current) {
                  speakAt(pageIndex);
                  return;
                }
                indexRef.current = pageIndex;
                setIndex(pageIndex);
                onJump(leaf.id);
              }}>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, active && styles.rowTitleOn]}>{contentsLabel(leaf)}</Text>
                <Text style={styles.rowMeta}>
                  {chapterKindLabel(leaf)} · {leaf.kind === 'title' ? 'Cover' : shortDate(leaf.dateIso)}
                </Text>
              </View>
              {active && playing ? <MaterialIcons name="graphic-eq" size={18} color="#3b2414" /> : null}
            </FieldButton>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: 10,
  },
  now: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8a6230',
    backgroundColor: '#3a2418',
  },
  kicker: {
    color: '#c4a06a',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.serif,
    color: '#f3e4c4',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 6,
  },
  meta: {
    color: '#c4a06a',
    fontFamily: Fonts.serif,
    marginTop: 4,
    fontSize: 13,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  icon: {
    width: 44,
    height: 44,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#8a6230',
    backgroundColor: '#2c1a10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    backgroundColor: '#d8b56a',
    borderColor: '#d8b56a',
    width: 56,
    height: 56,
    minHeight: 56,
    borderRadius: 28,
  },
  rate: {
    marginLeft: 'auto',
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#8a6230',
    backgroundColor: '#2c1a10',
  },
  rateLabel: {
    color: '#d8b56a',
    fontWeight: '800',
    fontSize: 13,
  },
  list: {
    paddingBottom: 24,
    gap: 4,
  },
  row: {
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowOn: {
    backgroundColor: '#d8b56a',
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: Fonts.serif,
    color: '#f3e4c4',
    fontSize: 16,
    fontWeight: '700',
  },
  rowTitleOn: {
    color: '#3b2414',
  },
  rowMeta: {
    color: '#c4a06a',
    fontSize: 11,
    marginTop: 2,
  },
});
