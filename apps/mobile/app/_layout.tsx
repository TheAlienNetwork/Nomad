import { useFonts } from 'expo-font';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AuthGate } from '@/components/auth-gate';
import { FieldErrorBoundary } from '@/components/field-error-boundary';
import { useCloudSession, useCloudSync } from '@/src/cloud-sync';
import { MEMOIR_FONT_MAP } from '@/src/journal';
import { useFieldStore } from '@/src/store';

void SplashScreen.preventAutoHideAsync();

const nomadTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#F15A24',
    background: '#050505',
    card: '#050505',
    text: '#F5F5F5',
    border: '#2A2A2A',
    notification: '#F15A24',
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

function hideSplash(): void {
  if (typeof SplashScreen.hideAsync === 'function') {
    void SplashScreen.hideAsync();
  }
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(MEMOIR_FONT_MAP);

  useEffect(() => {
    if (fontsLoaded) hideSplash();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={hideSplash}>
      <ThemeProvider value={nomadTheme}>
        <FieldErrorBoundary>
          <RootLayoutBody />
        </FieldErrorBoundary>
        <StatusBar style="light" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutBody() {
  const session = useCloudSession();
  useCloudSync();
  useEffect(() => {
    const persistApi = useFieldStore.persist;
    if (typeof persistApi?.hasHydrated === 'function' && persistApi.hasHydrated()) return;
    if (typeof persistApi?.rehydrate === 'function') {
      void persistApi.rehydrate();
    }
  }, []);
  useEffect(() => {
    hideSplash();
  }, []);

  return (
    <AuthGate>
      <Stack initialRouteName={session.email ? '(tabs)' : 'sign-in'}>
        <Stack.Protected guard={Boolean(session.email)}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!session.email}>
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Screen name="privacy" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
    </AuthGate>
  );
}
