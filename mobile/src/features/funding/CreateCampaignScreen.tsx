import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { AuthField, PrimaryButton, ErrorBanner, BRAND } from '../auth/Auth_UI';
import { ScreenHero } from '../profile/SettingsKit';
import {
  leaderCreateCampaign, leaderUpdateCampaign, leaderPublishCampaign, getCampaignDetail, DonationType, CampaignStatus,
} from '../../services/funding';
import { parseEtbToMinor } from '../../utils/money';
import { errorText, Notice, minorToInput } from './fundingKit';
import { EthDate, formatEthDate, addEthDays, ethTodayFromInstant, ethDaysBetween } from '../../utils/ethiopianCalendar';
import EthDatePicker from './EthDatePicker';

/** Dims and blocks touches on its children (AuthField has no `editable` prop). */
function Lockable({ locked, children, style }: { locked: boolean; children: React.ReactNode; style?: object }) {
  return (
    <View pointerEvents={locked ? 'none' : 'auto'} style={[{ opacity: locked ? 0.55 : 1 }, style]}>
      {children}
    </View>
  );
}

export default function CreateCampaignScreen({ navigation, route }: any) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();
  const lang = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const editId: string | undefined = route?.params?.id;

  const [loading, setLoading] = useState(!!editId);
  const [status, setStatus] = useState<CampaignStatus | null>(editId ? null : 'DRAFT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [donationType, setDonationType] = useState<DonationType>('VOLUNTARY');
  const [amountStr, setAmountStr] = useState('');
  const [targetStr, setTargetStr] = useState('');
  const [reason, setReason] = useState('');
  const [deadline, setDeadline] = useState<EthDate>(() => addEthDays(ethTodayFromInstant(new Date()), 30));
  const [pickerOpen, setPickerOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const savedId = useRef<string | null>(editId ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const { item } = await getCampaignDetail(editId);
        setStatus(item.status);
        setTitle(item.title);
        setDescription(item.description);
        setDonationType(item.donationType);
        setAmountStr(item.requestedAmount ? minorToInput(item.requestedAmount.minor) : '');
        setTargetStr(item.targetAmount ? minorToInput(item.targetAmount.minor) : '');
        setDeadline(item.deadline.eth);
      } catch (e) { setError(errorText(e)); }
      finally { setLoading(false); }
    })();
  }, [editId]);

  const published = status === 'PUBLISHED';
  const readOnly = status === 'CLOSED' || status === 'CANCELLED';

  const onSave = async (publish: boolean) => {
    if (busyRef.current || readOnly) return;
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

    busyRef.current = true; setBusy(true);
    try {
      if (published) {
        // Type and per-person amount are locked after publishing; send only what may change.
        await leaderUpdateCampaign(savedId.current!, {
          title: title.trim(), description: description.trim(), targetAmountMinor, deadline, reason: reason.trim(),
        });
      } else if (!savedId.current) {
        const res = await leaderCreateCampaign({
          title: title.trim(), description: description.trim(), donationType,
          requestedAmountMinor, targetAmountMinor, deadline,
        });
        savedId.current = res.id;
      } else {
        await leaderUpdateCampaign(savedId.current, {
          title: title.trim(), description: description.trim(), donationType,
          requestedAmountMinor, targetAmountMinor, deadline,
        });
      }
      if (publish && !published) await leaderPublishCampaign(savedId.current!);
      navigation.goBack();
    } catch (e) {
      const msg = errorText(e);
      setError(publish && savedId.current && !published
        ? `${t('funding.draftSavedButFailed')}: ${msg}`
        : msg);
    } finally {
      busyRef.current = false; setBusy(false);
    }
  };

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={BRAND.violet} /></View>;
  }

  // published: locks type and amount
  // readOnly (CLOSED/CANCELLED): locks everything
  const typeLocked = published || readOnly;
  const textLocked = readOnly;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHero
        icon="gift"
        title={editId ? t('funding.editCampaign') : t('funding.newCampaign')}
        subtitle={t('funding.campaignSubtitle')}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 40 }}>
          {error && <ErrorBanner message={error} />}
          {readOnly && <Notice tone="warn" text={t('funding.campLocked')} />}
          {published && <Notice tone="info" text={t('funding.publishedEditNote')} />}

          <Lockable locked={textLocked}>
            <AuthField
              label={t('funding.campaignTitle')}
              iconNode={<Ionicons name="text" size={18} color={BRAND.violet} />}
              value={title} onChangeText={setTitle}
              placeholder={t('funding.campaignTitlePlaceholder')}
            />
          </Lockable>

          <Lockable locked={textLocked} style={{ marginTop: spacing.md }}>
            <AuthField
              label={t('funding.campaignDesc')}
              iconNode={<Ionicons name="document-text" size={18} color={BRAND.violet} />}
              value={description} onChangeText={setDescription} multiline
              placeholder={t('funding.campaignDescPlaceholder')}
            />
          </Lockable>

          <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '800', marginTop: spacing.md, marginBottom: 8 }]}>
            {t('funding.donationType')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            {(['VOLUNTARY', 'REQUIRED'] as const).map((type) => (
              <Pressable
                key={type}
                disabled={typeLocked}
                onPress={() => setDonationType(type)}
                accessibilityRole="radio"
                accessibilityState={{ selected: donationType === type, disabled: typeLocked }}
                style={{
                  flex: 1, backgroundColor: donationType === type ? BRAND.violet : colors.surface,
                  borderWidth: 1, borderColor: colors.border, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
                  opacity: typeLocked ? 0.55 : 1,
                }}
              >
                <Text style={{ color: donationType === type ? '#FFF' : colors.text, fontWeight: '700' }}>
                  {type === 'VOLUNTARY' ? t('funding.voluntary') : t('funding.required')}
                </Text>
              </Pressable>
            ))}
          </View>

          <Lockable locked={typeLocked}>
            <AuthField
              label={donationType === 'REQUIRED' ? t('funding.fixedAmount') : t('funding.suggestedAmount')}
              iconNode={<Ionicons name="cash" size={18} color={BRAND.violet} />}
              value={amountStr} onChangeText={setAmountStr} keyboardType="phone-pad"
              placeholder={t('funding.fixedAmountPlaceholder')}
            />
          </Lockable>

          <Lockable locked={readOnly} style={{ marginTop: spacing.md }}>
            <AuthField
              label={t('funding.targetAmount')}
              iconNode={<Ionicons name="stats-chart" size={18} color={BRAND.violet} />}
              value={targetStr} onChangeText={setTargetStr} keyboardType="phone-pad"
              placeholder={t('funding.targetAmountPlaceholder')}
            />
          </Lockable>

          <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '800', marginTop: spacing.md, marginBottom: 8 }]}>
            {t('funding.deadline')}
          </Text>
          <Pressable
            disabled={readOnly}
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            style={{
              padding: 16, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
              marginBottom: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              opacity: readOnly ? 0.55 : 1,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16 }}>{formatEthDate(deadline, lang)}</Text>
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
          </Pressable>

          {published && (
            <View style={{ marginBottom: spacing.md }}>
              <AuthField
                label={t('funding.reasonChange')}
                iconNode={<Ionicons name="chatbox-ellipses-outline" size={18} color={BRAND.violet} />}
                value={reason} onChangeText={setReason} multiline
              />
            </View>
          )}

          {!readOnly && (
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              {published ? (
                <PrimaryButton label={t('funding.saveChanges')} onPress={() => onSave(false)} busy={busy} />
              ) : (
                <>
                  <Pressable
                    onPress={() => onSave(false)} disabled={busy}
                    style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: BRAND.violet, paddingVertical: 14, borderRadius: 14, alignItems: 'center', opacity: busy ? 0.6 : 1 }}
                  >
                    <Text style={{ color: BRAND.violet, fontWeight: '800', fontSize: 16 }}>{busy ? t('funding.saving') : t('funding.saveDraft')}</Text>
                  </Pressable>
                  <PrimaryButton label={t('funding.publishNow')} onPress={() => onSave(true)} busy={busy} />
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <EthDatePicker
        visible={pickerOpen}
        title={t('funding.selectDeadline')}
        value={deadline}
        onClose={() => setPickerOpen(false)}
        onConfirm={setDeadline}
      />
    </View>
  );
}