import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha, AuthField, SecondaryButton, ErrorBanner } from '../auth/Auth_UI';
import {
  playTrack, pauseTrack, resumeTrack, getCurrentKey, subscribe,
  getSnapshot, SimpleStatus,
} from '../../services/audioPlayer';
import { formatEthDate } from '../../utils/ethiopianCalendar';
import {
  PhotoCarousel,
  PhotoStrip,
  PhotoViewer,
  GradientButton,
  DatePill,
  StatusPill,
  AudioCard,
  DescriptionCard,
  Avatar,
  useEnter,
  YOUTUBE_COLORS,
  SUCCESS_COLORS,
  DANGER_COLORS,
  memoryToEthDate,
} from './Memorykit';
import {
  useLeaderMemoryQuery,
  useApproveMemoryMutation,
  useRejectMemoryMutation,
  useDeleteMemoryMutation,
} from '../leader/useLeaderSongsAndMemories';

export default function MemoryReviewDetailScreen({ route, navigation }: any) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const { colors, spacing, typography } = theme;
  const { id } = route.params;

  const q = useLeaderMemoryQuery(id);
  const approveMut = useApproveMemoryMutation();
  const rejectMut = useRejectMemoryMutation();
  const deleteMut = useDeleteMemoryMutation();

  const item = q.data;
  const firstLoad = q.isPending && q.data === undefined;
  const busy = approveMut.isPending || rejectMut.isPending || deleteMut.isPending;

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const [playerStatus, setPlayerStatus] = useState<SimpleStatus>(getSnapshot());
  useEffect(() => {
    const unsub = subscribe(setPlayerStatus);
    setPlayerStatus(getSnapshot());
    return unsub;
  }, []);

  const onApprove = async () => {
    try {
      await approveMut.mutateAsync(id);
      navigation.goBack();
    } catch {
      /* shown via error */
    }
  };

  const onReject = async () => {
    const clean = reason.trim();
    try {
      await rejectMut.mutateAsync({ id, reason: clean || undefined });
      setRejectOpen(false);
      navigation.goBack();
    } catch {
      /* shown via error */
    }
  };

  const onDelete = () => {
    Alert.alert(t('memories.deleteConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('memories.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMut.mutateAsync(id);
            navigation.goBack();
          } catch {
            /* shown via error */
          }
        },
      },
    ]);
  };

  const { fadeUp } = useEnter(!firstLoad && !!item);
  const sheetPop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (rejectOpen) {
      sheetPop.setValue(0);
      Animated.spring(sheetPop, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();
    }
  }, [rejectOpen, sheetPop]);

  if (firstLoad) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.xl }}>
        <ErrorBanner message={(q.error as { message?: string } | null)?.message ?? t('memories.notFound')} />
      </View>
    );
  }

  const photos = item.media.filter((m) => m.type === 'PHOTO');
  const audio = item.media.find((m) => m.type === 'AUDIO');
  const youtubes = item.media.filter((m) => m.type === 'YOUTUBE');
  const carouselPhotos = photos.map((p) => ({ id: p.id, uri: p.storageUrl ?? undefined }));

  const submitter = item.submittedBy.memberProfile?.fullName ?? '';

  const audioKey = `memory:${item.id}`;
  const isThisTrack = playerStatus.isLoaded && getCurrentKey() === audioKey;
  const isAudioPlaying = isThisTrack && playerStatus.isPlaying;

  const onToggleAudio = async () => {
    if (!audio?.storageUrl) return;
    if (getCurrentKey() !== audioKey) {
      await playTrack({ key: audioKey, uri: audio.storageUrl, title: item.title });
      return;
    }
    if (isAudioPlaying) await pauseTrack();
    else await resumeTrack();
  };

  const openViewer = (i: number) => {
    setViewerIndex(i);
    setViewerOpen(true);
  };

  return (
    <>
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: spacing.xl * 2 }} showsVerticalScrollIndicator={false}>
        <PhotoCarousel photos={carouselPhotos} height={300} onPressPhoto={openViewer} />

        <View style={{ marginTop: -28, backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: spacing.xl }}>
          <Animated.View style={fadeUp(0)}>
            <View style={{ alignSelf: 'flex-start' }}>
              <StatusPill label={t('memories.statusPending')} color={colors.warning} icon="time" />
            </View>
            <Text style={[typography.h1, { color: colors.text, fontWeight: '800', lineHeight: 34, marginTop: 12 }]}>
              {item.title}
            </Text>

            <View style={styles.metaRow}>
              <DatePill text={formatEthDate(memoryToEthDate(item), lang)} />
              {submitter ? (
                <View style={[styles.byChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Avatar name={submitter} size={22} />
                  <Text style={[typography.caption, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
                    {submitter}
                  </Text>
                </View>
              ) : null}
            </View>
          </Animated.View>

          {item.description ? (
            <Animated.View style={[{ marginTop: 20 }, fadeUp(1)]}>
              <DescriptionCard text={item.description} />
            </Animated.View>
          ) : null}

          {audio?.storageUrl && (
            <Animated.View style={[{ marginTop: spacing.lg }, fadeUp(2)]}>
              <AudioCard
                label={t('memories.audioAttached')}
                subtitle={item.title}
                playing={isAudioPlaying}
                onPress={onToggleAudio}
                positionMillis={isThisTrack ? playerStatus.positionMillis : undefined}
                durationMillis={isThisTrack ? playerStatus.durationMillis : undefined}
              />
            </Animated.View>
          )}

          {photos.length > 1 && (
            <Animated.View style={[{ marginTop: spacing.xl }, fadeUp(3)]}>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, fontWeight: '800', marginBottom: spacing.sm }]}>
                {t('memories.photosShort', { defaultValue: 'Photos' })} · {photos.length}
              </Text>
              <PhotoStrip photos={carouselPhotos} onPressPhoto={openViewer} />
            </Animated.View>
          )}

          {youtubes.length > 0 && (
            <Animated.View style={[{ marginTop: spacing.xl, gap: spacing.sm }, fadeUp(3)]}>
              {youtubes.map((y) => (
                <GradientButton
                  key={y.id}
                  label={t('memories.watchOnYoutube')}
                  icon="logo-youtube"
                  colors={YOUTUBE_COLORS}
                  onPress={() => navigation.navigate('MemoryVideo', { youtubeUrl: y.youtubeUrl as string, memoryTitle: item.title })}
                />
              ))}
            </Animated.View>
          )}

          {(approveMut.isError || rejectMut.isError || deleteMut.isError) && (
            <View style={{ marginTop: spacing.md }}>
              <ErrorBanner
                message={
                  (approveMut.error as { message?: string } | null)?.message ??
                  (rejectMut.error as { message?: string } | null)?.message ??
                  (deleteMut.error as { message?: string } | null)?.message ??
                  'Error'
                }
              />
            </View>
          )}

          {/* Decision area */}
          <Animated.View
            style={[
              {
                marginTop: spacing.xl,
                padding: spacing.lg,
                borderRadius: 26,
                borderWidth: 1,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              fadeUp(4),
            ]}
          >
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <GradientButton flex={1} label={t('memories.reject')} icon="close-circle" colors={DANGER_COLORS} disabled={busy} onPress={() => setRejectOpen(true)} />
              <GradientButton flex={1} label={t('memories.approve')} icon="checkmark-circle" colors={SUCCESS_COLORS} busy={approveMut.isPending} disabled={busy} onPress={onApprove} />
            </View>
            <View style={{ marginTop: spacing.md }}>
              <SecondaryButton label={t('memories.delete')} onPress={onDelete} />
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      <PhotoViewer visible={viewerOpen} photos={carouselPhotos} startIndex={viewerIndex} onClose={() => setViewerOpen(false)} />

      <Modal visible={rejectOpen} transparent animationType="fade" onRequestClose={() => setRejectOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.backdrop}>
            <Animated.View style={[styles.sheet, { backgroundColor: colors.surface, opacity: sheetPop, transform: [{ scale: sheetPop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
              <View style={[styles.sheetIcon, { backgroundColor: withAlpha(colors.error, 0.16) }]}>
                <Ionicons name="close-circle" size={30} color={colors.error} />
              </View>
              <Text style={[typography.h3, { color: colors.text, fontWeight: '800', marginTop: 12 }]}>
                {t('memories.rejectTitle')}
              </Text>
              <View style={{ marginTop: spacing.md }}>
                <AuthField
                  label={t('memories.rejectLabel')}
                  iconNode={<Ionicons name="chatbubble-ellipses" size={16} color={colors.error} />}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  placeholder={t('memories.rejectPlaceholder')}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
                <SecondaryButton label={t('common.cancel')} onPress={() => setRejectOpen(false)} flex={1} />
                <GradientButton flex={1} label={t('memories.reject')} colors={DANGER_COLORS} busy={rejectMut.isPending} onPress={onReject} />
              </View>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  byChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(5,16,19,0.65)', justifyContent: 'center', padding: 20 },
  sheet: { borderRadius: 28, padding: 22 },
  sheetIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});