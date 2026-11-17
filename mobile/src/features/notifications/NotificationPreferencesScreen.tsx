import React, { useEffect, useRef } from 'react';
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
import { useTheme } from '../../theme/ThemeContext';
import { NotificationPreferences } from '../../services/notifications';
import { ErrorBanner, BRAND, withAlpha } from '../auth/Auth_UI';
import { ScreenHero } from '../profile/SettingsKit';
import {
  useNotificationPrefsQuery,
  useUpdateNotificationPrefsMutation,
} from '../profile/useProfile';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function NotificationPreferencesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;

  const q = useNotificationPrefsQuery();
  const updateMut = useUpdateNotificationPrefsMutation();

  const prefs = q.data;
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  // Keep a local mirror so switches feel instant while we PATCH.
  const [local, setLocal] = React.useState<NotificationPreferences | null>(null);
  React.useEffect(() => {
    if (prefs) setLocal(prefs);
  }, [prefs]);

  const busy = updateMut.isPending;

  const onToggle = (
    key: keyof Omit<NotificationPreferences, 'chatMessagesEnabled'>,
    value: boolean,
  ) => {
    if (!local) return;
    setLocal({ ...local, [key]: value });
    updateMut.mutate({ [key]: value });
  };

  const enter = useRef(new Animated.Value(0)).current;
  const ready = !firstLoad && local !== null;
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

  if (firstLoad || !local) {
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

  const fadeUp = (i: number) => ({
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [22 + i * 8, 0],
        }),
      },
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

      {showingSavedData && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: withAlpha('#E8A65D', 0.14),
              borderWidth: 1,
              borderColor: withAlpha('#E8A65D', 0.4),
            }}
          >
            <Ionicons name="cloud-offline" size={13} color="#E8A65D" />
            <Text
              style={[
                theme.typography.caption,
                { color: '#E8A65D', fontWeight: '800' },
              ]}
            >
              {t('home.showingSavedData', { defaultValue: 'Showing saved data' })}
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xl * 2,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={fadeUp(0)}>
          <PrefRow
            icon="megaphone"
            tint="#8B6FD6"
            label={t('notifications.typeAnnouncements')}
            value={local.announcementsEnabled}
            onChange={(v) => onToggle('announcementsEnabled', v)}
            disabled={busy}
          />
        </Animated.View>
        <Animated.View style={fadeUp(1)}>
          <PrefRow
            icon="calendar"
            tint="#14A38B"
            label={t('notifications.typeEvents')}
            value={local.eventRemindersEnabled}
            onChange={(v) => onToggle('eventRemindersEnabled', v)}
            disabled={busy}
          />
        </Animated.View>
        <Animated.View style={fadeUp(2)}>
          <PrefRow
            icon="chatbubble-ellipses"
            tint="#2FB36A"
            label={t('notifications.typeChat')}
            value={true}
            onChange={() => {
              /* always on — SRS 16.4 */
            }}
            disabled
            locked
            hint={t('notifications.chatAlwaysOn')}
          />
        </Animated.View>
        <Animated.View style={fadeUp(3)}>
          <PrefRow
            icon="gift"
            tint="#E8736F"
            label={t('notifications.typeBirthdays')}
            value={local.birthdaysEnabled}
            onChange={(v) => onToggle('birthdaysEnabled', v)}
            disabled={busy}
          />
        </Animated.View>
        <Animated.View style={fadeUp(4)}>
          <PrefRow
            icon="musical-notes"
            tint="#E8A65D"
            label={t('notifications.typeNewSong')}
            value={local.newSongEnabled}
            onChange={(v) => onToggle('newSongEnabled', v)}
            disabled={busy}
          />
        </Animated.View>
        <Animated.View style={fadeUp(5)}>
          <PrefRow
            icon="images"
            tint="#14A38B"
            label={t('notifications.typeNewMemory')}
            value={local.newMemoryEnabled}
            onChange={(v) => onToggle('newMemoryEnabled', v)}
            disabled={busy}
          />
        </Animated.View>
        <Animated.View style={fadeUp(6)}>
          <PrefRow
            icon="book"
            tint="#E8A65D"
            label={t('notifications.typeDailyQuote')}
            value={local.dailyQuoteEnabled}
            onChange={(v) => onToggle('dailyQuoteEnabled', v)}
            disabled={busy}
          />
        </Animated.View>

        {updateMut.isError && (
          <View style={{ marginTop: spacing.md }}>
            <ErrorBanner
              message={
                (updateMut.error as { message?: string })?.message ?? 'Error'
              }
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

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
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [value, on]);

  const to = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      speed: 40,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

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
                  outputRange: [
                    withAlpha(colors.textSecondary, 0.12),
                    withAlpha(tint, 0.22),
                  ],
                }),
              },
            ]}
          >
            <Ionicons name={icon} size={21} color={value ? tint : colors.textSecondary} />
          </Animated.View>

          <View style={{ flex: 1, marginLeft: spacing.md, marginRight: spacing.sm }}>
            <Text style={[typography.body, { color: colors.text, fontWeight: '700' }]}>
              {label}
            </Text>
            {hint && (
              <View style={styles.hintRow}>
                {locked && (
                  <Ionicons name="lock-closed" size={11} color={colors.textSecondary} />
                )}
                <Text
                  style={[typography.caption, { color: colors.textSecondary, flexShrink: 1 }]}
                >
                  {hint}
                </Text>
              </View>
            )}
          </View>

          <Switch
            value={value}
            onValueChange={onChange}
            disabled={disabled}
            trackColor={{ false: colors.border, true: BRAND.mint }}
            thumbColor={value ? BRAND.teal : '#FFFFFF'}
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
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
});