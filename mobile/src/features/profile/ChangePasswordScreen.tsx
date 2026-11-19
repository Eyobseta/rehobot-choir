import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { changePassword } from '../../services/auth';
import { ApiError } from '../../services/api';
import { KeyboardAwareScroll, AuthField, ErrorBanner } from '../auth/Auth_UI';
import { ActionButton, FieldIcon, ScreenHero, SuccessBanner } from './SettingsKit';

function strengthOf(p: string): number {
  if (!p) return 0;
  if (p.length < 8) return 1;
  let s = 1;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4);
}

export default function ChangePasswordScreen({ navigation, forced, onPasswordChanged }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (next.length < 8) return setError(t('password.tooShort'));
    if (next !== confirm) return setError(t('password.mismatch'));

    setBusy(true);
    try {
      await changePassword(current, next);
      setSuccess(t('password.success'));
      if (forced) {
        // Give the user a moment to see the success confirmation, then hand
        // control back to App.tsx. It will clear `mustChangePassword`, which
        // re-renders AppShell and mounts the normal navigator (RootTabs).
        // Without this callback, the screen was a dead-end: nothing in the
        // app ever cleared the forced flag after a successful change.
        setTimeout(() => onPasswordChanged?.(), 800);
      } else {
        setTimeout(() => navigation.goBack(), 800);
      }
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const enter = useRef(new Animated.Value(0)).current;
  const strengthAnim = useRef(new Animated.Value(0)).current;
  const successPop = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  const score = strengthOf(next);
  const labels = [
    '',
    t('password.strengthWeak', { defaultValue: 'Weak' }),
    t('password.strengthFair', { defaultValue: 'Fair' }),
    t('password.strengthGood', { defaultValue: 'Good' }),
    t('password.strengthStrong', { defaultValue: 'Strong' }),
  ];
  const barColors = [colors.border, colors.error, colors.warning, colors.primary, colors.success];

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);

  useEffect(() => {
    Animated.timing(strengthAnim, { toValue: score, duration: 300, useNativeDriver: false }).start();
  }, [score, strengthAnim]);

  useEffect(() => {
    if (success) {
      successPop.setValue(0);
      Animated.spring(successPop, { toValue: 1, useNativeDriver: true, bounciness: 14 }).start();
    }
  }, [success, successPop]);

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

  const matches = confirm.length > 0 && confirm === next;
  const mismatch = confirm.length > 0 && confirm !== next;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {!forced && (
        <ScreenHero
          icon="lock-closed"
          overline={t('tabs.profile', { defaultValue: 'Profile' })}
          title={t('password.changeTitle')}
          subtitle={t('password.changeSubtitle', { defaultValue: 'Keep your account safe with a strong password.' })}
          onBack={() => navigation.goBack()}
        />
      )}
      {forced && (
        <ScreenHero
          icon="lock-closed"
          title={t('password.changeTitle')}
          subtitle={t('password.banner', { defaultValue: 'You are using a temporary password. Please change it.' })}
        />
      )}

      <KeyboardAwareScroll drops={false} contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl * 2 }}>
        <Animated.View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, fadeUp(1)]}
        >
          <AuthField
            label={t('password.current')}
            iconNode={<FieldIcon name="key" tone="peach" />}
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoCapitalize="none"
          />
          <AuthField
            label={t('password.new')}
            iconNode={<FieldIcon name="lock-closed" tone="lavender" />}
            value={next}
            onChangeText={setNext}
            secureTextEntry
            autoCapitalize="none"
          />

          {next.length > 0 && (
            <View style={{ marginTop: -4, marginBottom: spacing.md }}>
              <View style={[styles.track, { backgroundColor: colors.border }]}>
                <Animated.View
                  style={{
                    height: 6,
                    borderRadius: 3,
                    width: strengthAnim.interpolate({ inputRange: [0, 4], outputRange: ['0%', '100%'] }),
                    backgroundColor: strengthAnim.interpolate({
                      inputRange: [0, 1, 2, 3, 4],
                      outputRange: barColors,
                    }),
                  }}
                />
              </View>
              <Text style={[typography.caption, { color: barColors[score], marginTop: 6, fontWeight: '800' }]}>
                {labels[score]}
              </Text>
            </View>
          )}

          <AuthField
            label={t('password.confirm')}
            iconNode={<FieldIcon name="shield-checkmark" tone="mint" />}
            showCheck={matches}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
          {matches && (
            <View style={styles.matchRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={[typography.caption, { color: colors.success, fontWeight: '700' }]}>
                {t('password.matches', { defaultValue: 'Passwords match' })}
              </Text>
            </View>
          )}
          {mismatch && (
            <View style={styles.matchRow}>
              <Ionicons name="close-circle" size={14} color={colors.error} />
              <Text style={[typography.caption, { color: colors.error, fontWeight: '700' }]}>
                {t('password.mismatch')}
              </Text>
            </View>
          )}
        </Animated.View>

        {error && (
          <Animated.View style={{ marginTop: spacing.lg, transform: [{ translateX: shake }] }}>
            <ErrorBanner message={error} />
          </Animated.View>
        )}
        {success && (
          <SuccessBanner
            text={success}
            animatedStyle={{
              opacity: successPop,
              transform: [{ scale: successPop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
            }}
          />
        )}

        <Animated.View style={[{ marginTop: 28 }, fadeUp(2)]}>
          <ActionButton
            icon="shield-checkmark-outline"
            label={t('password.submit')}
            onPress={onSubmit}
            busy={busy}
          />
        </Animated.View>
      </KeyboardAwareScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 16 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -4 },
});