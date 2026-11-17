import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../theme/ThemeContext';
import { SongSummary, zemaIsTeamMember } from '../../services/songs';
import { BRAND, ErrorBanner } from '../auth/Auth_UI';
import { useMe } from '../chat/chatSession';
import GlassBackButton from '../../components/GlassBackButton';
import {
  useSongsQuery,
  useSongCategoriesQuery,
  warmSongDetailCache,
} from './useSongs';
import {
  PALETTES,
  ScreenHero,
  HeroPill,
  SavedPill,
  EmptyState,
  ListSkeleton,
  SongRow,
  useNowPlaying,
  IconName,
} from './Songs_Kit';

export default function SongsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const userId = useMe()?.id ?? null;
  const np = useNowPlaying();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [isZema, setIsZema] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const q = useSongsQuery(debounced);
  const catQ = useSongCategoriesQuery();

  useEffect(() => {
    void (async () => {
      try {
        setIsZema(await zemaIsTeamMember());
      } catch {
        setIsZema(false);
      }
    })();
  }, []);

  const items = q.data ?? [];
  const categories = catQ.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  useEffect(() => {
    if (!items.length) return;
    void warmSongDetailCache(qc, userId, items.map((s) => s.id));
  }, [items, qc, userId]);

  const filtered = categoryId ? items.filter((s) => s.category?.id === categoryId) : items;

  // NOTE: the hero is passed to the list as an ELEMENT (not a component
  // function). Defining `const ListHeader = () => ...` inside the screen
  // makes React remount it on every keystroke, which dismisses the keyboard
  // while typing in the search box.
  const header = (
    <View style={{ marginHorizontal: -spacing.lg, marginTop: -spacing.md }}>
      <ScreenHero
        icon="musical-notes"
        overline={t('tabs.songs', { defaultValue: 'Songs' })}
        title={t('songs.lyrics', { defaultValue: 'Library' })}
      >
        {/* search */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minHeight: 50,
            paddingHorizontal: 14,
            borderRadius: 18,
            borderWidth: 1.5,
            borderColor: focused ? BRAND.gold : 'rgba(255,255,255,0.28)',
            backgroundColor: 'rgba(255,255,255,0.16)',
            marginTop: 16,
          }}
        >
          <Ionicons
            name="search"
            size={18}
            color={focused ? BRAND.gold : 'rgba(255,255,255,0.85)'}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('songs.searchPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.65)"
            autoCapitalize="none"
            selectionColor={BRAND.gold}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{ flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 11 }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
          )}
        </View>

        {/* quick actions */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <HeroAction
            icon="heart"
            label={t('songs.favorites')}
            onPress={() => navigation.navigate('Favorites')}
          />
          <HeroAction
            icon="cloud-download"
            label={t('songs.offline')}
            onPress={() => navigation.navigate('Offline')}
          />
          {isZema && (
            <HeroAction
              icon="musical-note"
              label={t('zema.team')}
              onPress={() => navigation.navigate('ZemaSubmissions')}
            />
          )}
        </View>

        {/* categories */}
        {categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 14 }}
            contentContainerStyle={{ paddingRight: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            <CategoryChip
              label={t('songs.allCategories')}
              active={categoryId === null}
              onPress={() => setCategoryId(null)}
            />
            {categories.map((c) => {
              const active = categoryId === c.id;
              return (
                <CategoryChip
                  key={c.id}
                  label={c.name}
                  active={active}
                  onPress={() => setCategoryId(active ? null : c.id)}
                />
              );
            })}
          </ScrollView>
        )}

        {!firstLoad && (
          <HeroPill
            icon="musical-notes"
            text={t('songs.count', { count: filtered.length, defaultValue: '{{count}} songs' })}
          />
        )}
      </ScreenHero>

      {(showingSavedData || (q.isError && q.data === undefined)) && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          {showingSavedData ? (
            <SavedPill />
          ) : (
            <ErrorBanner message={(q.error as any)?.message ?? 'Something went wrong.'} />
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Floating Back Button (stays on top while scrolling) */}
      <View style={{ position: 'absolute', top: insets.top + 16, right: 16, zIndex: 10 }}>
        <GlassBackButton onPress={() => navigation.goBack()} size={44} />
      </View>

      <FlatList
        data={firstLoad ? [] : filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !firstLoad}
            onRefresh={() => q.refetch()}
            tintColor={colors.primary}
            colors={[BRAND.teal]}
          />
        }
        ListEmptyComponent={
          firstLoad ? (
            <View style={{ marginTop: spacing.md }}>
              <ListSkeleton />
            </View>
          ) : (
            <EmptyState icon="musical-notes-outline" text={t('songs.empty')} />
          )
        }
        renderItem={({ item, index }) => (
          <SongCard
            item={item}
            index={index}
            playing={np.playing && np.key === item.id}
            onPress={() => navigation.navigate('SongDetail', { id: item.id })}
          />
        )}
      />
    </View>
  );
}

function HeroAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.96)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 11,
          paddingHorizontal: 8,
          borderRadius: 16,
          backgroundColor: 'rgba(255,255,255,0.16)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.28)',
        }}
      >
        <Ionicons name={icon} size={15} color={BRAND.gold} />
        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 8, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ transform: [{ scale }], marginRight: 8 }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.92)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={{
          paddingHorizontal: 15,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          backgroundColor: active ? BRAND.gold : 'rgba(255,255,255,0.14)',
          borderColor: active ? BRAND.gold : 'rgba(255,255,255,0.3)',
        }}
      >
        <Text
          style={{ color: active ? BRAND.deep : '#FFFFFF', fontSize: 13, fontWeight: '800' }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function SongCard({
  item,
  index,
  playing,
  onPress,
}: {
  item: SongSummary;
  index: number;
  playing: boolean;
  onPress: () => void;
}) {
  return (
    <SongRow
      index={index}
      title={item.title}
      subtitle={item.category?.name}
      icon={item.youtubeUrl ? 'logo-youtube' : 'musical-notes'}
      palette={PALETTES[index % PALETTES.length]}
      playing={playing}
      onPress={onPress}
    />
  );
}