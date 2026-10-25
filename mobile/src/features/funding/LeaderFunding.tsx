import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, FlatList, Pressable, Alert, ActivityIndicator, RefreshControl, TextInput, Image, ScrollView, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import {
  leaderListRecords, leaderListDonations, approveRecord, rejectRecord, approveDonation, rejectDonation,
  leaderListCampaigns, LeaderCampaign, FundingStatus, LedgerFilter, Declaration,
} from '../../services/funding';
import {
  Card, StatusChip, Pill, useDateLabel, useInstantLabel, errorText, Notice, ErrorState, ReasonModal, ProgressBar,
} from './fundingKit';
import { formatEtb } from '../../utils/money';

const AMBER = '#F59E0B';
const CATEGORIES: LedgerFilter[] = ['PENDING_VERIFICATION', 'PAID', 'UNPAID', 'REJECTED'];

type LedgerItem = {
  id: string; name: string; photoUrl: string | null; role: string; sub?: string | null;
  status: FundingStatus; paidMinor: number; dueMinor: number | null;
  decl: Declaration | null; reason: string | null;
  pendingCount?: number;
  pendingTotalMinor?: number | null;
};

type LedgerPage = {
  items: LedgerItem[]; total: number;
  counts: Partial<Record<FundingStatus, number>>;
  totals?: { received: string; outstanding: string; expected: string } | null;
};

type LedgerLoader = (p: { status: LedgerFilter; q: string; page: number; campaignId?: string; pageSize?: number }) => Promise<LedgerPage>;

