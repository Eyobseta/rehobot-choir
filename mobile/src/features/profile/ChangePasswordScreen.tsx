import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { changePassword } from '../../services/auth';
import { ApiError } from '../../services/api';

export default function ChangePasswordScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

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
      setTimeout(() => navigation.goBack(), 800);
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
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={[typography.h2, { color: colors.primary }]}>
          {t('password.changeTitle')}
        </Text>

        <View style={{ marginTop: spacing.lg }}>
          <Field label={t('password.current')} value={current} onChange={setCurrent} secureTextEntry />
          <Field label={t('password.new')} value={next} onChange={setNext} secureTextEntry />
          <Field label={t('password.confirm')} value={confirm} onChange={setConfirm} secureTextEntry />
        </View>

        {error && (
          <Text style={[typography.bodySmall, { color: colors.error, marginTop: spacing.md }]}>
            {error}
          </Text>
        )}
        {success && (
          <Text style={[typography.bodySmall, { color: colors.success, marginTop: spacing.md }]}>
            {success}
          </Text>
        )}

        <Pressable
          onPress={onSubmit}
          disabled={busy}
          style={{
            marginTop: spacing.xl,
            backgroundColor: colors.primary,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            alignItems: 'center',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={[typography.button, { color: colors.primaryText }]}>
              {t('password.submit')}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secureTextEntry?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
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