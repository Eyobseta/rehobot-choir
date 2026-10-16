import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import {
  getRegistrationStatus,
  RegistrationStatus,
} from '../../services/registration';
import { ApiError } from '../../services/api';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import {
  AuthScreen,
  AuthField,
  PrimaryButton,
  SecondaryButton,
  ErrorBanner,
  withAlpha,
} from './Auth_UI';

type Props = NativeStackScreenProps<AuthStackParamList, 'Status'>;

const PENDING_COLOR = '#F59E0B';

export default function RegistrationStatusScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [phone, setPhone] = useState(route.params?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use our own branded header instead of the native one.
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Result card pops in whenever a new status arrives
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!status) return;
    pop.setValue(0);
    Animated.spring(pop, {
      toValue: 1,
      friction: 6,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, [status, pop]);

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

  const tone =
    status?.status === 'APPROVED'
      ? { color: colors.success, icon: '✓' }
      : status?.status === 'REJECTED'
        ? { color: colors.error, icon: '✕' }
        : { color: PENDING_COLOR, icon: '⏳' };

  const badgeLabel =
    status?.status === 'APPROVED'
      ? t('status.approvedTitle', { defaultValue: 'Approved' })
      : status?.status === 'REJECTED'
        ? t('status.rejected')
        : t('status.pendingTitle', { defaultValue: 'Pending review' });

  return (
    <AuthScreen compact>
      <Text style={[typography.h2, { color: colors.text }]}>{t('status.title')}</Text>
      <Text
        style={[
          typography.bodySmall,
          { color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
        ]}
      >
        {t('status.checkSubtitle')}
      </Text>

      <AuthField
        label={t('status.phone')}
        icon="📞"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoCapitalize="none"
        returnKeyType="go"
        onSubmitEditing={() => query(phone)}
      />

      <PrimaryButton
        label={t('status.check')}
        onPress={() => query(phone)}
        busy={busy}
        icon="🔍"
      />

      {error && (
        <View style={{ marginTop: spacing.md }}>
          <ErrorBanner message={error} />
        </View>
      )}

      {status && (
        <Animated.View
          style={{
            marginTop: spacing.xl,
            padding: spacing.lg,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: withAlpha(tone.color, 0.5),
            backgroundColor: colors.surface,
            alignItems: 'center',
            opacity: pop,
            transform: [
              { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
            ],
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: withAlpha(tone.color, 0.15),
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ fontSize: 28, color: tone.color, fontWeight: '800' }}>
              {tone.icon}
            </Text>
          </View>

          {status.status === 'PENDING' && (
            <>
              <Text style={[typography.h3, { color: tone.color, textAlign: 'center' }]}>
                {badgeLabel}
              </Text>
              <Text
                style={[
                  typography.body,
                  { color: colors.text, textAlign: 'center', marginTop: spacing.sm },
                ]}
              >
                {t('status.pending')}
              </Text>
            </>
          )}

          {status.status === 'APPROVED' && (
            <>
              <Text style={[typography.h3, { color: tone.color, textAlign: 'center' }]}>
                {badgeLabel}
              </Text>
              <Text
                style={[
                  typography.body,
                  { color: colors.success, textAlign: 'center', marginTop: spacing.sm },
                ]}
              >
                {t('status.approved')}
              </Text>
            </>
          )}

          {status.status === 'REJECTED' && (
            <>
              <Text style={[typography.h3, { color: colors.error, textAlign: 'center' }]}>
                {t('status.rejected')}
              </Text>
              {status.rejectionReason && (
                <Text
                  style={[
                    typography.body,
                    { color: colors.text, marginTop: spacing.sm, textAlign: 'center' },
                  ]}
                >
                  {t('status.rejectionReason')}: {status.rejectionReason}
                </Text>
              )}
              <View style={{ alignSelf: 'stretch', marginTop: spacing.lg }}>
                <PrimaryButton
                  label={t('status.createNew')}
                  onPress={() => navigation.navigate('Register')}
                />
              </View>
            </>
          )}

          <View style={{ alignSelf: 'stretch', marginTop: spacing.md }}>
            <SecondaryButton
              label={t('status.backToLogin')}
              onPress={() => navigation.navigate('Login')}
            />
          </View>
        </Animated.View>
      )}

      {!status && (
        <View style={{ marginTop: spacing.xl }}>
          <SecondaryButton
            label={t('status.backToLogin')}
            onPress={() => navigation.navigate('Login')}
          />
        </View>
      )}
    </AuthScreen>
  );
}