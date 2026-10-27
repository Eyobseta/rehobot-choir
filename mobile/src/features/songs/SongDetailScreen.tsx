import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  Animated,
  Easing,
  Modal,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { cacheRead, cacheWrite } from '../../services/cache';
import { CACHE_KEYS } from '../../services/cacheKeys';

const HEART = '#E0245E';
const YT = '#FF0000';

export default function SongDetailScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();
  const { id } = route.params;

  const [item, setItem] = useState<SongDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(true);
  const [offlineUri, setOfflineUri] = useState<string | null>(null);
  const [playerStatus, setPlayerStatus] = useState<SimpleStatus>(getSnapshot());

  const [downloadPct, setDownloadPct] = useState<number | null>(null);
  const [lyricsFullscreen, setLyricsFullscreen] = useState(false);

  // Lyrics entrance animation (inline card)
  const lyricsEnter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (lyricsOpen) {
      lyricsEnter.setValue(0);
      Animated.timing(lyricsEnter, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [lyricsOpen, lyricsEnter]);

  // Fullscreen lyrics fade-in
  const fsEnter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (lyricsFullscreen) {
      fsEnter.setValue(0);
      Animated.timing(fsEnter, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [lyricsFullscreen, fsEnter]);

  const load = useCallback(async () => {
    setError(null);
    
    // 1. FAST LOAD: Try to read the song details from cache immediately
    const cachedSong = await cacheRead<SongDetail>(CACHE_KEYS.songDetail(id));
    if (cachedSong) {
      setItem(cachedSong);
      setLoading(false); // Hide spinner instantly!
    }

    try {
      // 2. BACKGROUND LOAD: Fetch fresh data (or fetch if no cache exists)
      const [song, favs, offline, offlineList] = await Promise.all([
        getSong(id),
        listMyFavorites(),
        isOffline(id),
        listOffline(),
      ]);
      
      setItem(song);
      setIsFav(favs.some((f) => f.song.id === id));
      setSavedOffline(offline);
      setOfflineUri(offlineList.find((x) => x.songId === id)?.fileUri ?? null);
    } catch (e) {
      const err = e as ApiError;
      if (!cachedSong) setError(`${err.message} [${err.code}]`); // Only show error if we had nothing in cache
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
    if (savedOffline) {
      setBusy(true);
      try {
        await removeOffline(item.id);
        setSavedOffline(false);
        setOfflineUri(null);
      } catch (e) {
        const err = e as ApiError;
        setError(`${err.message} [${err.code}]`);
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    setDownloadPct(0);
    try {
      const entry = await saveOffline(
        item.id,
        item.title,
        item.audioUrl,
        (pct: number) => setDownloadPct(pct),
      );
      setSavedOffline(true);
      setOfflineUri(entry.fileUri);
      
      // NEW: Ensure the lyrics/details are cached when saved offline!
      await cacheWrite(CACHE_KEYS.songDetail(item.id), item);
      
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
      setDownloadPct(null);
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

  // ONLY show full screen spinner if we have NO item at all (not even cached)
  if (loading && !item) {
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
        <Text style={[typography.body, { color: colors.error }]}>
          {error ?? t('songs.notFound')}
        </Text>
        <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>
      </View>
    );
  }

  const isThisPlaying =
    playerStatus.isLoaded &&
    getCurrentKey() === item.id &&
    playerStatus.isPlaying;

  const hasAudio = Boolean(offlineUri || item.audioUrl);
  const downloading = downloadPct !== null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Hero ---------- */}
        <LinearGradient
          colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: 20,
            paddingTop: insets.top + 16,
            paddingBottom: 34,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            overflow: 'hidden',
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -60,
              left: -70,
              width: 210,
              height: 210,
              borderRadius: 105,
              backgroundColor: withAlpha(BRAND.gold, 0.18),
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: -80,
              right: -60,
              width: 230,
              height: 230,
              borderRadius: 115,
              backgroundColor: withAlpha(BRAND.water, 0.2),
            }}
          />

          <View style={{ alignSelf: 'flex-end', marginBottom: 12 }}>
            <GlassBackButton onPress={() => navigation.goBack()} size={44} />
          </View>

          <LinearGradient
            colors={[BRAND.gold, BRAND.magenta, BRAND.violet, BRAND.water, BRAND.gold]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 132, height: 132, borderRadius: 66, padding: 4, alignSelf: 'center' }}
          >
            <View
              style={{
                flex: 1,
                borderRadius: 62,
                backgroundColor: BRAND.deep,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={item.youtubeUrl ? 'logo-youtube' : 'musical-notes'}
                size={54}
                color={BRAND.gold}
              />
            </View>
          </LinearGradient>

          <Text
            style={[
              typography.h2,
              { color: '#FFFFFF', marginTop: 16, textAlign: 'center', fontWeight: '800' },
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {item.category && (
            <Text
              style={{
                color: 'rgba(255,255,255,0.85)',
                textAlign: 'center',
                marginTop: 4,
                fontSize: 13,
                fontWeight: '600',
              }}
            >
              {item.category.name}
            </Text>
          )}

          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              marginTop: 20,
              justifyContent: 'center',
            }}
          >
            <ActionPill
              icon={isFav ? 'heart' : 'heart-outline'}
              label={isFav ? 'Favorited' : 'Favorite'}
              tint={isFav ? '#FFFFFF' : HEART}
              active={isFav}
              bgActive={HEART}
              onPress={toggleFav}
              disabled={busy || downloading}
            />

            {downloading ? (
              <DownloadProgressPill pct={downloadPct ?? 0} />
            ) : (
              <ActionPill
                icon={savedOffline ? 'cloud-done' : 'download-outline'}
                label={savedOffline ? 'Saved' : 'Save offline'}
                tint="#FFFFFF"
                active={savedOffline}
                bgActive="rgba(255,255,255,0.28)"
                onPress={onToggleOffline}
                disabled={busy}
              />
            )}
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
          {/* ---------- YouTube ---------- */}
          {item.youtubeUrl && (
            <Pressable
              onPress={() =>
                navigation.navigate('SongVideo', {
                  youtubeUrl: item.youtubeUrl,
                  title: item.title,
                })
              }
              style={{
                borderRadius: 18,
                overflow: 'hidden',
                shadowColor: YT,
                shadowOpacity: 0.35,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 5,
              }}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={[YT, '#B3001B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  paddingVertical: 16,
                  borderRadius: 18,
                }}
              >
                <Ionicons name="logo-youtube" size={22} color="#FFFFFF" />
                <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '800' }]}>
                  {t('songs.watchOnYoutube')}
                </Text>
              </LinearGradient>
            </Pressable>
          )}

          {/* ---------- Audio ---------- */}
          {hasAudio && (
            <Pressable
              onPress={onTogglePlay}
              disabled={busy || downloading}
              style={{
                marginTop: 14,
                borderRadius: 18,
                overflow: 'hidden',
                shadowColor: BRAND.violet,
                shadowOpacity: 0.35,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 5,
                opacity: busy || downloading ? 0.6 : 1,
              }}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={[BRAND.violet, BRAND.magenta]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 12,
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  borderRadius: 18,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={isThisPlaying ? 'pause' : 'play'}
                    size={20}
                    color={BRAND.violet}
                    style={{ marginLeft: isThisPlaying ? 0 : 2 }}
                  />
                </View>
                <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '800' }]}>
                  {isThisPlaying ? t('songs.pause') : t('songs.playAudio')}
                </Text>
              </LinearGradient>
            </Pressable>
          )}

          {/* ---------- Modern lyrics card ---------- */}
          {item.lyrics && (
            <View
              style={{
                marginTop: spacing.xl,
                borderRadius: 24,
                overflow: 'hidden',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: BRAND.violet,
                shadowOpacity: 0.18,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 10 },
                elevation: 6,
              }}
            >
              {/* Gradient header strip */}
              <LinearGradient
                colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingHorizontal: 16, paddingVertical: 14 }}
              >
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: -40,
                    right: -30,
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    backgroundColor: withAlpha(BRAND.gold, 0.22),
                  }}
                />

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Pressable
                    onPress={() => setLyricsOpen((o) => !o)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
                    accessibilityRole="button"
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 12,
                        backgroundColor: BRAND.gold,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="document-text" size={17} color={BRAND.deep} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: '#FFFFFF',
                          fontSize: 15,
                          fontWeight: '800',
                          letterSpacing: 0.4,
                        }}
                      >
                        {t('songs.lyrics')}
                      </Text>
                      <Text
                        style={{
                          color: 'rgba(255,255,255,0.75)',
                          fontSize: 11,
                          fontWeight: '700',
                          letterSpacing: 0.6,
                          textTransform: 'uppercase',
                        }}
                        numberOfLines={1}
                      >
                        Tap to {lyricsOpen ? 'collapse' : 'expand'}
                      </Text>
                    </View>
                  </Pressable>

                  {/* Fullscreen button */}
                  <Pressable
                    onPress={() => setLyricsFullscreen(true)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Open fullscreen lyrics"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: 'rgba(255,255,255,0.22)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 8,
                    }}
                  >
                    <Ionicons name="expand" size={16} color="#FFFFFF" />
                  </Pressable>

                  {/* Inline collapse chevron */}
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: 'rgba(255,255,255,0.22)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 8,
                    }}
                  >
                    <Ionicons
                      name={lyricsOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#FFFFFF"
                    />
                  </View>
                </View>
              </LinearGradient>

              {lyricsOpen && (
                <Animated.View
                  style={{
                    opacity: lyricsEnter,
                    transform: [
                      {
                        translateY: lyricsEnter.interpolate({
                          inputRange: [0, 1],
                          outputRange: [8, 0],
                        }),
                      },
                    ],
                  }}
                >
                  <Text
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: -6,
                      left: 12,
                      fontSize: 68,
                      lineHeight: 80,
                      fontWeight: '800',
                      color: withAlpha(BRAND.violet, 0.14),
                    }}
                  >
                    “
                  </Text>

                  <ScrollView
                    style={{ maxHeight: 340 }}
                    contentContainerStyle={{
                      paddingHorizontal: 22,
                      paddingTop: 16,
                      paddingBottom: 22,
                    }}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                  >
                    <View style={{ flexDirection: 'row', gap: 14 }}>
                      <LinearGradient
                        colors={[BRAND.violet, BRAND.magenta, BRAND.gold]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={{ width: 4, borderRadius: 2 }}
                      />
                      <Text
                        selectable
                        style={[
                          typography.body,
                          {
                            color: colors.text,
                            lineHeight: 28,
                            fontSize: 16,
                            fontStyle: 'italic',
                            flex: 1,
                          },
                        ]}
                      >
                        {item.lyrics}
                      </Text>
                    </View>

                    <LinearGradient
                      colors={[
                        'transparent',
                        withAlpha(BRAND.violet, 0.35),
                        'transparent',
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        height: 1,
                        marginTop: 20,
                        marginBottom: 12,
                        borderRadius: 1,
                      }}
                    />
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        alignSelf: 'center',
                      }}
                    >
                      <Ionicons name="musical-notes" size={13} color={colors.textSecondary} />
                      <Text
                        style={[
                          typography.caption,
                          {
                            color: colors.textSecondary,
                            fontWeight: '700',
                            letterSpacing: 0.6,
                          },
                        ]}
                      >
                        {item.title}
                      </Text>
                    </View>
                  </ScrollView>
                </Animated.View>
              )}
            </View>
          )}

          {error && (
            <View
              style={{
                marginTop: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: spacing.md,
                borderRadius: 14,
                backgroundColor: withAlpha(colors.error, 0.1),
                borderWidth: 1,
                borderColor: withAlpha(colors.error, 0.35),
              }}
            >
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>
                {error}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ========================================================= */}
      {/* FULLSCREEN LYRICS MODAL                                   */}
      {/* ========================================================= */}
      {item.lyrics && (
        <Modal
          visible={lyricsFullscreen}
          transparent={false}
          animationType="fade"
          onRequestClose={() => setLyricsFullscreen(false)}
          statusBarTranslucent
        >
          <LinearGradient
            colors={[BRAND.deep, '#1A0B45', '#0D0524']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          >
            {/* Decorative glows */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -120,
                right: -80,
                width: 340,
                height: 340,
                borderRadius: 170,
                backgroundColor: withAlpha(BRAND.magenta, 0.3),
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                bottom: -140,
                left: -100,
                width: 380,
                height: 380,
                borderRadius: 190,
                backgroundColor: withAlpha(BRAND.violet, 0.34),
              }}
            />

            {/* Giant decorative quote mark */}
            <Text
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 40,
                left: 24,
                fontSize: 200,
                lineHeight: 220,
                fontWeight: '800',
                color: 'rgba(255,255,255,0.06)',
              }}
            >
              “
            </Text>

            {/* Header */}
            <Animated.View
              style={{
                paddingTop: (insets.top || 0) + 12,
                paddingHorizontal: 20,
                paddingBottom: 16,
                opacity: fsEnter,
                transform: [
                  {
                    translateY: fsEnter.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-12, 0],
                    }),
                  },
                ],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <LinearGradient
                  colors={[BRAND.gold, BRAND.magenta]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="musical-notes" size={22} color="#FFFFFF" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.7)',
                      fontSize: 11,
                      fontWeight: '800',
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                    }}
                    numberOfLines={1}
                  >
                    {t('songs.lyrics')}
                  </Text>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 18,
                      fontWeight: '800',
                      marginTop: 2,
                    }}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  {item.category && (
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.65)',
                        fontSize: 12,
                        fontWeight: '600',
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                    >
                      {item.category.name}
                    </Text>
                  )}
                </View>

                <Pressable
                  onPress={() => setLyricsFullscreen(false)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Close fullscreen lyrics"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: 'rgba(255,255,255,0.16)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.28)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={22} color="#FFFFFF" />
                </Pressable>
              </View>

              {/* Gradient divider */}
              <LinearGradient
                colors={[
                  'transparent',
                  withAlpha(BRAND.gold, 0.55),
                  'transparent',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: 1, marginTop: 14, borderRadius: 1 }}
              />
            </Animated.View>

            {/* Body */}
            <Animated.View
              style={{
                flex: 1,
                opacity: fsEnter,
                transform: [
                  {
                    translateY: fsEnter.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              }}
            >
              <ScrollView
                contentContainerStyle={{
                  paddingHorizontal: 26,
                  paddingTop: 8,
                  paddingBottom: (insets.bottom || 0) + 40,
                }}
                showsVerticalScrollIndicator={false}
              >
                {/* Left gradient rail + big italic lyrics */}
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <LinearGradient
                    colors={[BRAND.gold, BRAND.magenta, BRAND.violet]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{ width: 4, borderRadius: 2, minHeight: 60 }}
                  />
                  <Text
                    selectable
                    style={{
                      color: '#FFFFFF',
                      fontSize: 20,
                      lineHeight: 36,
                      fontStyle: 'italic',
                      fontWeight: '500',
                      flex: 1,
                      letterSpacing: 0.2,
                    }}
                  >
                    {item.lyrics}
                  </Text>
                </View>

                {/* Footer */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginTop: 32,
                  }}
                >
                  <Ionicons name="musical-notes" size={14} color="rgba(255,255,255,0.55)" />
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.65)',
                      fontSize: 12,
                      fontWeight: '700',
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    Rehobot Choir
                  </Text>
                </View>
              </ScrollView>
            </Animated.View>
          </LinearGradient>
        </Modal>
      )}
    </View>
  );
}

