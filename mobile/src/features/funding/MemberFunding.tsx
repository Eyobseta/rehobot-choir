import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import { MemberCampaign } from '../../services/funding';
import {
  Card, SectionLabel, StatusChip, Pill, useDateLabel, ProgressBar, ErrorState, Notice,
  NumberTick, AccessiblePress,
} from './fundingKit';
import { useMyFundingQuery } from './useMemberFunding';

const AMBER_TEXT = '#B7791F';

export default function MemberFunding() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const dateLabel = useDateLabel();
  const navigation = useNavigation<any>();

  const q = useMyFundingQuery();
  const data = q.data;
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;
  const error = (q.error as { message?: string } | null)?.message ?? null;

  if (firstLoad) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={BRAND.violet} />
      </View>
    );
  }
  if (!data) return <ErrorState message={error ?? 'Error'} onRetry={() => q.refetch()} />;

  const annual = data.annual;
  const campaigns = data.campaigns ?? [];

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 3 }}
      refreshControl={<RefreshControl refreshing={q.isRefetching && !firstLoad} onRefresh={() => q.refetch()} />}
    >
      {showingSavedData && (
        <View style={{ marginBottom: spacing.md }}>
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: withAlpha('#F59E0B', 0.14), borderWidth: 1, borderColor: withAlpha('#F59E0B', 0.4) }}>
            <Ionicons name="cloud-offline" size={13} color="#F59E0B" />
            <Text style={[theme.typography.caption, { color: '#F59E0B', fontWeight: '800' }]}>
              {t('home.showingSavedData', { defaultValue: 'Showing saved data' })}
            </Text>
          </View>
        </View>
      )}
      {error && <Notice tone="error" text={error} />}

      <SectionLabel text={t('funding.annualTitle')} color={BRAND.violet} />
      <AccessiblePress
        onPress={() => navigation.navigate('AnnualDetail')}
        accessibilityLabel={`${t('funding.annualTitle')}. ${annual ? `${t('funding.yearOf', { year: annual.record.contributionYear })}` : ''}`}
        accessibilityHint={t('funding.openDetails', { defaultValue: 'Opens annual contribution details' })}
      >
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <View style={{ padding: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(BRAND.violet, 0.14) }}>
                <Ionicons name="calendar" size={22} color={BRAND.violet} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{t('funding.annualTitle')}</Text>
                <Text style={{ color: colors.textSecondary, marginTop: 2 }} numberOfLines={2}>
                  {annual
                    ? `${t('funding.yearOf', { year: annual.record.contributionYear })} · ${dateLabel(annual.record.deadline)}`
                    : data.notEligible ? t('funding.notEligible') : t('funding.notSetUp')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
            </View>

            {annual && (
              <View style={{ marginTop: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <NumberTick value={annual.record.progress.paid.label} style={{ color: colors.text, fontWeight: '800', fontSize: 28 }} />
                    <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                      {t('funding.target')}: {annual.record.amountDue.label}
                    </Text>
                  </View>
                  <StatusChip status={annual.record.status} />
                </View>
                <View style={{ marginTop: 14 }}>
                  <ProgressBar percent={annual.record.progress.percent} color={annual.record.status === 'PAID' ? colors.success : BRAND.violet} />
                </View>
              </View>
            )}
          </View>

          {annual && !!annual.record.pendingAmount && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: withAlpha('#F59E0B', 0.12) }}>
              <Ionicons name="time" size={16} color={AMBER_TEXT} />
              <Text style={{ color: AMBER_TEXT, fontSize: 13, fontWeight: '700', flex: 1 }}>
                {t('funding.pendingTotal', { defaultValue: 'Awaiting verification' })}: {annual.record.pendingAmount.label}
              </Text>
            </View>
          )}
        </Card>
      </AccessiblePress>

      <SectionLabel text={t('funding.specialDonations')} color={BRAND.magenta} />
      {campaigns.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
          <Ionicons name="gift-outline" size={28} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{t('funding.noCampaigns')}</Text>
        </Card>
      ) : (
        campaigns.map((c) => (
          <CampaignCard
            key={c.id}
            c={c}
            onPress={() => navigation.navigate('CampaignDetail', { id: c.id })}
          />
        ))
      )}
    </ScrollView>
  );
}

function CampaignCard({ c, onPress }: { c: MemberCampaign; onPress: () => void }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors } = theme;
  const dateLabel = useDateLabel();
  const mine = c.my.progress;
  const closed = c.status === 'CLOSED' || c.status === 'CANCELLED';

  return (
    <View style={{ marginBottom: 12 }}>
      <AccessiblePress onPress={onPress} accessibilityLabel={c.title} accessibilityHint={c.description}>
        <Card style={{ padding: 16, opacity: closed ? 0.85 : 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: colors.text, fontSize: 17 }} numberOfLines={2}>{c.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary }}>{dateLabel(c.deadline)}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <StatusChip status={c.my.status} />
              {closed && <Pill text={c.status === 'CANCELLED' ? t('funding.cancelledPill') : t('funding.closedPill')} color={colors.textSecondary} />}
            </View>
          </View>

          {mine.target ? (
            <View style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{mine.paid.label}</Text>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{mine.target.label}</Text>
              </View>
              <ProgressBar percent={mine.percent} color={colors.success} />
            </View>
          ) : mine.paid.minor > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
              <Ionicons name="heart" size={14} color={colors.success} />
              <Text style={{ color: colors.success, fontWeight: '700' }}>
                {t('funding.yourContribution')}: {mine.paid.label}
              </Text>
            </View>
          ) : null}

          {!!c.my.pendingAmount && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: withAlpha('#F59E0B', 0.12) }}>
              <Ionicons name="time" size={14} color={AMBER_TEXT} />
              <Text style={{ color: AMBER_TEXT, fontSize: 12, fontWeight: '700', flex: 1 }}>
                {t('funding.pendingTotal', { defaultValue: 'Awaiting verification' })}: {c.my.pendingAmount.label}
              </Text>
            </View>
          )}
          {c.my.status === 'REJECTED' && !!c.my.rejectionReason && (
            <Text style={{ color: colors.error, marginTop: 10, fontWeight: '600' }} numberOfLines={2}>{c.my.rejectionReason}</Text>
          )}
        </Card>
      </AccessiblePress>
    </View>
  );
}