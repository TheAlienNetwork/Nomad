import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import { Colors } from '@/constants/theme';
import { recentHunts } from '@/constants/sample-data';

export default function JournalScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <BrandLogo size={56} />
          <View>
            <Text style={styles.title}>Nomad</Text>
            <Text style={styles.subtitle}>Hunt journal</Text>
          </View>
        </View>

        {recentHunts.map((hunt) => (
          <View key={hunt.id} style={styles.entry}>
            <Text style={styles.date}>{hunt.date}</Text>
            <Text style={styles.entryTitle}>{hunt.title}</Text>
            <Text style={styles.area}>{hunt.area}</Text>
            <Text style={styles.notes}>{hunt.notes}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  subtitle: {
    color: Colors.dark.muted,
    fontSize: 14,
  },
  entry: {
    backgroundColor: Colors.dark.card,
    borderColor: Colors.dark.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  date: {
    color: Colors.dark.muted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  entryTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700',
  },
  area: {
    color: Colors.dark.tint,
    fontSize: 14,
    fontWeight: '600',
  },
  notes: {
    color: Colors.dark.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
