import { OVERLAY_CATALOG } from '@huntos/core';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { buildHuntMapHtml } from '@/lib/hunt-map-html';
import { dispatchMapEvent, parseMapEvent, useMapBridgeInjection } from '@/lib/map-bridge';
import { fetchRasterTileDataUrl } from '@/src/map-tiles';
import { readCachedTileBase64 } from '@/src/overlay-pack';
import { useFieldStore } from '@/src/store';

const TILE_CONCURRENCY = 6;

function sizeScript(width: number, height: number): string {
  return `window.__nomadSize && window.__nomadSize(${Math.round(width)},${Math.round(height)}); true;`;
}

function bootHtml(): string {
  const gps = useFieldStore.getState().gps;
  const api = process.env.EXPO_PUBLIC_HUNTOS_API_URL?.replace(/\/$/, '');
  return buildHuntMapHtml({
    center:
      gps.latitude != null && gps.longitude != null
        ? { latitude: gps.latitude, longitude: gps.longitude }
        : undefined,
    zoom: gps.latitude != null ? 14 : 11,
    demTiles: api ? `${api}/api/tiles/terrarium/{z}/{x}/{y}` : undefined,
  });
}

export function GlMapOverlay() {
  const webViewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const lastFullRef = useRef('');
  const lastLayersRef = useRef('');
  const lastHeavyKeyRef = useRef('');
  const sizeRef = useRef({ width: 0, height: 0 });
  const html = useRef(bootHtml()).current;
  const injection = useMapBridgeInjection();
  const cachedVectors = useFieldStore((state) => state.cachedOverlayGeoJson);
  const overlayFlags = useFieldStore((state) => state.layers);
  const [painted, setPainted] = useState(false);
  const tileActive = useRef(0);
  const tileQueue = useRef<Array<() => Promise<void>>>([]);

  const pumpTiles = () => {
    while (tileActive.current < TILE_CONCURRENCY && tileQueue.current.length) {
      const job = tileQueue.current.shift();
      if (!job) return;
      tileActive.current += 1;
      void job().finally(() => {
        tileActive.current -= 1;
        pumpTiles();
      });
    }
  };

  const injectSize = () => {
    const { width, height } = sizeRef.current;
    if (width < 2 || height < 2) return;
    webViewRef.current?.injectJavaScript(sizeScript(width, height));
  };

  const injectFull = (next: string) => {
    if (!next || next === lastFullRef.current) return;
    lastFullRef.current = next;
    lastLayersRef.current = '';
    webViewRef.current?.injectJavaScript(`window.__huntosApply(${next}); true;`);
  };

  const injectLayers = (next: string) => {
    if (!next || next === lastLayersRef.current) return;
    lastLayersRef.current = next;
    webViewRef.current?.injectJavaScript(`window.__huntosLayers(${next}); true;`);
  };

  const injectVectors = () => {
    const vectors = Object.fromEntries(
      OVERLAY_CATALOG.filter(
        (item) => item.cacheMode === 'vector' && overlayFlags[item.id] && cachedVectors[item.id],
      ).map((item) => [item.id, cachedVectors[item.id]]),
    );
    webViewRef.current?.injectJavaScript(`window.__huntosVectors(${JSON.stringify(vectors)}); true;`);
  };

  useEffect(() => {
    if (!readyRef.current) return;
    if (injection.heavyKey !== lastHeavyKeyRef.current) {
      lastHeavyKeyRef.current = injection.heavyKey;
      injectFull(injection.body);
      return;
    }
    injectLayers(injection.layersBody);
  }, [injection]);

  useEffect(() => {
    if (!readyRef.current) return;
    injectVectors();
  }, [cachedVectors, overlayFlags]);

  const onMessage = (event: WebViewMessageEvent) => {
    const raw = event.nativeEvent.data;
    try {
      const data = JSON.parse(raw) as {
        type?: string;
        id?: string;
        slug?: string;
        z?: number;
        x?: number;
        y?: number;
      };
      if (data.type === 'painted') {
        setPainted(true);
        return;
      }
      if (
        (data.type === 'raster' || data.type === 'tile') &&
        typeof data.id === 'string' &&
        typeof data.slug === 'string' &&
        Number.isFinite(data.z) &&
        Number.isFinite(data.x) &&
        Number.isFinite(data.y)
      ) {
        const waitId = data.id;
        const slug = data.slug;
        const z = data.z;
        const x = data.x;
        const y = data.y;
        if (!slug || z == null || x == null || y == null) return;
        tileQueue.current.push(async () => {
          const payload =
            data.type === 'raster'
              ? await fetchRasterTileDataUrl(slug, z, x, y)
              : await readCachedTileBase64(slug, z, x, y).then((b64) =>
                  b64 ? `data:image/png;base64,${b64}` : null,
                );
          webViewRef.current?.injectJavaScript(
            `window.__nomadTile(${JSON.stringify(waitId)}, ${JSON.stringify(payload)}); true;`,
          );
        });
        pumpTiles();
        return;
      }
    } catch {
      // Fall through to map events.
    }
    const message = parseMapEvent(raw);
    if (message?.type === 'ready') {
      readyRef.current = true;
      lastFullRef.current = '';
      lastLayersRef.current = '';
      lastHeavyKeyRef.current = injection.heavyKey;
      injectFull(injection.body);
      injectVectors();
      injectSize();
      return;
    }
    dispatchMapEvent(raw);
  };

  return (
    <View
      pointerEvents={painted ? 'auto' : 'none'}
      onLayout={(event) => {
        sizeRef.current = event.nativeEvent.layout;
        injectSize();
      }}
      style={styles.host}>
      <WebView
        ref={webViewRef}
        source={{ html, baseUrl: 'https://server.arcgisonline.com/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        androidLayerType="hardware"
        mixedContentMode="always"
        nestedScrollEnabled
        overScrollMode="never"
        setSupportMultipleWindows={false}
        onLoadEnd={injectSize}
        onMessage={onMessage}
        style={[styles.map, painted ? styles.live : styles.hidden]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
  },
  map: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  hidden: {
    opacity: 0,
  },
  live: {
    opacity: 1,
  },
});
