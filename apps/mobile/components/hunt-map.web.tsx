import { OVERLAY_CATALOG } from '@huntos/core';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { buildHuntMapHtml } from '@/lib/hunt-map-html';
import { dispatchMapEvent, parseMapEvent, useMapBridgePayload } from '@/lib/map-bridge';
import { hydrateOverlayCache, readCachedTileBase64 } from '@/src/overlay-pack';
import { useFieldStore } from '@/src/store';

function huntMapBootHtml(): string {
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

export function HuntMap() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const lastSentRef = useRef('');
  const html = useRef(huntMapBootHtml()).current;
  const payload = useMapBridgePayload();
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const pushVectorsRef = useRef<() => void>(() => undefined);
  const radarOn = useFieldStore((state) => state.layers.radar);
  const hasRadar = Boolean(useFieldStore((state) => state.radar));
  const cachedVectors = useFieldStore((state) => state.cachedOverlayGeoJson);
  const overlayFlags = useFieldStore((state) => state.layers);

  useEffect(() => {
    void hydrateOverlayCache();
  }, []);

  useEffect(() => {
    if (radarOn && !hasRadar) {
      void useFieldStore.getState().loadRadar();
    }
  }, [radarOn, hasRadar]);

  const push = (next: string) => {
    if (!next || next === lastSentRef.current) return;
    lastSentRef.current = next;
    frameRef.current?.contentWindow?.postMessage(next, '*');
  };

  const pushVectors = () => {
    const vectors = Object.fromEntries(
      OVERLAY_CATALOG.filter(
        (item) => item.cacheMode === 'vector' && overlayFlags[item.id] && cachedVectors[item.id],
      ).map((item) => [item.id, cachedVectors[item.id]]),
    );
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({ type: 'vectors', vectors }), '*');
  };
  pushVectorsRef.current = pushVectors;

  useEffect(() => {
    if (!readyRef.current) return;
    push(payload);
  }, [payload]);

  useEffect(() => {
    if (!readyRef.current) return;
    pushVectors();
  }, [cachedVectors, overlayFlags]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if (typeof event.data !== 'string') return;
      try {
        const data = JSON.parse(event.data) as {
          type?: string;
          id?: string;
          slug?: string;
          z?: number;
          x?: number;
          y?: number;
        };
        if (
          data.type === 'tile' &&
          typeof data.id === 'string' &&
          typeof data.slug === 'string' &&
          Number.isFinite(data.z) &&
          Number.isFinite(data.x) &&
          Number.isFinite(data.y)
        ) {
          const slug = data.slug;
          const z = data.z;
          const x = data.x;
          const y = data.y;
          if (!slug || z == null || x == null || y == null) return;
          void readCachedTileBase64(slug, z, x, y).then((b64) => {
            frameRef.current?.contentWindow?.postMessage(
              JSON.stringify({
                type: 'tile-result',
                id: data.id,
                dataUrl: b64 ? `data:image/png;base64,${b64}` : null,
              }),
              '*',
            );
          });
          return;
        }
      } catch {
        // Fall through to map events.
      }
      const message = parseMapEvent(event.data);
      if (message?.type === 'ready') {
        readyRef.current = true;
        lastSentRef.current = '';
        push(payloadRef.current);
        pushVectorsRef.current();
        return;
      }
      dispatchMapEvent(event.data);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <View style={styles.wrap}>
      <iframe
        ref={frameRef}
        title="Nomad hunt map"
        srcDoc={html}
        style={styles.frame}
        onLoad={() => {
          readyRef.current = true;
          lastSentRef.current = '';
          push(payloadRef.current);
          pushVectorsRef.current();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    zIndex: 0,
    backgroundColor: '#050505',
  },
  frame: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
    backgroundColor: '#050505',
    zIndex: 0,
  },
});
