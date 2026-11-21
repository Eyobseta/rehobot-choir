import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, Pressable, Alert, ActivityIndicator, RefreshControl, TextInput, Image, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { brand } from '../../theme/colors';
import { withAlpha } from '../auth/Auth_UI';
import { IconTile } from '../profile/SettingsKit';
import {
  FundingStatus, LedgerFilter, Declaration,
} from '../../services/funding';
import {
  Card, StatusChip, Pill, useDateLabel, useInstantLabel, errorText, Notice, ErrorState, ReasonModal, ProgressBar,
  SegmentedControl, ActionBtn, HeroCard, StatCell, EmptyState, LoadingInline, ONDARK,
} from './fundingKit';
import { formatEtb } from '../../utils/money';
import {
  useLeaderRecordsQuery,
  useLeaderDonationsQuery,
  useLeaderCampaignsQuery,
  useLeaderCampaignMutation,
  useApproveRecordMutation,
  useRejectRecordMutation,
  useApproveDonationMutation,
  useRejectDonationMutation,
} from './useLeaderFunding';

const CATEGORIES: LedgerFilter[] = ['PENDING_VERIFICATION', 'PAID', 'UNPAID', 'REJECTED'];

type LedgerItem = {
  id: string; name: string; photoUrl: string | null; role: string; sub?: string | null;
  status: FundingStatus; paidMinor: number; dueMinor: number | null;
  decl: Declaration | null; reason: string | null;
  pendingCount?: number;
  pendingTotalMinor?: number | null;
};

export default function LeaderFunding() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<'annual' | 'campaigns'>('annual');

  const tools = [
    { icon: 'settings-outline' as const, label: t('funding.annualConfig', { defaultValue: 'Annual setup' }), go: 'AdminFundingSetup' },
    { icon: 'card-outline' as const, label: t('funding.manageInstructions', { defaultValue: 'Payment details' }), go: 'ManageInstructions' },
  ];

  return (
    <View style={{ flex: 1 }}>
      {tab === 'annual' ? (
        <AnnualPanel tools={tools} navigation={navigation} tab={tab} setTab={setTab} />
      ) : (
        <CampaignsPanel tools={tools} navigation={navigation} tab={tab} setTab={setTab} />
      )}
    </View>
  );
}

// =====================================================================
// Top Controls
// =====================================================================

function TopControls({ tools, navigation, tab, setTab, header }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <View style={{ marginBottom: 12 }}>
      <SegmentedControl
        value={tab as 'annual' | 'campaigns'}
        onChange={setTab}
        options={[
          { key: 'annual', label: t('funding.tabAnnual', { defaultValue: 'Annual' }), icon: 'calendar-outline' },
          { key: 'campaigns', label: t('funding.tabCampaigns', { defaultValue: 'Campaigns' }), icon: 'gift-outline' },
        ]}
      />

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        {tools.map((x: any, i: number) => (
          <Pressable key={x.go} onPress={() => navigation.navigate(x.go)} accessibilityRole="button" accessibilityLabel={x.label}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 54 }}>
            <IconTile name={x.icon} tone={i === 0 ? 'lavender' : 'mint'} size={34} iconSize={17} radius={11} />
            <Text style={{ color: colors.text, fontWeight: '700', flex: 1, fontSize: 13 }} numberOfLines={1}>{x.label}</Text>
          </Pressable>
        ))}
      </View>
      {header}
    </View>
  );
}

// =====================================================================
// Annual Panel
// =====================================================================

function AnnualPanel({ tools, navigation, tab, setTab }: any) {
  const { t } = useTranslation();
  const header = <TopControls tools={tools} navigation={navigation} tab={tab} setTab={setTab} />;

  const approveRecordMut = useApproveRecordMutation();
  const rejectRecordMut = useRejectRecordMutation();

  return (
    <LedgerPanel
      key="annual"
      mode="annual"
      onApprove={(id, declId) => approveRecordMut.mutateAsync({ id, declId })}
      onReject={(id, reason, declId) => rejectRecordMut.mutateAsync({ id, reason, declId })}
      contextType="annual"
      contextLabel={t('funding.annualTitle', { defaultValue: 'Annual contribution' })}
      header={header}
      showSub
    />
  );
}

