import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { deleteOwnAccount } from '../../services/auth';
import { ApiError } from '../../services/api';
import { setSessionState } from '../../services/session';
import { setRole } from '../../services/role';

export default function DeleteAccountScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

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

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.xl,
        flexGrow: 1,
        backgroundColor: colors.background,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[typography.h2, { color: colors.error }]}>
        {t('deleteAccount.title')}
      </Text>

      <Text style={[typography.body, { color: colors.text, marginTop: spacing.lg }]}>
        {t('deleteAccount.warning')}
      </Text>

      <Text
        style={[
          typography.bodySmall,
          {
            color: colors.textSecondary,
            marginTop: spacing.xl,
            marginBottom: spacing.xs,
          },
        ]}
      >
        {t('deleteAccount.confirmLabel')}
      </Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          color: colors.text,
        }}
      />

      {error && (
        <Text style={[typography.bodySmall, { color: colors.error, marginTop: spacing.md }]}>
          {error}
        </Text>
      )}

      <Pressable
        onPress={onDelete}
        disabled={busy}
        style={{
          marginTop: spacing.xl,
          backgroundColor: colors.error,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          alignItems: 'center',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={[typography.button, { color: '#FFFFFF' }]}>
            {t('deleteAccount.submit')}
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}