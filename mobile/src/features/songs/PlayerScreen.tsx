import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import {
  pauseTrack,
  resumeTrack,
  stopTrack,
  seekTo,
  skipBy,
  subscribe,
  getSnapshot,
  getCurrentKey,
  SimpleStatus,
} from '../../services/audioPlayer';

export default function PlayerScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const initialTitle: string = route.params?.title ?? t('songs.nowPlaying');
  const initialSubtitle: string | null = route.params?.subtitle ?? null;

  const [status, setStatus] = useState<SimpleStatus>(getSnapshot());
  const [sliding, setSliding] = useState<number | null>(null);

  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    if (status.isLoaded) hasLoadedOnceRef.current = true;
  }, [status.isLoaded]);

  useEffect(() => {
    const unsub = subscribe(setStatus);
    setStatus(getSnapshot());
    return unsub;
  }, []);

  const hasTrack = getCurrentKey() !== null;

  if (!hasLoadedOnceRef.current || !hasTrack) {
    return (
      <SafeAreaView
        edges={['top', 'bottom']}
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const displayPosition =
    sliding !== null ? sliding * 1000 : status.positionMillis;
  const duration = status.durationMillis || 1;

  const onToggle = async () => {
    if (status.isPlaying) await pauseTrack();
    else await resumeTrack();
  };

  const onClose = async () => {
    await stopTrack();
    hasLoadedOnceRef.current = false;
    navigation.goBack();
  };

  const onSeekStart = () => {
    setSliding(status.positionMillis / 1000);
  };

  const onSeekChange = (v: number) => {
    setSliding(v);
  };

  const onSeekEnd = async (v: number) => {
    setSliding(null);
    await seekTo(v * 1000);
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Header */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={{ padding: spacing.sm }}
        >
          <Ionicons name="chevron-down" size={28} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            style={[typography.caption, { color: colors.textSecondary }]}
          >
            {t('songs.nowPlaying')}
          </Text>
        </View>
        <Pressable onPress={onClose} style={{ padding: spacing.sm }}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Album placeholder */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.xl,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: '88%',
            aspectRatio: 1,
            maxWidth: 320,
            borderRadius: radius.lg,
            backgroundColor: colors.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="musical-notes" size={100} color={colors.primary} />
        </View>
      </View>

      {/* Title + subtitle */}
      <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
        <Text
          style={[typography.h2, { color: colors.text }]}
          numberOfLines={1}
        >
          {initialTitle}
        </Text>
        {initialSubtitle && (
          <Text
            style={[
              typography.bodySmall,
              { color: colors.textSecondary, marginTop: 2 },
            ]}
            numberOfLines={1}
          >
            {initialSubtitle}
          </Text>
        )}
      </View>

      {/* Slider */}
      <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
        <Slider
          minimumValue={0}
          maximumValue={duration / 1000}
          value={displayPosition / 1000}
          onSlidingStart={onSeekStart}
          onValueChange={onSeekChange}
          onSlidingComplete={onSeekEnd}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: -4,
          }}
        >
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {formatTime(displayPosition)}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {formatTime(status.durationMillis)}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: spacing.xl,
          marginTop: spacing.xl,
          marginBottom: spacing.xl,
        }}
      >
        <Pressable
          onPress={() => skipBy(-15)}
          style={{ padding: spacing.md }}
        >
          <Ionicons name="play-back" size={32} color={colors.text} />
        </Pressable>

        <Pressable
          onPress={onToggle}
          style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={status.isPlaying ? 'pause' : 'play'}
            size={44}
            color={colors.primaryText}
          />
        </Pressable>

        <Pressable
          onPress={() => skipBy(15)}
          style={{ padding: spacing.md }}
        >
          <Ionicons name="play-forward" size={32} color={colors.text} />
        </Pressable>
      </View>
    </SafeAreaView>
  );

  function formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
}