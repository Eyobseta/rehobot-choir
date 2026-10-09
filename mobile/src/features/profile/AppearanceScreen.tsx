import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';

export default function AppearanceScreen() {
  const { t } = useTranslation();
  const { theme, mode, setTheme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const Option = ({ label, value }: { label: string; value: 'light' | 'dark' }) => {
    const active = mode === value;
    return (
      <Pressable
        onPress={() => setTheme(value)}
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
        {t('settings.appearanceTitle')}
      </Text>

      <View style={{ marginTop: spacing.lg }}>
        <Option label={t('settings.lightMode')} value="light" />
        <Option label={t('settings.darkMode')} value="dark" />
      </View>
    </ScrollView>
  );
}