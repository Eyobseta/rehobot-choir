import React, { useCallback, useState, useRef } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, Alert, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { listCategories, SongCategory, leaderCreateCategory, leaderRenameCategory, leaderDeleteCategory } from '../../services/songs';
import { ApiError } from '../../services/api';
import { cachedFetch } from '../../services/cache';
import { CACHE_KEYS } from '../../services/cacheKeys';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';

const PALETTES: readonly [string, string][] = [
  [BRAND.violet, BRAND.magenta],
  [BRAND.water, BRAND.violet],
  [BRAND.magenta, '#F59E0B'],
  [BRAND.deep, BRAND.violet],
];

export default function SongCategoriesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<SongCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await cachedFetch(
        CACHE_KEYS.leaderCategories,
        () => listCategories(),
        (freshData) => setItems(freshData),
      );
      if (data) setItems(data);
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (items.length === 0) setLoading(true);
    void load();
  }, [load, items.length]));

  const onAdd = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await leaderCreateCategory(newName.trim());
      setNewName('');
      await load();
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const onRename = (c: SongCategory) => {
    Alert.prompt?.(t('leaderSongs.renameCategory'), undefined, async (text) => {
      if (!text || !text.trim()) return;
      setBusy(true);
      try {
        await leaderRenameCategory(c.id, text.trim());
        await load();
      } catch (e) {
        const err = e as ApiError;
        setError(`${err.message} [${err.code}]`);
      } finally { setBusy(false); }
    }, 'plain-text', c.name);
  };

  const onDelete = (c: SongCategory) => {
    Alert.alert(t('leaderSongs.deleteCategory'), c.name, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('leaderSongs.delete'), style: 'destructive', onPress: async () => {
        setBusy(true);
        try { await leaderDeleteCategory(c.id); await load(); }
        catch (e) { const err = e as ApiError; setError(`${err.message} [${err.code}]`); }
        finally { setBusy(false); }
      }},
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}
      >
        <View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: withAlpha(BRAND.gold, 0.22) }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: BRAND.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="albums" size={22} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
              {t('leaderSongs.title')}
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>
              {t('leaderSongs.categories')}
            </Text>
          </View>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: focused ? BRAND.gold : 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.16)' }}>
            <Ionicons name="pricetag" size={16} color={focused ? BRAND.gold : 'rgba(255,255,255,0.85)'} />
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder={t('leaderSongs.newCategoryPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.6)"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              selectionColor={BRAND.gold}
              style={{ flex: 1, color: '#FFFFFF', fontSize: 14, paddingVertical: 10 }}
            />
          </View>
          <Pressable onPress={onAdd} disabled={busy} accessibilityRole="button" style={{ borderRadius: 14, overflow: 'hidden', opacity: busy ? 0.6 : 1 }}>
            <LinearGradient colors={[BRAND.gold, '#FFA94D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ minHeight: 48, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: BRAND.deep, fontWeight: '800', fontSize: 14 }}>{t('leaderSongs.add')}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </LinearGradient>

      {error && (
        <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: 14, backgroundColor: withAlpha(colors.error, 0.1), borderWidth: 1, borderColor: withAlpha(colors.error, 0.35) }}>
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={BRAND.violet} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <LinearGradient colors={[BRAND.violet, BRAND.magenta, BRAND.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="pricetags-outline" size={40} color={colors.textSecondary} />
                </View>
              </LinearGradient>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>{t('leaderSongs.emptyCategories')}</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <CategoryCard
              item={item}
              index={index}
              palette={PALETTES[index % PALETTES.length]}
              onRename={() => onRename(item)}
              onDelete={() => onDelete(item)}
              renameLabel={t('leaderSongs.rename')}
              deleteLabel={t('leaderSongs.delete')}
            />
          )}
        />
      )}
    </View>
  );
}

function CategoryCard({ item, index, palette, onRename, onDelete, renameLabel, deleteLabel }: {
  item: SongCategory; index: number; palette: readonly [string, string];
  onRename: () => void; onDelete: () => void; renameLabel: string; deleteLabel: string;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const enter = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const a = Animated.timing(enter, { toValue: 1, duration: 400, delay: Math.min(index, 8) * 50, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [enter, index]);
  return (
    <Animated.View style={{ marginBottom: spacing.sm + 4, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, paddingLeft: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 }} />
        <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="pricetag" size={18} color="#FFFFFF" />
        </LinearGradient>
        <Text style={[typography.body, { color: colors.text, flex: 1, marginLeft: 14, fontWeight: '800' }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Pressable onPress={onRename} hitSlop={6} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: withAlpha(palette[0], 0.14), marginRight: 6 }}>
          <Text style={{ color: palette[0], fontWeight: '800', fontSize: 11 }}>{renameLabel}</Text>
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={6} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: withAlpha(colors.error, 0.14) }}>
          <Text style={{ color: colors.error, fontWeight: '800', fontSize: 11 }}>{deleteLabel}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}