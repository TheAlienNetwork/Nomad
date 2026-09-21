import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '@/components/brand-logo';
import { Nomad } from '@/constants/theme';
import { useCloudSession } from '@/src/cloud-sync';

function hideSplash(): void {
  if (typeof SplashScreen.hideAsync === 'function') {
    void SplashScreen.hideAsync();
  }
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const session = useCloudSession();

  useEffect(() => {
    if (!session.ready) return;
    hideSplash();
  }, [session.ready]);

  return (
    <View style={styles.shell}>
      {children}
      {!session.ready ? (
        <View style={styles.splash}>
          <BrandLogo size={180} style={styles.logo} />
          <Text style={styles.kicker}>NOMAD</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Nomad.ink,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 30,
  },
  logo: {
    backgroundColor: 'transparent',
  },
  kicker: {
    color: Nomad.rust,
    fontWeight: '800',
    letterSpacing: 4,
  },
});
