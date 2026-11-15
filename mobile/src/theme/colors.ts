// "Sage & rose" palette: soft, warm and low-contrast.
// Muted sage, dusty rose, honey and cream. These brand colors do NOT change between light and dark mode.
export const brand = {
  sage: '#6E9A80',
  rose: '#C9828A',
  honey: '#E3B778',
  forest: '#3E5A4B',
  cream: '#FAF6EF',

  // Legacy aliases so existing imports like `brand.primaryGreen` keep compiling.
  // They now point at the new palette. Migrate usages, then delete these.
  primaryGreen: '#9CC4A8',
  brown: '#E3B778',
  lightGreen: '#EFE8DA',
  darkGreen: '#5E8A70',
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
  background: '#FAF6EF',
  surface: '#FFFDF9',
  surfaceAlt: '#EFE8DA',
  border: '#E3D9C6',

  text: '#2B332D',
  textSecondary: '#6A6F63',
  textInverse: '#FFFFFF',

  primary: '#5E8A70',
  primaryText: '#FFFFFF',

  accent: '#B8707C',

  success: '#4F8A63',
  warning: '#B7791F',
  error: '#BF4A4A',

  disabled: '#CFC8B8',
  overlay: 'rgba(43, 51, 45, 0.35)',
};

export const darkColors: ThemeColors = {
  background: '#1A1F1B',
  surface: '#232A25',
  surfaceAlt: '#2D362F',
  border: '#3A453D',

  text: '#F3EDE3',
  textSecondary: '#B7B3A6',
  textInverse: '#1A1F1B',

  primary: '#9CC4A8',
  primaryText: '#1A1F1B',

  accent: brand.honey,

  success: '#8FCB9B',
  warning: '#E3B778',
  error: '#E58A8A',

  disabled: '#4A5249',
  overlay: 'rgba(10, 14, 11, 0.6)',
};