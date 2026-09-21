import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlMapOverlay } from '@/components/gl-map-overlay';
import { NativeTileMap } from '@/components/native-tile-map';
import { huntArea } from '@/constants/sample-data';
import { hydrateOverlayCache } from '@/src/overlay-pack';
import { basemapSlug } from '@/src/map-tiles';
import { useFieldStore, windWedgeRing } from '@/src/store';

export function HuntMap() {
  const gps = useFieldStore((state) => state.gps);
  const basemap = useFieldStore((state) => state.basemap);
  const followGps = useFieldStore((state) => state.followGps);
  const cameraMode = useFieldStore((state) => state.cameraMode);
  const neraMode = useFieldStore((state) => state.neraMode);
  const fpvLock = useFieldStore((state) => state.fpvHeadingLock);
  const waypoints = useFieldStore((state) => state.waypoints);
  const showWaypoints = useFieldStore((state) => state.layers.waypoints);
  const windConeOn = useFieldStore((state) => state.layers.windCone);
  const windEval = useFieldStore((state) => state.windEval);
  const weather = useFieldStore((state) => state.weather);
  const radarOn = useFieldStore((state) => state.layers.radar);
  const hasRadar = Boolean(useFieldStore((state) => state.radar));
  const hasFix = gps.latitude != null && gps.longitude != null;
  const latitude = gps.latitude ?? huntArea.latitude;
  const longitude = gps.longitude ?? huntArea.longitude;
  const fpv = cameraMode === 'fpv';
  const showGl = neraMode || cameraMode === 'orbit' || cameraMode === 'fpv';
  const windFrom =
    windEval?.windFrom ??
    (typeof weather?.windDirectionFromDegrees === 'number'
      ? weather.windDirectionFromDegrees
      : null);
  const windRing = useMemo(() => {
    if (!windConeOn || windFrom == null || !hasFix) return null;
    return windWedgeRing({ latitude, longitude }, windFrom);
  }, [hasFix, latitude, longitude, windConeOn, windFrom]);

  useEffect(() => {
    void hydrateOverlayCache();
  }, []);

  useEffect(() => {
    if (radarOn && !hasRadar) {
      void useFieldStore.getState().loadRadar();
    }
  }, [radarOn, hasRadar]);

  useEffect(() => {
    if (!hasFix || !windConeOn) return;
    void useFieldStore.getState().refreshWeather(latitude, longitude);
  }, [hasFix, latitude, longitude, windConeOn]);

  const onBounds = useCallback((bounds: { west: number; south: number; east: number; north: number }) => {
    useFieldStore.getState().setMapBounds(bounds);
  }, []);

  const onUserMove = useCallback(() => {
    const store = useFieldStore.getState();
    if (store.followGps) store.setFollowGps(false);
    if (store.cameraMode === 'fpv' && store.fpvHeadingLock) store.setFpvHeadingLock(false);
  }, []);

  const onTap = useCallback((longitude: number, latitude: number) => {
    const store = useFieldStore.getState();
    if (store.measureMode || store.drawMode) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    void store.handleMapTap(longitude, latitude);
  }, []);

  const onLongPress = useCallback((longitude: number, latitude: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    useFieldStore.getState().handleMapLongPress(longitude, latitude);
  }, []);

  return (
    <View style={styles.wrap}>
      <NativeTileMap
        style={styles.fill}
        slug={basemapSlug(basemap)}
        latitude={latitude}
        longitude={longitude}
        zoom={fpv ? 17.4 : hasFix ? 14 : 11}
        follow={(followGps || fpv) && hasFix}
        fpv={fpv}
        bearing={fpv && fpvLock ? (gps.heading ?? 0) : 0}
        onBounds={onBounds}
        onUserMove={onUserMove}
        onTap={onTap}
        onLongPress={onLongPress}
        puck={hasFix ? { latitude, longitude } : null}
        windFromDegrees={windConeOn ? windFrom : null}
        windConeRing={windRing}
        markers={
          showWaypoints
            ? waypoints.map((waypoint) => ({
                id: waypoint.id,
                latitude: waypoint.latitude,
                longitude: waypoint.longitude,
                color: '#F15A24',
              }))
            : []
        }
      />
      {showGl ? <GlMapOverlay /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#1a1c18',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
});
