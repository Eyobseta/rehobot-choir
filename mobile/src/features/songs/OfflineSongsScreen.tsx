import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import GlassBackButton from '../../components/GlassBackButton';

export default function OfflineSongsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

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

  // FIXED: Navigate to SongDetail instead of Player
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[BRAND.deep, BRAND.water, BRAND.violet]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
          paddingBottom: 22,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          overflow: 'hidden',
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -60,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: withAlpha(BRAND.gold, 0.24),
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              backgroundColor: BRAND.gold,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="cloud-download" size={22} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              {t('tabs.songs', { defaultValue: 'Songs' })}
            </Text>
            <Text
              style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }}
              numberOfLines={1}
            >
              {t('songs.offline')}
            </Text>
          </View>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>
        {!loading && items.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 14,
              alignSelf: 'flex-start',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}
          >
            <Ionicons name="download" size={13} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
              {items.length} saved
            </Text>
          </View>
        )}
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={BRAND.violet} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.songId}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <LinearGradient
                colors={[BRAND.violet, BRAND.magenta, BRAND.gold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: 52,
                    backgroundColor: colors.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name="cloud-offline-outline"
                    size={40}
                    color={colors.textSecondary}
                  />
                </View>
              </LinearGradient>
              <Text
                style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}
              >
                {t('songs.emptyOffline')}
              </Text>
            </View>
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
      )}
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
    Animated.spring(scale, {
      toValue: v,
      speed: 40,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

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
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          paddingLeft: 16,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={[BRAND.water, BRAND.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 }}
        />

        <Pressable onPress={onToggle} accessibilityRole="button">
          <LinearGradient
            colors={[BRAND.violet, BRAND.magenta]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={22}
              color="#FFFFFF"
              style={{ marginLeft: isPlaying ? 0 : 2 }}
            />
          </LinearGradient>
        </Pressable>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text
            style={[typography.body, { color: colors.text, fontWeight: '800' }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
            <Text
              style={[typography.caption, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {t('songs.savedOfflineAt')} {new Date(item.savedAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onRemove}
          hitSlop={10}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
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