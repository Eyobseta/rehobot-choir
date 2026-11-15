// "Emerald & gold" palette: deep emerald ink, vivid emerald, warm gold, cyan, coral.
// A modern take on a classic green / gold / red heritage palette.
// These brand colors do NOT change between light and dark mode.
export const brand = {
  emerald: '#0F9D6E',
  gold: '#F5B83D',
  coral: '#FF6B57',
  cyan: '#0E8FA3',
  ink: '#06100C',

  // Legacy aliases so existing imports like `brand.primaryGreen` keep compiling.
  // They now point at the new palette. Migrate usages, then delete these.
  primaryGreen: '#2BD99F',
  brown: '#F5B83D',
  lightGreen: '#E3F0E8',
  darkGreen: '#0B8A60',
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
  background: '#F3F8F5',
  surface: '#FFFFFF',
  surfaceAlt: '#E3F0E8',
  border: '#CFE2D7',

  text: '#0A1F17',
  textSecondary: '#4B665A',
  textInverse: '#FFFFFF',

  primary: '#0B8A60',
  primaryText: '#FFFFFF',

  accent: '#B7791F',

  success: '#0B8A60',
  warning: '#B7791F',
  error: '#D43F2C',

  disabled: '#BCCFC5',
  overlay: 'rgba(10, 31, 23, 0.4)',
};

export const darkColors: ThemeColors = {
  background: '#06100C',
  surface: '#0D1C16',
  surfaceAlt: '#13281F',
  border: '#1E3A2D',

  text: '#ECF6F0',
  textSecondary: '#93AFA2',
  textInverse: '#06100C',

  primary: '#2BD99F',
  primaryText: '#06100C',

  accent: brand.gold,

  success: '#2BD99F',
  warning: '#F5B83D',
  error: '#FF6B57',

  disabled: '#34483E',
  overlay: 'rgba(2, 8, 5, 0.7)',
};