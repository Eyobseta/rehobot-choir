import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { PrimaryButton, BRAND, withAlpha } from '../auth/Auth_UI';
import { getMyFunding, MyFunding } from '../../services/funding';
import {
  Card, StatusChip, useDateLabel, errorText, SectionLabel, DetailHeader, ProgressBar, Notice,
  ErrorState, DeclarationHistory, NumberTick, AccessiblePress,
} from './fundingKit';
import type { PayFlowParams } from './Payflowscreen';

export default function AnnualDetailScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const navigation = useNavigation<any>();
  const dateLabel = useDateLabel();

  const [data, setData] = useState<MyFunding | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setError(null); setData(await getMyFunding()); }
    catch (e) { setError(errorText(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={BRAND.violet} /></View>;
  }
  if (error && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <DetailHeader title={t('funding.annualTitle')} onBack={() => navigation.goBack()} />
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  const annual = data?.annual;
  if (!annual) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <DetailHeader title={t('funding.annualTitle')} onBack={() => navigation.goBack()} />
        <View style={{ padding: spacing.xl }}>
          <Notice tone="info" text={data?.notEligible ? t('funding.notEligible') : t('funding.notSetUp')} />
        </View>
      </View>
    );
  }

  const { record, history, config } = annual;
  const prog = record.progress;
  const pendingMinor = record.pendingAmount?.minor ?? 0;

  // Safely calculate maxNewMinor — fall back to amountDue - paid when
  // `prog.remaining` is null (open-amount edge case).
  const remaining = prog.remaining?.minor ?? (record.amountDue.minor - prog.paid.minor);
  const maxNewMinor = Math.max(0, remaining - pendingMinor);

  const pending = record.status === 'PENDING_VERIFICATION';
  const pastYears = data?.pastYears ?? [];
  const canDeclare = record.canDeclare && maxNewMinor > 0;

  const startPay = () => {
    const params: PayFlowParams = {
      kind: 'annual',
      targetId: record.id,
      title: t('funding.yearOf', { year: record.contributionYear }),
      instructions: data?.instructions,
      defaultAmountMinor: maxNewMinor,
      maxAmountMinor: maxNewMinor,
      showReference: config.referenceEnabled,
      resubmit: record.status === 'REJECTED',
    };
    navigation.navigate('PayFlow', params);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <DetailHeader title={t('funding.annualTitle')} subtitle={t('funding.yearOf', { year: record.contributionYear })} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 64 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        {error && <Notice tone="error" text={error} />}

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '800', fontSize: 16, color: colors.textSecondary }}>{t('funding.verifiedPaid')}</Text>
            <StatusChip status={record.status} />
          </View>
          <NumberTick value={prog.paid.label} style={{ color: colors.text, fontWeight: '800', fontSize: 30, marginTop: 8 }} />
          <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{t('funding.target')}: {record.amountDue.label}</Text>

          <View style={{ marginTop: 14 }}>
            <ProgressBar percent={prog.percent} color={record.status === 'PAID' ? colors.success : BRAND.violet} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{prog.percent ?? 0}%</Text>
              <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{t('funding.remaining')}: {prog.remaining?.label ?? '0 ETB'}</Text>
            </View>
          </View>

          {pendingMinor > 0 && (
            <View style={{ marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: withAlpha('#F59E0B', 0.12) }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {t('funding.pendingTotal', { defaultValue: 'Awaiting verification' })}: {record.pendingAmount?.label}
              </Text>
              {record.pendingCount > 1 && (
                <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                  {t('funding.pendingCount', { count: record.pendingCount, defaultValue: '{{count}} declarations in review' })}
                </Text>
              )}
            </View>
          )}

          <View style={{ marginTop: 14, padding: 12, backgroundColor: withAlpha(BRAND.violet, 0.1), borderRadius: 12 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{t('funding.dueBy', { date: dateLabel(record.deadline) })}</Text>
          </View>

          {record.deadlinePassed && record.status !== 'PAID' && <Notice tone="warn" text={t('funding.annualLate')} />}
          {record.status === 'REJECTED' && !!record.rejectionReason && (
            <Notice tone="error" text={`${t('funding.rejectedWhy')}: ${record.rejectionReason}`} />
          )}
          {!config.active && <Notice tone="info" text={t('funding.yearInactive')} />}
          {data?.paymentInstructionsMissing && record.status !== 'PAID' && <Notice tone="error" text={t('funding.paymentsMissing')} />}

          {canDeclare && (
            <View style={{ marginTop: 20 }}>
              <PrimaryButton
                label={pending || record.status === 'REJECTED' ? t('funding.resubmit') : t('funding.payNow')}
                onPress={startPay}
              />
            </View>
          )}
          {pending && !canDeclare && (
            <Notice tone="info" text={t('funding.pendingCoversBalance', { defaultValue: 'Your pending declarations already cover the full balance. Wait for verification.' })} />
          )}
        </Card>

        <SectionLabel text={t('funding.history')} color={BRAND.gold} />
        <DeclarationHistory items={history} />

        {pastYears.length > 0 && (
          <>
            <SectionLabel text={t('funding.pastYears')} color={BRAND.magenta} />
            {pastYears.map((y) => (
              <Card key={y.id} style={{ marginBottom: 10, padding: 14, borderRadius: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '800' }}>{t('funding.yearOf', { year: y.contributionYear })}</Text>
                    <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{y.progress.paid.label} / {y.amountDue.label}</Text>
                  </View>
                  <StatusChip status={y.status} />
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}