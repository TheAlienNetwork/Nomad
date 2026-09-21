import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  HARVEST_HEAT_DISCLAIMER,
  SPECIES,
  SPECIES_LABELS,
  WAYPOINT_TYPE_LABELS,
  WAYPOINT_TYPES,
  describeLandStatus,
  describeParcelStatus,
  formatBearing,
  formatDistance,
  formatLengthFeet,
  haversineMeters,
  initialBearingDegrees,
  overlayGroupLabel,
  overlaysForState,
  isOverlayId,
  overlayDefinition,
  stateHuntGuide,
  type SpeciesId,
  type WaypointType,
} from '@huntos/core';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FieldButton } from '@/components/field-button';
import {
  AreasSheet,
  MarkExtras,
  MeasureHud,
  RecoverySheet,
  WeatherSheet,
  WindSheet,
} from '@/components/field-tools';
import { SheetTopo } from '@/components/sheet-topo';
import { Nomad } from '@/constants/theme';
import { huntosApiConfigured } from '@/src/api';
import { searchPlaces, type PlaceHit } from '@/src/geocode';
import { shareOrCopy } from '@/src/share-pin';
import {
  formatCoordinates,
  formatDdm,
  formatDuration,
  formatPace,
  formatRadiusYards,
  temperatureLabel,
  windLabel,
  yardsToMeters,
} from '@/src/format';
import {
  activeHunt,
  activeTrack,
  type BasemapId,
  type GpsRingIntel,
  type GpsRingKind,
  type LayerState,
  type MapTheme,
  type NeraStyle,
  type ScoutColor,
  type SheetId,
  useFieldStore,
} from '@/src/store';
import { locateOnce } from '@/src/use-field-location';
import { attachPickedWaypointPhoto, prepareDraftWaypointPhoto } from '@/src/waypoint-photo';

const MARK_TYPES: WaypointType[] = [
  'harvest',
  ...WAYPOINT_TYPES.filter((type) => type !== 'harvest'),
];

const SCOUT_SWATCHES: Array<{ id: ScoutColor; fill: string }> = [
  { id: 'rust', fill: '#F15A24' },
  { id: 'gold', fill: '#e6a31a' },
  { id: 'teal', fill: '#2a9d8f' },
  { id: 'violet', fill: '#7c3aed' },
];

function gpsLabel(source: 'gps' | 'operator' | 'none', accuracy?: number | null, error?: string): string {
  if (error || source === 'none') return 'NO FIX';
  if (typeof accuracy === 'number') return `±${formatLengthFeet(accuracy)}`;
  return source === 'gps' ? 'GPS' : 'MAP';
}

function neraScaleMeters(bounds?: { south: number; north: number }): number {
  if (!bounds) return 250;
  const latSpan = Math.max(1e-6, bounds.north - bounds.south);
  const zoom = Math.min(18.5, Math.max(8, Math.log2(180 / latSpan)));
  if (zoom >= 16) return 50;
  if (zoom >= 14) return 100;
  if (zoom >= 12) return 250;
  return 500;
}

function gpsRingHudLine(intel: GpsRingIntel | null): string | null {
  if (!intel) return null;
  const kind = resolveGpsRingKind(intel.kind);
  switch (kind) {
    case 'high':
    case 'low':
      return intel.label;
    case 'level':
      return null;
    default: {
      const _exhausted: never = kind;
      return _exhausted;
    }
  }
}

function resolveGpsRingKind(kind: GpsRingKind): GpsRingKind {
  switch (kind) {
    case 'high':
    case 'low':
    case 'level':
      return kind;
    default: {
      const _exhausted: never = kind;
      return _exhausted;
    }
  }
}

function exagAccent(neraMode: boolean, neraStyle: NeraStyle, mapTheme: MapTheme): string {
  if (neraMode) {
    switch (neraStyle) {
      case 'wire':
        return '#7af6ff';
      case 'glass':
        return '#22d3ee';
      default: {
        const _exhausted: never = neraStyle;
        return _exhausted;
      }
    }
  }
  switch (mapTheme) {
    case 'light':
      return '#4a6b58';
    case 'dark':
      return '#e6a31a';
    default: {
      const _exhausted: never = mapTheme;
      return _exhausted;
    }
  }
}

export function FieldChrome() {
  const insets = useSafeAreaInsets();
  const sheet = useFieldStore((state) => state.sheet);
  const live = Boolean(useFieldStore((state) => state.activeHuntId));
  const neraMode = useFieldStore((state) => state.neraMode);
  const neraStyle = useFieldStore((state) => state.neraStyle);
  const cameraMode = useFieldStore((state) => state.cameraMode);
  const mapBounds = useFieldStore((state) => state.mapBounds);

  useEffect(() => {
    if (!mapBounds) return;
    if (cameraMode === 'flat' && !neraMode) return;
    const timer = setTimeout(() => {
      void useFieldStore.getState().runTerrainAnalyze({ silent: true });
    }, 1200);
    return () => clearTimeout(timer);
  }, [neraMode, cameraMode, mapBounds]);

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[styles.topWrap, { paddingTop: Math.max(insets.top, 6) }]}>
        <TopHud />
        <SearchBar />
        {live ? <LiveMetrics /> : null}
      </View>
      <PinCard />
      <NeraAiCard />
      {neraMode ? (
        <View
          pointerEvents="none"
          style={[styles.neraFrame, neraStyle === 'wire' ? styles.neraFrameWire : null]}
        />
      ) : null}
      <View
        pointerEvents="box-none"
        style={[
          styles.stackWrap,
          { bottom: Math.max(insets.bottom, 8) },
        ]}>
        <DrawBar />
        <QuickMarks />
        <ToolStack />
      </View>
      <ScoutHud bottom={Math.max(insets.bottom, 8)} />
      <MeasureHud bottom={Math.max(insets.bottom, 8) + 52} />
      {renderSheet(sheet)}
    </>
  );
}

function TopHud() {
  const online = useFieldStore((state) => state.online);
  const gps = useFieldStore((state) => state.gps);
  const weather = useFieldStore((state) => state.weather);

  return (
    <FieldButton
      style={styles.chip}
      onPress={() => void useFieldStore.getState().openWeather()}>
      <View style={styles.mark}>
        <MaterialIcons name="terrain" size={13} color={Nomad.rust} />
      </View>
      <Text style={styles.chipText}>
        {gps.latitude != null && gps.longitude != null
          ? formatDdm(gps.latitude, gps.longitude)
          : gpsLabel(gps.source, gps.accuracy, gps.error)}
      </Text>
      <Text style={styles.chipDot}>·</Text>
      <Text style={styles.chipText}>{temperatureLabel(weather)}</Text>
      <Text style={styles.chipDot}>·</Text>
      <Text style={styles.chipText}>{windLabel(weather)}</Text>
      <Text style={styles.chipDot}>·</Text>
      <Text style={[styles.chipText, online ? styles.ok : styles.warn]}>
        {online ? 'LIVE' : 'OFF-GRID'}
      </Text>
    </FieldButton>
  );
}

function NeraAiCard() {
  const nera = useFieldStore((state) => state.neraMode);
  const neraStyle = useFieldStore((state) => state.neraStyle);
  const gps = useFieldStore((state) => state.gps);
  const weather = useFieldStore((state) => state.weather);
  const mapBounds = useFieldStore((state) => state.mapBounds);
  const mark = useFieldStore((state) =>
    state.waypoints.find((item) => item.id === state.selectedWaypointId),
  );
  const features = useFieldStore((state) => state.terrainOverlay);
  const gpsRingIntel = useFieldStore((state) => state.gpsRingIntel);
  if (!nera) return null;
  const wire = neraStyle === 'wire';
  const lock =
    gps.source === 'none' || gps.latitude == null || gps.longitude == null
      ? 'NO FIX'
      : gps.source === 'operator'
        ? 'MAP'
        : typeof gps.accuracy === 'number'
          ? gps.accuracy <= 8
            ? 'LOCK'
            : gps.accuracy <= 25
              ? 'TRACK'
              : 'DEGRADED'
          : 'LOCK';
  const origin =
    gps.latitude != null && gps.longitude != null
      ? { latitude: gps.latitude, longitude: gps.longitude }
      : null;
  const yards = origin && mark ? Math.round(haversineMeters(origin, mark) / 0.9144) : null;
  const bearing = origin && mark ? formatBearing(initialBearingDegrees(origin, mark)) : null;
  const intel = features.slice(0, 3).map((item) => item.label);
  const heading = typeof gps.heading === 'number' && Number.isFinite(gps.heading) ? Math.round(gps.heading) : null;
  const ringLine = gpsRingHudLine(gpsRingIntel);
  return (
    <View style={[styles.neraAi, wire ? styles.neraAiWire : null]} pointerEvents="none">
      <View style={styles.neraHead}>
        <Text style={styles.neraKicker}>{wire ? 'NERA WIRE · HUNT / NAV' : 'NERA AI · HUNT / NAV'}</Text>
        <Text style={styles.neraLock}>{lock}</Text>
      </View>
      <Text style={styles.neraLine}>
        {gps.latitude != null && gps.longitude != null
          ? formatDdm(gps.latitude, gps.longitude)
          : 'Awaiting high-end GPS'}
      </Text>
      <View style={styles.neraGrid}>
        <View style={styles.neraCell}>
          <Text style={styles.neraCellLabel}>HDG</Text>
          <Text style={styles.neraCellValue}>{heading != null ? `${heading}°` : '—'}</Text>
        </View>
        <View style={styles.neraCell}>
          <Text style={styles.neraCellLabel}>ELV</Text>
          <Text style={styles.neraCellValue}>
            {typeof gps.altitude === 'number' ? formatLengthFeet(gps.altitude) : '—'}
          </Text>
        </View>
        <View style={styles.neraCell}>
          <Text style={styles.neraCellLabel}>CEP</Text>
          <Text style={styles.neraCellValue}>
            {typeof gps.accuracy === 'number' ? `±${formatLengthFeet(gps.accuracy)}` : '—'}
          </Text>
        </View>
        <View style={styles.neraCell}>
          <Text style={styles.neraCellLabel}>{wire ? 'SCALE' : 'SRC'}</Text>
          <Text style={styles.neraCellValue}>
            {wire
              ? `${neraScaleMeters(mapBounds)} m`
              : gps.source === 'gps'
                ? 'GNSS'
                : gps.source === 'operator'
                  ? 'MAP'
                  : '—'}
          </Text>
        </View>
      </View>
      <Text style={styles.neraLine}>
        {mark ? `NAV ${yards ?? '—'} yd ${bearing ?? ''} · ${mark.name}` : 'NAV — mark a pin to vector'}
      </Text>
      {ringLine ? <Text style={styles.neraLine}>{ringLine}</Text> : null}
      <Text style={styles.neraLine}>
        {intel.length > 0 ? `INTEL ${intel.join(' · ')}` : 'INTEL scanning sampled DEM'}
      </Text>
      <Text style={styles.neraLine}>{`WX ${temperatureLabel(weather)} · ${windLabel(weather)}`}</Text>
      <Text style={styles.neraNote}>Next-gen hunt / nav · inferred, not lidar</Text>
    </View>
  );
}

