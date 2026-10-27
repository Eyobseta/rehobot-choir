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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import {
  listAnnouncements,
  AnnouncementSummary,
} from '../../services/announcements';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';

const AMBER = '#F59E0B';

export default function AnnouncementsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [focused, setFocused] = useState(false);
  const [items, setItems] = useState<AnnouncementSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input (300ms) so we don't hammer the API per keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

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

  useEffect(() => {
    void load(debounced);
  }, [debounced, load]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ---------- Hero ---------- */}
      <LinearGradient
        colors={['#F59E0B', BRAND.magenta, BRAND.violet]}
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
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -60,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: withAlpha('#FFFFFF', 0.18),
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

        {/* Search box */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minHeight: 48,
            paddingHorizontal: 14,
            borderRadius: 16,
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
      </LinearGradient>

      {error && (
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
            {error}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={BRAND.violet} />
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
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(search);
              }}
              tintColor={BRAND.violet}
              colors={[BRAND.violet]}
            />
          }
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <LinearGradient
                colors={[BRAND.violet, BRAND.magenta, BRAND.gold]}
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
              <Text
                style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}
              >
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
                  <LinearGradient
                    colors={[AMBER, BRAND.magenta]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="megaphone" size={20} color="#FFFFFF" />
                  </LinearGradient>
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