import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { MemoryMediaItem } from '../../services/memories';
import {
  playTrack,
  pauseTrack,
  resumeTrack,
  getCurrentKey,
  subscribe,
  getSnapshot,
  SimpleStatus,
} from '../../services/audioPlayer';
import { ErrorBanner, BRAND, withAlpha } from '../auth/Auth_UI';
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
  SavedPill,
  useEnter,
  YOUTUBE_COLORS,
  memoryToEthDate,
} from './Memorykit';
import GlassBackButton from '../../components/GlassBackButton';
import { useMemoryDetailQuery } from './useMemories';

export default function MemoryDetailScreen({ route, navigation }: any) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();
  const { id, mineOnly } = route.params as { id: string; mineOnly?: boolean };

  const q = useMemoryDetailQuery(id, mineOnly);
  const item = q.data;
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  const [playerStatus, setPlayerStatus] = useState<SimpleStatus>(getSnapshot());
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    const unsub = subscribe(setPlayerStatus);
    setPlayerStatus(getSnapshot());
    return unsub;
  }, []);

  const { fadeUp } = useEnter(!firstLoad && !!item);

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
        <ErrorBanner message={(q.error as any)?.message ?? t('memories.notFound')} />
        <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>
      </View>
    );
  }

  const photos = item.media.filter((m) => m.type === 'PHOTO');
  const audio = item.media.find((m) => m.type === 'AUDIO');
  const youtubes = item.media.filter((m) => m.type === 'YOUTUBE');

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

  const carouselPhotos = photos.map((p: MemoryMediaItem) => ({ id: p.id, uri: p.storageUrl ?? undefined }));
  const isNonPublished = mineOnly && item.status !== 'PUBLISHED';
  const isPending = item.status === 'PENDING_REVIEW';
  const noteColor = isPending ? colors.warning : colors.error;

  const openViewer = (i: number) => {
    setViewerIndex(i);
    setViewerOpen(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl * 2 }} showsVerticalScrollIndicator={false}>
        <PhotoCarousel photos={carouselPhotos} height={340} onPressPhoto={openViewer} />

        <View style={{ marginTop: -28, backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: spacing.xl }}>
          {showingSavedData && (
            <View style={{ marginBottom: spacing.md }}>
              <SavedPill />
            </View>
          )}

          <Animated.View style={fadeUp(0)}>
            <Text style={[typography.h1, { color: colors.text, fontWeight: '800', lineHeight: 34 }]}>{item.title}</Text>
            <View style={styles.metaRow}>
              <DatePill text={formatEthDate(memoryToEthDate(item), lang)} />
              {photos.length > 0 && <StatusPill label={String(photos.length)} color={colors.accent} icon="images" />}
              {audio && <StatusPill label={t('memories.audioShort', { defaultValue: 'Audio' })} color={colors.accent} icon="musical-notes" />}
              {youtubes.length > 0 && <StatusPill label={String(youtubes.length)} color="#FF2D2D" icon="logo-youtube" />}
            </View>
          </Animated.View>

          {isNonPublished && (
            <Animated.View
              style={[
                {
                  marginTop: 18,
                  padding: 14,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  backgroundColor: withAlpha(noteColor, 0.12),
                  borderWidth: 1,
                  borderColor: withAlpha(noteColor, 0.4),
                },
                fadeUp(1),
              ]}
            >
              <Ionicons name={isPending ? 'time' : 'close-circle'} size={18} color={noteColor} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: noteColor, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' }]}>
                  {isPending ? t('memories.statusPending') : t('memories.statusRejected')}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.text, marginTop: 4, lineHeight: 20 }]}>
                  {isPending
                    ? t('memories.pendingBanner', { defaultValue: 'Waiting for a choir leader to review and publish this memory.' })
                    : t('memories.rejectedBanner', { defaultValue: 'This memory was rejected. See the reason below.' })}
                </Text>
              </View>
            </Animated.View>
          )}

          {isNonPublished && item.status === 'REJECTED' && item.rejectionReason && (
            <Animated.View style={[{ marginTop: 12, padding: 14, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: colors.error, backgroundColor: withAlpha(colors.error, 0.1) }, fadeUp(2)]}>
              <Text style={[typography.caption, { color: colors.error, fontWeight: '800' }]}>{t('memories.rejectionReason')}</Text>
              <Text style={[typography.bodySmall, { color: colors.text, marginTop: 4 }]}>{item.rejectionReason}</Text>
            </Animated.View>
          )}

          {item.description ? (
            <Animated.View style={[{ marginTop: 20 }, fadeUp(3)]}>
              <DescriptionCard text={item.description} />
            </Animated.View>
          ) : null}

          {audio?.storageUrl && (
            <Animated.View style={[{ marginTop: spacing.lg }, fadeUp(4)]}>
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
            <Animated.View style={[{ marginTop: spacing.xl }, fadeUp(5)]}>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, fontWeight: '800', marginBottom: spacing.sm }]}>
                {t('memories.photosShort', { defaultValue: 'Photos' })} · {photos.length}
              </Text>
              <PhotoStrip photos={carouselPhotos} onPressPhoto={openViewer} />
            </Animated.View>
          )}

          {youtubes.length > 0 && (
            <Animated.View style={[{ marginTop: spacing.xl, gap: spacing.sm }, fadeUp(6)]}>
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
        </View>
      </ScrollView>

      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 12, right: 16, zIndex: 10 }}>
        <GlassBackButton onPress={() => navigation.goBack()} accessibilityLabel={t('common.back', { defaultValue: 'Back' })} size={44} />
      </View>

      <PhotoViewer visible={viewerOpen} photos={carouselPhotos} startIndex={viewerIndex} onClose={() => setViewerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 14 },
});