import React, { useEffect, useState } from 'react';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import {
  getRegistrationStatus,
  RegistrationStatus,
} from '../../services/registration';
import { ApiError } from '../../services/api';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Status'>;

export default function RegistrationStatusScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [phone, setPhone] = useState(route.params?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (route.params?.phone) void query(route.params.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = async (p: string) => {
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      const res = await getRegistrationStatus(p.trim());
      setStatus(res);
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
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={[typography.h2, { color: colors.primary }]}>
          {t('status.title')}
        </Text>
        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, marginTop: spacing.xs },
          ]}
        >
          {t('status.checkSubtitle')}
        </Text>

        <View style={{ marginTop: spacing.lg, flexDirection: 'row', gap: spacing.sm }}>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder={t('status.phone')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
            autoCapitalize="none"
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              color: colors.text,
            }}
          />
          <Pressable
            onPress={() => query(phone)}
            disabled={busy}
            style={{
              paddingHorizontal: spacing.lg,
              justifyContent: 'center',
              borderRadius: radius.md,
              backgroundColor: colors.primary,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={[typography.button, { color: colors.primaryText }]}>
                {t('status.check')}
              </Text>
            )}
          </Pressable>
        </View>

        {error && (
          <Text
            style={[
              typography.bodySmall,
              { color: colors.error, marginTop: spacing.md },
            ]}
          >
            {error}
          </Text>
        )}

        {status && (
          <View
            style={{
              marginTop: spacing.xl,
              padding: spacing.lg,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              marginBottom: spacing.xl,
            }}
          >
            {status.status === 'PENDING' && (
              <Text style={[typography.body, { color: colors.text }]}>
                {t('status.pending')}
              </Text>
            )}

            {status.status === 'APPROVED' && (
              <Text style={[typography.body, { color: colors.success }]}>
                {t('status.approved')}
              </Text>
            )}

            {status.status === 'REJECTED' && (
              <>
                <Text style={[typography.h3, { color: colors.error }]}>
                  {t('status.rejected')}
                </Text>
                {status.rejectionReason && (
                  <Text
                    style={[
                      typography.body,
                      { color: colors.text, marginTop: spacing.sm },
                    ]}
                  >
                    {t('status.rejectionReason')}: {status.rejectionReason}
                  </Text>
                )}
                <Pressable
                  onPress={() => navigation.navigate('Register')}
                  style={{
                    marginTop: spacing.lg,
                    backgroundColor: colors.primary,
                    borderRadius: radius.md,
                    paddingVertical: spacing.md,
                    alignItems: 'center',
                  }}
                >
                  <Text style={[typography.button, { color: colors.primaryText }]}>
                    {t('status.createNew')}
                  </Text>
                </Pressable>
              </>
            )}

            <Pressable
              onPress={() => navigation.navigate('Login')}
              style={{
                marginTop: spacing.md,
                alignItems: 'center',
              }}
            >
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                {t('status.backToLogin')}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}