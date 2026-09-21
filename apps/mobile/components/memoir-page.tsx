import {
  SPECIES_LABELS,
  buildHuntTimeline,
  formatDistance,
  type HuntSession,
  type SpeciesId,
  type Waypoint,
} from '@huntos/core';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CoverMark, DEFAULT_COVER_FRAME, type CoverFrame } from '@/components/cover-mark';
import { FieldButton } from '@/components/field-button';
import { PageSketchLayer } from '@/components/page-sketch';
import { Fonts } from '@/constants/theme';
import { INK_COLORS, PAGE_FONTS, noteFontSize } from '@/src/journal';
import type { InkColor, JournalStyle, NoteScale, PageFont, PageSketch } from '@/src/store';

export type MemoirLeafKind = 'hunt' | 'note' | 'plan' | 'title';

export type MemoirLeaf = {
  kind: MemoirLeafKind;
  id: string;
  dateIso: string;
  title: string;
  notes: string;
  author?: string;
  coverUri?: string;
  coverSketch?: boolean;
  coverX?: number;
  coverY?: number;
  coverWidth?: number;
  coverHeight?: number;
  session?: HuntSession;
  waypoints?: Waypoint[];
  species?: SpeciesId;
  inkColor?: InkColor;
  fontFamily?: PageFont;
  typeScale?: NoteScale;
};

type MemoirPageProps = {
  leaf: MemoirLeaf;
  journalStyle: JournalStyle;
  fieldRuled?: boolean;
  sketches: PageSketch[];
  selectedSketchId: string | null;
  onTitleChange?: (title: string) => void;
  onAuthorChange?: (author: string) => void;
  onNotesChange: (notes: string) => void;
  onCoverChange?: () => void;
  onCoverClear?: () => void;
  onCoverSketch?: () => void;
  onCoverLayout?: (frame: CoverFrame) => void;
  onCoverSelectChange?: (selected: boolean) => void;
  coverSelected?: boolean;
  onSelectSketch: (id: string | null) => void;
  onChangeSketch: (
    id: string,
    patch: Partial<Pick<PageSketch, 'x' | 'y' | 'width' | 'height' | 'rotate'>>,
  ) => void;
  onRemoveSketch: (id: string) => void;
  paperTheme?: 'paper' | 'night';
};

function pageDate(iso: string): string {
  const date = new Date(iso);
  const day = date.getDate();
  const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
  return `${day} ${month} ${date.getFullYear()}`;
}

function nightReadable(color: string): string {
  switch (color) {
    case '#3b2414':
    case '#16120e':
    case '#5c574e':
    case '#6b4a2a':
      return '#e8d5b0';
    default:
      return color;
  }
}

