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
import { Ionicons } from '@expo/vector-icons';
import YoutubePlayer, { YoutubeIframeRef } from 'react-native-youtube-iframe';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { ScreenHero } from './Songs_Kit';

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
const YT = '#FF0000';
const SIDE = 16;

export default function SongVideoScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { youtubeUrl, title } = route.params ?? {};

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
      // ignore
    }
  };

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
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 26,
            backgroundColor: withAlpha(YT, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="logo-youtube" size={42} color={YT} />
        </View>
        <Text
          style={[
            typography.body,
            { color: colors.error, marginTop: spacing.md, textAlign: 'center' },
          ]}
        >
          {t('songs.videoUnavailable')}
        </Text>
        <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>
      </View>
    );
  }

  const playerWidth = width - SIDE * 2;
  const videoHeight = Math.round((playerWidth * 9) / 16);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHero
        gradient={['#0B0A1F', BRAND.deep, colors.primary]}
        icon="logo-youtube"
        overline={t('songs.watchOnYoutube')}
        title={title ?? ''}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={{
          padding: SIDE,
          paddingBottom: insets.bottom + spacing.xl * 2,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Player card */}
        <Animated.View style={fadeUp(0)}>
          <View
            style={{
              borderRadius: 22,
              backgroundColor: '#000',
              height: videoHeight,
              overflow: 'hidden',
              shadowColor: BRAND.deep,
              shadowOpacity: 0.4,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 10 },
              elevation: 10,
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
              <View pointerEvents="none" style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            )}
          </View>
        </Animated.View>

        {/* Title row */}
        {title ? (
          <Animated.View
            style={[
              {
                marginTop: spacing.lg,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              },
              fadeUp(1),
            ]}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: YT,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="play" size={20} color="#FFFFFF" style={{ marginLeft: 2 }} />
            </View>
            <Text
              style={[typography.h3, { color: colors.text, flex: 1, fontWeight: '800' }]}
              numberOfLines={2}
            >
              {title}
            </Text>
          </Animated.View>
        ) : null}

        {/* Speed chips (same applySpeed logic; replaces the dropdown) */}
        <Animated.View style={[{ marginTop: spacing.xl }, fadeUp(2)]}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}
          >
            <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
            <Text
              style={[
                typography.caption,
                {
                  color: colors.textSecondary,
                  fontWeight: '800',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                },
              ]}
            >
              {t('songs.playbackSpeed')}
            </Text>
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
                  style={{ borderRadius: 16, overflow: 'hidden' }}
                >
                  {active ? (
                    <View style={{ backgroundColor: colors.primary,  paddingHorizontal: 18, paddingVertical: 11 }}>
                      <Text style={{ color: colors.primaryText, fontSize: 14, fontWeight: '800' }}>
                        {s}x
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={{
                        paddingHorizontal: 18,
                        paddingVertical: 11,
                        borderRadius: 16,
                        borderWidth: 1.5,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                        {s}x
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View style={[{ marginTop: spacing.xl }, fadeUp(3)]}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 14,
              borderRadius: 16,
              backgroundColor: withAlpha(BRAND.gold, 0.12),
              borderWidth: 1,
              borderColor: withAlpha(BRAND.gold, 0.4),
            }}
          >
            <Ionicons name="expand-outline" size={18} color={BRAND.gold} />
            <Text style={[typography.caption, { color: colors.text, flex: 1, lineHeight: 18 }]}>
              {t('songs.fullscreenHint')}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});