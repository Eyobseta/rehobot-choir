import React from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { darkColors, lightColors } from '../../theme/colors';
import { ScreenHero, SelectionCard, fadeUp, useMotion } from './SettingsKit';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Pastel tile fills, same as PALETTES in Songs_Kit.
const dots = ['#D3C3F8', '#BDEBCB', '#DDF59B'];

/** Mini app preview drawn from the real light/dark palettes, so it can never drift. */
function ThemePreview({ dark }: { dark: boolean }) {
  const p = dark ? darkColors : lightColors;
  return (
    <View style={[styles.preview, { backgroundColor: p.background, borderColor: p.border }]}>
      <View style={styles.previewTop}>
        <View style={[styles.previewLogo, { backgroundColor: p.primary }]}>
          <Ionicons name={dark ? 'moon' : 'sunny'} size={20} color={p.primaryText} />
        </View>
        <View style={styles.previewLines}>
          <View style={[styles.line, { backgroundColor: p.text, width: '66%' }]} />
          <View style={[styles.line, { backgroundColor: p.border, width: '43%', marginTop: 8 }]} />
        </View>
        <Ionicons name="musical-notes" size={19} color={p.accent} />
      </View>

      <View style={[styles.previewPanel, { backgroundColor: p.surface }]}>
        {dots.map((color, index) => (
          <View key={color} style={styles.previewRow}>
            <View style={[styles.previewDot, { backgroundColor: color }]} />
            <View style={[styles.line, { backgroundColor: p.border, width: index === 1 ? '62%' : '46%' }]} />
          </View>
        ))}
      </View>

      <View style={[styles.previewButton, { backgroundColor: p.primary }]} />

      <View style={styles.previewNavigation}>
        {(['home-outline', 'musical-notes-outline', 'person-circle'] as IconName[]).map((name, index) => (
          <Ionicons key={name} name={name} size={20} color={index === 2 ? p.primary : p.textSecondary} />
        ))}
      </View>
    </View>
  );
}

export default function AppearanceScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme, mode, setTheme } = useTheme();
  const { colors, spacing } = theme;
  const { reduceMotion, enter } = useMotion();

  const options = [
    { value: 'light' as const, label: t('settings.lightMode'), hint: t('settings.lightHint', { defaultValue: 'Bright and clean' }) },
    { value: 'dark'  as const, label: t('settings.darkMode'),  hint: t('settings.darkHint',  { defaultValue: 'Easy on the eyes' }) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHero
        icon="color-palette"
        overline={t('tabs.profile', { defaultValue: 'Profile' })}
        title={t('settings.appearanceTitle')}
        subtitle={t('settings.appearanceSubtitle', { defaultValue: 'Choose how Rehobot Choir looks on your phone.' })}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View accessibilityRole="radiogroup">
          {options.map((option, i) => (
            <Animated.View key={option.value} style={fadeUp(enter, i)}>
              <SelectionCard
                active={mode === option.value}
                label={option.label}
                hint={option.hint}
                reduceMotion={reduceMotion}
                onPress={() => setTheme(option.value)}
              >
                <ThemePreview dark={option.value === 'dark'} />
              </SelectionCard>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { padding: 16, borderWidth: 1, borderRadius: 16 },
  previewTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewLogo: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  previewLines: { flex: 1 },
  line: { height: 6, borderRadius: 3 },
  previewPanel: { padding: 12, gap: 12, borderRadius: 12, marginTop: 16 },
  previewRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  previewDot: { width: 16, height: 16, borderRadius: 5 },
  previewButton: { height: 28, borderRadius: 10, marginTop: 14 },
  previewNavigation: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
});