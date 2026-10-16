import React, { useLayoutEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { login } from '../../services/auth';
import { ApiError } from '../../services/api';
import { setSessionState } from '../../services/session';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { registerDeviceWithBackend } from '../../services/pushTokens';
import {
  AuthScreen,
  AuthField,
  PrimaryButton,
  ErrorBanner,
} from './Auth_UI';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use our own branded header instead of the native one.
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const onLogin = async () => {
    setError(null);
    setBusy(true);
    try {
      await login({ phone: phone.trim(), password, deviceLabel: 'expo-phone' });
      const { refreshRole } = await import('../../services/role');
      await refreshRole();
      setSessionState('authenticated');

      // Register this device for push notifications — best-effort,
      // never blocks the login flow.
      void registerDeviceWithBackend();
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      subtitle={t('auth.tagline', { defaultValue: 'Sing together, grow together' })}
    >
      <Text style={[typography.h2, { color: colors.text }]}>
        {t('auth.loginTitle')}
      </Text>
      <Text
        style={[
          typography.bodySmall,
          { color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
        ]}
      >
        {t('auth.loginSubtitle', { defaultValue: 'Welcome back! Sign in to continue.' })}
      </Text>

      <AuthField
        label={t('auth.phone')}
        icon="📞"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoCapitalize="none"
        returnKeyType="next"
      />
      <AuthField
        label={t('auth.password')}
        icon="🔒"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        returnKeyType="go"
        onSubmitEditing={onLogin}
      />

      {error && <ErrorBanner message={error} />}

      <View style={{ marginTop: spacing.sm }}>
        <PrimaryButton label={t('auth.login')} onPress={onLogin} busy={busy} icon="🎶" />
      </View>

      <View style={{ marginTop: spacing.xl, gap: spacing.md, alignItems: 'center' }}>
        <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8}>
          <Text style={[typography.body, { color: colors.text, textAlign: 'center' }]}>
            {t('auth.dontHaveAccount')}{' '}
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              {t('auth.register')}
            </Text>
          </Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('Status')}
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Text
            style={[
              typography.bodySmall,
              { color: colors.textSecondary, textAlign: 'center' },
            ]}
          >
            {t('auth.checkStatus')}
          </Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}