import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { AuthField, PrimaryButton, ErrorBanner, BRAND, withAlpha } from '../auth/Auth_UI';
import { makeClientId, PaymentMethod } from '../../services/funding';
import { parseEtbToMinor, formatEtb } from '../../utils/money';
import { errorText, minorToInput, Notice } from './fundingKit';

export type DeclareBody = {
  clientId: string;
  amountMinor: number;
  paymentMethod: PaymentMethod;
  reference?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  defaultAmountMinor?: number;
  /** Upper bound (e.g. remaining balance). Server stays authoritative. */
  maxAmountMinor?: number;
  methods: PaymentMethod[];
  showReference?: boolean;
  onSubmit: (b: DeclareBody) => Promise<void>;
};

export default function DeclarePaymentSheet(p: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;

  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(p.methods[0] ?? 'TELEBIRR');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const clientId = useRef(makeClientId());

  useEffect(() => {
    if (!p.visible) return;
    setAmount(p.defaultAmountMinor ? minorToInput(p.defaultAmountMinor) : '');
    setReference('');
    setMethod(p.methods[0] ?? 'TELEBIRR');
    setError(null);
    clientId.current = makeClientId();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.visible]);

  const touch = () => { clientId.current = makeClientId(); setError(null); };

  const submit = async () => {
    if (busyRef.current) return; // repeated taps
    const amountMinor = parseEtbToMinor(amount);
    if (!amountMinor || amountMinor < 100) {
      return setError(t('funding.invalidFixed', { defaultValue: 'Enter a valid amount (at least 1 ETB).' }));
    }
    if (p.maxAmountMinor && amountMinor > p.maxAmountMinor) {
      return setError(t('funding.amountTooHigh', {
        defaultValue: 'Amount cannot exceed the remaining balance ({{max}}).',
        max: formatEtb(p.maxAmountMinor),
      }));
    }
    busyRef.current = true; setBusy(true); setError(null);
    try {
      await p.onSubmit({
        clientId: clientId.current,
        amountMinor,
        paymentMethod: method,
        reference: reference.trim() || undefined,
      });
      clientId.current = makeClientId();
      p.onClose();
    } catch (e) {
      setError(errorText(e)); // never show success on failure
    } finally {
      busyRef.current = false; setBusy(false);
    }
  };

  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={() => !busy && p.onClose()}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <View style={[s.sheet, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 20, marginBottom: 4 }}>{p.title}</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 16 }}>
            {t('funding.partialHint', { defaultValue: 'Enter exactly what you transferred. Partial payments are fine.' })}
          </Text>

          {p.methods.length === 0 ? (
            <Notice tone="error" text={t('funding.paymentsMissing', { defaultValue: 'Payment details are not available yet. Please contact a leader.' })} />
          ) : (
            <>
              <Text style={{ color: colors.textSecondary, fontWeight: '700', marginBottom: 8 }}>
                {t('funding.pickMethod', { defaultValue: 'Payment method used' })}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                {p.methods.map((m) => {
                  const on = method === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => { setMethod(m); touch(); }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={{
                        flex: 1, padding: 12, borderWidth: 1, borderRadius: 12,
                        borderColor: on ? BRAND.violet : colors.border,
                        backgroundColor: on ? withAlpha(BRAND.violet, 0.1) : 'transparent',
                      }}
                    >
                      <Text style={{ textAlign: 'center', fontWeight: '800', color: on ? BRAND.violet : colors.text }}>
                        {m === 'TELEBIRR' ? 'Telebirr' : t('funding.bank', { defaultValue: 'Bank' })}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <AuthField
                label={`${t('funding.amountLabel')} (ETB)`}
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
            </>
          )}

          {error && <View style={{ marginTop: spacing.sm }}><ErrorBanner message={error} /></View>}

          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            {p.methods.length > 0 && <PrimaryButton label={t('funding.confirmBtn')} onPress={submit} busy={busy} />}
            <Pressable onPress={() => !busy && p.onClose()} style={{ paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
});