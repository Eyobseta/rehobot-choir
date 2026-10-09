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
import {
  getMyAttendance,
  getMyGrid,
  AttendanceHistoryItem,
  MyGridSummary,
  gatheringLabelKey,
} from '../../services/attendance';
import { ApiError } from '../../services/api';
import AttendanceGrid, { GridCell } from './AttendanceGrid';

export default function MyAttendanceScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [items, setItems] = useState<AttendanceHistoryItem[]>([]);
  const [grid, setGrid] = useState<MyGridSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const [hist, g] = await Promise.all([
        getMyAttendance(),
        getMyGrid(from, to),
      ]);
      setItems(hist);
      setGrid(g);
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

  const cells: GridCell[] = (grid?.days ?? []).map((d) => ({
    date: d.date,
    state: d.status === 'PRESENT' ? 'PRESENT' : 'ABSENT',
  }));

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
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg }}>
            {error && (
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.error, marginBottom: spacing.sm },
                ]}
              >
                {error}
              </Text>
            )}
            <AttendanceGrid cells={cells} />
          </View>
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {t('attendance.empty')}
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
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, { color: colors.text }]}>
                {new Date(item.date).toISOString().slice(0, 10)}
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: colors.textSecondary, marginTop: 2 },
                ]}
              >
                {t(gatheringLabelKey(item.gathering))}
              </Text>
            </View>
            <Text
              style={[
                typography.body,
                {
                  color: item.status === 'PRESENT' ? colors.success : colors.error,
                  fontWeight: '600',
                },
              ]}
            >
              {item.status === 'PRESENT'
                ? t('attendance.present')
                : t('attendance.absent')}
            </Text>
          </View>
        )}
      />
    </View>
  );
}