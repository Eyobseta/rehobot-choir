import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import {
  getSong,
  SongDetail,
  favoriteSong,
  unfavoriteSong,
  listMyFavorites,
} from '../../services/songs';
import { ApiError } from '../../services/api';
import {
  saveOffline,
  isOffline,
  removeOffline,
  listOffline,
} from '../../services/offlineSongs';
import {
  playTrack,
  pauseTrack,
  resumeTrack,
  subscribe,
  getSnapshot,
  getCurrentKey,
  SimpleStatus,
} from '../../services/audioPlayer';

const HEART_COLOR = '#E0245E';
const YOUTUBE_RED = '#FF0000';

export default function SongDetailScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const { id } = route.params;

  const [item, setItem] = useState<SongDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(true);
  const [offlineUri, setOfflineUri] = useState<string | null>(null);
  const [playerStatus, setPlayerStatus] = useState<SimpleStatus>(
    getSnapshot(),
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const [song, favs, offline, offlineList] = await Promise.all([
        getSong(id),
        listMyFavorites(),
        isOffline(id),
        listOffline(),
      ]);
      setItem(song);
      setIsFav(favs.some((f) => f.song.id === id));
      setSavedOffline(offline);
      const found = offlineList.find((x) => x.songId === id);
      setOfflineUri(found?.fileUri ?? null);
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const unsub = subscribe(setPlayerStatus);
    setPlayerStatus(getSnapshot());
    return unsub;
  }, []);

  const toggleFav = async () => {
    if (!item) return;
    setBusy(true);
    try {
      if (isFav) await unfavoriteSong(item.id);
      else await favoriteSong(item.id);
      setIsFav(!isFav);
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const onToggleOffline = async () => {
    if (!item) return;
    if (!item.audioUrl) {
      Alert.alert(t('songs.noAudio'), t('songs.noAudioBody'));
      return;
    }
    setBusy(true);
    try {
      if (savedOffline) {
        await removeOffline(item.id);
        setSavedOffline(false);
        setOfflineUri(null);
      } else {
        const entry = await saveOffline(item.id, item.title, item.audioUrl);
        setSavedOffline(true);
        setOfflineUri(entry.fileUri);
      }
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const onTogglePlay = async () => {
    if (!item) return;
    const isThisTrack = getCurrentKey() === item.id;
    const isPlaying =
      playerStatus.isLoaded && isThisTrack && playerStatus.isPlaying;

    if (isPlaying) {
      await pauseTrack();
      return;
    }
    if (isThisTrack && playerStatus.isLoaded && !playerStatus.isPlaying) {
      await resumeTrack();
      return;
    }

    const uri = offlineUri ?? item.audioUrl;
    if (!uri) {
      Alert.alert(t('songs.noAudio'), t('songs.noAudioBody'));
      return;
    }
    await playTrack({ key: item.id, uri, title: item.title });
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
          {error ?? t('songs.notFound')}
        </Text>
      </View>
    );
  }

  const isThisPlaying =
    playerStatus.isLoaded &&
    getCurrentKey() === item.id &&
    playerStatus.isPlaying;

  const hasAudio = Boolean(offlineUri || item.audioUrl);

  return (
    <ScrollView
      contentContainerStyle={{
        paddingBottom: spacing.xl,
        backgroundColor: colors.background,
      }}
    >
      <View style={{ padding: spacing.xl }}>
        {/* Title row + favorite & download icons on the right */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={[typography.h2, { color: colors.text }]}>
              {item.title}
            </Text>
            {item.category && (
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.textSecondary, marginTop: spacing.xs },
                ]}
              >
                {item.category.name}
              </Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {/* Favorite heart — small */}
            <Pressable
              onPress={toggleFav}
              disabled={busy}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: HEART_COLOR,
                backgroundColor: isFav ? HEART_COLOR : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={isFav ? 'heart' : 'heart-outline'}
                size={18}
                color={isFav ? '#FFFFFF' : HEART_COLOR}
              />
            </Pressable>

            {/* Download */}
            <Pressable
              onPress={onToggleOffline}
              disabled={busy}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: colors.primary,
                backgroundColor: savedOffline ? colors.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={savedOffline ? 'cloud-done' : 'download-outline'}
                size={18}
                color={savedOffline ? colors.primaryText : colors.primary}
              />
            </Pressable>
          </View>
        </View>

        {/* Watch on YouTube */}
        {item.youtubeUrl && (
          <Pressable
            onPress={() =>
              navigation.navigate('SongVideo', {
                youtubeUrl: item.youtubeUrl,
                title: item.title,
              })
            }
            style={{
              marginTop: spacing.xl,
              paddingVertical: spacing.md,
              borderRadius: radius.md,
              backgroundColor: YOUTUBE_RED,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
            }}
          >
            <Ionicons name="logo-youtube" size={22} color="#FFFFFF" />
            <Text style={[typography.button, { color: '#FFFFFF' }]}>
              {t('songs.watchOnYoutube')}
            </Text>
          </Pressable>
        )}

        {/* Audio play button — same width as YouTube button */}
        {hasAudio && (
          <Pressable
            onPress={onTogglePlay}
            disabled={busy}
            style={{
              marginTop: spacing.md,
              paddingVertical: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.primary,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              paddingHorizontal: spacing.lg,
              gap: spacing.md,
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Ionicons
              name={isThisPlaying ? 'pause' : 'play'}
              size={22}
              color={colors.primary}
            />
            <Text style={[typography.button, { color: colors.primary }]}>
              {isThisPlaying ? t('songs.pause') : t('songs.playAudio')}
            </Text>
          </Pressable>
        )}

        {/* Lyrics card */}
        {item.lyrics && (
          <View
            style={{
              marginTop: spacing.xl,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              overflow: 'hidden',
            }}
          >
            <Pressable
              onPress={() => setLyricsOpen((o) => !o)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                backgroundColor: colors.surfaceAlt,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={[typography.h3, { color: colors.text }]}>
                  {t('songs.lyrics')}
                </Text>
              </View>
              <Ionicons
                name={lyricsOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>

            {lyricsOpen && (
              <ScrollView
                style={{ maxHeight: 320 }}
                contentContainerStyle={{ padding: spacing.lg }}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                <Text
                  selectable
                  style={[
                    typography.body,
                    { color: colors.text, lineHeight: 24 },
                  ]}
                >
                  {item.lyrics}
                </Text>
              </ScrollView>
            )}
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