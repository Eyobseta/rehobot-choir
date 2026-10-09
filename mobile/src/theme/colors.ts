// Locked palette from SRS Section 20.3
// These brand colors do NOT change between light and dark mode.
export const brand = {
  primaryGreen: '#C1E899',
  brown: '#9A6735',
  lightGreen: '#E6F0DC',
  darkGreen: '#55883B',
} as const;

// Semantic colors — these differ between light and dark.
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
  background: '#F7FAF3',
  surface: '#FFFFFF',
  surfaceAlt: '#E6F0DC',
  border: '#D9E5CD',

  text: '#1A1A1A',
  textSecondary: '#4A4A4A',
  textInverse: '#FFFFFF',

  primary: brand.darkGreen,
  primaryText: '#FFFFFF',

  accent: brand.brown,

  success: brand.darkGreen,
  warning: '#B7791F',
  error: '#C53030',

  disabled: '#B8C4AE',
  overlay: 'rgba(0, 0, 0, 0.35)',
};

export const darkColors: ThemeColors = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceAlt: '#2A2A2A',
  border: '#333333',

  text: '#F1F5EC',
  textSecondary: '#B8C4AE',
  textInverse: '#121212',

  primary: brand.primaryGreen,
  primaryText: '#121212',

  accent: brand.brown,

  success: brand.primaryGreen,
  warning: '#E0A44A',
  error: '#F26B6B',

  disabled: '#4A4A4A',
  overlay: 'rgba(0, 0, 0, 0.6)',
};