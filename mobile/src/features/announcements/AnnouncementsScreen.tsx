import React, { useCallback, useEffect, useState } from 'react';
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
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { AnnouncementSummary } from '../../services/announcements';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { useMe } from '../chat/chatSession';
import {
  useAnnouncementsQuery,
  warmAnnouncementDetailCache,
} from './useAnnouncements';

const AMBER = '#E8A65D';

export default function AnnouncementsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const userId = useMe()?.id ?? null;

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const q = useAnnouncementsQuery(debounced);
  const items = q.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  useEffect(() => {
    if (!items.length) return;
    void warmAnnouncementDetailCache(qc, userId, items.map((a) => a.id));
  }, [items, qc, userId]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: BRAND.teal, 
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
          paddingBottom: 22,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          overflow: 'hidden',
        }}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: insets.top - 22,
            right: -52,
            width: 150,
            height: 150,
            borderRadius: 75,
            backgroundColor: withAlpha(BRAND.lime, 0.14),
          }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="megaphone" size={22} color={BRAND.deep} />
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
              {t('tabs.home', { defaultValue: 'Home' })}
            </Text>
            <Text
              style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }}
              numberOfLines={1}
            >
              {t('announcements.title')}
            </Text>
          </View>

          <GlassBackButton
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
            size={44}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minHeight: 48,
            paddingHorizontal: 14,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: focused ? BRAND.gold : 'rgba(255,255,255,0.18)',
            backgroundColor: BRAND.tealDark,
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
            placeholder={t('announcements.searchPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.65)"
            autoCapitalize="none"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            selectionColor={BRAND.gold}
            style={{ flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 10 }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
          )}
        </View>
      </View>

      {showingSavedData && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: withAlpha(AMBER, 0.14),
              borderWidth: 1,
              borderColor: withAlpha(AMBER, 0.4),
            }}
          >
            <Ionicons name="cloud-offline" size={13} color={AMBER} />
            <Text style={[typography.caption, { color: AMBER, fontWeight: '800' }]}>
              {t('home.showingSavedData', { defaultValue: 'Showing saved data' })}
            </Text>
          </View>
        </View>
      )}

      {q.isError && q.data === undefined && (
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.md,
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
            {(q.error as { message?: string })?.message ?? 'Error'}
          </Text>
        </View>
      )}

      {firstLoad ? (
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
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <LinearGradient
                colors={[BRAND.lime, BRAND.mint, BRAND.lavender]}
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
                  <Ionicons name="megaphone-outline" size={40} color={colors.textSecondary} />
                </View>
              </LinearGradient>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
                {t('announcements.empty')}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('AnnouncementDetail', { id: item.id })}
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
                    colors={['rgba(14,38,44,0)', 'rgba(14,38,44,0.4)']}
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
                  <View style={{ backgroundColor: '#F7E1C8', 
                      width: 44,
                      height: 44,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name="megaphone" size={20} color={BRAND.teal} />
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
                    style={[
                      typography.bodySmall,
                      { color: colors.textSecondary, marginTop: 3, lineHeight: 19 },
                    ]}
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