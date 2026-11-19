import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { deleteOwnAccount } from '../../services/auth';
import { unregisterDeviceFromBackend } from '../../services/pushTokens';
import { ApiError } from '../../services/api';
import { setSessionState } from '../../services/session';
import { setRole } from '../../services/role';
import { clearChatCache } from '../chat/chatCache';
import { clearAllOffline } from '../../services/offlineSongs';
import { cacheClearAll } from '../../services/cache';
import { KeyboardAwareScroll, AuthField, ErrorBanner, withAlpha } from '../auth/Auth_UI';
import { ActionButton, FieldIcon, ScreenHero } from './SettingsKit';

export default function DeleteAccountScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    setError(null);
    if (!password) return setError(t('register.fieldRequired'));
    setBusy(true);
    try {
      // 1) Unregister this device from push BEFORE revoking the session,
      //    so the backend can still authenticate the request and delete
      //    the PushToken row. Best-effort: if it fails, deletion still
      //    proceeds (the backend soft-delete cascades over push_tokens).
      try {
        await unregisterDeviceFromBackend();
      } catch {
        // ignore — never block account deletion on a push cleanup failure
      }

      // 2) Delete on backend (soft delete, revokes sessions)
      await deleteOwnAccount(password);

      // 3) Clear all local caches and files
      await clearChatCache();
      await clearAllOffline();
      await cacheClearAll();

      // 4) Reset local session state
      setRole(null);
      setSessionState('unauthenticated');
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const enter = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);

  useEffect(() => {
    if (error) {
      shake.setValue(0);
      Animated.sequence(
        [10, -10, 6, -6, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 60, useNativeDriver: true })),
      ).start();
    }
  }, [error, shake]);

  const fadeUp = (i: number) => ({
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24 + i * 10, 0] }) }],
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHero
        icon="warning"
        overline={t('tabs.profile', { defaultValue: 'Profile' })}
        title={t('deleteAccount.title')}
        subtitle={t('deleteAccount.subtitle', { defaultValue: 'This action cannot be undone.' })}
        onBack={() => navigation.goBack()}
        variant="danger"
      />

      <KeyboardAwareScroll
        drops={false}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl * 2 }}
      >
        <Animated.View
          style={[
            styles.warning,
            { backgroundColor: withAlpha(colors.error, 0.1), borderColor: withAlpha(colors.error, 0.5) },
            fadeUp(1),
          ]}
        >
          <Ionicons name="alert-circle" size={22} color={colors.error} style={{ marginTop: 1 }} />
          <Text style={[typography.body, { color: colors.text, flex: 1, lineHeight: 22 }]}>
            {t('deleteAccount.warning')}
          </Text>
        </Animated.View>

        <Animated.View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, fadeUp(2)]}
        >
          <AuthField
            label={t('deleteAccount.confirmLabel')}
            iconNode={<FieldIcon name="lock-closed" tone="danger" />}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="go"
            onSubmitEditing={onDelete}
          />
        </Animated.View>

        {error && (
          <Animated.View style={{ marginTop: spacing.lg, transform: [{ translateX: shake }] }}>
            <ErrorBanner message={error} />
          </Animated.View>
        )}

        <Animated.View style={[{ marginTop: 28 }, fadeUp(3)]}>
          <ActionButton variant="danger" icon="trash" label={t('deleteAccount.submit')} onPress={onDelete} busy={busy} />
          <View style={{ height: spacing.md }} />
          <ActionButton variant="secondary" label={t('common.cancel')} onPress={() => navigation.goBack()} />
        </Animated.View>
      </KeyboardAwareScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  warning: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  card: { borderWidth: 1, borderRadius: 24, padding: 16, marginTop: 16 },
});