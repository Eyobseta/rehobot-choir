import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Switch,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
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
import { ErrorBanner, BRAND, withAlpha } from '../auth/Auth_UI';
import { ScreenHero } from '../profile/SettingsKit';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function NotificationPreferencesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;

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
      setPrefs(previous);
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const enter = useRef(new Animated.Value(0)).current;
  const ready = !loading && prefs !== null;
  useEffect(() => {
    if (!ready) return;
    enter.setValue(0);
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [ready, enter]);

  if (loading || !prefs) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={BRAND.violet} />
      </View>
    );
  }

  const fadeUp = (i: number) => ({
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22 + i * 8, 0] }) },
    ],
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHero
        icon="options"
        title={t('notifications.preferences')}
        subtitle={t('notifications.preferencesSubtitle', {
          defaultValue: 'Choose what you want to hear about.',
        })}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl * 2 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={fadeUp(0)}>
          <PrefRow
            icon="megaphone"
            tint="#B6A0FF"
            label={t('notifications.typeAnnouncements')}
            value={prefs.announcementsEnabled}
            onChange={(v) => void onToggle('announcementsEnabled', v)}
            disabled={busy}
          />
        </Animated.View>
        <Animated.View style={fadeUp(1)}>
          <PrefRow
            icon="calendar"
            tint="#6EDBD5"
            label={t('notifications.typeEvents')}
            value={prefs.eventRemindersEnabled}
            onChange={(v) => void onToggle('eventRemindersEnabled', v)}
            disabled={busy}
          />
        </Animated.View>
        <Animated.View style={fadeUp(2)}>
          <PrefRow
            icon="chatbubble-ellipses"
            tint="#B8E986"
            label={t('notifications.typeChat')}
            value={true}
            onChange={() => { /* always on — SRS 16.4 */ }}
            disabled
            locked
            hint={t('notifications.chatAlwaysOn')}
          />
        </Animated.View>
        <Animated.View style={fadeUp(3)}>
          <PrefRow
            icon="gift"
            tint="#EE9BBD"
            label={t('notifications.typeBirthdays')}
            value={prefs.birthdaysEnabled}
            onChange={(v) => void onToggle('birthdaysEnabled', v)}
            disabled={busy}
          />
        </Animated.View>
        <Animated.View style={fadeUp(4)}>
          <PrefRow
            icon="musical-notes"
            tint="#E6C779"
            label={t('notifications.typeNewSong')}
            value={prefs.newSongEnabled}
            onChange={(v) => void onToggle('newSongEnabled', v)}
            disabled={busy}
          />
        </Animated.View>
        <Animated.View style={fadeUp(5)}>
          <PrefRow
            icon="images"
            tint="#6EDBD5"
            label={t('notifications.typeNewMemory')}
            value={prefs.newMemoryEnabled}
            onChange={(v) => void onToggle('newMemoryEnabled', v)}
            disabled={busy}
          />
        </Animated.View>
        <Animated.View style={fadeUp(6)}>
          <PrefRow
            icon="book"
            tint="#E6C779"
            label={t('notifications.typeDailyQuote')}
            value={prefs.dailyQuoteEnabled}
            onChange={(v) => void onToggle('dailyQuoteEnabled', v)}
            disabled={busy}
          />
        </Animated.View>

        {error && (
          <View style={{ marginTop: spacing.md }}>
            <ErrorBanner message={error} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ---------- Row ----------

function PrefRow({
  icon, tint, label, value, onChange, disabled, locked, hint,
}: {
  icon: IconName;
  tint: string;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  locked?: boolean;
  hint?: string;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const scale = useRef(new Animated.Value(1)).current;
  const on = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    const animation = Animated.timing(on, {
      toValue: value ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [value, on]);

  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: spacing.sm + 2 }}>
      <Pressable
        onPress={() => onChange(!value)}
        onPressIn={() => !disabled && to(0.98)}
        onPressOut={() => to(1)}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled: !!disabled }}
      >
        <Animated.View
          style={[
            styles.row,
            {
              backgroundColor: colors.surface,
              opacity: disabled && !locked ? 0.7 : 1,
              borderColor: on.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.border, withAlpha(tint, 0.6)],
              }),
            },
          ]}
        >
          <Animated.View
            style={[
              styles.iconTile,
              {
                backgroundColor: on.interpolate({
                  inputRange: [0, 1],
                  outputRange: [withAlpha(colors.textSecondary, 0.12), withAlpha(tint, 0.22)],
                }),
              },
            ]}
          >
            <Ionicons name={icon} size={21} color={value ? tint : colors.textSecondary} />
          </Animated.View>

          <View style={{ flex: 1, marginLeft: spacing.md, marginRight: spacing.sm }}>
            <Text style={[typography.body, { color: colors.text, fontWeight: '700' }]}>{label}</Text>
            {hint && (
              <View style={styles.hintRow}>
                {locked && <Ionicons name="lock-closed" size={11} color={colors.textSecondary} />}
                <Text style={[typography.caption, { color: colors.textSecondary, flexShrink: 1 }]}>
                  {hint}
                </Text>
              </View>
            )}
          </View>

          <Switch
            value={value}
            onValueChange={onChange}
            disabled={disabled}
            trackColor={{ false: colors.border, true: BRAND.violet }}
            thumbColor={value ? BRAND.gold : '#FFFFFF'}
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  iconTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
});