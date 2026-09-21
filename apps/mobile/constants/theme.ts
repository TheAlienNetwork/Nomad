import { Platform } from 'react-native';

const orange = '#F15A24';

export const Nomad = {
  rust: orange,
  rustDeep: '#C2410C',
  ink: '#02080c',
  steel: '#081018',
  slate: '#0c1820',
  bone: '#E8DFD0',
  mist: '#A39A8C',
  line: 'rgba(103,232,249,0.22)',
  glass: 'rgba(2,8,12,0.72)',
};

export const Colors = {
  light: {
    text: '#F5F5F5',
    background: '#050505',
    tint: orange,
    icon: '#B5B5B5',
    tabIconDefault: '#7A7A7A',
    tabIconSelected: orange,
    card: '#121212',
    muted: '#8A8A8A',
    border: '#2A2A2A',
  },
  dark: {
    text: '#F5F5F5',
    background: '#050505',
    tint: orange,
    icon: '#B5B5B5',
    tabIconDefault: '#7A7A7A',
    tabIconSelected: orange,
    card: '#121212',
    muted: '#8A8A8A',
    border: '#2A2A2A',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  android: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
}) ?? {
  sans: 'normal',
  serif: 'serif',
  rounded: 'normal',
  mono: 'monospace',
};
