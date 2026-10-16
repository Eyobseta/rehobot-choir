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
import {
  KeyboardAwareScroll,
  AuthField,
  SecondaryButton,
  ErrorBanner,
  withAlpha,
} from '../auth/Auth_UI';

// Danger palette: this screen is deliberately red, not the playful brand violet.
const DANGER = { deep: '#3B0D17', red: '#C0262D', hot: '#E0405A' };
const DANGER_GRADIENT = [DANGER.deep, DANGER.red, DANGER.hot] as const;
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
      await deleteOwnAccount(password);
      setRole(null);
      setSessionState('unauthenticated');
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  // ---- Visual-only motion ----
  const enter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enter, pulse]);

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
      {/* No water drops here: a destructive screen should feel calm and serious. */}
      <KeyboardAwareScroll
        drops={false}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xl * 2 }}
      >
        {/* Hero */}
        <Animated.View style={fadeUp(0)}>
          <LinearGradient
            colors={DANGER_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View pointerEvents="none" style={[styles.blob, { top: -50, right: -40, backgroundColor: withAlpha('#FFFFFF', 0.08) }]} />
            <View pointerEvents="none" style={[styles.blob, { bottom: -70, left: -40, backgroundColor: withAlpha(DANGER.hot, 0.3) }]} />

            <View style={styles.heroIconWrap}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.heroHalo,
                  {
                    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
                  },
                ]}
              />
              <View style={styles.heroIcon}>
                <Ionicons name="warning" size={28} color={DANGER.red} />
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={styles.heroTitle}>
                {t('deleteAccount.title')}
              </Text>
              <Text style={styles.heroSubtitle}>
                {t('deleteAccount.subtitle', { defaultValue: 'This action cannot be undone.' })}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Warning */}
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

        {/* Confirm with password */}
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

// ---------- Danger button (red gradient, press spring) ----------

function DangerButton({
  label,
  onPress,
  busy,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
}) {
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
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 22,
    borderRadius: 28,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', width: 170, height: 170, borderRadius: 85 },
  heroIconWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  heroHalo: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  heroSubtitle: { marginTop: 4, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.82)' },
  warning: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    marginTop: 20,
  },
  card: { borderWidth: 1, borderRadius: 24, padding: 16, marginTop: 16 },
  fieldIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});