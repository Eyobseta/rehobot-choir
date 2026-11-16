// "Teal, lime & lavender" palette, sampled from the design reference.
// These brand colors do NOT change between light and dark mode.
export const brand = {
  teal: '#1D4550',
  tealDark: '#163740',
  lime: '#C4F44F',
  lavender: '#D3C3F8',
  mint: '#63D485',
  cream: '#FAF3EB',

  // Legacy aliases so existing imports like `brand.primaryGreen` keep compiling.
  // Migrate usages, then delete these.
  primaryGreen: '#C4F44F',
  brown: '#D3C3F8',
  lightGreen: '#E5DEF6',
  darkGreen: '#1D4550',
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
  background: '#F5F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#E5DEF6',
  border: '#DCE3E6',

  text: '#14323B',
  textSecondary: '#5C7480',
  textInverse: '#FFFFFF',

  primary: brand.teal,
  primaryText: '#FFFFFF',

  accent: '#7B5FC7',

  success: '#2E9E5B',
  warning: '#B7791F',
  error: '#D64545',

  disabled: '#BCC9CE',
  overlay: 'rgba(20, 50, 59, 0.4)',
};

export const darkColors: ThemeColors = {
  background: '#0E262C',
  surface: '#163740',
  surfaceAlt: '#1D4550',
  border: '#2A5662',

  text: '#F2F7F5',
  textSecondary: '#9DB6BC',
  textInverse: '#0E262C',

  primary: brand.lime,
  primaryText: brand.teal,

  accent: brand.lavender,

  success: brand.mint,
  warning: '#F2C94C',
  error: '#FF7A7A',

  disabled: '#3A5963',
  overlay: 'rgba(5, 16, 19, 0.65)',
};