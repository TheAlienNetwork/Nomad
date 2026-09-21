import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  RADAR_DISCLAIMER,
  formatDistance,
  formatSpeedMph,
  formatTemperatureF,
} from '@huntos/core';
import { Image } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FieldButton } from '@/components/field-button';
import { SheetTopo } from '@/components/sheet-topo';
import { Nomad } from '@/constants/theme';
import {
  formatAcres,
  formatClock,
  formatRadiusYards,
  temperatureLabel,
  windLabel,
} from '@/src/format';
import { skyForPoint, type SkySnapshot } from '@/src/sky';
import { attachPickedWaypointPhoto } from '@/src/waypoint-photo';
import {
  measureResult,
  useFieldStore,
  waypointSightingLine,
  type RecoveryKind,
} from '@/src/store';

export function WeatherSheet() {
  const weather = useFieldStore((state) => state.weather);
  const gps = useFieldStore((state) => state.gps);
  const online = useFieldStore((state) => state.online);
  const radar = useFieldStore((state) => state.radar);
  const radarIndex = useFieldStore((state) => state.radarIndex);
  const radarPlaying = useFieldStore((state) => state.radarPlaying);
  const windEval = useFieldStore((state) => state.windEval);
  const [sky, setSky] = useState<SkySnapshot | undefined>();

  useEffect(() => {
    const latitude = gps.latitude;
    const longitude = gps.longitude;
    if (latitude == null || longitude == null) return;
    void skyForPoint(latitude, longitude).then(setSky);
    const timer = setInterval(() => {
      void useFieldStore.getState().refreshWeather(latitude, longitude);
      void useFieldStore.getState().loadRadar();
    }, 12 * 60 * 1000);
    return () => clearInterval(timer);
  }, [gps.latitude, gps.longitude]);

  useEffect(() => {
    if (!radarPlaying || !radar) return;
    const timer = setInterval(() => {
      const store = useFieldStore.getState();
      const next = store.radarIndex + 1;
      store.setRadarIndex(next >= (store.radar?.frames.length ?? 1) ? 0 : next);
    }, 700);
    return () => clearInterval(timer);
  }, [radarPlaying, radar]);

  const frame = radar?.frames[radarIndex];
  const noFix = gps.source === 'none' || gps.latitude == null;

  return (
    <ToolSheet title="WEATHER">
      <ScrollView style={styles.scroll}>
        <Text style={styles.help}>
          {noFix
            ? 'NO FIX — weather waits on a location.'
            : weather
              ? `${temperatureLabel(weather)} · ${windLabel(weather)}`
              : 'Weather unknown.'}
        </Text>
        {weather ? (
          <View style={styles.grid}>
            <Stat label="Temp" value={formatTemperatureF(weather.temperatureC ?? Number.NaN)} />
            <Stat
              label="Wind"
              value={
                weather.windSpeedMps == null
                  ? '—'
                  : `${formatSpeedMph(weather.windSpeedMps)}${weather.windGustMps != null ? ` g ${formatSpeedMph(weather.windGustMps)}` : ''}`
              }
            />
            <Stat label="Humidity" value={weather.humidityPct != null ? `${Math.round(weather.humidityPct)}%` : '—'} />
            <Stat
              label="Pressure"
              value={weather.pressureHpa != null ? `${Math.round(weather.pressureHpa)} hPa` : '—'}
            />
            <Stat
              label="Precip"
              value={weather.precipitationMm != null ? `${weather.precipitationMm.toFixed(1)} mm` : '—'}
            />
            <Stat
              label="Vis"
              value={weather.visibilityM != null ? formatDistance(weather.visibilityM) : '—'}
            />
          </View>
        ) : null}
        {sky ? (
          <Text style={styles.help}>
            Dawn {formatClock(sky.civilDawnIso)} · rise {formatClock(sky.sunriseIso)} · set{' '}
            {formatClock(sky.sunsetIso)} · {sky.moonPhaseName} {Math.round(sky.moonIllumination * 100)}%
          </Text>
        ) : null}
        {windEval ? (
          <Text style={styles.help}>
            Wind cone {windEval.classification}
            {windEval.reasons[0] ? ` · ${windEval.reasons[0]}` : ''}
          </Text>
        ) : null}
        <Text style={styles.group}>24 HOURS</Text>
        {(weather?.hourly ?? []).slice(0, 12).map((hour) => (
          <Text key={hour.time} style={styles.hour}>
            {formatClock(hour.time)} · {formatTemperatureF(hour.temperatureC ?? Number.NaN)} · precip{' '}
            {hour.precipitationMm != null ? `${hour.precipitationMm.toFixed(1)} mm` : '—'}
          </Text>
        ))}
        <Text style={styles.group}>RADAR</Text>
        {!online ? (
          <Text style={styles.warn}>OFF-GRID — radar needs a connection. Frames are not guessed.</Text>
        ) : (
          <>
            <Text style={styles.help}>
              {frame
                ? new Date(frame.time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                : 'Radar unknown'}
              {radar && radarIndex >= radar.nowcastStartIndex ? ' · nowcast' : ''}
            </Text>
            <View style={styles.row}>
              <FieldButton
                style={styles.step}
                onPress={() => useFieldStore.getState().setRadarIndex(radarIndex - 1)}>
                <Text style={styles.stepLabel}>-</Text>
              </FieldButton>
              <Text style={styles.help}>
                {radarIndex + 1}/{radar?.frames.length ?? 0}
              </Text>
              <FieldButton
                style={styles.step}
                onPress={() => useFieldStore.getState().setRadarIndex(radarIndex + 1)}>
                <Text style={styles.stepLabel}>+</Text>
              </FieldButton>
              <FieldButton
                style={styles.secondary}
                onPress={() => useFieldStore.getState().setRadarPlaying(!radarPlaying)}>
                <Text style={styles.secondaryLabel}>{radarPlaying ? 'Pause' : 'Play'}</Text>
              </FieldButton>
            </View>
            <Text style={styles.warn}>{RADAR_DISCLAIMER}</Text>
          </>
        )}
        <FieldButton style={styles.secondary} onPress={() => useFieldStore.getState().openSheet('wind')}>
          <Text style={styles.secondaryLabel}>Wind what-if</Text>
        </FieldButton>
        <Text style={styles.warn}>Open-Meteo forecast. RainViewer radar.</Text>
      </ScrollView>
    </ToolSheet>
  );
}

export function WindSheet() {
  const windEval = useFieldStore((state) => state.windEval);
  const whatIf = useFieldStore((state) => state.windWhatIfDegrees);
  const waypoints = useFieldStore((state) => state.waypoints);
  const targetId = useFieldStore((state) => state.windTargetId);
  const degrees = whatIf ?? windEval?.windFrom ?? 0;

  return (
    <ToolSheet title="WIND">
      <Text style={styles.help}>
        {windEval
          ? `${windEval.classification} · from ${Math.round(windEval.windFrom)}°`
          : 'Wind unknown until weather and a GPS fix.'}
      </Text>
      <Text style={styles.warn}>
        Forecast wind from Open-Meteo. Terrain channeling and swirl are not modeled.
      </Text>
      {windEval?.reasons.map((reason) => (
        <Text key={reason} style={styles.help}>
          {reason}
        </Text>
      ))}
      <Text style={styles.group}>WHAT-IF FROM</Text>
      <View style={styles.row}>
        <FieldButton
          style={styles.step}
          onPress={() => useFieldStore.getState().setWindWhatIf((degrees - 15 + 360) % 360)}>
          <Text style={styles.stepLabel}>-15</Text>
        </FieldButton>
        <Text style={styles.stat}>{Math.round(degrees)}°</Text>
        <FieldButton
          style={styles.step}
          onPress={() => useFieldStore.getState().setWindWhatIf((degrees + 15) % 360)}>
          <Text style={styles.stepLabel}>+15</Text>
        </FieldButton>
        <FieldButton style={styles.secondary} onPress={() => useFieldStore.getState().setWindWhatIf(null)}>
          <Text style={styles.secondaryLabel}>Live wind</Text>
        </FieldButton>
      </View>
      <Text style={styles.group}>TARGET MARK</Text>
      <ScrollView horizontal contentContainerStyle={styles.chips}>
        {waypoints.slice(0, 12).map((point) => (
          <FieldButton
            key={point.id}
            style={[styles.chip, targetId === point.id && styles.chipOn]}
            onPress={() => useFieldStore.getState().setWindTarget(point.id)}>
            <Text style={[styles.chipLabel, targetId === point.id && styles.chipLabelOn]}>{point.name}</Text>
          </FieldButton>
        ))}
      </ScrollView>
      <Text style={styles.warn}>
        {windEval?.disclaimer ?? 'Geometric heuristic. Terrain channeling is not modeled.'}
      </Text>
    </ToolSheet>
  );
}

export function AreasSheet() {
  const areas = useFieldStore((state) => state.huntAreas);
  const selected = useFieldStore((state) => state.selectedHuntAreaId);
  const [name, setName] = useState('');

  return (
    <ToolSheet title="HUNT AREAS">
      <Text style={styles.help}>Saves the visible map bounds. Jump later. Not a legal hunt unit.</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Oak ridge · north tract"
        placeholderTextColor="#7A7A7A"
        style={styles.input}
      />
      <FieldButton style={styles.primary} onPress={() => useFieldStore.getState().saveHuntArea(name)}>
        <Text style={styles.primaryLabel}>Save this view</Text>
      </FieldButton>
      {areas.map((area) => (
        <View key={area.id} style={styles.card}>
          <Text style={styles.stat}>{area.name}</Text>
          <View style={styles.row}>
            <FieldButton
              style={[styles.secondary, selected === area.id && styles.chipOn]}
              onPress={() => useFieldStore.getState().jumpHuntArea(area.id)}>
              <Text style={styles.secondaryLabel}>Jump</Text>
            </FieldButton>
            <FieldButton style={styles.secondary} onPress={() => useFieldStore.getState().deleteHuntArea(area.id)}>
              <Text style={styles.secondaryLabel}>Delete</Text>
            </FieldButton>
          </View>
        </View>
      ))}
    </ToolSheet>
  );
}

export function RecoverySheet() {
  const recovery = useFieldStore((state) => state.recovery);
  if (!recovery) return null;
  const kinds: RecoveryKind[] = ['shot', 'blood', 'hair', 'last_seen', 'find'];
  const last = recovery.marks[recovery.marks.length - 1];
  const shot = recovery.marks.find((mark) => mark.kind === 'shot');

  return (
    <ToolSheet title="RECOVERY">
      <Text style={styles.help}>Tap the map to drop the selected chip. Track records while you walk.</Text>
      <View style={styles.chips}>
        {kinds.map((kind) => (
          <FieldButton
            key={kind}
            style={[styles.chip, recovery.dropKind === kind && styles.chipOn]}
            onPress={() => useFieldStore.getState().setRecoveryKind(kind)}>
            <Text style={[styles.chipLabel, recovery.dropKind === kind && styles.chipLabelOn]}>{kind}</Text>
          </FieldButton>
        ))}
      </View>
      {last && shot ? (
        <Text style={styles.stat}>
          {formatRadiusYards(
            Math.hypot((last.latitude - shot.latitude) * 111320, (last.longitude - shot.longitude) * 85000),
          )}{' '}
          from shot
        </Text>
      ) : null}
      {recovery.marks.map((mark) => (
        <Text key={mark.id} style={styles.hour}>
          {mark.kind} · {formatClock(mark.recordedAt)}
        </Text>
      ))}
      <FieldButton style={styles.primary} onPress={() => useFieldStore.getState().endRecovery()}>
        <Text style={styles.primaryLabel}>{recovery.endedAt ? 'Close' : 'End recovery'}</Text>
      </FieldButton>
    </ToolSheet>
  );
}

export function MeasureHud({ bottom }: { bottom: number }) {
  const on = useFieldStore((state) => state.measureMode);
  const yards = useFieldStore((state) => measureResult(state)?.yards);
  const bearing = useFieldStore((state) => measureResult(state)?.bearing);
  const acres = useFieldStore((state) => measureResult(state)?.acres);
  if (!on && yards == null) return null;
  return (
    <View pointerEvents="box-none" style={[styles.hudWrap, { bottom }]}>
      <View style={styles.hud}>
        <Text style={styles.stat}>
          {yards != null
            ? `${Math.round(yards)} yd${bearing ? ` · ${bearing}` : ''}${acres != null ? ` · ${formatAcres(acres)}` : ''}`
            : 'MEASURE · tap two marks or map points'}
        </Text>
        <FieldButton style={styles.hudBtn} onPress={() => useFieldStore.getState().clearMeasure()}>
          <MaterialIcons name="close" size={18} color={Nomad.bone} />
        </FieldButton>
      </View>
    </View>
  );
}

export function MarkExtras() {
  const mark = useFieldStore((state) =>
    state.waypoints.find((item) => item.id === state.selectedWaypointId),
  );
  const camera = useFieldStore((state) =>
    state.trailCameras.find((item) => item.waypointId === state.selectedWaypointId),
  );
  const pattern = useFieldStore(waypointSightingLine);
  const bearing = useFieldStore((state) => state.glassingBearing);
  if (!mark) return null;

  async function addPhoto(fromCamera: boolean) {
    if (!mark) return;
    await attachPickedWaypointPhoto(mark.id, fromCamera);
  }

  return (
    <View>
      {mark.photos.length ? (
        <ScrollView horizontal contentContainerStyle={styles.photoStrip}>
          {mark.photos.map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.photoWrap}>
              <Image source={{ uri }} style={styles.galleryPhoto} contentFit="cover" />
              <FieldButton
                style={styles.secondary}
                onPress={() => useFieldStore.getState().removeWaypointPhoto(mark.id, index)}>
                <Text style={styles.secondaryLabel}>Remove</Text>
              </FieldButton>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.row}>
        <FieldButton style={styles.secondary} onPress={() => void addPhoto(true)}>
          <Text style={styles.secondaryLabel}>Camera</Text>
        </FieldButton>
        <FieldButton style={styles.secondary} onPress={() => void addPhoto(false)}>
          <Text style={styles.secondaryLabel}>Library</Text>
        </FieldButton>
      </View>
      {pattern ? <Text style={styles.help}>{pattern}</Text> : null}
      {mark.type === 'trail_camera' ? (
        <>
          <Text style={styles.help}>
            Last checked {camera?.lastChecked ? formatClock(camera.lastChecked) : '—'}
            {camera?.installedAt ? ` · in since ${formatClock(camera.installedAt)}` : ''}
          </Text>
          <FieldButton style={styles.secondary} onPress={() => useFieldStore.getState().checkInCamera(mark.id)}>
            <Text style={styles.secondaryLabel}>Check in here</Text>
          </FieldButton>
        </>
      ) : null}
      {mark.type === 'harvest' ? (
        <FieldButton style={styles.secondary} onPress={() => useFieldStore.getState().startRecovery(mark.id)}>
          <Text style={styles.secondaryLabel}>Start recovery</Text>
        </FieldButton>
      ) : null}
      <Text style={styles.group}>GLASSING LOS</Text>
      <View style={styles.row}>
        <FieldButton style={styles.step} onPress={() => useFieldStore.getState().setGlassingBearing(bearing - 15)}>
          <Text style={styles.stepLabel}>-15</Text>
        </FieldButton>
        <Text style={styles.stat}>{Math.round(bearing)}°</Text>
        <FieldButton style={styles.step} onPress={() => useFieldStore.getState().setGlassingBearing(bearing + 15)}>
          <Text style={styles.stepLabel}>+15</Text>
        </FieldButton>
      </View>
      <FieldButton
        style={styles.secondary}
        onPress={() => void useFieldStore.getState().runGlassingLos(mark.id, bearing)}>
        <Text style={styles.secondaryLabel}>Glass this bearing</Text>
      </FieldButton>
      <Text style={styles.warn}>Sampled elevations, not lidar. Trees are not modeled.</Text>
    </View>
  );
}

function ToolSheet({ title, children }: { title: string; children: ReactNode }) {
  const closeSheet = useFieldStore((state) => state.closeSheet);
  return (
    <View style={styles.backdrop}>
      <FieldButton accessibilityLabel="Dismiss" style={styles.hit} onPress={closeSheet}>
        <View />
      </FieldButton>
      <View style={styles.sheet}>
        <SheetTopo />
        <View style={styles.handle} />
        <View style={styles.head}>
          <Text style={styles.title}>{title}</Text>
          <FieldButton onPress={closeSheet} accessibilityLabel="Close" style={styles.closeChip}>
            <Text style={styles.close}>Close</Text>
          </FieldButton>
        </View>
        <View style={styles.body}>{children}</View>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.stat}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    elevation: 30,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  hit: { flex: 1, width: '100%' },
  sheet: {
    backgroundColor: 'rgba(18,16,13,0.96)',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderColor: Nomad.line,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingBottom: 18,
    maxHeight: '78%',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Nomad.line,
    marginTop: 8,
    zIndex: 1,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    zIndex: 1,
  },
  title: { color: Nomad.rust, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  closeChip: { paddingHorizontal: 8, paddingVertical: 4 },
  close: { color: Nomad.mist, fontSize: 11, fontWeight: '700' },
  body: { zIndex: 1 },
  scroll: { maxHeight: 420 },
  help: { color: Nomad.mist, fontSize: 12, lineHeight: 16, marginTop: 6 },
  warn: { color: '#ffd166', fontSize: 11, lineHeight: 15, marginTop: 8 },
  group: { color: Nomad.mist, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  statBox: { width: '30%', minWidth: 90 },
  stat: { color: Nomad.bone, fontSize: 14, fontWeight: '700' },
  muted: { color: Nomad.mist, fontSize: 10, letterSpacing: 0.8 },
  hour: { color: Nomad.bone, fontSize: 11, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  step: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Nomad.line,
  },
  stepLabel: { color: Nomad.bone, fontWeight: '700', fontSize: 12 },
  secondary: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Nomad.line,
  },
  secondaryLabel: { color: Nomad.bone, fontWeight: '700', fontSize: 12 },
  primary: {
    marginTop: 10,
    backgroundColor: Nomad.rust,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryLabel: { color: '#fff', fontWeight: '800' },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: Nomad.line,
    borderRadius: 8,
    color: Nomad.bone,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingRight: 8 },
  chip: {
    borderWidth: 1,
    borderColor: Nomad.line,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: 'rgba(241,90,36,0.35)' },
  chipLabel: { color: Nomad.mist, fontSize: 11, fontWeight: '700' },
  chipLabelOn: { color: Nomad.bone },
  card: { marginTop: 10, borderWidth: 1, borderColor: Nomad.line, borderRadius: 8, padding: 8 },
  photo: { width: '100%', height: 160, borderRadius: 10, marginTop: 8, backgroundColor: Nomad.ink },
  photoStrip: { gap: 8, paddingTop: 8 },
  photoWrap: { width: 120, gap: 6 },
  galleryPhoto: { width: 120, height: 120, borderRadius: 8, backgroundColor: Nomad.ink },
  hudWrap: { position: 'absolute', left: 8, right: 52, zIndex: 22 },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Nomad.glass,
    borderColor: Nomad.line,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hudBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
