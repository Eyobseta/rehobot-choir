import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { brand } from '../../theme/colors';
import { PrimaryButton } from '../auth/Auth_UI';
import { IconTile } from '../profile/SettingsKit';
import {
  Card, StatusChip, useDateLabel, SectionLabel, DetailHeader, ProgressBar, Notice,
  ErrorState, DeclarationHistory, NumberTick, HeroCard, PendingStrip, LoadingState, FadeUp, ONDARK, statusTone,
} from './fundingKit';
import type { PayFlowParams } from './Payflowscreen';
import { useMyFundingQuery } from './useMemberFunding';

export default function AnnualDetailScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const navigation = useNavigation<any>();
  const dateLabel = useDateLabel();

  const q = useMyFundingQuery();
  const data = q.data;
  const firstLoad = q.isPending && q.data === undefined;
  const error = (q.error as { message?: string } | null)?.message ?? null;

  if (firstLoad) return <LoadingState />;
  if (!data && error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <DetailHeader title={t('funding.annualTitle')} onBack={() => navigation.goBack()} />
        <ErrorState message={error} onRetry={() => q.refetch()} />
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 64 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching && !firstLoad} onRefresh={() => q.refetch()} />}
      >
        {error && <Notice tone="error" text={error} />}

        <FadeUp index={0} style={{ marginTop: 6 }}>
          <HeroCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '800', fontSize: 14, color: ONDARK.textMuted }}>{t('funding.verifiedPaid')}</Text>
              <StatusChip status={record.status} onDark />
            </View>
            <NumberTick value={prog.paid.label} style={{ color: brand.lime, fontWeight: '800', fontSize: 38, marginTop: 8 }} />
            <Text style={{ color: ONDARK.textMuted, marginTop: 2 }}>{t('funding.target')}: {record.amountDue.label}</Text>

            <View style={{ marginTop: 18 }}>
              <ProgressBar percent={prog.percent} color={record.status === 'PAID' ? brand.mint : brand.lime} trackColor={ONDARK.track} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{prog.percent ?? 0}%</Text>
                <Text style={{ color: ONDARK.textMuted, fontWeight: '700' }}>{t('funding.remaining')}: {prog.remaining?.label ?? '0 ETB'}</Text>
              </View>
            </View>

            {pendingMinor > 0 && (
              <PendingStrip
                onDark
                style={{ marginTop: 16 }}
                text={`${t('funding.pendingTotal', { defaultValue: 'Awaiting verification' })}: ${record.pendingAmount?.label}`}
                sub={record.pendingCount > 1
                  ? t('funding.pendingCount', { count: record.pendingCount, defaultValue: '{{count}} declarations in review' })
                  : undefined}
              />
            )}
          </HeroCard>
        </FadeUp>

        <FadeUp index={1}>
          <Card style={{ marginTop: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconTile name="calendar-outline" tone="lavender" size={44} iconSize={22} radius={14} />
            <Text style={{ flex: 1, color: colors.text, fontWeight: '800', fontSize: 15 }}>{t('funding.dueBy', { date: dateLabel(record.deadline) })}</Text>
          </Card>

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
        </FadeUp>

        <FadeUp index={2}>
          <SectionLabel icon="receipt" text={t('funding.history')} color={colors.accent} />
          <DeclarationHistory items={history} />
        </FadeUp>

        {pastYears.length > 0 && (
          <FadeUp index={3}>
            <SectionLabel icon="time" text={t('funding.pastYears')} color={colors.accent} />
            {pastYears.map((y) => (
              <Card key={y.id} style={{ marginBottom: 10, padding: 14, borderRadius: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <IconTile name="calendar-outline" tone={statusTone(y.status)} size={42} iconSize={21} radius={14} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '800' }}>{t('funding.yearOf', { year: y.contributionYear })}</Text>
                    <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{y.progress.paid.label} / {y.amountDue.label}</Text>
                  </View>
                  <StatusChip status={y.status} />
                </View>
              </Card>
            ))}
          </FadeUp>
        )}
      </ScrollView>
    </View>
  );
}