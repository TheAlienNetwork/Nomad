import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { buildHuntTimeline } from '@huntos/core';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Alert, InteractionManager, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FieldButton } from '@/components/field-button';
import { MemoryGallery } from '@/components/memory-gallery';
import { MemoirListen } from '@/components/memoir-listen';
import { MemoirPage, type MemoirLeaf } from '@/components/memoir-page';
import { Fonts } from '@/constants/theme';
import { FONT_CHOICES, INK_SWATCHES, SCALE_CHOICES } from '@/src/journal';
import { buildLeaves, chapterKindLabel, contentsLabel, shortDate } from '@/src/memoir-leaves';
import { friendlyPagePhotoError, preparePagePhoto, shrinkForSketch } from '@/src/page-photo';
import { friendlySketchError, photoToPencilSketch } from '@/src/pencil-sketch';
import { pickMemoirPhoto, toPagePhotoMeta } from '@/src/pick-photo';
import { saveJpegToCameraRoll } from '@/src/save-photo';
import { printMemoirBook } from '@/src/print-memoir';
import { newId } from '@/src/ids';
import { deleteCloudNote, deleteCloudPlan, deleteCloudSketch, useCloudSession } from '@/src/cloud-sync';
import { useDictation } from '@/src/use-dictation';
import { type InkColor, type NoteScale, type PageFont, useFieldStore } from '@/src/store';

