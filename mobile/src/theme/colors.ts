// "Cobalt & saffron" palette: deep navy ink, electric cobalt, warm saffron, teal.
// These brand colors do NOT change between light and dark mode.
export const brand = {
  cobalt: '#3D5AFE',
  saffron: '#FFB400',
  teal: '#0E9F95',
  navy: '#0B1236',
  mist: '#EEF1FF',

  // Legacy aliases so existing imports like `brand.primaryGreen` keep compiling.
  // They now point at the new palette. Migrate usages, then delete these.
  primaryGreen: '#7B93FF',
  brown: '#FFB400',
  lightGreen: '#E8ECFF',
  darkGreen: '#3D5AFE',
} as const;

// Semantic colors: these differ between light and dark.
export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;

  text: string;
  textSecondary: string;
  textInverse: string;

  primary: string;
  primaryText: string;

  accent: string;

  success: string;
  warning: string;
  error: string;

  disabled: string;
  overlay: string;
};

export const lightColors: ThemeColors = {
  background: '#F5F7FF',
  surface: '#FFFFFF',
  surfaceAlt: '#E8ECFF',
  border: '#D5DCF5',

  text: '#0B1236',
  textSecondary: '#515C85',
  textInverse: '#FFFFFF',

  primary: brand.cobalt,
  primaryText: '#FFFFFF',

  accent: '#B87F00',

  success: '#0E9F6E',
  warning: '#B87F00',
  error: '#D92D4A',

  disabled: '#C3CBE6',
  overlay: 'rgba(11, 18, 54, 0.4)',
};

export const darkColors: ThemeColors = {
  background: '#070B1F',
  surface: '#0F1634',
  surfaceAlt: '#18214A',
  border: '#243060',

  text: '#EEF1FF',
  textSecondary: '#A3AED6',
  textInverse: '#070B1F',

  primary: '#7B93FF',
  primaryText: '#070B1F',

  accent: brand.saffron,

  success: '#2EE6A6',
  warning: '#FFB400',
  error: '#FF5C6C',

  disabled: '#3A4570',
  overlay: 'rgba(2, 4, 16, 0.65)',
};