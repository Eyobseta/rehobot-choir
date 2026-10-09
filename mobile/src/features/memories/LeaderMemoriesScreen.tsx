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
  leaderListPendingMemories,
  PendingMemory,
} from '../../services/memories';
import { ApiError } from '../../services/api';

export default function LeaderMemoriesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [items, setItems] = useState<PendingMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await leaderListPendingMemories());
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
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
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
        ListHeaderComponent={
          error ? (
            <Text
              style={[
                typography.bodySmall,
                { color: colors.error, marginBottom: spacing.sm },
              ]}
            >
              {error}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {t('memories.emptyReview')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              navigation.navigate('MemoryReviewDetail', { id: item.id })
            }
            style={{
              padding: spacing.md,
              marginBottom: spacing.sm,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
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
              {new Date(item.date).toISOString().slice(0, 10)}
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginTop: spacing.xs },
              ]}
            >
              {item.submittedBy.memberProfile?.fullName ?? ''}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}