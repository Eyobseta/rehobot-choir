import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { login } from '../../services/auth';
import { ApiError } from '../../services/api';
import { setSessionState } from '../../services/session';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { registerDeviceWithBackend } from '../../services/pushTokens';


type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: spacing.xl,
          justifyContent: 'center',
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={[typography.h1, { color: colors.primary }]}>
          {t('auth.loginTitle')}
        </Text>

        <View style={{ marginTop: spacing.xl }}>
          <Field
            label={t('auth.phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
          <Field
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && (
            <Text
              style={[
                typography.bodySmall,
                { color: colors.error, marginBottom: spacing.md },
              ]}
            >
              {error}
            </Text>
          )}

          <Pressable
            onPress={onLogin}
            disabled={busy}
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              alignItems: 'center',
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={[typography.button, { color: colors.primaryText }]}>
              {busy ? '…' : t('auth.login')}
            </Text>
          </Pressable>

          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            <Pressable onPress={() => navigation.navigate('Register')}>
              <Text
                style={[
                  typography.body,
                  { color: colors.text, textAlign: 'center' },
                ]}
              >
                {t('auth.dontHaveAccount')}{' '}
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  {t('auth.register')}
                </Text>
              </Text>
            </Pressable>

            <Pressable onPress={() => navigation.navigate('Status')}>
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  secureTextEntry?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text
        style={[
          typography.bodySmall,
          { color: colors.textSecondary, marginBottom: spacing.xs },
        ]}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        secureTextEntry={secureTextEntry}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          color: colors.text,
          fontSize: typography.body.fontSize,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({});