import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Animated, Easing } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

const DISC = 232;

export default function PlayerScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();

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
        <ActivityIndicator size="large" color={colors.primary} />
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
            backgroundColor: withAlpha(colors.primary, 0.14),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-down" size={22} color={colors.primary} />
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
    <View style={{ flex: 1, backgroundColor: BRAND.teal }}>
      {/* flat stage shapes */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -120, right: -80, width: 270, height: 270, borderRadius: 135, backgroundColor: BRAND.lime }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 250, left: -80, width: 170, height: 170, borderRadius: 85, backgroundColor: withAlpha(BRAND.lavender, 0.2) }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 140, right: 26, width: 18, height: 18, borderRadius: 5, backgroundColor: BRAND.mint, transform: [{ rotate: '45deg' }] }} />

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
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
              width: 44,
              height: 44,
              borderRadius: 15,
              backgroundColor: BRAND.tealDark,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-down" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: BRAND.tealDark,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.14)',
              }}
            >
              <EqBars active={status.isPlaying} color={BRAND.lime} height={12} />
              <Text
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                }}
              >
                {t('songs.nowPlaying')}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
            style={{
              width: 44,
              height: 44,
              borderRadius: 15,
              backgroundColor: BRAND.tealDark,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Vinyl stage */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 26 }}>
          <Animated.View
            style={{
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
              position: 'absolute',
              width: DISC + 52,
              height: DISC + 52,
              borderRadius: (DISC + 52) / 2,
              borderWidth: 2,
              borderColor: BRAND.lavender,
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: DISC + 22,
              height: DISC + 22,
              borderRadius: (DISC + 22) / 2,
              backgroundColor: withAlpha(BRAND.lavender, 0.14),
            }}
          />
          <Animated.View
            style={{
              width: DISC,
              height: DISC,
              borderRadius: DISC / 2,
              transform: [{ rotate: spinDeg }],
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 14 },
              elevation: 12,
            }}
          >
            <LinearGradient
              colors={[BRAND.lavender, BRAND.lime, BRAND.mint, BRAND.lavender]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, borderRadius: DISC / 2, padding: 8 }}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: DISC / 2,
                  backgroundColor: BRAND.tealDark,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {[16, 36, 56].map((inset) => (
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
                      borderColor: 'rgba(255,255,255,0.08)',
                    }}
                  />
                ))}
                <View
                  style={{
                    width: 92,
                    height: 92,
                    borderRadius: 46,
                    backgroundColor: BRAND.lime,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="musical-notes" size={38} color={BRAND.teal} />
                </View>
                <View
                  style={{
                    position: 'absolute',
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: BRAND.tealDark,
                    borderWidth: 2,
                    borderColor: 'rgba(255,255,255,0.4)',
                  }}
                />
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </SafeAreaView>

      {/* Control sheet */}
      <View
        style={{
          backgroundColor: colors.background,
          borderTopLeftRadius: 38,
          borderTopRightRadius: 38,
          paddingHorizontal: spacing.xl,
          paddingTop: 12,
          paddingBottom: insets.bottom + 22,
        }}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 44,
            height: 5,
            borderRadius: 3,
            backgroundColor: colors.border,
            marginBottom: spacing.lg,
          }}
        />

        {/* Title */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.3 }}
              numberOfLines={2}
            >
              {initialTitle}
            </Text>
            {initialSubtitle && (
              <View
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 8,
                  paddingHorizontal: 11,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: withAlpha(colors.accent, 0.16),
                }}
              >
                <Text
                  style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }}
                  numberOfLines={1}
                >
                  {initialSubtitle}
                </Text>
              </View>
            )}
          </View>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 16,
              backgroundColor: colors.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <EqBars active={status.isPlaying} color={colors.primary} height={18} />
          </View>
        </View>

        {/* Progress */}
        <View style={{ marginTop: spacing.lg }}>
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 }}>
            <Text style={{ color: sliding !== null ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: '800' }}>
              {formatTime(displayPosition)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
              -{formatTime(Math.max(0, status.durationMillis - displayPosition))}
            </Text>
          </View>
        </View>

        {/* Controls */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing.lg,
            paddingHorizontal: spacing.sm,
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
                width: 88,
                height: 88,
                borderRadius: 32,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: colors.primary,
                shadowOpacity: 0.4,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 10 },
                elevation: 10,
              }}
            >
              <Ionicons
                name={status.isPlaying ? 'pause' : 'play'}
                size={40}
                color={colors.primaryText}
                style={{ marginLeft: status.isPlaying ? 0 : 4 }}
              />
            </Pressable>
          </Animated.View>

          <SkipButton icon="play-forward" label="15" onPress={() => skipBy(15)} />
        </View>
      </View>
    </View>
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
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}s`}
      style={({ pressed }) => ({
        width: 64,
        height: 64,
        borderRadius: 22,
        backgroundColor: pressed ? colors.border : colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
      <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '800', marginTop: -1 }}>
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