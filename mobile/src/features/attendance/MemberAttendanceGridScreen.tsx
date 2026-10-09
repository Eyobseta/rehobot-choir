import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { leaderGetMemberGrid, MyGridSummary } from '../../services/attendance';
import { ApiError } from '../../services/api';
import AttendanceGrid, { GridCell } from './AttendanceGrid';

export default function MemberAttendanceGridScreen({ route }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const { memberId, memberName } = route.params;

  const [summary, setSummary] = useState<MyGridSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      setSummary(await leaderGetMemberGrid(memberId, from, to));
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  const cells: GridCell[] = (summary?.days ?? []).map((d) => ({
    date: d.date,
    state: d.status === 'PRESENT' ? 'PRESENT' : 'ABSENT',
  }));

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      <Text style={[typography.h3, { color: colors.text }]}>{memberName}</Text>

      {loading ? (
        <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          {error && (
            <Text
              style={[
                typography.bodySmall,
                { color: colors.error, marginTop: spacing.md },
              ]}
            >
              {error}
            </Text>
          )}
          <View style={{ marginTop: spacing.lg }}>
            <AttendanceGrid cells={cells} />
          </View>
        </>
      )}
    </ScrollView>
  );
}