function LiveMetrics() {
  const hunt = useFieldStore(activeHunt);
  const track = useFieldStore(activeTrack);
  const gps = useFieldStore((state) => state.gps);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!hunt) return null;
  const distance = track?.distanceMeters ?? hunt.distanceMeters ?? 0;
  const accuracy =
    typeof gps.accuracy === 'number' ? `±${formatLengthFeet(gps.accuracy)}` : '±—';

  return (
    <View style={styles.metrics}>
      <Text style={styles.metric}>{formatDistance(distance)}</Text>
      <Text style={styles.metric}>{formatDuration(hunt.startedAt, now)}</Text>
      <Text style={styles.metric}>{formatPace(distance, hunt.startedAt, now)}</Text>
      <Text style={styles.metric}>{accuracy}</Text>
    </View>
  );
}

function ToolStack() {
  const [more, setMore] = useState(false);
  const live = Boolean(useFieldStore((state) => state.activeHuntId));
  const follow = useFieldStore((state) => state.followGps);
  const radiusMode = useFieldStore((state) => state.radiusMode);
  const parked = Boolean(useFieldStore((state) => state.truckWaypointId));
  const measureMode = useFieldStore((state) => state.measureMode);
  const drawMode = useFieldStore((state) => state.drawMode);
  const headingUp = useFieldStore((state) => state.headingUp);
  const cameraMode = useFieldStore((state) => state.cameraMode);
  const mapTheme = useFieldStore((state) => state.mapTheme);
  const neraMode = useFieldStore((state) => state.neraMode);
  const neraStyle = useFieldStore((state) => state.neraStyle);
  const selectedId = useFieldStore((state) => state.selectedWaypointId);
  const compassRay = useFieldStore((state) => state.layers.compassRay);
  const windCone = useFieldStore((state) => state.layers.windCone);
  const gpsRingIntel = useFieldStore((state) => state.gpsRingIntel);
  const ringLine = gpsRingHudLine(gpsRingIntel);

  return (
    <View style={styles.stack}>
      {ringLine && cameraMode !== 'flat' ? (
        <View style={styles.modeChip}>
          <Text style={styles.modeLabel}>{ringLine}</Text>
        </View>
      ) : null}
      {radiusMode ? (
        <View style={styles.modeChip}>
          <Text style={styles.modeLabel}>SCOUT · tap map to drop</Text>
        </View>
      ) : null}
      {measureMode ? (
        <View style={styles.modeChip}>
          <Text style={styles.modeLabel}>MEASURE · tap two marks</Text>
        </View>
      ) : null}
      {drawMode ? (
        <View style={styles.modeChip}>
          <Text style={styles.modeLabel}>DRAW · tap vertices · save your area</Text>
        </View>
      ) : null}

      <IconTool
        icon="layers"
        label="Layers"
        onPress={() => useFieldStore.getState().openSheet('layers')}
      />
      <IconTool
        icon={selectedId ? 'edit-location-alt' : 'add-location-alt'}
        label={selectedId ? 'Edit mark' : 'Mark'}
        active={Boolean(selectedId)}
        onPress={() => {
          const store = useFieldStore.getState();
          if (store.selectedWaypointId) store.openWaypoint(store.selectedWaypointId);
          else store.openSheet('waypoint');
        }}
      />
      <IconTool
        icon="straighten"
        label="Measure"
        active={measureMode}
        onPress={() => {
          const store = useFieldStore.getState();
          store.setMeasureMode(!store.measureMode);
        }}
      />
      <IconTool
        icon="air"
        label="Wind"
        active={windCone}
        onPress={() => {
          const store = useFieldStore.getState();
          if (!store.layers.windCone) store.toggleLayer('windCone');
          store.openSheet('wind');
          const latitude = store.gps.latitude ?? store.tapPoint?.latitude;
          const longitude = store.gps.longitude ?? store.tapPoint?.longitude;
          if (latitude != null && longitude != null) {
            void store.refreshWeather(latitude, longitude);
          }
        }}
      />
      <IconTool
        icon="adjust"
        label="Scout"
        active={radiusMode}
        onPress={() => {
          const store = useFieldStore.getState();
          if (store.radiusMode) {
            store.setRadiusMode(false);
            return;
          }
          store.setRadiusMode(true);
          store.closeSheet();
        }}
      />
      <IconTool
        icon={parked ? 'turn-sharp-left' : 'local-parking'}
        label={parked ? 'Return' : 'Park'}
        onPress={() => {
          const store = useFieldStore.getState();
          if (parked) store.computeReturn();
          else store.parkHere();
        }}
      />
      <IconTool
        icon="my-location"
        label={follow ? (cameraMode === 'fpv' ? 'Recenter' : 'Stop follow') : 'Locate'}
        active={follow}
        onPress={() => {
          if (cameraMode === 'fpv') {
            const store = useFieldStore.getState();
            store.setFpvHeadingLock(true);
            store.setFollowGps(true);
            return;
          }
          void locateOnce();
        }}
      />
      <IconTool
        icon="more-horiz"
        label="More tools"
        active={more}
        onPress={() => setMore((value) => !value)}
      />
      {more ? (
        <>
          <IconTool
            icon="map"
            label="2D map"
            active={cameraMode === 'flat'}
            onPress={() => useFieldStore.getState().setCameraMode('flat')}
          />
          <IconTool
            icon="terrain"
            label="3D orbit"
            active={cameraMode === 'orbit'}
            onPress={() =>
              useFieldStore.getState().setCameraMode(cameraMode === 'orbit' ? 'flat' : 'orbit')
            }
          />
          <IconTool
            icon="visibility"
            label={cameraMode === 'fpv' ? 'Exit FPV' : 'First person'}
            active={cameraMode === 'fpv'}
            onPress={() => {
              const store = useFieldStore.getState();
              if (store.gps.latitude == null) return;
              store.setCameraMode(cameraMode === 'fpv' ? 'orbit' : 'fpv');
            }}
          />
          {cameraMode !== 'flat' ? (
            <>
              <IconTool
                icon="dark-mode"
                label="Dark mesh"
                active={mapTheme === 'dark'}
                onPress={() => useFieldStore.getState().setMapTheme('dark')}
              />
              <IconTool
                icon="light-mode"
                label="Light mesh"
                active={mapTheme === 'light'}
                onPress={() => useFieldStore.getState().setMapTheme('light')}
              />
              <IconTool
                icon="blur-on"
                label="Nera"
                active={neraMode}
                onPress={() => useFieldStore.getState().setNeraMode(!neraMode)}
              />
              {neraMode ? (
                <>
                  <IconTool
                    icon="blur-on"
                    label="Glass"
                    active={neraStyle === 'glass'}
                    onPress={() => useFieldStore.getState().setNeraStyle('glass')}
                  />
                  <IconTool
                    icon="grid-on"
                    label="Wire"
                    active={neraStyle === 'wire'}
                    onPress={() => useFieldStore.getState().setNeraStyle('wire')}
                  />
                </>
              ) : null}
              <IconTool
                icon="analytics"
                label="Scan terrain"
                onPress={() => {
                  const store = useFieldStore.getState();
                  store.openSheet('terrain');
                  void store.runTerrainAnalyze();
                }}
              />
            </>
          ) : null}
          <IconTool
            icon="explore"
            label={headingUp ? 'North up' : 'Heading up'}
            active={headingUp}
            onPress={() => useFieldStore.getState().setHeadingUp(!headingUp)}
          />
          <IconTool
            icon="navigation"
            label="Compass ray"
            active={compassRay}
            onPress={() => useFieldStore.getState().toggleLayer('compassRay')}
          />
          <IconTool
            icon="satellite"
            label="Peek satellite"
            onPressIn={() => {
              const current = useFieldStore.getState().basemap;
              useFieldStore.getState().setPeekBasemap(current === 'satellite' ? 'topo' : 'satellite');
            }}
            onPressOut={() => useFieldStore.getState().setPeekBasemap(null)}
            onPress={() => undefined}
          />
          <IconTool
            icon="timeline"
            label="Draw area"
            active={drawMode}
            onPress={() => {
              const store = useFieldStore.getState();
              store.setDrawMode(!store.drawMode);
            }}
          />
          <IconTool
            icon="event"
            label="Plan hunt"
            onPress={() => useFieldStore.getState().openSheet('plan')}
          />
          <IconTool
            icon={live ? 'stop' : 'fiber-manual-record'}
            label={live ? 'End hunt' : 'Record'}
            recording={live}
            onPress={() => {
              const store = useFieldStore.getState();
              if (store.activeHuntId) store.endHunt();
              else store.startHunt();
            }}
          />
        </>
      ) : null}
    </View>
  );
}

