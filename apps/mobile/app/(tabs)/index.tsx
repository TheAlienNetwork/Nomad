import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import { Colors } from '@/constants/theme';
import { recentHunts } from '@/constants/sample-data';

export default function HuntScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <BrandLogo size={240} />
        </View>

        <Pressable style={styles.startHunt} accessibilityRole="button">
          <Text style={styles.startHuntLabel}>Start hunt</Text>
        </Pressable>

        <Text style={styles.section}>Today</Text>
        <View style={styles.row}>
          <View style={styles.card}>
            <Text style={styles.cardKicker}>Wind</Text>
            <Text style={styles.cardValue}>W 6 mph</Text>
            <Text style={styles.cardMeta}>Shift expected after 10</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardKicker}>Legal light</Text>
            <Text style={styles.cardValue}>6:12 – 8:04</Text>
            <Text style={styles.cardMeta}>Check local regs</Text>
          </View>
        </View>

        <Text style={styles.section}>Recent hunts</Text>
        {recentHunts.map((hunt) => (
          <View key={hunt.id} style={styles.log}>
            <View style={styles.logHeader}>
              <Text style={styles.logTitle}>{hunt.title}</Text>
              <Text style={styles.logDate}>{hunt.date}</Text>
            </View>
            <Text style={styles.logArea}>{hunt.area}</Text>
            <Text style={styles.logNotes}>{hunt.notes}</Text>
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 8,
  },
  startHunt: {
    backgroundColor: Colors.dark.tint,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 28,
  },
  startHuntLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  section: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  cardKicker: {
    color: Colors.dark.tint,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardValue: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700',
  },
  cardMeta: {
    color: Colors.dark.muted,
    fontSize: 13,
  },
  log: {
    backgroundColor: Colors.dark.card,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 4,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  logTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '700',
  },
  logDate: {
    color: Colors.dark.muted,
    fontSize: 13,
  },
  logArea: {
    color: Colors.dark.tint,
    fontSize: 14,
    fontWeight: '600',
  },
  logNotes: {
    color: Colors.dark.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
