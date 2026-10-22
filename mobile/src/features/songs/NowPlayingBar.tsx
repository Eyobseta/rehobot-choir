import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import { pauseTrack, resumeTrack, stopTrack, subscribe, getSnapshot, SimpleStatus } from '../../services/audioPlayer';

export default function NowPlayingBar() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const navigation = useNavigation<any>();

  const [status, setStatus] = useState<SimpleStatus>(getSnapshot());
  const hasLoadedOnceRef = useRef(false);
  useEffect(() => { if (status.isLoaded) hasLoadedOnceRef.current = true; }, [status.isLoaded]);
  useEffect(() => { const unsub = subscribe(setStatus); setStatus(getSnapshot()); return unsub; }, []);
  if (!hasLoadedOnceRef.current) return null;

  const progress = status.durationMillis > 0 ? Math.min(1, status.positionMillis / status.durationMillis) : 0;

  const onToggle = async () => { status.isPlaying ? await pauseTrack() : await resumeTrack(); };
  const onClose = async () => { await stopTrack(); hasLoadedOnceRef.current = false; };
  const onOpen = () => navigation.navigate('Songs', { screen: 'Player' });

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
      {/* Gradient progress */}
      <View style={{ height: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
        <LinearGradient colors={[BRAND.violet, BRAND.magenta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ width: `${progress * 100}%`, height: 3 }} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <Pressable onPress={onOpen} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <LinearGradient colors={[BRAND.violet, BRAND.magenta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="musical-notes" size={20} color="#FFFFFF" />
          </LinearGradient>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={[typography.bodySmall, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>{t('songs.nowPlaying')}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
              {formatTime(status.positionMillis)} / {formatTime(status.durationMillis)}
            </Text>
          </View>
        </Pressable>

        <Pressable onPress={onToggle} hitSlop={6} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(BRAND.violet, 0.14), alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 }}>
          <Ionicons name={status.isPlaying ? 'pause' : 'play'} size={20} color={BRAND.violet} style={{ marginLeft: status.isPlaying ? 0 : 2 }} />
        </Pressable>

        <Pressable onPress={onClose} hitSlop={6} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
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