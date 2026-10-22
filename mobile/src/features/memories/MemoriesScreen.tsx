import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import {
  listMemories,
  listMemoryYears,
  MemorySummary,
  MemoryYear,
} from '../../services/memories';
import { ApiError } from '../../services/api';
import { ErrorBanner, BRAND, withAlpha } from '../auth/Auth_UI';
import { DatePill, EmptyState } from './Memorykit';
import MemoriesHeader from './MemoriesHeader';

const PLACEHOLDERS: readonly [string, string][] = [
  [BRAND.violet, BRAND.magenta],
  [BRAND.water, BRAND.violet],
  [BRAND.magenta, '#F59E0B'],
  [BRAND.deep, BRAND.violet],
];

export default function MemoriesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;

  const [search, setSearch] = useState('');
  const [year, setYear] = useState<number | null>(null);
  const [years, setYears] = useState<MemoryYear[]>([]);
  const [items, setItems] = useState<MemorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setError(null);
    try {
      const list = await listMemories(q);
      setItems(list);
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
        try {
          setYears(await listMemoryYears());
        } catch {
          // ignore
        }
        await load(search);
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]),
  );

  const filtered = year
    ? items.filter((m) => new Date(m.date).getUTCFullYear() === year)
    : items;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(search);
            }}
            tintColor={BRAND.violet}
            colors={[BRAND.violet]}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Custom header — now scrolls with the list */}
            <MemoriesHeader />

            <LinearGradient
              colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.header}
            >
              <View
                pointerEvents="none"
                style={[
                  styles.blob,
                  { top: -60, right: -40, backgroundColor: withAlpha(BRAND.gold, 0.2) },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.blob,
                  { bottom: -80, left: -50, backgroundColor: withAlpha(BRAND.water, 0.2) },
                ]}
              />

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
            </LinearGradient>

            {error && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
                <ErrorBanner message={error} />
              </View>
            )}

            {loading && (
              <View style={{ paddingVertical: spacing.xl * 2, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={BRAND.violet} />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="images-outline" text={t('memories.empty')} />
          ) : null
        }
        renderItem={({ item, index }) => (
          <MemoryCard
            item={item}
            index={index}
            onPress={() => navigation.navigate('MemoryDetail', { id: item.id })}
          />
        )}
      />
    </View>
  );
}

// ---------- Helpers ----------

function SearchBox({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  const focus = useRef(new Animated.Value(0)).current;
  const animate = (v: number) =>
    Animated.timing(focus, { toValue: v, duration: 180, useNativeDriver: false }).start();

  return (
    <Animated.View
      style={[
        styles.search,
        {
          borderColor: focus.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(255,255,255,0.28)', BRAND.gold],
          }),
          backgroundColor: focus.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.22)'],
          }),
        },
      ]}
    >
      <Ionicons name="search" size={18} color="rgba(255,255,255,0.85)" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.65)"
        autoCapitalize="none"
        returnKeyType="search"
        selectionColor={BRAND.gold}
        onFocus={() => animate(1)}
        onBlur={() => animate(0)}
        style={styles.searchInput}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button">
          <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.85)" />
        </Pressable>
      )}
    </Animated.View>
  );
}

function HeaderButton({
  icon,
  label,
  onPress,
  solid,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  solid?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      speed: 40,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
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
            ? { backgroundColor: BRAND.gold }
            : {
                backgroundColor: 'rgba(255,255,255,0.16)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.3)',
              },
        ]}
      >
        <Ionicons name={icon} size={18} color={solid ? BRAND.deep : '#FFFFFF'} />
        <Text
          numberOfLines={1}
          style={{
            color: solid ? BRAND.deep : '#FFFFFF',
            fontWeight: '800',
            fontSize: 13,
            flexShrink: 1,
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function YearChip({
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
    Animated.spring(scale, {
      toValue: v,
      speed: 40,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
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
            ? { backgroundColor: BRAND.gold, borderColor: BRAND.gold }
            : {
                backgroundColor: 'rgba(255,255,255,0.14)',
                borderColor: 'rgba(255,255,255,0.3)',
              },
        ]}
      >
        <Text
          style={{
            color: active ? BRAND.deep : '#FFFFFF',
            fontSize: 13,
            fontWeight: '800',
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function MemoryCard({
  item,
  index,
  onPress,
}: {
  item: MemorySummary;
  index: number;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const thumb = item.media.find((m) => m.type === 'PHOTO')?.storageUrl;
  const photoCount = item.media.filter((m) => m.type === 'PHOTO').length;
  const hasAudio = item.media.some((m) => m.type === 'AUDIO');
  const ytCount = item.media.filter((m) => m.type === 'YOUTUBE').length;
  const iso = new Date(item.date).toISOString().slice(0, 10);
  const palette = PLACEHOLDERS[index % PLACEHOLDERS.length];

  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 450,
      delay: Math.min(index, 6) * 70,
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
        marginHorizontal: spacing.lg,
        marginBottom: spacing.lg,
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
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
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={{ height: 210 }}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={palette}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
            >
              <Ionicons name="musical-notes" size={70} color="rgba(255,255,255,0.3)" />
            </LinearGradient>
          )}

          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']}
            style={styles.imageFade}
          />

          <View style={styles.topRow}>
            <DatePill text={iso} onDark />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {photoCount > 1 && (
                <View style={styles.badge}>
                  <Ionicons name="images" size={12} color="#FFFFFF" />
                  <Text style={styles.badgeText}>{photoCount}</Text>
                </View>
              )}
              {hasAudio && (
                <View style={[styles.badge, { backgroundColor: withAlpha(BRAND.violet, 0.9) }]}>
                  <Ionicons name="musical-notes" size={12} color="#FFFFFF" />
                </View>
              )}
              {ytCount > 0 && (
                <View style={[styles.badge, { backgroundColor: 'rgba(255,0,0,0.88)' }]}>
                  <Ionicons name="logo-youtube" size={12} color="#FFFFFF" />
                </View>
              )}
            </View>
          </View>

          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
        </View>

        {item.description ? (
          <View
            style={{
              padding: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <Text
              style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
            <Ionicons name="arrow-forward-circle" size={24} color={BRAND.magenta} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', width: 190, height: 190, borderRadius: 95 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 10 },
  headerButton: {
    minHeight: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  card: { borderRadius: 24, overflow: 'hidden', borderWidth: 1 },
  imageFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 },
  topRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  cardTitle: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
});