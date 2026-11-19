import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import YoutubePlayer, { YoutubeIframeRef } from 'react-native-youtube-iframe';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import { MemoryHero } from './Memorykit';

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
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { youtubeUrl, memoryTitle } = route.params ?? {};

  const playerRef = useRef<YoutubeIframeRef>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);

  const videoId = youtubeUrl ? extractYouTubeId(youtubeUrl) : null;

  const onReady = useCallback(() => setLoading(false), []);
  const onChangeState = useCallback((s: string) => {
    if (s === 'ended') setPlaying(false);
  }, []);

  const applySpeed = async (s: number) => {
    setSpeed(s);
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

  const playerWidth = width - spacing.lg * 2;
  const videoHeight = Math.round((playerWidth * 9) / 16);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MemoryHero
        icon="logo-youtube"
        overline={t('memories.videoKicker', { defaultValue: 'Memory video' })}
        title={memoryTitle ?? t('memories.videoTitle', { defaultValue: 'Watch' })}
        titleSize={20}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl * 2,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Player ---------- */}
        <Animated.View style={fadeUp(0)}>
          <View
            style={{
              backgroundColor: '#000',
              height: videoHeight,
              borderRadius: 24,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <YoutubePlayer
              ref={playerRef}
              height={videoHeight}
              width={playerWidth}
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
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(5,16,19,0.45)',
                }}
              >
                <ActivityIndicator size="large" color={BRAND.lime} />
              </View>
            )}
          </View>
        </Animated.View>

        {/* ---------- Title block ---------- */}
        <Animated.View style={[{ marginTop: spacing.lg }, fadeUp(1)]}>
          <Text style={[typography.h3, { color: colors.text, fontWeight: '800' }]} numberOfLines={2}>
            {memoryTitle ?? t('memories.videoTitle', { defaultValue: 'Memory video' })}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 6 }]}>
            {t('memories.videoSubtitle', {
              defaultValue: 'Plays right here — no need to leave the app.',
            })}
          </Text>
        </Animated.View>

        {/* ---------- Playback speed ---------- */}
        <Animated.View
          style={[
            {
              marginTop: spacing.xl,
              padding: spacing.lg,
              borderRadius: 24,
              borderWidth: 1,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
            fadeUp(2),
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                backgroundColor: withAlpha(colors.accent, 0.18),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="speedometer-outline" size={18} color={colors.accent} />
            </View>
            <Text style={[typography.body, { color: colors.text, fontWeight: '800', flex: 1 }]}>
              {t('songs.playbackSpeed')}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, fontWeight: '800' }]}>{speed}x</Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SPEEDS.map((s) => {
              const active = s === speed;
              return (
                <Pressable
                  key={s}
                  onPress={() => void applySpeed(s)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => ({
                    minWidth: 56,
                    minHeight: 44,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? BRAND.lime : colors.background,
                    borderWidth: 1,
                    borderColor: active ? BRAND.lime : colors.border,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  })}
                >
                  <Text style={{ color: active ? BRAND.deep : colors.text, fontWeight: '800', fontSize: 14 }}>
                    {s}x
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* ---------- Fullscreen tip ---------- */}
        <Animated.View style={[{ marginTop: spacing.lg }, fadeUp(3)]}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 14,
              borderRadius: 18,
              borderWidth: 1,
              backgroundColor: withAlpha(BRAND.lime, 0.1),
              borderColor: withAlpha(BRAND.lime, 0.35),
            }}
          >
            <Ionicons name="expand-outline" size={18} color={colors.accent} />
            <Text style={[typography.caption, { color: colors.text, flex: 1, lineHeight: 18 }]}>
              {t('songs.fullscreenHint')}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}