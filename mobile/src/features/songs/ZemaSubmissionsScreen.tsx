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
  zemaListMySubmissions,
  MySubmission,
  SubmissionStatus,
} from '../../services/songs';
import { ApiError } from '../../services/api';

export default function ZemaSubmissionsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [items, setItems] = useState<MySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await zemaListMySubmissions());
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

  const statusColor = (s: SubmissionStatus) => {
    switch (s) {
      case 'APPROVED':
        return colors.success;
      case 'PENDING_REVIEW':
        return colors.primary;
      case 'RETURNED':
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  };

  const statusLabel = (s: SubmissionStatus) => {
    switch (s) {
      case 'APPROVED':
        return t('zema.statusApproved');
      case 'PENDING_REVIEW':
        return t('zema.statusPending');
      case 'RETURNED':
        return t('zema.statusReturned');
      case 'DRAFT':
      default:
        return t('zema.statusDraft');
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
      <View style={{ padding: spacing.lg }}>
        <Pressable
          onPress={() => navigation.navigate('ZemaEditor', { id: null })}
          style={{
            backgroundColor: colors.primary,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            alignItems: 'center',
          }}
        >
          <Text style={[typography.button, { color: colors.primaryText }]}>
            {t('zema.newSubmission')}
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
              {t('zema.empty')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              navigation.navigate('ZemaEditor', { id: item.id })
            }
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
              {item.song.title}
            </Text>
            {item.song.category && (
              <Text
                style={[
                  typography.caption,
                  { color: colors.textSecondary, marginTop: 2 },
                ]}
              >
                {item.song.category.name}
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

            {item.status === 'RETURNED' && item.returnReason && (
              <View
                style={{
                  marginTop: spacing.sm,
                  padding: spacing.sm,
                  borderRadius: radius.sm,
                  backgroundColor: colors.surfaceAlt,
                }}
              >
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t('zema.returnReason')}
                </Text>
                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.text, marginTop: 2 },
                  ]}
                >
                  {item.returnReason}
                </Text>
              </View>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}