// ---------- Reusable widgets (unchanged) ----------

function ActionPill({
  icon,
  label,
  tint,
  active,
  bgActive,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  tint: string;
  active: boolean;
  bgActive: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.95)}
        onPressOut={() => to(1)}
        disabled={disabled}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 999,
          backgroundColor: active ? bgActive : 'rgba(255,255,255,0.16)',
          borderWidth: 1,
          borderColor: active ? 'transparent' : 'rgba(255,255,255,0.3)',
          opacity: disabled ? 0.7 : 1,
        }}
      >
        <Ionicons name={icon} size={15} color={tint} />
        <Text style={{ color: active ? '#FFFFFF' : tint, fontWeight: '800', fontSize: 12 }}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function DownloadProgressPill({ pct }: { pct: number }) {
  const pctValue = Math.round(Math.min(1, Math.max(0, pct)) * 100);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.min(1, Math.max(0, pct)),
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [pct, anim]);
  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2.5,
          borderColor: 'rgba(255,255,255,0.32)',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2.5,
            borderTopColor: BRAND.gold,
            borderRightColor: BRAND.gold,
            borderBottomColor: 'transparent',
            borderLeftColor: 'transparent',
            transform: [{ rotate }],
          }}
        />
      </View>
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>
        {pctValue}%
      </Text>
    </View>
  );
}