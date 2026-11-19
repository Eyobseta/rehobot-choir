import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import {
  AttendanceHistoryItem,
  gatheringLabelKey,
} from '../../services/attendance';
import AttendanceGrid, { GridCell } from './AttendanceGrid';
import { ErrorBanner, BRAND, withAlpha } from '../auth/Auth_UI';
import {
  ethTodayFromInstant,
  addEthDays,
  formatEthDate,
} from '../../utils/ethiopianCalendar';
import { useMyAttendanceQuery, useMyAttendanceGridQuery } from './useAttendance';
import {
  Card,
  EmptyState,
  IconName,
  SavedPill,
  ScreenHero,
  SectionTitle,
  SkeletonRows,
  StatusChip,
} from './Attendance_Kit';

export default function MyAttendanceScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const today = ethTodayFromInstant(new Date());

  const histQ = useMyAttendanceQuery();
  const gridQ = useMyAttendanceGridQuery(addEthDays(today, -120), today);

  const items = histQ.data ?? [];
  const grid = gridQ.data ?? null;
  const firstLoad = histQ.isPending && histQ.data === undefined;
  const showingSavedData =
    (histQ.isError && histQ.data !== undefined) ||
    (gridQ.isError && gridQ.data !== undefined);
  const error =
    (histQ.error as { message?: string } | null)?.message ??
    (gridQ.error as { message?: string } | null)?.message ??
    null;

  const load = async () => {
    await Promise.all([histQ.refetch(), gridQ.refetch()]);
  };

  const cells: GridCell[] = (grid?.days ?? []).map((d) => ({
    date: d.isoDate,
    state: d.status === 'PRESENT' ? 'PRESENT' : 'ABSENT',
  }));

  const total = cells.length;
  const present = cells.filter((c) => c.state === 'PRESENT').length;
  const absent = total - present;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  const sorted = [...cells].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
  let currentStreak = 0;
  for (let i = sorted.length - 1; i >= 0 && sorted[i].state === 'PRESENT'; i--) currentStreak++;
  let bestStreak = 0;
  let run = 0;
  for (const c of sorted) {
    if (c.state === 'PRESENT') {
      run++;
      bestStreak = Math.max(bestStreak, run);
    } else {
      run = 0;
    }
  }

  const groups: {
    key: string;
    sample: AttendanceHistoryItem['gathering'];
    present: number;
    total: number;
  }[] = [];
  for (const it of items) {
    const key = String(it.gathering);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, sample: it.gathering, present: 0, total: 0 };
      groups.push(g);
    }
    g.total++;
    if (it.status === 'PRESENT') g.present++;
  }

  // One tint per gathering row, theme-aware (readable in light and dark).
  const gatherTints = [colors.accent, colors.success, colors.warning];

  const message =
    rate >= 90
      ? t('attendance.msgOutstanding', {
          defaultValue: 'Outstanding! Your choir family is lucky to have you.',
        })
      : rate >= 75
      ? t('attendance.msgGreat', { defaultValue: 'Great consistency. Keep it up!' })
      : rate >= 50
      ? t('attendance.msgGood', { defaultValue: 'Good progress. Every rehearsal counts!' })
      : t('attendance.msgMissYou', { defaultValue: 'We miss you! Come sing with us.' });

  const enter = useRef(new Animated.Value(0)).current;
  const rateAnim = useRef(new Animated.Value(0)).current;
  const [shownRate, setShownRate] = useState(0);

  useEffect(() => {
    const id = rateAnim.addListener(({ value }) => setShownRate(Math.round(value)));
    return () => rateAnim.removeListener(id);
  }, [rateAnim]);

  useEffect(() => {
    if (firstLoad) return;
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    rateAnim.setValue(0);
    Animated.timing(rateAnim, {
      toValue: rate,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [firstLoad, rate, enter, rateAnim]);

  const fadeUp = (i: number) => ({
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [24 + i * 10, 0],
        }),
      },
    ],
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHero
        icon="calendar"
        title={t('attendance.history')}
        subtitle={t('attendance.last120', { defaultValue: 'Last 120 days' })}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back', { defaultValue: 'Back' })}
      />

      {showingSavedData && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <SavedPill text={t('home.showingSavedData', { defaultValue: 'Showing saved data' })} />
        </View>
      )}

      {firstLoad ? (
        <View style={{ padding: spacing.lg }}>
          <SkeletonRows count={1} height={170} />
          <SkeletonRows count={2} height={84} />
          <SkeletonRows count={3} height={72} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl * 2 }}
          refreshControl={
            <RefreshControl
              refreshing={histQ.isRefetching && !firstLoad}
              onRefresh={load}
              tintColor={colors.primary}
              colors={[BRAND.teal]}
            />
          }
          ListHeaderComponent={
            <View>
              {error && <ErrorBanner message={error} />}

              {/* ---------- Rate ---------- */}
              <Animated.View style={fadeUp(0)}>
                <Card style={{ padding: 18 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <Text
                      style={{ fontSize: 56, lineHeight: 62, fontWeight: '800', color: colors.text }}
                    >
                      {shownRate}
                    </Text>
                    <Text
                      style={{
                        fontSize: 24,
                        lineHeight: 40,
                        fontWeight: '800',
                        marginLeft: 2,
                        color: colors.accent,
                      }}
                    >
                      %
                    </Text>
                    <Text
                      style={[
                        typography.bodySmall,
                        {
                          color: colors.textSecondary,
                          fontWeight: '700',
                          marginLeft: 12,
                          marginBottom: 12,
                          flexShrink: 1,
                        },
                      ]}
                    >
                      {t('attendance.rateLabel', { defaultValue: 'Attendance rate' })}
                    </Text>
                  </View>

                  <View
                    style={{
                      height: 10,
                      borderRadius: 5,
                      marginTop: 8,
                      overflow: 'hidden',
                      backgroundColor: colors.border,
                    }}
                  >
                    <Animated.View
                      style={{
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: colors.primary,
                        width: rateAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                          extrapolate: 'clamp',
                        }),
                      }}
                    />
                  </View>

                  <Text
                    style={[
                      typography.bodySmall,
                      { color: colors.text, fontWeight: '600', marginTop: 14 },
                    ]}
                  >
                    {t('attendance.attendedOf', {
                      present,
                      total,
                      defaultValue: 'You attended {{present}} of {{total}} gatherings',
                    })}
                  </Text>
                  {total > 0 && (
                    <Text
                      style={[
                        typography.bodySmall,
                        { color: colors.textSecondary, marginTop: 4, lineHeight: 20 },
                      ]}
                    >
                      {message}
                    </Text>
                  )}
                </Card>
              </Animated.View>

              {/* ---------- Stat tiles ---------- */}
              <Animated.View
                style={[
                  {
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    marginTop: 12,
                    rowGap: 12,
                  },
                  fadeUp(1),
                ]}
              >
                <StatTile
                  icon="checkmark-circle"
                  tint={colors.success}
                  value={present}
                  label={t('attendance.present')}
                />
                <StatTile
                  icon="close-circle"
                  tint={colors.error}
                  value={absent}
                  label={t('attendance.absent')}
                />
                <StatTile
                  icon="flame"
                  tint={colors.warning}
                  value={currentStreak}
                  label={t('attendance.streak', { defaultValue: 'Current streak' })}
                  highlight={currentStreak >= 3}
                />
                <StatTile
                  icon="trophy"
                  tint={colors.accent}
                  value={bestStreak}
                  label={t('attendance.bestStreak', { defaultValue: 'Best streak' })}
                />
              </Animated.View>

              {/* ---------- Grid ---------- */}
              <Animated.View style={fadeUp(2)}>
                <SectionTitle
                  title={t('attendance.last120', { defaultValue: 'Last 120 days' })}
                />
                <Card>
                  <AttendanceGrid cells={cells} />
                </Card>
              </Animated.View>

              {/* ---------- By gathering ---------- */}
              {groups.length > 0 && (
                <Animated.View style={fadeUp(3)}>
                  <SectionTitle
                    title={t('attendance.byGathering', { defaultValue: 'By gathering' })}
                  />
                  <Card>
                    {groups.map((g, i) => (
                      <GatheringBar
                        key={g.key}
                        label={t(gatheringLabelKey(g.sample))}
                        present={g.present}
                        total={g.total}
                        tint={gatherTints[i % gatherTints.length]}
                        last={i === groups.length - 1}
                      />
                    ))}
                  </Card>
                </Animated.View>
              )}

              {items.length > 0 && (
                <Animated.View style={fadeUp(4)}>
                  <SectionTitle
                    title={t('attendance.recordsTitle', { defaultValue: 'All records' })}
                    count={items.length}
                  />
                </Animated.View>
              )}
            </View>
          }
          ListEmptyComponent={
            <EmptyState icon="calendar-outline" text={t('attendance.empty')} />
          }
          renderItem={({ item, index }) => {
            const iso = item.dateGregorian.slice(0, 10);
            const ethLabel = formatEthDate(
              { year: item.dateEthYear, month: item.dateEthMonth, day: item.dateEthDay },
              lang,
            );
            const prevIso = index > 0 ? items[index - 1].dateGregorian.slice(0, 10) : null;
            const month = iso.slice(0, 7);
            const showMonth = prevIso === null || prevIso.slice(0, 7) !== month;
            return (
              <HistoryCard
                item={item}
                index={index}
                iso={iso}
                ethLabel={ethLabel}
                monthLabel={showMonth ? month : null}
                label={t(gatheringLabelKey(item.gathering))}
                presentLabel={t('attendance.present')}
                absentLabel={t('attendance.absent')}
                lang={lang}
              />
            );
          }}
        />
      )}
    </View>
  );
}

