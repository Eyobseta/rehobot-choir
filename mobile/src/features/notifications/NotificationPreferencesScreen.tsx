import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Switch,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import {
  getPreferences,
  updatePreferences,
  NotificationPreferences,
} from '../../services/notifications';

export default function NotificationPreferencesScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPrefs(await getPreferences());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const onToggle = async (
    key: keyof Omit<NotificationPreferences, 'chatMessagesEnabled'>,
    value: boolean,
  ) => {
    if (!prefs) return;
    const previous = { ...prefs };
    setPrefs({ ...prefs, [key]: value });
    setBusy(true);
    setError(null);
    try {
      const updated = await updatePreferences({ [key]: value });
      setPrefs(updated);
    } catch (e) {
      // Revert on failure.
      setPrefs(previous);
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading || !prefs) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
        {t('notifications.preferences')}
      </Text>

      <PrefRow
        label={t('notifications.typeAnnouncements')}
        value={prefs.announcementsEnabled}
        onChange={(v) => void onToggle('announcementsEnabled', v)}
        disabled={busy}
      />
      <PrefRow
        label={t('notifications.typeEvents')}
        value={prefs.eventRemindersEnabled}
        onChange={(v) => void onToggle('eventRemindersEnabled', v)}
        disabled={busy}
      />
      <PrefRow
        label={t('notifications.typeChat')}
        value={true}
        onChange={() => {
          // Chat notifications are always on (SRS 16.4).
        }}
        disabled
        hint={t('notifications.chatAlwaysOn')}
      />
      <PrefRow
        label={t('notifications.typeBirthdays')}
        value={prefs.birthdaysEnabled}
        onChange={(v) => void onToggle('birthdaysEnabled', v)}
        disabled={busy}
      />
      <PrefRow
        label={t('notifications.typeNewSong')}
        value={prefs.newSongEnabled}
        onChange={(v) => void onToggle('newSongEnabled', v)}
        disabled={busy}
      />
      <PrefRow
        label={t('notifications.typeNewMemory')}
        value={prefs.newMemoryEnabled}
        onChange={(v) => void onToggle('newMemoryEnabled', v)}
        disabled={busy}
      />
      <PrefRow
        label={t('notifications.typeDailyQuote')}
        value={prefs.dailyQuoteEnabled}
        onChange={(v) => void onToggle('dailyQuoteEnabled', v)}
        disabled={busy}
      />

      {error && (
        <Text
          style={[
            typography.bodySmall,
            { color: colors.error, marginTop: spacing.md },
          ]}
        >
          {error}
        </Text>
      )}
    </ScrollView>
  );

  function PrefRow({
    label,
    value,
    onChange,
    disabled,
    hint,
  }: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
    hint?: string;
  }) {
    return (
      <View
        style={{
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          marginBottom: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={[typography.body, { color: colors.text }]}>{label}</Text>
          {hint && (
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginTop: 2 },
              ]}
            >
              {hint}
            </Text>
          )}
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={value ? colors.primaryText : '#FFFFFF'}
        />
      </View>
    );
  }
}