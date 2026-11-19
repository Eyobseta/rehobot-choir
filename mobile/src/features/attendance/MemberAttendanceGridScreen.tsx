import React from 'react';
import { View, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import AttendanceGrid, { GridCell } from './AttendanceGrid';
import { ErrorBanner } from '../auth/Auth_UI';
import { ethTodayFromInstant, addEthDays } from '../../utils/ethiopianCalendar';
import { useMemberAttendanceGridQuery } from './useAttendance';
import {
  Card,
  EmptyState,
  HeroStat,
  ScreenHero,
  SkeletonRows,
} from './Attendance_Kit';

export default function MemberAttendanceGridScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const { memberId, memberName } = route.params;

  const today = ethTodayFromInstant(new Date());
  const q = useMemberAttendanceGridQuery(
    memberId,
    addEthDays(today, -120),
    today,
  );

  const summary = q.data ?? null;
  const firstLoad = q.isPending && q.data === undefined;
  const error = (q.error as { message?: string } | null)?.message ?? null;

  const cells: GridCell[] = (summary?.days ?? []).map((d) => ({
    date: d.isoDate,
    state: d.status === 'PRESENT' ? 'PRESENT' : 'ABSENT',
  }));

  const present = cells.filter((c) => c.state === 'PRESENT').length;
  const total = cells.length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <ScreenHero
          icon="person"
          overline={t('attendance.historyTitle', { defaultValue: 'Attendance history' })}
          title={memberName}
          onBack={() => navigation.goBack()}
          backLabel={t('common.back', { defaultValue: 'Back' })}
        >
          {!firstLoad && total > 0 && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <HeroStat label={t('attendance.present')} value={present} />
              <HeroStat
                label={t('attendance.rateLabel', { defaultValue: 'Rate' })}
                value={`${rate}%`}
                accent
              />
              <HeroStat label={t('attendance.absent')} value={total - present} />
            </View>
          )}
        </ScreenHero>

        {firstLoad ? (
          <View style={{ padding: spacing.lg }}>
            <SkeletonRows count={1} height={280} />
          </View>
        ) : (
          <View style={{ padding: spacing.lg }}>
            {error && <ErrorBanner message={error} />}

            {total > 0 && (
              <Card>
                <AttendanceGrid cells={cells} />
              </Card>
            )}

            {total === 0 && (
              <EmptyState icon="calendar-outline" text={t('attendance.empty')} />
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}