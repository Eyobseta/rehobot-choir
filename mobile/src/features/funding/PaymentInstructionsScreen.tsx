import React from 'react';
import { View, ScrollView, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { DetailHeader, Notice, ErrorState, errorText, InstructionCard, LoadingState, FadeUp } from './fundingKit';
import { PrimaryButton } from '../auth/Auth_UI';
import type { PayFlowParams } from './Payflowscreen';
import { usePaymentInstructionsQuery } from './useMemberFunding';

export default function PaymentInstructionsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const q = usePaymentInstructionsQuery();
  const items = q.data?.items ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const error = q.isError ? errorText(q.error) : null;

  const copy = async (val: string) => {
    await Clipboard.setStringAsync(val);
    Alert.alert(t('funding.copied'), t('funding.account'));
  };

  const proceed = () => {
    const params = route.params ?? {};
    const payParams: PayFlowParams = {
      kind: params.kind === 'campaign' ? 'campaign' : 'annual',
      targetId: String(params.targetId ?? ''),
      title: String(params.title ?? ''),
      instructions: items,
      defaultAmountMinor: params.defaultAmountMinor,
      maxAmountMinor: params.maxAmountMinor,
      showReference: params.showReference,
      resubmit: params.resubmit,
    };
    navigation.replace('PayFlow', payParams);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <DetailHeader title={t('funding.payHow')} subtitle={t('funding.selectInstruction')} onBack={() => navigation.goBack()} />

      {firstLoad ? (
        <LoadingState />
      ) : error && items.length === 0 ? (
        <ErrorState message={error} onRetry={() => q.refetch()} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}>
          <Notice tone="warn" text={t('funding.payWarning')} />

          {items.length === 0 && (
            <Notice tone="error" text={t('funding.paymentsMissing')} />
          )}

          <View style={{ marginTop: 16 }}>
            {items.map((ins, i) => (
              <FadeUp key={ins.id} index={i} style={{ marginBottom: 16 }}>
                <InstructionCard ins={ins} onCopy={() => copy(ins.accountIdentifier)} />
              </FadeUp>
            ))}
          </View>

          {items.length > 0 && (
            <PrimaryButton label={t('funding.iTransferred')} onPress={proceed} />
          )}
        </ScrollView>
      )}
    </View>
  );
}