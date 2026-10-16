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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import {
  listAnnouncements,
  AnnouncementSummary,
} from '../../services/announcements';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha } from '../auth/Auth_UI';

const AMBER = '#F59E0B';

export default function AnnouncementsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [search, setSearch] = useState('');
  const [focused, setFocused] = useState(false);
  const [items, setItems] = useState<AnnouncementSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setError(null);
    try {
      setItems(await listAnnouncements(q));
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
      void load(search);
    }, [search, load]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.md }}>
        {/* search pill */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: colors.surface,
            borderColor: focused ? AMBER : colors.border,
            borderWidth: 1.5,
            borderRadius: 22,
            paddingHorizontal: spacing.md,
          }}
        >
          <Ionicons
            name="search"
            size={18}
            color={focused ? AMBER : colors.textSecondary}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('announcements.searchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              flex: 1,
              paddingVertical: spacing.md,
              color: colors.text,
            }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {error && (
          <View
            style={{
              marginTop: spacing.sm,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.md,
              borderRadius: radius.md + 2,
              backgroundColor: withAlpha(colors.error, 0.1),
              borderWidth: 1,
              borderColor: withAlpha(colors.error, 0.35),
            }}
          >
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>
              {error}
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 26,
                  backgroundColor: withAlpha(AMBER, 0.14),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="megaphone-outline" size={34} color={AMBER} />
              </View>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
                {t('announcements.empty')}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate('AnnouncementDetail', { id: item.id })
              }
              style={({ pressed }) => ({
                marginBottom: spacing.md + 2,
                borderRadius: 26,
                overflow: 'hidden',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                shadowColor: BRAND.deep,
                shadowOpacity: 0.1,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 3,
              })}
            >
              {item.imageUrl && (
                <View style={{ height: 150 }}>
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={{ width: '100%', height: '100%' }}
                  />
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(10,6,30,0)', 'rgba(10,6,30,0.4)']}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  />
                </View>
              )}

              <View
                style={{
                  padding: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: spacing.md,
                }}
              >
                {!item.imageUrl && (
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 16,
                      backgroundColor: withAlpha(AMBER, 0.16),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="megaphone" size={20} color={AMBER} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={[typography.body, { color: colors.text, fontWeight: '800' }]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 3, lineHeight: 19 }]}
                    numberOfLines={2}
                  >
                    {item.message}
                  </Text>
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      marginTop: spacing.sm,
                      paddingHorizontal: spacing.sm + 2,
                      paddingVertical: 3,
                      borderRadius: 10,
                      backgroundColor: withAlpha(AMBER, 0.14),
                    }}
                  >
                    <Ionicons name="time-outline" size={12} color={AMBER} />
                    <Text style={[typography.caption, { color: AMBER, fontWeight: '800' }]}>
                      {new Date(item.publishAt).toLocaleString()}
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: withAlpha(AMBER, 0.14),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="chevron-forward" size={16} color={AMBER} />
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}