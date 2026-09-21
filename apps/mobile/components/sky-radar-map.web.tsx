import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { buildSkyRadarHtml } from '@/lib/sky-radar-html';

type SkyRadarMapProps = {
  latitude: number;
  longitude: number;
  radarUrl?: string;
  windFrom?: number | null;
};

export function SkyRadarMap({ latitude, longitude, radarUrl, windFrom }: SkyRadarMapProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const lastRef = useRef('');
  const html = useRef(buildSkyRadarHtml({ latitude, longitude })).current;

  const inject = () => {
    const payload = JSON.stringify({
      latitude,
      longitude,
      zoom: 7,
      radarUrl: radarUrl ?? null,
      windFrom: windFrom ?? null,
    });
    if (payload === lastRef.current) return;
    lastRef.current = payload;
    frameRef.current?.contentWindow?.postMessage(payload, '*');
  };

  useEffect(() => {
    if (!readyRef.current) return;
    inject();
  }, [latitude, longitude, radarUrl, windFrom]);

  return (
    <View style={styles.wrap}>
      <iframe
        ref={frameRef}
        title="Nomad sky radar"
        srcDoc={html}
        style={styles.frame}
        onLoad={() => {
          readyRef.current = true;
          lastRef.current = '';
          inject();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#050505',
  },
  frame: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
    backgroundColor: '#050505',
  },
});
