import {
  Caveat_400Regular,
  Caveat_700Bold,
} from '@expo-google-fonts/caveat';
import {
  Merriweather_400Regular,
  Merriweather_700Bold,
  Merriweather_400Regular_Italic,
} from '@expo-google-fonts/merriweather';
import {
  RobotoSlab_400Regular,
  RobotoSlab_700Bold,
} from '@expo-google-fonts/roboto-slab';
import {
  SourceSerif4_400Regular,
  SourceSerif4_700Bold,
} from '@expo-google-fonts/source-serif-4';
import { SpecialElite_400Regular } from '@expo-google-fonts/special-elite';

import { Fonts } from '@/constants/theme';
import type { InkColor, NoteScale, PageFont } from '@/src/store';

export const MEMOIR_FONT_MAP = {
  Merriweather_400Regular,
  Merriweather_700Bold,
  Merriweather_400Regular_Italic,
  SourceSerif4_400Regular,
  SourceSerif4_700Bold,
  RobotoSlab_400Regular,
  RobotoSlab_700Bold,
  Caveat_400Regular,
  Caveat_700Bold,
  SpecialElite_400Regular,
};

export const INK_COLORS: Record<InkColor, string> = {
  walnut: '#3b2414',
  black: '#16120e',
  rust: '#9a3412',
  blue: '#3d5a80',
  green: '#3f5d3a',
  sepia: '#6b4a2a',
  pencil: '#5c574e',
};

/** Native / in-app font family names (loaded via expo-font). */
export const PAGE_FONTS: Record<PageFont, string> = {
  serif: 'Merriweather_400Regular',
  serifAlt: 'SourceSerif4_400Regular',
  sans: Fonts.sans,
  mono: 'SpecialElite_400Regular',
  script: 'Caveat_400Regular',
  slab: 'RobotoSlab_400Regular',
};

/** CSS stacks for print / HTML export when Google faces are not embedded. */
export const PRINT_PAGE_FONTS: Record<PageFont, string> = {
  serif: "Merriweather, Georgia, 'Times New Roman', serif",
  serifAlt: "'Source Serif 4', Palatino, Georgia, serif",
  sans: Fonts.sans,
  mono: "'Special Elite', 'Courier New', Courier, monospace",
  script: "Caveat, 'Segoe Print', 'Comic Sans MS', cursive",
  slab: "'Roboto Slab', Rockwell, Georgia, serif",
};

export const INK_SWATCHES: InkColor[] = ['walnut', 'black', 'rust', 'sepia', 'pencil', 'blue', 'green'];
export const FONT_CHOICES: Array<{ id: PageFont; label: string }> = [
  { id: 'serif', label: 'Merriweather' },
  { id: 'serifAlt', label: 'Source Serif' },
  { id: 'slab', label: 'Slab' },
  { id: 'sans', label: 'Sans' },
  { id: 'script', label: 'Hand' },
  { id: 'mono', label: 'Type' },
];

export const SCALE_CHOICES: Array<{ id: NoteScale; label: string }> = [
  { id: 'small', label: 'S' },
  { id: 'body', label: 'M' },
  { id: 'large', label: 'L' },
];

export function noteFontSize(scale: NoteScale | undefined, memoir: boolean): number {
  switch (scale) {
    case 'small':
      return memoir ? 14 : 14;
    case 'large':
      return memoir ? 20 : 18;
    case 'body':
    case undefined:
      return memoir ? 16 : 16;
    default: {
      const _exhaustive: never = scale;
      return _exhaustive;
    }
  }
}
