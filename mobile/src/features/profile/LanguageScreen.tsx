import React, { useEffect, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { changeLanguage, getCurrentLanguage, type SupportedLanguage } from '../../i18n';
import { WaterDrops, BRAND, withAlpha } from '../auth/Auth_UI';
import { ScreenHero, SelectionCard, fadeUp, useMotion } from './SettingsKit';

export default function LanguageScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const [current, setCurrent] = useState<SupportedLanguage>('en');

  useEffect(() => {
    getCurrentLanguage().then(setCurrent);
  }, []);

  const onSelect = async (lang: SupportedLanguage) => {
    await changeLanguage(lang);
    setCurrent(lang);
  };

  const { reduceMotion, enter } = useMotion();

  const options: {
    value: SupportedLanguage;
    label: string;
    glyph: string;
    sample: string;
    accent: string;
    gradient: readonly [string, string];
  }[] = [
    { value: 'en', label: t('settings.english'), glyph: 'Aa', sample: 'Welcome to the choir family', accent: '#6EDBD5', gradient: [BRAND.water, BRAND.violet] },
    { value: 'am', label: t('settings.amharic'), glyph: 'አ', sample: 'እንኳን ወደ መዘምራኑ ቤተሰብ በደህና መጡ', accent: '#B6A0FF', gradient: [BRAND.magenta, BRAND.gold] },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHero
        icon="language"
        title={t('settings.languageTitle')}
        subtitle={t('settings.languageSubtitle', { defaultValue: 'Choose the language of the app.' })}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View accessibilityRole="radiogroup">
          {options.map((option, i) => (
            <Animated.View key={option.value} style={fadeUp(enter, i)}>
              <SelectionCard
                active={current === option.value}
                label={option.label}
                reduceMotion={reduceMotion}
                onPress={() => onSelect(option.value)}
              >
                <View style={styles.specimen}>
                  <LinearGradient
                    colors={option.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.glyphTile}
                  >
                    <Text style={styles.glyph}>{option.glyph}</Text>
                  </LinearGradient>

                  <View style={[styles.bubble, { backgroundColor: withAlpha(option.accent, 0.14), borderColor: withAlpha(option.accent, 0.35) }]}>
                    <Ionicons name="chatbubble-ellipses" size={16} color={option.accent} />
                    <Text style={[styles.sample, { color: colors.text }]} numberOfLines={3}>
                      {option.sample}
                    </Text>
                  </View>
                </View>
              </SelectionCard>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
      <WaterDrops />
    </View>
  );
}

const styles = StyleSheet.create({
  specimen: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 84 },
  glyphTile: { width: 84, height: 84, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 38, lineHeight: 56, fontWeight: '800', color: '#FFFFFF' },
  bubble: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  sample: { flex: 1, fontSize: 14, lineHeight: 21, fontWeight: '600' },
});