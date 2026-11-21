import React, { useState } from 'react';
import { View, Text, ScrollView, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { AuthField, PrimaryButton, ErrorBanner } from '../auth/Auth_UI';
import { IconTile } from '../profile/SettingsKit';
import { PaymentInstruction, PaymentMethod } from '../../services/funding';
import {
  Card, DetailHeader, Notice, ErrorState, Pill, errorText, AccessiblePress, SheetSurface, SheetTitle,
  ChoiceCards, ToggleRow, ActionBtn, LoadingInline, FadeUp,
} from './fundingKit';
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
      {q.isPending && q.data === undefined ? <LoadingInline />
        : q.isError && q.data === undefined ? <ErrorState message={errorText(q.error)} onRetry={() => q.refetch()} />
        : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 64 }}>
            <Notice tone="warn" text={t('funding.noCredentials')} />
            {items.length === 0 && <Notice tone="error" text={t('funding.paymentsMissing')} />}
            <View style={{ marginTop: 14, marginBottom: 6 }}>
              {items.map((i, idx) => (
                <FadeUp key={i.id} index={idx} style={{ marginBottom: 10 }}>
                  <AccessiblePress onPress={() => openForm(i)} accessibilityLabel={i.providerName}>
                    <Card style={{ padding: 14, opacity: i.active ? 1 : 0.75 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <IconTile name={i.method === 'BANK' ? 'business-outline' : 'phone-portrait-outline'} tone={i.method === 'BANK' ? 'lavender' : 'mint'} size={46} iconSize={22} radius={15} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>{i.providerName}</Text>
                          <Text style={{ color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{i.method === 'BANK' ? t('funding.bank') : 'Telebirr'} · {i.accountHolderName}</Text>
                        </View>
                        <Pill text={i.active ? t('funding.active') : t('funding.inactive')} color={i.active ? colors.success : colors.textSecondary} />
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.surfaceAlt }}>
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, flex: 1, letterSpacing: 0.4 }}>{i.accountIdentifier}</Text>
                        <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                      </View>
                    </Card>
                  </AccessiblePress>
                </FadeUp>
              ))}
            </View>
            <PrimaryButton label={t('funding.addInstruction')} onPress={() => openForm('new')} />
          </ScrollView>
        )}

      <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => !saveMut.isPending && setEditing(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <SheetSurface style={{ maxHeight: '92%' }}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <SheetTitle
                icon={editing === 'new' ? 'add-circle-outline' : 'create-outline'}
                title={editing === 'new' ? t('funding.addInstruction') : t('funding.editInstruction')}
              />
              <ChoiceCards
                style={{ marginBottom: 14 }}
                value={method}
                onChange={setMethod}
                options={[
                  { key: 'BANK', label: t('funding.bank'), icon: 'business-outline' },
                  { key: 'TELEBIRR', label: 'Telebirr', icon: 'phone-portrait-outline' },
                ]}
              />
              <AuthField label={t('funding.provider')} iconNode={<Ionicons name="business-outline" size={18} color={colors.accent} />} value={provider} onChangeText={setProvider} />
              <View style={{ marginTop: 10 }}><AuthField label={t('funding.holder')} iconNode={<Ionicons name="person-outline" size={18} color={colors.accent} />} value={holder} onChangeText={setHolder} /></View>
              <View style={{ marginTop: 10 }}><AuthField label={t('funding.account')} iconNode={<Ionicons name="card-outline" size={18} color={colors.accent} />} value={ident} onChangeText={setIdent} autoCapitalize="none" /></View>
              <View style={{ marginTop: 10 }}><AuthField label={t('funding.note')} iconNode={<Ionicons name="document-text-outline" size={18} color={colors.accent} />} value={note} onChangeText={setNote} multiline /></View>
              <View style={{ marginTop: 14 }}>
                <ToggleRow title={t('funding.active')} value={active} onValueChange={setActive} positive />
              </View>
              {editing !== 'new' && (
                <View style={{ marginTop: 10 }}><AuthField label={t('funding.reasonChange')} iconNode={<Ionicons name="chatbox-ellipses-outline" size={18} color={colors.accent} />} value={reason} onChangeText={setReason} /></View>
              )}
              {formErr && <View style={{ marginTop: 10 }}><ErrorBanner message={formErr} /></View>}
              <View style={{ marginTop: 16, gap: 8 }}>
                <PrimaryButton label={t('common.save')} onPress={save} busy={saveMut.isPending} />
                <ActionBtn variant="ghost" label={t('common.cancel')} onPress={() => !saveMut.isPending && setEditing(null)} />
              </View>
            </ScrollView>
          </SheetSurface>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}