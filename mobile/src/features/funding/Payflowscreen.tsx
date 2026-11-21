import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, Animated } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { AuthField, PrimaryButton, ErrorBanner, withAlpha } from '../auth/Auth_UI';
import { PaymentInstruction, PaymentMethod, makeClientId } from '../../services/funding';
import { parseEtbToMinor, formatEtb } from '../../utils/money';
import {
  DetailHeader, Notice, ErrorState, errorText, minorToInput, InstructionCard, ChoiceCards, Card, FadeUp, LoadingInline,
} from './fundingKit';
import { usePaymentInstructionsQuery, useDeclareAnnualMutation, useDeclareCampaignMutation } from './useMemberFunding';

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

  const instQ = usePaymentInstructionsQuery();
  const declareAnnualMut = useDeclareAnnualMutation();
  const declareCampaignMut = useDeclareCampaignMutation();

  const items = instQ.data?.items ?? p.instructions ?? [];
  const itemsLoading = instQ.isPending && !p.instructions;

  const [step, setStep] = useState<Step>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const methods = Array.from(new Set(items.map((i) => i.method))) as PaymentMethod[];
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState(p.defaultAmountMinor ? minorToInput(p.defaultAmountMinor) : '');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const clientId = useRef(makeClientId());
  const busy = declareAnnualMut.isPending || declareCampaignMut.isPending;

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
    if (!method) return;
    const amountMinor = parseEtbToMinor(amount);
    if (!amountMinor || amountMinor < 100) return setError(t('funding.invalidFixed'));
    if (p.maxAmountMinor && amountMinor > p.maxAmountMinor) {
      return setError(t('funding.amountTooHigh', { max: formatEtb(p.maxAmountMinor) }));
    }
    setError(null);
    try {
      const body = { clientId: clientId.current, amountMinor, paymentMethod: method, reference: reference.trim() || undefined };
      if (p.kind === 'annual') await declareAnnualMut.mutateAsync({ recordId: p.targetId, body });
      else await declareCampaignMut.mutateAsync({ campaignId: p.targetId, body });
      setStep(2);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const onBack = () => (step === 1 ? setStep(0) : navigation.goBack());

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <DetailHeader title={step === 2 ? t('funding.submittedTitle') : step === 1 ? t('funding.confirmTitle') : t('funding.payHow')} subtitle={p.title} onBack={onBack} />

      {step < 2 && <StepBar step={step} labels={[t('funding.stepTransfer'), t('funding.stepConfirm')]} />}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 48 }}>
          {step === 0 && (
            itemsLoading ? <LoadingInline />
            : instQ.isError && items.length === 0 ? <ErrorState message={errorText(instQ.error)} onRetry={() => instQ.refetch()} />
            : (
              <>
                <Notice tone="warn" text={t('funding.payWarning')} />
                {items.length === 0 && <Notice tone="error" text={t('funding.paymentsMissing')} />}

                <View style={{ marginTop: 16 }}>
                  {items.map((ins, i) => (
                    <FadeUp key={ins.id} index={i} style={{ marginBottom: 14 }}>
                      <InstructionCard ins={ins} copied={copiedId === ins.id} onCopy={() => copy(ins)} />
                    </FadeUp>
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
              <Text style={{ color: colors.textSecondary, marginBottom: 18, lineHeight: 20 }}>{t('funding.partialHint')}</Text>

              <Text style={{ color: colors.textSecondary, fontWeight: '800', fontSize: 12, marginBottom: 8 }}>{t('funding.pickMethod')}</Text>
              <ChoiceCards
                style={{ marginBottom: 18 }}
                value={method}
                onChange={(m) => { setMethod(m); touch(); }}
                options={methods.map((m) => ({
                  key: m,
                  label: m === 'TELEBIRR' ? 'Telebirr' : t('funding.bank'),
                  icon: m === 'TELEBIRR' ? 'phone-portrait-outline' as const : 'business-outline' as const,
                }))}
              />

              {!!p.maxAmountMinor && (
                <View style={{
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
                  paddingLeft: 14, paddingRight: 4, borderRadius: 16, backgroundColor: colors.surfaceAlt,
                }}>
                  <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{t('funding.remaining')}: {formatEtb(p.maxAmountMinor)}</Text>
                  <Pressable onPress={() => { setAmount(minorToInput(p.maxAmountMinor!)); touch(); }} hitSlop={8} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }}>
                    <Text style={{ color: colors.accent, fontWeight: '800' }}>{t('funding.payFull')}</Text>
                  </Pressable>
                </View>
              )}

              {method ? (
                <>
                  <AuthField label={`${t('funding.amountLabel')}`} iconNode={<Ionicons name="cash-outline" size={18} color={colors.accent} />} value={amount} onChangeText={(v: string) => { setAmount(v); touch(); }} keyboardType="phone-pad" />
                  {p.showReference !== false && (
                    <View style={{ marginTop: spacing.md }}>
                      <AuthField label={t('funding.referenceLabel')} iconNode={<Ionicons name="receipt-outline" size={18} color={colors.accent} />} value={reference} onChangeText={(v: string) => { setReference(v.slice(0, 64)); touch(); }} autoCapitalize="none" />
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
                  <ActivityIndicator color={colors.primary} />
                  <Text style={{ color: colors.textSecondary, marginTop: 12 }}>{t('common.loading')}</Text>
                </View>
              )}
            </>
          )}

          {step === 2 && (
            <View style={{ alignItems: 'center', paddingTop: 24 }}>
              <SuccessBurst />
              <Text accessibilityRole="header" style={{ color: colors.text, fontWeight: '800', fontSize: 24, marginTop: 24, textAlign: 'center' }}>{t('funding.submittedTitle')}</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 21 }}>{t('funding.submittedBodyMulti')}</Text>
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

/** Pending-verification confirmation: amber ring that pops in. */
function SuccessBurst() {
  const { theme } = useTheme();
  const { colors } = theme;
  const s = useRef(new Animated.Value(0.4)).current;
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(s, { toValue: 1, speed: 12, bounciness: 12, useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [s, o]);
  return (
    <Animated.View style={{ opacity: o, transform: [{ scale: s }], alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(colors.warning, 0.12) }}>
        <View style={{ width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(colors.warning, 0.22) }}>
          <Ionicons name="time" size={46} color={colors.warning} />
        </View>
      </View>
    </Animated.View>
  );
}

function StepBar({ step, labels }: { step: Step; labels: string[] }) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 18, gap: 10 }}>
      {labels.map((l, i) => {
        const done = i < step; const on = i === step;
        const active = done || on;
        return (
          <React.Fragment key={l}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityState={{ selected: on }}>
              <View style={{
                width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
                backgroundColor: active ? colors.primary : 'transparent', borderWidth: active ? 0 : 1.5, borderColor: colors.border,
              }}>
                {done
                  ? <Ionicons name="checkmark" size={14} color={colors.primaryText} />
                  : <Text style={{ fontSize: 12, fontWeight: '800', color: active ? colors.primaryText : colors.textSecondary }}>{i + 1}</Text>}
              </View>
              <Text style={{ fontSize: 13, fontWeight: '800', color: on ? colors.text : colors.textSecondary }}>{l}</Text>
            </View>
            {i < labels.length - 1 && <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: done ? colors.primary : colors.border }} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}