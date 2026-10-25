import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { Card, DetailHeader, Notice, ErrorState, errorText } from './fundingKit';
import { BRAND, withAlpha, PrimaryButton } from '../auth/Auth_UI';
import { PaymentInstruction, getPaymentInstructions } from '../../services/funding';

export default function PaymentInstructionsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const [items, setItems] = useState<PaymentInstruction[]>(route.params?.instructions ?? []);
  const [loading, setLoading] = useState(items.length === 0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems((await getPaymentInstructions()).items); }
    catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (items.length === 0) void load(); else void load().catch(() => {}); /* refresh silently */ // eslint-disable-next-line
  }, []);

  const copy = async (val: string) => {
    await Clipboard.setStringAsync(val);
    Alert.alert(t('funding.copied'), t('funding.account'));
  };

  /** Hand control back to the detail screen already in the stack and ask it to open the confirm form. */
  const proceed = () => {
    const routes = navigation.getState().routes;
    const prev = routes[routes.length - 2];
    if (prev) navigation.dispatch({ ...CommonActions.setParams({ openPayModal: true }), source: prev.key });
    navigation.goBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <DetailHeader
        title={t('funding.payHow', { defaultValue: 'How to pay' })}
        subtitle={t('funding.selectInstruction', { defaultValue: 'Transfer the money, then come back and confirm.' })}
        onBack={() => navigation.goBack()}
      />

      {loading && items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={BRAND.violet} /></View>
      ) : error && items.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 48 }}>
          <Notice tone="warn" text={t('funding.payWarning', { defaultValue: 'Only transfer to the official details shown here. Never share your PIN, OTP or password with anyone.' })} />

          {items.length === 0 && (
            <Notice tone="error" text={t('funding.paymentsMissing', { defaultValue: 'Payment details are not available yet. Please contact a leader.' })} />
          )}

          <View style={{ marginTop: 16 }}>
            {items.map((ins) => (
              <Card key={ins.id} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ backgroundColor: withAlpha(BRAND.violet, 0.14), padding: 12, borderRadius: 12 }}>
                    <Ionicons name={ins.method === 'BANK' ? 'business' : 'phone-portrait'} size={24} color={BRAND.violet} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', color: colors.text, fontSize: 16 }}>{ins.providerName}</Text>
                    <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                      {ins.method === 'BANK' ? t('funding.bank', { defaultValue: 'Bank' }) : 'Telebirr'}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: colors.textSecondary, fontWeight: '700', marginTop: 16 }}>{t('funding.holder')}</Text>
                <Text selectable style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>{ins.accountHolderName}</Text>

                <Text style={{ color: colors.textSecondary, fontWeight: '700', marginTop: 12 }}>{t('funding.account')}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <Text selectable style={{ color: colors.text, fontSize: 20, fontWeight: '800', flex: 1 }}>{ins.accountIdentifier}</Text>
                  <Pressable
                    onPress={() => copy(ins.accountIdentifier)}
                    accessibilityRole="button" accessibilityLabel="Copy account number"
                    hitSlop={8}
                    style={{ backgroundColor: withAlpha(BRAND.violet, 0.14), padding: 10, borderRadius: 10 }}
                  >
                    <Ionicons name="copy-outline" size={18} color={BRAND.violet} />
                  </Pressable>
                </View>
                {!!ins.note && <Text style={{ color: colors.textSecondary, marginTop: 12, fontStyle: 'italic' }}>{ins.note}</Text>}
              </Card>
            ))}
          </View>

          {items.length > 0 && (
            <PrimaryButton label={t('funding.iTransferred', { defaultValue: "I've Transferred" })} onPress={proceed} />
          )}
        </ScrollView>
      )}
    </View>
  );
}