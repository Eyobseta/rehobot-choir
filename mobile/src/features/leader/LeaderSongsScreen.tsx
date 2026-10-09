import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { leaderListSongs, LeaderSongRow } from '../../services/songs';
import { ApiError } from '../../services/api';

export default function LeaderSongsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [items, setItems] = useState<LeaderSongRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await leaderListSongs());
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

  const statusColor = (s: LeaderSongRow['status']) => {
    switch (s) {
      case 'PUBLISHED':
        return colors.success;
      case 'RETURNED':
        return colors.warning;
      case 'PENDING_REVIEW':
        return colors.primary;
      case 'UNPUBLISHED':
        return colors.textSecondary;
      default:
        return colors.textSecondary;
    }
  };

  const statusLabel = (s: LeaderSongRow['status']) => {
    switch (s) {
      case 'PUBLISHED':
        return t('leaderSongs.statusPublished');
      case 'PENDING_REVIEW':
        return t('leaderSongs.statusPending');
      case 'RETURNED':
        return t('leaderSongs.statusReturned');
      case 'UNPUBLISHED':
        return t('leaderSongs.statusUnpublished');
      case 'DRAFT':
      default:
        return t('leaderSongs.statusDraft');
    }
  };

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
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            onPress={() =>
              navigation.navigate('SongEditor', { id: null })
            }
            style={{
              flex: 1,
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              alignItems: 'center',
            }}
          >
            <Text style={[typography.button, { color: colors.primaryText }]}>
              {t('leaderSongs.newSong')}
            </Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            onPress={() => navigation.navigate('SongCategories')}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: radius.md,
              paddingVertical: spacing.sm,
              alignItems: 'center',
            }}
          >
            <Text style={[typography.bodySmall, { color: colors.primary }]}>
              {t('leaderSongs.categories')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('ZemaTeam')}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: radius.md,
              paddingVertical: spacing.sm,
              alignItems: 'center',
            }}
          >
            <Text style={[typography.bodySmall, { color: colors.primary }]}>
              {t('leaderSongs.zemaTeam')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('SongReview')}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: radius.md,
              paddingVertical: spacing.sm,
              alignItems: 'center',
            }}
          >
            <Text style={[typography.bodySmall, { color: colors.primary }]}>
              {t('leaderSongs.review')}
            </Text>
          </Pressable>
        </View>

        {error && (
          <Text
            style={[typography.bodySmall, { color: colors.error }]}
          >
            {error}
          </Text>
        )}
      </View>

      <FlatList
        data={items}
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
              void load();
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {t('leaderSongs.empty')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('SongEditor', { id: item.id })}
            style={{
              padding: spacing.md,
              marginBottom: spacing.sm,
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
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
              >
                {item.category.name}
              </Text>
            )}
            <Text
              style={[
                typography.caption,
                { color: statusColor(item.status), marginTop: spacing.xs },
              ]}
            >
              {statusLabel(item.status)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}