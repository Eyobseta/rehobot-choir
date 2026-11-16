import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { FadeInUp, StatusBadge, StatusTimeline, fieldIcon, useShake } from './Auth_kit';

type Props = NativeStackScreenProps<AuthStackParamList, 'Status'>;

export default function RegistrationStatusScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const pendingColor = colors.warning;

  const [phone, setPhone] = useState(route.params?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { shakeStyle, shake } = useShake();

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
      shake();
    } finally {
      setBusy(false);
    }
  };

  const tone =
    status?.status === 'APPROVED'
      ? { color: colors.success }
      : status?.status === 'REJECTED'
        ? { color: colors.error }
        : { color: pendingColor };

  const badgeLabel =
    status?.status === 'APPROVED'
      ? t('status.approvedTitle', { defaultValue: 'Approved' })
      : status?.status === 'REJECTED'
        ? t('status.rejected')
        : t('status.pendingTitle', { defaultValue: 'Pending review' });

  return (
    <AuthScreen compact>
      <FadeInUp index={0}>
        <Text style={[typography.h1, { color: colors.text }]}>{t('status.title')}</Text>
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
          ]}
        >
          {t('status.checkSubtitle')}
        </Text>
      </FadeInUp>

      <FadeInUp index={1}>
        <AuthField
          label={t('status.phone')}
          iconNode={fieldIcon('call-outline')}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoComplete="tel"
          returnKeyType="go"
          onSubmitEditing={() => query(phone)}
        />

        <PrimaryButton
          label={t('status.check')}
          onPress={() => query(phone)}
          busy={busy}
          iconNode={<Ionicons name="search" size={18} color="#FFFFFF" />}
        />
      </FadeInUp>

      {error ? (
        <Animated.View style={[{ marginTop: spacing.md }, shakeStyle]}>
          <ErrorBanner message={error} />
        </Animated.View>
      ) : null}

      {status && (
        <Animated.View
          style={{
            marginTop: spacing.xl,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.lg,
            paddingTop: spacing.sm,
            borderRadius: radius.lg,
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
          <View style={{ marginVertical: -spacing.xl }}>
            <StatusBadge kind={status.status} color={tone.color} />
          </View>

          {status.status === 'PENDING' && (
            <>
              <Text
                style={[
                  typography.h2,
                  { color: tone.color, textAlign: 'center', marginTop: spacing.md },
                ]}
              >
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
              <Text
                style={[
                  typography.h2,
                  { color: tone.color, textAlign: 'center', marginTop: spacing.md },
                ]}
              >
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
              <Text
                style={[
                  typography.h2,
                  { color: colors.error, textAlign: 'center', marginTop: spacing.md },
                ]}
              >
                {t('status.rejected')}
              </Text>
              {status.rejectionReason && (
                <View
                  style={{
                    alignSelf: 'stretch',
                    marginTop: spacing.md,
                    padding: spacing.md,
                    borderRadius: radius.md,
                    borderLeftWidth: 4,
                    borderLeftColor: colors.error,
                    backgroundColor: withAlpha(colors.error, 0.1),
                  }}
                >
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {t('status.rejectionReason')}
                  </Text>
                  <Text style={[typography.body, { color: colors.text, marginTop: 2 }]}>
                    {status.rejectionReason}
                  </Text>
                </View>
              )}
            </>
          )}

          <View style={{ alignSelf: 'stretch', marginTop: spacing.xl }}>
            <StatusTimeline
              status={status.status}
              decisionColor={tone.color}
              pendingColor={pendingColor}
            />
          </View>

          {/* Actions depend on the outcome */}
          <View style={{ alignSelf: 'stretch', marginTop: spacing.xl, gap: spacing.md }}>
            {status.status === 'APPROVED' && (
              <PrimaryButton
                label={t('auth.login')}
                onPress={() => navigation.navigate('Login')}
                iconNode={<Ionicons name="log-in-outline" size={20} color="#FFFFFF" />}
              />
            )}

            {status.status === 'REJECTED' && (
              <PrimaryButton
                label={t('status.createNew')}
                onPress={() => navigation.navigate('Register')}
                iconNode={<Ionicons name="refresh" size={18} color="#FFFFFF" />}
              />
            )}

            {status.status === 'PENDING' ? (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <SecondaryButton
                  label={t('status.refresh', { defaultValue: 'Refresh' })}
                  onPress={() => query(phone)}
                  flex={1}
                />
                <SecondaryButton
                  label={t('status.backToLogin')}
                  onPress={() => navigation.navigate('Login')}
                  flex={1}
                />
              </View>
            ) : status.status === 'REJECTED' ? (
              <SecondaryButton
                label={t('status.backToLogin')}
                onPress={() => navigation.navigate('Login')}
              />
            ) : null}
          </View>
        </Animated.View>
      )}

      {!status && (
        <FadeInUp index={2} style={{ marginTop: spacing.xl }}>
          <SecondaryButton
            label={t('status.backToLogin')}
            onPress={() => navigation.navigate('Login')}
          />
        </FadeInUp>
      )}
    </AuthScreen>
  );
}