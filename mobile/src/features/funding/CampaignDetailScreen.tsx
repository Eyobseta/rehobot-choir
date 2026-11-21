import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { PrimaryButton } from '../auth/Auth_UI';
import { withAlpha } from '../auth/Auth_UI';
import {
  leaderCloseCampaign, leaderCancelCampaign, leaderPublishCampaign,
  approveDonation, rejectDonation,
} from '../../services/funding';
import {
  Card, StatusChip, useDateLabel, useInstantLabel, errorText, SectionLabel, DetailHeader, ProgressBar, Notice,
  ErrorState, DeclarationHistory, ReasonModal, Pill, NumberTick, ActionBtn, PendingStrip, LoadingState, FadeUp,
} from './fundingKit';
import { getRole } from '../../services/role';
import type { PayFlowParams } from './Payflowscreen';
import { useCampaignDetailQuery } from './useMemberFunding';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '../chat/chatSession';

export default function CampaignDetailScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const dateLabel = useDateLabel();
  const instantLabel = useInstantLabel();
  const userId = useMe()?.id ?? null;
  const qc = useQueryClient();

  const q = useCampaignDetailQuery(route.params.id);
  const c = q.data?.item ?? null;
  const firstLoad = q.isPending && q.data === undefined;
  const error = (q.error as { message?: string } | null)?.message ?? null;
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectDeclId, setRejectDeclId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (firstLoad) return <LoadingState />;
  if (!c && error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <DetailHeader title="" onBack={() => navigation.goBack()} />
        <ErrorState message={error} onRetry={() => q.refetch()} />
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
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['funding', userId ?? 'anon'] });
    } catch (e) {
      setActionError(errorText(e));
    }
    setBusyId(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <DetailHeader title={c.title} subtitle={dateLabel(c.deadline)} onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 64 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching && !firstLoad} onRefresh={() => q.refetch()} />}
      >
        {error && <Notice tone="error" text={error} />}
        {draft && <Notice tone="info" text={t('funding.draftNote')} />}
        {(c.status === 'CLOSED' || c.status === 'CANCELLED') && (
          <Notice tone="warn" text={c.status === 'CANCELLED' ? t('funding.campCancelled') : t('funding.campClosed')} />
        )}
        {published && c.deadlinePassed && <Notice tone="warn" text={t('funding.campDeadlinePassed')} />}
        {actionError && <Notice tone="error" text={actionError} />}

        <FadeUp index={0}>
          <Card style={{ marginTop: 12, padding: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Pill
                text={c.donationType === 'REQUIRED' ? t('funding.required') : t('funding.voluntary')}
                color={c.donationType === 'REQUIRED' ? colors.error : colors.accent}
              />
              {!draft && <StatusChip status={my.status} />}
            </View>

            <Text style={{ color: colors.textSecondary, marginTop: 14, lineHeight: 21 }}>{c.description}</Text>

            {!draft && (
              <View style={{ marginTop: 18, padding: 16, borderRadius: 20, backgroundColor: colors.surfaceAlt }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12 }}>{t('funding.yourContribution')}</Text>
                <NumberTick value={mine.paid.label} style={{ color: colors.text, fontWeight: '800', fontSize: 32, marginTop: 2 }} />
                {c.requestedAmount && (
                  <Text style={{ color: colors.textSecondary }}>{t('funding.yourShare')}: {c.requestedAmount.label}</Text>
                )}
                {mine.target && (
                  <View style={{ marginTop: 12 }}>
                    <ProgressBar percent={mine.percent} color={colors.success} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text style={{ color: colors.text, fontWeight: '800' }}>{mine.percent ?? 0}%</Text>
                      <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{t('funding.remaining')}: {mine.remaining?.label}</Text>
                    </View>
                  </View>
                )}
                {pendingMinor > 0 && (
                  <PendingStrip
                    style={{ marginTop: 12 }}
                    text={`${t('funding.pendingTotal', { defaultValue: 'Awaiting verification' })}: ${my.pendingAmount?.label}`}
                    sub={(my.pendingCount ?? 0) > 1
                      ? t('funding.pendingCount', { count: my.pendingCount, defaultValue: '{{count}} declarations in review' })
                      : undefined}
                  />
                )}
              </View>
            )}

            {total && (
              <View style={{ marginTop: 18 }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>
                  {t('funding.campaignTotal')}: <Text style={{ color: colors.text, fontWeight: '800' }}>{total.paid.label} / {total.target!.label}</Text>
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
        </FadeUp>

        {!draft && (
          <FadeUp index={1}>
            <SectionLabel icon="receipt" text={t('funding.history')} color={colors.accent} />
            <DeclarationHistory items={c.history} />
          </FadeUp>
        )}

        {isLeader && c.leader && (
          <FadeUp index={2}>
            <SectionLabel icon="shield-checkmark" text={t('funding.verifyQueue')} color={colors.accent} />
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
                  <Card key={p.id} style={{ marginBottom: 10, padding: 14, borderRadius: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(colors.accent, 0.18) }}>
                        <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 16 }}>{(p.participantName || '?').trim().charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={{ color: colors.text, fontWeight: '800', flex: 1 }} numberOfLines={1}>{p.participantName}</Text>
                      <StatusChip status={p.status} />
                    </View>
                    <Text style={{ color: colors.text, marginTop: 10, fontWeight: '800', fontSize: 16 }}>
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
                      <Text style={{ color: colors.warning, marginTop: 4, fontWeight: '700' }}>
                        + {p.pendingCount! - 1} {t('funding.morePending', { defaultValue: 'more pending' })}
                      </Text>
                    )}
                    {needsAction && (
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                        <ActionBtn
                          style={{ flex: 1 }}
                          variant="success"
                          icon="checkmark"
                          compact
                          label={t('funding.approve')}
                          disabled={!!busyId}
                          busy={busyId === p.id}
                          onPress={() => Alert.alert(t('funding.approve'), t('funding.approveConfirm'), [
                            { text: t('common.cancel'), style: 'cancel' },
                            { text: t('funding.approve'), onPress: () => run(() => approveDonation(p.id, d!.id), p.id) },
                          ])}
                        />
                        <ActionBtn
                          style={{ flex: 1 }}
                          variant="dangerSoft"
                          icon="close"
                          compact
                          label={t('funding.reject')}
                          disabled={!!busyId}
                          onPress={() => { setRejectId(p.id); setRejectDeclId(d!.id); }}
                        />
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
                <ActionBtn
                  variant="outline"
                  icon="create-outline"
                  label={t('funding.editCampaign')}
                  onPress={() => navigation.navigate('CreateCampaign', { id: c.id })}
                />
                {published && (
                  <ActionBtn
                    variant="dangerSoft"
                    icon="lock-closed-outline"
                    label={t('funding.closeBtn')}
                    disabled={!!busyId}
                    onPress={() => Alert.alert(t('funding.closeTitle'), t('funding.closeBody'), [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('funding.closeBtn'), style: 'destructive', onPress: () => run(() => leaderCloseCampaign(c.id), 'close') },
                    ])}
                  />
                )}
                <ActionBtn variant="ghost" label={t('funding.cancelCampaign')} onPress={() => setCancelOpen(true)} />
              </View>
            )}
          </FadeUp>
        )}
      </ScrollView>

      <ReasonModal
        visible={!!rejectId}
        title={t('funding.reject')}
        message={t('funding.rejectHint')}
        confirmLabel={t('funding.reject')}
        onClose={() => { setRejectId(null); setRejectDeclId(null); }}
        onSubmit={async (r: string) => {
          try { await rejectDonation(rejectId!, r, rejectDeclId ?? undefined); } catch (e) { await q.refetch(); throw e; }
          await q.refetch();
        }}
      />
      <ReasonModal
        visible={cancelOpen}
        title={t('funding.cancelCampaign')}
        message={t('funding.cancelHint')}
        confirmLabel={t('funding.cancelCampaign')}
        onClose={() => setCancelOpen(false)}
        onSubmit={async (r: string) => { await leaderCancelCampaign(c.id, r); await q.refetch(); }}
      />
    </View>
  );
}