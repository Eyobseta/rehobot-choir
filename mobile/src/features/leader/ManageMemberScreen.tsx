import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import {
  lookupMember,
  resetMemberPassword,
  deleteMember,
  MemberLookup,
} from '../../services/leaderMembers';
import { ApiError } from '../../services/api';

export default function ManageMemberScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [member, setMember] = useState<MemberLookup | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Delete modal state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const onLookup = async () => {
    setError(null);
    setMember(null);
    setBusy(true);
    try {
      const m = await lookupMember(phone.trim());
      setMember(m);
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const onReset = () => {
    if (!member) return;
    Alert.alert(
      t('leaderTools.resetPassword'),
      t('leaderTools.resetPasswordConfirm', {
        name: member.fullName ?? member.phone,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('leaderTools.resetPassword'),
          onPress: async () => {
            setBusy(true);
            try {
              const res = await resetMemberPassword(member.id);
              Alert.alert(
                t('leaderTools.resetPasswordSuccessTitle'),
                t('leaderTools.resetPasswordSuccess', { pwd: res.temporaryPassword }),
              );
            } catch (e) {
              const err = e as ApiError;
              setError(`${err.message} [${err.code}]`);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const confirmDelete = async () => {
    if (!member) return;
    if (!deletePassword) return setError(t('register.fieldRequired'));
    setBusy(true);
    setError(null);
    try {
      await deleteMember(member.id, deletePassword);
      setDeleteOpen(false);
      setDeletePassword('');
      setMember(null);
      Alert.alert(t('leaderTools.delete'), t('leaderTools.deleteSuccess'));
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          flexGrow: 1,
          backgroundColor: colors.background,
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={[typography.h2, { color: colors.primary }]}>
          {t('leaderTools.lookupTitle')}
        </Text>
        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, marginTop: spacing.xs },
          ]}
        >
          {t('leaderTools.lookupSubtitle')}
        </Text>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder={t('register.phone')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              color: colors.text,
            }}
          />
          <Pressable
            onPress={onLookup}
            disabled={busy}
            style={{
              paddingHorizontal: spacing.lg,
              justifyContent: 'center',
              borderRadius: radius.md,
              backgroundColor: colors.primary,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={[typography.button, { color: colors.primaryText }]}>
                {t('leaderTools.lookup')}
              </Text>
            )}
          </Pressable>
        </View>

        {error && (
          <Text style={[typography.bodySmall, { color: colors.error, marginTop: spacing.md }]}>
            {error}
          </Text>
        )}

        {member && (
          <View
            style={{
              marginTop: spacing.xl,
              padding: spacing.lg,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {member.profilePhotoUrl && (
                <Image
                  source={{ uri: member.profilePhotoUrl }}
                  style={{ width: 56, height: 56, borderRadius: 28 }}
                />
              )}
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
                  {member.fullName ?? '—'}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  {member.phone} · {member.role}
                </Text>
                {member.mustChangePassword && (
                  <Text style={[typography.caption, { color: colors.warning, marginTop: 2 }]}>
                    {t('password.banner')}
                  </Text>
                )}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
              <Pressable
                onPress={onReset}
                disabled={busy}
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  alignItems: 'center',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Text style={[typography.button, { color: colors.primary }]}>
                  {t('leaderTools.resetPassword')}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setDeleteOpen(true)}
                disabled={busy}
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.error,
                  alignItems: 'center',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Text style={[typography.button, { color: colors.error }]}>
                  {t('leaderTools.delete')}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: colors.overlay,
              justifyContent: 'center',
              padding: spacing.xl,
            }}
          >
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                padding: spacing.xl,
              }}
            >
              <Text style={[typography.h3, { color: colors.error }]}>
                {t('leaderTools.deleteConfirmTitle')}
              </Text>
              <Text
                style={[typography.body, { color: colors.text, marginTop: spacing.md }]}
              >
                {t('leaderTools.deleteConfirmBody', {
                  name: member?.fullName ?? member?.phone ?? '',
                })}
              </Text>

              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.xs },
                ]}
              >
                {t('leaderTools.deleteConfirmLabel')}
              </Text>
              <TextInput
                value={deletePassword}
                onChangeText={setDeletePassword}
                secureTextEntry
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  color: colors.text,
                }}
              />

              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
                <Pressable
                  onPress={() => {
                    setDeleteOpen(false);
                    setDeletePassword('');
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                  }}
                >
                  <Text style={[typography.button, { color: colors.text }]}>
                    {t('common.cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={confirmDelete}
                  disabled={busy}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: colors.error,
                    alignItems: 'center',
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={[typography.button, { color: '#FFFFFF' }]}>
                      {t('leaderTools.delete')}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}