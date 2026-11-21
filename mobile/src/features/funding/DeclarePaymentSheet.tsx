import React, { useEffect, useRef, useState } from 'react';
import { View, Modal, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { AuthField, PrimaryButton, ErrorBanner } from '../auth/Auth_UI';
import { makeClientId, PaymentMethod } from '../../services/funding';
import { parseEtbToMinor, formatEtb } from '../../utils/money';
import { errorText, minorToInput, Notice, SheetSurface, SheetTitle, ChoiceCards, ActionBtn, FieldLabel } from './fundingKit';

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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.backdrop, { backgroundColor: colors.overlay }]}>
        <SheetSurface>
          <SheetTitle
            icon="cash-outline"
            title={p.title}
            subtitle={t('funding.partialHint', { defaultValue: 'Enter exactly what you transferred. Partial payments are fine.' })}
          />

          {p.methods.length === 0 ? (
            <Notice tone="error" text={t('funding.paymentsMissing', { defaultValue: 'Payment details are not available yet. Please contact a leader.' })} />
          ) : (
            <>
              <FieldLabel text={t('funding.pickMethod', { defaultValue: 'Payment method used' })} />
              <ChoiceCards
                style={{ marginBottom: 16 }}
                value={method}
                onChange={(m) => { setMethod(m); touch(); }}
                options={p.methods.map((m) => ({
                  key: m,
                  label: m === 'TELEBIRR' ? 'Telebirr' : t('funding.bank', { defaultValue: 'Bank' }),
                  icon: m === 'TELEBIRR' ? 'phone-portrait-outline' as const : 'business-outline' as const,
                }))}
              />

              <AuthField
                label={`${t('funding.amountLabel')} (ETB)`}
                iconNode={<Ionicons name="cash-outline" size={18} color={colors.accent} />}
                value={amount}
                onChangeText={(v: string) => { setAmount(v); touch(); }}
                keyboardType="phone-pad"
              />
              {p.showReference !== false && (
                <View style={{ marginTop: spacing.md }}>
                  <AuthField
                    label={t('funding.referenceLabel')}
                    iconNode={<Ionicons name="receipt-outline" size={18} color={colors.accent} />}
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
            <ActionBtn variant="ghost" label={t('common.cancel')} onPress={() => !busy && p.onClose()} />
          </View>
        </SheetSurface>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
});