import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { FieldButton } from '@/components/field-button';
import { Nomad } from '@/constants/theme';
import { PLAY_APP_NAME, PLAY_DATA_SAFETY, PLAY_PACKAGE } from '@/src/play-identity';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>{PLAY_APP_NAME}</Text>
        <Text style={styles.title}>Privacy</Text>
        <Text style={styles.body}>
          Nomad is an internal field preview. It is not a legal land-access, season, or
          permission tool. Verify posted signs and official sources before you hunt.
        </Text>
        <Text style={styles.body}>Package: {PLAY_PACKAGE}</Text>
        <Text style={styles.group}>Location</Text>
        <Text style={styles.body}>{PLAY_DATA_SAFETY.location}</Text>
        <Text style={styles.group}>Photos</Text>
        <Text style={styles.body}>{PLAY_DATA_SAFETY.photos}</Text>
        <Text style={styles.group}>Microphone</Text>
        <Text style={styles.body}>{PLAY_DATA_SAFETY.microphone}</Text>
        <Text style={styles.group}>Account</Text>
        <Text style={styles.body}>{PLAY_DATA_SAFETY.account}</Text>
        <Text style={styles.group}>What we do not collect</Text>
        <Text style={styles.body}>{PLAY_DATA_SAFETY.notCollected}</Text>
        <Text style={styles.body}>
          Host this page at a public URL and paste that URL into Play Console. Until then,
          testers can read it in the app.
        </Text>
        <FieldButton accessibilityLabel="Back" style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backLabel}>Back</Text>
        </FieldButton>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Nomad.ink,
  },
  content: {
    padding: 22,
    gap: 10,
  },
  kicker: {
    color: Nomad.rust,
    fontWeight: '800',
    letterSpacing: 2,
    fontSize: 12,
  },
  title: {
    color: Nomad.bone,
    fontSize: 26,
    fontWeight: '800',
  },
  group: {
    color: Nomad.rust,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 8,
    fontSize: 12,
  },
  body: {
    color: Nomad.mist,
    fontSize: 14,
    lineHeight: 20,
  },
  back: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Nomad.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLabel: {
    color: Nomad.bone,
    fontWeight: '700',
  },
});
