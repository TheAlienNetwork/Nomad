import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  defaultPackSelection,
  estimateOverlayPack,
  overlaysForState,
  packExtentForState,
  sanitizePackSelection,
  type OverlayId,
} from '@huntos/core';
import { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FieldButton } from '@/components/field-button';
import { Colors, Nomad } from '@/constants/theme';
import { signOut, useCloudSession } from '@/src/cloud-sync';
import { downloadBasemapForView, downloadSelectedPack } from '@/src/overlay-pack';
import { pickPhotoUri } from '@/src/pick-photo';
import { STATE_HUNT_GUIDES, stateHuntGuide } from '@/src/state-hunting';
import { useFieldStore } from '@/src/store';

type ProfileTab = 'you' | 'regs';

export default function ProfileScreen() {
  const router = useRouter();
  const session = useCloudSession();
  const hunterState = useFieldStore((state) => state.hunterState);
  const photo = useFieldStore((state) => state.profilePhotoUri);
  const setHunterState = useFieldStore((state) => state.setHunterState);
  const setPackSelection = useFieldStore((state) => state.setPackSelection);
  const layers = useFieldStore((state) => state.layers);
  const packSelection = useFieldStore((state) => state.packSelection);
  const packStatus = useFieldStore((state) => state.packStatus);
  const packCachedIds = useFieldStore((state) => state.packCachedIds);
  const packLastDownloaded = useFieldStore((state) => state.packLastDownloaded);
  const setProfilePhoto = useFieldStore((state) => state.setProfilePhoto);
  const [tab, setTab] = useState<ProfileTab>('you');
  const [query, setQuery] = useState('');
  const guide = stateHuntGuide(hunterState);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return STATE_HUNT_GUIDES;
    return STATE_HUNT_GUIDES.filter(
      (item) =>
        item.code.toLowerCase().includes(needle) ||
        item.name.toLowerCase().includes(needle),
    );
  }, [query]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.kicker}>NOMAD</Text>
          <Text style={styles.title}>You</Text>
          <Text style={styles.subtitle}>
            {tab === 'you'
              ? session.email ?? 'Signed-in hunter profile'
              : 'Official agency links. Season dates stay unknown in Nomad.'}
          </Text>
        </View>

        <View style={styles.tabs}>
          <FieldButton
            accessibilityLabel="Profile"
            style={[styles.tab, tab === 'you' && styles.tabOn]}
            onPress={() => setTab('you')}>
            <Text style={[styles.tabLabel, tab === 'you' && styles.tabLabelOn]}>Profile</Text>
          </FieldButton>
          <FieldButton
            accessibilityLabel="Hunting rules"
            style={[styles.tab, tab === 'regs' && styles.tabOn]}
            onPress={() => setTab('regs')}>
            <Text style={[styles.tabLabel, tab === 'regs' && styles.tabLabelOn]}>Rules</Text>
          </FieldButton>
        </View>

        {tab === 'you' ? (
          <>
            <FieldButton
              accessibilityLabel="Choose profile photo"
              style={styles.photoHit}
              onPress={() => {
                void (async () => {
                  const uri = await pickPhotoUri();
                  if (uri) setProfilePhoto({ uri, storagePath: undefined });
                })();
              }}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.photo} />
              ) : (
                <View style={styles.photoEmpty}>
                  <MaterialIcons name="person" size={42} color={Nomad.mist} />
                  <Text style={styles.photoLabel}>Add photo</Text>
                </View>
              )}
            </FieldButton>
            <Text style={styles.email}>{session.email}</Text>
            <Text style={styles.quiet}>Saved to your account when you are online.</Text>

            <Text style={styles.group}>Home state</Text>
            {guide ? (
              <View style={styles.homeCard}>
                <View style={styles.homeMark}>
                  <Text style={styles.homeCode}>{guide.code}</Text>
                </View>
                <View style={styles.homeCopy}>
                  <Text style={styles.homeKicker}>HOME</Text>
                  <Text style={styles.homeName}>{guide.name}</Text>
                  <Text style={styles.homeAgency}>{guide.agency}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.quiet}>Pick the state you hunt. Overlay packs follow that home state.</Text>
            )}
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search states"
              placeholderTextColor={Colors.dark.muted}
              style={styles.input}
            />
            <View style={styles.roster}>
              {matches.map((item) => {
                const on = hunterState === item.code;
                return (
                  <FieldButton
                    key={item.code}
                    accessibilityLabel={item.name}
                    style={[styles.rosterRow, on && styles.rosterRowOn]}
                    onPress={() => {
                      setHunterState(item.code);
                      setPackSelection(defaultPackSelection(item.code, layers));
                    }}>
                    <Text style={styles.rosterCode}>{item.code}</Text>
                    <View style={styles.rosterCopy}>
                      <Text style={[styles.rosterName, on && styles.rosterNameOn]}>{item.name}</Text>
                      <Text style={styles.rosterAgency} numberOfLines={1}>
                        {item.agency}
                      </Text>
                    </View>
                    {on ? <Text style={styles.rosterTick}>●</Text> : null}
                  </FieldButton>
                );
              })}
            </View>
            {guide ? (
              <FieldPackCard
                hunterState={guide.code}
                packSelection={packSelection}
                packCachedIds={packCachedIds}
                packStatus={packStatus}
                packLastDownloaded={packLastDownloaded}
                onChange={setPackSelection}
              />
            ) : null}

            <FieldButton
              accessibilityLabel="Privacy"
              style={styles.ghost}
              onPress={() => router.push('/privacy')}>
              <Text style={styles.ghostLabel}>Privacy</Text>
            </FieldButton>
            <FieldButton
              accessibilityLabel="Sign out"
              style={styles.signOut}
              onPress={() => {
                void signOut();
              }}>
              <Text style={styles.signOutLabel}>Sign out</Text>
            </FieldButton>
            <Text style={styles.warn}>
              Internal preview — not a legal land-access, season, or permission tool.
            </Text>
          </>
        ) : tab === 'regs' ? (
          <RegsPanel />
        ) : (
          (() => {
            const _exhaustive: never = tab;
            return _exhaustive;
          })()
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FieldPackCard({
  hunterState,
  packSelection,
  packCachedIds,
  packStatus,
  packLastDownloaded,
  onChange,
}: {
  hunterState: string;
  packSelection: OverlayId[];
  packCachedIds: OverlayId[];
  packStatus?: { overlayId: OverlayId; done: number; total: number; label: string };
  packLastDownloaded?: string;
  onChange: (ids: OverlayId[]) => void;
}) {
  const basemapCachedAt = useFieldStore((state) => state.basemapCachedAt);
  const basemapCachedSlug = useFieldStore((state) => state.basemapCachedSlug);
  const mapBounds = useFieldStore((state) => state.mapBounds);
  const available = overlaysForState(hunterState);
  const extent = packExtentForState(hunterState);
  const checked = sanitizePackSelection(hunterState, packSelection);
  const estimate = extent ? estimateOverlayPack(extent, checked) : undefined;
  const mb = estimate ? Math.max(1, Math.round(estimate.estimatedBytes / 1_000_000)) : 0;

  return (
    <View style={styles.pack}>
      <Text style={styles.group}>Field pack</Text>
      <FieldButton
        accessibilityLabel="Save basemap for this view"
        style={styles.signOut}
        onPress={() => {
          void downloadBasemapForView();
        }}>
        <Text style={styles.signOutLabel}>Save map for this view</Text>
      </FieldButton>
      <Text style={styles.warn}>
        Saves the basemap you have open on Hunt for the current view, plus one zoom in and out. Missing
        tiles stay blank offline. Waypoints and your track already stay on the phone.
      </Text>
      {!mapBounds ? (
        <Text style={styles.quiet}>Open the Hunt map once so Nomad knows the view.</Text>
      ) : null}
      {basemapCachedAt ? (
        <Text style={styles.quiet}>
          Basemap {basemapCachedSlug ?? ''} cached {basemapCachedAt}
        </Text>
      ) : null}
      {!extent ? (
        <Text style={styles.warn}>
          Statewide overlay packs are Texas-first. National layers still display on the Hunt map.
        </Text>
      ) : (
        <>
          <View style={styles.packActions}>
            <FieldButton
              accessibilityLabel="Select all overlays"
              style={styles.ghost}
              onPress={() => onChange(available.map((item) => item.id))}>
              <Text style={styles.ghostLabel}>Select all</Text>
            </FieldButton>
            <FieldButton
              accessibilityLabel="Clear overlay selection"
              style={styles.ghost}
              onPress={() => onChange([])}>
              <Text style={styles.ghostLabel}>None</Text>
            </FieldButton>
          </View>
          {available.map((item) => {
            const on = checked.includes(item.id);
            const ready = packCachedIds.includes(item.id);
            return (
              <FieldButton
                key={item.id}
                accessibilityLabel={item.label}
                style={styles.packRow}
                onPress={() =>
                  onChange(on ? checked.filter((id) => id !== item.id) : [...checked, item.id])
                }>
                <Text style={styles.packCheck}>{on ? '☑' : '☐'}</Text>
                <Text style={styles.packLabel}>{item.label}</Text>
                {ready ? <Text style={styles.packReady}>READY</Text> : null}
              </FieldButton>
            );
          })}
          <Text style={styles.warn}>
            ~{mb} MB · z{estimate?.minZoom}–{estimate?.maxZoom} for dense layers. Cached GIS for
            scouting. Not seasons, bag limits, fences, or permission.
          </Text>
          {packStatus ? (
            <Text style={styles.quiet}>
              {packStatus.label} {packStatus.done}/{packStatus.total}
            </Text>
          ) : null}
          {packLastDownloaded ? (
            <Text style={styles.quiet}>Last cached {packLastDownloaded}</Text>
          ) : null}
          <FieldButton
            accessibilityLabel="Download selected overlays"
            style={styles.signOut}
            onPress={() => {
              void downloadSelectedPack();
            }}>
            <Text style={styles.signOutLabel}>Download selected</Text>
          </FieldButton>
        </>
      )}
    </View>
  );
}

function RegsPanel() {
  const hunterState = useFieldStore((state) => state.hunterState);
  const guide = stateHuntGuide(hunterState);

  if (!guide) {
    return (
      <View style={styles.card}>
        <Text style={styles.body}>Pick a home state on Profile first.</Text>
        <Text style={styles.quiet}>
          Nomad does not store season dates, bag limits, or permission. Open the official wildlife agency page for your state.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.regsTitle}>{guide.name}</Text>
      <Text style={styles.body}>{guide.agency}</Text>
      <Text style={styles.warn}>
        Season start and end dates, bag limits, and legal access are unknown in Nomad until an official structured source is imported. Open the agency page for the current Outdoor Annual / hunting regulations.
      </Text>
      <FieldButton
        accessibilityLabel={`Open ${guide.agency} hunting page`}
        style={styles.signOut}
        onPress={() => {
          void WebBrowser.openBrowserAsync(guide.huntingUrl);
        }}>
        <Text style={styles.signOutLabel}>Open official hunting page</Text>
      </FieldButton>
      <Text style={styles.quiet}>{guide.huntingUrl}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Nomad.ink,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Nomad.line,
  },
  kicker: {
    color: Nomad.rust,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
  },
  title: {
    color: Nomad.bone,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  subtitle: {
    color: Colors.dark.muted,
    fontSize: 14,
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Nomad.line,
    backgroundColor: Nomad.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabOn: {
    backgroundColor: Nomad.rust,
    borderColor: Nomad.rust,
  },
  tabLabel: {
    color: Nomad.bone,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  tabLabelOn: {
    color: '#fff',
  },
  photoHit: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  photo: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 2,
    borderColor: Nomad.line,
  },
  photoEmpty: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1,
    borderColor: Nomad.line,
    backgroundColor: Nomad.steel,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoLabel: {
    color: Nomad.mist,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  email: {
    color: Nomad.bone,
    fontWeight: '700',
    textAlign: 'center',
  },
  quiet: {
    color: Colors.dark.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  group: {
    color: Nomad.mist,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  homeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Nomad.line,
    backgroundColor: Nomad.steel,
    marginBottom: 10,
  },
  homeMark: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Nomad.rust,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Nomad.ink,
  },
  homeCode: {
    color: Nomad.rust,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
  },
  homeCopy: {
    flex: 1,
  },
  homeKicker: {
    color: Nomad.rust,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  homeName: {
    color: Nomad.bone,
    fontSize: 20,
    fontWeight: '800',
  },
  homeAgency: {
    color: Nomad.mist,
    fontSize: 12,
    marginTop: 2,
  },
  roster: {
    gap: 6,
    marginBottom: 8,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Nomad.line,
    backgroundColor: Nomad.steel,
  },
  rosterRowOn: {
    borderColor: Nomad.rust,
    backgroundColor: 'rgba(241,90,36,0.12)',
  },
  rosterCode: {
    width: 32,
    color: Nomad.rust,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  rosterCopy: {
    flex: 1,
  },
  rosterName: {
    color: Nomad.mist,
    fontSize: 15,
    fontWeight: '700',
  },
  rosterNameOn: {
    color: Nomad.bone,
  },
  rosterAgency: {
    color: Colors.dark.muted,
    fontSize: 11,
  },
  rosterTick: {
    color: Nomad.rust,
    fontSize: 12,
  },
  pack: {
    marginTop: 8,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Nomad.line,
    backgroundColor: Nomad.steel,
  },
  packActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
  },
  packCheck: {
    color: Nomad.rust,
    fontSize: 16,
    width: 22,
  },
  packLabel: {
    flex: 1,
    color: Nomad.bone,
    fontSize: 14,
  },
  packReady: {
    color: '#86efac',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  input: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Nomad.steel,
    color: Nomad.bone,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Nomad.line,
    backgroundColor: Nomad.steel,
  },
  chipOn: {
    backgroundColor: Nomad.rust,
    borderColor: Nomad.rust,
  },
  chipLabel: {
    color: Nomad.mist,
    fontSize: 12,
    fontWeight: '700',
  },
  chipLabelOn: {
    color: '#fff',
  },
  ghost: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Nomad.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  ghostLabel: {
    color: Nomad.bone,
    fontWeight: '700',
  },
  signOut: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: Nomad.rust,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  signOutLabel: {
    color: '#fff',
    fontWeight: '800',
  },
  warn: {
    color: '#ffd166',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  card: {
    backgroundColor: Nomad.steel,
    borderColor: Nomad.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  regsTitle: {
    color: Nomad.bone,
    fontSize: 18,
    fontWeight: '800',
  },
  body: {
    color: Colors.dark.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
