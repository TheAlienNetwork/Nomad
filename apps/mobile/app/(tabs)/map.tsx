import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import { HuntMap } from '@/components/hunt-map';
import { Colors } from '@/constants/theme';
import { huntArea, waypoints } from '@/constants/sample-data';

export default function MapScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <BrandLogo size={48} />
        <View>
          <Text style={styles.title}>Nomad</Text>
          <Text style={styles.subtitle}>
            {huntArea.name} · satellite / topo / public land
          </Text>
        </View>
      </View>

      <HuntMap />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.points}>
        {waypoints.map((point) => (
          <View key={point.id} style={styles.point}>
            <View style={styles.pin} />
            <View>
              <Text style={styles.pointName}>{point.name}</Text>
              <Text style={styles.pointDetail}>{point.detail}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  subtitle: {
    color: Colors.dark.muted,
    fontSize: 13,
  },
  points: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dark.card,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.dark.tint,
  },
  pointName: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  pointDetail: {
    color: Colors.dark.muted,
    fontSize: 12,
  },
});
