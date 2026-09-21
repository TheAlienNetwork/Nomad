import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { FieldButton } from '@/components/field-button';
import { Fonts } from '@/constants/theme';
import { reversePlace } from '@/src/geocode';
import { newId } from '@/src/ids';
import { deleteCloudMemory } from '@/src/cloud-sync';
import { friendlyPagePhotoError, preparePagePhoto } from '@/src/page-photo';
import { captureMemoryPhoto, pickMemoryPhotos, toPagePhotoMeta } from '@/src/pick-photo';
import { useFieldStore, type MemoryPhoto } from '@/src/store';

const GAP = 3;
const COLS = 3;

function monthKey(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'Undated';
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function coordsLabel(memory: MemoryPhoto): string | null {
  if (memory.latitude == null || memory.longitude == null) return null;
  return `${memory.latitude.toFixed(5)}, ${memory.longitude.toFixed(5)}`;
}

type MonthSection = {
  key: string;
  items: MemoryPhoto[];
};

export function MemoryGallery() {
  const memories = useFieldStore((state) => state.memories) ?? [];
  const gps = useFieldStore((state) => state.gps);
  const addMemory = useFieldStore((state) => state.addMemory);
  const updateMemory = useFieldStore((state) => state.updateMemory);
  const removeMemory = useFieldStore((state) => state.removeMemory);
  const showMemoryOnMap = useFieldStore((state) => state.showMemoryOnMap);
  const [openId, setOpenId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const tile = Math.floor((Dimensions.get('window').width - 24 - GAP * (COLS - 1)) / COLS);
  const open = memories.find((item) => item.id === openId);

  const sections = useMemo<MonthSection[]>(() => {
    const groups = new Map<string, MemoryPhoto[]>();
    const ordered = [...memories].sort((left, right) =>
      left.takenAt < right.takenAt ? 1 : left.takenAt > right.takenAt ? -1 : 0,
    );
    for (const item of ordered) {
      const key = monthKey(item.takenAt);
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    return [...groups.entries()].map(([key, items]) => ({ key, items }));
  }, [memories]);

  const persistPicked = async (picked: {
    uri: string;
    width?: number;
    height?: number;
    fileSize?: number;
    latitude?: number;
    longitude?: number;
    takenAt?: string;
  }) => {
    const prepared = await preparePagePhoto(picked.uri, toPagePhotoMeta(picked));
    const latitude = picked.latitude ?? gps.latitude;
    const longitude = picked.longitude ?? gps.longitude;
    const takenAt = picked.takenAt ?? new Date().toISOString();
    const memory: MemoryPhoto = {
      id: newId(),
      uri: prepared,
      takenAt,
      latitude,
      longitude,
      width: picked.width,
      height: picked.height,
      updatedAt: new Date().toISOString(),
    };
    addMemory(memory);
    if (latitude != null && longitude != null && !memory.placeLabel) {
      void reversePlace(latitude, longitude).then((label) => {
        if (label) updateMemory(memory.id, { placeLabel: label });
      });
    }
  };

  const addFromLibrary = async () => {
    try {
      setBanner('Adding photos…');
      const picked = await pickMemoryPhotos();
      if (picked.length === 0) {
        setBanner(null);
        return;
      }
      for (const item of picked) await persistPicked(item);
      setBanner(null);
    } catch (error) {
      setBanner(friendlyPagePhotoError(error).message);
    }
  };

  const addFromCamera = async () => {
    try {
      setBanner('Saving shot…');
      const picked = await captureMemoryPhoto();
      if (!picked) {
        setBanner(null);
        return;
      }
      await persistPicked(picked);
      setBanner(null);
    } catch (error) {
      setBanner(friendlyPagePhotoError(error).message);
    }
  };

  const pinOnMap = (memory: MemoryPhoto) => {
    if (memory.latitude == null || memory.longitude == null) {
      setBanner('Give this photo a location first.');
      return;
    }
    showMemoryOnMap(memory.id);
    router.push('/(tabs)');
  };

  const useGps = (memory: MemoryPhoto) => {
    if (gps.latitude == null || gps.longitude == null) {
      setBanner('No GPS fix yet. Open Hunt and wait for a lock.');
      return;
    }
    updateMemory(memory.id, { latitude: gps.latitude, longitude: gps.longitude });
    void reversePlace(gps.latitude, gps.longitude).then((label) => {
      if (label) updateMemory(memory.id, { placeLabel: label });
    });
  };

  const confirmDelete = (memory: MemoryPhoto) => {
    const run = () => {
      removeMemory(memory.id);
      void deleteCloudMemory(memory.id);
      setOpenId(null);
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Remove this memory?')) run();
      return;
    }
    Alert.alert('Remove memory', 'This stays off the book and off the map.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <FieldButton accessibilityLabel="Add from library" style={styles.tool} onPress={() => void addFromLibrary()}>
          <MaterialIcons name="photo-library" size={16} color="#d8b56a" />
          <Text style={styles.toolLabel}>Library</Text>
        </FieldButton>
        <FieldButton accessibilityLabel="Capture memory" style={styles.tool} onPress={() => void addFromCamera()}>
          <MaterialIcons name="photo-camera" size={16} color="#d8b56a" />
          <Text style={styles.toolLabel}>Camera</Text>
        </FieldButton>
      </View>
      {banner ? <Text style={styles.banner}>{banner}</Text> : null}
      {memories.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Private collection</Text>
          <Text style={styles.emptyCopy}>
            Nothing leaves this collection until you pin it on the map. Photos keep their place and date when the
            file has them.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {sections.map((section) => (
            <View key={section.key} style={styles.section}>
              <Text style={styles.month}>{section.key}</Text>
              <View style={styles.row}>
                {section.items.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={item.caption?.trim() || formatStamp(item.takenAt)}
                    onPress={() => setOpenId(item.id)}
                    style={[styles.tile, { width: tile, height: tile }]}>
                    <Image source={{ uri: item.uri }} style={styles.thumb} contentFit="cover" />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      <Modal visible={Boolean(open)} transparent animationType="fade" onRequestClose={() => setOpenId(null)}>
        {open ? (
          <View style={styles.lightbox}>
            <Image source={{ uri: open.uri }} style={styles.hero} contentFit="contain" />
            <ScrollView style={styles.meta} contentContainerStyle={styles.metaInner}>
              <Text style={styles.stamp}>{formatStamp(open.takenAt)}</Text>
              <Text style={styles.place}>{open.placeLabel?.trim() || 'No place yet'}</Text>
              <Text style={styles.coords}>{coordsLabel(open) ?? 'No coordinates'}</Text>
              <TextInput
                value={open.caption ?? ''}
                onChangeText={(caption) => updateMemory(open.id, { caption })}
                placeholder="Caption"
                placeholderTextColor="#8a7460"
                style={styles.caption}
              />
              <View style={styles.actions}>
                <FieldButton
                  accessibilityLabel="Show on hunt map"
                  style={styles.action}
                  onPress={() => pinOnMap(open)}>
                  <Text style={styles.actionLabel}>Show on Hunt</Text>
                </FieldButton>
                {open.latitude == null ? (
                  <FieldButton accessibilityLabel="Use current GPS" style={styles.action} onPress={() => useGps(open)}>
                    <Text style={styles.actionLabel}>Use GPS</Text>
                  </FieldButton>
                ) : null}
                <FieldButton accessibilityLabel="Remove memory" style={styles.action} onPress={() => confirmDelete(open)}>
                  <Text style={styles.actionLabel}>Remove</Text>
                </FieldButton>
                <FieldButton accessibilityLabel="Close memory" style={styles.action} onPress={() => setOpenId(null)}>
                  <Text style={styles.actionLabel}>Close</Text>
                </FieldButton>
              </View>
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#8a6230',
    backgroundColor: '#3a2418',
  },
  toolLabel: {
    color: '#d8b56a',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  banner: {
    color: '#d8b56a',
    fontFamily: Fonts.serif,
    fontSize: 12,
    marginBottom: 8,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  emptyTitle: {
    fontFamily: Fonts.serif,
    color: '#f3e4c4',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyCopy: {
    fontFamily: Fonts.serif,
    color: '#c4a06a',
    fontSize: 15,
    lineHeight: 22,
  },
  grid: {
    paddingBottom: 24,
    gap: 14,
  },
  section: {
    gap: 8,
  },
  month: {
    fontFamily: Fonts.serif,
    color: '#d8b56a',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  tile: {
    backgroundColor: '#1a100a',
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(8,5,3,0.96)',
    paddingTop: 48,
  },
  hero: {
    width: '100%',
    height: '56%',
    backgroundColor: '#120c08',
  },
  meta: {
    flex: 1,
  },
  metaInner: {
    padding: 16,
    gap: 8,
  },
  stamp: {
    color: '#f3e4c4',
    fontFamily: Fonts.serif,
    fontSize: 18,
    fontWeight: '700',
  },
  place: {
    color: '#d8b56a',
    fontFamily: Fonts.serif,
    fontSize: 14,
  },
  coords: {
    color: '#8a7460',
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  caption: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#8a6230',
    borderRadius: 8,
    paddingHorizontal: 10,
    color: '#f3e4c4',
    fontFamily: Fonts.serif,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  action: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#8a6230',
    backgroundColor: '#3a2418',
  },
  actionLabel: {
    color: '#d8b56a',
    fontWeight: '700',
    fontSize: 12,
  },
});
