import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import YoutubePlayer, { YoutubeIframeRef } from 'react-native-youtube-iframe';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import { StatusPill } from './Memorykit';

/**
 * Extract the YouTube video id from any of the common URL shapes.
 * (Same helper as SongVideoScreen — kept local so Memories has no cross-feature dep.)
 */
function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1);
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => ['embed', 'shorts', 'v'].includes(p));
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    return null;
  } catch {
    return null;
  }
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function MemoryVideoScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { youtubeUrl, memoryTitle } = route.params ?? {};

  const playerRef = useRef<YoutubeIframeRef>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const videoId = youtubeUrl ? extractYouTubeId(youtubeUrl) : null;

  const onReady = useCallback(() => setLoading(false), []);
  const onChangeState = useCallback((s: string) => {
    if (s === 'ended') setPlaying(false);
  }, []);

  const applySpeed = async (s: number) => {
    setSpeed(s);
    setShowSpeedMenu(false);
    try {
      const anyRef = playerRef.current as unknown as {
        setPlaybackRate?: (rate: number) => Promise<void>;
      };
      await anyRef?.setPlaybackRate?.(s);
    } catch {
      /* ignore */
    }
  };

  // Entrance animation
  const enter = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);
  const fadeUp = (i: number) => ({
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [18 + i * 8, 0],
        }),
      },
    ],
  });

  if (!videoId) {
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
        <Ionicons name="logo-youtube" size={48} color={colors.error} />
        <Text
          style={[
            typography.body,
            { color: colors.error, marginTop: spacing.md, textAlign: 'center' },
          ]}
        >
          {t('songs.videoUnavailable')}
        </Text>
      </View>
    );
  }

  const videoHeight = Math.round((width * 9) / 16);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ---------- Cinematic header (dark gradient) ---------- */}
      <LinearGradient
        colors={['#0B0A1F', BRAND.deep, BRAND.violet]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.blob,
            { top: -60, right: -40, backgroundColor: withAlpha(BRAND.gold, 0.22) },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.blob,
            { bottom: -70, left: -50, backgroundColor: withAlpha(BRAND.water, 0.22) },
          ]}
        />

        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </Pressable>

          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.headerKicker} numberOfLines={1}>
              {t('memories.videoKicker', { defaultValue: 'Memory video' })}
            </Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {memoryTitle ?? t('memories.videoTitle', { defaultValue: 'Watch' })}
            </Text>
          </View>

          <StatusPill label="YouTube" color="#FF2D2D" icon="logo-youtube" />
        </View>
      </LinearGradient>

      {/* ---------- Player ---------- */}
      <Animated.View style={[{ marginTop: -8 }, fadeUp(0)]}>
        <View
          style={[
            styles.playerWrap,
            {
              backgroundColor: '#000',
              height: videoHeight,
              borderBottomLeftRadius: radius.lg,
              borderBottomRightRadius: radius.lg,
            },
          ]}
        >
          <YoutubePlayer
            ref={playerRef}
            height={videoHeight}
            width={width}
            videoId={videoId}
            play={playing}
            onReady={onReady}
            onChangeState={onChangeState}
            initialPlayerParams={{
              modestbranding: true,
              rel: false,
              controls: true,
              preventFullScreen: false,
            }}
            webViewProps={{
              allowsFullscreenVideo: true,
              androidLayerType: 'hardware',
            }}
          />
          {loading && (
            <View pointerEvents="none" style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          )}
        </View>
      </Animated.View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: insets.bottom + spacing.xl * 2,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Title block ---------- */}
        <Animated.View style={fadeUp(1)}>
          <Text
            style={[
              typography.h3,
              { color: colors.text, fontWeight: '800' },
            ]}
            numberOfLines={2}
          >
            {memoryTitle ?? t('memories.videoTitle', { defaultValue: 'Memory video' })}
          </Text>
          <Text
            style={[
              typography.bodySmall,
              { color: colors.textSecondary, marginTop: 6 },
            ]}
          >
            {t('memories.videoSubtitle', {
              defaultValue: 'Plays right here — no need to leave the app.',
            })}
          </Text>
        </Animated.View>

        {/* ---------- Playback speed card ---------- */}
        <Animated.View style={[{ marginTop: spacing.xl }, fadeUp(2)]}>
          <Text
            style={[
              typography.caption,
              {
                color: colors.textSecondary,
                fontWeight: '800',
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginBottom: spacing.sm,
              },
            ]}
          >
            {t('songs.playbackSpeed')}
          </Text>

          <Pressable
            onPress={() => setShowSpeedMenu((s) => !s)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showSpeedMenu }}
            style={[
              styles.speedRow,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.md,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View
                style={[
                  styles.speedIcon,
                  { backgroundColor: withAlpha(BRAND.violet, 0.16) },
                ]}
              >
                <Ionicons name="speedometer-outline" size={18} color={BRAND.violet} />
              </View>
              <Text style={[typography.body, { color: colors.text, fontWeight: '700' }]}>
                {speed}x
              </Text>
            </View>
            <Ionicons
              name={showSpeedMenu ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>

          {showSpeedMenu && (
            <Animated.View
              style={[
                styles.speedMenu,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                },
                fadeUp(0),
              ]}
            >
              {SPEEDS.map((s, i) => {
                const active = s === speed;
                return (
                  <Pressable
                    key={s}
                    onPress={() => void applySpeed(s)}
                    style={[
                      styles.speedItem,
                      {
                        borderBottomColor: colors.border,
                        borderBottomWidth: i === SPEEDS.length - 1 ? 0 : 1,
                        backgroundColor: active
                          ? withAlpha(BRAND.violet, 0.12)
                          : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typography.body,
                        {
                          color: active ? BRAND.violet : colors.text,
                          fontWeight: active ? '800' : '500',
                        },
                      ]}
                    >
                      {s}x
                    </Text>
                    {active && (
                      <Ionicons name="checkmark-circle" size={18} color={BRAND.violet} />
                    )}
                  </Pressable>
                );
              })}
            </Animated.View>
          )}
        </Animated.View>

        <Animated.View style={[{ marginTop: spacing.xl }, fadeUp(3)]}>
          <View
            style={[
              styles.tip,
              {
                backgroundColor: withAlpha(BRAND.gold, 0.12),
                borderColor: withAlpha(BRAND.gold, 0.4),
              },
            ]}
          >
            <Ionicons name="expand-outline" size={18} color={BRAND.gold} />
            <Text
              style={[
                typography.caption,
                { color: colors.text, flex: 1, lineHeight: 18 },
              ]}
            >
              {t('songs.fullscreenHint')}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', width: 180, height: 180, borderRadius: 90 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerKicker: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  playerWrap: { overflow: 'hidden' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  speedIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedMenu: {
    marginTop: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  speedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
});