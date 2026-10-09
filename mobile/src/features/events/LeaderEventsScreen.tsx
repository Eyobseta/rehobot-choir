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
import { leaderListEvents, LeaderEventRow } from '../../services/events';
import { ApiError } from '../../services/api';

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
          style={{
            backgroundColor: colors.primary,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            alignItems: 'center',
          }}
        >
          <Text style={[typography.button, { color: colors.primaryText }]}>
            {t('events.createEvent')}
          </Text>
        </Pressable>
        {error && (
          <Text style={[typography.bodySmall, { color: colors.error, marginTop: spacing.sm }]}>
            {error}
          </Text>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
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
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {t('events.emptyUpcoming')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('EventEditor', { id: item.id })}
            style={{
              padding: spacing.md,
              marginBottom: spacing.md,
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
              {item.title}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              {new Date(item.date).toLocaleString()}
            </Text>
            <Text
              style={[
                typography.caption,
                {
                  color: item.status === 'PUBLISHED' ? colors.success : colors.warning,
                  marginTop: spacing.xs,
                },
              ]}
            >
              {item.status === 'PUBLISHED'
                ? t('events.statusPublished')
                : t('events.statusDraft')}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}