// =====================================================================
// Campaigns Panel
// =====================================================================

function CampaignsPanel({ tools, navigation, tab, setTab }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors } = theme;
  const dateLabel = useDateLabel();

  const campQ = useLeaderCampaignsQuery();
  const campaigns = campQ.data?.items ?? [];
  const [campaignId, setCampaignId] = useState<string | undefined>(undefined);

  // Set default campaign if none selected
  useMemo(() => {
    if (campaigns.length > 0 && !campaignId) {
      const first = campaigns.find((c) => c.status === 'PUBLISHED') ?? campaigns.find((c) => c.status !== 'DRAFT');
      if (first) setCampaignId(first.id);
    }
  }, [campaigns, campaignId]);

  const approveDonationMut = useApproveDonationMutation();
  const rejectDonationMut = useRejectDonationMutation();

  if (campQ.isPending && campQ.data === undefined) return <LoadingInline />;
  if (campQ.isError && campQ.data === undefined) return <ErrorState message={errorText(campQ.error)} onRetry={() => campQ.refetch()} />;

  const drafts = campaigns.filter((c) => c.status === 'DRAFT');
  const live = campaigns.filter((c) => c.status !== 'DRAFT');
  const current = live.find((c) => c.id === campaignId);

  const innerHeader = (
    <View style={{ marginTop: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{t('funding.selectCampaign')}</Text>
        <Pressable onPress={() => navigation.navigate('CreateCampaign')} accessibilityRole="button" hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.primary }}>
          <Ionicons name="add" size={18} color={colors.primaryText} />
          <Text style={{ color: colors.primaryText, fontWeight: '800' }}>{t('funding.newCampaign')}</Text>
        </Pressable>
      </View>

      {drafts.map((d) => (
        <Pressable key={d.id} onPress={() => navigation.navigate('CampaignDetail', { id: d.id })} accessibilityRole="button">
          <Card style={{ marginBottom: 8, padding: 12, borderRadius: 20, borderStyle: 'dashed' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <IconTile name="create-outline" tone="lavender" size={40} iconSize={20} radius={13} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }} numberOfLines={1}>{d.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <Pill text={t('funding.draft')} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{dateLabel(d.deadline)}</Text>
                </View>
              </View>
              <Text style={{ color: colors.accent, fontWeight: '800' }}>{t('funding.finishDraft')}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.accent} />
            </View>
          </Card>
        </Pressable>
      ))}

      {live.length === 0 ? (
        drafts.length === 0 && (
          <EmptyState icon="gift-outline" text={t('funding.noCampaignsYet')} />
        )
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {live.map((c) => {
            const on = campaignId === c.id;
            return (
              <Pressable key={c.id} onPress={() => setCampaignId(c.id)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 999, marginRight: 8, backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.border, minHeight: 44 }}>
                <Text style={{ color: on ? colors.primaryText : colors.text, fontWeight: '700', fontSize: 13, maxWidth: 160 }} numberOfLines={1}>{c.title}</Text>
                {c.pendingCount > 0 && (
                  <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warning }}>
                    <Text style={{ color: colors.textInverse, fontSize: 11, fontWeight: '800' }}>{c.pendingCount}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {current && (
        <HeroCard style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 18 }}>{current.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
                <Ionicons name="calendar-outline" size={14} color={ONDARK.textMuted} />
                <Text style={{ color: ONDARK.textMuted }}>{dateLabel(current.deadline)}</Text>
              </View>
            </View>
            {current.status !== 'PUBLISHED' && (
              <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: ONDARK.chipBg }}>
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
                  {current.status === 'CANCELLED' ? t('funding.cancelledPill') : t('funding.closedPill')}
                </Text>
              </View>
            )}
          </View>
          {current.progress.target && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: brand.lime, fontWeight: '800', fontSize: 20, marginBottom: 2 }}>
                {current.progress.paid.label}
                <Text style={{ color: ONDARK.textMuted, fontWeight: '600', fontSize: 14 }}>  / {current.progress.target.label}</Text>
              </Text>
              <View style={{ marginTop: 8 }}>
                <ProgressBar percent={current.progress.percent} color={brand.lime} trackColor={ONDARK.track} />
              </View>
            </View>
          )}
          <Pressable onPress={() => navigation.navigate('CampaignDetail', { id: current.id })} hitSlop={8} accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, minHeight: 40, marginTop: 10 }}>
            <Text style={{ color: brand.lime, fontWeight: '800' }}>{t('funding.openCampaign')}</Text>
            <Ionicons name="arrow-forward" size={16} color={brand.lime} />
          </Pressable>
        </HeroCard>
      )}
    </View>
  );

  const header = <TopControls tools={tools} navigation={navigation} tab={tab} setTab={setTab} header={innerHeader} />;

  return (
    <LedgerPanel
      key={campaignId ? `campaign_${campaignId}` : 'campaign_none'}
      mode="campaign"
      campaignId={campaignId}
      onApprove={(id, declId) => approveDonationMut.mutateAsync({ id, declId })}
      onReject={(id, reason, declId) => rejectDonationMut.mutateAsync({ id, reason, declId })}
      header={header}
      contextType="campaign"
      contextLabel={current?.title}
      showSub
    />
  );
}

