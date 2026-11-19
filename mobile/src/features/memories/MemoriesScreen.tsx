import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Image,
  RefreshControl,
  ScrollView,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../theme/ThemeContext';
import { MemorySummary } from '../../services/memories';
import { BRAND, withAlpha, ErrorBanner } from '../auth/Auth_UI';
import { formatEthDate } from '../../utils/ethiopianCalendar';
import {
  DatePill,
  EmptyState,
  SavedPill,
  MemoryListSkeleton,
  PALETTES,
  memoryToEthDate,
} from './Memorykit';
import MemoriesHeader from './MemoriesHeader';
import { useMe } from '../chat/chatSession';
import {
  useMemoriesQuery,
  useMemoryYearsQuery,
  warmMemoryDetailCache,
} from './useMemories';

export default function MemoriesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const qc = useQueryClient();
  const userId = useMe()?.id ?? null;

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const q = useMemoriesQuery(debounced);
  const yearsQ = useMemoryYearsQuery();

  const items = q.data ?? [];
  const years = yearsQ.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  // Background prefetch all memory details
  useEffect(() => {
    if (!items.length) return;
    void warmMemoryDetailCache(qc, userId, items.map((m) => m.id));
  }, [items, qc, userId]);

  const filtered = year ? items.filter((m) => m.dateEthYear === year) : items;
  const filtering = debounced.length > 0 || year !== null;

  const clearFilters = () => {
    setSearch('');
    setDebounced('');
    setYear(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: spacing.xl * 2, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !firstLoad}
            onRefresh={() => q.refetch()}
            tintColor={colors.primary}
            colors={[BRAND.teal]}
          />
        }
        ListHeaderComponent={
          <View>
            <MemoriesHeader>
              <SearchBox
                value={search}
                onChangeText={setSearch}
                placeholder={t('memories.searchPlaceholder')}
              />

              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <HeaderButton
                  solid
                  icon="add-circle"
                  label={t('memories.submit')}
                  onPress={() => navigation.navigate('SubmitMemory')}
                />
                <HeaderButton
                  icon="albums"
                  label={t('memories.mine')}
                  onPress={() => navigation.navigate('MyMemories')}
                />
              </View>

              {years.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: spacing.md }}
                  contentContainerStyle={{ paddingRight: spacing.lg }}
                >
                  <YearChip
                    label={t('memories.allYears')}
                    active={year === null}
                    onPress={() => setYear(null)}
                  />
                  {years.map((y) => {
                    const active = year === y.year;
                    return (
                      <YearChip
                        key={y.year}
                        label={`${y.year} (${y.count})`}
                        active={active}
                        onPress={() => setYear(active ? null : y.year)}
                      />
                    );
                  })}
                </ScrollView>
              )}
            </MemoriesHeader>

            {showingSavedData && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
                <SavedPill />
              </View>
            )}

            {q.isError && q.data === undefined && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
                <ErrorBanner message={(q.error as any)?.message ?? 'Error'} />
              </View>
            )}

            {firstLoad ? (
              <View style={{ paddingTop: spacing.md }}>
                <MemoryListSkeleton rows={3} />
              </View>
            ) : filtered.length > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing.lg + 2,
                  paddingTop: spacing.lg,
                  paddingBottom: spacing.md,
                }}
              >
                <Text style={[typography.bodySmall, { color: colors.textSecondary, fontWeight: '700' }]}>
                  {filtered.length === 1
                    ? t('memories.countOne', { defaultValue: '1 memory' })
                    : t('memories.count', { count: filtered.length, defaultValue: '{{count}} memories' })}
                </Text>
                {filtering && (
                  <Pressable onPress={clearFilters} hitSlop={10} accessibilityRole="button">
                    <Text style={[typography.bodySmall, { color: colors.accent, fontWeight: '800' }]}>
                      {t('memories.clearFilters', { defaultValue: 'Clear filters' })}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={{ height: spacing.md }} />
            )}
          </View>
        }
        ListEmptyComponent={
          firstLoad ? null : filtering ? (
            <EmptyState
              icon="search-outline"
              text={t('memories.noResults', { defaultValue: 'No memories match your search.' })}
              actionLabel={t('memories.clearFilters', { defaultValue: 'Clear filters' })}
              onAction={clearFilters}
            />
          ) : (
            <EmptyState
              icon="images-outline"
              text={t('memories.empty')}
              actionLabel={t('memories.submit')}
              onAction={() => navigation.navigate('SubmitMemory')}
            />
          )
        }
        renderItem={({ item, index }) => (
          <MemoryCard
            item={item}
            index={index}
            featured={!filtering && index === 0}
            onPress={() => navigation.navigate('MemoryDetail', { id: item.id })}
          />
        )}
      />
    </View>
  );
}

