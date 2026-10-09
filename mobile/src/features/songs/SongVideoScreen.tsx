import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import YoutubePlayer, { YoutubeIframeRef } from 'react-native-youtube-iframe';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Extract the YouTube video id from any of the common URL shapes.
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

export default function SongVideoScreen({ route }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const { youtubeUrl, title } = route.params ?? {};

  const playerRef = useRef<YoutubeIframeRef>(null);
  const [loading, setLoading] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const videoId = youtubeUrl ? extractYouTubeId(youtubeUrl) : null;

  const onReady = useCallback(() => {
    setLoading(false);
  }, []);

  const applySpeed = async (s: number) => {
    setSpeed(s);
    setShowSpeedMenu(false);
    try {
      // react-native-youtube-iframe exposes setPlaybackRate at runtime,
      // but the library's TS types miss it. Cast to call.
      const anyRef = playerRef.current as unknown as {
        setPlaybackRate?: (rate: number) => Promise<void>;
      };
      await anyRef?.setPlaybackRate?.(s);
    } catch {
      // ignore
    }
  };

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
        <Text style={[typography.body, { color: colors.error }]}>
          {t('songs.videoUnavailable')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ backgroundColor: colors.background }}>
      <View style={{ backgroundColor: '#000' }}>
        <View style={{ position: 'relative' }}>
          <YoutubePlayer
            ref={playerRef}
            height={240}
            videoId={videoId}
            play={true}
            onReady={onReady}
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
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          )}
        </View>
      </View>

      <View style={{ padding: spacing.xl }}>
        <Text style={[typography.h3, { color: colors.text }]}>
          {title ?? ''}
        </Text>

        <View style={{ marginTop: spacing.xl }}>
          <Text
            style={[
              typography.bodySmall,
              { color: colors.textSecondary, marginBottom: spacing.sm },
            ]}
          >
            {t('songs.playbackSpeed')}
          </Text>

          <Pressable
            onPress={() => setShowSpeedMenu((s) => !s)}
            style={{
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="speedometer-outline" size={20} color={colors.text} />
              <Text style={[typography.body, { color: colors.text }]}>
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
            <View
              style={{
                marginTop: spacing.sm,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                overflow: 'hidden',
                backgroundColor: colors.surface,
              }}
            >
              {SPEEDS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => void applySpeed(s)}
                  style={{
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.lg,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    backgroundColor:
                      s === speed ? colors.surfaceAlt : colors.surface,
                  }}
                >
                  <Text
                    style={[
                      typography.body,
                      { color: s === speed ? colors.primary : colors.text },
                    ]}
                  >
                    {s}x
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <Text
          style={[
            typography.caption,
            { color: colors.textSecondary, marginTop: spacing.xl },
          ]}
        >
          {t('songs.fullscreenHint')}
        </Text>
      </View>
    </ScrollView>
  );
}