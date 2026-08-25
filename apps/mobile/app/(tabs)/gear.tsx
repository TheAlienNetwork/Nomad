import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/brand-logo';
import { Colors } from '@/constants/theme';
import { packList } from '@/constants/sample-data';

export default function GearScreen() {
  const packed = packList.filter((item) => item.packed).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <BrandLogo size={56} />
          <View>
            <Text style={styles.title}>Nomad</Text>
            <Text style={styles.subtitle}>
              Pack list · {packed}/{packList.length} ready
            </Text>
          </View>
        </View>

        {packList.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={[styles.box, item.packed && styles.boxPacked]} />
            <Text style={[styles.name, item.packed && styles.namePacked]}>{item.name}</Text>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  box: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.dark.muted,
  },
  boxPacked: {
    backgroundColor: Colors.dark.tint,
    borderColor: Colors.dark.tint,
  },
  name: {
    color: Colors.dark.text,
    fontSize: 16,
  },
  namePacked: {
    color: Colors.dark.muted,
  },
});
