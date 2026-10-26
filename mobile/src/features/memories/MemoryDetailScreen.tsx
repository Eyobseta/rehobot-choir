import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Animated,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import {
  getMemory,
  getMyMemory,
  MemoryDetail,
  MemoryMediaItem,
} from '../../services/memories';
import { ApiError } from '../../services/api';
import {
  playTrack,
  pauseTrack,
  resumeTrack,
  getCurrentKey,
  subscribe,
  getSnapshot,
  SimpleStatus,
} from '../../services/audioPlayer';
import { ErrorBanner, BRAND } from '../auth/Auth_UI';
import { formatEthDate } from '../../utils/ethiopianCalendar';
import {
  PhotoCarousel,
  PhotoViewer,
  GradientButton,
  DatePill,
  Equalizer,
  StatusPill,
  useEnter,
  YOUTUBE_COLORS,
  memoryToEthDate,
} from './Memorykit';
import GlassBackButton from '../../components/GlassBackButton';

export default function MemoryDetailScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();
  const { id, mineOnly } = route.params as { id: string; mineOnly?: boolean };

  const [item, setItem] = useState<MemoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerStatus, setPlayerStatus] = useState<SimpleStatus>(getSnapshot());
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const data = mineOnly ? await getMyMemory(id) : await getMemory(id);
        setItem(data);
      } catch (e) {
        const err = e as ApiError;
        setError(`${err.message} [${err.code}]`);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, mineOnly]);

  useEffect(() => {
    const unsub = subscribe(setPlayerStatus);
    setPlayerStatus(getSnapshot());
    return unsub;
  }, []);

  const { fadeUp } = useEnter(!loading && !!item);
  const audioScale = useRef(new Animated.Value(1)).current;

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
        <ActivityIndicator size="large" color={BRAND.violet} />
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
        <ErrorBanner message={error ?? t('memories.notFound')} />

        <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>
      </View>
    );
  }

  const photos = item.media.filter((m) => m.type === 'PHOTO');
  const audio = item.media.find((m) => m.type === 'AUDIO');
  const youtubes = item.media.filter((m) => m.type === 'YOUTUBE');

  const isAudioPlaying =
    playerStatus.isLoaded &&
    getCurrentKey() === `memory:${item.id}` &&
    playerStatus.isPlaying;

  const onToggleAudio = async () => {
    if (!audio?.storageUrl) return;
    const key = `memory:${item.id}`;
    if (getCurrentKey() !== key) {
      await playTrack({ key, uri: audio.storageUrl, title: item.title });
      return;
    }
    if (isAudioPlaying) await pauseTrack();
    else await resumeTrack();
  };

  const pressAudio = (v: number) =>
    Animated.spring(audioScale, {
      toValue: v,
      speed: 40,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

  const carouselPhotos = photos.map((p: MemoryMediaItem) => ({
    id: p.id,
    uri: p.storageUrl ?? undefined,
  }));

  const isNonPublished = mineOnly && item.status !== 'PUBLISHED';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
        showsVerticalScrollIndicator={false}
      >
        <PhotoCarousel
          photos={carouselPhotos}
          height={330}
          onPressPhoto={(i) => {
            setViewerIndex(i);
            setViewerOpen(true);
          }}
        />

        <View
          style={{
            marginTop: -28,
            backgroundColor: colors.background,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            padding: spacing.xl,
          }}
        >
          <Animated.View style={fadeUp(0)}>
            <Text style={[typography.h2, { color: colors.text, fontWeight: '800' }]}>
              {item.title}
            </Text>

            <View style={styles.metaRow}>
              <DatePill text={formatEthDate(memoryToEthDate(item), 'en')} />
              {photos.length > 0 && (
                <StatusPill
                  label={String(photos.length)}
                  color={BRAND.magenta}
                  icon="images"
                />
              )}
              {audio && <StatusPill label="" color={BRAND.violet} icon="musical-notes" />}
              {youtubes.length > 0 && (
                <StatusPill
                  label={String(youtubes.length)}
                  color="#FF2D2D"
                  icon="logo-youtube"
                />
              )}
            </View>
          </Animated.View>

          {isNonPublished && (
            <Animated.View
              style={[
                {
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                },
                item.status === 'PENDING_REVIEW'
                  ? {
                      backgroundColor: 'rgba(245,158,11,0.12)',
                      borderWidth: 1,
                      borderColor: 'rgba(245,158,11,0.4)',
                    }
                  : {
                      backgroundColor: 'rgba(220,38,38,0.10)',
                      borderWidth: 1,
                      borderColor: 'rgba(220,38,38,0.35)',
                    },
                fadeUp(1),
              ]}
            >
              <Ionicons
                name={item.status === 'PENDING_REVIEW' ? 'time' : 'close-circle'}
                size={18}
                color={item.status === 'PENDING_REVIEW' ? '#F59E0B' : colors.error}
                style={{ marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    typography.caption,
                    {
                      color:
                        item.status === 'PENDING_REVIEW'
                          ? '#B45309'
                          : colors.error,
                      fontWeight: '800',
                      letterSpacing: 0.4,
                      textTransform: 'uppercase',
                    },
                  ]}
                >
                  {item.status === 'PENDING_REVIEW'
                    ? t('memories.statusPending')
                    : t('memories.statusRejected')}
                </Text>
                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.text, marginTop: 4, lineHeight: 20 },
                  ]}
                >
                  {item.status === 'PENDING_REVIEW'
                    ? t('memories.pendingBanner', {
                        defaultValue:
                          'Waiting for a choir leader to review and publish this memory.',
                      })
                    : t('memories.rejectedBanner', {
                        defaultValue:
                          'This memory was rejected. See the reason below.',
                      })}
                </Text>
              </View>
            </Animated.View>
          )}

          {isNonPublished &&
            item.status === 'REJECTED' &&
            item.rejectionReason && (
              <Animated.View
                style={[
                  {
                    marginTop: 12,
                    padding: 14,
                    borderRadius: 14,
                    borderLeftWidth: 4,
                    borderLeftColor: colors.error,
                    backgroundColor: 'rgba(220,38,38,0.08)',
                  },
                  fadeUp(2),
                ]}
              >
                <Text
                  style={[
                    typography.caption,
                    { color: colors.error, fontWeight: '800' },
                  ]}
                >
                  {t('memories.rejectionReason')}
                </Text>
                <Text
                  style={[typography.bodySmall, { color: colors.text, marginTop: 4 }]}
                >
                  {item.rejectionReason}
                </Text>
              </Animated.View>
            )}

          {item.description && (
            <Animated.View
              style={[
                styles.descCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                fadeUp(3),
              ]}
            >
              <View style={[styles.quoteBar, { backgroundColor: BRAND.gold }]} />
              <Text
                style={[typography.body, { color: colors.text, lineHeight: 24, flex: 1 }]}
              >
                {item.description}
              </Text>
            </Animated.View>
          )}

          {audio?.storageUrl && (
            <Animated.View style={[{ marginTop: spacing.lg }, fadeUp(4)]}>
              <Animated.View
                style={{
                  transform: [{ scale: audioScale }],
                  borderRadius: 24,
                  shadowColor: BRAND.magenta,
                  shadowOpacity: isAudioPlaying ? 0.5 : 0.25,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 7,
                  backgroundColor: BRAND.violet,
                }}
              >
                <Pressable
                  onPress={onToggleAudio}
                  onPressIn={() => pressAudio(0.98)}
                  onPressOut={() => pressAudio(1)}
                  accessibilityRole="button"
                  accessibilityLabel={t('memories.audioAttached')}
                >
                  <LinearGradient
                    colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.audioCard}
                  >
                    <View style={styles.playCircle}>
                      <Ionicons
                        name={isAudioPlaying ? 'pause' : 'play'}
                        size={24}
                        color={BRAND.violet}
                        style={{ marginLeft: isAudioPlaying ? 0 : 3 }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.audioTitle}>
                        {t('memories.audioAttached')}
                      </Text>
                      <Text style={styles.audioSub} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </View>
                    <Equalizer active={isAudioPlaying} />
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            </Animated.View>
          )}

          {youtubes.length > 0 && (
            <Animated.View
              style={[{ marginTop: spacing.lg, gap: spacing.sm }, fadeUp(5)]}
            >
              {youtubes.map((y) => (
                <GradientButton
                  key={y.id}
                  label={t('memories.watchOnYoutube')}
                  icon="logo-youtube"
                  colors={YOUTUBE_COLORS}
                  onPress={() =>
                    navigation.navigate('MemoryVideo', {
                      youtubeUrl: y.youtubeUrl as string,
                      memoryTitle: item.title,
                    })
                  }
                />
              ))}
            </Animated.View>
          )}

          {error && (
            <View style={{ marginTop: spacing.md }}>
              <ErrorBanner message={error} />
            </View>
          )}
        </View>
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: insets.top + 12, right: 16, zIndex: 10 }}
      >
        <GlassBackButton
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
          size={44}
        />
      </View>

      <PhotoViewer
        visible={viewerOpen}
        photos={carouselPhotos}
        startIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  descCard: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 20,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  quoteBar: { width: 4, borderRadius: 2 },
  audioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 24,
  },
  playCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  audioSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
});