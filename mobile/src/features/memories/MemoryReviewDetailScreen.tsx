import React, { useCallback, useEffect, useState } from 'react';
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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import {
  leaderGetMemory,
  leaderApproveMemory,
  leaderRejectMemory,
  PendingMemory,
} from '../../services/memories';
import { ApiError } from '../../services/api';

export default function MemoryReviewDetailScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const { id } = route.params;

  const [item, setItem] = useState<PendingMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setItem(await leaderGetMemory(id));
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const onApprove = async () => {
    setBusy(true);
    try {
      await leaderApproveMemory(id);
      navigation.goBack();
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const onReject = async () => {
    const clean = reason.trim();
    setBusy(true);
    try {
      await leaderRejectMemory(id, clean || undefined);
      setRejectOpen(false);
      navigation.goBack();
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    Alert.alert(
      t('memories.deleteConfirm'),
      undefined,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('memories.delete'),
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const { leaderDeleteMemory } = await import(
                '../../services/memories'
              );
              await leaderDeleteMemory(id);
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

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
          padding: spacing.xl,
        }}
      >
        <Text style={[typography.body, { color: colors.error }]}>
          {error ?? t('memories.notFound')}
        </Text>
      </View>
    );
  }

  const photos = item.media.filter((m) => m.type === 'PHOTO');
  const audio = item.media.find((m) => m.type === 'AUDIO');
  const youtubes = item.media.filter((m) => m.type === 'YOUTUBE');

  return (
    <>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: spacing.xl,
          backgroundColor: colors.background,
        }}
      >
        {photos.length > 0 && (
          <ScrollView horizontal pagingEnabled>
            {photos.map((p) => (
              <Image
                key={p.id}
                source={{ uri: p.storageUrl ?? undefined }}
                style={{ width: 380, height: 260 }}
              />
            ))}
          </ScrollView>
        )}

        <View style={{ padding: spacing.xl }}>
          <Text style={[typography.h2, { color: colors.text }]}>
            {item.title}
          </Text>
          <Text
            style={[
              typography.caption,
              { color: colors.textSecondary, marginTop: spacing.xs },
            ]}
          >
            {new Date(item.date).toISOString().slice(0, 10)}
          </Text>
          <Text
            style={[
              typography.caption,
              { color: colors.textSecondary, marginTop: 2 },
            ]}
          >
            {item.submittedBy.memberProfile?.fullName ?? ''}
          </Text>

          {item.description && (
            <Text
              style={[
                typography.body,
                { color: colors.text, marginTop: spacing.lg, lineHeight: 22 },
              ]}
            >
              {item.description}
            </Text>
          )}

          {audio?.storageUrl && (
            <View
              style={{
                marginTop: spacing.md,
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <Ionicons name="musical-notes" size={20} color={colors.primary} />
              <Text style={[typography.bodySmall, { color: colors.text }]}>
                {t('memories.audioAttached')}
              </Text>
            </View>
          )}

          {youtubes.map((y) => (
            <Pressable
              key={y.id}
              onPress={() => Linking.openURL(y.youtubeUrl as string)}
              style={{
                marginTop: spacing.sm,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                backgroundColor: '#FF0000',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
              }}
            >
              <Ionicons name="logo-youtube" size={20} color="#FFFFFF" />
              <Text style={[typography.button, { color: '#FFFFFF' }]}>
                {t('memories.watchOnYoutube')}
              </Text>
            </Pressable>
          ))}

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
            style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}
          >
            <Pressable
              onPress={() => setRejectOpen(true)}
              disabled={busy}
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.error,
                alignItems: 'center',
              }}
            >
              <Text style={[typography.button, { color: colors.error }]}>
                {t('memories.reject')}
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
              <Text style={[typography.button, { color: colors.primaryText }]}>
                {t('memories.approve')}
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={onDelete}
            disabled={busy}
            style={{
              marginTop: spacing.md,
              paddingVertical: spacing.md,
              alignItems: 'center',
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={[typography.button, { color: colors.textSecondary }]}>
              {t('memories.delete')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={rejectOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)',
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
                {t('memories.rejectTitle')}
              </Text>
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.textSecondary, marginTop: spacing.md },
                ]}
              >
                {t('memories.rejectLabel')}
              </Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                multiline
                placeholder={t('memories.rejectPlaceholder')}
                placeholderTextColor={colors.textSecondary}
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
                  onPress={() => setRejectOpen(false)}
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
                    {t('memories.reject')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}