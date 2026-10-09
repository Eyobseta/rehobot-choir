import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { getMemory, MemoryDetail, MemoryMediaItem } from '../../services/memories';
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

export default function MemoryDetailScreen({ route }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const { id } = route.params;

  const [item, setItem] = useState<MemoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerStatus, setPlayerStatus] = useState<SimpleStatus>(
    getSnapshot(),
  );

  useEffect(() => {
    (async () => {
      try {
        setItem(await getMemory(id));
      } catch (e) {
        const err = e as ApiError;
        setError(`${err.message} [${err.code}]`);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    const unsub = subscribe(setPlayerStatus);
    setPlayerStatus(getSnapshot());
    return unsub;
  }, []);

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

  const isAudioPlaying =
    playerStatus.isLoaded &&
    getCurrentKey() === `memory:${item.id}` &&
    playerStatus.isPlaying;

  const onToggleAudio = async () => {
    if (!audio?.storageUrl) return;
    const key = `memory:${item.id}`;
    if (getCurrentKey() !== key) {
      await playTrack({
        key,
        uri: audio.storageUrl,
        title: item.title,
      });
      return;
    }
    if (isAudioPlaying) await pauseTrack();
    else await resumeTrack();
  };

  return (
    <ScrollView
      contentContainerStyle={{
        paddingBottom: spacing.xl,
        backgroundColor: colors.background,
      }}
    >
      {photos.length > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
        >
          {photos.map((p) => (
            <Image
              key={p.id}
              source={{ uri: p.storageUrl ?? undefined }}
              style={{
                width: 380,
                height: 300,
                resizeMode: 'cover',
              }}
            />
          ))}
        </ScrollView>
      )}

      <View style={{ padding: spacing.xl }}>
        <Text style={[typography.h2, { color: colors.text }]}>{item.title}</Text>
        <Text
          style={[
            typography.caption,
            { color: colors.textSecondary, marginTop: spacing.xs },
          ]}
        >
          {new Date(item.date).toISOString().slice(0, 10)}
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
          <Pressable
            onPress={onToggleAudio}
            style={{
              marginTop: spacing.lg,
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={isAudioPlaying ? 'pause' : 'play'}
                size={22}
                color={colors.primaryText}
              />
            </View>
            <Text style={[typography.body, { color: colors.text }]}>
              {t('memories.audioAttached')}
            </Text>
          </Pressable>
        )}

        {youtubes.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            {youtubes.map((y) => (
              <Pressable
                key={y.id}
                onPress={() => Linking.openURL(y.youtubeUrl as string)}
                style={{
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: '#FF0000',
                  marginBottom: spacing.sm,
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
          </View>
        )}

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
      </View>
    </ScrollView>
  );
}