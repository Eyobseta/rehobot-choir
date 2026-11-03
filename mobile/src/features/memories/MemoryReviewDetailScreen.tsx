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
  Pressable,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  PhotoViewer,
  GradientButton,
  DatePill,
  StatusPill,
  Equalizer,
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
  const { t } = useTranslation();
  const { theme } = useTheme();
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

  const audioScale = useRef(new Animated.Value(1)).current;
  const pressAudio = (v: number) =>
    Animated.spring(audioScale, {
      toValue: v,
      speed: 40,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

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
        <ActivityIndicator size="large" color={BRAND.violet} />
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
  const initial = submitter.trim().charAt(0).toUpperCase();

  const audioKey = `memory:${item.id}`;
  const isAudioPlaying =
    playerStatus.isLoaded && getCurrentKey() === audioKey && playerStatus.isPlaying;

  const onToggleAudio = async () => {
    if (!audio?.storageUrl) return;
    if (getCurrentKey() !== audioKey) {
      await playTrack({ key: audioKey, uri: audio.storageUrl, title: item.title });
      return;
    }
    if (isAudioPlaying) await pauseTrack();
    else await resumeTrack();
  };

  return (
    <>
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: spacing.xl * 2 }} showsVerticalScrollIndicator={false}>
        <PhotoCarousel
          photos={carouselPhotos}
          height={300}
          onPressPhoto={(i) => {
            setViewerIndex(i);
            setViewerOpen(true);
          }}
        />

        <View style={{ marginTop: -28, backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: spacing.xl }}>
          <Animated.View style={fadeUp(0)}>
            <StatusPill label={t('memories.statusPending')} color="#F59E0B" icon="time" />
            <Text style={[typography.h2, { color: colors.text, fontWeight: '800', marginTop: 12 }]}>
              {item.title}
            </Text>

            <View style={styles.metaRow}>
              <DatePill text={formatEthDate(memoryToEthDate(item), 'en')} />
              {submitter ? (
                <View style={[styles.byChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.avatar}>
                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>{initial}</Text>
                  </View>
                  <Text style={[typography.caption, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
                    {submitter}
                  </Text>
                </View>
              ) : null}
            </View>
          </Animated.View>

          {item.description && (
            <Animated.View style={[styles.descCard, { backgroundColor: colors.surface, borderColor: colors.border }, fadeUp(1)]}>
              <View style={[styles.quoteBar, { backgroundColor: BRAND.gold }]} />
              <Text style={[typography.body, { color: colors.text, lineHeight: 24, flex: 1 }]}>{item.description}</Text>
            </Animated.View>
          )}

          {audio?.storageUrl && (
            <Animated.View style={[{ marginTop: spacing.lg }, fadeUp(2)]}>
              <Animated.View style={{ transform: [{ scale: audioScale }], borderRadius: 24, shadowColor: BRAND.magenta, shadowOpacity: isAudioPlaying ? 0.5 : 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 7, backgroundColor: BRAND.violet }}>
                <Pressable onPress={onToggleAudio} onPressIn={() => pressAudio(0.98)} onPressOut={() => pressAudio(1)} accessibilityRole="button" accessibilityLabel={t('memories.audioAttached')}>
                  <LinearGradient colors={[BRAND.deep, BRAND.violet, BRAND.magenta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.audioCard}>
                    <View style={styles.playCircle}>
                      <Ionicons name={isAudioPlaying ? 'pause' : 'play'} size={24} color={BRAND.violet} style={{ marginLeft: isAudioPlaying ? 0 : 3 }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.audioTitle}>{t('memories.audioAttached')}</Text>
                      <Text style={styles.audioSub} numberOfLines={1}>{item.title}</Text>
                    </View>
                    <Equalizer active={isAudioPlaying} />
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            </Animated.View>
          )}

          {youtubes.length > 0 && (
            <Animated.View style={[{ marginTop: spacing.lg, gap: spacing.sm }, fadeUp(3)]}>
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

          <Animated.View style={[{ marginTop: spacing.xl }, fadeUp(4)]}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <GradientButton flex={1} label={t('memories.reject')} icon="close-circle" colors={DANGER_COLORS} disabled={busy} onPress={() => setRejectOpen(true)} />
              <GradientButton flex={1} label={t('memories.approve')} icon="checkmark-circle" colors={SUCCESS_COLORS} busy={approveMut.isPending} onPress={onApprove} />
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
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  byChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  avatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: BRAND.magenta, alignItems: 'center', justifyContent: 'center' },
  descCard: { flexDirection: 'row', gap: 14, marginTop: 20, padding: 16, borderRadius: 20, borderWidth: 1 },
  quoteBar: { width: 4, borderRadius: 2 },
  audioCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 24 },
  playCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  audioTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  audioSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 },
  sheet: { borderRadius: 28, padding: 22 },
  sheetIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});