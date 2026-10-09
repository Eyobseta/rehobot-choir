import React, { useCallback, useState } from 'react';
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
} from 'react-native';
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

export default function MemoriesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

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
      <View style={{ padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('memories.searchPlaceholder')}
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
            onPress={() => navigation.navigate('SubmitMemory')}
            style={{
              paddingHorizontal: spacing.md,
              justifyContent: 'center',
              borderRadius: radius.md,
              backgroundColor: colors.primary,
              alignItems: 'center',
            }}
          >
            <Text style={[typography.caption, { color: colors.primaryText }]}>
              {t('memories.submit')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('MyMemories')}
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
              {t('memories.mine')}
            </Text>
          </Pressable>
        </View>

        {years.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: spacing.md }}
          >
            <Pressable
              onPress={() => setYear(null)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: year === null ? colors.primary : colors.border,
                backgroundColor: year === null ? colors.primary : colors.surface,
                marginRight: spacing.sm,
              }}
            >
              <Text
                style={[
                  typography.caption,
                  { color: year === null ? colors.primaryText : colors.text },
                ]}
              >
                {t('memories.allYears')}
              </Text>
            </Pressable>
            {years.map((y) => {
              const active = year === y.year;
              return (
                <Pressable
                  key={y.year}
                  onPress={() => setYear(active ? null : y.year)}
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
                    {y.year} ({y.count})
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
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
                {t('memories.empty')}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const thumb = item.media.find((m) => m.type === 'PHOTO')?.storageUrl;
            return (
              <Pressable
                onPress={() =>
                  navigation.navigate('MemoryDetail', { id: item.id })
                }
                style={{
                  marginBottom: spacing.md,
                  borderRadius: radius.md,
                  overflow: 'hidden',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                {thumb ? (
                  <Image
                    source={{ uri: thumb }}
                    style={{ width: '100%', height: 160 }}
                  />
                ) : null}
                <View style={{ padding: spacing.md }}>
                  <Text
                    style={[
                      typography.body,
                      { color: colors.text, fontWeight: '600' },
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textSecondary, marginTop: 2 },
                    ]}
                  >
                    {new Date(item.date).toISOString().slice(0, 10)}
                  </Text>
                  {item.description && (
                    <Text
                      style={[
                        typography.bodySmall,
                        { color: colors.textSecondary, marginTop: spacing.xs },
                      ]}
                      numberOfLines={2}
                    >
                      {item.description}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}