function clampPct(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function deferAfterPlace(work: () => void): void {
  InteractionManager.runAfterInteractions(() => {
    setTimeout(work, Platform.OS === 'android' ? 220 : 80);
  });
}

async function tryDefaultSketch(sourceUri: string): Promise<string | null> {
  try {
    return await photoToPencilSketch(sourceUri);
  } catch {
    const shrunk = await shrinkForSketch(sourceUri);
    if (!shrunk) return null;
    try {
      return await photoToPencilSketch(shrunk);
    } catch {
      return null;
    }
  }
}

const TURN_DEG = 180;
const TURN_MS = 700;
const TURN_DRAG = 300;
const TURN_EASE = Easing.bezier(0.2, 0.7, 0.2, 1);
const TURN_SPRING = { damping: 22, stiffness: 160, mass: 0.9 };
const TURN_FLING_VX = 650;

function noop(): void {}

type DeskTab = 'book' | 'memories' | 'listen';

export default function MemoirScreen() {
  const hydrated = useFieldStore((state) => state.hydrated);
  const hunts = useFieldStore((state) => state.hunts);
  const waypoints = useFieldStore((state) => state.waypoints);
  const pages = useFieldStore((state) => state.memoirPages);
  const journalNotes = useFieldStore((state) => state.journalNotes);
  const huntPlans = useFieldStore((state) => state.huntPlans);
  const journalStyle = useFieldStore((state) => state.journalStyle);
  const fieldRuled = useFieldStore((state) => state.fieldRuled);
  const pageSketches = useFieldStore((state) => state.pageSketches);
  const bookmarkedPageIds = useFieldStore((state) => state.bookmarkedPageIds);
  const hiddenMemoirIds = useFieldStore((state) => state.hiddenMemoirIds);
  const setMemoirNotes = useFieldStore((state) => state.setMemoirNotes);
  const setMemoirStyle = useFieldStore((state) => state.setMemoirStyle);
  const setJournalNote = useFieldStore((state) => state.setJournalNote);
  const setHuntPlanNotes = useFieldStore((state) => state.setHuntPlanNotes);
  const setHuntPlanStyle = useFieldStore((state) => state.setHuntPlanStyle);
  const setJournalStyle = useFieldStore((state) => state.setJournalStyle);
  const setFieldRuled = useFieldStore((state) => state.setFieldRuled);
  const memoirReadTheme = useFieldStore((state) => state.memoirReadTheme);
  const setMemoirReadTheme = useFieldStore((state) => state.setMemoirReadTheme);
  const addJournalNote = useFieldStore((state) => state.addJournalNote);
  const ensureTitlePage = useFieldStore((state) => state.ensureTitlePage);
  const removeJournalNote = useFieldStore((state) => state.removeJournalNote);
  const deleteHuntPlan = useFieldStore((state) => state.deleteHuntPlan);
  const toggleBookmark = useFieldStore((state) => state.toggleBookmark);
  const hideMemoirPage = useFieldStore((state) => state.hideMemoirPage);
  const addPageSketch = useFieldStore((state) => state.addPageSketch);
  const updatePageSketch = useFieldStore((state) => state.updatePageSketch);
  const removePageSketch = useFieldStore((state) => state.removePageSketch);
  const session = useCloudSession();
  const didEnsureCover = useRef(false);

  const leaves = useMemo(
    () => buildLeaves(hunts, huntPlans, journalNotes, pages, waypoints, hiddenMemoirIds),
    [hunts, huntPlans, journalNotes, pages, waypoints, hiddenMemoirIds],
  );
  const [index, setIndex] = useState(0);
  const [selectedSketchId, setSelectedSketchId] = useState<string | null>(null);
  const [coverSelected, setCoverSelected] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [deskTab, setDeskTab] = useState<DeskTab>('book');
  const [readMode, setReadMode] = useState(false);
  const safeIndex = leaves.length === 0 ? 0 : Math.min(index, leaves.length - 1);
  const leaf = leaves[safeIndex];
  const prevLeaf = safeIndex > 0 ? leaves[safeIndex - 1] : undefined;
  const nextLeaf = safeIndex < leaves.length - 1 ? leaves[safeIndex + 1] : undefined;
  const flip = useSharedValue(0);
  const sketches = leaf ? (pageSketches[leaf.id] ?? []) : [];
  const selectedSketch = sketches.find((item) => item.id === selectedSketchId);
  const ink: InkColor = leaf?.inkColor ?? 'walnut';
  const font: PageFont = leaf?.fontFamily ?? 'serif';
  const memoir = journalStyle === 'memoir';

  useEffect(() => {
    if (!hydrated || didEnsureCover.current) return;
    didEnsureCover.current = true;
    ensureTitlePage();
  }, [hydrated, ensureTitlePage]);

  const writeNotes = (value: string) => {
    if (!leaf) return;
    switch (leaf.kind) {
      case 'hunt':
        if (leaf.session) setMemoirNotes(leaf.session.id, value);
        return;
      case 'note':
      case 'title':
        setJournalNote(leaf.id.replace(/^note:/, ''), { notes: value });
        return;
      case 'plan':
        setHuntPlanNotes(leaf.id.replace(/^plan:/, ''), value);
        return;
      default: {
        const _exhaustive: never = leaf.kind;
        return _exhaustive;
      }
    }
  };

  const writeTitle = (title: string) => {
    if (!leaf) return;
    switch (leaf.kind) {
      case 'title':
      case 'note':
        setJournalNote(leaf.id.replace(/^note:/, ''), { title });
        return;
      case 'hunt':
        if (leaf.session) setMemoirStyle(leaf.session.id, { areaName: title });
        return;
      case 'plan':
        setHuntPlanStyle(leaf.id.replace(/^plan:/, ''), { title });
        return;
      default: {
        const _exhaustive: never = leaf.kind;
        return _exhaustive;
      }
    }
  };

  const writeAuthor = (author: string) => {
    if (!leaf || leaf.kind !== 'title') return;
    setJournalNote(leaf.id.replace(/^note:/, ''), { author });
  };

  const writeStyle = (patch: { inkColor?: InkColor; fontFamily?: PageFont; typeScale?: NoteScale }) => {
    if (!leaf) return;
    switch (leaf.kind) {
      case 'hunt':
        if (leaf.session) setMemoirStyle(leaf.session.id, patch);
        return;
      case 'note':
      case 'title':
        setJournalNote(leaf.id.replace(/^note:/, ''), patch);
        return;
      case 'plan':
        setHuntPlanStyle(leaf.id.replace(/^plan:/, ''), patch);
        return;
      default: {
        const _exhaustive: never = leaf.kind;
        return _exhaustive;
      }
    }
  };

  const noteId = (pageId: string) => pageId.replace(/^note:/, '');
  const planId = (pageId: string) => pageId.replace(/^plan:/, '');
  const bookmarked = leaf ? bookmarkedPageIds.includes(leaf.id) : false;

  const confirmRemove = (message: string, onYes: () => void) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) onYes();
      return;
    }
    Alert.alert('Remove page', message, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onYes },
    ]);
  };

  const removeCurrentPage = () => {
    if (!leaf) {
      setBanner('Open a page first.');
      return;
    }
    const afterRemove = () => {
      setSelectedSketchId(null);
      setIndex((current) => Math.max(0, Math.min(current, leaves.length - 2)));
    };
    switch (leaf.kind) {
      case 'title':
        confirmRemove('Delete this cover page?', () => {
          const id = noteId(leaf.id);
          removeJournalNote(id);
          void deleteCloudNote(id);
          afterRemove();
        });
        return;
      case 'note':
        confirmRemove('Delete this page from the book?', () => {
          const id = noteId(leaf.id);
          removeJournalNote(id);
          void deleteCloudNote(id);
          afterRemove();
        });
        return;
      case 'plan':
        confirmRemove('Delete this planned sit from the book?', () => {
          const id = planId(leaf.id);
          deleteHuntPlan(id);
          void deleteCloudPlan(id);
          afterRemove();
        });
        return;
      case 'hunt':
        confirmRemove('Remove this hunt from the book? The GPS track stays on Hunt.', () => {
          hideMemoirPage(leaf.id);
          afterRemove();
        });
        return;
      default: {
        const _exhaustive: never = leaf.kind;
        return _exhaustive;
      }
    }
  };

  const clearCoverPhoto = () => {
    if (!leaf || leaf.kind !== 'title') return;
    setJournalNote(noteId(leaf.id), {
      coverUri: undefined,
      coverPhotoUri: undefined,
      coverSketch: false,
      coverStoragePath: undefined,
    });
  };

  const pickCover = async () => {
    if (!leaf || leaf.kind !== 'title') {
      setBanner('Open the cover to add a photo.');
      return;
    }
    try {
      const picked = await pickMemoirPhoto();
      if (!picked) return;
      setBanner('Placing photo…');
      const prepared = await preparePagePhoto(picked.uri, toPagePhotoMeta(picked));
      const id = noteId(leaf.id);
      setJournalNote(id, {
        coverPhotoUri: prepared,
        coverUri: prepared,
        coverSketch: false,
        coverStoragePath: undefined,
      });
      setCoverSelected(true);
      setBanner('Drag or resize to place. Sketching…');
      deferAfterPlace(() => {
        void (async () => {
          const sketched = await tryDefaultSketch(prepared);
          const still = useFieldStore.getState().journalNotes.find((note) => note.id === id);
          if (!still || still.coverPhotoUri !== prepared) return;
          if (!sketched) {
            setBanner('Drag or resize to place. Sketch unavailable — use Draw as sketch later.');
            return;
          }
          setJournalNote(id, {
            coverSketch: true,
            coverPhotoUri: prepared,
            coverUri: sketched,
            coverStoragePath: undefined,
          });
          setBanner('Sketch ready. Drag or resize to place.');
        })();
      });
    } catch (error) {
      setBanner(friendlyPagePhotoError(error).message);
    }
  };

  const toggleCoverSketch = async () => {
    if (!leaf || leaf.kind !== 'title') return;
    const id = noteId(leaf.id);
    const current = useFieldStore.getState().journalNotes.find((note) => note.id === id);
    const original = current?.coverPhotoUri ?? current?.coverUri;
    if (!original) {
      setBanner('Add a cover photo first.');
      return;
    }
    try {
      if (current?.coverSketch) {
        setJournalNote(id, { coverSketch: false, coverUri: original, coverStoragePath: undefined });
        setBanner(null);
        return;
      }
      const sketched = await photoToPencilSketch(original);
      setJournalNote(id, {
        coverSketch: true,
        coverPhotoUri: original,
        coverUri: sketched,
        coverStoragePath: undefined,
      });
      setBanner(null);
    } catch (error) {
      setBanner(friendlySketchError(error).message);
    }
  };

  const openNewPage = () => {
    addJournalNote();
    setSelectedSketchId(null);
    setCoverSelected(false);
    setContentsOpen(false);
    setMenuOpen(false);
    setIndex(leaves.some((item) => item.kind === 'title') ? 1 : 0);
  };

  const addSketch = async () => {
    if (!leaf) {
      setBanner('Open a page first.');
      return;
    }
    if (leaf.kind === 'title') {
      await pickCover();
      return;
    }
    try {
      const picked = await pickMemoirPhoto();
      if (!picked) return;
      setBanner('Placing photo…');
      const prepared = await preparePagePhoto(picked.uri, toPagePhotoMeta(picked));
      const id = newId();
      const pageId = leaf.id;
      addPageSketch({
        id,
        pageId,
        uri: prepared,
        sourceUri: prepared,
        sketched: false,
        x: 18,
        y: 28,
        width: 36,
        height: 28,
        z: sketches.length,
        updatedAt: new Date().toISOString(),
      });
      setSelectedSketchId(id);
      setBanner('Drag or resize to place. Sketching…');
      deferAfterPlace(() => {
        void (async () => {
          const sketched = await tryDefaultSketch(prepared);
          const still = useFieldStore.getState().pageSketches[pageId]?.find((item) => item.id === id);
          if (!still) return;
          if (!sketched) {
            setBanner('Drag or resize to place. Sketch unavailable — use Sketch this photo later.');
            return;
          }
          updatePageSketch(pageId, id, {
            uri: sketched,
            sketched: true,
            sourceUri: prepared,
          });
          setBanner('Sketch ready. Drag or resize to place.');
        })();
      });
    } catch (error) {
      setBanner(friendlyPagePhotoError(error).message);
    }
  };

  const retrySelectedSketch = async () => {
    if (!leaf) return;
    const target =
      sketches.find((item) => item.id === selectedSketchId) ??
      sketches.find((item) => item.sketched === false);
    if (!target) {
      setBanner('Tap a photo on this page, then tap Sketch.');
      return;
    }
    const source = target.sourceUri ?? target.uri;
    try {
      setBanner('Sketching…');
      const sketched = await tryDefaultSketch(source);
      if (!sketched) {
        setBanner('Could not sketch that photo. Try a smaller shot.');
        return;
      }
      updatePageSketch(leaf.id, target.id, { uri: sketched, sketched: true, sourceUri: source });
      setBanner('Sketch ready.');
    } catch (error) {
      setBanner(friendlySketchError(error).message);
    }
  };

  const savePageToRoll = async () => {
    if (!leaf) {
      setBanner('Open a page first.');
      return;
    }
    try {
      if (leaf.kind === 'title') {
        const id = noteId(leaf.id);
        const current = useFieldStore.getState().journalNotes.find((note) => note.id === id);
        const uri = current?.coverUri;
        if (!uri) {
          setBanner('Add a cover photo first.');
          return;
        }
        await saveJpegToCameraRoll(uri);
        setBanner('Cover saved to the camera roll.');
        return;
      }
      const target =
        sketches.find((item) => item.id === selectedSketchId) ?? sketches[sketches.length - 1];
      if (!target?.uri) {
        setBanner('Add a sketch first.');
        return;
      }
      await saveJpegToCameraRoll(target.uri);
      setBanner('Sketch saved to the camera roll.');
    } catch (error) {
      setBanner(error instanceof Error ? error.message : 'Could not save to the camera roll.');
    }
  };

  const dictation = useDictation(
    () => leaf?.notes ?? '',
    (value) => writeNotes(value),
  );

  const goTo = (next: number) => {
    if (leaves.length === 0) return;
    setIndex(Math.max(0, Math.min(leaves.length - 1, next)));
    setSelectedSketchId(null);
    setCoverSelected(false);
    setContentsOpen(false);
    setMenuOpen(false);
    setTypeOpen(false);
  };

  useLayoutEffect(() => {
    flip.value = 0;
  }, [flip, index]);

  const jumpNextBookmark = () => {
    const marks = leaves
      .map((item, pageIndex) => ({ id: item.id, pageIndex }))
      .filter((item) => bookmarkedPageIds.includes(item.id));
    if (marks.length === 0) {
      setBanner('No bookmarks yet. Mark a page you want to find later.');
      return;
    }
    const next = marks.find((item) => item.pageIndex > safeIndex) ?? marks[0];
    goTo(next.pageIndex);
    setBanner(null);
  };

  const turn = (direction: -1 | 1) => {
    const next = safeIndex + direction;
    if (direction === 1 && next >= leaves.length) {
      flip.value = withSpring(0, TURN_SPRING);
      openNewPage();
      return;
    }
    if (next < 0 || next >= leaves.length) {
      flip.value = withSpring(0, TURN_SPRING);
      return;
    }
    flip.value = withTiming(direction * -TURN_DEG, { duration: TURN_MS, easing: TURN_EASE }, (finished) => {
      if (finished) {
        runOnJS(goTo)(next);
      }
    });
  };

  const swipe = Gesture.Pan()
    .enabled(!selectedSketchId && !coverSelected)
    .activeOffsetX([-24, 24])
    .onUpdate((event) => {
      // Paper resistance: ease-out so early drag feels heavier.
      const raw = event.translationX / TURN_DRAG;
      const eased = Math.sign(raw) * (1 - Math.pow(1 - Math.min(1, Math.abs(raw)), 1.35));
      flip.value = Math.max(-TURN_DEG, Math.min(TURN_DEG, eased * TURN_DEG));
    })
    .onEnd((event) => {
      const flingNext = event.velocityX < -TURN_FLING_VX;
      const flingPrev = event.velocityX > TURN_FLING_VX;
      if (event.translationX < -64 || flingNext) {
        runOnJS(turn)(1);
        return;
      }
      if (event.translationX > 64 || flingPrev) {
        runOnJS(turn)(-1);
        return;
      }
      flip.value = withSpring(0, TURN_SPRING);
    });

  const turningStyle = useAnimatedStyle(() => {
    const amount = Math.abs(flip.value);
    const scaleX = interpolate(amount, [0, 90, 180], [1, 0.965, 1], Extrapolation.CLAMP);
    return {
      transformOrigin: 'left center',
      transform: [{ perspective: 1800 }, { rotateY: `${flip.value}deg` }, { scaleX }],
    };
  });

  const frontDimStyle = useAnimatedStyle(() => {
    const amount = Math.abs(flip.value);
    return {
      opacity: interpolate(amount, [0, 70, 100, 180], [0, 0.18, 0.35, 0.08], Extrapolation.CLAMP),
    };
  });

  const underNextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flip.value, [0, -40, -100, -180], [0, 0.35, 0.85, 1], Extrapolation.CLAMP),
  }));

  const underPrevStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flip.value, [0, 40, 100, 180], [0, 0.35, 0.85, 1], Extrapolation.CLAMP),
  }));

  const foldStyle = useAnimatedStyle(() => {
    const amount = Math.abs(flip.value);
    return {
      opacity: interpolate(amount, [0, 55, 95, 140, 180], [0, 0.55, 0.72, 0.28, 0], Extrapolation.CLAMP),
    };
  });

  const foldBandStyle = useAnimatedStyle(() => {
    const amount = Math.abs(flip.value);
    const width = interpolate(amount, [0, 90, 180], [18, 52, 24], Extrapolation.CLAMP);
    return { width };
  });

  const spineGlowStyle = useAnimatedStyle(() => {
    const amount = Math.abs(flip.value);
    return {
      opacity: interpolate(amount, [0, 60, 100, 180], [0, 0.35, 0.55, 0.1], Extrapolation.CLAMP),
    };
  });

  const runMenu = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  const printBook = () => {
    void (async () => {
      if (leaves.length === 0) {
        setBanner('Nothing to print yet.');
        return;
      }
      try {
        const timelines: Record<string, string[]> = {};
        if (journalStyle === 'field') {
          for (const item of leaves) {
            if (!item.session) continue;
            timelines[item.id] = buildHuntTimeline(item.session, item.waypoints ?? []).map(
              (event) => event.label,
            );
          }
        }
        await printMemoirBook(leaves, pageSketches, journalStyle, timelines);
        setBanner(null);
      } catch (error) {
        setBanner(error instanceof Error ? error.message : 'Print is unavailable.');
      }
    })();
  };

  const jumpToLeaf = (leafId: string) => {
    const next = leaves.findIndex((item) => item.id === leafId);
    if (next >= 0) goTo(next);
  };

  const renderLeaf = (item: MemoirLeaf, interactive: boolean) => {
    const itemSketches = pageSketches[item.id] ?? [];
    const editTitle = Boolean(interactive && (item.kind !== 'hunt' || memoir));
    return (
      <MemoirPage
        leaf={item}
        journalStyle={journalStyle}
        fieldRuled={fieldRuled}
        sketches={itemSketches}
        selectedSketchId={interactive ? selectedSketchId : null}
        onTitleChange={editTitle ? writeTitle : undefined}
        onAuthorChange={interactive && item.kind === 'title' ? writeAuthor : undefined}
        onNotesChange={interactive ? writeNotes : noop}
        onCoverChange={interactive && item.kind === 'title' ? () => void pickCover() : undefined}
        onCoverClear={interactive && item.kind === 'title' ? clearCoverPhoto : undefined}
        onCoverSketch={interactive && item.kind === 'title' ? () => void toggleCoverSketch() : undefined}
        onCoverLayout={
          interactive && item.kind === 'title'
            ? (frame) =>
                setJournalNote(noteId(item.id), {
                  coverX: frame.x,
                  coverY: frame.y,
                  coverWidth: frame.width,
                  coverHeight: frame.height,
                })
            : undefined
        }
        coverSelected={interactive ? coverSelected : false}
        onCoverSelectChange={interactive ? setCoverSelected : undefined}
        onSelectSketch={
          interactive
            ? (id) => {
                setCoverSelected(false);
                setSelectedSketchId(id);
              }
            : noop
        }
        onChangeSketch={interactive ? (id, patch) => updatePageSketch(item.id, id, patch) : noop}
        onRemoveSketch={
          interactive
            ? (id) => {
                removePageSketch(item.id, id);
                void deleteCloudSketch(id);
                setSelectedSketchId(null);
              }
            : noop
        }
        paperTheme={memoirReadTheme}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.desk}>
        <View style={styles.grain} />
        <View style={styles.header}>
          <Text style={styles.stamp}>{memoir ? 'MEMOIR' : 'FIELD NOTES'}</Text>
          <View style={styles.headerActions}>
            {deskTab === 'book' ? (
              <>
                <LeatherChip
                  label={bookmarked ? 'Remove bookmark' : 'Bookmark this page'}
                  icon={bookmarked ? 'bookmark' : 'bookmark-border'}
                  active={bookmarked}
                  onPress={() => {
                    if (!leaf) {
                      setBanner('Open a page before setting a bookmark.');
                      return;
                    }
                    toggleBookmark(leaf.id);
                    setBanner(bookmarked ? null : 'Bookmark set. Use Next mark to jump back.');
                  }}
                />
                <LeatherChip label="Previous page" icon="chevron-left" onPress={() => turn(-1)} />
                <LeatherChip label="Next page" icon="chevron-right" onPress={() => turn(1)} />
              </>
            ) : null}
            <LeatherChip
              label="Menu"
              icon={menuOpen ? 'close' : 'more-horiz'}
              active={menuOpen || dictation.listening}
              onPress={() => {
                setContentsOpen(false);
                setTypeOpen(false);
                setMenuOpen((open) => !open);
              }}
            />
          </View>
        </View>
        <View style={styles.deskTabs}>
          {(['book', 'memories', 'listen'] as const).map((tab) => (
            <FieldButton
              key={tab}
              accessibilityLabel={tab === 'book' ? 'Book' : tab === 'memories' ? 'Memories' : 'Listen'}
              style={[styles.deskTab, deskTab === tab && styles.deskTabOn]}
              onPress={() => {
                setDeskTab(tab);
                setMenuOpen(false);
                setContentsOpen(tab === 'book' ? contentsOpen : false);
              }}>
              <Text style={[styles.deskTabLabel, deskTab === tab && styles.deskTabLabelOn]}>
                {tab === 'book' ? 'Book' : tab === 'memories' ? 'Memories' : 'Listen'}
              </Text>
              <Text style={[styles.deskTabHint, deskTab === tab && styles.deskTabHintOn]}>
                {tab === 'book' ? 'Pages' : tab === 'memories' ? 'Photos' : 'Audio'}
              </Text>
            </FieldButton>
          ))}
        </View>
        {deskTab === 'book' ? (
          <View style={styles.hud}>
            <LeatherChip
              label="Contents"
              icon="list"
              active={contentsOpen}
              showLabel
              onPress={() => {
                setMenuOpen(false);
                setTypeOpen(false);
                setContentsOpen((open) => !open);
              }}
            />
            <LeatherChip
              label="Ink"
              icon="format-size"
              active={typeOpen}
              showLabel
              onPress={() => {
                setMenuOpen(false);
                setContentsOpen(false);
                setTypeOpen((open) => !open);
              }}
            />
            <LeatherChip label="Print" icon="print" showLabel onPress={printBook} />
            <LeatherChip
              label="Read"
              icon="chrome-reader-mode"
              active={readMode}
              showLabel
              onPress={() => setReadMode((open) => !open)}
            />
            <LeatherChip
              label={memoirReadTheme === 'night' ? 'Night' : 'Paper'}
              icon={memoirReadTheme === 'night' ? 'nights-stay' : 'wb-sunny'}
              active={memoirReadTheme === 'night'}
              showLabel
              onPress={() => setMemoirReadTheme(memoirReadTheme === 'night' ? 'paper' : 'night')}
            />
            <LeatherChip
              label="Listen"
              icon="headphones"
              showLabel
              onPress={() => setDeskTab('listen')}
            />
          </View>
        ) : null}
        {menuOpen ? (
          <ScrollView style={styles.menuSheet} keyboardShouldPersistTaps="handled">
            <Text style={styles.menuHeading}>Book</Text>
            <MenuRow
              label={memoir ? 'Switch to Field notes' : 'Switch to Memoir'}
              icon={memoir ? 'notes' : 'auto-stories'}
              onPress={() => runMenu(() => setJournalStyle(memoir ? 'field' : 'memoir'))}
            />
            <MenuRow
              label="Cover"
              icon="menu-book"
              onPress={() =>
                runMenu(() => {
                  ensureTitlePage();
                  setIndex(0);
                  setBanner(null);
                })
              }
            />
            <MenuRow
              label="Contents"
              icon="list"
              active={contentsOpen}
              onPress={() =>
                runMenu(() => {
                  setContentsOpen((open) => !open);
                })
              }
            />
            <MenuRow
              label="New note"
              icon="note-add"
              onPress={() => runMenu(openNewPage)}
            />
            <MenuRow
              label="Print book"
              icon="print"
              onPress={() => runMenu(printBook)}
            />
            <Text style={styles.menuHeading}>Page</Text>
            <MenuRow
              label={leaf?.kind === 'title' ? 'Cover photo' : 'Add sketch'}
              icon="photo"
              onPress={() => runMenu(() => void addSketch())}
            />
            <MenuRow
              label="Ink & type"
              icon="format-size"
              active={typeOpen}
              onPress={() =>
                runMenu(() => {
                  setTypeOpen(true);
                })
              }
            />
            {sketches.some((item) => item.sketched === false) ||
            (leaf?.kind !== 'title' && selectedSketchId) ? (
              <MenuRow
                label="Sketch this photo"
                icon="brush"
                onPress={() => runMenu(() => void retrySelectedSketch())}
              />
            ) : null}
            {selectedSketch?.sketched && selectedSketch.sourceUri ? (
              <MenuRow
                label="Use original photo"
                icon="photo"
                onPress={() =>
                  runMenu(() => {
                    if (!leaf || !selectedSketch.sourceUri) return;
                    updatePageSketch(leaf.id, selectedSketch.id, {
                      uri: selectedSketch.sourceUri,
                      sketched: false,
                    });
                    setBanner('Showing original photo.');
                  })
                }
              />
            ) : null}
            <MenuRow
              label="Save to camera roll"
              icon="save-alt"
              onPress={() => runMenu(() => void savePageToRoll())}
            />
            <MenuRow
              label={dictation.listening ? 'Stop dictation' : 'Dictate'}
              icon={dictation.listening ? 'stop' : 'mic'}
              active={dictation.listening}
              onPress={() => runMenu(() => dictation.toggle())}
            />
            {sketches.length > 0 && leaf?.kind !== 'title' ? (
              <MenuRow
                label="Remove sketch"
                icon="delete-outline"
                onPress={() =>
                  runMenu(() => {
                    if (!leaf) return;
                    const target = selectedSketchId ?? sketches[sketches.length - 1]?.id;
                    if (!target) {
                      setBanner('Tap a sketch, then tap remove.');
                      return;
                    }
                    removePageSketch(leaf.id, target);
                    void deleteCloudSketch(target);
                    setSelectedSketchId(null);
                    setBanner(null);
                  })
                }
              />
            ) : null}
            <MenuRow
              label={bookmarked ? 'Remove bookmark' : 'Bookmark this page'}
              icon={bookmarked ? 'bookmark' : 'bookmark-border'}
              active={bookmarked}
              onPress={() =>
                runMenu(() => {
                  if (!leaf) {
                    setBanner('Open a page before setting a bookmark.');
                    return;
                  }
                  toggleBookmark(leaf.id);
                  setBanner(bookmarked ? null : 'Bookmark set. Use Next mark to jump back.');
                })
              }
            />
            <MenuRow
              label="Next bookmark"
              icon="bookmark"
              onPress={() => runMenu(() => jumpNextBookmark())}
            />
            <MenuRow
              label={fieldRuled ? 'Hide field margin' : 'Show field margin'}
              icon="view-headline"
              onPress={() => runMenu(() => setFieldRuled(!fieldRuled))}
            />
            <MenuRow
              label="Remove page"
              icon="delete-outline"
              onPress={() => runMenu(() => removeCurrentPage())}
            />
          </ScrollView>
        ) : null}
        {deskTab === 'book' && typeOpen && leaf ? (
          <ScrollView horizontal style={styles.typeBar} contentContainerStyle={styles.typeBarInner}>
            {FONT_CHOICES.map((choice) => (
              <FieldButton
                key={choice.id}
                accessibilityLabel={choice.label}
                style={[styles.typeChip, font === choice.id && styles.typeChipOn]}
                onPress={() => writeStyle({ fontFamily: choice.id })}>
                <Text style={[styles.typeLabel, font === choice.id && styles.typeLabelOn]}>{choice.label}</Text>
              </FieldButton>
            ))}
            {SCALE_CHOICES.map((choice) => (
              <FieldButton
                key={choice.id}
                accessibilityLabel={`Type size ${choice.label}`}
                style={[styles.typeChip, (leaf.typeScale ?? 'body') === choice.id && styles.typeChipOn]}
                onPress={() => writeStyle({ typeScale: choice.id })}>
                <Text style={[styles.typeLabel, (leaf.typeScale ?? 'body') === choice.id && styles.typeLabelOn]}>
                  {choice.label}
                </Text>
              </FieldButton>
            ))}
            {INK_SWATCHES.map((color) => (
              <FieldButton
                key={color}
                accessibilityLabel={color}
                style={[styles.swatch, ink === color && styles.swatchOn, { backgroundColor: inkFill(color) }]}
                onPress={() => writeStyle({ inkColor: color })}>
                <View />
              </FieldButton>
            ))}
            <FieldButton
              accessibilityLabel="Close ink and type"
              style={styles.typeChip}
              onPress={() => setTypeOpen(false)}>
              <Text style={styles.typeLabel}>Done</Text>
            </FieldButton>
          </ScrollView>
        ) : null}
        {deskTab === 'book' && selectedSketch && leaf ? (
          <View style={styles.sketchBar}>
            <TextInput
              value={selectedSketch.caption ?? ''}
              onChangeText={(caption) => updatePageSketch(leaf.id, selectedSketch.id, { caption })}
              placeholder="Caption"
              placeholderTextColor="#8a7460"
              style={styles.captionInput}
            />
            <FieldButton
              accessibilityLabel="Small photo"
              style={styles.typeChip}
              onPress={() =>
                updatePageSketch(leaf.id, selectedSketch.id, {
                  width: 22,
                  height: 18,
                })
              }>
              <Text style={styles.typeLabel}>S</Text>
            </FieldButton>
            <FieldButton
              accessibilityLabel="Medium photo"
              style={styles.typeChip}
              onPress={() =>
                updatePageSketch(leaf.id, selectedSketch.id, {
                  width: 36,
                  height: 28,
                })
              }>
              <Text style={styles.typeLabel}>M</Text>
            </FieldButton>
            <FieldButton
              accessibilityLabel="Large photo"
              style={styles.typeChip}
              onPress={() =>
                updatePageSketch(leaf.id, selectedSketch.id, {
                  width: 58,
                  height: 44,
                })
              }>
              <Text style={styles.typeLabel}>L</Text>
            </FieldButton>
            <FieldButton
              accessibilityLabel="Center photo"
              style={styles.typeChip}
              onPress={() => {
                const width = clampPct(selectedSketch.width, 10, 96);
                const height = clampPct(selectedSketch.height, 10, 92);
                updatePageSketch(leaf.id, selectedSketch.id, {
                  width,
                  height,
                  x: clampPct((100 - width) / 2, 0, 100),
                  y: clampPct((100 - height) / 2, 0, 100),
                });
              }}>
              <Text style={styles.typeLabel}>Center</Text>
            </FieldButton>
            <FieldButton
              accessibilityLabel="Rotate photo"
              style={styles.typeChip}
              onPress={() =>
                updatePageSketch(leaf.id, selectedSketch.id, {
                  rotate: ((selectedSketch.rotate ?? 0) + 90) % 360,
                })
              }>
              <Text style={styles.typeLabel}>90°</Text>
            </FieldButton>
            <FieldButton
              accessibilityLabel="Bring forward"
              style={styles.typeChip}
              onPress={() =>
                updatePageSketch(leaf.id, selectedSketch.id, { z: (selectedSketch.z ?? 0) + 1 })
              }>
              <Text style={styles.typeLabel}>Front</Text>
            </FieldButton>
            <FieldButton
              accessibilityLabel="Send back"
              style={styles.typeChip}
              onPress={() =>
                updatePageSketch(leaf.id, selectedSketch.id, {
                  z: Math.max(0, (selectedSketch.z ?? 0) - 1),
                })
              }>
              <Text style={styles.typeLabel}>Back</Text>
            </FieldButton>
            <FieldButton
              accessibilityLabel="Done placing photo"
              style={styles.typeChip}
              onPress={() => setSelectedSketchId(null)}>
              <Text style={styles.typeLabel}>Done</Text>
            </FieldButton>
          </View>
        ) : null}
        {dictation.unsupported ? <Text style={styles.dictationWarn}>{dictation.unsupported}</Text> : null}
        {banner ? <Text style={styles.dictationWarn}>{banner}</Text> : null}
        {contentsOpen && deskTab === 'book' ? (
          <View style={styles.contentsSheet}>
            <Text style={styles.contentsHeading}>Contents</Text>
            <Text style={styles.contentsProgress}>
              {leaves.length === 0 ? 'Empty book' : `Page ${safeIndex + 1} of ${leaves.length}`}
            </Text>
            <ScrollView style={styles.contentsList}>
              {leaves.map((item, pageIndex) => (
                <FieldButton
                  key={item.id}
                  accessibilityLabel={`${contentsLabel(item)}, page ${pageIndex + 1}`}
                  style={[styles.contentsRow, pageIndex === safeIndex && styles.contentsRowOn]}
                  onPress={() => goTo(pageIndex)}>
                  <Text style={[styles.contentsTitle, pageIndex === safeIndex && styles.contentsTitleOn]}>
                    {contentsLabel(item)}
                  </Text>
                  <Text style={styles.contentsMeta}>
                    {chapterKindLabel(item)}
                    {item.kind === 'title' ? '' : ` · ${shortDate(item.dateIso)}`}
                    {bookmarkedPageIds.includes(item.id) ? ' · marked' : ''}
                    {pageIndex < safeIndex ? ' · read' : ''}
                  </Text>
                </FieldButton>
              ))}
            </ScrollView>
          </View>
        ) : null}
        {deskTab === 'memories' ? (
          <MemoryGallery />
        ) : deskTab === 'listen' ? (
          <MemoirListen leaves={leaves} currentId={leaf?.id} onJump={jumpToLeaf} />
        ) : readMode ? (
          <ScrollView style={styles.readMode} contentContainerStyle={styles.readModeInner}>
            {leaf ? renderLeaf(leaf, true) : <Text style={styles.empty}>Opening the cover…</Text>}
          </ScrollView>
        ) : (
        <View style={styles.book}>
          <View style={styles.coverEdge} />
          <View style={styles.spine}>
            <View style={styles.stitch} />
            <View style={styles.stitch} />
            <View style={styles.stitch} />
          </View>
          <View style={[styles.pageWell, memoirReadTheme === 'night' && styles.pageWellNight]}>
            {nextLeaf ? (
              <Animated.View pointerEvents="none" style={[styles.leafUnder, underNextStyle]}>
                {renderLeaf(nextLeaf, false)}
              </Animated.View>
            ) : (
              <View pointerEvents="none" style={styles.leafUnder} />
            )}
            {prevLeaf ? (
              <Animated.View pointerEvents="none" style={[styles.leafUnder, underPrevStyle]}>
                {renderLeaf(prevLeaf, false)}
              </Animated.View>
            ) : null}
            <GestureDetector gesture={swipe}>
              <Animated.View style={[styles.leafOver, turningStyle]}>
                <View style={styles.pageFront}>
                  {leaf ? (
                    renderLeaf(leaf, true)
                  ) : (
                    <View style={styles.emptyPage}>
                      <Text style={styles.empty}>Your field book opens here.</Text>
                      <Text style={[styles.empty, { marginTop: 12, fontSize: 15, opacity: 0.75 }]}>
                        Hunt notes, plans, and pages collect into one memoir as you mark the field.
                      </Text>
                    </View>
                  )}
                  <Animated.View pointerEvents="none" style={[styles.frontDim, frontDimStyle]} />
                </View>
                <View pointerEvents="none" style={[styles.pageBack, memoir ? styles.pageBackMemoir : styles.pageBackField]}>
                  <View style={styles.pageBackFoxing} />
                  <View style={styles.pageBackGrain} />
                </View>
                <Animated.View pointerEvents="none" style={[styles.foldShade, foldStyle]}>
                  <Animated.View style={[styles.foldBand, foldBandStyle]} />
                </Animated.View>
                <Animated.View pointerEvents="none" style={[styles.spineGlow, spineGlowStyle]} />
                {bookmarked ? <View pointerEvents="none" style={styles.bookmarkRibbon} /> : null}
              </Animated.View>
            </GestureDetector>
          </View>
        </View>
        )}
        {deskTab === 'book' ? (
        <Text style={styles.folio}>
          {leaves.length === 0
            ? 'No pages yet — Cover starts the book'
            : `${safeIndex + 1} / ${leaves.length} · ${leaf?.kind === 'title' ? 'Cover' : memoir ? 'Memoir' : 'Field notes'}${bookmarked ? ' · marked' : ''}${readMode ? ' · read' : ''}`}
          {session.email ? ` · ${session.email}` : ' · Sign in on Gear to save across devices'}
        </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function inkFill(color: InkColor): string {
  switch (color) {
    case 'walnut':
      return '#3b2414';
    case 'black':
      return '#16120e';
    case 'rust':
      return '#9a3412';
    case 'blue':
      return '#3d5a80';
    case 'green':
      return '#3f5d3a';
    case 'sepia':
      return '#6b4a2a';
    case 'pencil':
      return '#5c574e';
    default: {
      const _exhaustive: never = color;
      return _exhaustive;
    }
  }
}

function MenuRow({
  label,
  icon,
  onPress,
  active,
}: {
  label: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.menuRow, active && styles.menuRowOn]}
      onPress={onPress}>
      <MaterialIcons name={icon} size={18} color={active ? '#3b2414' : '#d8b56a'} />
      <Text style={[styles.menuLabel, active && styles.menuLabelOn]}>{label}</Text>
    </Pressable>
  );
}

function LeatherChip({
  label,
  icon,
  onPress,
  active,
  showLabel,
}: {
  label: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
  active?: boolean;
  showLabel?: boolean;
}) {
  return (
    <FieldButton
      accessibilityLabel={label}
      style={[styles.chip, showLabel ? styles.chipWide : styles.chipIcon, active && styles.chipOn]}
      onPress={onPress}>
      <MaterialIcons name={icon} size={16} color={active ? '#3b2414' : '#d8b56a'} />
      {showLabel ? (
        <Text style={[styles.chipLabel, active && styles.chipLabelOn]}>{label}</Text>
      ) : null}
    </FieldButton>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1a100a',
  },
  desk: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: '#24150e',
  },
  grain: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#160e09',
    opacity: 0.4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    zIndex: 6,
    gap: 6,
    minHeight: 32,
  },
  stamp: {
    fontFamily: Fonts.serif,
    color: '#b8925c',
    letterSpacing: 2.2,
    fontSize: 10,
    fontWeight: '700',
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  deskTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    zIndex: 5,
  },
  deskTab: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(216,181,106,0.35)',
    backgroundColor: 'rgba(51,32,22,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deskTabOn: {
    backgroundColor: '#d8b56a',
    borderColor: '#d8b56a',
  },
  deskTabLabel: {
    color: '#d8b56a',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  deskTabLabelOn: {
    color: '#3b2414',
  },
  deskTabHint: {
    color: 'rgba(216,181,106,0.65)',
    fontSize: 10,
    marginTop: 1,
    letterSpacing: 0.4,
  },
  deskTabHintOn: {
    color: 'rgba(59,36,20,0.7)',
  },
  hud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
    zIndex: 5,
  },
  readMode: {
    flex: 1,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#4e2c1a',
  },
  readModeInner: {
    minHeight: 480,
    flexGrow: 1,
  },
  menuSheet: {
    zIndex: 8,
    maxHeight: 320,
    marginBottom: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#3a2418',
    borderWidth: 1,
    borderColor: '#8a6230',
  },
  menuHeading: {
    fontFamily: Fonts.serif,
    color: '#c4a06a',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  menuRow: {
    width: '100%',
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  menuRowOn: {
    backgroundColor: '#d8b56a',
  },
  menuLabel: {
    color: '#f3e4c4',
    fontFamily: Fonts.serif,
    fontSize: 15,
    fontWeight: '600',
  },
  menuLabelOn: {
    color: '#3b2414',
  },
  chip: {
    height: 30,
    minHeight: 30,
    borderRadius: 15,
    backgroundColor: '#332016',
    borderColor: '#6e4e2e',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  chipIcon: {
    width: 30,
    minWidth: 30,
  },
  chipWide: {
    minWidth: 30,
    paddingHorizontal: 8,
  },
  chipOn: {
    backgroundColor: '#c4a06a',
  },
  chipLabel: {
    color: '#c4a06a',
    fontSize: 10,
    fontWeight: '700',
  },
  chipLabelOn: {
    color: '#2c1a10',
  },
  typeBar: {
    marginBottom: 6,
    zIndex: 2,
    maxHeight: 40,
  },
  typeBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 8,
  },
  sketchBar: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
    zIndex: 3,
  },
  captionInput: {
    minWidth: 120,
    minHeight: 28,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8a6230',
    color: '#d8b56a',
    fontSize: 12,
    flexGrow: 1,
  },
  typeChip: {
    minHeight: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#8a6230',
    backgroundColor: '#3a2418',
  },
  typeChipOn: {
    backgroundColor: '#d8b56a',
  },
  typeLabel: {
    color: '#d8b56a',
    fontSize: 11,
    fontWeight: '700',
  },
  typeLabelOn: {
    color: '#3b2414',
  },
  swatch: {
    width: 22,
    height: 22,
    minHeight: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#8a6230',
  },
  swatchOn: {
    borderColor: '#f3e4c4',
    borderWidth: 2,
  },
  dictationWarn: {
    color: '#d8b56a',
    fontFamily: Fonts.serif,
    fontSize: 12,
    marginBottom: 8,
  },
  contentsSheet: {
    zIndex: 4,
    maxHeight: 220,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#3a2418',
    borderWidth: 1,
    borderColor: '#8a6230',
  },
  contentsHeading: {
    fontFamily: Fonts.serif,
    color: '#d8b56a',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  contentsProgress: {
    color: '#c4a06a',
    fontSize: 11,
    marginBottom: 6,
  },
  contentsList: {
    maxHeight: 180,
  },
  contentsRow: {
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  contentsRowOn: {
    backgroundColor: '#d8b56a',
  },
  contentsTitle: {
    color: '#f3e4c4',
    fontFamily: Fonts.serif,
    fontSize: 14,
    fontWeight: '700',
  },
  contentsTitleOn: {
    color: '#3b2414',
  },
  contentsMeta: {
    color: '#c4a06a',
    fontSize: 11,
    marginTop: 2,
  },
  book: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#352014',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#4e2c1a',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
  coverEdge: {
    width: 8,
    backgroundColor: '#120a07',
  },
  spine: {
    width: 16,
    backgroundColor: '#3e2416',
    borderRightWidth: 1,
    borderRightColor: '#1e100a',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 28,
  },
  stitch: {
    width: 9,
    height: 1.5,
    backgroundColor: '#a87840',
    opacity: 0.55,
  },
  pageWell: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#ead6a8',
  },
  pageWellNight: {
    backgroundColor: '#1a140e',
  },
  leafUnder: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    backgroundColor: '#f1e2c0',
  },
  leafOver: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    backgroundColor: '#f1e2c0',
  },
  pageFront: {
    flex: 1,
    backfaceVisibility: 'hidden',
  },
  frontDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#2a160e',
    zIndex: 3,
  },
  pageBack: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden',
    transform: [{ rotateY: '180deg' }],
  },
  pageBackMemoir: {
    backgroundColor: '#ead4a4',
  },
  pageBackField: {
    backgroundColor: '#e8dfc8',
  },
  pageBackFoxing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 14,
    borderColor: 'rgba(140, 96, 52, 0.1)',
  },
  pageBackGrain: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(90, 60, 30, 0.04)',
  },
  foldShade: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
  foldBand: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#1a0e09',
  },
  spineGlow: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 10,
    backgroundColor: '#f3e4c4',
    zIndex: 5,
  },
  bookmarkRibbon: {
    position: 'absolute',
    top: 0,
    right: 28,
    width: 16,
    height: 34,
    backgroundColor: '#8a2e12',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 4,
    zIndex: 6,
  },
  emptyPage: {
    flex: 1,
    backgroundColor: '#f3e4c4',
    paddingLeft: 42,
    paddingRight: 20,
    paddingTop: 36,
    justifyContent: 'center',
  },
  empty: {
    fontFamily: Fonts.serif,
    color: '#3b2414',
    fontSize: 20,
    lineHeight: 30,
    letterSpacing: 0.2,
  },
  folio: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: Fonts.serif,
    color: '#d8b56a',
    fontSize: 12,
  },
});
