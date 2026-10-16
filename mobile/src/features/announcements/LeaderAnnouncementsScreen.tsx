import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
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
  leaderListAnnouncements,
  LeaderAnnouncementRow,
} from '../../services/announcements';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha } from '../auth/Auth_UI';

const AMBER = '#F59E0B';

export default function LeaderAnnouncementsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [items, setItems] = useState<LeaderAnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await leaderListAnnouncements());
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
      void load();
    }, [load]),
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg }}>
        <Pressable
          onPress={() =>
            navigation.navigate('AnnouncementEditor', { id: null })
          }
          style={({ pressed }) => ({
            borderRadius: 24,
            overflow: 'hidden',
            transform: [{ scale: pressed ? 0.98 : 1 }],
            shadowColor: AMBER,
            shadowOpacity: 0.4,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          })}
        >
          <LinearGradient
            colors={[AMBER, BRAND.magenta, BRAND.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingVertical: spacing.md + 2,
              paddingHorizontal: spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              overflow: 'hidden',
            }}
          >
            <Ionicons
              name="megaphone"
              size={90}
              color="rgba(255,255,255,0.14)"
              style={{ position: 'absolute', right: -8, bottom: -24 }}
            />
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 15,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={26} color={BRAND.magenta} />
            </View>
            <Text
              style={[typography.button, { color: '#FFFFFF', fontWeight: '800', flex: 1 }]}
            >
              {t('announcements.create')}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>

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

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
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
        renderItem={({ item }) => {
          const tint =
            item.status === 'PUBLISHED'
              ? colors.success
              : item.status === 'SCHEDULED'
              ? colors.warning
              : colors.textSecondary;
          const statusIcon: keyof typeof Ionicons.glyphMap =
            item.status === 'PUBLISHED'
              ? 'checkmark-circle'
              : item.status === 'SCHEDULED'
              ? 'time'
              : 'document-text';
          return (
            <Pressable
              onPress={() =>
                navigation.navigate('AnnouncementEditor', { id: item.id })
              }
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.md,
                marginBottom: spacing.md,
                backgroundColor: colors.surface,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              {/* thumbnail */}
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={{ width: 62, height: 62, borderRadius: 18 }}
                />
              ) : (
                <LinearGradient
                  colors={[AMBER, BRAND.magenta]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="megaphone" size={26} color="#FFFFFF" />
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
                  style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
                  numberOfLines={1}
                >
                  {new Date(item.publishAt).toLocaleString()}
                </Text>
                <View
                  style={{
                    alignSelf: 'flex-start',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    marginTop: spacing.xs + 2,
                    paddingHorizontal: spacing.sm + 2,
                    paddingVertical: 3,
                    borderRadius: 10,
                    backgroundColor: withAlpha(tint, 0.14),
                  }}
                >
                  <Ionicons name={statusIcon} size={12} color={tint} />
                  <Text style={[typography.caption, { color: tint, fontWeight: '800' }]}>
                    {item.status === 'PUBLISHED'
                      ? t('announcements.statusPublished')
                      : item.status === 'SCHEDULED'
                      ? t('announcements.statusScheduled')
                      : t('announcements.statusDraft')}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: withAlpha(BRAND.violet, 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="create-outline" size={17} color={BRAND.violet} />
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}