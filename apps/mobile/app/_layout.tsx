import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

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

export default function RootLayout() {
  return (
    <ThemeProvider value={nomadTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
