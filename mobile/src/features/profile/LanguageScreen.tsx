import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { changeLanguage, getCurrentLanguage, SupportedLanguage } from '../../i18n';

export default function LanguageScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [current, setCurrent] = useState<SupportedLanguage>('en');

  useEffect(() => {
    getCurrentLanguage().then(setCurrent);
  }, []);

  const onSelect = async (lang: SupportedLanguage) => {
    await changeLanguage(lang);
    setCurrent(lang);
  };

  const Option = ({ label, value }: { label: string; value: SupportedLanguage }) => {
    const active = current === value;
    return (
      <Pressable
        onPress={() => onSelect(value)}
        style={{
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          borderWidth: 2,
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primary : colors.surface,
          marginBottom: spacing.md,
        }}
      >
        <Text
          style={[
            typography.body,
            { color: active ? colors.primaryText : colors.text, fontWeight: '600' },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.xl, backgroundColor: colors.background, flexGrow: 1 }}
    >
      <Text style={[typography.h2, { color: colors.primary }]}>
        {t('settings.languageTitle')}
      </Text>

      <View style={{ marginTop: spacing.lg }}>
        <Option label={t('settings.english')} value="en" />
        <Option label={t('settings.amharic')} value="am" />
      </View>
    </ScrollView>
  );
}