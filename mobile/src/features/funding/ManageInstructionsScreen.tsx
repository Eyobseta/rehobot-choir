import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, KeyboardAvoidingView, Platform, Switch, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { AuthField, PrimaryButton, ErrorBanner, BRAND, withAlpha } from '../auth/Auth_UI';
import {
  PaymentInstruction, PaymentMethod, leaderListInstructions, leaderCreateInstruction, leaderUpdateInstruction,
} from '../../services/funding';
import { Card, DetailHeader, Notice, ErrorState, Pill, errorText } from './fundingKit';

const CRED = /\b(pin|otp|password|passcode|cvv)\b/i;

export default function ManageInstructionsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const navigation = useNavigation<any>();

  const [items, setItems] = useState<PaymentInstruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<PaymentInstruction | 'new' | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('BANK');
  const [provider, setProvider] = useState('');
  const [holder, setHolder] = useState('');
  const [ident, setIdent] = useState('');
  const [note, setNote] = useState('');
  const [active, setActive] = useState(true);
  const [reason, setReason] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    try { setError(null); setItems((await leaderListInstructions()).items); }
    catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openForm = (i: PaymentInstruction | 'new') => {
    setEditing(i); setFormErr(null); setReason('');
    if (i === 'new') { setMethod('BANK'); setProvider(''); setHolder(''); setIdent(''); setNote(''); setActive(true); }
    else { setMethod(i.method); setProvider(i.providerName); setHolder(i.accountHolderName); setIdent(i.accountIdentifier); setNote(i.note ?? ''); setActive(i.active); }
  };

  const save = async () => {
    if (busyRef.current) return;
    if (provider.trim().length < 2 || holder.trim().length < 2 || ident.trim().length < 3) return setFormErr(t('funding.fillAll', { defaultValue: 'Please fill in provider, account holder and account number.' }));
    if (CRED.test(note) || CRED.test(ident)) return setFormErr(t('funding.noCredentials', { defaultValue: 'Never enter PINs, OTPs or passwords here.' }));
    if (editing !== 'new' && reason.trim().length < 3) return setFormErr(t('funding.reasonShort', { defaultValue: 'Please give a reason (at least {{n}} characters).', n: 3 }));
    busyRef.current = true; setBusy(true); setFormErr(null);
    try {
      const body = { method, providerName: provider.trim(), accountHolderName: holder.trim(), accountIdentifier: ident.trim(), note: note.trim() || undefined, active };
      if (editing === 'new') await leaderCreateInstruction(body);
      else if (editing) await leaderUpdateInstruction(editing.id, { ...body, reason: reason.trim() });
      setEditing(null);
      await load();
    } catch (e) { setFormErr(errorText(e)); }
    finally { busyRef.current = false; setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <DetailHeader title={t('funding.manageInstructions', { defaultValue: 'Payment details' })}
        subtitle={t('funding.manageInstructionsSub', { defaultValue: 'Set once. Used for every campaign.' })} onBack={() => navigation.goBack()} />
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={BRAND.violet} />
        : error ? <ErrorState message={error} onRetry={load} />
        : (
          <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 64 }}>
            <Notice tone="warn" text={t('funding.noCredentials', { defaultValue: 'Never enter PINs, OTPs or passwords here.' })} />
            {items.length === 0 && <Notice tone="error" text={t('funding.paymentsMissing', { defaultValue: 'Payment details are not available yet.' })} />}
            <View style={{ marginTop: 12 }}>
              {items.map((i) => (
                <Pressable key={i.id} onPress={() => openForm(i)} accessibilityRole="button">
                  <Card style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, flex: 1 }}>{i.providerName}</Text>
                      <Pill text={i.active ? t('funding.active', { defaultValue: 'Active' }) : t('funding.inactive', { defaultValue: 'Inactive' })} color={i.active ? colors.success : colors.textSecondary} />
                    </View>
                    <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{i.method === 'BANK' ? t('funding.bank', { defaultValue: 'Bank' }) : 'Telebirr'} · {i.accountHolderName}</Text>
                    <Text style={{ color: colors.text, fontWeight: '800', marginTop: 6 }}>{i.accountIdentifier}</Text>
                  </Card>
                </Pressable>
              ))}
            </View>
            <PrimaryButton label={t('funding.addInstruction', { defaultValue: 'Add payment method' })} onPress={() => openForm('new')} />
          </ScrollView>
        )}

      <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => !busy && setEditing(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '92%' }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18, marginBottom: 12 }}>
                {editing === 'new' ? t('funding.addInstruction', { defaultValue: 'Add payment method' }) : t('funding.editInstruction', { defaultValue: 'Edit payment method' })}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                {(['BANK', 'TELEBIRR'] as const).map((m) => (
                  <Pressable key={m} onPress={() => setMethod(m)} style={{ flex: 1, padding: 12, borderWidth: 1, borderRadius: 12, borderColor: method === m ? BRAND.violet : colors.border, backgroundColor: method === m ? withAlpha(BRAND.violet, 0.1) : 'transparent' }}>
                    <Text style={{ textAlign: 'center', fontWeight: '800', color: method === m ? BRAND.violet : colors.text }}>{m === 'BANK' ? t('funding.bank', { defaultValue: 'Bank' }) : 'Telebirr'}</Text>
                  </Pressable>
                ))}
              </View>
              <AuthField label={t('funding.provider', { defaultValue: 'Bank / provider name' })} iconNode={<Ionicons name="business-outline" size={18} color={BRAND.violet} />} value={provider} onChangeText={setProvider} />
              <View style={{ marginTop: 10 }}><AuthField label={t('funding.holder')} iconNode={<Ionicons name="person-outline" size={18} color={BRAND.violet} />} value={holder} onChangeText={setHolder} /></View>
              <View style={{ marginTop: 10 }}><AuthField label={t('funding.account')} iconNode={<Ionicons name="card-outline" size={18} color={BRAND.violet} />} value={ident} onChangeText={setIdent} autoCapitalize="none" /></View>
              <View style={{ marginTop: 10 }}><AuthField label={t('funding.note', { defaultValue: 'Note (optional)' })} iconNode={<Ionicons name="document-text-outline" size={18} color={BRAND.violet} />} value={note} onChangeText={setNote} multiline /></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{t('funding.active', { defaultValue: 'Active' })}</Text>
                <Switch value={active} onValueChange={setActive} trackColor={{ true: BRAND.violet }} />
              </View>
              {editing !== 'new' && (
                <View style={{ marginTop: 10 }}><AuthField label={t('funding.reasonChange', { defaultValue: 'Reason for change (required when editing)' })} iconNode={<Ionicons name="chatbox-ellipses-outline" size={18} color={BRAND.violet} />} value={reason} onChangeText={setReason} /></View>
              )}
              {formErr && <View style={{ marginTop: 10 }}><ErrorBanner message={formErr} /></View>}
              <View style={{ marginTop: 16, gap: 8 }}>
                <PrimaryButton label={t('common.save')} onPress={save} busy={busy} />
                <Pressable onPress={() => !busy && setEditing(null)} style={{ paddingVertical: 12, alignItems: 'center' }}>
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