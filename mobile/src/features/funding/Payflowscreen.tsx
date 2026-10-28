import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { AuthField, PrimaryButton, ErrorBanner, BRAND, withAlpha } from '../auth/Auth_UI';
import {
  PaymentInstruction, PaymentMethod, getPaymentInstructions, declareAnnualPayment, declareCampaignPayment, makeClientId,
} from '../../services/funding';
import { parseEtbToMinor, formatEtb } from '../../utils/money';
import { Card, DetailHeader, Notice, ErrorState, errorText, minorToInput } from './fundingKit';

export type PayFlowParams = {
  kind: 'annual' | 'campaign';
  targetId: string;
  title: string;
  instructions?: PaymentInstruction[];
  defaultAmountMinor?: number;
  maxAmountMinor?: number;
  showReference?: boolean;
  resubmit?: boolean;
};

type Step = 0 | 1 | 2;

export default function PayFlowScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const p = route.params as PayFlowParams;

  const [step, setStep] = useState<Step>(0);
  const [items, setItems] = useState<PaymentInstruction[]>(p.instructions ?? []);
  const [loading, setLoading] = useState((p.instructions ?? []).length === 0);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const methods = Array.from(new Set(items.map((i) => i.method))) as PaymentMethod[];
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState(p.defaultAmountMinor ? minorToInput(p.defaultAmountMinor) : '');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const clientId = useRef(makeClientId());

  const loadInstructions = useCallback(async () => {
    setLoading(true); setLoadErr(null);
    try {
      const res = await getPaymentInstructions();
      setItems(res.items);
    }
    catch (e) { setLoadErr(errorText(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (items.length === 0) void loadInstructions(); /* eslint-disable-next-line */ }, []);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  useEffect(() => { if (!method && methods.length > 0) setMethod(methods[0]); }, [methods, method]);

  const copy = async (ins: PaymentInstruction) => {
    await Clipboard.setStringAsync(ins.accountIdentifier);
    setCopiedId(ins.id);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedId(null), 2000);
  };

  const touch = () => { clientId.current = makeClientId(); setError(null); };

  const submit = async () => {
    if (busyRef.current || !method) return;
    const amountMinor = parseEtbToMinor(amount);
    if (!amountMinor || amountMinor < 100) return setError(t('funding.invalidFixed'));
    if (p.maxAmountMinor && amountMinor > p.maxAmountMinor) {
      return setError(t('funding.amountTooHigh', { max: formatEtb(p.maxAmountMinor) }));
    }
    busyRef.current = true; setBusy(true); setError(null);
    try {
      const body = { clientId: clientId.current, amountMinor, paymentMethod: method, reference: reference.trim() || undefined };
      if (p.kind === 'annual') await declareAnnualPayment(p.targetId, body);
      else await declareCampaignPayment(p.targetId, body);
      setStep(2);
    } catch (e) {
      setError(errorText(e));
    } finally {
      busyRef.current = false; setBusy(false);
    }
  };

  const onBack = () => (step === 1 ? setStep(0) : navigation.goBack());

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <DetailHeader
        title={step === 2 ? t('funding.submittedTitle') : step === 1 ? t('funding.confirmTitle') : t('funding.payHow')}
        subtitle={p.title}
        onBack={onBack}
      />

      {step < 2 && <StepBar step={step} labels={[t('funding.stepTransfer'), t('funding.stepConfirm')]} />}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl, paddingBottom: insets.bottom + 48 }}>
          {step === 0 && (
            loading ? <ActivityIndicator size="large" color={BRAND.violet} style={{ marginTop: 40 }} />
            : loadErr && items.length === 0 ? <ErrorState message={loadErr} onRetry={loadInstructions} />
            : (
              <>
                <Notice tone="warn" text={t('funding.payWarning')} />
                {items.length === 0 && <Notice tone="error" text={t('funding.paymentsMissing')} />}

                <View style={{ marginTop: 16 }}>
                  {items.map((ins) => (
                    <Card key={ins.id} style={{ marginBottom: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ backgroundColor: withAlpha(BRAND.violet, 0.14), padding: 12, borderRadius: 12 }}>
                          <Ionicons name={ins.method === 'BANK' ? 'business' : 'phone-portrait'} size={22} color={BRAND.violet} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '800', color: colors.text, fontSize: 16 }}>{ins.providerName}</Text>
                          <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                            {ins.method === 'BANK' ? t('funding.bank') : 'Telebirr'}
                          </Text>
                        </View>
                      </View>

                      <Text style={{ color: colors.textSecondary, fontWeight: '700', marginTop: 16 }}>{t('funding.holder')}</Text>
                      <Text selectable style={{ color: colors.text, fontWeight: '600', fontSize: 16, marginTop: 2 }}>{ins.accountHolderName}</Text>

                      <Text style={{ color: colors.textSecondary, fontWeight: '700', marginTop: 12 }}>{t('funding.account')}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 10 }}>
                        <Text selectable style={{ color: colors.text, fontSize: 20, fontWeight: '800', flex: 1 }}>{ins.accountIdentifier}</Text>
                        <Pressable
                          onPress={() => copy(ins)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={t('funding.copy')}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: withAlpha(BRAND.violet, 0.14), paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, minHeight: 44 }}
                        >
                          <Ionicons name={copiedId === ins.id ? 'checkmark' : 'copy-outline'} size={16} color={BRAND.violet} />
                          <Text style={{ color: BRAND.violet, fontWeight: '800' }}>{copiedId === ins.id ? t('funding.copied') : t('funding.copy')}</Text>
                        </Pressable>
                      </View>
                      {!!ins.note && <Text style={{ color: colors.textSecondary, marginTop: 12, fontStyle: 'italic' }}>{ins.note}</Text>}
                    </Card>
                  ))}
                </View>

                {items.length > 0 && (
                  <>
                    <Text style={{ color: colors.textSecondary, marginBottom: 12, textAlign: 'center' }}>{t('funding.transferFirst')}</Text>
                    <PrimaryButton label={t('funding.iTransferred')} onPress={() => setStep(1)} />
                  </>
                )}
              </>
            )
          )}

          {step === 1 && (
            <>
              <Text style={{ color: colors.textSecondary, marginBottom: 16 }}>{t('funding.partialHint')}</Text>

              <Text style={{ color: colors.textSecondary, fontWeight: '700', marginBottom: 8 }}>{t('funding.pickMethod')}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                {methods.map((m) => {
                  const on = method === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => { setMethod(m); touch(); }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={{ flex: 1, padding: 14, borderWidth: 1.5, borderRadius: 14, borderColor: on ? BRAND.violet : colors.border, backgroundColor: on ? withAlpha(BRAND.violet, 0.1) : colors.surface, minHeight: 44 }}
                    >
                      <Text style={{ textAlign: 'center', fontWeight: '800', color: on ? BRAND.violet : colors.text }}>
                        {m === 'TELEBIRR' ? 'Telebirr' : t('funding.bank')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {!!p.maxAmountMinor && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>
                    {t('funding.remaining')}: {formatEtb(p.maxAmountMinor)}
                  </Text>
                  <Pressable onPress={() => { setAmount(minorToInput(p.maxAmountMinor!)); touch(); }} hitSlop={8} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                    <Text style={{ color: BRAND.violet, fontWeight: '800' }}>{t('funding.payFull')}</Text>
                  </Pressable>
                </View>
              )}

              {method ? (
                <>
                  <AuthField
                    label={`${t('funding.amountLabel')}`}
                    iconNode={<Ionicons name="cash-outline" size={18} color={BRAND.violet} />}
                    value={amount}
                    onChangeText={(v: string) => { setAmount(v); touch(); }}
                    keyboardType="phone-pad"
                  />
                  {p.showReference !== false && (
                    <View style={{ marginTop: spacing.md }}>
                      <AuthField
                        label={t('funding.referenceLabel')}
                        iconNode={<Ionicons name="receipt-outline" size={18} color={BRAND.violet} />}
                        value={reference}
                        onChangeText={(v: string) => { setReference(v.slice(0, 64)); touch(); }}
                        autoCapitalize="none"
                      />
                    </View>
                  )}

                  <Notice tone="info" text={t('funding.notPaidYet')} />
                  {error && <View style={{ marginTop: spacing.md }}><ErrorBanner message={error} /></View>}

                  <View style={{ marginTop: spacing.lg }}>
                    <PrimaryButton label={t('funding.confirmBtn')} onPress={submit} busy={busy} />
                  </View>
                </>
              ) : (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator color={BRAND.violet} />
                  <Text style={{ color: colors.textSecondary, marginTop: 12 }}>
                    {t('common.loading', { defaultValue: 'Loading…' })}
                  </Text>
                </View>
              )}
            </>
          )}

          {step === 2 && (
            <View style={{ alignItems: 'center', paddingTop: 24 }}>
              <View style={{ width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha('#F59E0B', 0.16) }}>
                <Ionicons name="time" size={42} color="#F59E0B" />
              </View>
              <Text accessibilityRole="header" style={{ color: colors.text, fontWeight: '800', fontSize: 22, marginTop: 20, textAlign: 'center' }}>
                {t('funding.submittedTitle')}
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
                {t('funding.submittedBodyMulti', { defaultValue: 'Your declaration is waiting for a leader to verify. You can still declare another payment anytime.' })}
              </Text>
              <View style={{ alignSelf: 'stretch', marginTop: 32 }}>
                <PrimaryButton label={t('funding.done')} onPress={() => navigation.goBack()} />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function StepBar({ step, labels }: { step: Step; labels: string[] }) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 24, paddingTop: 16, gap: 10 }}>
      {labels.map((l, i) => {
        const done = i < step; const on = i === step;
        const c = done || on ? BRAND.violet : colors.border;
        return (
          <View key={l} style={{ flex: 1 }} accessibilityState={{ selected: on }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: c }} />
            <Text style={{ marginTop: 6, fontSize: 12, fontWeight: '800', color: on ? BRAND.violet : colors.textSecondary }}>
              {i + 1}. {l}
            </Text>
          </View>
        );
      })}
    </View>
  );
}