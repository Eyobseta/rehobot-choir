// Modern "wine & sunset" palette (replaces the old SRS 20.3 green/brown palette).
// These brand colors do NOT change between light and dark mode.
export const brand = {
  rose: '#FF4D6D',
  amber: '#FFB84D',
  orchid: '#C77DFF',
  wine: '#2A0F1E',
  cream: '#FFF1E6',

  // Legacy aliases so existing imports like `brand.primaryGreen` keep compiling.
  // They now point at the new palette. Migrate usages, then delete these.
  primaryGreen: '#FF4D6D',
  brown: '#FFB84D',
  lightGreen: '#FFE9DE',
  darkGreen: '#D6264A',
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
  background: '#FFF8F3',
  surface: '#FFFFFF',
  surfaceAlt: '#FFE9DE',
  border: '#F2D5C8',

  text: '#2A0F1E',
  textSecondary: '#6B4A5A',
  textInverse: '#FFFFFF',

  primary: '#D6264A',
  primaryText: '#FFFFFF',

  accent: '#B26A00',

  success: '#1F9D6B',
  warning: '#B7791F',
  error: '#C53030',

  disabled: '#D9C3BA',
  overlay: 'rgba(42, 15, 30, 0.4)',
};

export const darkColors: ThemeColors = {
  background: '#16080F',
  surface: '#22101A',
  surfaceAlt: '#2E1824',
  border: '#3D2431',

  text: '#FFF1E6',
  textSecondary: '#C9AFA6',
  textInverse: '#16080F',

  primary: brand.rose,
  primaryText: '#16080F',

  accent: brand.amber,

  success: '#5BD6A0',
  warning: '#FFB84D',
  error: '#FF5A4F',

  disabled: '#5A4651',
  overlay: 'rgba(0, 0, 0, 0.65)',
};