import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { brand } from '../../theme/colors';
import { MemberCampaign } from '../../services/funding';
import { IconTile } from '../profile/SettingsKit';
import {
  Card, SectionLabel, StatusChip, Pill, useDateLabel, ProgressBar, ErrorState, Notice,
  NumberTick, AccessiblePress, HeroCard, PendingStrip, EmptyState, LoadingState, SavedDataPill,
  FadeUp, ONDARK, statusTone,
} from './fundingKit';
import { useMyFundingQuery } from './useMemberFunding';

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

  if (firstLoad) return <LoadingState />;
  if (!data) return <ErrorState message={error ?? 'Error'} onRetry={() => q.refetch()} />;

  const annual = data.annual;
  const campaigns = data.campaigns ?? [];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 3 }}
      refreshControl={<RefreshControl refreshing={q.isRefetching && !firstLoad} onRefresh={() => q.refetch()} />}
    >
      {showingSavedData && (
        <View style={{ marginBottom: spacing.md }}>
          <SavedDataPill />
        </View>
      )}
      {error && <Notice tone="error" text={error} />}

      <FadeUp index={0}>
        <SectionLabel icon="calendar" text={t('funding.annualTitle')} color={colors.accent} />
        <AccessiblePress
          onPress={() => navigation.navigate('AnnualDetail')}
          accessibilityLabel={`${t('funding.annualTitle')}. ${annual ? `${t('funding.yearOf', { year: annual.record.contributionYear })}` : ''}`}
          accessibilityHint={t('funding.openDetails', { defaultValue: 'Opens annual contribution details' })}
        >
          <HeroCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.lime }}>
                <Ionicons name="calendar" size={22} color={brand.teal} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>{t('funding.annualTitle')}</Text>
                <Text style={{ color: ONDARK.textMuted, marginTop: 2 }} numberOfLines={2}>
                  {annual
                    ? `${t('funding.yearOf', { year: annual.record.contributionYear })} · ${dateLabel(annual.record.deadline)}`
                    : data.notEligible ? t('funding.notEligible') : t('funding.notSetUp')}
                </Text>
              </View>
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: ONDARK.chipBg }}>
                <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
              </View>
            </View>

            {annual && (
              <View style={{ marginTop: 22 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <NumberTick value={annual.record.progress.paid.label} style={{ color: brand.lime, fontWeight: '800', fontSize: 32 }} />
                    <Text style={{ color: ONDARK.textMuted, marginTop: 2 }}>
                      {t('funding.target')}: {annual.record.amountDue.label}
                    </Text>
                  </View>
                  <StatusChip status={annual.record.status} onDark />
                </View>
                <View style={{ marginTop: 16 }}>
                  <ProgressBar
                    percent={annual.record.progress.percent}
                    color={annual.record.status === 'PAID' ? brand.mint : brand.lime}
                    trackColor={ONDARK.track}
                  />
                </View>
              </View>
            )}

            {annual && !!annual.record.pendingAmount && (
              <PendingStrip
                onDark
                style={{ marginTop: 16 }}
                text={`${t('funding.pendingTotal', { defaultValue: 'Awaiting verification' })}: ${annual.record.pendingAmount.label}`}
              />
            )}
          </HeroCard>
        </AccessiblePress>
      </FadeUp>

      <FadeUp index={1}>
        <SectionLabel icon="gift" text={t('funding.specialDonations')} color={colors.accent} />
        {campaigns.length === 0 ? (
          <EmptyState icon="gift-outline" text={t('funding.noCampaigns')} />
        ) : (
          campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              c={c}
              onPress={() => navigation.navigate('CampaignDetail', { id: c.id })}
            />
          ))
        )}
      </FadeUp>
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
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <IconTile name="gift-outline" tone={statusTone(c.my.status)} size={46} iconSize={22} radius={15} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: colors.text, fontSize: 17 }} numberOfLines={2}>{c.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
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
            <View style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{mine.paid.label}</Text>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{mine.target.label}</Text>
              </View>
              <ProgressBar percent={mine.percent} color={colors.success} />
            </View>
          ) : mine.paid.minor > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
              <Ionicons name="heart" size={14} color={colors.success} />
              <Text style={{ color: colors.success, fontWeight: '700' }}>
                {t('funding.yourContribution')}: {mine.paid.label}
              </Text>
            </View>
          ) : null}

          {!!c.my.pendingAmount && (
            <PendingStrip
              style={{ marginTop: 12 }}
              text={`${t('funding.pendingTotal', { defaultValue: 'Awaiting verification' })}: ${c.my.pendingAmount.label}`}
            />
          )}
          {c.my.status === 'REJECTED' && !!c.my.rejectionReason && (
            <Text style={{ color: colors.error, marginTop: 10, fontWeight: '600' }} numberOfLines={2}>{c.my.rejectionReason}</Text>
          )}
        </Card>
      </AccessiblePress>
    </View>
  );
}