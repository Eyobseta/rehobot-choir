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
import { listRecentQuotes, DailyQuote } from '../../services/quotes';

export default function DailyQuoteHistoryScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [items, setItems] = useState<DailyQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listRecentQuotes(7));
    } catch {
      // ignore
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
      ListEmptyComponent={
        <View style={{ padding: spacing.xl, alignItems: 'center' }}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            {t('quote.empty')}
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
          <Text style={[typography.caption, { color: colors.primary }]}>
            {item.dateOnly.slice(0, 10)}
          </Text>
          <Text
            style={[
              typography.body,
              { color: colors.text, marginTop: spacing.xs, fontStyle: 'italic' },
            ]}
          >
            "{item.quoteText}"
          </Text>
          <Text
            style={[
              typography.caption,
              { color: colors.textSecondary, marginTop: spacing.xs },
            ]}
          >
            — {item.source}
          </Text>
        </View>
      )}
    />
  );
}