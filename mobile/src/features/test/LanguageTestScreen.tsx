import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  changeLanguage,
  getCurrentLanguage,
  SupportedLanguage,
} from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';

export default function LanguageTestScreen() {
  const { t } = useTranslation();
  const { theme, mode, toggleTheme } = useTheme();
  const [current, setCurrent] = useState<SupportedLanguage>('en');

  useEffect(() => {
    getCurrentLanguage().then(setCurrent);
  }, []);

  const onSwitch = async (lang: SupportedLanguage) => {
    await changeLanguage(lang);
    setCurrent(lang);
  };

  const { colors, spacing, radius, typography } = theme;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, padding: spacing.xl },
      ]}
    >
      <Text
        style={[
          typography.h2,
          { color: colors.primary, marginBottom: spacing.md, textAlign: 'center' },
        ]}
      >
        {t('test.greeting')}
      </Text>

      <Text
        style={[
          typography.body,
          { color: colors.text, marginBottom: spacing.xl, textAlign: 'center' },
        ]}
      >
        {t('test.description')}
      </Text>

      <Text
        style={[
          typography.bodySmall,
          { color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' },
        ]}
      >
        {t('test.currentLanguage')}: {current === 'en' ? 'English' : 'አማርኛ'}
      </Text>

      <View style={[styles.row, { gap: spacing.md, marginBottom: spacing.xl }]}>
        <Pressable
          style={[
            styles.button,
            {
              backgroundColor: colors.surface,
              borderColor: current === 'en' ? colors.primary : colors.border,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xl,
            },
          ]}
          onPress={() => onSwitch('en')}
        >
          <Text style={[typography.button, { color: colors.text }]}>
            {t('language.english')}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.button,
            {
              backgroundColor: colors.surface,
              borderColor: current === 'am' ? colors.primary : colors.border,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xl,
            },
          ]}
          onPress={() => onSwitch('am')}
        >
          <Text style={[typography.button, { color: colors.text }]}>
            {t('language.amharic')}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={toggleTheme}
        style={[
          styles.themeButton,
          {
            backgroundColor: colors.primary,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.xl,
          },
        ]}
      >
        <Text style={[typography.button, { color: colors.primaryText }]}>
          {mode === 'dark' ? '☀️  Light Mode' : '🌙  Dark Mode'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  button: {
    borderWidth: 2,
    alignItems: 'center',
  },
  themeButton: {
    alignItems: 'center',
  },
});