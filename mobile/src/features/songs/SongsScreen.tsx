import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
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
  listSongs,
  listCategories,
  SongSummary,
  SongCategory,
  zemaIsTeamMember,
} from '../../services/songs';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha } from '../auth/Auth_UI';

const PLACEHOLDERS: readonly [string, string][] = [
  [BRAND.violet, BRAND.magenta],
  [BRAND.water, BRAND.violet],
  [BRAND.magenta, '#F59E0B'],
  [BRAND.deep, BRAND.violet],
];

export default function SongsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<SongCategory[]>([]);
  const [items, setItems] = useState<SongSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isZema, setIsZema] = useState(false);

  const load = useCallback(async (q: string) => {
    setError(null);
    try {
      setItems(await listSongs(q));
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void (async () => {
        try { setCategories(await listCategories()); } catch {}
        try { setIsZema(await zemaIsTeamMember()); } catch { setIsZema(false); }
        await load(search);
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]),
  );

  const filtered = categoryId
    ? items.filter((s) => s.category?.id === categoryId)
    : items;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Hero */}
      <LinearGradient
        colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
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
        <View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: withAlpha(BRAND.gold, 0.22) }} />
        <View pointerEvents="none" style={{ position: 'absolute', bottom: -80, left: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: withAlpha(BRAND.water, 0.22) }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: BRAND.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="musical-notes" size={22} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
              {t('tabs.songs', { defaultValue: 'Songs' })}
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>
              {t('songs.lyrics', { defaultValue: 'Library' })}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.16)', marginTop: 16 }}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.85)" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('songs.searchPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.65)"
            autoCapitalize="none"
            selectionColor={BRAND.gold}
            style={{ flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 10 }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
          )}
        </View>

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <HeroAction icon="heart" label={t('songs.favorites')} onPress={() => navigation.navigate('Favorites')} />
          <HeroAction icon="cloud-download" label={t('songs.offline')} onPress={() => navigation.navigate('Offline')} />
          {isZema && (
            <HeroAction icon="musical-note" label={t('zema.team')} onPress={() => navigation.navigate('ZemaSubmissions')} />
          )}
        </View>

        {/* Category chips */}
        {categories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ paddingRight: 8 }}>
            <CategoryChip label={t('songs.allCategories')} active={categoryId === null} onPress={() => setCategoryId(null)} />
            {categories.map((c) => {
              const active = categoryId === c.id;
              return (
                <CategoryChip key={c.id} label={c.name} active={active} onPress={() => setCategoryId(active ? null : c.id)} />
              );
            })}
          </ScrollView>
        )}
      </LinearGradient>

      {error && (
        <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: 14, backgroundColor: withAlpha(colors.error, 0.1), borderWidth: 1, borderColor: withAlpha(colors.error, 0.35) }}>
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={BRAND.violet} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(search); }} tintColor={BRAND.violet} colors={[BRAND.violet]} />
          }
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <LinearGradient colors={[BRAND.violet, BRAND.magenta, BRAND.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="musical-notes-outline" size={40} color={colors.textSecondary} />
                </View>
              </LinearGradient>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>{t('songs.empty')}</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <SongCard
              item={item}
              index={index}
              onPress={() => navigation.navigate('SongDetail', { id: item.id })}
            />
          )}
        />
      )}
    </View>
  );
}

function HeroAction({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable onPress={onPress} onPressIn={() => to(0.96)} onPressOut={() => to(1)} accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' }}>
        <Ionicons name={icon} size={15} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }} numberOfLines={1}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 8, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ transform: [{ scale }], marginRight: 8 }}>
      <Pressable onPress={onPress} onPressIn={() => to(0.92)} onPressOut={() => to(1)} accessibilityRole="button"
        style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, backgroundColor: active ? BRAND.gold : 'rgba(255,255,255,0.14)', borderColor: active ? BRAND.gold : 'rgba(255,255,255,0.3)' }}>
        <Text style={{ color: active ? BRAND.deep : '#FFFFFF', fontSize: 13, fontWeight: '800' }} numberOfLines={1}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function SongCard({ item, index, onPress }: { item: SongSummary; index: number; onPress: () => void }) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const palette = PLACEHOLDERS[index % PLACEHOLDERS.length];
  const enter = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    const a = Animated.timing(enter, { toValue: 1, duration: 420, delay: Math.min(index, 8) * 50, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [enter, index]);
  const to = (v: number) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ marginBottom: spacing.sm + 4, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }, { scale }] }}>
      <Pressable onPress={onPress} onPressIn={() => to(0.98)} onPressOut={() => to(1)} accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', padding: 12, paddingLeft: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 }} />
        <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={item.youtubeUrl ? 'logo-youtube' : 'musical-notes'} size={24} color="#FFFFFF" />
        </LinearGradient>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[typography.body, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>{item.title}</Text>
          {item.category && (
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>{item.category.name}</Text>
          )}
        </View>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: withAlpha(palette[1], 0.16), alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-forward" size={18} color={palette[1]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}