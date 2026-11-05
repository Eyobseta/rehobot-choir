import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import {
  pauseTrack,
  resumeTrack,
  stopTrack,
  subscribe,
  getSnapshot,
  SimpleStatus,
} from '../../services/audioPlayer';
import { EqBars } from './Songs_Kit';

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function NowPlayingBar() {
  const [status, setStatus] = useState<SimpleStatus>(getSnapshot());
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

  const onClose = async () => {
    await stopTrack();
    hasLoadedOnceRef.current = false;
  };

  return <Bar status={status} onClose={onClose} />;
}

/** Mounted only while a track exists, so it can slide in on first appearance. */
function Bar({ status, onClose }: { status: SimpleStatus; onClose: () => void }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const navigation = useNavigation<any>();

  const enter = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const progress =
    status.durationMillis > 0 ? Math.min(1, status.positionMillis / status.durationMillis) : 0;

  const onToggle = async () => {
    status.isPlaying ? await pauseTrack() : await resumeTrack();
  };
  const onOpen = () => navigation.navigate('Songs', { screen: 'Player' });
  const pressTo = (v: number) =>
    Animated.spring(press, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
        ],
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
        shadowColor: BRAND.deep,
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: -4 },
        elevation: 8,
      }}
    >
      {/* Gradient progress with a glowing head */}
      <View style={{ height: 4, backgroundColor: colors.surfaceAlt, overflow: 'visible' }}>
        <LinearGradient
          colors={[BRAND.violet, BRAND.magenta]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: `${progress * 100}%`, height: 4 }}
        />
        {progress > 0 && (
          <View
            style={{
              position: 'absolute',
              left: `${progress * 100}%`,
              top: -3,
              marginLeft: -5,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: BRAND.gold,
              shadowColor: BRAND.gold,
              shadowOpacity: 0.8,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
        )}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        <Animated.View style={{ flex: 1, transform: [{ scale: press }] }}>
          <Pressable
            onPress={onOpen}
            onPressIn={() => pressTo(0.98)}
            onPressOut={() => pressTo(1)}
            accessibilityRole="button"
            accessibilityLabel={t('songs.nowPlaying')}
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            <LinearGradient
              colors={[BRAND.violet, BRAND.magenta]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {status.isPlaying ? (
                <EqBars active color="#FFFFFF" height={18} />
              ) : (
                <Ionicons name="musical-notes" size={21} color="#FFFFFF" />
              )}
            </LinearGradient>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text
                style={[typography.bodySmall, { color: colors.text, fontWeight: '800' }]}
                numberOfLines={1}
              >
                {t('songs.nowPlaying')}
              </Text>
              <Text
                style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
                numberOfLines={1}
              >
                {formatTime(status.positionMillis)} / {formatTime(status.durationMillis)}
              </Text>
            </View>
            <Ionicons name="chevron-up" size={18} color={colors.textSecondary} />
          </Pressable>
        </Animated.View>

        <Pressable
          onPress={onToggle}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={status.isPlaying ? t('songs.pause') : t('songs.playAudio')}
          style={{ marginHorizontal: 8 }}
        >
          <LinearGradient
            colors={[BRAND.violet, BRAND.magenta]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={status.isPlaying ? 'pause' : 'play'}
              size={20}
              color="#FFFFFF"
              style={{ marginLeft: status.isPlaying ? 0 : 2 }}
            />
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: withAlpha(colors.textSecondary, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}