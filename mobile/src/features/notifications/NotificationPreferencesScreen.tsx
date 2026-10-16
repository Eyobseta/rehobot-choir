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
import { LinearGradient } from 'expo-linear-gradient';
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

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function NotificationPreferencesScreen() {
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
      // Revert on failure.
      setPrefs(previous);
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  // Visual only: slide/fade the hero and rows in once the data is ready.
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
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
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
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl * 2 }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={fadeUp(0)}>
        <LinearGradient
          colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View pointerEvents="none" style={[styles.blob, { top: -50, right: -40, backgroundColor: withAlpha(BRAND.gold, 0.2) }]} />
          <View pointerEvents="none" style={[styles.blob, { bottom: -70, left: -40, backgroundColor: withAlpha(BRAND.water, 0.2) }]} />
          <View style={styles.heroIcon}>
            <Ionicons name="options" size={26} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={styles.heroTitle}>
              {t('notifications.preferences')}
            </Text>
            <Text style={styles.heroSubtitle}>
              {t('notifications.preferencesSubtitle', {
                defaultValue: 'Choose what you want to hear about.',
              })}
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>

      <View style={{ marginTop: spacing.lg }}>
        <Animated.View style={fadeUp(1)}>
          <PrefRow
            icon="megaphone"
            tint="#B6A0FF"
            label={t('notifications.typeAnnouncements')}
            value={prefs.announcementsEnabled}
            onChange={(v) => void onToggle('announcementsEnabled', v)}
            disabled={busy}
          />
        </Animated.View>
        <Animated.View style={fadeUp(2)}>
          <PrefRow
            icon="calendar"
            tint="#6EDBD5"
            label={t('notifications.typeEvents')}
            value={prefs.eventRemindersEnabled}
            onChange={(v) => void onToggle('eventRemindersEnabled', v)}
            disabled={busy}
          />
        </Animated.View>
        <Animated.View style={fadeUp(3)}>
          <PrefRow
            icon="chatbubble-ellipses"
            tint="#B8E986"
            label={t('notifications.typeChat')}
            value={true}
            onChange={() => {
              // Chat notifications are always on (SRS 16.4).
            }}
            disabled
            locked
            hint={t('notifications.chatAlwaysOn')}
          />
        </Animated.View>
        <Animated.View style={fadeUp(4)}>
          <PrefRow
            icon="gift"
            tint="#EE9BBD"
            label={t('notifications.typeBirthdays')}
            value={prefs.birthdaysEnabled}
            onChange={(v) => void onToggle('birthdaysEnabled', v)}
            disabled={busy}
          />
        </Animated.View>
        <Animated.View style={fadeUp(5)}>
          <PrefRow
            icon="musical-notes"
            tint="#E6C779"
            label={t('notifications.typeNewSong')}
            value={prefs.newSongEnabled}
            onChange={(v) => void onToggle('newSongEnabled', v)}
            disabled={busy}
          />
        </Animated.View>
        <Animated.View style={fadeUp(6)}>
          <PrefRow
            icon="images"
            tint="#6EDBD5"
            label={t('notifications.typeNewMemory')}
            value={prefs.newMemoryEnabled}
            onChange={(v) => void onToggle('newMemoryEnabled', v)}
            disabled={busy}
          />
        </Animated.View>
        <Animated.View style={fadeUp(7)}>
          <PrefRow
            icon="book"
            tint="#E6C779"
            label={t('notifications.typeDailyQuote')}
            value={prefs.dailyQuoteEnabled}
            onChange={(v) => void onToggle('dailyQuoteEnabled', v)}
            disabled={busy}
          />
        </Animated.View>
      </View>

      {error && (
        <View style={{ marginTop: spacing.md }}>
          <ErrorBanner message={error} />
        </View>
      )}
    </ScrollView>
  );
}

// ---------- Row (module scope so it never remounts on parent re-render) ----------

function PrefRow({
  icon,
  tint,
  label,
  value,
  onChange,
  disabled,
  locked,
  hint,
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
      useNativeDriver: false, // animates colours
    });
    animation.start();
    return () => animation.stop();
  }, [value, on]);

  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: spacing.sm + 2 }}>
      <Pressable
        // Tapping the whole row toggles it, same handler as the switch.
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
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 22,
    borderRadius: 28,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', width: 170, height: 170, borderRadius: 85 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: BRAND.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  heroSubtitle: { marginTop: 4, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.8)' },
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