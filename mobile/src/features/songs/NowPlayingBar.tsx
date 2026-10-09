import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import {
  pauseTrack,
  resumeTrack,
  stopTrack,
  subscribe,
  getSnapshot,
  SimpleStatus,
} from '../../services/audioPlayer';

export default function NowPlayingBar() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const navigation = useNavigation<any>();

  const [status, setStatus] = useState<SimpleStatus>(getSnapshot());

  // Once we have seen at least one loaded status, keep the bar visible
  // even if the player briefly reports isLoaded:false during seek/re-buffer.
  // This prevents the bar from blinking when tapping the ±15 buttons.
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    if (status.isLoaded) hasLoadedOnceRef.current = true;
  }, [status.isLoaded]);

  useEffect(() => {
    const unsub = subscribe(setStatus);
    setStatus(getSnapshot());
    return unsub;
  }, []);

  if (!hasLoadedOnceRef.current) return null;

  const progress =
    status.durationMillis > 0
      ? Math.min(1, status.positionMillis / status.durationMillis)
      : 0;

  const onToggle = async () => {
    if (status.isPlaying) await pauseTrack();
    else await resumeTrack();
  };

  const onClose = async () => {
    await stopTrack();
    hasLoadedOnceRef.current = false;
  };

  const onOpen = () => {
    navigation.navigate('Songs', { screen: 'Player' });
  };

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ height: 3, backgroundColor: colors.surfaceAlt }}>
        <View
          style={{
            width: `${progress * 100}%`,
            height: 3,
            backgroundColor: colors.primary,
          }}
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        <Pressable
          onPress={onOpen}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Ionicons name="musical-notes" size={20} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text
              style={[
                typography.bodySmall,
                { color: colors.text, fontWeight: '600' },
              ]}
              numberOfLines={1}
            >
              {t('songs.nowPlaying')}
            </Text>
            <Text
              style={[typography.caption, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {formatTime(status.positionMillis)} /{' '}
              {formatTime(status.durationMillis)}
            </Text>
          </View>
        </Pressable>

        <Pressable onPress={onToggle} style={{ padding: spacing.sm }}>
          <Ionicons
            name={status.isPlaying ? 'pause' : 'play'}
            size={26}
            color={colors.primary}
          />
        </Pressable>

        <Pressable onPress={onClose} style={{ padding: spacing.sm }}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );

  function formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
}