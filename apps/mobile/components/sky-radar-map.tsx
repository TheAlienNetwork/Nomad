import { StyleSheet } from 'react-native';

import { NativeTileMap } from '@/components/native-tile-map';

type SkyRadarMapProps = {
  latitude: number;
  longitude: number;
  radarUrl?: string;
  windFrom?: number | null;
};

export function SkyRadarMap({ latitude, longitude, radarUrl }: SkyRadarMapProps) {
  return (
    <NativeTileMap
      slug="esri-imagery"
      latitude={latitude}
      longitude={longitude}
      zoom={7}
      follow
      scrollFriendly
      overlayTemplate={radarUrl}
      style={styles.map}
    />
  );
}

const styles = StyleSheet.create({
  map: {
    height: 220,
    flex: 0,
    borderRadius: 14,
  },
});
