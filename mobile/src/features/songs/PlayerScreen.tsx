import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
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
import { EqBars, useReduceMotion } from './Songs_Kit';

const DISC = 262;

export default function PlayerScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const reduce = useReduceMotion();

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

  // pulse animation on the glow ring
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);

  // Vinyl spin: rotates while playing, freezes (not resets) when paused.
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce || !status.isPlaying) {
      rot.stopAnimation();
      return;
    }
    let cancelled = false;
    const spin = (from: number) => {
      Animated.timing(rot, {
        toValue: 1,
        duration: Math.max(200, (1 - from) * 14000),
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) {
          rot.setValue(0);
          spin(0);
        }
      });
    };
    rot.stopAnimation((v) => spin(v % 1));
    return () => {
      cancelled = true;
      rot.stopAnimation();
    };
  }, [status.isPlaying, reduce, rot]);

  // press feedback on the main button
  const playScale = useRef(new Animated.Value(1)).current;
  const playTo = (v: number) =>
    Animated.spring(playScale, { toValue: v, speed: 40, bounciness: 8, useNativeDriver: true }).start();

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
        <ActivityIndicator size="large" color={BRAND.violet} />
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          style={{
            position: 'absolute',
            top: 56,
            left: 16,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: withAlpha(BRAND.violet, 0.14),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-down" size={22} color={BRAND.violet} />
        </Pressable>
      </SafeAreaView>
    );
  }

  const displayPosition = sliding !== null ? sliding * 1000 : status.positionMillis;
  const duration = status.durationMillis || 1;

  const onToggle = async () => {
    status.isPlaying ? await pauseTrack() : await resumeTrack();
  };
  const onClose = async () => {
    await stopTrack();
    hasLoadedOnceRef.current = false;
    navigation.goBack();
  };
  const onSeekStart = () => setSliding(status.positionMillis / 1000);
  const onSeekChange = (v: number) => setSliding(v);
  const onSeekEnd = async (v: number) => {
    setSliding(null);
    await seekTo(v * 1000);
  };

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });
  const spinDeg = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <LinearGradient
      colors={[BRAND.deep, '#1A0B45', '#0D0524']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -120,
            right: -80,
            width: 320,
            height: 320,
            borderRadius: 160,
            backgroundColor: withAlpha(BRAND.magenta, 0.28),
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: -140,
            left: -100,
            width: 340,
            height: 340,
            borderRadius: 170,
            backgroundColor: withAlpha(BRAND.violet, 0.32),
          }}
        />

        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: 'rgba(255,255,255,0.14)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-down" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            <EqBars active={status.isPlaying} color={BRAND.gold} height={12} />
            <Text
              style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 1.4,
                textTransform: 'uppercase',
              }}
            >
              {t('songs.nowPlaying')}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: 'rgba(255,255,255,0.14)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Vinyl */}
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.xl,
          }}
        >
          <Animated.View
            style={{
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
              position: 'absolute',
              width: DISC + 56,
              height: DISC + 56,
              borderRadius: (DISC + 56) / 2,
              borderWidth: 2,
              borderColor: BRAND.gold,
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: DISC + 24,
              height: DISC + 24,
              borderRadius: (DISC + 24) / 2,
              backgroundColor: withAlpha(BRAND.gold, 0.08),
            }}
          />

          <Animated.View
            style={{
              width: DISC,
              height: DISC,
              borderRadius: DISC / 2,
              transform: [{ rotate: spinDeg }],
              shadowColor: BRAND.magenta,
              shadowOpacity: 0.55,
              shadowRadius: 26,
              shadowOffset: { width: 0, height: 14 },
              elevation: 12,
            }}
          >
            <LinearGradient
              colors={[BRAND.gold, BRAND.magenta, BRAND.violet, BRAND.water, BRAND.gold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, borderRadius: DISC / 2, padding: 6 }}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: DISC / 2,
                  backgroundColor: '#0D0524',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* grooves */}
                {[18, 40, 62].map((inset) => (
                  <View
                    key={inset}
                    style={{
                      position: 'absolute',
                      top: inset,
                      left: inset,
                      right: inset,
                      bottom: inset,
                      borderRadius: DISC,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.07)',
                    }}
                  />
                ))}
                {/* label */}
                <LinearGradient
                  colors={[BRAND.gold, BRAND.magenta]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="musical-notes" size={40} color={BRAND.deep} />
                </LinearGradient>
                <View
                  style={{
                    position: 'absolute',
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: '#0D0524',
                    borderWidth: 2,
                    borderColor: 'rgba(255,255,255,0.35)',
                  }}
                />
              </View>
            </LinearGradient>
          </Animated.View>
        </View>

        {/* Title */}
        <View style={{ paddingHorizontal: spacing.xl, alignItems: 'center' }}>
          <Text
            style={{ color: '#FFFFFF', fontSize: 25, fontWeight: '800', textAlign: 'center' }}
            numberOfLines={2}
          >
            {initialTitle}
          </Text>
          {initialSubtitle && (
            <Text
              style={{
                color: 'rgba(255,255,255,0.7)',
                marginTop: 6,
                fontSize: 13,
                fontWeight: '600',
              }}
              numberOfLines={1}
            >
              {initialSubtitle}
            </Text>
          )}
        </View>

        {/* Progress */}
        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
          <Slider
            minimumValue={0}
            maximumValue={duration / 1000}
            value={displayPosition / 1000}
            onSlidingStart={onSeekStart}
            onValueChange={onSeekChange}
            onSlidingComplete={onSeekEnd}
            minimumTrackTintColor={BRAND.gold}
            maximumTrackTintColor="rgba(255,255,255,0.2)"
            thumbTintColor={BRAND.gold}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 }}>
            <Text style={{ color: sliding !== null ? BRAND.gold : 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '800' }}>
              {formatTime(displayPosition)}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' }}>
              -{formatTime(Math.max(0, status.durationMillis - displayPosition))}
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
            marginTop: spacing.lg,
            marginBottom: spacing.xl,
          }}
        >
          <SkipButton icon="play-back" label="15" onPress={() => skipBy(-15)} />

          <Animated.View style={{ transform: [{ scale: playScale }] }}>
            <Pressable
              onPress={onToggle}
              onPressIn={() => playTo(0.94)}
              onPressOut={() => playTo(1)}
              accessibilityRole="button"
              accessibilityLabel={status.isPlaying ? t('songs.pause') : t('songs.playAudio')}
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                overflow: 'hidden',
                shadowColor: BRAND.magenta,
                shadowOpacity: 0.65,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 12 },
                elevation: 12,
              }}
            >
              <LinearGradient
                colors={[BRAND.violet, BRAND.magenta]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: 'rgba(255,255,255,0.25)',
                  borderRadius: 48,
                }}
              >
                <Ionicons
                  name={status.isPlaying ? 'pause' : 'play'}
                  size={44}
                  color="#FFFFFF"
                  style={{ marginLeft: status.isPlaying ? 0 : 5 }}
                />
              </LinearGradient>
            </Pressable>
          </Animated.View>

          <SkipButton icon="play-forward" label="15" onPress={() => skipBy(15)} />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function SkipButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}s`}
      style={({ pressed }) => ({
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: pressed ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Ionicons name={icon} size={22} color="#FFFFFF" />
      <Text style={{ color: BRAND.gold, fontSize: 10, fontWeight: '800', marginTop: -1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}