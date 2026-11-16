import React, { useLayoutEffect, useRef, useState } from 'react';
import { View, Text, Animated, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { login } from '../../services/auth';
import { ApiError } from '../../services/api';
import { setSessionState } from '../../services/session';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { registerDeviceWithBackend } from '../../services/pushTokens';
import { AuthScreen, AuthField, PrimaryButton, ErrorBanner, BRAND } from './Auth_UI';
import {
  ActionTile,
  FadeInUp,
  LabeledDivider,
  fieldIcon,
  useShake,
} from './Auth_kit';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const { shakeStyle, shake } = useShake();

  // Use our own branded header instead of the native one.
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const onLogin = async () => {
    if (busy) return;

    // Friendly guard: highlight what's missing instead of hitting the API.
    if (!phone.trim() || !password) {
      setShowMissing(true);
      setError(t('register.fieldRequired'));
      shake();
      return;
    }

    setShowMissing(false);
    setError(null);
    setBusy(true);
    try {
      const Device = await import('expo-device');
      const { Platform } = await import('react-native');
      const deviceLabel = Device.isDevice
        ? `${Device.deviceName ?? 'Device'} (${Platform.OS})`
        : `Emulator (${Platform.OS})`;

      await login({ phone: phone.trim(), password, deviceLabel });

      const { refreshRole } = await import('../../services/role');
      await refreshRole();
      setSessionState('authenticated');

      // Register this device for push notifications — best-effort,
      // never blocks the login flow.
      void registerDeviceWithBackend();
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'ACCOUNT_LOCKED') {
        setError(
          t('auth.accountLocked', {
            defaultValue:
              'Your account is locked. Please contact a choir leader to unlock it.',
          }),
        );
      } else {
        setError(`${err.message} [${err.code}]`);
      }
      shake();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      subtitle={t('auth.tagline', { defaultValue: 'Sing together, grow together' })}
    >
      <FadeInUp index={0}>
        <Text style={[typography.h1, { color: colors.text }]}>{t('auth.loginTitle')}</Text>
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
          ]}
        >
          {t('auth.loginSubtitle', { defaultValue: 'Welcome back! Sign in to continue.' })}
        </Text>
      </FadeInUp>

      <FadeInUp index={1}>
        <AuthField
          label={t('auth.phone')}
          iconNode={fieldIcon('call-outline')}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoComplete="tel"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          error={showMissing && !phone.trim()}
        />
        <AuthField
          label={t('auth.password')}
          iconNode={fieldIcon('lock-closed-outline')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          returnKeyType="go"
          onSubmitEditing={onLogin}
          inputRef={passwordRef}
          error={showMissing && !password}
        />
      </FadeInUp>

      {error ? (
        <Animated.View style={[{ marginTop: spacing.xs }, shakeStyle]}>
          <ErrorBanner message={error} />
        </Animated.View>
      ) : null}

      <FadeInUp index={2} style={{ marginTop: spacing.sm }}>
        <PrimaryButton
          label={t('auth.login')}
          onPress={onLogin}
          busy={busy}
          iconNode={<Ionicons name="musical-notes" size={20} color="#FFFFFF" />}
        />
      </FadeInUp>

      <FadeInUp index={3} style={{ marginTop: spacing.xxl }}>
        <LabeledDivider text={t('auth.dontHaveAccount')} />
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
          <ActionTile
            icon="person-add-outline"
            label={t('auth.register')}
            onPress={() => navigation.navigate('Register')}
          />
          <ActionTile
            icon="search-outline"
            label={t('auth.checkStatus')}
            tint={BRAND.cream}
            onPress={() => navigation.navigate('Status')}
          />
        </View>
      </FadeInUp>
    </AuthScreen>
  );
}