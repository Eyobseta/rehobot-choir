import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import {
  leaderListPendingSubmissions,
  leaderApproveSubmission,
  leaderReturnSubmission,
  PendingSubmission,
} from '../../services/songs';
import { ApiError } from '../../services/api';

export default function SongReviewScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [items, setItems] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState<PendingSubmission | null>(null);
  const [returnTarget, setReturnTarget] = useState<PendingSubmission | null>(
    null,
  );
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await leaderListPendingSubmissions());
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const onApprove = async (sub: PendingSubmission) => {
    setBusy(true);
    try {
      await leaderApproveSubmission(sub.id);
      setDetailOpen(null);
      await load();
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const onReturn = async () => {
    if (!returnTarget) return;
    const clean = reason.trim();
    if (!clean) {
      setError(t('leaderSongs.reasonRequired'));
      return;
    }
    setBusy(true);
    try {
      await leaderReturnSubmission(returnTarget.id, clean);
      setReturnTarget(null);
      setDetailOpen(null);
      setReason('');
      await load();
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
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          error ? (
            <Text
              style={[
                typography.bodySmall,
                { color: colors.error, marginBottom: spacing.sm },
              ]}
            >
              {error}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {t('leaderSongs.emptyReview')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setDetailOpen(item)}
            style={{
              padding: spacing.md,
              marginBottom: spacing.md,
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={[
                typography.body,
                { color: colors.text, fontWeight: '600' },
              ]}
              numberOfLines={1}
            >
              {item.song.title}
            </Text>
            {item.song.category && (
              <Text
                style={[
                  typography.caption,
                  { color: colors.textSecondary, marginTop: 2 },
                ]}
              >
                {item.song.category.name}
              </Text>
            )}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: spacing.md,
              }}
            >
              {item.submittedBy.memberProfile?.profilePhotoUrl && (
                <Image
                  source={{
                    uri: item.submittedBy.memberProfile.profilePhotoUrl,
                  }}
                  style={{ width: 28, height: 28, borderRadius: 14 }}
                />
              )}
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.textSecondary, marginLeft: spacing.sm },
                ]}
              >
                {item.submittedBy.memberProfile?.fullName ?? ''}
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                marginTop: spacing.md,
                gap: spacing.xs,
              }}
            >
              <Text style={[typography.caption, { color: colors.primary }]}>
                {t('leaderSongs.tapToReview')}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </View>
          </Pressable>
        )}
      />

      {/* Detail modal */}
      <Modal
        visible={detailOpen !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailOpen(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              padding: spacing.lg,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              maxHeight: '90%',
            }}
          >
            <ScrollView>
              <Text style={[typography.h3, { color: colors.text }]}>
                {detailOpen?.song.title}
              </Text>

              {detailOpen?.song.category && (
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textSecondary, marginTop: 2 },
                  ]}
                >
                  {detailOpen.song.category.name}
                </Text>
              )}

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: spacing.md,
                }}
              >
                {detailOpen?.submittedBy.memberProfile?.profilePhotoUrl && (
                  <Image
                    source={{
                      uri: detailOpen.submittedBy.memberProfile
                        .profilePhotoUrl,
                    }}
                    style={{ width: 32, height: 32, borderRadius: 16 }}
                  />
                )}
                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.textSecondary, marginLeft: spacing.sm },
                  ]}
                >
                  {detailOpen?.submittedBy.memberProfile?.fullName ?? ''}
                </Text>
              </View>

              {detailOpen?.song.lyrics && (
                <View style={{ marginTop: spacing.lg }}>
                  <Text
                    style={[
                      typography.bodySmall,
                      {
                        color: colors.textSecondary,
                        marginBottom: spacing.xs,
                      },
                    ]}
                  >
                    {t('songs.lyrics')}
                  </Text>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      backgroundColor: colors.surface,
                      maxHeight: 260,
                    }}
                  >
                    <ScrollView nestedScrollEnabled>
                      <Text
                        selectable
                        style={[
                          typography.body,
                          { color: colors.text, lineHeight: 22 },
                        ]}
                      >
                        {detailOpen.song.lyrics}
                      </Text>
                    </ScrollView>
                  </View>
                </View>
              )}

              {detailOpen?.song.youtubeUrl && (
                <Pressable
                  onPress={() =>
                    Linking.openURL(detailOpen.song.youtubeUrl as string)
                  }
                  style={{
                    marginTop: spacing.lg,
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
                    {t('songs.watchOnYoutube')}
                  </Text>
                </Pressable>
              )}

              {detailOpen?.song.audioUrl && (
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
                  <Ionicons
                    name="musical-notes"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={[typography.bodySmall, { color: colors.text }]}>
                    {t('leaderSongs.audioAttached')}
                  </Text>
                </View>
              )}
            </ScrollView>

            <View
              style={{
                flexDirection: 'row',
                gap: spacing.md,
                marginTop: spacing.lg,
              }}
            >
              <Pressable
                onPress={() => {
                  if (detailOpen) {
                    setReturnTarget(detailOpen);
                    setReason('');
                    setError(null);
                  }
                }}
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
                  {t('leaderSongs.returnBtn')}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => detailOpen && onApprove(detailOpen)}
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
                <Text
                  style={[typography.button, { color: colors.primaryText }]}
                >
                  {t('leaderSongs.approveBtn')}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => setDetailOpen(null)}
              style={{
                marginTop: spacing.md,
                paddingVertical: spacing.md,
                alignItems: 'center',
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={[typography.button, { color: colors.text }]}>
                {t('common.cancel')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Return reason modal */}
      <Modal
        visible={!!returnTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setReturnTarget(null)}
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
                {t('leaderSongs.returnTitle')}
              </Text>
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.textSecondary, marginTop: spacing.md },
                ]}
              >
                {t('leaderSongs.returnLabel')}
              </Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                multiline
                placeholder={t('leaderSongs.returnPlaceholder')}
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
                  onPress={() => setReturnTarget(null)}
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
                  onPress={onReturn}
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
                    {t('leaderSongs.returnBtn')}
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