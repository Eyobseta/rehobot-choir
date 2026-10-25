import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { deleteOwnAccount } from '../../services/auth';
import { ApiError } from '../../services/api';
import { setSessionState } from '../../services/session';
import { setRole } from '../../services/role';
import { clearChatCache } from '../chat/chatCache';
import { clearAllOffline } from '../../services/offlineSongs';
import { cacheClearAll } from '../../services/cache';
import {
  KeyboardAwareScroll,
  AuthField,
  SecondaryButton,
  ErrorBanner,
  withAlpha,
} from '../auth/Auth_UI';
import { ScreenHero } from './SettingsKit';

const DANGER = { deep: '#3B0D17', red: '#C0262D', hot: '#E0405A' };
const BUTTON_GRADIENT = [DANGER.red, DANGER.hot] as const;

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
      // 1) Delete on backend (soft delete, revokes sessions)
      await deleteOwnAccount(password);
      
      // 2) Clear all local caches and files
      await clearChatCache();
      await clearAllOffline();
      await cacheClearAll();
      
      // 3) Reset local session state
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
        title={t('deleteAccount.title')}
        subtitle={t('deleteAccount.subtitle', { defaultValue: 'This action cannot be undone.' })}
        onBack={() => navigation.goBack()}
        variant="danger"
      />

      <KeyboardAwareScroll
        drops={false}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xl * 2 }}
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
            iconNode={
              <View style={[styles.fieldIcon, { backgroundColor: withAlpha(colors.error, 0.16) }]}>
                <Ionicons name="lock-closed" size={16} color={colors.error} />
              </View>
            }
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
          <DangerButton label={t('deleteAccount.submit')} onPress={onDelete} busy={busy} />
          <View style={{ height: spacing.md }} />
          <SecondaryButton label={t('common.cancel')} onPress={() => navigation.goBack()} />
        </Animated.View>
      </KeyboardAwareScroll>
    </View>
  );
}

function DangerButton({ label, onPress, busy }: { label: string; onPress: () => void; busy: boolean }) {
  const { theme } = useTheme();
  const { spacing, radius, typography } = theme;
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={{
        borderRadius: radius.md,
        backgroundColor: DANGER.red,
        opacity: busy ? 0.65 : 1,
        transform: [{ scale }],
        shadowColor: DANGER.hot,
        shadowOpacity: 0.4,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy }}
      >
        <LinearGradient
          colors={BUTTON_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            minHeight: 54,
            paddingVertical: spacing.md,
            borderRadius: radius.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="trash" size={18} color="#FFFFFF" />
              <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '700' }]}>{label}</Text>
            </>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
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
  fieldIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});