// =====================================================================
// Shared Ledger Component
// =====================================================================

function LedgerPanel({ mode, campaignId, onApprove, onReject, header, showSub, contextType, contextLabel }: {
  mode: 'annual' | 'campaign';
  campaignId?: string;
  onApprove: (id: string, declarationId?: string) => Promise<unknown>;
  onReject: (id: string, reason: string, declarationId?: string) => Promise<unknown>;
  header?: React.ReactNode;
  showSub?: boolean;
  contextType: 'annual' | 'campaign';
  contextLabel?: string;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const instantLabel = useInstantLabel();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<LedgerFilter>('PENDING_VERIFICATION');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');

  // Pagination is handled by useQuery, but we need state for page
  const [page, setPage] = useState(1);

  const annualQ = useLeaderRecordsQuery({ status, q, page, pageSize: 20 });
  const donationQ = useLeaderDonationsQuery({ status, campaignId, q, page, pageSize: 20 });

  const activeQ = mode === 'annual' ? annualQ : donationQ;
  const meta = activeQ.data;
  const loading = activeQ.isPending && activeQ.data === undefined;
  const refreshing = activeQ.isRefetching && !loading;
  const error = activeQ.isError ? errorText(activeQ.error) : null;

  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectDeclId, setRejectDeclId] = useState<string | null>(null);

  const [tableVisible, setTableVisible] = useState(false);
  const [tableFilter, setTableFilter] = useState<LedgerFilter>('ALL');

  // Map API data to the flat structure the UI expects
  const rows: LedgerItem[] = useMemo(() => {
    if (!meta) return [];
    if (mode === 'annual') {
      const list = (meta as any).items as any[];
      return list.map((r) => ({
        id: r.id, name: r.participant.fullName, photoUrl: r.participant.photoUrl, role: r.participant.role,
        sub: `${r.contributionYear} E.C.`, status: r.status, paidMinor: r.progress.paid.minor, dueMinor: r.amountDue.minor,
        decl: r.latestDeclaration, reason: r.rejectionReason, pendingCount: r.pendingCount ?? 0, pendingTotalMinor: r.pendingTotal?.minor ?? null,
      }));
    } else {
      const list = (meta as any).items as any[];
      return list.map((r) => ({
        id: r.id, name: r.participant.fullName, photoUrl: r.participant.photoUrl, role: 'MEMBER',
        sub: r.campaign.title, status: r.status, paidMinor: r.progress.paid.minor, dueMinor: r.progress.target?.minor ?? null,
        decl: r.latestDeclaration, reason: r.latestDeclaration?.status === 'REJECTED' ? r.latestDeclaration.rejectionReason : null,
        pendingCount: r.pendingCount ?? 0, pendingTotalMinor: r.pendingTotal?.minor ?? null,
      }));
    }
  }, [meta, mode]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    if (busyId) return;
    setBusyId(id); setActionError(null);
    try { await fn(); } catch (e) { setActionError(errorText(e)); }
    setBusyId(null);
  };

  const cat = (s: LedgerFilter) => {
    switch (s) {
      case 'PENDING_VERIFICATION': return { label: t('funding.pendingShort', { defaultValue: 'Pending' }), color: colors.warning, icon: 'time' as const };
      case 'PAID': return { label: t('funding.statusPaid'), color: colors.success, icon: 'checkmark-circle' as const };
      case 'UNPAID': return { label: t('funding.statusUnpaid'), color: colors.textSecondary, icon: 'ellipse-outline' as const };
      case 'REJECTED': return { label: t('funding.statusRejected'), color: colors.error, icon: 'close-circle' as const };
      default: return { label: t('funding.all', { defaultValue: 'All' }), color: colors.accent, icon: 'apps' as const };
    }
  };

  const countOf = (s: LedgerFilter) => (meta?.counts && (meta.counts as any)[s] !== undefined ? (meta.counts as any)[s] ?? 0 : 0);

  const listHeader = (
    <View>
      {header}
      {mode === 'annual' && (meta as any)?.totals && (
        <HeroCard style={{ marginTop: 16, padding: 0 }}>
          <View style={{ padding: 18 }}>
            <Text style={{ color: ONDARK.textMuted, fontWeight: '700' }}>{t('funding.received', { defaultValue: 'Received' })}</Text>
            <Text style={{ color: brand.lime, fontWeight: '800', fontSize: 34, marginTop: 2 }}>{(meta as any).totals.received.label}</Text>
          </View>
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: ONDARK.chipBg }}>
            <View style={{ flex: 1, padding: 14 }}>
              <Text style={{ color: ONDARK.textMuted, fontSize: 12, fontWeight: '700' }}>{t('funding.outstanding', { defaultValue: 'Outstanding' })}</Text>
              <Text style={{ color: ONDARK.rejected, fontWeight: '800', marginTop: 3 }}>{(meta as any).totals.outstanding.label}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: ONDARK.chipBg }} />
            <View style={{ flex: 1, padding: 14 }}>
              <Text style={{ color: ONDARK.textMuted, fontSize: 12, fontWeight: '700' }}>{t('funding.expected', { defaultValue: 'Expected' })}</Text>
              <Text style={{ color: '#FFFFFF', fontWeight: '800', marginTop: 3 }}>{(meta as any).totals.expected.label}</Text>
            </View>
          </View>
        </HeroCard>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        {CATEGORIES.map((s) => {
          const m = cat(s); const on = s === status;
          return (
            <Pressable key={s} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { setStatus(s); setPage(1); }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderRadius: 20, borderWidth: 1.5, borderColor: on ? m.color : colors.border, backgroundColor: on ? withAlpha(m.color, 0.14) : colors.surface, minHeight: 82 }}>
              <Ionicons name={m.icon} size={16} color={m.color} />
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 20, marginTop: 4 }}>{countOf(s)}</Text>
              <Text style={{ color: m.color, fontWeight: '700', fontSize: 11, marginTop: 1 }} numberOfLines={1} adjustsFontSizeToFit>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginTop: 16 }}>
        <Ionicons name="search" size={16} color={colors.textSecondary} />
        <TextInput value={qInput} onChangeText={setQInput} onSubmitEditing={() => { setQ(qInput.trim()); setPage(1); }} returnKeyType="search" placeholder={t('funding.search')} placeholderTextColor={colors.textSecondary}
          style={{ flex: 1, paddingVertical: 10, color: colors.text, minHeight: 48 }} />
      </View>

      {actionError && <Notice tone="error" text={actionError} />}
      <View style={{ height: 12 }} />
    </View>
  );

  return (
    <>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 96 }}
        ListHeaderComponent={listHeader}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => activeQ.refetch()} />}
        ListEmptyComponent={
          loading ? <LoadingInline />
          : error ? <ErrorState message={error} onRetry={() => activeQ.refetch()} />
          : <EmptyState icon="file-tray-outline" text={t('funding.nothingHere')} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (meta && rows.length < meta.total && !activeQ.isFetching) {
            setPage((p) => p + 1);
          }
        }}
        ListFooterComponent={activeQ.isFetching && !loading ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} /> : null}
        renderItem={({ item: r }) => {
          const pending = r.status === 'PENDING_VERIFICATION' && (!r.decl || r.decl.status === 'PENDING');
          const busy = busyId === r.id;
          const rail = r.status === 'PAID' ? colors.success : r.status === 'PENDING_VERIFICATION' ? colors.warning : r.status === 'REJECTED' ? colors.error : colors.border;
          return (
            <View style={{ flexDirection: 'row', borderRadius: 24, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ width: 6, backgroundColor: rail }} />
              <View style={{ flex: 1, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={r.name} uri={r.photoUrl} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>{r.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      {r.role === 'LEADER' && <Pill text={t('funding.leader')} color={colors.accent} />}
                      {showSub && !!r.sub && <Text style={{ color: colors.textSecondary, fontSize: 12, flexShrink: 1 }} numberOfLines={1}>{r.sub}</Text>}
                    </View>
                  </View>
                  <StatusChip status={r.status} />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 22 }}>{formatEtb(r.paidMinor)}</Text>
                  {r.dueMinor !== null && <Text style={{ color: colors.textSecondary }}>/ {formatEtb(r.dueMinor)}</Text>}
                </View>

                {r.decl && (r.status === 'PENDING_VERIFICATION' || r.status === 'REJECTED') && (
                  <View style={{ marginTop: 10, padding: 12, borderRadius: 16, backgroundColor: colors.surfaceAlt }}>
                    <Text style={{ color: colors.text, fontWeight: '800' }}>
                      {t('funding.declared')} {r.decl.amount.label}
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                        {'  ·  '}{r.decl.paymentMethod === 'BANK' ? t('funding.bank') : r.decl.paymentMethod === 'TELEBIRR' ? 'Telebirr' : '—'}
                      </Text>
                    </Text>
                    {!!r.decl.reference && <Text style={{ color: colors.textSecondary, marginTop: 2 }}>Ref: {r.decl.reference}</Text>}
                    <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{instantLabel(r.decl.declaredAt)}</Text>
                  </View>
                )}

                {pending && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <ActionBtn
                      style={{ flex: 1 }}
                      variant="success"
                      icon="checkmark"
                      compact
                      label={t('funding.approve')}
                      disabled={!!busyId}
                      busy={busy}
                      onPress={() => Alert.alert(t('funding.approve'), t('funding.approveConfirm'), [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('funding.approve'), onPress: () => act(r.id, () => onApprove(r.id, r.decl?.id)) },
                      ])}
                    />
                    <ActionBtn
                      style={{ flex: 1 }}
                      variant="dangerSoft"
                      icon="close"
                      compact
                      label={t('funding.reject')}
                      disabled={!!busyId}
                      onPress={() => { setRejectId(r.id); setRejectDeclId(r.decl?.id ?? null); }}
                    />
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />

      <ReasonModal
        visible={!!rejectId}
        title={t('funding.reject')}
        message={t('funding.rejectHint')}
        confirmLabel={t('funding.reject')}
        onClose={() => { setRejectId(null); setRejectDeclId(null); }}
        onSubmit={async (reason: string) => {
          const id = rejectId!;
          const decl = rejectDeclId ?? undefined;
          try { await onReject(id, reason, decl); } catch (e) { throw e; }
        }}
      />
    </>
  );
}

function Avatar({ name, uri }: { name: string; uri: string | null }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: withAlpha(colors.accent, 0.5), backgroundColor: colors.border }} />;
  }
  return (
    <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(colors.accent, 0.18), borderWidth: 2, borderColor: withAlpha(colors.accent, 0.35) }}>
      <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 17 }}>{(name || '?').trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}