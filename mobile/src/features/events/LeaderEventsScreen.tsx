import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { leaderListEvents, LeaderEventRow } from '../../services/events';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha } from '../auth/Auth_UI';

export default function LeaderEventsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [items, setItems] = useState<LeaderEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await leaderListEvents());
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg }}>
        <Pressable
          onPress={() => navigation.navigate('EventEditor', { id: null })}
          style={({ pressed }) => ({
            borderRadius: 24,
            overflow: 'hidden',
            transform: [{ scale: pressed ? 0.98 : 1 }],
            shadowColor: BRAND.violet,
            shadowOpacity: 0.35,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          })}
        >
          <LinearGradient
            colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
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
              name="calendar"
              size={90}
              color="rgba(255,255,255,0.12)"
              style={{ position: 'absolute', right: -10, bottom: -24 }}
            />
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 15,
                backgroundColor: BRAND.gold,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={26} color={BRAND.deep} />
            </View>
            <Text
              style={[typography.button, { color: '#FFFFFF', fontWeight: '800', flex: 1 }]}
            >
              {t('events.createEvent')}
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
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
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
                backgroundColor: withAlpha(BRAND.violet, 0.12),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="calendar-outline" size={34} color={BRAND.violet} />
            </View>
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
              {t('events.emptyUpcoming')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const published = item.status === 'PUBLISHED';
          const tint = published ? colors.success : colors.warning;
          const d = new Date(item.date);
          return (
            <Pressable
              onPress={() => navigation.navigate('EventEditor', { id: item.id })}
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
              {/* date block */}
              <LinearGradient
                colors={[BRAND.violet, BRAND.magenta]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 56,
                  height: 62,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', lineHeight: 24 }}>
                  {d.getDate()}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '800',
                    color: 'rgba(255,255,255,0.85)',
                    textTransform: 'uppercase',
                  }}
                >
                  {d.toLocaleString(undefined, { month: 'short' })}
                </Text>
              </LinearGradient>

              <View style={{ flex: 1 }}>
                <Text
                  style={[typography.body, { color: colors.text, fontWeight: '800' }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text
                  style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}
                  numberOfLines={1}
                >
                  {new Date(item.date).toLocaleString()}
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
                  <View
                    style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: tint }}
                  />
                  <Text style={[typography.caption, { color: tint, fontWeight: '800' }]}>
                    {published
                      ? t('events.statusPublished')
                      : t('events.statusDraft')}
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