function IconTool({
  icon,
  label,
  onPress,
  onPressIn,
  onPressOut,
  active,
  recording,
}: {
  icon: ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  onPress: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  active?: boolean;
  recording?: boolean;
}) {
  return (
    <FieldButton
      glass
      accessibilityLabel={label}
      style={[styles.iconBtn, active && styles.iconBtnOn, recording && styles.iconBtnRec]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}>
      <MaterialIcons
        name={icon}
        size={16}
        color={recording ? '#FFFFFF' : active ? '#7af6ff' : Nomad.mist}
      />
    </FieldButton>
  );
}

function SearchBar() {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      return;
    }
    const timer = setTimeout(() => {
      void searchPlaces(trimmed)
        .then(setHits)
        .catch(() => setHits([]));
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <View style={styles.searchWrap}>
      <TextInput
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setOpen(true);
        }}
        placeholder="Search a place or paste lat, lng"
        placeholderTextColor="#7A7A7A"
        style={styles.searchInput}
        onFocus={() => setOpen(true)}
        returnKeyType="search"
        onSubmitEditing={() => {
          void searchPlaces(query)
            .then(setHits)
            .catch(() => setHits([]));
        }}
      />
      {open && hits.length > 0 ? (
        <View style={styles.searchHits}>
          {hits.map((hit) => (
            <FieldButton
              key={`${hit.latitude}-${hit.longitude}-${hit.label}`}
              style={styles.searchHit}
              onPress={() => {
                useFieldStore.getState().requestFlyTo(hit.latitude, hit.longitude, 14);
                setOpen(false);
                setQuery(hit.label);
              }}>
              <Text style={styles.searchHitLabel} numberOfLines={2}>
                {hit.label}
              </Text>
            </FieldButton>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function QuickMarks() {
  const draft = useFieldStore((state) => state.draftWaypointType);
  const types: WaypointType[] = ['stand', 'blind', 'trail_camera', 'truck', 'harvest'];
  return (
    <ScrollView horizontal style={styles.quickRow} contentContainerStyle={styles.typeContent}>
      {types.map((type) => (
        <FieldButton
          key={type}
          style={[styles.chipChoice, draft === type && styles.chipOn]}
          onPress={() => useFieldStore.getState().setDraftWaypointType(type)}>
          <Text style={[styles.chipLabel, draft === type && styles.chipLabelOn]}>
            {type === 'harvest' ? 'Kill' : WAYPOINT_TYPE_LABELS[type]}
          </Text>
        </FieldButton>
      ))}
    </ScrollView>
  );
}

function PinCard() {
  const id = useFieldStore((state) => state.selectedWaypointId);
  const sheet = useFieldStore((state) => state.sheet);
  const mark = useFieldStore((state) => state.waypoints.find((item) => item.id === id));
  const gps = useFieldStore((state) => state.gps);
  const parked = Boolean(useFieldStore((state) => state.truckWaypointId));
  if (!mark || sheet === 'mark') return null;
  const origin =
    gps.latitude != null && gps.longitude != null
      ? { latitude: gps.latitude, longitude: gps.longitude }
      : null;
  const yards = origin ? Math.round(haversineMeters(origin, mark) / 0.9144) : null;
  const bearing = origin ? formatBearing(initialBearingDegrees(origin, mark)) : null;
  return (
    <View style={styles.pinCard} pointerEvents="box-none">
      <Text style={styles.pinTitle}>{mark.name}</Text>
      <Text style={styles.pinMeta}>
        {WAYPOINT_TYPE_LABELS[mark.type]} · {formatDdm(mark.latitude, mark.longitude)}
        {yards != null ? ` · ${yards} yd ${bearing ?? ''}` : ''}
      </Text>
      <View style={styles.pinActions}>
        <FieldButton
          style={styles.closeChip}
          onPress={() => useFieldStore.getState().requestFlyTo(mark.latitude, mark.longitude, 15)}>
          <Text style={styles.stepLabel}>Go</Text>
        </FieldButton>
        <FieldButton
          style={styles.closeChip}
          onPress={() => void attachPickedWaypointPhoto(mark.id, false)}>
          <Text style={styles.stepLabel}>Photo</Text>
        </FieldButton>
        <FieldButton
          style={styles.closeChip}
          onPress={() => void shareOrCopy(mark.name, formatDdm(mark.latitude, mark.longitude))}>
          <Text style={styles.stepLabel}>Share</Text>
        </FieldButton>
        <FieldButton
          style={styles.closeChip}
          onPress={() => {
            const store = useFieldStore.getState();
            if (parked) store.computeReturn();
            else store.parkHere();
          }}>
          <Text style={styles.stepLabel}>{parked ? 'Return' : 'Park'}</Text>
        </FieldButton>
        <FieldButton
          style={styles.closeChip}
          onPress={() => useFieldStore.getState().openWaypoint(mark.id)}>
          <Text style={styles.stepLabel}>Edit</Text>
        </FieldButton>
        <FieldButton
          style={styles.closeChip}
          onPress={() => useFieldStore.getState().deleteWaypoint(mark.id)}>
          <Text style={styles.stepLabel}>Delete</Text>
        </FieldButton>
        <FieldButton
          style={styles.closeChip}
          onPress={() => useFieldStore.setState({ selectedWaypointId: null, sheet: 'none' })}>
          <Text style={styles.stepLabel}>Close</Text>
        </FieldButton>
      </View>
    </View>
  );
}

function DrawBar() {
  const drawMode = useFieldStore((state) => state.drawMode);
  const ring = useFieldStore((state) => state.drawRing);
  if (!drawMode) return null;
  return (
    <View style={styles.drawBar}>
      <Text style={styles.modeLabel}>{ring.length} pts</Text>
      <FieldButton style={styles.closeChip} onPress={() => useFieldStore.getState().undoDrawVertex()}>
        <Text style={styles.stepLabel}>Undo</Text>
      </FieldButton>
      <FieldButton
        style={styles.closeChip}
        onPress={() => useFieldStore.getState().saveDrawnArea('Hunt area')}>
        <Text style={styles.stepLabel}>Save area</Text>
      </FieldButton>
      <FieldButton style={styles.closeChip} onPress={() => useFieldStore.getState().setDrawMode(false)}>
        <Text style={styles.stepLabel}>Cancel</Text>
      </FieldButton>
    </View>
  );
}

function renderSheet(sheet: SheetId) {
  switch (sheet) {
    case 'none':
      return null;
    case 'layers':
      return <LayersSheet />;
    case 'waypoint':
      return <WaypointSheet />;
    case 'property':
      return <PropertySheet />;
    case 'return':
      return <ReturnSheet />;
    case 'scout':
      return <ScoutSheet />;
    case 'terrain':
      return <TerrainAnalyzeSheet />;
    case 'plan':
      return <PlanSheet />;
    case 'planned':
      return <PlannedSheet />;
    case 'place':
      return <PlaceSheet />;
    case 'radius':
      return null;
    case 'mark':
      return <MarkSheet />;
    case 'weather':
      return <WeatherSheet />;
    case 'wind':
      return <WindSheet />;
    case 'areas':
      return <AreasSheet />;
    case 'recovery':
      return <RecoverySheet />;
    default: {
      const _exhaustive: never = sheet;
      return _exhaustive;
    }
  }
}

function Sheet({ title, children }: { title: string; children: ReactNode }) {
  const closeSheet = useFieldStore((state) => state.closeSheet);
  return (
    <View style={styles.sheetBackdrop}>
      <FieldButton
        accessibilityLabel="Dismiss"
        style={styles.backdropHit}
        onPress={closeSheet}>
        <View />
      </FieldButton>
      <View style={styles.sheet}>
        <SheetTopo />
        <View style={styles.handle} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <FieldButton onPress={closeSheet} accessibilityLabel="Close" style={styles.closeChip}>
            <Text style={styles.sheetClose}>Close</Text>
          </FieldButton>
        </View>
        <View style={styles.sheetBody}>{children}</View>
      </View>
    </View>
  );
}

function LayersSheet() {
  const basemap = useFieldStore((state) => state.basemap);
  const layers = useFieldStore((state) => state.layers);
  const opacity = useFieldStore((state) => state.publicLandOpacity);
  const setBasemap = useFieldStore((state) => state.setBasemap);
  const toggleLayer = useFieldStore((state) => state.toggleLayer);
  const setPublicLandOpacity = useFieldStore((state) => state.setPublicLandOpacity);
  const runScout = useFieldStore((state) => state.runScout);
  const runTerrainAnalyze = useFieldStore((state) => state.runTerrainAnalyze);
  const hunterState = useFieldStore((state) => state.hunterState);
  const radarOpacity = useFieldStore((state) => state.radarOpacity);
  const hillshadeOpacity = useFieldStore((state) => state.hillshadeOpacity);
  const scoreOpacity = useFieldStore((state) => state.scoreOpacity);
  const cameraMode = useFieldStore((state) => state.cameraMode);
  const mapTheme = useFieldStore((state) => state.mapTheme);
  const neraMode = useFieldStore((state) => state.neraMode);
  const neraStyle = useFieldStore((state) => state.neraStyle);
  const exaggeration = useFieldStore((state) => state.terrainExaggeration);
  const waypoints = useFieldStore((state) => state.waypoints);
  const selectedId = useFieldStore((state) => state.selectedWaypointId);
  const apiOn = huntosApiConfigured();

  return (
    <Sheet title="LAYERS">
      <ScrollView style={styles.sheetScroll}>
        <Text style={styles.group}>BASEMAP</Text>
        <View style={styles.segment}>
          {(['topo', 'hybrid', 'satellite', 'streets', 'naip', 'relief'] as const).map((id) => (
            <FieldButton
              key={id}
              style={[styles.segmentBtn, basemap === id && styles.segmentOn]}
              onPress={() => setBasemap(id)}>
              <Text style={[styles.segmentLabel, basemap === id && styles.segmentLabelOn]}>
                {basemapLabel(id)}
              </Text>
            </FieldButton>
          ))}
        </View>
        <Text style={styles.group}>3D RELIEF</Text>
        <Text style={styles.help}>
          3D uses a dedicated elevation mesh and shaded-relief skin, not a tilted paper map. Not lidar.
        </Text>
        <ToggleRow
          label="3D orbit"
          checked={cameraMode !== 'flat'}
          onPress={() => useFieldStore.getState().setCameraMode(cameraMode === 'flat' ? 'orbit' : 'flat')}
        />
        <ToggleRow
          label="First person"
          checked={cameraMode === 'fpv'}
          onPress={() => {
            const store = useFieldStore.getState();
            if (store.gps.latitude == null) return;
            store.setCameraMode(cameraMode === 'fpv' ? 'orbit' : 'fpv');
          }}
        />
        <ToggleRow
          label="Dark mesh"
          checked={mapTheme === 'dark'}
          onPress={() => useFieldStore.getState().setMapTheme('dark')}
        />
        <ToggleRow
          label="Light mesh"
          checked={mapTheme === 'light'}
          onPress={() => useFieldStore.getState().setMapTheme('light')}
        />
        <ToggleRow
          label="Nera (contours, valleys, slope)"
          checked={neraMode}
          onPress={() => useFieldStore.getState().setNeraMode(!neraMode)}
        />
        {neraMode ? (
          <>
            <ToggleRow
              label="Nera Glass"
              checked={neraStyle === 'glass'}
              onPress={() => useFieldStore.getState().setNeraStyle('glass')}
            />
            <ToggleRow
              label="Nera Wire"
              checked={neraStyle === 'wire'}
              onPress={() => useFieldStore.getState().setNeraStyle('wire')}
            />
          </>
        ) : null}
        {waypoints.length > 0 ? (
          <>
            <Text style={styles.group}>MARKS</Text>
            <View style={styles.segment}>
              {waypoints.slice(0, 12).map((point) => (
                <FieldButton
                  key={point.id}
                  style={[styles.segmentBtn, selectedId === point.id && styles.segmentOn]}
                  onPress={() => useFieldStore.setState({ selectedWaypointId: point.id, sheet: 'none' })}>
                  <Text style={[styles.segmentLabel, selectedId === point.id && styles.segmentLabelOn]}>
                    {point.name}
                  </Text>
                </FieldButton>
              ))}
            </View>
          </>
        ) : null}
        <Text style={styles.help}>Exaggeration {exaggeration.toFixed(1)}×</Text>
        <View style={styles.segment}>
          {([2.2, 3.2, 4.8] as const).map((value) => {
            const live = exaggeration === value;
            const accent = exagAccent(neraMode, neraStyle, mapTheme);
            return (
              <FieldButton
                key={value}
                style={[styles.segmentBtn, live ? { backgroundColor: `${accent}33` } : null]}
                onPress={() => useFieldStore.getState().setTerrainExaggeration(value)}>
                <Text style={[styles.segmentLabel, live ? { color: accent } : null]}>
                  {value.toFixed(1)}×
                </Text>
              </FieldButton>
            );
          })}
        </View>
        <View style={styles.card}>
          {(['land', 'hunt', 'terrain', 'camp'] as const).map((group) => (
            <View key={group}>
              <Text style={styles.group}>{overlayGroupLabel(group)}</Text>
              {overlaysForState(hunterState ?? 'TX')
                .filter((item) => item.group === group)
                .map((item) => (
                  <ToggleRow
                    key={item.id}
                    label={item.label}
                    checked={layers[item.id]}
                    onPress={() => toggleLayer(item.id)}
                  />
                ))}
              {group === 'land' ? (
                <>
                  <View style={styles.row}>
                    <Text style={styles.rowMuted}>Fill {Math.round(opacity * 100)}%</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.round(opacity * 100)}%` }]} />
                    </View>
                    <FieldButton
                      accessibilityLabel="Lower public land opacity"
                      style={styles.step}
                      onPress={() => setPublicLandOpacity(opacity - 0.1)}>
                      <Text style={styles.stepLabel}>−</Text>
                    </FieldButton>
                    <FieldButton
                      accessibilityLabel="Raise public land opacity"
                      style={styles.step}
                      onPress={() => setPublicLandOpacity(opacity + 0.1)}>
                      <Text style={styles.stepLabel}>+</Text>
                    </FieldButton>
                  </View>
                  <Text style={styles.warn}>
                    PAD-US access categories for scouting. TPWD public hunt fill is listed hunt areas
                    only. Not seasons, bag limits, or permission to hunt. Verify posted rules.
                  </Text>
                </>
              ) : null}
              {group === 'terrain' ? (
                <>
                  <ToggleRow
                    label="Wireframe 3D"
                    checked={layers.wireframe}
                    onPress={() => toggleLayer('wireframe')}
                  />
                  <Text style={styles.help}>
                    Lidar is USGS 3DEP hillshade (lidar-derived where available). Wireframe drapes neon
                    isolines on the 3D mesh. Not a point cloud.
                  </Text>
                </>
              ) : null}
            </View>
          ))}
        </View>
        <Text style={styles.group}>MY DATA</Text>
        <ToggleRow
          label="Waypoints"
          checked={layers.waypoints}
          onPress={() => toggleLayer('waypoints')}
        />
        <ToggleRow
          label="Scout radii"
          checked={layers.scoutAreas}
          onPress={() => toggleLayer('scoutAreas')}
        />
        <ToggleRow label="Tracks" checked={layers.tracks} onPress={() => toggleLayer('tracks')} />
        <ToggleRow
          label="Memories"
          checked={layers.memories}
          onPress={() => toggleLayer('memories')}
        />
        <ToggleRow
          label="Kill spots"
          checked={layers.kills}
          onPress={() => toggleLayer('kills')}
        />
        <ToggleRow
          label="Kill heat (your recorded kills only)"
          checked={layers.killHeat}
          onPress={() => toggleLayer('killHeat')}
        />
        <Text style={styles.warn}>{HARVEST_HEAT_DISCLAIMER}</Text>
        <Text style={styles.group}>FIELD</Text>
        <ToggleRow
          label="Range rings (100 / 200 / 400 yd)"
          checked={layers.rangeRings}
          onPress={() => toggleLayer('rangeRings')}
        />
        <ToggleRow
          label="Compass ray"
          checked={layers.compassRay}
          onPress={() => toggleLayer('compassRay')}
        />
        <ToggleRow label="Lat / lng grid" checked={layers.grid} onPress={() => toggleLayer('grid')} />
        <Text style={styles.group}>OPACITY</Text>
        <OpacityRow
          label="Radar"
          value={radarOpacity}
          onChange={(value) => useFieldStore.getState().setRadarOpacity(value)}
        />
        <OpacityRow
          label="Hillshade"
          value={hillshadeOpacity}
          onChange={(value) => useFieldStore.getState().setHillshadeOpacity(value)}
        />
        <OpacityRow
          label="Nomad Score"
          value={scoreOpacity}
          onChange={(value) => useFieldStore.getState().setScoreOpacity(value)}
        />
        <Text style={styles.group}>LEGEND</Text>
        <Text style={styles.help}>
          Rust teardrops are your marks. Gold squares are planned hunts. Purple is inferred Nomad Score.
          Green is bedding, gold fill is feeding. Public-land fills are PAD-US access — not ownership or
          permission. Range rings are 100, 200, and 400 yards from the GPS puck.
        </Text>
        <Text style={styles.group}>INTELLIGENCE</Text>
        <ToggleRow
          label="Nomad Score"
          checked={layers.huntScore}
          onPress={() => toggleLayer('huntScore')}
        />
        <ToggleRow
          label="Terrain features"
          checked={layers.terrainFeatures}
          onPress={() => toggleLayer('terrainFeatures')}
        />
        <ToggleRow
          label="Bedding"
          checked={layers.bedding}
          onPress={() => toggleLayer('bedding')}
        />
          <ToggleRow
            label="Feeding"
            checked={layers.feeding}
            onPress={() => toggleLayer('feeding')}
          />
          <ToggleRow
            label="Hillshade"
            checked={layers.hillshade}
            onPress={() => toggleLayer('hillshade')}
          />
          <ToggleRow
            label="Radar"
            checked={layers.radar}
            onPress={() => toggleLayer('radar')}
          />
          <ToggleRow
            label="Wind cone"
            checked={layers.windCone}
            onPress={() => toggleLayer('windCone')}
          />
          <ToggleRow
            label="Glassing LOS"
            checked={layers.los}
            onPress={() => toggleLayer('los')}
          />
          <FieldButton style={styles.secondary} onPress={() => useFieldStore.getState().openSheet('areas')}>
            <Text style={styles.secondaryLabel}>Hunt areas</Text>
          </FieldButton>
        <Text style={styles.warn}>
          {apiOn
            ? 'Scout paints inferred score, bedding, feeding, and hunting-unit outlines. Unknown when sampling fails — not animal presence or permission.'
            : 'Scout and Analyze Terrain need the Nomad field API. Land tiles still work. Scores stay unknown until then.'}
        </Text>
        <FieldButton style={styles.secondary} onPress={() => void runScout()}>
          <Text style={styles.secondaryLabel}>Scout</Text>
        </FieldButton>
        <FieldButton style={styles.secondary} onPress={() => void runTerrainAnalyze()}>
          <Text style={styles.secondaryLabel}>Analyze Terrain</Text>
        </FieldButton>
      </ScrollView>
    </Sheet>
  );
}

function basemapLabel(id: BasemapId): string {
  switch (id) {
    case 'topo':
      return 'Topo';
    case 'hybrid':
      return 'Hybrid';
    case 'satellite':
      return 'Satellite';
    case 'streets':
      return 'Streets';
    case 'naip':
      return 'NAIP';
    case 'relief':
      return 'Relief';
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

function layerLabel(key: keyof LayerState): string {
  if (isOverlayId(key)) return overlayDefinition(key).label;
  switch (key) {
    case 'waypoints':
      return 'Waypoints';
    case 'tracks':
      return 'Tracks';
    case 'kills':
      return 'Kill spots';
    case 'killHeat':
      return 'Kill heat';
    case 'huntScore':
      return 'Nomad Score';
    case 'terrainFeatures':
      return 'Terrain features';
    case 'bedding':
      return 'Bedding';
    case 'feeding':
      return 'Feeding';
    case 'scoutAreas':
      return 'Scout radii';
    case 'hillshade':
      return 'Hillshade';
    case 'radar':
      return 'Radar';
    case 'windCone':
      return 'Wind cone';
    case 'los':
      return 'Glassing LOS';
    case 'rangeRings':
      return 'Range rings';
    case 'compassRay':
      return 'Compass ray';
    case 'grid':
      return 'Lat / lng grid';
    case 'memories':
      return 'Memories';
    case 'wireframe':
      return 'Wireframe 3D';
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

const SLIDER_MIN_YD = 25;
const SLIDER_MAX_YD = 1600;

function OpacityRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowMuted}>
        {label} {Math.round(value * 100)}%
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.round(value * 100)}%` }]} />
      </View>
      <FieldButton
        accessibilityLabel={`Lower ${label} opacity`}
        style={styles.step}
        onPress={() => onChange(value - 0.1)}>
        <Text style={styles.stepLabel}>−</Text>
      </FieldButton>
      <FieldButton
        accessibilityLabel={`Raise ${label} opacity`}
        style={styles.step}
        onPress={() => onChange(value + 0.1)}>
        <Text style={styles.stepLabel}>+</Text>
      </FieldButton>
    </View>
  );
}

function YardSlider({
  yards,
  onChange,
  slim,
}: {
  yards: number;
  onChange: (yards: number) => void;
  slim?: boolean;
}) {
  const clamped = Math.min(SLIDER_MAX_YD, Math.max(SLIDER_MIN_YD, yards));
  const [width, setWidth] = useState(1);
  const ratio = (clamped - SLIDER_MIN_YD) / (SLIDER_MAX_YD - SLIDER_MIN_YD);

  function setFromX(x: number): void {
    const t = Math.min(1, Math.max(0, x / Math.max(1, width)));
    onChange(Math.round(SLIDER_MIN_YD + t * (SLIDER_MAX_YD - SLIDER_MIN_YD)));
  }

  if (Platform.OS === 'web') {
    return (
      <View style={slim ? styles.slimSliderWrap : styles.sliderWrap}>
        <input
          type="range"
          min={SLIDER_MIN_YD}
          max={SLIDER_MAX_YD}
          step={5}
          value={clamped}
          aria-label="Scout size in yards"
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          style={{ width: '100%', accentColor: Nomad.rust, height: slim ? 18 : 28 }}
        />
      </View>
    );
  }

  return (
    <View
      style={slim ? styles.slimSliderWrap : styles.sliderWrap}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Pressable
        accessibilityLabel="Scout size"
        style={slim ? styles.slimSliderHit : styles.sliderHit}
        onPress={(event) => setFromX(event.nativeEvent.locationX)}
        onTouchMove={(event) => {
          const touch = event.nativeEvent.touches[0];
          if (!touch) return;
          setFromX(touch.locationX);
        }}>
        <View style={[styles.sliderTrack, slim && styles.slimSliderTrack]}>
          <View style={[styles.sliderFill, slim && styles.slimSliderFill, { width: `${Math.round(ratio * 100)}%` }]} />
          <View
            style={[
              styles.sliderThumb,
              slim && styles.slimSliderThumb,
              { left: `${Math.round(ratio * 100)}%` },
            ]}
          />
        </View>
      </Pressable>
    </View>
  );
}

function ToggleRow({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <FieldButton style={styles.row} onPress={onPress}>
      <View style={[styles.switch, checked && styles.switchOn]}>
        <View style={[styles.knob, checked && styles.knobOn]} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
    </FieldButton>
  );
}

function WaypointSheet() {
  const draft = useFieldStore((state) => state.draftWaypointType);
  const setDraft = useFieldStore((state) => state.setDraftWaypointType);
  const addWaypoint = useFieldStore((state) => state.addWaypoint);
  const tapPoint = useFieldStore((state) => state.tapPoint);
  const gps = useFieldStore((state) => state.gps);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [species, setSpecies] = useState<SpeciesId | undefined>(undefined);
  const [draftPhotos, setDraftPhotos] = useState<string[]>([]);
  const latitude = tapPoint?.latitude ?? gps.latitude;
  const longitude = tapPoint?.longitude ?? gps.longitude;
  const hasFix = latitude != null && longitude != null;

  async function addDraftPhoto(fromCamera: boolean) {
    try {
      const prepared = await prepareDraftWaypointPhoto(fromCamera);
      if (!prepared) return;
      setDraftPhotos((current) => [prepared, ...current].slice(0, 6));
    } catch (error) {
      useFieldStore.setState({
        scoutMessage: error instanceof Error ? error.message : 'Photo failed.',
      });
    }
  }

  return (
    <Sheet title={draft === 'harvest' ? 'KILL / HARVEST' : 'WAYPOINT'}>
      <View style={styles.card}>
      <Text style={styles.help}>
        {hasFix
          ? `${formatCoordinates(latitude, longitude)} · observed`
          : 'NO FIX — tap or long-press the map to drop a point.'}
      </Text>
      <ScrollView horizontal style={styles.typeRow} contentContainerStyle={styles.typeContent}>
        {MARK_TYPES.map((type) => (
          <FieldButton
            key={type}
            style={[styles.chipChoice, draft === type && styles.chipOn]}
            onPress={() => setDraft(type)}>
            <Text style={[styles.chipLabel, draft === type && styles.chipLabelOn]}>
              {type === 'harvest' ? 'Kill / harvest' : WAYPOINT_TYPE_LABELS[type]}
            </Text>
          </FieldButton>
        ))}
      </ScrollView>
      {draft === 'harvest' ? (
        <ScrollView horizontal contentContainerStyle={styles.typeContent}>
          {SPECIES.map((id) => (
            <FieldButton
              key={id}
              style={[styles.chipChoice, species === id && styles.chipOn]}
              onPress={() => setSpecies(id)}>
              <Text style={[styles.chipLabel, species === id && styles.chipLabelOn]}>
                {SPECIES_LABELS[id]}
              </Text>
            </FieldButton>
          ))}
        </ScrollView>
      ) : null}
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={draft === 'harvest' ? 'Kill mark name' : 'Name'}
        placeholderTextColor="#7A7A7A"
        style={styles.input}
      />
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes"
        placeholderTextColor="#7A7A7A"
        style={styles.input}
      />
      {draftPhotos.length ? (
        <ScrollView horizontal contentContainerStyle={styles.photoStrip}>
          {draftPhotos.map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.photoWrap}>
              <Image source={{ uri }} style={styles.draftPhoto} contentFit="cover" />
              <FieldButton
                style={styles.photoRemove}
                onPress={() => setDraftPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))}>
                <Text style={styles.stepLabel}>Remove</Text>
              </FieldButton>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.photoActions}>
        <FieldButton style={styles.closeChip} onPress={() => void addDraftPhoto(true)}>
          <Text style={styles.stepLabel}>Camera</Text>
        </FieldButton>
        <FieldButton style={styles.closeChip} onPress={() => void addDraftPhoto(false)}>
          <Text style={styles.stepLabel}>Library</Text>
        </FieldButton>
      </View>
      <FieldButton
        style={styles.primary}
        onPress={() =>
          addWaypoint({
            type: draft,
            name: name || (draft === 'harvest' ? 'Harvest' : draft),
            notes,
            species: draft === 'harvest' ? species : undefined,
            photos: draftPhotos,
          })
        }>
        <Text style={styles.primaryLabel}>
          {draft === 'harvest' ? 'Save kill spot' : 'Save waypoint'}
        </Text>
      </FieldButton>
      </View>
    </Sheet>
  );
}

function MarkSheet() {
  const selectedId = useFieldStore((state) => state.selectedWaypointId);
  const mark = useFieldStore((state) =>
    state.waypoints.find((item) => item.id === state.selectedWaypointId),
  );
  const updateWaypoint = useFieldStore((state) => state.updateWaypoint);
  const deleteWaypoint = useFieldStore((state) => state.deleteWaypoint);
  const requestFlyTo = useFieldStore((state) => state.requestFlyTo);
  const [name, setName] = useState(mark?.name ?? '');
  const [notes, setNotes] = useState(mark?.notes ?? '');

  useEffect(() => {
    setName(mark?.name ?? '');
    setNotes(mark?.notes ?? '');
  }, [mark?.id, mark?.name, mark?.notes]);

  if (!selectedId || !mark) return null;

  return (
    <Sheet title={WAYPOINT_TYPE_LABELS[mark.type] ?? 'WAYPOINT'}>
      <View style={styles.card}>
        <Text style={styles.help}>
          {formatCoordinates(mark.latitude, mark.longitude)}
        </Text>
        <ScrollView horizontal style={styles.typeRow} contentContainerStyle={styles.typeContent}>
          {MARK_TYPES.map((type) => (
            <FieldButton
              key={type}
              style={[styles.chipChoice, mark.type === type && styles.chipOn]}
              onPress={() => updateWaypoint(mark.id, { type })}>
              <Text style={[styles.chipLabel, mark.type === type && styles.chipLabelOn]}>
                {type === 'harvest' ? 'Kill / harvest' : WAYPOINT_TYPE_LABELS[type]}
              </Text>
            </FieldButton>
          ))}
        </ScrollView>
        <TextInput
          value={name}
          onChangeText={setName}
          onBlur={() => updateWaypoint(mark.id, { name })}
          placeholder="Name"
          placeholderTextColor="#7A7A7A"
          style={styles.input}
        />
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onBlur={() => updateWaypoint(mark.id, { notes })}
          placeholder="Notes"
          placeholderTextColor="#7A7A7A"
          style={styles.input}
        />
        <FieldButton
          style={styles.primary}
          onPress={() => requestFlyTo(mark.latitude, mark.longitude, 16)}>
          <Text style={styles.primaryLabel}>Fly to mark</Text>
        </FieldButton>
        <MarkExtras />
        <FieldButton style={styles.secondary} onPress={() => deleteWaypoint(mark.id)}>
          <Text style={styles.primaryLabel}>Delete waypoint</Text>
        </FieldButton>
      </View>
    </Sheet>
  );
}

function PlanSheet() {
  const tapPoint = useFieldStore((state) => state.tapPoint);
  const gps = useFieldStore((state) => state.gps);
  const addHuntPlan = useFieldStore((state) => state.addHuntPlan);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [species, setSpecies] = useState<SpeciesId | undefined>(undefined);
  const [plannedAt, setPlannedAt] = useState(() => defaultPlanTime());
  const latitude = tapPoint?.latitude ?? gps.latitude;
  const longitude = tapPoint?.longitude ?? gps.longitude;

  return (
    <Sheet title="PLAN HUNT">
      <View style={styles.card}>
      <Text style={styles.help}>
        {latitude != null && longitude != null
          ? `${formatCoordinates(latitude, longitude)} · pin on map`
          : 'Uses the sample area until you drop a map point or get a GPS fix.'}
      </Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Saturday sit · oak ridge"
        placeholderTextColor="#7A7A7A"
        style={styles.input}
      />
      <TextInput
        value={plannedAt}
        onChangeText={setPlannedAt}
        placeholder="YYYY-MM-DDTHH:mm"
        placeholderTextColor="#7A7A7A"
        style={styles.input}
      />
      <ScrollView horizontal contentContainerStyle={styles.typeContent}>
        {SPECIES.map((id) => (
          <FieldButton
            key={id}
            style={[styles.chipChoice, species === id && styles.chipOn]}
            onPress={() => setSpecies(id)}>
            <Text style={[styles.chipLabel, species === id && styles.chipLabelOn]}>
              {SPECIES_LABELS[id]}
            </Text>
          </FieldButton>
        ))}
      </ScrollView>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes for the sit"
        placeholderTextColor="#7A7A7A"
        style={styles.input}
      />
      <FieldButton
        style={styles.primary}
        onPress={() =>
          addHuntPlan({
            title,
            plannedAt: toIso(plannedAt),
            species,
            notes,
          })
        }>
        <Text style={styles.primaryLabel}>Save planned hunt</Text>
      </FieldButton>
      </View>
    </Sheet>
  );
}

function PlannedSheet() {
  const planId = useFieldStore((state) => state.selectedPlanId);
  const plan = useFieldStore((state) => state.huntPlans.find((item) => item.id === planId));
  const startHuntFromPlan = useFieldStore((state) => state.startHuntFromPlan);
  const deleteHuntPlan = useFieldStore((state) => state.deleteHuntPlan);
  if (!plan) return null;
  return (
    <Sheet title="PLANNED HUNT">
      <View style={styles.card}>
      <Text style={styles.headline}>{plan.title}</Text>
      <Text style={styles.help}>
        {new Date(plan.plannedAt).toLocaleString()}
        {plan.species ? ` · ${SPECIES_LABELS[plan.species]}` : ''}
      </Text>
      <Text style={styles.coord}>
        {formatCoordinates(plan.latitude, plan.longitude)}
      </Text>
      {plan.notes ? <Text style={styles.help}>{plan.notes}</Text> : null}
      <FieldButton style={styles.primary} onPress={() => startHuntFromPlan(plan.id)}>
        <Text style={styles.primaryLabel}>Start this hunt</Text>
      </FieldButton>
      <FieldButton style={styles.secondary} onPress={() => deleteHuntPlan(plan.id)}>
        <Text style={styles.secondaryLabel}>Delete plan</Text>
      </FieldButton>
      </View>
    </Sheet>
  );
}

function PropertySheet() {
  const tapPoint = useFieldStore((state) => state.tapPoint);
  const identify = useFieldStore((state) => state.identify);
  const hunterState = useFieldStore((state) => state.hunterState);
  const land = describeLandStatus(identify);
  const parcel = describeParcelStatus(identify?.parcel);
  const regs = identify?.publishedRegs;
  const guide = stateHuntGuide(hunterState);
  const outdoorUrl = regs?.outdoorAnnualUrl ?? guide?.huntingUrl;
  if (!tapPoint) return null;
  return (
    <Sheet title="LOCATION">
      <View style={styles.card}>
      <Text style={styles.coord}>{formatCoordinates(tapPoint.latitude, tapPoint.longitude)}</Text>
      <Text style={styles.headline}>{land.headline}</Text>
      <Text style={styles.help}>{land.detail}</Text>
      <Text style={styles.group}>PARCEL</Text>
      <Text style={styles.headline}>{parcel.headline}</Text>
      <Text style={styles.help}>{parcel.detail}</Text>
      {regs?.areaName ? (
        <>
          <Text style={styles.group}>TPWD LISTED HUNT</Text>
          <Text style={styles.headline}>{regs.areaName}</Text>
          {regs.muleDeerDrawListed ? (
            <Text style={styles.help}>
              Listed mule deer draw area (for example Big Bend Ranch or Black Gap). Dates and odds stay on the TPWD drawn-hunt catalog — Nomad does not invent them.
            </Text>
          ) : null}
        </>
      ) : null}
      {regs && regs.fields.length > 0 ? (
        <>
          <Text style={styles.help}>As published by TPWD · retrieved {new Date(regs.retrievedAt).toLocaleString()}</Text>
          {regs.fields.map((field) => (
            <Text key={field.label} style={styles.help}>
              {field.label}: {field.value}
            </Text>
          ))}
        </>
      ) : (
        <Text style={styles.help}>
          Season dates, bag limits, and weapons stay unknown in Nomad unless TPWD published those fields on this feature.
        </Text>
      )}
      {regs?.drawCatalogUrl ? (
        <FieldButton
          style={styles.secondary}
          onPress={() => {
            void WebBrowser.openBrowserAsync(regs.drawCatalogUrl!);
          }}>
          <Text style={styles.secondaryLabel}>Open drawn-hunt catalog</Text>
        </FieldButton>
      ) : null}
      {outdoorUrl ? (
        <FieldButton
          style={styles.secondary}
          onPress={() => {
            void WebBrowser.openBrowserAsync(outdoorUrl);
          }}>
          <Text style={styles.secondaryLabel}>Open Outdoor Annual</Text>
        </FieldButton>
      ) : null}
      <Text style={styles.warn}>Verify posted boundaries. Nomad never claims private land or permission to hunt.</Text>
      <FieldButton
        style={styles.primary}
        onPress={() => useFieldStore.getState().beginWaypointAtTap()}>
        <Text style={styles.primaryLabel}>Set waypoint here</Text>
      </FieldButton>
      <FieldButton
        style={styles.secondary}
        onPress={() => useFieldStore.getState().parkHere()}>
        <Text style={styles.secondaryLabel}>Park truck here</Text>
      </FieldButton>
      <FieldButton
        style={styles.secondary}
        onPress={() => useFieldStore.getState().beginScoutRadiusAtTap()}>
        <Text style={styles.secondaryLabel}>Drop scout radius</Text>
      </FieldButton>
      {!huntosApiConfigured() ? (
        <Text style={styles.warn}>
          Public-land identify uses the Nomad field API when configured. Texas parcels and TPWD listed hunts still query when your home state is Texas.
        </Text>
      ) : null}
      </View>
    </Sheet>
  );
}

function PlaceSheet() {
  const tapPoint = useFieldStore((state) => state.tapPoint);
  const beginWaypointAtTap = useFieldStore((state) => state.beginWaypointAtTap);
  const beginIdentifyAtTap = useFieldStore((state) => state.beginIdentifyAtTap);
  const beginScoutRadiusAtTap = useFieldStore((state) => state.beginScoutRadiusAtTap);
  const closeSheet = useFieldStore((state) => state.closeSheet);

  return (
    <Sheet title="THIS SPOT">
      <View style={styles.card}>
        <Text style={styles.coord}>
          {tapPoint
            ? formatCoordinates(tapPoint.latitude, tapPoint.longitude)
            : 'NO FIX'}
        </Text>
        <Text style={styles.help}>
          Precise placement on the tap. Choose what to leave here — nothing is saved until you confirm.
        </Text>
        <FieldButton style={styles.primary} onPress={beginWaypointAtTap}>
          <Text style={styles.primaryLabel}>Set waypoint here</Text>
        </FieldButton>
        <FieldButton
          style={styles.secondary}
          onPress={() => useFieldStore.getState().parkHere()}>
          <Text style={styles.secondaryLabel}>Park truck here</Text>
        </FieldButton>
        <FieldButton
          style={styles.secondary}
          onPress={() => void beginIdentifyAtTap()}>
          <Text style={styles.secondaryLabel}>Look up this land</Text>
        </FieldButton>
        <FieldButton style={styles.secondary} onPress={beginScoutRadiusAtTap}>
          <Text style={styles.secondaryLabel}>Drop scout radius</Text>
        </FieldButton>
        <FieldButton style={styles.secondary} onPress={closeSheet}>
          <Text style={styles.secondaryLabel}>Not now</Text>
        </FieldButton>
      </View>
    </Sheet>
  );
}

function ScoutHud({ bottom }: { bottom: number }) {
  const sheet = useFieldStore((state) => state.sheet);
  const areas = useFieldStore((state) => state.scoutAreas);
  const selectedId = useFieldStore((state) => state.selectedScoutId);
  const radiusMode = useFieldStore((state) => state.radiusMode);
  const area = areas.find((item) => item.id === selectedId);
  const setRadiusMode = useFieldStore((state) => state.setRadiusMode);
  const setScoutColor = useFieldStore((state) => state.setScoutColor);
  const setScoutRadius = useFieldStore((state) => state.setScoutRadius);
  const deleteScoutArea = useFieldStore((state) => state.deleteScoutArea);
  const dismissScoutEdit = useFieldStore((state) => state.dismissScoutEdit);

  if (sheet !== 'none') return null;
  if (!radiusMode && !area) return null;

  const yards = area ? Math.round(area.radiusMeters / 0.9144) : 0;

  return (
    <View pointerEvents="box-none" style={[styles.scoutHudWrap, { bottom }]}>
      <View style={styles.scoutHud}>
        {area ? (
          <>
            <View style={styles.scoutHudRow}>
              <Text style={styles.scoutHudYards}>{formatRadiusYards(area.radiusMeters)}</Text>
              <View style={styles.scoutHudSwatches}>
                {SCOUT_SWATCHES.map((swatch) => (
                  <FieldButton
                    key={swatch.id}
                    accessibilityLabel={`${swatch.id} fill`}
                    style={[
                      styles.slimSwatch,
                      area.color === swatch.id && styles.swatchOn,
                      { backgroundColor: swatch.fill },
                    ]}
                    onPress={() => setScoutColor(area.id, swatch.id)}>
                    <View />
                  </FieldButton>
                ))}
              </View>
              <FieldButton
                accessibilityLabel="Add scout radius"
                style={[styles.scoutHudBtn, radiusMode && styles.iconBtnOn]}
                onPress={() => setRadiusMode(!radiusMode)}>
                <MaterialIcons name="add" size={18} color={radiusMode ? Nomad.bone : Nomad.rust} />
              </FieldButton>
              <FieldButton
                accessibilityLabel="Remove scout radius"
                style={styles.scoutHudBtn}
                onPress={() => deleteScoutArea(area.id)}>
                <MaterialIcons name="delete-outline" size={18} color={Nomad.rust} />
              </FieldButton>
              <FieldButton
                accessibilityLabel="Done"
                style={styles.scoutHudBtn}
                onPress={dismissScoutEdit}>
                <MaterialIcons name="check" size={18} color={Nomad.bone} />
              </FieldButton>
            </View>
            <YardSlider
              slim
              yards={yards}
              onChange={(next) => setScoutRadius(area.id, yardsToMeters(next))}
            />
          </>
        ) : (
          <View style={styles.scoutHudRow}>
            <Text style={styles.scoutHudHint}>Tap the map to drop a radius. Saved as you place it.</Text>
            <FieldButton
              accessibilityLabel="Cancel scout"
              style={styles.scoutHudBtn}
              onPress={() => setRadiusMode(false)}>
              <MaterialIcons name="close" size={18} color={Nomad.bone} />
            </FieldButton>
          </View>
        )}
      </View>
    </View>
  );
}

function ReturnSheet() {
  const routes = useFieldStore((state) => state.returnRoutes);
  return (
    <Sheet title="RETURN TO TRUCK">
      <View style={styles.card}>
      <Text style={styles.warn}>
        This is a bearing and distance aid. It is not a safe or legal route.
      </Text>
      {routes.length === 0 ? (
        <Text style={styles.help}>Drop a Truck waypoint or record a track first.</Text>
      ) : (
        routes.map((route) => (
          <View key={route.kind} style={styles.route}>
            <Text style={styles.rowLabel}>{route.label}</Text>
            <Text style={styles.help}>
              {formatDistance(route.distanceMeters)}
              {route.bearingDegrees != null ? ` · ${formatBearing(route.bearingDegrees)}` : ''}
            </Text>
            <Text style={styles.warn}>{route.warning}</Text>
          </View>
        ))
      )}
      </View>
    </Sheet>
  );
}

function ScoutSheet() {
  const message = useFieldStore((state) => state.scoutMessage);
  const overlay = useFieldStore((state) => state.scoreOverlay);
  const top = overlay
    .filter((item) => item.overall !== null)
    .slice()
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))
    .slice(0, 3);
  return (
    <Sheet title="SCOUT">
      <View style={styles.card}>
      <Text style={styles.help}>{message ?? 'Scout requires the Nomad field API.'}</Text>
      {top.map((item, index) => (
        <View key={`${item.latitude}-${index}`} style={styles.route}>
          <Text style={styles.rowLabel}>Nomad Score {item.overall ?? '—'}/100</Text>
          <Text style={styles.help}>{item.reasons.join(' · ')}</Text>
          {item.unavailable.length > 0 ? (
            <Text style={styles.warn}>Unavailable: {item.unavailable.join(', ')}</Text>
          ) : null}
        </View>
      ))}
      <Text style={styles.warn}>Habitat scores are inferred. They are not animal-presence claims.</Text>
      </View>
    </Sheet>
  );
}

function TerrainAnalyzeSheet() {
  const message = useFieldStore((state) => state.scoutMessage);
  const features = useFieldStore((state) => state.terrainOverlay);
  const runTerrainAnalyze = useFieldStore((state) => state.runTerrainAnalyze);
  return (
    <Sheet title="ANALYZE TERRAIN">
      <View style={styles.card}>
      <Text style={styles.help}>
        {message ?? 'Inferred from sampled elevations, not a lidar DEM.'}
      </Text>
      <FieldButton style={styles.primary} onPress={() => void runTerrainAnalyze()}>
        <Text style={styles.primaryLabel}>Analyze visible map</Text>
      </FieldButton>
      {features.slice(0, 8).map((feature, index) => (
        <View key={`${feature.kind}-${index}`} style={styles.route}>
          <Text style={styles.rowLabel}>{feature.label}</Text>
          <Text style={styles.help}>{feature.reasons.join(' · ')}</Text>
        </View>
      ))}
      <Text style={styles.warn}>
        Features stay unknown when elevation sampling fails. Nothing is invented.
      </Text>
      </View>
    </Sheet>
  );
}

function defaultPlanTime(): string {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(6, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`;
}

function toIso(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return new Date().toISOString();
  return new Date(parsed).toISOString();
}

export function useOnlineStatus(): void {
  const setOnline = useFieldStore((state) => state.setOnline);
  useEffect(() => {
    const online =
      typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    setOnline(online);
    const target = typeof window !== 'undefined' ? window : undefined;
    if (!target || typeof target.addEventListener !== 'function') return;
    const sync = () => setOnline(navigator.onLine !== false);
    target.addEventListener('online', sync);
    target.addEventListener('offline', sync);
    return () => {
      if (typeof target.removeEventListener !== 'function') return;
      target.removeEventListener('online', sync);
      target.removeEventListener('offline', sync);
    };
  }, [setOnline]);
}

const styles = StyleSheet.create({
  topWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
    paddingHorizontal: 8,
    gap: 6,
  },
  searchWrap: {
    zIndex: 24,
  },
  searchInput: {
    backgroundColor: Nomad.glass,
    borderColor: Nomad.line,
    borderWidth: 1,
    borderRadius: 8,
    color: Nomad.bone,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 40,
  },
  searchHits: {
    marginTop: 4,
    backgroundColor: Nomad.glass,
    borderColor: Nomad.line,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  searchHit: {
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  searchHitLabel: {
    color: Nomad.bone,
    fontSize: 12,
    fontWeight: '600',
  },
  pinCard: {
    position: 'absolute',
    left: 8,
    right: 56,
    bottom: 96,
    zIndex: 21,
    elevation: 21,
    backgroundColor: Nomad.glass,
    borderColor: Nomad.line,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  neraAi: {
    position: 'absolute',
    left: 8,
    top: 92,
    zIndex: 21,
    maxWidth: 236,
    backgroundColor: 'rgba(0,6,12,0.82)',
    borderColor: 'rgba(34,211,238,0.42)',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  neraAiWire: {
    backgroundColor: 'rgba(0,2,8,0.92)',
    borderColor: 'rgba(103,232,249,0.72)',
  },
  neraHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  neraKicker: {
    color: '#7af6ff',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  neraLock: {
    color: '#e0fbff',
    fontSize: 12,
    fontWeight: '800',
  },
  neraLine: {
    color: '#9ad7e2',
    fontSize: 10,
    fontWeight: '600',
  },
  neraGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  neraCell: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.22)',
    backgroundColor: 'rgba(2,16,24,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  neraCellLabel: {
    color: 'rgba(122,246,255,0.7)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  neraCellValue: {
    color: '#e0fbff',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  neraNote: {
    color: 'rgba(154,215,226,0.65)',
    fontSize: 9,
    fontWeight: '600',
  },
  neraFrame: {
    position: 'absolute',
    top: 6,
    right: 6,
    bottom: 6,
    left: 6,
    zIndex: 12,
    borderColor: 'rgba(34,211,238,0.28)',
    borderWidth: 1,
  },
  neraFrameWire: {
    borderColor: 'rgba(103,232,249,0.55)',
    borderWidth: 1,
  },
  pinTitle: {
    color: Nomad.bone,
    fontSize: 16,
    fontWeight: '800',
  },
  pinMeta: {
    color: Nomad.mist,
    fontSize: 12,
    lineHeight: 16,
  },
  pinActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  photoStrip: {
    gap: 8,
    paddingTop: 8,
  },
  photoWrap: {
    width: 96,
    gap: 6,
  },
  draftPhoto: {
    width: 96,
    height: 96,
    borderRadius: 8,
    backgroundColor: Nomad.ink,
  },
  photoRemove: {
    borderColor: Nomad.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  drawBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    backgroundColor: Nomad.glass,
    borderColor: Nomad.line,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
  },
  quickRow: {
    maxHeight: 40,
    alignSelf: 'flex-end',
    marginBottom: 6,
  },
  stackWrap: {
    position: 'absolute',
    right: 8,
    zIndex: 20,
    elevation: 20,
  },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Nomad.glass,
    borderColor: Nomad.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 3,
    paddingRight: 8,
    paddingVertical: 2,
  },
  mark: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Nomad.ink,
    borderWidth: 1,
    borderColor: Nomad.line,
  },
  chipText: {
    color: Nomad.bone,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  chipDot: {
    color: Nomad.mist,
    fontSize: 10,
  },
  ok: {
    color: '#C8F0C0',
  },
  warn: {
    color: '#ffd166',
    fontSize: 11,
    lineHeight: 15,
  },
  metrics: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Nomad.glass,
    borderColor: Nomad.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metric: {
    color: Nomad.bone,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  stack: {
    gap: 6,
    alignItems: 'flex-end',
  },
  iconBtn: {
    width: 40,
    height: 40,
    minHeight: 40,
    borderRadius: 14,
    backgroundColor: Nomad.glass,
    borderColor: Nomad.line,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnOn: {
    backgroundColor: 'rgba(103,232,249,0.16)',
    borderColor: 'rgba(103,232,249,0.55)',
  },
  iconBtnRec: {
    backgroundColor: '#9B1C12',
    borderColor: '#F15A24',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    elevation: 30,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  backdropHit: {
    flex: 1,
    width: '100%',
  },
  sheet: {
    backgroundColor: 'rgba(2,8,12,0.92)',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderColor: Nomad.line,
    borderWidth: 1,
    padding: 18,
    gap: 10,
    maxHeight: '76%',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(232,223,208,0.28)',
    marginBottom: 6,
    zIndex: 1,
  },
  closeChip: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Nomad.line,
  },
  segment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Nomad.ink,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Nomad.line,
    overflow: 'hidden',
  },
  segmentBtn: {
    width: '33.33%',
    minHeight: 40,
    paddingVertical: 8,
  },
  segmentOn: {
    backgroundColor: 'rgba(241,90,36,0.22)',
  },
  segmentLabel: {
    color: Nomad.mist,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  segmentLabelOn: {
    color: Nomad.bone,
  },
  card: {
    backgroundColor: 'rgba(8,7,6,0.55)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(241,90,36,0.22)',
    padding: 12,
    gap: 6,
    marginTop: 8,
  },
  switch: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2a2620',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  switchOn: {
    backgroundColor: Nomad.rust,
  },
  knob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Nomad.mist,
  },
  knobOn: {
    alignSelf: 'flex-end',
    backgroundColor: '#fff',
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2a2620',
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    backgroundColor: Nomad.rust,
  },
  sliderWrap: {
    width: '100%',
    marginBottom: 8,
  },
  sliderHit: {
    width: '100%',
    minHeight: 36,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2a2620',
    justifyContent: 'center',
  },
  sliderFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Nomad.rust,
  },
  sliderThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: Nomad.rust,
  },
  sheetBody: {
    zIndex: 1,
  },
  sheetScroll: {
    maxHeight: 420,
  },
  sheetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  sheetTitle: {
    color: '#E6A31A',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  sheetClose: {
    color: '#F15A24',
    fontSize: 14,
    fontWeight: '700',
  },
  group: {
    color: '#8A8A8A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    width: '100%',
  },
  radio: {
    color: '#F15A24',
    width: 18,
  },
  rowLabel: {
    color: '#F5F5F5',
    fontSize: 15,
    textTransform: 'capitalize',
  },
  rowMuted: {
    color: '#8A8A8A',
    fontSize: 14,
    flex: 1,
  },
  help: {
    color: '#B5B5B5',
    fontSize: 13,
    lineHeight: 18,
  },
  coord: {
    color: '#F5F5F5',
    fontSize: 16,
    fontWeight: '700',
  },
  headline: {
    color: '#F5F5F5',
    fontSize: 18,
    fontWeight: '700',
  },
  typeRow: {
    maxHeight: 44,
  },
  typeContent: {
    gap: 8,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipChoice: {
    borderColor: '#2A2A2A',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0c0c0c',
    minHeight: 32,
  },
  chipOn: {
    backgroundColor: '#F15A24',
    borderColor: '#F15A24',
  },
  chipLabel: {
    color: '#F5F5F5',
    fontSize: 12,
    fontWeight: '600',
  },
  chipLabelOn: {
    color: '#FFFFFF',
  },
  input: {
    borderColor: '#2A2A2A',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#F5F5F5',
    backgroundColor: '#0c0c0c',
  },
  primary: {
    minHeight: 48,
    width: '100%',
    borderRadius: 10,
    backgroundColor: '#F15A24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  secondary: {
    minHeight: 44,
    width: '100%',
    borderRadius: 10,
    borderColor: '#2A2A2A',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryLabel: {
    color: '#F5F5F5',
    fontWeight: '700',
  },
  step: {
    width: 36,
    height: 36,
    minHeight: 36,
    borderRadius: 8,
    borderColor: Nomad.line,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    color: Nomad.bone,
    fontSize: 18,
    fontWeight: '700',
  },
  route: {
    gap: 4,
    paddingVertical: 6,
  },
  modeChip: {
    alignSelf: 'flex-end',
    backgroundColor: Nomad.glass,
    borderColor: Nomad.line,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  modeLabel: {
    color: Nomad.bone,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  swatch: {
    width: 28,
    height: 28,
    minHeight: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Nomad.line,
  },
  swatchOn: {
    borderColor: '#fff',
    borderWidth: 2,
  },
  scoutHudWrap: {
    position: 'absolute',
    left: 8,
    right: 48,
    zIndex: 22,
    elevation: 22,
  },
  scoutHud: {
    backgroundColor: Nomad.glass,
    borderColor: Nomad.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 2,
  },
  scoutHudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoutHudYards: {
    color: Nomad.bone,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    minWidth: 52,
  },
  scoutHudHint: {
    color: Nomad.bone,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    flex: 1,
  },
  scoutHudSwatches: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  scoutHudBtn: {
    width: 28,
    height: 28,
    minHeight: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Nomad.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Nomad.ink,
  },
  slimSwatch: {
    width: 22,
    height: 22,
    minHeight: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Nomad.line,
  },
  slimSliderWrap: {
    width: '100%',
    marginBottom: 0,
  },
  slimSliderHit: {
    width: '100%',
    minHeight: 22,
    justifyContent: 'center',
  },
  slimSliderTrack: {
    height: 4,
    borderRadius: 2,
  },
  slimSliderFill: {
    height: 4,
    borderRadius: 2,
  },
  slimSliderThumb: {
    width: 16,
    height: 16,
    marginLeft: -8,
    borderRadius: 8,
  },
});
