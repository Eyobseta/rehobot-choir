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
  pauseTrack, resumeTrack, stopTrack, seekTo, skipBy,
  subscribe, getSnapshot, getCurrentKey, SimpleStatus,
} from '../../services/audioPlayer';

export default function PlayerScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const initialTitle: string = route.params?.title ?? t('songs.nowPlaying');
  const initialSubtitle: string | null = route.params?.subtitle ?? null;

  const [status, setStatus] = useState<SimpleStatus>(getSnapshot());
  const [sliding, setSliding] = useState<number | null>(null);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => { if (status.isLoaded) hasLoadedOnceRef.current = true; }, [status.isLoaded]);
  useEffect(() => {
    const unsub = subscribe(setStatus);
    setStatus(getSnapshot());
    return unsub;
  }, []);

  // pulse animation on art
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const hasTrack = getCurrentKey() !== null;
  if (!hasLoadedOnceRef.current || !hasTrack) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={BRAND.violet} />
      </SafeAreaView>
    );
  }

  const displayPosition = sliding !== null ? sliding * 1000 : status.positionMillis;
  const duration = status.durationMillis || 1;

  const onToggle = async () => { status.isPlaying ? await pauseTrack() : await resumeTrack(); };
  const onClose = async () => { await stopTrack(); hasLoadedOnceRef.current = false; navigation.goBack(); };
  const onSeekStart = () => setSliding(status.positionMillis / 1000);
  const onSeekChange = (v: number) => setSliding(v);
  const onSeekEnd = async (v: number) => { setSliding(null); await seekTo(v * 1000); };

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] });

  return (
    <LinearGradient colors={[BRAND.deep, '#1A0B45', '#0D0524']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: -120, right: -80, width: 320, height: 320, borderRadius: 160, backgroundColor: withAlpha(BRAND.magenta, 0.28) }} />
        <View pointerEvents="none" style={{ position: 'absolute', bottom: -140, left: -100, width: 340, height: 340, borderRadius: 170, backgroundColor: withAlpha(BRAND.violet, 0.32) }} />

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-down" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }}>
              {t('songs.nowPlaying')}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Album art with pulse ring */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          <Animated.View style={{ transform: [{ scale }], opacity: ringOpacity, position: 'absolute', width: 320, height: 320, borderRadius: 160, borderWidth: 2, borderColor: BRAND.gold }} />
          <LinearGradient colors={[BRAND.gold, BRAND.magenta, BRAND.violet, BRAND.water, BRAND.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 260, height: 260, borderRadius: 130, padding: 6 }}>
            <View style={{ flex: 1, borderRadius: 124, backgroundColor: '#0D0524', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="musical-notes" size={110} color={BRAND.gold} />
            </View>
          </LinearGradient>
        </View>

        {/* Title */}
        <View style={{ paddingHorizontal: spacing.xl, alignItems: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '800', textAlign: 'center' }} numberOfLines={2}>{initialTitle}</Text>
          {initialSubtitle && (
            <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 6, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{initialSubtitle}</Text>
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
            thumbTintColor="#FFFFFF"
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' }}>{formatTime(displayPosition)}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' }}>{formatTime(status.durationMillis)}</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: spacing.xl, marginTop: spacing.lg, marginBottom: spacing.xl }}>
          <Pressable onPress={() => skipBy(-15)} style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play-back" size={26} color="#FFFFFF" />
          </Pressable>

          <Pressable onPress={onToggle} style={{ width: 92, height: 92, borderRadius: 46, overflow: 'hidden', shadowColor: BRAND.magenta, shadowOpacity: 0.6, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 10 }}>
            <LinearGradient colors={[BRAND.violet, BRAND.magenta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={status.isPlaying ? 'pause' : 'play'} size={42} color="#FFFFFF" style={{ marginLeft: status.isPlaying ? 0 : 4 }} />
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => skipBy(15)} style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play-forward" size={26} color="#FFFFFF" />
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  function formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
}