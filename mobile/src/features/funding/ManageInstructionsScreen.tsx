import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, KeyboardAvoidingView, Platform, Switch, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { AuthField, PrimaryButton, ErrorBanner, BRAND, withAlpha } from '../auth/Auth_UI';
import { PaymentInstruction, PaymentMethod } from '../../services/funding';
import { Card, DetailHeader, Notice, ErrorState, Pill, errorText } from './fundingKit';
import { useLeaderInstructionsQuery, useSaveInstructionMutation } from './useLeaderFunding';

const CRED = /\b(pin|otp|password|passcode|cvv)\b/i;

export default function ManageInstructionsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const navigation = useNavigation<any>();

  const q = useLeaderInstructionsQuery();
  const saveMut = useSaveInstructionMutation();

  const items = q.data?.items ?? [];
  const [editing, setEditing] = useState<PaymentInstruction | 'new' | null>(null);
  
  const [method, setMethod] = useState<PaymentMethod>('BANK');
  const [provider, setProvider] = useState('');
  const [holder, setHolder] = useState('');
  const [ident, setIdent] = useState('');
  const [note, setNote] = useState('');
  const [active, setActive] = useState(true);
  const [reason, setReason] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);

  const openForm = (i: PaymentInstruction | 'new') => {
    setEditing(i); setFormErr(null); setReason('');
    if (i === 'new') { setMethod('BANK'); setProvider(''); setHolder(''); setIdent(''); setNote(''); setActive(true); }
    else { setMethod(i.method); setProvider(i.providerName); setHolder(i.accountHolderName); setIdent(i.accountIdentifier); setNote(i.note ?? ''); setActive(i.active); }
  };

  const save = async () => {
    if (provider.trim().length < 2 || holder.trim().length < 2 || ident.trim().length < 3) return setFormErr(t('funding.fillAll'));
    if (CRED.test(note) || CRED.test(ident)) return setFormErr(t('funding.noCredentials'));
    if (editing !== 'new' && reason.trim().length < 3) return setFormErr(t('funding.reasonShort', { n: 3 }));
    
    setFormErr(null);
    try {
      const body = { method, providerName: provider.trim(), accountHolderName: holder.trim(), accountIdentifier: ident.trim(), note: note.trim() || undefined, active };
      if (editing === 'new') await saveMut.mutateAsync({ input: body });
      else if (editing) await saveMut.mutateAsync({ id: editing.id, input: { ...body, reason: reason.trim() } });
      setEditing(null);
    } catch (e) {
      setFormErr(errorText(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <DetailHeader title={t('funding.manageInstructions')} subtitle={t('funding.manageInstructionsSub')} onBack={() => navigation.goBack()} />
      {q.isPending && q.data === undefined ? <ActivityIndicator style={{ marginTop: 40 }} color={BRAND.violet} />
        : q.isError && q.data === undefined ? <ErrorState message={errorText(q.error)} onRetry={() => q.refetch()} />
        : (
          <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 64 }}>
            <Notice tone="warn" text={t('funding.noCredentials')} />
            {items.length === 0 && <Notice tone="error" text={t('funding.paymentsMissing')} />}
            <View style={{ marginTop: 12 }}>
              {items.map((i) => (
                <Pressable key={i.id} onPress={() => openForm(i)} accessibilityRole="button">
                  <Card style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, flex: 1 }}>{i.providerName}</Text>
                      <Pill text={i.active ? t('funding.active') : t('funding.inactive')} color={i.active ? colors.success : colors.textSecondary} />
                    </View>
                    <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{i.method === 'BANK' ? t('funding.bank') : 'Telebirr'} · {i.accountHolderName}</Text>
                    <Text style={{ color: colors.text, fontWeight: '800', marginTop: 6 }}>{i.accountIdentifier}</Text>
                  </Card>
                </Pressable>
              ))}
            </View>
            <PrimaryButton label={t('funding.addInstruction')} onPress={() => openForm('new')} />
          </ScrollView>
        )}

      <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => !saveMut.isPending && setEditing(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '92%' }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18, marginBottom: 12 }}>
                {editing === 'new' ? t('funding.addInstruction') : t('funding.editInstruction')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                {(['BANK', 'TELEBIRR'] as const).map((m) => (
                  <Pressable key={m} onPress={() => setMethod(m)} style={{ flex: 1, padding: 12, borderWidth: 1, borderRadius: 12, borderColor: method === m ? BRAND.violet : colors.border, backgroundColor: method === m ? withAlpha(BRAND.violet, 0.1) : 'transparent' }}>
                    <Text style={{ textAlign: 'center', fontWeight: '800', color: method === m ? BRAND.violet : colors.text }}>{m === 'BANK' ? t('funding.bank') : 'Telebirr'}</Text>
                  </Pressable>
                ))}
              </View>
              <AuthField label={t('funding.provider')} iconNode={<Ionicons name="business-outline" size={18} color={BRAND.violet} />} value={provider} onChangeText={setProvider} />
              <View style={{ marginTop: 10 }}><AuthField label={t('funding.holder')} iconNode={<Ionicons name="person-outline" size={18} color={BRAND.violet} />} value={holder} onChangeText={setHolder} /></View>
              <View style={{ marginTop: 10 }}><AuthField label={t('funding.account')} iconNode={<Ionicons name="card-outline" size={18} color={BRAND.violet} />} value={ident} onChangeText={setIdent} autoCapitalize="none" /></View>
              <View style={{ marginTop: 10 }}><AuthField label={t('funding.note')} iconNode={<Ionicons name="document-text-outline" size={18} color={BRAND.violet} />} value={note} onChangeText={setNote} multiline /></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{t('funding.active')}</Text>
                <Switch value={active} onValueChange={setActive} trackColor={{ true: BRAND.violet }} />
              </View>
              {editing !== 'new' && (
                <View style={{ marginTop: 10 }}><AuthField label={t('funding.reasonChange')} iconNode={<Ionicons name="chatbox-ellipses-outline" size={18} color={BRAND.violet} />} value={reason} onChangeText={setReason} /></View>
              )}
              {formErr && <View style={{ marginTop: 10 }}><ErrorBanner message={formErr} /></View>}
              <View style={{ marginTop: 16, gap: 8 }}>
                <PrimaryButton label={t('common.save')} onPress={save} busy={saveMut.isPending} />
                <Pressable onPress={() => !saveMut.isPending && setEditing(null)} style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{t('common.cancel')}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}