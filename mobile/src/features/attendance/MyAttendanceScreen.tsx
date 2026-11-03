import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import {
  AttendanceHistoryItem,
  gatheringLabelKey,
} from '../../services/attendance';
import AttendanceGrid, { GridCell } from './AttendanceGrid';
import { ErrorBanner, BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import {
  ethTodayFromInstant,
  addEthDays,
  formatEthDate,
} from '../../utils/ethiopianCalendar';
import { useDateLabel } from '../funding/fundingKit';
import { useMyAttendanceQuery, useMyAttendanceGridQuery } from './useAttendance';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const PALETTE = ['#B6A0FF', '#6EDBD5', '#EE9BBD', '#E6C779', '#B8E986'];

export default function MyAttendanceScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  const today = ethTodayFromInstant(new Date());
  const dateLabel = useDateLabel();

  // ------------------ data ------------------
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

  // ---- Derived stats ----
  const total = cells.length;
  const present = cells.filter((c) => c.state === 'PRESENT').length;
  const absent = total - present;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  const sorted = [...cells].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
  let currentStreak = 0;
  for (
    let i = sorted.length - 1;
    i >= 0 && sorted[i].state === 'PRESENT';
    i--
  )
    currentStreak++;
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

  const message =
    rate >= 90
      ? t('attendance.msgOutstanding', {
          defaultValue:
            'Outstanding! Your choir family is lucky to have you.',
        })
      : rate >= 75
      ? t('attendance.msgGreat', {
          defaultValue: 'Great consistency. Keep it up!',
        })
      : rate >= 50
      ? t('attendance.msgGood', {
          defaultValue: 'Good progress. Every rehearsal counts!',
        })
      : t('attendance.msgMissYou', {
          defaultValue: 'We miss you! Come sing with us.',
        });

  const enter = useRef(new Animated.Value(0)).current;
  const rateAnim = useRef(new Animated.Value(0)).current;
  const [shownRate, setShownRate] = useState(0);

  useEffect(() => {
    const id = rateAnim.addListener(({ value }) =>
      setShownRate(Math.round(value)),
    );
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
      {/* Hero */}
      <LinearGradient
        colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.screenHero, { paddingTop: insets.top + 16 }]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.blob,
            {
              top: -60,
              right: -40,
              backgroundColor: withAlpha(BRAND.gold, 0.22),
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.blob,
            {
              bottom: -70,
              left: -50,
              backgroundColor: withAlpha(BRAND.water, 0.22),
            },
          ]}
        />

        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Ionicons name="calendar" size={24} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={styles.heroTitle}>
              {t('attendance.history')}
            </Text>
            <Text style={styles.heroSubtitle}>
              {t('attendance.last120', { defaultValue: 'Last 120 days' })}
            </Text>
          </View>

          <GlassBackButton
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
          />
        </View>
      </LinearGradient>

      {showingSavedData && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: withAlpha('#F59E0B', 0.14),
              borderWidth: 1,
              borderColor: withAlpha('#F59E0B', 0.4),
            }}
          >
            <Ionicons name="cloud-offline" size={13} color="#F59E0B" />
            <Text
              style={[
                typography.caption,
                { color: '#F59E0B', fontWeight: '800' },
              ]}
            >
              {t('home.showingSavedData', {
                defaultValue: 'Showing saved data',
              })}
            </Text>
          </View>
        </View>
      )}

      {firstLoad ? (
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <ActivityIndicator size="large" color={BRAND.violet} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing.xl * 2,
          }}
          refreshControl={
            <RefreshControl
              refreshing={histQ.isRefetching && !firstLoad}
              onRefresh={load}
              tintColor={BRAND.violet}
              colors={[BRAND.violet]}
            />
          }
          ListHeaderComponent={
            <View>
              {error && (
                <View style={{ marginBottom: spacing.md }}>
                  <ErrorBanner message={error} />
                </View>
              )}

              {/* Rate summary card */}
              <Animated.View style={fadeUp(0)}>
                <View
                  style={[
                    styles.rateCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.rateRow}>
                    <Text style={[styles.rateNumber, { color: colors.text }]}>
                      {shownRate}
                    </Text>
                    <Text style={[styles.ratePercent, { color: BRAND.gold }]}>
                      %
                    </Text>
                    <Text
                      style={[
                        styles.rateLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t('attendance.rateLabel', {
                        defaultValue: 'Attendance rate',
                      })}
                    </Text>
                  </View>

                  <View
                    style={[styles.barTrack, { backgroundColor: colors.border }]}
                  >
                    <Animated.View
                      style={{
                        height: 8,
                        borderRadius: 4,
                        overflow: 'hidden',
                        width: rateAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                          extrapolate: 'clamp',
                        }),
                      }}
                    >
                      <LinearGradient
                        colors={[BRAND.gold, BRAND.magenta]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ flex: 1 }}
                      />
                    </Animated.View>
                  </View>

                  <Text style={[styles.rateCount, { color: colors.text }]}>
                    {t('attendance.attendedOf', {
                      present,
                      total,
                      defaultValue:
                        'You attended {{present}} of {{total}} gatherings',
                    })}
                  </Text>
                  {total > 0 && (
                    <Text
                      style={[
                        styles.rateMessage,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {message}
                    </Text>
                  )}
                </View>
              </Animated.View>

              {/* Stat tiles */}
              <Animated.View style={[styles.tiles, fadeUp(1)]}>
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
                  tint="#F59E0B"
                  value={currentStreak}
                  label={t('attendance.streak', {
                    defaultValue: 'Current streak',
                  })}
                  glow={currentStreak >= 3}
                />
                <StatTile
                  icon="trophy"
                  tint="#E6C779"
                  value={bestStreak}
                  label={t('attendance.bestStreak', {
                    defaultValue: 'Best streak',
                  })}
                />
              </Animated.View>

              {/* Activity grid */}
              <Animated.View style={fadeUp(2)}>
                <SectionTitle
                  icon="grid"
                  color={BRAND.violet}
                  title={t('attendance.last120', {
                    defaultValue: 'Last 120 days',
                  })}
                />
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <AttendanceGrid cells={cells} />
                </View>
              </Animated.View>

              {/* Breakdown by gathering */}
              {groups.length > 0 && (
                <Animated.View style={fadeUp(3)}>
                  <SectionTitle
                    icon="people"
                    color={BRAND.magenta}
                    title={t('attendance.byGathering', {
                      defaultValue: 'By gathering',
                    })}
                  />
                  <View
                    style={[
                      styles.card,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {groups.map((g, i) => (
                      <GatheringBar
                        key={g.key}
                        label={t(gatheringLabelKey(g.sample))}
                        present={g.present}
                        total={g.total}
                        tint={PALETTE[i % PALETTE.length]}
                        last={i === groups.length - 1}
                      />
                    ))}
                  </View>
                </Animated.View>
              )}

              {items.length > 0 && (
                <Animated.View style={fadeUp(4)}>
                  <SectionTitle
                    icon="time"
                    color={BRAND.gold}
                    title={t('attendance.recordsTitle', {
                      defaultValue: 'All records',
                    })}
                    count={items.length}
                  />
                </Animated.View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <LinearGradient
                colors={[BRAND.violet, BRAND.magenta, BRAND.gold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyRing}
              >
                <View
                  style={[
                    styles.emptyInner,
                    { backgroundColor: colors.background },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={40}
                    color={colors.textSecondary}
                  />
                </View>
              </LinearGradient>
              <Text
                style={[
                  typography.body,
                  {
                    color: colors.textSecondary,
                    marginTop: spacing.lg,
                    textAlign: 'center',
                  },
                ]}
              >
                {t('attendance.empty')}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const iso = item.dateGregorian.slice(0, 10);
            const ethLabel = formatEthDate(
              {
                year: item.dateEthYear,
                month: item.dateEthMonth,
                day: item.dateEthDay,
              },
              'en',
            );
            const prevIso =
              index > 0
                ? items[index - 1].dateGregorian.slice(0, 10)
                : null;
            const month = iso.slice(0, 7);
            const showMonth =
              prevIso === null || prevIso.slice(0, 7) !== month;
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
              />
            );
          }}
        />
      )}
    </View>
  );
}

// ---------- Helpers (unchanged) ----------

function SectionTitle({
  icon,
  color,
  title,
  count,
}: {
  icon: IconName;
  color: string;
  title: string;
  count?: number;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <View style={styles.sectionTitle}>
      <View style={[styles.sectionBar, { backgroundColor: color }]} />
      <Ionicons name={icon} size={16} color={color} />
      <Text
        style={[
          typography.caption,
          {
            color: colors.textSecondary,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            fontWeight: '800',
            flex: 1,
          },
        ]}
      >
        {title}
      </Text>
      {count !== undefined && (
        <View
          style={[
            styles.countBadge,
            { backgroundColor: withAlpha(color, 0.18) },
          ]}
        >
          <Text style={{ color, fontSize: 12, fontWeight: '800' }}>
            {count}
          </Text>
        </View>
      )}
    </View>
  );
}

function StatTile({
  icon,
  tint,
  value,
  label,
  glow,
}: {
  icon: IconName;
  tint: string;
  value: number;
  label: string;
  glow?: boolean;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: colors.surface,
          borderColor: glow ? withAlpha(tint, 0.7) : colors.border,
          shadowColor: tint,
          shadowOpacity: glow ? 0.4 : 0,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: glow ? 5 : 0,
        },
      ]}
    >
      <View
        style={[styles.tileIcon, { backgroundColor: withAlpha(tint, 0.18) }]}
      >
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={[styles.tileValue, { color: colors.text }]}>{value}</Text>
      <Text
        style={[styles.tileLabel, { color: colors.textSecondary }]}
        numberOfLines={2}
      >
        {label}
      </Text>
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
      <View style={styles.gatherTop}>
        <View style={[styles.gatherDot, { backgroundColor: tint }]} />
        <Text
          style={[
            typography.body,
            { color: colors.text, fontWeight: '700', flex: 1 },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, fontWeight: '700' },
          ]}
        >
          {present}/{total}
        </Text>
      </View>
      <View style={[styles.gatherTrack, { backgroundColor: colors.border }]}>
        <Animated.View
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: tint,
            width: fill.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
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
}: {
  item: AttendanceHistoryItem;
  index: number;
  iso: string;
  ethLabel: string;
  monthLabel: string | null;
  label: string;
  presentLabel: string;
  absentLabel: string;
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
          {
            translateY: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            }),
          },
        ],
      }}
    >
      {monthLabel && (
        <View style={styles.monthRow}>
          <Text
            style={[
              typography.caption,
              {
                color: colors.textSecondary,
                fontWeight: '800',
                letterSpacing: 1,
              },
            ]}
          >
            {monthLabel}
          </Text>
          <View style={[styles.monthLine, { backgroundColor: colors.border }]} />
        </View>
      )}

      <View
        style={[
          styles.item,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={[styles.itemBar, { backgroundColor: tone }]} />

        <View
          style={[styles.dateTile, { backgroundColor: withAlpha(tone, 0.16) }]}
        >
          <Text style={[styles.dateDay, { color: tone }]}>
            {item.dateEthDay}
          </Text>
          <Text style={[styles.dateMonth, { color: tone }]}>
            {formatEthDate(
              {
                year: item.dateEthYear,
                month: item.dateEthMonth,
                day: item.dateEthDay,
              },
              'en',
            )
              .split(' ')[0]
              .slice(0, 3)}
          </Text>
        </View>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text
            style={[
              typography.body,
              { color: colors.text, fontWeight: '700' },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          <Text
            style={[
              typography.caption,
              { color: colors.textSecondary, marginTop: 2 },
            ]}
            numberOfLines={1}
          >
            {ethLabel} · {iso}
          </Text>
        </View>

        <View style={[styles.pill, { backgroundColor: withAlpha(tone, 0.16) }]}>
          <Ionicons
            name={isPresent ? 'checkmark-circle' : 'close-circle'}
            size={15}
            color={tone}
          />
          <Text style={{ color: tone, fontSize: 12, fontWeight: '800' }}>
            {isPresent ? presentLabel : absentLabel}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screenHero: {
    paddingHorizontal: 16,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', width: 190, height: 190, borderRadius: 95 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: BRAND.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  heroSubtitle: { marginTop: 2, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  rateCard: { borderWidth: 1, borderRadius: 22, padding: 16 },
  rateRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' },
  rateNumber: { fontSize: 52, lineHeight: 58, fontWeight: '800' },
  ratePercent: {
    fontSize: 24,
    lineHeight: 38,
    fontWeight: '800',
    marginLeft: 2,
  },
  rateLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 12,
    marginBottom: 10,
    flexShrink: 1,
  },
  barTrack: { height: 8, borderRadius: 4, marginTop: 6, overflow: 'hidden' },
  rateCount: { marginTop: 12, fontSize: 13, fontWeight: '600' },
  rateMessage: { marginTop: 6, fontSize: 13, lineHeight: 19 },

  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
    rowGap: 12,
  },
  tile: { width: '48%', borderWidth: 1.5, borderRadius: 20, padding: 14 },
  tileIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValue: { fontSize: 30, fontWeight: '800', marginTop: 10 },
  tileLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 26,
    marginBottom: 10,
  },
  sectionBar: { width: 4, height: 16, borderRadius: 2 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  card: { borderWidth: 1, borderRadius: 22, padding: 16 },

  gatherTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  gatherDot: { width: 10, height: 10, borderRadius: 5 },
  gatherTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  monthLine: { flex: 1, height: StyleSheet.hairlineWidth },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingLeft: 16,
    marginBottom: 10,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  itemBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  dateTile: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { fontSize: 22, lineHeight: 26, fontWeight: '800' },
  dateMonth: { fontSize: 10, fontWeight: '700', opacity: 0.85 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  emptyRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyInner: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
});