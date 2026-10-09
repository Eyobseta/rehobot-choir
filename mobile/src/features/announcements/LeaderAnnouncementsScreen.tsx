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
import {
  leaderListAnnouncements,
  LeaderAnnouncementRow,
} from '../../services/announcements';
import { ApiError } from '../../services/api';

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
          style={{
            backgroundColor: colors.primary,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            alignItems: 'center',
          }}
        >
          <Text style={[typography.button, { color: colors.primaryText }]}>
            {t('announcements.create')}
          </Text>
        </Pressable>
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
              {t('announcements.empty')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              navigation.navigate('AnnouncementEditor', { id: item.id })
            }
            style={{
              padding: spacing.md,
              marginBottom: spacing.md,
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
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginTop: 2 },
              ]}
            >
              {new Date(item.publishAt).toLocaleString()}
            </Text>
            <Text
              style={[
                typography.caption,
                {
                  color:
                    item.status === 'PUBLISHED'
                      ? colors.success
                      : item.status === 'SCHEDULED'
                      ? colors.warning
                      : colors.textSecondary,
                  marginTop: spacing.xs,
                },
              ]}
            >
              {item.status === 'PUBLISHED'
                ? t('announcements.statusPublished')
                : item.status === 'SCHEDULED'
                ? t('announcements.statusScheduled')
                : t('announcements.statusDraft')}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}