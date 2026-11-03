import React, { useRef } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl,
  Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { FavoriteRow } from '../../services/songs';
import { BRAND, withAlpha, ErrorBanner } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { useFavoriteSongsQuery } from './useSongs';

const HEART = '#E0245E';
const PALETTES: readonly [string, string][] = [
  [BRAND.violet, BRAND.magenta],
  [BRAND.water, BRAND.violet],
  [BRAND.magenta, '#F59E0B'],
  [BRAND.deep, BRAND.violet],
];

export default function FavoritesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  const q = useFavoriteSongsQuery();
  const items = q.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={['#7C1A3C', HEART, BRAND.magenta]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}
      >
        <View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: withAlpha(BRAND.gold, 0.24) }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: BRAND.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="heart" size={22} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>{t('tabs.songs', { defaultValue: 'Songs' })}</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>{t('songs.favorites')}</Text>
          </View>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>

        {!firstLoad && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <Ionicons name="musical-notes" size={13} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{items.length} songs</Text>
          </View>
        )}
      </LinearGradient>

      {showingSavedData && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: withAlpha('#F59E0B', 0.14), borderWidth: 1, borderColor: withAlpha('#F59E0B', 0.4) }}>
            <Ionicons name="cloud-offline" size={13} color="#F59E0B" />
            <Text style={[typography.caption, { color: '#F59E0B', fontWeight: '800' }]}>{t('home.showingSavedData', { defaultValue: 'Showing saved data' })}</Text>
          </View>
        </View>
      )}

      {q.isError && q.data === undefined && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <ErrorBanner message={(q.error as any)?.message ?? 'Error'} />
        </View>
      )}

      {firstLoad ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={BRAND.violet} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={q.isRefetching && !firstLoad} onRefresh={() => q.refetch()} tintColor={BRAND.violet} colors={[BRAND.violet]} />}
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <LinearGradient colors={[BRAND.violet, BRAND.magenta, BRAND.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="heart-outline" size={40} color={colors.textSecondary} />
                </View>
              </LinearGradient>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>{t('songs.emptyFavorites')}</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <FavCard item={item} index={index} onPress={() => navigation.navigate('SongDetail', { id: item.song.id })} />
          )}
        />
      )}
    </View>
  );
}

function FavCard({ item, index, onPress }: { item: FavoriteRow; index: number; onPress: () => void }) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const palette = PALETTES[index % PALETTES.length];
  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    const a = Animated.timing(enter, { toValue: 1, duration: 420, delay: Math.min(index, 8) * 55, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [enter, index]);
  const to = (v: number) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ marginBottom: spacing.sm + 4, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }, { scale }] }}>
      <Pressable onPress={onPress} onPressIn={() => to(0.98)} onPressOut={() => to(1)}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 12, paddingLeft: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 }} />
        <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="musical-notes" size={22} color="#FFFFFF" />
        </LinearGradient>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[typography.body, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>{item.song.title}</Text>
          {item.song.category && (
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>{item.song.category.name}</Text>
          )}
        </View>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: withAlpha(HEART, 0.14), alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="heart" size={16} color={HEART} />
        </View>
      </Pressable>
    </Animated.View>
  );
}