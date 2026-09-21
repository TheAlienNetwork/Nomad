import {
  formatBearing,
  formatLengthFeet,
  haversineMeters,
  initialBearingDegrees,
} from '@huntos/core';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { FieldButton } from '@/components/field-button';
import { Colors, Nomad } from '@/constants/theme';
import { compassPoint, formatCoordinates, formatRadiusYards } from '@/src/format';
import { shareOrCopy } from '@/src/share-pin';
import { useFieldStore } from '@/src/store';

const SIZE = 276;
const CARDINALS = [
  { deg: 0, label: 'N' },
  { deg: 90, label: 'E' },
  { deg: 180, label: 'S' },
  { deg: 270, label: 'W' },
] as const;

type CompassFaceProps = {
  heading: number | null;
  source: string;
};

export function CompassFace({ heading, source }: CompassFaceProps) {
  const router = useRouter();
  const gps = useFieldStore((state) => state.gps);
  const truckId = useFieldStore((state) => state.truckWaypointId);
  const waypoints = useFieldStore((state) => state.waypoints);
  const parkHere = useFieldStore((state) => state.parkHere);
  const requestFlyTo = useFieldStore((state) => state.requestFlyTo);
  const [held, setHeld] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lastTick = useRef<number | null>(null);
  const lastCardinal = useRef<number | null>(null);

  const live = heading != null && Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : null;
  const shown = held ?? live;

  useEffect(() => {
    if (live == null) return;
    const bucket = Math.floor(live / 15);
    if (lastTick.current !== bucket) {
      lastTick.current = bucket;
      if (Platform.OS !== 'web') void Haptics.selectionAsync();
    }
    const cardinal = Math.round(live / 90) % 4;
    const onCardinal = Math.abs(live - cardinal * 90) < 2 || Math.abs(live - 360) < 2;
    if (onCardinal && lastCardinal.current !== cardinal) {
      lastCardinal.current = cardinal;
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (!onCardinal) lastCardinal.current = null;
  }, [live]);

  const truck = useMemo(
    () => waypoints.find((item) => item.id === truckId) ?? waypoints.find((item) => item.type === 'truck'),
    [truckId, waypoints],
  );

  const toTruck =
    gps.latitude != null && gps.longitude != null && truck
      ? {
          meters: haversineMeters(
            { latitude: gps.latitude, longitude: gps.longitude },
            { latitude: truck.latitude, longitude: truck.longitude },
          ),
          bearing: initialBearingDegrees(
            { latitude: gps.latitude, longitude: gps.longitude },
            { latitude: truck.latitude, longitude: truck.longitude },
          ),
        }
      : null;

  const roseRotate = shown != null ? -shown : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.dialShell}>
        <View style={styles.bezel}>
          <View style={[styles.rose, { transform: [{ rotate: `${roseRotate}deg` }] }]}>
            {Array.from({ length: 72 }, (_, index) => {
              const deg = index * 5;
              const cardinal = deg % 90 === 0;
              const major = deg % 15 === 0;
              return (
                <View key={deg} style={[styles.tickArm, { transform: [{ rotate: `${deg}deg` }] }]}>
                  <View
                    style={[
                      styles.tick,
                      major && styles.tickMajor,
                      cardinal && styles.tickCardinal,
                    ]}
                  />
                </View>
              );
            })}
            {CARDINALS.map((item) => (
              <View key={item.label} style={[styles.letterArm, { transform: [{ rotate: `${item.deg}deg` }] }]}>
                <Text style={[styles.letter, item.label === 'N' && styles.letterN]}>{item.label}</Text>
              </View>
            ))}
            {toTruck ? (
              <View style={[styles.truckArm, { transform: [{ rotate: `${toTruck.bearing}deg` }] }]}>
                <View style={styles.truckPip} />
              </View>
            ) : null}
          </View>
          <View style={styles.lubber} />
          <View style={styles.glass}>
            <Text style={styles.deg}>{shown != null ? `${Math.round(shown)}°` : '—'}</Text>
            <Text style={styles.cardinal}>{shown != null ? compassPoint(shown) : 'SEEK'}</Text>
            {held != null ? <Text style={styles.held}>HOLD</Text> : null}
          </View>
        </View>
      </View>

      <Text style={styles.source}>{source}</Text>

      <View style={styles.stat}>
        <Text style={styles.statKicker}>Fix</Text>
        <Text style={styles.statValue}>
          {gps.latitude != null && gps.longitude != null
            ? formatCoordinates(gps.latitude, gps.longitude)
            : 'No GPS fix'}
        </Text>
        <Text style={styles.statQuiet}>
          {gps.accuracy != null ? `±${formatLengthFeet(gps.accuracy)}` : 'Accuracy unknown'}
          {gps.altitude != null ? ` · ${formatLengthFeet(gps.altitude)} elev` : ''}
        </Text>
      </View>

      <View style={styles.stat}>
        <Text style={styles.statKicker}>Truck</Text>
        {toTruck && truck ? (
          <>
            <Text style={styles.statValue}>
              {formatBearing(toTruck.bearing)} · {formatRadiusYards(toTruck.meters)}
            </Text>
            <Text style={styles.statQuiet}>Rust pip on the rose is the bearing to Park here.</Text>
          </>
        ) : (
          <Text style={styles.statValue}>No truck mark. Park here at this fix.</Text>
        )}
      </View>

      <View style={styles.tools}>
        <FieldButton
          accessibilityLabel={held != null ? 'Release heading' : 'Hold heading'}
          style={[styles.tool, held != null && styles.toolOn]}
          onPress={() => setHeld((current) => (current == null ? live : null))}>
          <Text style={[styles.toolLabel, held != null && styles.toolLabelOn]}>
            {held != null ? 'Release' : 'Hold'}
          </Text>
        </FieldButton>
        <FieldButton
          accessibilityLabel="Share coordinates"
          style={styles.tool}
          onPress={() => {
            if (gps.latitude == null || gps.longitude == null) {
              setNotice('Need a GPS fix to share.');
              return;
            }
            void shareOrCopy('Nomad fix', `Nomad fix ${formatCoordinates(gps.latitude, gps.longitude)}`).then(
              (message) => setNotice(message),
            );
          }}>
          <Text style={styles.toolLabel}>Share fix</Text>
        </FieldButton>
        {truck && toTruck ? (
          <FieldButton
            accessibilityLabel="Open truck on map"
            style={styles.tool}
            onPress={() => {
              requestFlyTo(truck.latitude, truck.longitude, 15);
              router.push('/(tabs)');
            }}>
            <Text style={styles.toolLabel}>Open map</Text>
          </FieldButton>
        ) : (
          <FieldButton
            accessibilityLabel="Park here"
            style={styles.tool}
            onPress={() => {
              if (gps.latitude == null || gps.longitude == null) {
                setNotice('Need a GPS fix to park.');
                return;
              }
              parkHere();
              setNotice('Truck marked at this fix.');
            }}>
            <Text style={styles.toolLabel}>Park here</Text>
          </FieldButton>
        )}
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Text style={styles.warn}>
        A field compass is a heading aid, not a rescue plan. Confirm against posted maps and a physical compass when you can.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
    alignItems: 'center',
  },
  dialShell: {
    width: SIZE + 28,
    height: SIZE + 28,
    borderRadius: (SIZE + 28) / 2,
    backgroundColor: '#0c0b09',
    borderWidth: 1,
    borderColor: 'rgba(232,223,208,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F15A24',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  bezel: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: Nomad.ink,
    borderWidth: 3,
    borderColor: 'rgba(241,90,36,0.55)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rose: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
  },
  tickArm: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
  },
  tick: {
    width: 1,
    height: 8,
    marginTop: 10,
    backgroundColor: 'rgba(163,154,140,0.45)',
  },
  tickMajor: {
    height: 14,
    width: 1.5,
    backgroundColor: Nomad.mist,
  },
  tickCardinal: {
    height: 20,
    width: 2,
    backgroundColor: Nomad.rust,
  },
  letterArm: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
  },
  letter: {
    marginTop: 28,
    color: Nomad.bone,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  letterN: {
    color: Nomad.rust,
    fontSize: 16,
  },
  truckArm: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
  },
  truckPip: {
    marginTop: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Nomad.rust,
    borderWidth: 1,
    borderColor: '#fff',
  },
  lubber: {
    position: 'absolute',
    top: 4,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Nomad.bone,
    zIndex: 3,
  },
  glass: {
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: 'rgba(18,16,13,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(241,90,36,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  deg: {
    color: Nomad.bone,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardinal: {
    color: Nomad.rust,
    fontWeight: '800',
    letterSpacing: 3,
    fontSize: 13,
  },
  held: {
    marginTop: 4,
    color: Nomad.bone,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  source: {
    color: Colors.dark.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  stat: {
    alignSelf: 'stretch',
    backgroundColor: Nomad.steel,
    borderWidth: 1,
    borderColor: Nomad.line,
    borderRadius: 14,
    padding: 12,
    gap: 3,
  },
  statKicker: {
    color: Nomad.mist,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  statValue: {
    color: Nomad.bone,
    fontSize: 15,
    fontWeight: '700',
  },
  statQuiet: {
    color: Colors.dark.muted,
    fontSize: 12,
  },
  tools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignSelf: 'stretch',
  },
  tool: {
    flexGrow: 1,
    minHeight: 44,
    minWidth: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Nomad.line,
    backgroundColor: Nomad.steel,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  toolOn: {
    backgroundColor: Nomad.rust,
    borderColor: Nomad.rust,
  },
  toolLabel: {
    color: Nomad.bone,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  toolLabelOn: {
    color: '#fff',
  },
  notice: {
    color: Nomad.bone,
    fontSize: 12,
    textAlign: 'center',
  },
  warn: {
    color: Nomad.mist,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