function SearchBox({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder: string }) {
  const focus = useRef(new Animated.Value(0)).current;
  const animate = (v: number) => Animated.timing(focus, { toValue: v, duration: 180, useNativeDriver: false }).start();

  return (
    <Animated.View
      style={[
        styles.search,
        {
          borderColor: focus.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.18)', BRAND.lime] }),
          backgroundColor: BRAND.tealDark,
        },
      ]}
    >
      <Ionicons name="search" size={18} color="rgba(255,255,255,0.8)" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.55)"
        autoCapitalize="none"
        returnKeyType="search"
        selectionColor={BRAND.lime}
        onFocus={() => animate(1)}
        onBlur={() => animate(0)}
        style={styles.searchInput}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button">
          <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.8)" />
        </Pressable>
      )}
    </Animated.View>
  );
}

function HeaderButton({ icon, label, onPress, solid }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; solid?: boolean; }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 8, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.96)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        style={[
          styles.headerButton,
          solid
            ? { backgroundColor: BRAND.lime }
            : { backgroundColor: BRAND.tealDark, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
        ]}
      >
        <Ionicons name={icon} size={18} color={solid ? BRAND.deep : '#FFFFFF'} />
        <Text numberOfLines={1} style={{ color: solid ? BRAND.deep : '#FFFFFF', fontWeight: '800', fontSize: 13, flexShrink: 1 }}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function YearChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 8, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ transform: [{ scale }], marginRight: 8 }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.92)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={[
          styles.chip,
          active
            ? { backgroundColor: BRAND.lime, borderColor: BRAND.lime }
            : { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.22)' },
        ]}
      >
        <Text style={{ color: active ? BRAND.deep : 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '800' }}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function MemoryCard({ item, index, featured, onPress }: { item: MemorySummary; index: number; featured: boolean; onPress: () => void; }) {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const { colors, spacing, typography } = theme;

  const thumb = item.media.find((m) => m.type === 'PHOTO')?.storageUrl;
  const photoCount = item.media.filter((m) => m.type === 'PHOTO').length;
  const hasAudio = item.media.some((m) => m.type === 'AUDIO');
  const ytCount = item.media.filter((m) => m.type === 'YOUTUBE').length;
  const ethLabel = formatEthDate(memoryToEthDate(item), lang);
  const palette = PALETTES[index % PALETTES.length];
  const placeholderIcon: React.ComponentProps<typeof Ionicons>['name'] = hasAudio
    ? 'musical-notes'
    : ytCount > 0
    ? 'logo-youtube'
    : 'images';

  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.timing(enter, { toValue: 1, duration: 450, delay: Math.min(index, 6) * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [enter, index]);
  const to = (v: number) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.lg, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }, { scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.98)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: featured ? BRAND.lime : colors.border,
            borderWidth: featured ? 2 : 1,
          },
        ]}
      >
        <View style={{ height: featured ? 252 : 200 }}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name={placeholderIcon} size={64} color="rgba(255,255,255,0.28)" />
            </LinearGradient>
          )}

          <LinearGradient pointerEvents="none" colors={['rgba(14,38,44,0)', 'rgba(14,38,44,0.82)']} style={styles.imageFade} />

          <View style={styles.topRow}>
            <DatePill text={ethLabel} onDark />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {photoCount > 1 && (
                <View style={styles.badge}>
                  <Ionicons name="images" size={12} color={BRAND.lime} />
                  <Text style={styles.badgeText}>{photoCount}</Text>
                </View>
              )}
              {hasAudio && (
                <View style={[styles.badge, { backgroundColor: BRAND.lavender }]}>
                  <Ionicons name="musical-notes" size={12} color={BRAND.teal} />
                </View>
              )}
              {ytCount > 0 && (
                <View style={[styles.badge, { backgroundColor: 'rgba(255,45,45,0.92)' }]}>
                  <Ionicons name="logo-youtube" size={12} color="#FFFFFF" />
                </View>
              )}
            </View>
          </View>

          <View style={styles.titleBlock}>
            {featured && (
              <View style={styles.latestTag}>
                <Ionicons name="sparkles" size={12} color={BRAND.teal} />
                <Text style={{ color: BRAND.teal, fontSize: 11, fontWeight: '800' }}>
                  {t('memories.latest', { defaultValue: 'Latest' })}
                </Text>
              </View>
            )}
            <Text style={[styles.cardTitle, featured && { fontSize: 24 }]} numberOfLines={2}>{item.title}</Text>
          </View>
        </View>

        <View style={{ padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]} numberOfLines={2}>
            {item.description || t('memories.tapToView', { defaultValue: 'Tap to view' })}
          </Text>
          <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: BRAND.teal, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-forward" size={16} color={BRAND.lime} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5 },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 10 },
  headerButton: { minHeight: 46, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  chip: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', borderRadius: 999, borderWidth: 1 },
  card: { borderRadius: 26, overflow: 'hidden' },
  imageFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 130 },
  topRow: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(14,38,44,0.62)' },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  titleBlock: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  latestTag: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: BRAND.lime, marginBottom: 8 },
  cardTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
});