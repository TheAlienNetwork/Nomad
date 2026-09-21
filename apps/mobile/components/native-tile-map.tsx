import type { BoundingBox } from '@huntos/core';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { osmTileUrl, rasterTileMaxZoom, rasterTileUrl, type RasterTileSlug } from '@/src/map-tiles';
import { readCachedBasemapUri } from '@/src/overlay-pack';

const TILE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 19;
const FPV_ZOOM = 17.4;

export type NativeMapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
};

type LngLat = { longitude: number; latitude: number };

type NativeTileMapProps = {
  slug: RasterTileSlug;
  latitude: number;
  longitude: number;
  zoom?: number;
  follow?: boolean;
  bearing?: number | null;
  fpv?: boolean;
  overlayTemplate?: string;
  markers?: NativeMapMarker[];
  puck?: { latitude: number; longitude: number } | null;
  /** Wind from degrees (meteorological). Draws a downwind cone when set. */
  windFromDegrees?: number | null;
  windConeRing?: Array<{ latitude: number; longitude: number }> | null;
  onBounds?: (bounds: BoundingBox) => void;
  onUserMove?: () => void;
  onTap?: (longitude: number, latitude: number) => void;
  onLongPress?: (longitude: number, latitude: number) => void;
  scrollFriendly?: boolean;
  style?: StyleProp<ViewStyle>;
};

type ViewState = {
  latitude: number;
  longitude: number;
  zoom: number;
};

function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 12;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

function clampLat(latitude: number): number {
  return Math.max(-85.05112878, Math.min(85.05112878, latitude));
}

function worldSize(zoom: number): number {
  return TILE * 2 ** zoom;
}

function lngToWorldX(longitude: number, zoom: number): number {
  return ((longitude + 180) / 360) * worldSize(zoom);
}

function latToWorldY(latitude: number, zoom: number): number {
  const lat = clampLat(latitude) * (Math.PI / 180);
  const mercator = Math.log(Math.tan(Math.PI / 4 + lat / 2));
  return ((1 - mercator / Math.PI) / 2) * worldSize(zoom);
}

function worldXToLng(x: number, zoom: number): number {
  return (x / worldSize(zoom)) * 360 - 180;
}

function worldYToLat(y: number, zoom: number): number {
  const n = Math.PI * (1 - (2 * y) / worldSize(zoom));
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
}

function wrapTileX(x: number, zoom: number): number {
  const n = 2 ** zoom;
  return ((x % n) + n) % n;
}

function fillTemplate(template: string, z: number, x: number, y: number): string {
  return template.replace(/\{z\}/g, String(z)).replace(/\{x\}/g, String(x)).replace(/\{y\}/g, String(y));
}