export function MemoirPage({
  leaf,
  journalStyle,
  fieldRuled = true,
  sketches,
  selectedSketchId,
  onTitleChange,
  onAuthorChange,
  onNotesChange,
  onCoverChange,
  onCoverClear,
  onCoverSketch,
  onCoverLayout,
  onCoverSelectChange,
  coverSelected: coverSelectedProp,
  onSelectSketch,
  onChangeSketch,
  onRemoveSketch,
  paperTheme = 'paper',
}: MemoirPageProps) {
  const timeline =
    journalStyle === 'field' && leaf.session
      ? buildHuntTimeline(leaf.session, leaf.waypoints ?? [])
      : [];
  const distance =
    leaf.session?.distanceMeters != null && leaf.session.distanceMeters > 0
      ? formatDistance(leaf.session.distanceMeters)
      : null;
  const ink = INK_COLORS[leaf.inkColor ?? 'walnut'];
  const font = PAGE_FONTS[leaf.fontFamily ?? 'serif'];
  const scale = noteFontSize(leaf.typeScale, journalStyle === 'memoir');
  const memoir = journalStyle === 'memoir';
  const night = paperTheme === 'night';
  const inkOnPaper = night ? nightReadable(ink) : ink;
  const pageTone = [styles.page, memoir ? styles.pageMemoir : styles.pageField, night && styles.pageNight];
  const lockPage = Boolean(selectedSketchId);
  const [coverSelectedLocal, setCoverSelectedLocal] = useState(false);
  const coverSelected = coverSelectedProp ?? coverSelectedLocal;
  const setCoverSelected = (next: boolean) => {
    setCoverSelectedLocal(next);
    onCoverSelectChange?.(next);
  };
  const [pageHeight, setPageHeight] = useState(1);
  const coverFrame: CoverFrame = {
    x: leaf.coverX ?? DEFAULT_COVER_FRAME.x,
    y: leaf.coverY ?? DEFAULT_COVER_FRAME.y,
    width: leaf.coverWidth ?? DEFAULT_COVER_FRAME.width,
    height: leaf.coverHeight ?? DEFAULT_COVER_FRAME.height,
  };

  useEffect(() => {
    if (typeof coverSelectedProp === 'boolean') setCoverSelectedLocal(coverSelectedProp);
  }, [coverSelectedProp]);

  if (leaf.kind === 'title') {
    return (
      <KeyboardAvoidingView
        style={pageTone}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}>
        <View style={styles.foxing} pointerEvents="none" />
        <View style={styles.foxingSoft} pointerEvents="none" />
        {leaf.coverUri ? (
          <CoverMark
            uri={leaf.coverUri}
            framed={!leaf.coverSketch}
            frame={coverFrame}
            selected={coverSelected}
            onSelect={() => setCoverSelected(true)}
            onChange={(next) => {
              setCoverSelected(true);
              onCoverLayout?.(next);
            }}
          />
        ) : null}
        <ScrollView
          contentContainerStyle={styles.titleBody}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={() => setCoverSelected(false)}>
          {leaf.coverUri ? (
            <View style={{ height: Math.round((coverFrame.height / 100) * pageHeight) }} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add cover photo"
              style={styles.coverEmpty}
              onPress={() => onCoverChange?.()}>
              <Text style={[styles.coverHint, { fontFamily: font }]}>Tap to add a cover photo</Text>
            </Pressable>
          )}
          {leaf.coverUri ? (
            <View style={styles.coverActions}>
              {onCoverSketch ? (
                <FieldButton
                  accessibilityLabel={leaf.coverSketch ? 'Use original photo' : 'Draw cover as a sketch'}
                  style={styles.coverGhost}
                  onPress={onCoverSketch}>
                  <Text style={styles.coverGhostLabel}>
                    {leaf.coverSketch ? 'Use photo' : 'Draw as sketch'}
                  </Text>
                </FieldButton>
              ) : null}
              {onCoverClear ? (
                <FieldButton
                  accessibilityLabel="Remove cover photo"
                  style={styles.coverGhost}
                  onPress={onCoverClear}>
                  <Text style={styles.coverGhostLabel}>Remove photo</Text>
                </FieldButton>
              ) : null}
            </View>
          ) : null}

          <Text style={[styles.fieldLabel, { fontFamily: font }]}>Title</Text>
          <TextInput
            value={leaf.title}
            onChangeText={onTitleChange}
            placeholder="A season afield"
            placeholderTextColor="#8a7460"
            style={[styles.coverTitle, { color: inkOnPaper, fontFamily: font }]}
            pointerEvents={coverSelected ? 'none' : 'auto'}
          />

          <Text style={[styles.fieldLabel, { fontFamily: font }]}>by</Text>
          <TextInput
            value={leaf.author ?? ''}
            onChangeText={onAuthorChange}
            placeholder="Your name"
            placeholderTextColor="#8a7460"
            style={[styles.coverBy, { color: inkOnPaper, fontFamily: font }]}
          />

          <Text style={[styles.fieldLabel, { fontFamily: font }]}>Season or place</Text>
          <TextInput
            value={leaf.notes}
            onChangeText={onNotesChange}
            placeholder="East Texas · 2026"
            placeholderTextColor="#8a7460"
            multiline
            style={[styles.coverSubtitle, { color: inkOnPaper, fontFamily: font }]}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={pageTone}>
      <View style={styles.foxing} pointerEvents="none" />
      {memoir ? <View style={styles.foxingSoft} pointerEvents="none" /> : null}
      {memoir || !fieldRuled ? null : <View style={styles.marginRule} pointerEvents="none" />}
      <View style={[styles.body, memoir && styles.bodyMemoir]} pointerEvents="box-none">
        <View style={styles.dateRule}>
          <Text style={[styles.date, memoir && styles.dateMemoir, { fontFamily: font }]}>
            {pageDate(leaf.dateIso)}
          </Text>
          <View style={[styles.hairline, memoir && styles.hairlineMemoir]} />
        </View>
        {onTitleChange ? (
          <TextInput
            value={leaf.title}
            onChangeText={onTitleChange}
            placeholder={memoir ? 'Chapter title' : 'Title this page'}
            placeholderTextColor="#8a7460"
            style={[styles.titleInput, memoir && styles.chapterTitle, { color: inkOnPaper, fontFamily: font }]}
            pointerEvents={lockPage ? 'none' : 'auto'}
          />
        ) : (
          <Text style={[styles.area, memoir && styles.chapterTitle, { color: inkOnPaper, fontFamily: font }]}>
            {leaf.title}
          </Text>
        )}
        {leaf.kind === 'plan' ? (
          <Text style={styles.meta}>
            Upcoming sit
            {leaf.species ? ` · ${SPECIES_LABELS[leaf.species]}` : ''}
          </Text>
        ) : null}
        {distance && journalStyle === 'field' ? (
          <Text style={styles.meta}>Track · {distance}</Text>
        ) : null}
        {memoir ? null : (
          <Text style={[styles.section, { color: inkOnPaper, fontFamily: font }]}>
            {leaf.kind === 'plan' ? 'Before the sit' : 'Field notes'}
          </Text>
        )}
        <View style={[styles.notesWell, memoir && styles.notesWellMemoir]} pointerEvents={lockPage ? 'none' : 'box-none'}>
          {memoir || !fieldRuled ? null : (
            <View style={styles.noteLines} pointerEvents="none">
              {Array.from({ length: 20 }, (_, index) => (
                <View key={index} style={[styles.rule, { top: index * LINE + BASELINE }]} />
              ))}
            </View>
          )}
          <TextInput
            value={leaf.notes}
            onChangeText={onNotesChange}
            placeholder={
              memoir
                ? 'Write the hunt as you remember it.'
                : leaf.kind === 'plan'
                  ? 'Write the plan. The diary fills in after the hunt runs.'
                  : 'Write what you saw. These notes stay observed and private.'
            }
            placeholderTextColor="#8a7460"
            multiline
            textAlignVertical="top"
            style={[
              styles.notes,
              memoir && styles.notesMemoir,
              { color: inkOnPaper, fontFamily: font, fontSize: scale, lineHeight: scale + 12 },
            ]}
            pointerEvents={lockPage ? 'none' : 'auto'}
          />
        </View>
        {journalStyle === 'field' && leaf.kind === 'hunt' ? (
          <>
            <Text style={styles.section}>Hunt timeline</Text>
            {timeline.map((event) => (
              <Text key={`${event.at}-${event.label}`} style={styles.timeline}>
                {event.label}
              </Text>
            ))}
          </>
        ) : null}
      </View>
      <PageSketchLayer
        sketches={sketches}
        selectedId={selectedSketchId}
        onSelect={onSelectSketch}
        onChange={onChangeSketch}
        onRemove={onRemoveSketch}
      />
    </View>
  );
}

