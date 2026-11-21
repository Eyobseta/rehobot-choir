import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { AuthField, PrimaryButton, ErrorBanner } from '../auth/Auth_UI';
import { ScreenHero } from '../profile/SettingsKit';
import { parseEtbToMinor } from '../../utils/money';
import {
  errorText, Notice, minorToInput, Lockable, FormSection, ChoiceCards, PickerField, ActionBtn, LoadingState, FadeUp, FieldLabel,
} from './fundingKit';
import { EthDate, formatEthDate, addEthDays, ethTodayFromInstant, ethDaysBetween } from '../../utils/ethiopianCalendar';
import EthDatePicker from './EthDatePicker';
import { CampaignStatus, DonationType } from '../../services/funding';
import { useLeaderCampaignsQuery, useSaveCampaignMutation, useLeaderCampaignMutation } from './useLeaderFunding';
import { useCampaignDetailQuery } from './useMemberFunding';

export default function CreateCampaignScreen({ navigation, route }: any) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const insets = useSafeAreaInsets();
  const lang = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const editId: string | undefined = route?.params?.id;

  const campQ = useCampaignDetailQuery(editId ?? '__new__');
  const saveMut = useSaveCampaignMutation();
  const publishMut = useLeaderCampaignMutation();

  const [status, setStatus] = useState<CampaignStatus | null>(editId ? null : 'DRAFT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [donationType, setDonationType] = useState<DonationType>('VOLUNTARY');
  const [amountStr, setAmountStr] = useState('');
  const [targetStr, setTargetStr] = useState('');
  const [reason, setReason] = useState('');
  const [deadline, setDeadline] = useState<EthDate>(() => addEthDays(ethTodayFromInstant(new Date()), 30));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedId = useRef<string | null>(editId ?? null);
  const busy = saveMut.isPending || publishMut.isPending;

  useEffect(() => {
    if (!editId || !campQ.data?.item) return;
    const item = campQ.data.item;
    setStatus(item.status);
    setTitle(item.title);
    setDescription(item.description);
    setDonationType(item.donationType);
    setAmountStr(item.requestedAmount ? minorToInput(item.requestedAmount.minor) : '');
    setTargetStr(item.targetAmount ? minorToInput(item.targetAmount.minor) : '');
    setDeadline(item.deadline.eth);
  }, [editId, campQ.data]);

  const published = status === 'PUBLISHED';
  const readOnly = status === 'CLOSED' || status === 'CANCELLED';

  const onSave = async (publish: boolean) => {
    if (readOnly) return;
    setError(null);
    if (title.trim().length < 3) return setError(t('funding.titleTooShort'));
    if (description.trim().length < 10) return setError(t('funding.descTooShort'));

    let requestedAmountMinor: number | null = null;
    if (donationType === 'REQUIRED' || amountStr.trim()) {
      const parsed = parseEtbToMinor(amountStr);
      if (!parsed || parsed < 100) return setError(t('funding.invalidFixed'));
      requestedAmountMinor = parsed;
    }
    let targetAmountMinor: number | null = null;
    if (targetStr.trim()) {
      const parsed = parseEtbToMinor(targetStr);
      if (!parsed || parsed < 100) return setError(t('funding.invalidTarget'));
      targetAmountMinor = parsed;
    }
    if (requestedAmountMinor !== null && targetAmountMinor !== null && requestedAmountMinor > targetAmountMinor) {
      return setError(t('funding.amountAboveTarget'));
    }
    if (ethDaysBetween(ethTodayFromInstant(new Date()), deadline) < 0) return setError(t('funding.deadlineInPast'));
    if (published && reason.trim().length < 3) return setError(t('funding.reasonShort', { n: 3 }));

    try {
      if (published) {
        await saveMut.mutateAsync({ id: savedId.current!, input: { title: title.trim(), description: description.trim(), targetAmountMinor, deadline, reason: reason.trim() } });
      } else if (!savedId.current) {
        const res = await saveMut.mutateAsync({ input: { title: title.trim(), description: description.trim(), donationType, requestedAmountMinor, targetAmountMinor, deadline } });
        savedId.current = (res as any).id;
      } else {
        await saveMut.mutateAsync({ id: savedId.current, input: { title: title.trim(), description: description.trim(), donationType, requestedAmountMinor, targetAmountMinor, deadline } });
      }
      if (publish && !published) await publishMut.mutateAsync({ action: 'publish', id: savedId.current! });
      navigation.goBack();
    } catch (e) {
      const msg = errorText(e);
      setError(publish && savedId.current && !published ? `${t('funding.draftSavedButFailed')}: ${msg}` : msg);
    }
  };

  if (editId && campQ.isPending && campQ.data === undefined) return <LoadingState />;

  const typeLocked = published || readOnly;
  const textLocked = readOnly;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHero icon="gift" title={editId ? t('funding.editCampaign') : t('funding.newCampaign')} subtitle={t('funding.campaignSubtitle')} onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}>
          {error && <View style={{ marginBottom: spacing.sm }}><ErrorBanner message={error} /></View>}
          {readOnly && <Notice tone="warn" text={t('funding.campLocked')} />}
          {published && <Notice tone="info" text={t('funding.publishedEditNote')} />}

          <FadeUp index={0} style={{ marginTop: spacing.md }}>
            <FormSection title={t('funding.campaignTitle')} icon="text-outline">
              <Lockable locked={textLocked}>
                <AuthField label={t('funding.campaignTitle')} iconNode={<Ionicons name="text" size={18} color={colors.accent} />} value={title} onChangeText={setTitle} placeholder={t('funding.campaignTitlePlaceholder')} />
              </Lockable>

              <Lockable locked={textLocked} style={{ marginTop: spacing.md }}>
                <AuthField label={t('funding.campaignDesc')} iconNode={<Ionicons name="document-text" size={18} color={colors.accent} />} value={description} onChangeText={setDescription} multiline placeholder={t('funding.campaignDescPlaceholder')} />
              </Lockable>
            </FormSection>
          </FadeUp>

          <FadeUp index={1}>
            <FormSection title={t('funding.donationType')} icon="heart-outline" tone="peach">
              <ChoiceCards
                style={{ marginBottom: spacing.md }}
                disabled={typeLocked}
                value={donationType}
                onChange={setDonationType}
                options={[
                  { key: 'VOLUNTARY', label: t('funding.voluntary'), icon: 'heart-outline' },
                  { key: 'REQUIRED', label: t('funding.required'), icon: 'lock-closed-outline' },
                ]}
              />

              <Lockable locked={typeLocked}>
                <AuthField label={donationType === 'REQUIRED' ? t('funding.fixedAmount') : t('funding.suggestedAmount')} iconNode={<Ionicons name="cash" size={18} color={colors.accent} />} value={amountStr} onChangeText={setAmountStr} keyboardType="phone-pad" placeholder={t('funding.fixedAmountPlaceholder')} />
              </Lockable>

              <Lockable locked={readOnly} style={{ marginTop: spacing.md }}>
                <AuthField label={t('funding.targetAmount')} iconNode={<Ionicons name="stats-chart" size={18} color={colors.accent} />} value={targetStr} onChangeText={setTargetStr} keyboardType="phone-pad" placeholder={t('funding.targetAmountPlaceholder')} />
              </Lockable>
            </FormSection>
          </FadeUp>

          <FadeUp index={2}>
            <FormSection title={t('funding.deadline')} icon="calendar-outline" tone="mint">
              <PickerField
                label={t('funding.deadline')}
                value={formatEthDate(deadline, lang)}
                disabled={readOnly}
                onPress={() => setPickerOpen(true)}
              />

              {published && (
                <View style={{ marginTop: spacing.md }}>
                  <AuthField label={t('funding.reasonChange')} iconNode={<Ionicons name="chatbox-ellipses-outline" size={18} color={colors.accent} />} value={reason} onChangeText={setReason} multiline />
                </View>
              )}
            </FormSection>

            {!readOnly && (
              <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
                {published ? (
                  <PrimaryButton label={t('funding.saveChanges')} onPress={() => onSave(false)} busy={busy} />
                ) : (
                  <>
                    <ActionBtn
                      variant="outline"
                      icon="save-outline"
                      label={busy ? t('funding.saving') : t('funding.saveDraft')}
                      disabled={busy}
                      onPress={() => onSave(false)}
                    />
                    <PrimaryButton label={t('funding.publishNow')} onPress={() => onSave(true)} busy={busy} />
                  </>
                )}
              </View>
            )}
          </FadeUp>
        </ScrollView>
      </KeyboardAvoidingView>

      <EthDatePicker visible={pickerOpen} title={t('funding.selectDeadline')} value={deadline} onClose={() => setPickerOpen(false)} onConfirm={setDeadline} />
    </View>
  );
}