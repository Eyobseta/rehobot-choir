import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { PrimaryButton, BRAND, withAlpha } from '../auth/Auth_UI';
import {
  getCampaignDetail, CampaignDetail, leaderCloseCampaign, leaderCancelCampaign, leaderPublishCampaign,
  approveDonation, rejectDonation,
} from '../../services/funding';
import {
  Card, StatusChip, useDateLabel, useInstantLabel, errorText, SectionLabel, DetailHeader, ProgressBar, Notice,
  ErrorState, DeclarationHistory, ReasonModal, Pill, NumberTick,
} from './fundingKit';
import { getRole } from '../../services/role';
import type { PayFlowParams } from './Payflowscreen';

export default function CampaignDetailScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const dateLabel = useDateLabel();
  const instantLabel = useInstantLabel();

  const [c, setC] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectDeclId, setRejectDeclId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setError(null); setC((await getCampaignDetail(route.params.id)).item); }
    catch (e) { setError(errorText(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [route.params.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={BRAND.violet} /></View>;
  }
  if (error && !c) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <DetailHeader title="" onBack={() => navigation.goBack()} />
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }
  if (!c) return null;

  const isLeader = getRole() === 'LEADER' && !!c.leader;
  const my = c.my;
  const mine = my.progress;
  const pendingMinor = my.pendingAmount?.minor ?? 0;

  const maxNewMinor = c.donationType === 'REQUIRED'
    ? Math.max(0, (mine.remaining?.minor ?? 0) - pendingMinor)
    : undefined;

  // total campaign progress might be null (voluntary with no target)
  const total = c.campaignProgress.target ? c.campaignProgress : null;

  const draft = c.status === 'DRAFT';
  const published = c.status === 'PUBLISHED';
  const pending = my.status === 'PENDING_VERIFICATION';

  const startPay = () => {
    const params: PayFlowParams = {
      kind: 'campaign',
      targetId: c.id,
      title: c.title,
      instructions: c.instructions,
      defaultAmountMinor: maxNewMinor || c.requestedAmount?.minor,
      maxAmountMinor: c.donationType === 'REQUIRED' ? maxNewMinor : undefined,
      resubmit: my.status === 'REJECTED',
    };
    navigation.navigate('PayFlow', params);
  };

  const run = async (fn: () => Promise<unknown>, id: string) => {
    if (busyId) return;
    setBusyId(id); setActionError(null);
    try { await fn(); } catch (e) { setActionError(errorText(e)); }
    await load();
    setBusyId(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <DetailHeader title={c.title} subtitle={dateLabel(c.deadline)} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 64 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
      >
        {error && <Notice tone="error" text={error} />}
        {draft && <Notice tone="info" text={t('funding.draftNote')} />}
        {(c.status === 'CLOSED' || c.status === 'CANCELLED') && (
          <Notice tone="warn" text={c.status === 'CANCELLED' ? t('funding.campCancelled') : t('funding.campClosed')} />
        )}
        {published && c.deadlinePassed && <Notice tone="warn" text={t('funding.campDeadlinePassed')} />}
        {actionError && <Notice tone="error" text={actionError} />}

        <Card style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pill
              text={c.donationType === 'REQUIRED' ? t('funding.required') : t('funding.voluntary')}
              color={c.donationType === 'REQUIRED' ? colors.error : BRAND.violet}
            />
            {!draft && <StatusChip status={my.status} />}
          </View>

          <Text style={{ color: colors.textSecondary, marginTop: 12 }}>{c.description}</Text>

          {!draft && (
            <>
              <Text style={{ color: colors.textSecondary, fontWeight: '700', marginTop: 18 }}>{t('funding.yourContribution')}</Text>
              <NumberTick value={mine.paid.label} style={{ color: colors.text, fontWeight: '800', fontSize: 30 }} />
              {c.requestedAmount && (
                <Text style={{ color: colors.textSecondary }}>{t('funding.yourShare')}: {c.requestedAmount.label}</Text>
              )}
              {mine.target && (
                <View style={{ marginTop: 10 }}>
                  <ProgressBar percent={mine.percent} color={colors.success} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                    <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{mine.percent ?? 0}%</Text>
                    <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{t('funding.remaining')}: {mine.remaining?.label}</Text>
                  </View>
                </View>
              )}
              {pendingMinor > 0 && (
                <View style={{ marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: withAlpha('#F59E0B', 0.12) }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {t('funding.pendingTotal', { defaultValue: 'Awaiting verification' })}: {my.pendingAmount?.label}
                  </Text>
                  {(my.pendingCount ?? 0) > 1 && (
                    <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                      {t('funding.pendingCount', { count: my.pendingCount, defaultValue: '{{count}} declarations in review' })}
                    </Text>
                  )}
                </View>
              )}
            </>
          )}

          {total && (
            <View style={{ marginTop: 18 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>
                {t('funding.campaignTotal')}: {total.paid.label} / {total.target!.label}
              </Text>
              <View style={{ marginTop: 8 }}><ProgressBar percent={total.percent} /></View>
              {total.remaining && (
                <Text style={{ color: colors.textSecondary, marginTop: 6 }}>{t('funding.remaining')}: {total.remaining.label}</Text>
              )}
            </View>
          )}

          {my.status === 'REJECTED' && !!my.rejectionReason && (
            <Notice tone="error" text={`${t('funding.rejectedWhy')}: ${my.rejectionReason}`} />
          )}
          {published && c.paymentInstructionsMissing && <Notice tone="error" text={t('funding.paymentsMissing')} />}

          {my.canDeclare && (maxNewMinor === undefined || maxNewMinor > 0) && (
            <View style={{ marginTop: 20 }}>
              <PrimaryButton
                label={my.status === 'REJECTED' ? t('funding.resubmit') : t('funding.payNow')}
                onPress={startPay}
              />
            </View>
          )}
          {my.canDeclare && maxNewMinor !== undefined && maxNewMinor <= 0 && (
            <Notice tone="info" text={t('funding.pendingCoversBalance', { defaultValue: 'Your pending declarations already cover the full balance. Wait for verification.' })} />
          )}
        </Card>

        {!draft && (
          <>
            <SectionLabel text={t('funding.history')} color={BRAND.gold} />
            <DeclarationHistory items={c.history} />
          </>
        )}

        {isLeader && c.leader && (
          <>
            <SectionLabel text={t('funding.verifyQueue')} color={BRAND.magenta} />
            <Text style={{ color: colors.textSecondary, marginBottom: 10 }}>
              {t('funding.received')}: <Text style={{ color: colors.success, fontWeight: '800' }}>{c.leader.received.label}</Text>
            </Text>
            {c.leader.payments.length === 0 && <Text style={{ color: colors.textSecondary }}>{t('funding.noPayments')}</Text>}
            {[...c.leader.payments]
              .sort((a, b) => Number(b.status === 'PENDING_VERIFICATION') - Number(a.status === 'PENDING_VERIFICATION'))
              .map((p) => {
                const d = p.latestDeclaration;
                const needsAction = p.status === 'PENDING_VERIFICATION' && d?.status === 'PENDING';
                return (
                  <Card key={p.id} style={{ marginBottom: 10, padding: 14, borderRadius: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.text, fontWeight: '800', flex: 1 }}>{p.participantName}</Text>
                      <StatusChip status={p.status} />
                    </View>
                    <Text style={{ color: colors.text, marginTop: 6, fontWeight: '700' }}>
                      {needsAction && d ? `${t('funding.declared')} ${d.amount.label}` : `${t('funding.colPaid')}: ${p.paid.label}`}
                    </Text>
                    {!!d && (
                      <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                        {instantLabel(d.declaredAt)}
                        {d.paymentMethod ? ` · ${d.paymentMethod === 'BANK' ? t('funding.bank') : 'Telebirr'}` : ''}
                        {d.reference ? ` · Ref: ${d.reference}` : ''}
                      </Text>
                    )}
                    {(p.pendingCount ?? 0) > 1 && (
                      <Text style={{ color: '#B7791F', marginTop: 4, fontWeight: '700' }}>
                        + {p.pendingCount! - 1} {t('funding.morePending', { defaultValue: 'more pending' })}
                      </Text>
                    )}
                    {needsAction && (
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                        <Pressable
                          disabled={!!busyId}
                          onPress={() => Alert.alert(t('funding.approve'), t('funding.approveConfirm'), [
                            { text: t('common.cancel'), style: 'cancel' },
                            { text: t('funding.approve'), onPress: () => run(() => approveDonation(p.id, d!.id), p.id) },
                          ])}
                          style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: colors.success, opacity: busyId ? 0.5 : 1, minHeight: 44 }}
                        >
                          {busyId === p.id ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '800' }}>{t('funding.approve')}</Text>}
                        </Pressable>
                        <Pressable
                          disabled={!!busyId}
                          onPress={() => { setRejectId(p.id); setRejectDeclId(d!.id); }}
                          style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.error, opacity: busyId ? 0.5 : 1, minHeight: 44 }}
                        >
                          <Text style={{ color: colors.error, fontWeight: '800' }}>{t('funding.reject')}</Text>
                        </Pressable>
                      </View>
                    )}
                  </Card>
                );
              })}

            {(draft || published) && (
              <View style={{ marginTop: 24, gap: 10 }}>
                {draft && (
                  <PrimaryButton
                    label={t('funding.publishNow')}
                    busy={busyId === 'publish'}
                    onPress={() => Alert.alert(t('funding.publishNow'), t('funding.publishConfirm'), [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('funding.publishNow'), onPress: () => run(() => leaderPublishCampaign(c.id), 'publish') },
                    ])}
                  />
                )}
                <Pressable
                  onPress={() => navigation.navigate('CreateCampaign', { id: c.id })}
                  accessibilityRole="button"
                  style={{ borderWidth: 1, borderColor: BRAND.violet, paddingVertical: 14, borderRadius: 14, alignItems: 'center', minHeight: 44 }}
                >
                  <Text style={{ color: BRAND.violet, fontWeight: '800', fontSize: 16 }}>{t('funding.editCampaign')}</Text>
                </Pressable>
                {published && (
                  <Pressable
                    disabled={!!busyId}
                    onPress={() => Alert.alert(t('funding.closeTitle'), t('funding.closeBody'), [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('funding.closeBtn'), style: 'destructive', onPress: () => run(() => leaderCloseCampaign(c.id), 'close') },
                    ])}
                    accessibilityRole="button"
                    style={{ backgroundColor: withAlpha(colors.error, 0.1), borderWidth: 1, borderColor: colors.error, paddingVertical: 14, borderRadius: 14, alignItems: 'center', minHeight: 44 }}
                  >
                    <Text style={{ color: colors.error, fontWeight: '800', fontSize: 16 }}>{t('funding.closeBtn')}</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setCancelOpen(true)} accessibilityRole="button" style={{ paddingVertical: 12, alignItems: 'center', minHeight: 44 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{t('funding.cancelCampaign')}</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <ReasonModal
        visible={!!rejectId}
        title={t('funding.reject')}
        message={t('funding.rejectHint')}
        confirmLabel={t('funding.reject')}
        onClose={() => { setRejectId(null); setRejectDeclId(null); }}
        onSubmit={async (r: string) => {
          try { await rejectDonation(rejectId!, r, rejectDeclId ?? undefined); } catch (e) { await load(); throw e; }
          await load();
        }}
      />
      <ReasonModal
        visible={cancelOpen}
        title={t('funding.cancelCampaign')}
        message={t('funding.cancelHint')}
        confirmLabel={t('funding.cancelCampaign')}
        onClose={() => setCancelOpen(false)}
        onSubmit={async (r: string) => { await leaderCancelCampaign(c.id, r); await load(); }}
      />
    </View>
  );
}