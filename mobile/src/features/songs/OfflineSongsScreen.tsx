import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, Pressable, Alert, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import {
  listOffline,
  removeOffline,
  OfflineEntry,
} from '../../services/offlineSongs';
import {
  playTrack,
  pauseTrack,
  resumeTrack,
  stopTrack,
  subscribe,
  getSnapshot,
  getCurrentKey,
  SimpleStatus,
} from '../../services/audioPlayer';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import { EmptyState, EqBars, HeroPill, ListSkeleton, ScreenHero } from './Songs_Kit';

export default function OfflineSongsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;

  const [items, setItems] = useState<OfflineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SimpleStatus>(getSnapshot());

  const load = useCallback(async () => {
    try {
      setItems(await listOffline());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  useEffect(() => {
    const unsub = subscribe(setStatus);
    setStatus(getSnapshot());
    return unsub;
  }, []);

  const onToggle = async (entry: OfflineEntry) => {
    const isThis = getCurrentKey() === entry.songId;
    const isPlaying = status.isLoaded && isThis && status.isPlaying;
    if (isPlaying) return void pauseTrack();
    if (isThis && status.isLoaded && !status.isPlaying) return void resumeTrack();
    await playTrack({ key: entry.songId, uri: entry.fileUri, title: entry.title });
  };

  // Navigate to SongDetail instead of Player
  const openSong = (entry: OfflineEntry) => {
    navigation.navigate('SongDetail', { id: entry.songId });
  };

  const onRemove = (songId: string) => {
    Alert.alert(t('songs.removeOffline'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('songs.removeOffline'),
        style: 'destructive',
        onPress: async () => {
          if (getCurrentKey() === songId) await stopTrack();
          await removeOffline(songId);
          void load();
        },
      },
    ]);
  };

  // Only show the skeleton when there is nothing to show yet (avoids a
  // flicker every time the screen regains focus).
  const showSkeleton = loading && items.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHero
        gradient={[BRAND.deep, BRAND.lavender, colors.primary]}
        icon="cloud-download"
        overline={t('tabs.songs', { defaultValue: 'Songs' })}
        title={t('songs.offline')}
        onBack={() => navigation.goBack()}
      >
        {!loading && items.length > 0 && (
          <HeroPill
            icon="download"
            text={t('songs.savedCount', { count: items.length, defaultValue: '{{count}} saved' })}
          />
        )}
      </ScreenHero>

      <FlatList
        data={showSkeleton ? [] : items}
        keyExtractor={(item) => item.songId}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xl,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          showSkeleton ? (
            <ListSkeleton rows={4} />
          ) : (
            <EmptyState
              icon="cloud-offline-outline"
              text={t('songs.emptyOffline')}
              ring={[BRAND.lime, BRAND.mint, BRAND.lavender]}
            />
          )
        }
        renderItem={({ item, index }) => {
          const isThis = getCurrentKey() === item.songId;
          const isPlaying = isThis && status.isLoaded && status.isPlaying;
          return (
            <OfflineCard
              item={item}
              index={index}
              isPlaying={isPlaying}
              onPress={() => openSong(item)}
              onToggle={() => onToggle(item)}
              onRemove={() => onRemove(item.songId)}
            />
          );
        }}
      />
    </View>
  );
}

function OfflineCard({
  item,
  index,
  isPlaying,
  onPress,
  onToggle,
  onRemove,
}: {
  item: OfflineEntry;
  index: number;
  isPlaying: boolean;
  onPress: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [enter, index]);

  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={{
        marginBottom: spacing.sm + 4,
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
          { scale },
        ],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.98)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          paddingLeft: 16,
          borderRadius: 22,
          borderWidth: isPlaying ? 1.5 : 1,
          borderColor: isPlaying ? withAlpha(colors.accent, 0.7) : colors.border,
          backgroundColor: isPlaying ? withAlpha(colors.accent, 0.07) : colors.surface,
          overflow: 'hidden',
        }}
      >
        <View style={{ backgroundColor: BRAND.lavender,  position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 }} />

        <Pressable
          onPress={onToggle}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? t('songs.pause') : t('songs.playAudio')}
        >
          <View style={{ backgroundColor: colors.primary, 
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: colors.primary,
              shadowOpacity: isPlaying ? 0.55 : 0.25,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={22}
              color={colors.primaryText}
              style={{ marginLeft: isPlaying ? 0 : 2 }}
            />
          </View>
        </Pressable>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text
            style={[typography.body, { color: colors.text, fontWeight: '800' }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            {isPlaying ? (
              <>
                <EqBars active color={colors.accent} height={12} />
                <Text
                  style={[typography.caption, { color: colors.accent, fontWeight: '800' }]}
                  numberOfLines={1}
                >
                  {t('songs.nowPlaying')}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                <Text
                  style={[typography.caption, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {t('songs.savedOfflineAt')} {new Date(item.savedAt).toLocaleDateString()}
                </Text>
              </>
            )}
          </View>
        </View>

        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('songs.removeOffline')}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: withAlpha(colors.error, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}