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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import {
  listSongs,
  listCategories,
  SongSummary,
  SongCategory,
  zemaIsTeamMember,
} from '../../services/songs';
import { ApiError } from '../../services/api';

export default function SongsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

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
      const list = await listSongs(q);
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
          setCategories(await listCategories());
        } catch {
          // ignore
        }
        try {
          const ok = await zemaIsTeamMember();
          setIsZema(ok);
        } catch {
          setIsZema(false);
        }
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
      <View style={{ padding: spacing.lg }}>
        {/* Top row: search + Favorites + Offline + (My Submissions if Zema) */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('songs.searchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              color: colors.text,
            }}
          />

          <Pressable
            onPress={() => navigation.navigate('Favorites')}
            style={{
              paddingHorizontal: spacing.md,
              justifyContent: 'center',
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.primary,
              alignItems: 'center',
            }}
          >
            <Text style={[typography.caption, { color: colors.primary }]}>
              {t('songs.favorites')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Offline')}
            style={{
              paddingHorizontal: spacing.md,
              justifyContent: 'center',
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.primary,
              alignItems: 'center',
            }}
          >
            <Text style={[typography.caption, { color: colors.primary }]}>
              {t('songs.offline')}
            </Text>
          </Pressable>

          {isZema && (
            <Pressable
              onPress={() => navigation.navigate('ZemaSubmissions')}
              style={{
                paddingHorizontal: spacing.md,
                justifyContent: 'center',
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.primary,
                alignItems: 'center',
              }}
            >
              <Text style={[typography.caption, { color: colors.primary }]}>
                {t('zema.team')}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Category chips */}
        {categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: spacing.md }}
          >
            <Pressable
              onPress={() => setCategoryId(null)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor:
                  categoryId === null ? colors.primary : colors.border,
                backgroundColor:
                  categoryId === null ? colors.primary : colors.surface,
                marginRight: spacing.sm,
              }}
            >
              <Text
                style={[
                  typography.caption,
                  {
                    color:
                      categoryId === null ? colors.primaryText : colors.text,
                  },
                ]}
              >
                {t('songs.allCategories')}
              </Text>
            </Pressable>
            {categories.map((c) => {
              const active = categoryId === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(active ? null : c.id)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.surface,
                    marginRight: spacing.sm,
                  }}
                >
                  <Text
                    style={[
                      typography.caption,
                      { color: active ? colors.primaryText : colors.text },
                    ]}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {error && (
          <Text
            style={[
              typography.bodySmall,
              { color: colors.error, marginTop: spacing.sm },
            ]}
          >
            {error}
          </Text>
        )}
      </View>

      {loading ? (
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xl,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(search);
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>
                {t('songs.empty')}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate('SongDetail', { id: item.id })
              }
              style={{
                padding: spacing.md,
                marginBottom: spacing.sm,
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text
                  style={[
                    typography.body,
                    { color: colors.text, fontWeight: '600' },
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                {item.category && (
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textSecondary, marginTop: 2 },
                    ]}
                    numberOfLines={1}
                  >
                    {item.category.name}
                  </Text>
                )}
              </View>

              {item.youtubeUrl ? (
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#FF0000',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="logo-youtube" size={22} color="#FFFFFF" />
                </View>
              ) : (
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    borderWidth: 1.5,
                    borderColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name="musical-notes"
                    size={18}
                    color={colors.primary}
                  />
                </View>
              )}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}