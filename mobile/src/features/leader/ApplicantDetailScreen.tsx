import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import {
  getApplication,
  approveApplication,
  rejectApplication,
  ApplicationDetail,
} from '../../services/leaders';
import { ApiError } from '../../services/api';
import type { LeaderStackParamList } from '../../navigation/LeaderStack';

type Props = NativeStackScreenProps<LeaderStackParamList, 'ApplicantDetail'>;

export default function ApplicantDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const { id } = route.params;

  const [item, setItem] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const detail = await getApplication(id);
        if (alive) setItem(detail);
      } catch (e) {
        const err = e as ApiError;
        if (alive) setError(`${err.message} [${err.code}]`);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const onApprove = () => {
    if (!item) return;
    Alert.alert(
      t('leader.approveConfirmTitle'),
      t('leader.approveConfirmBody', { name: item.fullName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('leader.approveConfirmYes'),
          onPress: async () => {
            setBusy(true);
            setError(null);
            try {
              await approveApplication(item.id);
              navigation.goBack();
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

  const onReject = async () => {
    if (!item) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError(t('leader.reasonRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await rejectApplication(item.id, reason);
      setRejectModalOpen(false);
      navigation.goBack();
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, marginTop: spacing.md },
          ]}
        >
          {t('leader.loadingDetail')}
        </Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
          padding: spacing.xl,
        }}
      >
        <Text style={[typography.body, { color: colors.error }]}>
          {error ?? 'Not found'}
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          backgroundColor: colors.background,
          paddingBottom: spacing.xxl,
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <Image
            source={{ uri: item.profilePhotoUrl }}
            style={{ width: 140, height: 140, borderRadius: 70 }}
          />
          <Text
            style={[
              typography.h2,
              { color: colors.text, marginTop: spacing.md, textAlign: 'center' },
            ]}
          >
            {item.fullName}
          </Text>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Row label={t('register.phone')} value={item.phone} />
          <Row label={t('register.email')} value={item.email} />
          <Row label={t('register.gender')} value={item.gender} />
          <Row
            label={t('register.dateOfBirth')}
            value={new Date(item.dateOfBirth).toISOString().slice(0, 10)}
          />
          <Row
            label={t('register.emergencyContactName')}
            value={item.emergencyContactName}
          />
          <Row
            label={t('register.emergencyContactPhone')}
            value={item.emergencyContactPhone}
          />
          {item.joiningDate && (
            <Row
              label={t('register.joiningDate')}
              value={new Date(item.joiningDate).toISOString().slice(0, 10)}
            />
          )}
          <Row
            label={t('leader.submittedAt', { when: '' })}
            value={new Date(item.createdAt).toLocaleString()}
          />
        </View>

        {error && (
          <Text
            style={[
              typography.bodySmall,
              { color: colors.error, marginTop: spacing.md },
            ]}
          >
            {error}
          </Text>
        )}

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            marginTop: spacing.xl,
          }}
        >
          <Pressable
            onPress={() => setRejectModalOpen(true)}
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
              {t('leader.reject')}
            </Text>
          </Pressable>

          <Pressable
            onPress={onApprove}
            disabled={busy}
            style={{
              flex: 1,
              paddingVertical: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.primary,
              alignItems: 'center',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={[typography.button, { color: colors.primaryText }]}>
                {t('leader.approve')}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={rejectModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'center' }}
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
              <Text style={[typography.h3, { color: colors.text }]}>
                {t('leader.rejectReasonTitle')}
              </Text>

              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.textSecondary, marginTop: spacing.md },
                ]}
              >
                {t('leader.rejectReasonLabel')}
              </Text>

              <TextInput
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder={t('leader.rejectReasonPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                style={{
                  marginTop: spacing.sm,
                  minHeight: 100,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  color: colors.text,
                  textAlignVertical: 'top',
                }}
              />

              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.md,
                  marginTop: spacing.lg,
                }}
              >
                <Pressable
                  onPress={() => {
                    setRejectModalOpen(false);
                    setRejectReason('');
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
                  onPress={onReject}
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
                  <Text style={[typography.button, { color: '#FFFFFF' }]}>
                    {t('leader.rejectSubmit')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <View style={{ marginBottom: spacing.md }}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text style={[typography.body, { color: colors.text }]}>{value}</Text>
      </View>
    );
  }
}