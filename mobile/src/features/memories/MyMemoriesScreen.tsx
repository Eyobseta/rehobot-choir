import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { listMyMemories, MyMemoryRow } from '../../services/memories';
import { ApiError } from '../../services/api';

export default function MyMemoriesScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [items, setItems] = useState<MyMemoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await listMyMemories());
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

  const statusColor = (s: MyMemoryRow['status']) => {
    switch (s) {
      case 'PUBLISHED':
        return colors.success;
      case 'PENDING_REVIEW':
        return colors.primary;
      case 'REJECTED':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const statusLabel = (s: MyMemoryRow['status']) => {
    switch (s) {
      case 'PUBLISHED':
        return t('memories.statusPublished');
      case 'PENDING_REVIEW':
        return t('memories.statusPending');
      case 'REJECTED':
        return t('memories.statusRejected');
      default:
        return s;
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
      {error && (
        <Text
          style={[
            typography.bodySmall,
            { color: colors.error, padding: spacing.lg },
          ]}
        >
          {error}
        </Text>
      )}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: spacing.lg,
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
              {t('memories.emptyMine')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
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
                { color: statusColor(item.status), marginTop: spacing.xs },
              ]}
            >
              {statusLabel(item.status)}
            </Text>
            {item.status === 'REJECTED' && item.rejectionReason && (
              <View
                style={{
                  marginTop: spacing.sm,
                  padding: spacing.sm,
                  borderRadius: radius.sm,
                  backgroundColor: colors.surfaceAlt,
                }}
              >
                <Text
                  style={[typography.caption, { color: colors.textSecondary }]}
                >
                  {t('memories.rejectionReason')}
                </Text>
                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.text, marginTop: 2 },
                  ]}
                >
                  {item.rejectionReason}
                </Text>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}