const LINE = 28;
const BASELINE = 22;

const styles = StyleSheet.create({
  page: {
    flex: 1,
    overflow: 'hidden',
    borderTopRightRadius: 3,
    borderBottomRightRadius: 2,
  },
  pageMemoir: {
    backgroundColor: '#f0e0b8',
  },
  pageField: {
    backgroundColor: '#f2ebd8',
  },
  pageNight: {
    backgroundColor: '#1a140e',
  },
  foxing: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    borderWidth: 12,
    borderColor: 'rgba(140, 96, 52, 0.05)',
    zIndex: 0,
  },
  foxingSoft: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 28,
    borderColor: 'rgba(166, 112, 62, 0.035)',
    zIndex: 0,
  },
  marginRule: {
    position: 'absolute',
    left: 30,
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: '#b83d34',
    opacity: 0.55,
    zIndex: 3,
  },
  notesWell: {
    position: 'relative',
    minHeight: 176,
    marginTop: 6,
  },
  notesWellMemoir: {
    minHeight: 360,
    marginTop: 14,
  },
  noteLines: {
    ...StyleSheet.absoluteFillObject,
  },
  rule: {
    position: 'absolute',
    left: -42,
    right: -18,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#7f93a8',
    opacity: 0.34,
  },
  body: {
    flex: 1,
    zIndex: 4,
    paddingLeft: 42,
    paddingRight: 18,
    paddingTop: 22,
    paddingBottom: 28,
    gap: 6,
  },
  bodyMemoir: {
    paddingLeft: 36,
    paddingRight: 24,
    paddingTop: 28,
    gap: 8,
  },
  dateRule: {
    marginBottom: 10,
  },
  date: {
    fontFamily: Fonts.serif,
    color: '#8a7460',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.2,
  },
  dateMemoir: {
    letterSpacing: 1.8,
    fontSize: 10,
    color: '#9a8068',
  },
  hairline: {
    marginTop: 8,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(90, 51, 32, 0.28)',
  },
  hairlineMemoir: {
    marginTop: 12,
    backgroundColor: 'rgba(90, 51, 32, 0.16)',
  },
  area: {
    fontFamily: Fonts.serif,
    color: '#6b3b1c',
    fontSize: 16,
    fontStyle: 'italic',
  },
  titleInput: {
    fontFamily: Fonts.serif,
    color: '#6b3b1c',
    fontSize: 16,
    fontStyle: 'italic',
    padding: 0,
    marginBottom: 2,
  },
  chapterTitle: {
    fontSize: 26,
    fontStyle: 'normal',
    fontWeight: '700',
    letterSpacing: -0.2,
    color: '#2e1c12',
    marginBottom: 10,
    lineHeight: 32,
  },
  meta: {
    fontFamily: Fonts.serif,
    color: '#8a7460',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  section: {
    fontFamily: Fonts.serif,
    color: '#3b2414',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    letterSpacing: 0.4,
    textDecorationLine: 'underline',
  },
  notes: {
    fontFamily: Fonts.serif,
    color: '#2b1d12',
    fontSize: 16,
    lineHeight: LINE,
    minHeight: 176,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    margin: 0,
    includeFontPadding: false,
    backgroundColor: 'transparent',
  },
  notesMemoir: {
    minHeight: 360,
    lineHeight: 32,
    fontSize: 17,
  },
  timeline: {
    fontFamily: Fonts.serif,
    color: '#2b1d12',
    fontSize: 16,
    lineHeight: LINE,
    includeFontPadding: false,
  },
  titleBody: {
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 36,
    alignItems: 'center',
    gap: 8,
  },
  fieldLabel: {
    alignSelf: 'stretch',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.6,
    color: '#8a7460',
    marginTop: 10,
    textTransform: 'uppercase',
  },
  coverEmpty: {
    minHeight: 72,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  coverHint: {
    color: '#8a7460',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  coverTitle: {
    width: '100%',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
    padding: 0,
  },
  coverBy: {
    width: '100%',
    fontSize: 18,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 0,
  },
  coverSubtitle: {
    width: '100%',
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    minHeight: 44,
    padding: 0,
  },
  coverGhost: {
    minHeight: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#8a6230',
    justifyContent: 'center',
  },
  coverGhostLabel: {
    color: '#6b3b1c',
    fontSize: 13,
    fontWeight: '700',
  },
  coverActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
});