// ---------- Sub-components ----------

function StatTile({
  icon,
  tint,
  value,
  label,
  highlight,
}: {
  icon: IconName;
  tint: string;
  value: number;
  label: string;
  highlight?: boolean;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        width: '48.5%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 18,
        borderWidth: highlight ? 1.5 : 1,
        borderColor: highlight ? withAlpha(tint, 0.7) : colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha(tint, 0.18),
        }}
      >
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 24, lineHeight: 28, fontWeight: '800' }}>
          {value}
        </Text>
        <Text
          style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700' }}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

function GatheringBar({
  label,
  present,
  total,
  tint,
  last,
}: {
  label: string;
  present: number;
  total: number;
  tint: string;
  last?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const pct = total > 0 ? present / total : 0;
  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(fill, {
      toValue: pct,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [pct, fill]);

  return (
    <View style={{ marginBottom: last ? 0 : 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tint }} />
        <Text
          style={[typography.body, { color: colors.text, fontWeight: '700', flex: 1 }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary, fontWeight: '700' }]}>
          {present}/{total}
        </Text>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: colors.border,
        }}
      >
        <Animated.View
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: tint,
            width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }}
        />
      </View>
    </View>
  );
}

function HistoryCard({
  item,
  index,
  iso,
  ethLabel,
  monthLabel,
  label,
  presentLabel,
  absentLabel,
  lang,
}: {
  item: AttendanceHistoryItem;
  index: number;
  iso: string;
  ethLabel: string;
  monthLabel: string | null;
  label: string;
  presentLabel: string;
  absentLabel: string;
  lang: 'en' | 'am';
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const isPresent = item.status === 'PRESENT';
  const tone = isPresent ? colors.success : colors.error;

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [enter, index]);

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
        ],
      }}
    >
      {monthLabel && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, marginBottom: 10 }}>
          <Text
            style={[typography.caption, { color: colors.textSecondary, fontWeight: '800', letterSpacing: 0.5 }]}
          >
            {monthLabel}
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          paddingLeft: 16,
          marginBottom: 10,
          borderRadius: 20,
          borderWidth: 1,
          overflow: 'hidden',
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }}
      >
        <View
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: tone }}
        />
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: withAlpha(tone, 0.16),
          }}
        >
          <Text style={{ color: tone, fontSize: 22, lineHeight: 26, fontWeight: '800' }}>
            {item.dateEthDay}
          </Text>
          <Text style={{ color: tone, fontSize: 10, fontWeight: '700', opacity: 0.85 }}>
            {formatEthDate(
              { year: item.dateEthYear, month: item.dateEthMonth, day: item.dateEthDay },
              lang,
            )
              .split(' ')[0]
              .slice(0, 3)}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 14, marginRight: 8 }}>
          <Text style={[typography.body, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
            {label}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
            numberOfLines={1}
          >
            {ethLabel} · {iso}
          </Text>
        </View>
        <StatusChip present={isPresent} label={isPresent ? presentLabel : absentLabel} />
      </View>
    </Animated.View>
  );
}