// =====================================================================
// Main Screen
// =====================================================================
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
// Top controls (scrolls with the list).
// =====================================================================
function TopControls({ tools, navigation, tab, setTab, header }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: withAlpha(colors.textSecondary, 0.12) }}>
        {(['annual', 'campaigns'] as const).map((k) => {
          const on = tab === k;
          return (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 12, backgroundColor: on ? colors.surface : 'transparent' }}
            >
              <Text style={{ color: on ? BRAND.violet : colors.textSecondary, fontWeight: '800' }}>
                {k === 'annual' ? t('funding.tabAnnual', { defaultValue: 'Annual' }) : t('funding.tabCampaigns', { defaultValue: 'Campaigns' })}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        {tools.map((x: any) => (
          <Pressable
            key={x.go} onPress={() => navigation.navigate(x.go)} accessibilityRole="button" accessibilityLabel={x.label}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 48 }}
          >
            <View style={{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(BRAND.violet, 0.12) }}>
              <Ionicons name={x.icon} size={16} color={BRAND.violet} />
            </View>
            <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>{x.label}</Text>
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
  const load: LedgerLoader = useCallback(async ({ status, q, page, pageSize = 20 }) => {
    const res = await leaderListRecords({ status, q: q || undefined, page, pageSize });
    return {
      total: res.total,
      counts: res.counts,
      totals: res.totals ? { received: res.totals.received.label, outstanding: res.totals.outstanding.label, expected: res.totals.expected.label } : null,
      items: res.items.map((r) => ({
        id: r.id, name: r.participant.fullName, photoUrl: r.participant.photoUrl, role: r.participant.role,
        sub: `${r.contributionYear} E.C.`, status: r.status, paidMinor: r.progress.paid.minor, dueMinor: r.amountDue.minor,
        decl: r.latestDeclaration, reason: r.rejectionReason, pendingCount: r.pendingCount ?? 0, pendingTotalMinor: r.pendingTotal?.minor ?? null,
      })),
    };
  }, []);

  const header = <TopControls tools={tools} navigation={navigation} tab={tab} setTab={setTab} />;

  return (
    <LedgerPanel
      key="annual" // Force remount when switching tabs
      load={load}
      onApprove={approveRecord}
      onReject={rejectRecord}
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

  const [campaigns, setCampaigns] = useState<LeaderCampaign[]>([]);
  const [campaignId, setCampaignId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await leaderListCampaigns();
      setCampaigns(res.items);
      setLoadErr(null);
      setCampaignId((cur) => {
        if (cur && res.items.some((c) => c.id === cur && c.status !== 'DRAFT')) return cur;
        const first = res.items.find((c) => c.status === 'PUBLISHED') ?? res.items.find((c) => c.status !== 'DRAFT');
        return first?.id;
      });
    } catch (e) {
      setLoadErr(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadCampaigns(); }, [loadCampaigns]));

  const load: LedgerLoader = useCallback(async ({ status, q, page, pageSize = 20 }) => {
    if (!campaignId) return { total: 0, counts: {}, items: [] };
    const res = await leaderListDonations({ status, campaignId, q: q || undefined, page, pageSize });
    return {
      total: res.total,
      counts: res.counts ?? {},
      items: (res.items ?? []).map((r) => ({
        id: r.id, name: r.participant.fullName, photoUrl: r.participant.photoUrl, role: 'MEMBER',
        sub: r.campaign.title, status: r.status, paidMinor: r.progress.paid.minor, dueMinor: r.progress.target?.minor ?? null,
        decl: r.latestDeclaration, reason: r.latestDeclaration?.status === 'REJECTED' ? r.latestDeclaration.rejectionReason : null,
        pendingCount: r.pendingCount ?? 0, pendingTotalMinor: r.pendingTotal?.minor ?? null,
      })),
    };
  }, [campaignId]);

  if (loading && campaigns.length === 0) return <ActivityIndicator style={{ marginTop: 40 }} color={BRAND.violet} />;
  if (loadErr && campaigns.length === 0) return <ErrorState message={loadErr} onRetry={loadCampaigns} />;

  const drafts = campaigns.filter((c) => c.status === 'DRAFT');
  const live = campaigns.filter((c) => c.status !== 'DRAFT');
  const current = live.find((c) => c.id === campaignId);

  const innerHeader = (
    <View style={{ marginTop: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{t('funding.selectCampaign')}</Text>
        <Pressable
          onPress={() => navigation.navigate('CreateCampaign')} accessibilityRole="button" hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 12, borderRadius: 999, backgroundColor: withAlpha(BRAND.violet, 0.12) }}
        >
          <Ionicons name="add" size={18} color={BRAND.violet} />
          <Text style={{ color: BRAND.violet, fontWeight: '800' }}>{t('funding.newCampaign')}</Text>
        </Pressable>
      </View>

      {drafts.map((d) => (
        <Pressable key={d.id} onPress={() => navigation.navigate('CampaignDetail', { id: d.id })} accessibilityRole="button">
          <Card style={{ marginBottom: 8, padding: 12, borderRadius: 16, borderStyle: 'dashed' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pill text={t('funding.draft')} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }} numberOfLines={1}>{d.title}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{dateLabel(d.deadline)}</Text>
              </View>
              <Text style={{ color: BRAND.violet, fontWeight: '800' }}>{t('funding.finishDraft')}</Text>
              <Ionicons name="chevron-forward" size={16} color={BRAND.violet} />
            </View>
          </Card>
        </Pressable>
      ))}

      {live.length === 0 ? (
        drafts.length === 0 && (
          <Card><Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{t('funding.noCampaignsYet')}</Text></Card>
        )
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {live.map((c) => {
            const on = campaignId === c.id;
            return (
              <Pressable
                key={c.id} onPress={() => setCampaignId(c.id)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 999, marginRight: 8, backgroundColor: on ? BRAND.violet : colors.surface, borderWidth: 1, borderColor: on ? BRAND.violet : colors.border, minHeight: 44 }}
              >
                <Text style={{ color: on ? '#FFF' : colors.text, fontWeight: '700', fontSize: 13, maxWidth: 160 }} numberOfLines={1}>{c.title}</Text>
                {c.pendingCount > 0 && (
                  <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: AMBER }}>
                    <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>{c.pendingCount}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {current && (
        <Card style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{current.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary }}>{dateLabel(current.deadline)}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              {current.status !== 'PUBLISHED' && (
                <Pill text={current.status === 'CANCELLED' ? t('funding.cancelledPill') : t('funding.closedPill')} color={colors.textSecondary} />
              )}
              <Pressable
                onPress={() => navigation.navigate('CampaignDetail', { id: current.id })} hitSlop={8} accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 36 }}
              >
                <Text style={{ color: BRAND.violet, fontWeight: '800' }}>{t('funding.openCampaign')}</Text>
                <Ionicons name="chevron-forward" size={16} color={BRAND.violet} />
              </Pressable>
            </View>
          </View>
          {current.progress.target && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '700', marginBottom: 6 }}>
                {current.progress.paid.label} / {current.progress.target.label}
              </Text>
              <ProgressBar percent={current.progress.percent} color={colors.success} />
            </View>
          )}
        </Card>
      )}
    </View>
  );

  const header = (
    <TopControls tools={tools} navigation={navigation} tab={tab} setTab={setTab} header={innerHeader} />
  );

  return (
    <LedgerPanel
      key={campaignId ? `campaign_${campaignId}` : 'campaign_none'} // Force remount when switching campaigns
      load={load}
      onApprove={approveDonation}
      onReject={rejectDonation}
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
function LedgerPanel({ load, onApprove, onReject, header, showSub, contextType, contextLabel }: {
  load: LedgerLoader;
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
  const [rows, setRows] = useState<LedgerItem[]>([]);
  const [meta, setMeta] = useState<Omit<LedgerPage, 'items'> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectDeclId, setRejectDeclId] = useState<string | null>(null);

  const [tableVisible, setTableVisible] = useState(false);
  const [tableData, setTableData] = useState<LedgerItem[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableErr, setTableErr] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState<LedgerFilter>('ALL');

  const seq = useRef(0);

  const fetchPage = useCallback(async (p: number, st: LedgerFilter, query: string, replace: boolean) => {
    const my = ++seq.current;
    try {
      const res = await load({ status: st, q: query, page: p });
      if (my !== seq.current) return;
      setMeta({ total: res.total, counts: res.counts, totals: res.totals });
      setPage(p); setError(null);
      setRows((prev) => (replace ? res.items : [...prev, ...res.items.filter((n) => !prev.some((o) => o.id === n.id))]));
    } catch (e) {
      if (my === seq.current) setError(errorText(e));
    } finally {
      if (my === seq.current) { setLoading(false); setRefreshing(false); setMore(false); }
    }
  }, [load]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    void fetchPage(1, status, q, true);
  }, [fetchPage, status, q]));

  const reload = () => {
    setLoading(true);
    void fetchPage(1, status, q, true);
  };

  const act = async (id: string, fn: () => Promise<unknown>) => {
    if (busyId) return;
    setBusyId(id); setActionError(null);
    try { await fn(); } catch (e) { setActionError(errorText(e)); }
    await reload();
    setBusyId(null);
  };

  const loadTable = async () => {
    setTableLoading(true); setTableErr(null);
    try {
      const res = await load({ status: 'ALL', q: '', page: 1, pageSize: 1000 });
      setTableData(res.items);
    } catch (e) {
      setTableErr(errorText(e));
    } finally {
      setTableLoading(false);
    }
  };

  const openTableModal = () => {
    setTableFilter('ALL');
    setTableVisible(true);
    void loadTable();
  };

  const cat = (s: LedgerFilter) => {
    switch (s) {
      case 'PENDING_VERIFICATION': return { label: t('funding.pendingShort', { defaultValue: 'Pending' }), color: AMBER, icon: 'time' as const };
      case 'PAID': return { label: t('funding.statusPaid'), color: colors.success, icon: 'checkmark-circle' as const };
      case 'UNPAID': return { label: t('funding.statusUnpaid'), color: colors.textSecondary, icon: 'ellipse-outline' as const };
      case 'REJECTED': return { label: t('funding.statusRejected'), color: colors.error, icon: 'close-circle' as const };
      default: return { label: t('funding.all', { defaultValue: 'All' }), color: BRAND.violet, icon: 'apps' as const };
    }
  };

  const countOf = (s: LedgerFilter) => (meta?.counts && meta.counts[s as FundingStatus] !== undefined ? meta.counts[s as FundingStatus] ?? 0 : 0);
  const hasMore = meta ? rows.length < meta.total : false;

  const tableCount = (s: LedgerFilter) => (s === 'ALL' ? tableData.length : tableData.filter((r) => r.status === s).length);
  const tableRows = tableFilter === 'ALL' ? tableData : tableData.filter((r) => r.status === tableFilter);

  const listHeader = (
    <View>
      {header}

      {meta?.totals && (
        <Card style={{ marginTop: 16, padding: 0, overflow: 'hidden' }}>
          <View style={{ padding: 16 }}>
            <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>
              {t('funding.received', { defaultValue: 'Received' })}
            </Text>
            <Text style={{ color: colors.success, fontWeight: '800', fontSize: 28, marginTop: 2 }}>{meta.totals.received}</Text>
          </View>
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flex: 1, padding: 14 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>{t('funding.outstanding', { defaultValue: 'Outstanding' })}</Text>
              <Text style={{ color: colors.error, fontWeight: '800', marginTop: 2 }}>{meta.totals.outstanding}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: colors.border }} />
            <View style={{ flex: 1, padding: 14 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>{t('funding.expected', { defaultValue: 'Expected' })}</Text>
              <Text style={{ color: colors.text, fontWeight: '800', marginTop: 2 }}>{meta.totals.expected}</Text>
            </View>
          </View>
          <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: withAlpha(BRAND.violet, 0.06) }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {t('funding.verifiedOnly', { defaultValue: 'Only verified payments count as received.' })}
            </Text>
          </View>
        </Card>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        {CATEGORIES.map((s) => {
          const m = cat(s); const on = s === status;
          return (
            <Pressable
              key={s} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${m.label}, ${countOf(s)}`}
              onPress={() => { setStatus(s); setRows([]); }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderRadius: 16, borderWidth: 1.5, borderColor: on ? m.color : colors.border, backgroundColor: on ? withAlpha(m.color, 0.14) : colors.surface, minHeight: 78 }}
            >
              <Ionicons name={m.icon} size={16} color={m.color} />
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 20, marginTop: 4 }}>{countOf(s)}</Text>
              <Text style={{ color: m.color, fontWeight: '700', fontSize: 11, marginTop: 1 }} numberOfLines={1} adjustsFontSizeToFit>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginTop: 16 }}>
        <Ionicons name="search" size={16} color={colors.textSecondary} />
        <TextInput
          value={qInput} onChangeText={setQInput} onSubmitEditing={() => { setQ(qInput.trim()); }} returnKeyType="search"
          placeholder={t('funding.search', { defaultValue: 'Search member' })} placeholderTextColor={colors.textSecondary} accessibilityLabel={t('funding.search', { defaultValue: 'Search member' })}
          style={{ flex: 1, paddingVertical: 10, color: colors.text, minHeight: 46 }}
        />
      </View>

      <Pressable
        onPress={openTableModal}
        accessibilityRole="button"
        accessibilityLabel={t('funding.viewAllMembers', { defaultValue: 'View all members' })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingHorizontal: 14, minHeight: 48, borderRadius: 14, backgroundColor: withAlpha(BRAND.violet, 0.1) }}
      >
        <Ionicons name="people" size={18} color={BRAND.violet} />
        <Text style={{ flex: 1, color: BRAND.violet, fontWeight: '800' }}>
          {t('funding.viewAllMembers', { defaultValue: 'View all members' })}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={BRAND.violet} />
      </Pressable>

      {actionError && <Notice tone="error" text={actionError} />}

      <View style={{ height: 12 }} />
    </View>
  );

  return (
    <>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 96 }}
        ListHeaderComponent={listHeader}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchPage(1, status, q, true); }} />}
        ListEmptyComponent={
          loading ? <ActivityIndicator style={{ marginTop: 40 }} color={BRAND.violet} />
          : error ? <ErrorState message={error} onRetry={reload} />
          : (
            <View style={{ padding: 28, alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20 }}>
              <Ionicons name="file-tray-outline" size={28} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary }}>{t('funding.nothingHere', { defaultValue: 'No records in this category.' })}</Text>
            </View>
          )
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (hasMore && !more && !loading) { setMore(true); void fetchPage(page + 1, status, q, false); } }}
        ListFooterComponent={more ? <ActivityIndicator style={{ marginVertical: 16 }} color={BRAND.violet} /> : null}
        renderItem={({ item: r }) => {
          const pending = r.status === 'PENDING_VERIFICATION' && (!r.decl || r.decl.status === 'PENDING');
          const busy = busyId === r.id;
          const rail = r.status === 'PAID' ? colors.success : r.status === 'PENDING_VERIFICATION' ? AMBER : r.status === 'REJECTED' ? colors.error : colors.border;
          return (
            <View style={{ flexDirection: 'row', borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ width: 5, backgroundColor: rail }} />
              <View style={{ flex: 1, padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={r.name} uri={r.photoUrl} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>{r.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      {r.role === 'LEADER' && <Pill text={t('funding.leader', { defaultValue: 'Leader' })} color={BRAND.magenta} />}
                      {showSub && !!r.sub && <Text style={{ color: colors.textSecondary, fontSize: 12, flexShrink: 1 }} numberOfLines={1}>{r.sub}</Text>}
                    </View>
                  </View>
                  <StatusChip status={r.status} />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 20 }}>{formatEtb(r.paidMinor)}</Text>
                  {r.dueMinor !== null && <Text style={{ color: colors.textSecondary }}>/ {formatEtb(r.dueMinor)}</Text>}
                </View>

                {r.decl && (r.status === 'PENDING_VERIFICATION' || r.status === 'REJECTED') && (
                  <View style={{ marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: withAlpha(BRAND.violet, 0.08) }}>
                    <Text style={{ color: colors.text, fontWeight: '800' }}>
                      {t('funding.declared', { defaultValue: 'Declared' })} {r.decl.amount.label}
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                        {'  ·  '}{r.decl.paymentMethod === 'BANK' ? t('funding.bank', { defaultValue: 'Bank' }) : r.decl.paymentMethod === 'TELEBIRR' ? 'Telebirr' : '—'}
                      </Text>
                    </Text>
                    {!!r.decl.reference && <Text style={{ color: colors.textSecondary, marginTop: 2 }}>Ref: {r.decl.reference}</Text>}
                    <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{instantLabel(r.decl.declaredAt)}</Text>
                    {(r.pendingCount ?? 0) > 1 && (
                      <Text style={{ color: '#B7791F', marginTop: 4, fontWeight: '800' }}>
                        + {r.pendingCount! - 1} {t('funding.morePending', { defaultValue: 'more pending' })}
                        {r.pendingTotalMinor ? ` (${formatEtb(r.pendingTotalMinor)} total)` : ''}
                      </Text>
                    )}
                  </View>
                )}
                {r.status === 'REJECTED' && !!r.reason && <Text style={{ color: colors.error, marginTop: 8 }}>{r.reason}</Text>}

                {pending && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <Pressable
                      disabled={!!busyId} accessibilityRole="button"
                      onPress={() => Alert.alert(t('funding.approve', { defaultValue: 'Approve' }), t('funding.approveConfirm', { defaultValue: 'Confirm you have seen this money in the official account.' }), [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('funding.approve', { defaultValue: 'Approve' }), onPress: () => act(r.id, () => onApprove(r.id, r.decl?.id)) },
                      ])}
                      style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.success, opacity: busyId ? 0.5 : 1, minHeight: 44 }}
                    >
                      {busy ? <ActivityIndicator color="#FFF" /> : (
                        <>
                          <Ionicons name="checkmark" size={16} color="#FFF" />
                          <Text style={{ color: '#FFF', fontWeight: '800' }}>{t('funding.approve', { defaultValue: 'Approve' })}</Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      disabled={!!busyId} accessibilityRole="button" onPress={() => { setRejectId(r.id); setRejectDeclId(r.decl?.id ?? null); }}
                      style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: colors.error, opacity: busyId ? 0.5 : 1, minHeight: 44 }}
                    >
                      <Ionicons name="close" size={16} color={colors.error} />
                      <Text style={{ color: colors.error, fontWeight: '800' }}>{t('funding.reject', { defaultValue: 'Reject' })}</Text>
                    </Pressable>
                    <Pressable
                      onPress={openTableModal} accessibilityRole="button"
                      accessibilityLabel={t('funding.viewAllMembers', { defaultValue: 'View all members' })}
                      style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: withAlpha(BRAND.violet, 0.12), minHeight: 44 }}
                    >
                      <Ionicons name="people" size={16} color={BRAND.violet} />
                      <Text style={{ color: BRAND.violet, fontWeight: '800' }} numberOfLines={1}>{t('funding.members', { defaultValue: 'Members' })}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />

      <ReasonModal
        visible={!!rejectId}
        title={t('funding.reject', { defaultValue: 'Reject' })}
        message={t('funding.rejectHint', { defaultValue: 'The member will see this reason and can resubmit.' })}
        confirmLabel={t('funding.reject', { defaultValue: 'Reject' })}
        onClose={() => { setRejectId(null); setRejectDeclId(null); }}
        onSubmit={async (reason: string) => {
          const id = rejectId!;
          const decl = rejectDeclId ?? undefined;
          try { await onReject(id, reason, decl); } catch (e) { await reload(); throw e; }
          await reload();
        }}
      />

      <Modal visible={tableVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTableVisible(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: Math.max(insets.top, 16), paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                {t('funding.allMembersStatus', { defaultValue: 'All members' })}
              </Text>
              {!!contextLabel && <Text style={{ color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{contextLabel}</Text>}
            </View>
            <Pressable
              onPress={() => setTableVisible(false)} accessibilityRole="button" accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: withAlpha(colors.text, 0.08) }}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          {tableLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={BRAND.violet} />
          ) : tableErr ? (
            <ErrorState message={tableErr} onRetry={loadTable} />
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 6, padding: 16, paddingBottom: 8 }}>
                {(['ALL', ...CATEGORIES] as LedgerFilter[]).map((s) => {
                  const m = cat(s); const on = tableFilter === s;
                  return (
                    <Pressable
                      key={s} onPress={() => setTableFilter(s)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                      style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: on ? m.color : colors.border, backgroundColor: on ? withAlpha(m.color, 0.14) : colors.surface }}
                    >
                      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{tableCount(s)}</Text>
                      <Text style={{ color: m.color, fontWeight: '700', fontSize: 10 }} numberOfLines={1} adjustsFontSizeToFit>{m.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <FlatList
                data={tableRows}
                keyExtractor={(r) => r.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 24 }}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                ListEmptyComponent={
                  <Text style={{ padding: 24, textAlign: 'center', color: colors.textSecondary }}>
                    {t('funding.noMembers', { defaultValue: 'No members found.' })}
                  </Text>
                }
                renderItem={({ item: r }) => (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                    <Avatar name={r.name} uri={r.photoUrl} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>{r.name}</Text>
                      <Text style={{ color: colors.textSecondary, marginTop: 2, fontSize: 13 }} numberOfLines={1}>
                        <Text style={{ color: colors.text, fontWeight: '700' }}>{formatEtb(r.paidMinor)}</Text>
                        {r.dueMinor !== null ? `  /  ${formatEtb(r.dueMinor)}` : ''}
                      </Text>
                      {(r.pendingCount ?? 0) > 0 && (
                        <Text style={{ color: '#B7791F', fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                          {r.pendingCount} {t('funding.pendingLower', { defaultValue: 'pending' })}
                        </Text>
                      )}
                    </View>
                    <View style={{ alignSelf: 'center' }}><StatusChip status={r.status} /></View>
                  </View>
                )}
              />
            </>
          )}
        </View>
      </Modal>
    </>
  );
}

function Avatar({ name, uri }: { name: string; uri: string | null }) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }} onError={() => setFailed(true)}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.border }}
      />
    );
  }
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(BRAND.violet, 0.18) }}>
      <Text style={{ color: BRAND.violet, fontWeight: '800', fontSize: 16 }}>{(name || '?').trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}