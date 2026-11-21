import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { AuthField, PrimaryButton, ErrorBanner } from '../auth/Auth_UI';
import { ScreenHero } from '../profile/SettingsKit';
import { parseEtbToMinor } from '../../utils/money';
import {
  errorText, Card, minorToInput, Lockable, FormSection, PickerField, ToggleRow, LoadingState, FadeUp,
} from './fundingKit';
import { EthDate, formatEthDate, ethTodayFromInstant, addEthDays } from '../../utils/ethiopianCalendar';
import EthDatePicker from './EthDatePicker';
import { useLeaderAnnualConfigQuery, useSaveAnnualConfigMutation } from './useLeaderFunding';
import { leaderPreviewDeadline, DeadlinePreview } from '../../services/funding';

export default function AdminFundingSetupScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const navigation = useNavigation<any>();
  const lang = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';

  const today = ethTodayFromInstant(new Date());
  const configQ = useLeaderAnnualConfigQuery();
  const saveMut = useSaveAnnualConfigMutation();

  const [year, setYear] = useState(String(today.year));
  const [amountStr, setAmountStr] = useState('100');
  const [expiry, setExpiry] = useState<EthDate>(addEthDays(today, 365));
  const [active, setActive] = useState(true);
  const [reason, setReason] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  const [preview, setPreview] = useState<DeadlinePreview | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const previewSeq = useRef(0);

  const [error, setError] = useState<string | null>(null);
  const busy = saveMut.isPending;

  // Prefill from the current configuration
  useEffect(() => {
    if (configQ.data?.item) {
      const item = configQ.data.item;
      setHasExisting(true);
      setYear(String(item.contributionYear));
      setAmountStr(minorToInput(item.amount.minor));
      setExpiry(item.expiry.eth);
      setActive(item.active);
    }
  }, [configQ.data]);

  // Backend-authoritative deadline preview
  const refreshPreview = React.useCallback(async (e: EthDate) => {
    const seq = ++previewSeq.current;
    setPreviewing(true); setPreviewErr(null); setPreview(null);
    try {
      const p = await leaderPreviewDeadline(e);
      if (seq === previewSeq.current) setPreview(p);
    } catch (err) {
      if (seq === previewSeq.current) setPreviewErr(errorText(err));
    } finally {
      if (seq === previewSeq.current) setPreviewing(false);
    }
  }, []);

  useEffect(() => {
    if (configQ.isPending) return;
    void refreshPreview(expiry);
  }, [expiry, configQ.isPending, refreshPreview]);

  const onSave = async () => {
    setError(null);
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      return setError(t('funding.invalidYear'));
    }
    const amountMinor = parseEtbToMinor(amountStr);
    if (!amountMinor || amountMinor < 100) return setError(t('funding.invalidFixed'));
    if (!preview) {
      return setError(t('funding.deadlineNotReady'));
    }

    try {
      await saveMut.mutateAsync({
        contributionYear: y, amountMinor, expiry,
        confirmedDeadline: preview.deadline.eth,
        active,
        reason: reason.trim() || undefined,
      });
      setHasExisting(true);
      navigation.goBack();
    } catch (e) {
      setError(errorText(e));
    }
  };

  if (configQ.isPending && configQ.data === undefined) return <LoadingState />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHero icon="settings" title={t('funding.setupTitle')} subtitle={t('funding.setupSubtitle')} onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingBottom: 64 }}>
          {error && <View style={{ marginBottom: spacing.md }}><ErrorBanner message={error} /></View>}

          <FadeUp index={0}>
            <FormSection title={t('funding.contributionYear')} icon="calendar-outline">
              <Lockable locked={busy}>
                <AuthField label={t('funding.contributionYear')} iconNode={<Ionicons name="calendar" size={18} color={colors.accent} />} value={year} onChangeText={setYear} keyboardType="phone-pad" />
                <View style={{ marginTop: spacing.md }}>
                  <AuthField label={`${t('funding.amountDue')} (ETB)`} iconNode={<Ionicons name="cash" size={18} color={colors.accent} />} value={amountStr} onChangeText={setAmountStr} keyboardType="phone-pad" />
                </View>
              </Lockable>
            </FormSection>
          </FadeUp>

          <FadeUp index={1}>
            <FormSection title={t('funding.deadlineCalc')} icon="time-outline" tone="mint">
              <PickerField
                label={`${t('funding.expiryDate')} · ${t('funding.ethCalendar')}`}
                value={formatEthDate(expiry, lang)}
                disabled={busy}
                onPress={() => { if (!busy) setPickerOpen(true); }}
              />

              <View style={{ marginTop: spacing.md, padding: 16, borderRadius: 18, backgroundColor: colors.surfaceAlt }}>
                {previewing ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={{ color: colors.textSecondary }}>{t('common.loading')}</Text>
                  </View>
                ) : preview ? (
                  <View>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 22 }}>
                      {lang === 'am' ? preview.deadline.labelAm : preview.deadline.labelEn}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                      <Text style={{ color: colors.success, fontWeight: '800', fontSize: 12 }}>{t('funding.reviewed')}</Text>
                    </View>
                  </View>
                ) : previewErr ? (
                  <Text style={{ color: colors.error }}>{previewErr}</Text>
                ) : (
                  <Text style={{ color: colors.textSecondary }}>{t('funding.selectDateHint')}</Text>
                )}
              </View>
            </FormSection>
          </FadeUp>

          <FadeUp index={2}>
            <ToggleRow title={t('funding.activeYear')} value={active} onValueChange={setActive} disabled={busy} positive />

            <Lockable locked={busy} style={{ marginTop: spacing.md }}>
              <AuthField label={hasExisting ? t('funding.reasonChange') : t('funding.reasonOptional')} iconNode={<Ionicons name="chatbox-ellipses-outline" size={18} color={colors.accent} />} value={reason} onChangeText={setReason} multiline />
            </Lockable>

            <View style={{ marginTop: spacing.xl }}>
              <PrimaryButton label={t('common.save')} onPress={onSave} busy={busy} />
            </View>
          </FadeUp>
        </ScrollView>
      </KeyboardAvoidingView>

      <EthDatePicker visible={pickerOpen} title={t('funding.expiryDate')} value={expiry} onClose={() => setPickerOpen(false)} onConfirm={setExpiry} minYear={today.year - 1} maxYear={today.year + 6} />
    </View>
  );
}