function screenToLngLat(
  x: number,
  y: number,
  view: ViewState,
  size: { width: number; height: number },
  bearing: number,
): LngLat {
  const dx = x - size.width / 2;
  const dy = y - size.height / 2;
  const rad = (bearing * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const worldDx = dx * cos - dy * sin;
  const worldDy = dx * sin + dy * cos;
  const z = view.zoom;
  return {
    longitude: worldXToLng(lngToWorldX(view.longitude, z) + worldDx, z),
    latitude: worldYToLat(latToWorldY(view.latitude, z) + worldDy, z),
  };
}

function fallbackTileUrl(slug: RasterTileSlug, z: number, x: number, y: number): string {
  if (slug === 'esri-hillshade') {
    const capped = Math.min(z, rasterTileMaxZoom('usgs-hillshade'));
    const factor = 2 ** (z - capped);
    return rasterTileUrl('usgs-hillshade', capped, Math.floor(x / factor), Math.floor(y / factor));
  }
  return osmTileUrl(z, x, y);
}

function TileImage({
  uri,
  fallback,
  left,
  top,
  size,
}: {
  uri: string;
  fallback?: string;
  left: number;
  top: number;
  size: number;
}) {
  const [src, setSrc] = useState(uri);
  useEffect(() => {
    setSrc(uri);
  }, [uri]);
  return (
    <Image
      recyclingKey={src}
      source={{ uri: src }}
      contentFit="fill"
      cachePolicy="memory-disk"
      onError={() => {
        if (fallback && src !== fallback) setSrc(fallback);
      }}
      style={[styles.tile, { left, top, width: size, height: size }]}
    />
  );
}

export function NativeTileMap({
  slug,
  latitude,
  longitude,
  zoom = 12,
  follow = false,
  bearing = null,
  fpv = false,
  overlayTemplate,
  markers = [],
  puck = null,
  windFromDegrees = null,
  windConeRing = null,
  onBounds,
  onUserMove,
  onTap,
  onLongPress,
  scrollFriendly = false,
  style,
}: NativeTileMapProps) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<ViewState>({
    latitude,
    longitude,
    zoom: clampZoom(zoom),
  });
  const [detached, setDetached] = useState(false);
  const followWas = useRef(follow);
  const pinchZoom = useRef(view.zoom);
  const fpvWas = useRef(false);
  const mapBearing = fpv && typeof bearing === 'number' && Number.isFinite(bearing) ? bearing : 0;

  useEffect(() => {
    if (follow && !followWas.current) setDetached(false);
    followWas.current = follow;
  }, [follow]);

  useEffect(() => {
    if (detached) return;
    setView((current) => ({ ...current, latitude, longitude }));
  }, [detached, latitude, longitude]);

  useEffect(() => {
    if (fpv && !fpvWas.current) {
      setDetached(false);
      setView((current) => ({ ...current, latitude, longitude, zoom: FPV_ZOOM }));
    }
    fpvWas.current = fpv;
  }, [fpv, latitude, longitude]);

  const tiles = useMemo(() => {
    const { width, height } = layout;
    if (width < 2 || height < 2) return [];
    const maxZ = rasterTileMaxZoom(slug);
    const z = Math.min(Math.floor(view.zoom), maxZ);
    const scale = 2 ** (view.zoom - z);
    const n = 2 ** z;
    const worldX = lngToWorldX(view.longitude, z);
    const worldY = latToWorldY(view.latitude, z);
    const halfW = width / 2 / scale;
    const halfH = height / 2 / scale;
    const minX = Math.floor((worldX - halfW) / TILE) - 1;
    const maxX = Math.floor((worldX + halfW) / TILE) + 1;
    const minY = Math.floor((worldY - halfH) / TILE) - 1;
    const maxY = Math.floor((worldY + halfH) / TILE) + 1;
    const drawn = TILE * scale;
    const next: Array<{
      key: string;
      uri: string;
      fallback: string;
      overlay?: string;
      left: number;
      top: number;
      size: number;
    }> = [];
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        if (y < 0 || y >= n) continue;
        const tx = wrapTileX(x, z);
        next.push({
          key: `${z}/${x}/${y}`,
          uri: readCachedBasemapUri(slug, z, tx, y) ?? rasterTileUrl(slug, z, tx, y),
          fallback: fallbackTileUrl(slug, z, tx, y),
          overlay: overlayTemplate ? fillTemplate(overlayTemplate, z, tx, y) : undefined,
          left: (x * TILE - worldX) * scale + width / 2,
          top: (y * TILE - worldY) * scale + height / 2,
          size: drawn,
        });
      }
    }
    return next;
  }, [layout, overlayTemplate, slug, view.latitude, view.longitude, view.zoom]);

  useEffect(() => {
    if (!onBounds || layout.width < 2 || layout.height < 2) return;
    const z = view.zoom;
    const worldX = lngToWorldX(view.longitude, z);
    const worldY = latToWorldY(view.latitude, z);
    const timer = setTimeout(() => {
      onBounds({
        west: worldXToLng(worldX - layout.width / 2, z),
        east: worldXToLng(worldX + layout.width / 2, z),
        north: worldYToLat(worldY - layout.height / 2, z),
        south: worldYToLat(worldY + layout.height / 2, z),
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [layout.height, layout.width, onBounds, view.latitude, view.longitude, view.zoom]);

  const detach = () => {
    setDetached(true);
    onUserMove?.();
  };

  const panBy = (dx: number, dy: number) => {
    setView((current) => {
      const rad = (mapBearing * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const worldDx = dx * cos - dy * sin;
      const worldDy = dx * sin + dy * cos;
      const z = current.zoom;
      return {
        ...current,
        longitude: worldXToLng(lngToWorldX(current.longitude, z) - worldDx, z),
        latitude: worldYToLat(latToWorldY(current.latitude, z) - worldDy, z),
      };
    });
  };

  const zoomByScale = (scale: number) => {
    const next = clampZoom(pinchZoom.current + Math.log2(scale));
    setView((current) => (Math.abs(current.zoom - next) < 0.01 ? current : { ...current, zoom: next }));
  };

  const rememberPinch = () => {
    pinchZoom.current = view.zoom;
    detach();
  };

  const tapAt = (x: number, y: number) => {
    if (!onTap || layout.width < 2) return;
    const point = screenToLngLat(x, y, view, layout, mapBearing);
    onTap(point.longitude, point.latitude);
  };

  const holdAt = (x: number, y: number) => {
    if (!onLongPress || layout.width < 2) return;
    const point = screenToLngLat(x, y, view, layout, mapBearing);
    onLongPress(point.longitude, point.latitude);
  };

  let pan = Gesture.Pan()
    .minDistance(12)
    .onStart(() => {
      runOnJS(detach)();
    })
    .onChange((event) => {
      runOnJS(panBy)(event.changeX, event.changeY);
    });
  if (scrollFriendly) {
    pan = pan.activeOffsetX([-12, 12]).failOffsetY([-18, 18]);
  }

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      runOnJS(rememberPinch)();
    })
    .onUpdate((event) => {
      runOnJS(zoomByScale)(event.scale);
    });

  const move = Gesture.Simultaneous(pan, pinch);
  const hold = Gesture.LongPress()
    .minDuration(550)
    .maxDistance(16)
    .onStart((event) => {
      runOnJS(holdAt)(event.x, event.y);
    });
  const tap = Gesture.Tap()
    .maxDuration(320)
    .maxDistance(14)
    .onEnd((event) => {
      runOnJS(tapAt)(event.x, event.y);
    });
  const gesture = scrollFriendly ? move : Gesture.Simultaneous(Gesture.Exclusive(hold, tap), move);

  const placed = (point: LngLat) => {
    if (layout.width < 2) return null;
    const z = view.zoom;
    const wx = lngToWorldX(point.longitude, z) - lngToWorldX(view.longitude, z);
    const wy = latToWorldY(point.latitude, z) - latToWorldY(view.latitude, z);
    const rad = (mapBearing * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const left = wx * cos + wy * sin + layout.width / 2;
    const top = -wx * sin + wy * cos + layout.height / 2;
    if (left < -24 || top < -24 || left > layout.width + 24 || top > layout.height + 24) return null;
    return { left, top };
  };

  const puckPoint = puck ? placed(puck) : null;
  const windScreen = useMemo(() => {
    if (!windConeRing || windConeRing.length < 3 || layout.width < 2) return [];
    return windConeRing
      .map((point) => placed(point))
      .filter((point): point is { left: number; top: number } => point != null);
  }, [layout.height, layout.width, mapBearing, view.latitude, view.longitude, view.zoom, windConeRing]);

  const windSegments = useMemo(() => {
    const segments: Array<{ key: string; left: number; top: number; length: number; angle: number }> = [];
    for (let i = 1; i < windScreen.length; i += 1) {
      const a = windScreen[i - 1];
      const b = windScreen[i];
      if (!a || !b) continue;
      const dx = b.left - a.left;
      const dy = b.top - a.top;
      const length = Math.hypot(dx, dy);
      if (length < 2) continue;
      segments.push({
        key: `w-${i}`,
        left: (a.left + b.left) / 2,
        top: (a.top + b.top) / 2,
        length,
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      });
    }
    return segments;
  }, [windScreen]);

  const windToward =
    typeof windFromDegrees === 'number' && Number.isFinite(windFromDegrees)
      ? windFromDegrees + 180 - mapBearing
      : null;

  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setLayout({ width, height });
        }}
        style={[styles.wrap, style]}>
        <View pointerEvents="none" style={[styles.spin, { transform: [{ rotate: `${mapBearing}deg` }] }]}>
          {tiles.map((tile) => (
            <TileImage
              key={tile.key}
              uri={tile.uri}
              fallback={tile.fallback}
              left={tile.left}
              top={tile.top}
              size={tile.size}
            />
          ))}
          {tiles.map((tile) =>
            tile.overlay ? (
              <Image
                key={`ov-${tile.key}`}
                recyclingKey={tile.overlay}
                source={{ uri: tile.overlay }}
                contentFit="fill"
                cachePolicy="memory-disk"
                style={[
                  styles.tile,
                  styles.overlay,
                  { left: tile.left, top: tile.top, width: tile.size, height: tile.size },
                ]}
              />
            ) : null,
          )}
        </View>
        {windSegments.map((segment) => (
          <View
            key={segment.key}
            pointerEvents="none"
            style={[
              styles.windEdge,
              {
                left: segment.left - segment.length / 2,
                top: segment.top - 1.5,
                width: segment.length,
                transform: [{ rotate: `${segment.angle}deg` }],
              },
            ]}
          />
        ))}
        {markers.map((marker) => {
          const point = placed(marker);
          if (!point) return null;
          return (
            <View
              key={marker.id}
              pointerEvents="none"
              style={[styles.mark, { left: point.left - 5, top: point.top - 5, backgroundColor: marker.color }]}
            />
          );
        })}
        {puckPoint ? (
          <View pointerEvents="none" style={[styles.puckWrap, { left: puckPoint.left - 8, top: puckPoint.top - 16 }]}>
            {fpv ? <View style={styles.wedge} /> : <View style={styles.wedgeGap} />}
            <View style={styles.puck} />
          </View>
        ) : null}
        {puckPoint && windToward != null ? (
          <View
            pointerEvents="none"
            style={[
              styles.windArrowWrap,
              {
                left: puckPoint.left - 10,
                top: puckPoint.top - 28,
                transform: [{ rotate: `${windToward}deg` }],
              },
            ]}>
            <View style={styles.windArrowStem} />
            <View style={styles.windArrowHead} />
          </View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#1a1c18',
  },
  spin: {
    ...StyleSheet.absoluteFillObject,
  },
  tile: {
    position: 'absolute',
  },
  overlay: {
    opacity: 0.62,
  },
  mark: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E8DFD0',
  },
  puckWrap: {
    position: 'absolute',
    width: 16,
    alignItems: 'center',
  },
  wedge: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#E8DFD0',
    marginBottom: 1,
  },
  wedgeGap: {
    height: 11,
  },
  puck: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F15A24',
    borderWidth: 2,
    borderColor: '#E8DFD0',
  },
  windEdge: {
    position: 'absolute',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(125, 211, 252, 0.55)',
  },
  windArrowWrap: {
    position: 'absolute',
    width: 20,
    height: 36,
    alignItems: 'center',
  },
  windArrowStem: {
    width: 3,
    flex: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.9)',
    borderRadius: 2,
  },
  windArrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(56, 189, 248, 0.95)',
  },
});
