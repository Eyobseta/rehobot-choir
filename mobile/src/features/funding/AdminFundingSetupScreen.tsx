import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable, Switch, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { AuthField, PrimaryButton, ErrorBanner, BRAND, withAlpha } from '../auth/Auth_UI';
import { ScreenHero } from '../profile/SettingsKit';
import {
  leaderUpsertAnnualConfig, leaderGetAnnualConfig, leaderPreviewDeadline, DeadlinePreview,
} from '../../services/funding';
import { parseEtbToMinor } from '../../utils/money';
import { errorText, Card, Notice, minorToInput } from './fundingKit';
import { EthDate, formatEthDate, ethTodayFromInstant, addEthDays } from '../../utils/ethiopianCalendar';
import EthDatePicker from './EthDatePicker';

/** Dims and blocks touches on its children (AuthField has no `editable` prop). */
function Lockable({ locked, children, style }: { locked: boolean; children: React.ReactNode; style?: object }) {
  return (
    <View pointerEvents={locked ? 'none' : 'auto'} style={[{ opacity: locked ? 0.55 : 1 }, style]}>
      {children}
    </View>
  );
}

export default function AdminFundingSetupScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const navigation = useNavigation<any>();
  const lang = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';

  const today = ethTodayFromInstant(new Date());
  const [loading, setLoading] = useState(true);
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

  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from the current configuration.
  useEffect(() => {
    (async () => {
      try {
        const { item } = await leaderGetAnnualConfig();
        if (item) {
          setHasExisting(true);
          setYear(String(item.contributionYear));
          setAmountStr(minorToInput(item.amount.minor));
          setExpiry(item.expiry.eth);
          setActive(item.active);
        }
      } catch (e) { setError(errorText(e)); }
      finally { setLoading(false); }
    })();
  }, []);

  // Backend-authoritative deadline preview whenever the expiry changes.
  const refreshPreview = useCallback(async (e: EthDate) => {
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
  useEffect(() => { if (!loading) void refreshPreview(expiry); }, [expiry, loading, refreshPreview]);

  const onSave = async () => {
    if (busyRef.current) return;
    setError(null);
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      return setError(t('funding.invalidYear', { defaultValue: 'Enter a valid Ethiopian year.' }));
    }
    const amountMinor = parseEtbToMinor(amountStr);
    if (!amountMinor || amountMinor < 100) return setError(t('funding.invalidFixed'));
    if (!preview) {
      return setError(t('funding.deadlineNotReady', { defaultValue: 'Wait for the calculated deadline, then review it.' }));
    }

    busyRef.current = true; setBusy(true);
    try {
      await leaderUpsertAnnualConfig({
        contributionYear: y, amountMinor, expiry,
        confirmedDeadline: preview.deadline.eth,   // the exact deadline the leader reviewed
        active,
        reason: reason.trim() || undefined,        // required by the server when changing an existing year
      });
      // FIX: after a successful save, this year now exists — the reason becomes required next time.
      setHasExisting(true);
      navigation.goBack();
    } catch (e) {
      setError(errorText(e)); // e.g. DEADLINE_NOT_CONFIRMED / reason required
    } finally {
      busyRef.current = false; setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={BRAND.violet} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHero
        icon="settings"
        title={t('funding.setupTitle')}
        subtitle={t('funding.setupSubtitle')}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: 64 }}
        >
          {error && <ErrorBanner message={error} />}

          <Lockable locked={busy}>
            <AuthField
              label={t('funding.contributionYear', { defaultValue: 'Contribution year (E.C.)' })}
              iconNode={<Ionicons name="calendar" size={18} color={BRAND.violet} />}
              value={year}
              onChangeText={setYear}
              keyboardType="phone-pad"
            />

            <View style={{ marginTop: spacing.md }}>
              <AuthField
                label={`${t('funding.amountDue')} (ETB)`}
                iconNode={<Ionicons name="cash" size={18} color={BRAND.violet} />}
                value={amountStr}
                onChangeText={setAmountStr}
                keyboardType="phone-pad"
              />
            </View>
          </Lockable>

          <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '800', marginTop: spacing.lg, marginBottom: 8 }]}>
            {t('funding.expiryDate')} · {t('funding.ethCalendar', { defaultValue: 'Ethiopian calendar' })}
          </Text>
          <Pressable
            onPress={() => { if (!busy) setPickerOpen(true); }}
            accessibilityRole="button"
            accessibilityLabel={`${t('funding.expiryDate')}: ${formatEthDate(expiry, lang)}`}
            accessibilityHint={t('funding.selectDateHint', { defaultValue: 'Tap to select date' })}
            accessibilityState={{ disabled: busy }}
            style={{
              padding: 16,
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              minHeight: 52,
              opacity: busy ? 0.55 : 1,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16 }}>{formatEthDate(expiry, lang)}</Text>
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
          </Pressable>

          <Card style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.textSecondary, fontWeight: '800' }}>
              {t('funding.deadlineCalc', { defaultValue: 'Calculated deadline (one month before expiry)' })}
            </Text>
            {previewing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <ActivityIndicator color={BRAND.violet} />
                <Text style={{ color: colors.textSecondary }}>{t('common.loading', { defaultValue: 'Loading...' })}</Text>
              </View>
            ) : preview ? (
              <View style={{ marginTop: 8 }} accessibilityLiveRegion="polite">
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 20 }}>
                  {lang === 'am' ? preview.deadline.labelAm : preview.deadline.labelEn}
                </Text>
                <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                  {lang === 'am' ? preview.deadline.labelEn : preview.deadline.labelAm}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={{ color: colors.success, fontWeight: '700', fontSize: 12 }}>
                    {t('funding.reviewed', { defaultValue: 'Reviewed — this is what will be saved' })}
                  </Text>
                </View>
              </View>
            ) : previewErr ? (
              <Text style={{ color: colors.error, marginTop: 8 }} accessibilityLiveRegion="polite">{previewErr}</Text>
            ) : (
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
                {t('funding.selectDateHint', { defaultValue: 'Tap to select date' })}
              </Text>
            )}
          </Card>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: spacing.lg,
              padding: 12,
              borderRadius: 12,
              backgroundColor: withAlpha(active ? colors.success : colors.textSecondary, 0.08),
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>
                {t('funding.activeYear', { defaultValue: 'Annual contribution active for this year' })}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                {active
                  ? t('funding.activeYearOn', { defaultValue: 'Members will see this year and can declare payments.' })
                  : t('funding.activeYearOff', { defaultValue: 'Members will not see this year until you turn it on.' })}
              </Text>
            </View>
            <Switch
              value={active}
              onValueChange={setActive}
              disabled={busy}
              trackColor={{ true: BRAND.violet }}
              accessibilityRole="switch"
              accessibilityLabel={t('funding.activeYear', { defaultValue: 'Annual contribution active for this year' })}
              accessibilityState={{ checked: active, disabled: busy }}
            />
          </View>

          <Lockable locked={busy} style={{ marginTop: spacing.md }}>
            <AuthField
              label={hasExisting
                ? t('funding.reasonChange', { defaultValue: 'Reason for change (required when editing)' })
                : t('funding.reasonOptional', { defaultValue: 'Note (optional)' })}
              iconNode={<Ionicons name="chatbox-ellipses-outline" size={18} color={BRAND.violet} />}
              value={reason}
              onChangeText={setReason}
              multiline
            />
          </Lockable>

          {hasExisting && (
            <Notice
              tone="info"
              text={t('funding.amountChangeNote', {
                defaultValue: 'A changed amount only applies to records nobody has paid or declared yet.',
              })}
            />
          )}

          <View style={{ marginTop: spacing.xl }}>
            <PrimaryButton label={t('common.save')} onPress={onSave} busy={busy} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <EthDatePicker
        visible={pickerOpen}
        title={t('funding.expiryDate')}
        value={expiry}
        onClose={() => setPickerOpen(false)}
        onConfirm={setExpiry}
        minYear={today.year - 1}
        maxYear={today.year + 6}
      />
    </View>
  );
}