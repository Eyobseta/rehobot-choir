import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
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
  AttendanceRow,
  AttendanceStatus,
  GatheringType,
} from '../../services/attendance';
import AttendanceGrid, { GridCell } from './AttendanceGrid';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import {
  EthDate,
  ethTodayFromInstant,
  addEthDays,
  formatEthDate,
  utcDateToEth,
} from '../../utils/ethiopianCalendar';
import EthDatePicker from '../funding/EthDatePicker';
import {
  useLeaderAttendanceQuery,
  useLeaderAttendanceGridQuery,
  useRecordAttendanceMutation,
} from './useAttendance';

const GATHERINGS: GatheringType[] = [
  'TUESDAY_ZEMA',
  'THURSDAY_CHOIR',
  'SATURDAY_CHOIR',
];

const GATHERING_TINTS: Record<GatheringType, readonly [string, string]> = {
  TUESDAY_ZEMA: ['#6EDBD5', '#2E9A93'],
  THURSDAY_CHOIR: ['#B6A0FF', '#7B5CFF'],
  SATURDAY_CHOIR: ['#EE9BBD', '#D14879'],
};

export default function LeaderAttendanceScreen({ navigation }: any) {
   const { t, i18n } = useTranslation();
 const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  // ------------------ state ------------------
  const today = ethTodayFromInstant(new Date());
  const [gathering, setGathering] = useState<GatheringType>('SATURDAY_CHOIR');
  const [date, setDate] = useState<EthDate>(today);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [view, setView] = useState<'record' | 'grid'>('record');

  // Local edits overlay on the server data (so the user can toggle buttons
  // without waiting for the network before the button visually updates).
  const [localStatuses, setLocalStatuses] = useState<
    Record<string, AttendanceStatus>
  >({});
  const [saved, setSaved] = useState(false);

  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [dayRows, setDayRows] = useState<AttendanceRow[]>([]);

  // ------------------ data ------------------
  const rosterQ = useLeaderAttendanceQuery(gathering, date);
  const gridQ = useLeaderAttendanceGridQuery(
    gathering,
    addEthDays(today, -90),
    today,
  );
  const recordMut = useRecordAttendanceMutation();

  const rows = rosterQ.data?.roster ?? [];
  const locked = rosterQ.data?.locked ?? false;
  const loading = rosterQ.isPending && rosterQ.data === undefined;
  const gridLoading = gridQ.isPending && gridQ.data === undefined;

  const error =
    (rosterQ.error as { message?: string } | null)?.message ??
    (gridQ.error as { message?: string } | null)?.message ??
    null;

  // A "sheet" is one (gathering, Ethiopian date) pair — the unit of work the
  // leader is currently recording.
  //
  // We reset local edits only when the leader switches to a different sheet.
  // The previous implementation reset on `[rosterQ.data]`, which fires on
  // EVERY TanStack refetch (focus, reconnect, pull-to-refresh, mutation
  // invalidation) — silently wiping any PRESENT/ABSENT marks the leader had
  // toggled but not yet saved. That's a real data-loss path: glance at a
  // notification, come back to a blank sheet.
  const sheetKey = `${gathering}|${date.year}-${date.month}-${date.day}`;
  useEffect(() => {
    setLocalStatuses({});
    setSaved(false);
  }, [sheetKey]);

  // Clear the "saved" banner after a moment
  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(id);
  }, [saved]);

  const getStatus = (id: string): AttendanceStatus | null =>
    localStatuses[id] ?? rows.find((r) => r.id === id)?.status ?? null;

  const openDay = useCallback(
    async (isoDate: string) => {
      setDayOpen(isoDate);
      setDayRows([]);
      try {
        const eth = utcDateToEth(new Date(isoDate + 'T00:00:00.000Z'));
        const { leaderGetAttendance } = await import(
          '../../services/attendance'
        );
        const data = await leaderGetAttendance(gathering, eth);
        setDayRows(data.roster);
      } catch {
        // ignore
      }
    },
    [gathering],
  );

  const setStatus = (id: string, status: AttendanceStatus) => {
    setLocalStatuses((prev) => ({ ...prev, [id]: status }));
    setSaved(false);
  };

  const markAll = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {};
    rows.forEach((r) => {
      next[r.id] = status;
    });
    setLocalStatuses(next);
    setSaved(false);
  };

  const onSave = async () => {
    if (locked) return;
    const records = rows
      .filter((r) => getStatus(r.id) !== null)
      .map((r) => ({
        memberId: r.id,
        status: getStatus(r.id) as AttendanceStatus,
      }));
    if (records.length === 0) return;
    try {
      await recordMut.mutateAsync({ gathering, date, records });
      setSaved(true);
    } catch {
      // error surfaces through recordMut.error
    }
  };

  const gridCells: GridCell[] = (gridQ.data?.days ?? []).map((d) => {
    let state: 'PRESENT' | 'ABSENT' | 'EMPTY' = 'EMPTY';
    if (d.present > 0) state = 'PRESENT';
    else if (d.absent > 0) state = 'ABSENT';
    return { date: d.date, count: d.present, state };
  });

  const tint = GATHERING_TINTS[gathering];
  const presentCount = rows.filter((r) => getStatus(r.id) === 'PRESENT').length;
  const busy = recordMut.isPending;

  // ------------------ render ------------------
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Gradient hero ---------- */}
        <LinearGradient
          colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 16 }]}
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
                bottom: -80,
                left: -50,
                backgroundColor: withAlpha(BRAND.water, 0.22),
              },
            ]}
          />

          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Ionicons name="calendar" size={22} color={BRAND.deep} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroKicker}>
                {t('attendance.title', { defaultValue: 'Attendance' })}
              </Text>
              <Text style={styles.heroTitle}>
                {t('attendance.record', { defaultValue: 'Record attendance' })}
              </Text>
            </View>

            <GlassBackButton
              onPress={() => navigation.goBack()}
              accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
            />
          </View>

          {presentCount > 0 && (
            <View style={styles.heroBadge}>
              <Ionicons
                name="checkmark-circle"
                size={13}
                color="#FFFFFF"
              />
              <Text style={styles.heroBadgeText}>{presentCount}</Text>
            </View>
          )}
        </LinearGradient>

        <View style={{ padding: spacing.lg }}>
          {/* ---------- Gathering selector ---------- */}
          <SectionLabel
            icon="people"
            tint={BRAND.magenta}
            text={t('attendance.gathering')}
          />
          <View style={styles.gatheringRow}>
            {GATHERINGS.map((g) => {
              const active = gathering === g;
              const key =
                g === 'TUESDAY_ZEMA'
                  ? 'attendance.tuesdayZema'
                  : g === 'THURSDAY_CHOIR'
                  ? 'attendance.thursdayChoir'
                  : 'attendance.saturdayChoir';
              return (
                <GatheringChip
                  key={g}
                  label={t(key)}
                  active={active}
                  gradient={GATHERING_TINTS[g]}
                  onPress={() => {
                    setGathering(g);
                    setView('record');
                  }}
                />
              );
            })}
          </View>

          {/* ---------- Segmented control ---------- */}
          <View
            style={[
              styles.segment,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <SegmentBtn
              icon="create"
              label={t('attendance.record')}
              active={view === 'record'}
              tint={tint[0]}
              onPress={() => setView('record')}
            />
            <SegmentBtn
              icon="grid"
              label={t('attendance.grid')}
              active={view === 'grid'}
              tint={tint[0]}
              onPress={() => setView('grid')}
            />
          </View>

          {/* ---------- Banners ---------- */}
          {error && (
            <View
              style={[
                styles.banner,
                {
                  backgroundColor: withAlpha(colors.error, 0.12),
                  borderColor: withAlpha(colors.error, 0.4),
                },
              ]}
            >
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.error, flex: 1, fontWeight: '700' },
                ]}
              >
                {error}
              </Text>
            </View>
          )}
          {saved && (
            <View
              style={[
                styles.banner,
                {
                  backgroundColor: withAlpha(colors.success, 0.12),
                  borderColor: withAlpha(colors.success, 0.4),
                },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={colors.success}
              />
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.success, flex: 1, fontWeight: '700' },
                ]}
              >
                {t('attendance.saved')}
              </Text>
            </View>
          )}

          <Pressable
            onPress={() => navigation.navigate('LeaderAttendanceMembers')}
            style={[
              styles.outlineBtn,
              {
                borderColor: tint[0],
                backgroundColor: withAlpha(tint[0], 0.08),
              },
            ]}
          >
            <Ionicons name="person-add" size={16} color={tint[0]} />
            <Text
              style={[
                typography.caption,
                { color: tint[0], fontWeight: '800', marginLeft: 8 },
              ]}
            >
              {t('attendance.members')}
            </Text>
          </Pressable>
        </View>

        {/* ================= RECORD VIEW ================= */}
        {view === 'record' && (
          <>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <SectionLabel
                icon="calendar"
                tint={BRAND.gold}
                text={t('attendance.date')}
              />
              <Pressable
                onPress={() => setPickerOpen(true)}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: 50,
                  },
                ]}
              >
                <Text style={{ color: colors.text, fontSize: 15 }}>
                  {formatEthDate(date, lang)}
                </Text>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>

              <View style={styles.quickRow}>
                <QuickAction
                  icon="checkmark-done"
                  label={t('attendance.markAllPresent')}
                  tint={colors.success}
                  disabled={locked}
                  onPress={() => markAll('PRESENT')}
                />
                <QuickAction
                  icon="close"
                  label={t('attendance.markAllAbsent')}
                  tint={colors.error}
                  disabled={locked}
                  onPress={() => markAll('ABSENT')}
                />
              </View>

              {locked && (
                <View
                  style={[
                    styles.banner,
                    {
                      backgroundColor: withAlpha(colors.warning, 0.12),
                      borderColor: withAlpha(colors.warning, 0.4),
                    },
                  ]}
                >
                  <Ionicons
                    name="lock-closed"
                    size={16}
                    color={colors.warning}
                  />
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: colors.warning, flex: 1, fontWeight: '700' },
                    ]}
                  >
                    {t('attendance.locked')}
                  </Text>
                </View>
              )}
            </View>

            {loading ? (
              <View
                style={{ padding: spacing.xl * 2, alignItems: 'center' }}
              >
                <ActivityIndicator size="large" color={BRAND.violet} />
              </View>
            ) : (
              <View
                style={{
                  paddingHorizontal: spacing.lg,
                  marginTop: spacing.md,
                }}
              >
                {rows.map((item, index) => (
                  <RosterRow
                    key={item.id}
                    item={{ ...item, status: getStatus(item.id) }}
                    index={index}
                    locked={locked}
                    onPresent={() => setStatus(item.id, 'PRESENT')}
                    onAbsent={() => setStatus(item.id, 'ABSENT')}
                    presentLabel={t('attendance.present')}
                    absentLabel={t('attendance.absent')}
                  />
                ))}
              </View>
            )}

            {!loading && !locked && (
              <View style={{ padding: spacing.lg }}>
                <SaveButton busy={busy} onPress={onSave} gradient={tint} />
              </View>
            )}
          </>
        )}

        {/* ================= GRID VIEW ================= */}
        {view === 'grid' && (
          <View style={{ paddingHorizontal: spacing.lg }}>
            {gridLoading ? (
              <View
                style={{ padding: spacing.xl * 2, alignItems: 'center' }}
              >
                <ActivityIndicator size="large" color={BRAND.violet} />
              </View>
            ) : (
              <LinearGradient
                colors={[BRAND.deep, BRAND.violet]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gridCard}
              >
                <AttendanceGrid
                  cells={gridCells}
                  onPressCell={(date) => void openDay(date)}
                  showCount
                />
              </LinearGradient>
            )}
          </View>
        )}
      </ScrollView>

      {/* ---------- Day-detail modal ---------- */}
      <Modal
        visible={dayOpen !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDayOpen(null)}
      >
        <View style={styles.backdrop}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background,
                paddingBottom: insets.bottom + spacing.lg,
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View
                style={[
                  styles.sheetIcon,
                  { backgroundColor: withAlpha(BRAND.violet, 0.16) },
                ]}
              >
                <Ionicons name="calendar" size={20} color={BRAND.violet} />
              </View>
              <Text
                style={[
                  typography.h3,
                  { color: colors.text, flex: 1, fontWeight: '800' },
                ]}
                numberOfLines={1}
              >
                {t('attendance.dayDetail', {
                  date: dayOpen
                    ? formatEthDate(
                        utcDateToEth(new Date(dayOpen + 'T00:00:00.000Z')),
                        lang,
                      )
                    : '',
                })}
              </Text>
            </View>

            <ScrollView
              style={{ marginTop: spacing.md }}
              showsVerticalScrollIndicator={false}
            >
              <DayGroup
                tone={colors.success}
                icon="checkmark-circle"
                label={t('attendance.dayPresent', {
                  count: dayRows.filter((r) => r.status === 'PRESENT').length,
                })}
                names={dayRows
                  .filter((r) => r.status === 'PRESENT')
                  .map((r) => r.fullName)}
              />
              <DayGroup
                tone={colors.error}
                icon="close-circle"
                label={t('attendance.dayAbsent', {
                  count: dayRows.filter((r) => r.status === 'ABSENT').length,
                })}
                names={dayRows
                  .filter((r) => r.status === 'ABSENT')
                  .map((r) => r.fullName)}
              />

              {dayRows.every((r) => !r.status) && (
                <Text
                  style={[
                    typography.body,
                    {
                      color: colors.textSecondary,
                      marginTop: spacing.md,
                      textAlign: 'center',
                    },
                  ]}
                >
                  {t('attendance.dayNoRecords')}
                </Text>
              )}
            </ScrollView>

            <Pressable
              onPress={() => setDayOpen(null)}
              style={[
                styles.outlineBtn,
                { borderColor: colors.border, marginTop: spacing.lg },
              ]}
            >
              <Text style={[typography.button, { color: colors.text }]}>
                {t('common.cancel')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ---------- EthDate picker ---------- */}
      <EthDatePicker
        visible={pickerOpen}
        title={t('attendance.date')}
        value={date}
        onClose={() => setPickerOpen(false)}
        onConfirm={(d) => {
          setDate(d);
          setPickerOpen(false);
        }}
        minYear={today.year - 1}
        maxYear={today.year + 1}
      />
    </View>
  );
}

// ---------- Sub-components (unchanged) ----------

function SectionLabel({
  icon,
  tint,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tint: string;
  text: string;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <View style={styles.sectionLabel}>
      <View style={[styles.sectionBar, { backgroundColor: tint }]} />
      <Ionicons name={icon} size={14} color={tint} />
      <Text
        style={[
          typography.caption,
          {
            color: colors.textSecondary,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            fontWeight: '800',
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

function GatheringChip({
  label,
  active,
  gradient,
  onPress,
}: {
  label: string;
  active: boolean;
  gradient: readonly [string, string];
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      speed: 40,
      bounciness: 8,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.96)}
        onPressOut={() => to(1)}
        style={{ flex: 1 }}
      >
        {active ? (
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gatheringChip, { borderColor: 'transparent' }]}
          >
            <Text
              style={[styles.gatheringText, { color: '#FFFFFF' }]}
              numberOfLines={2}
            >
              {label}
            </Text>
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.gatheringChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.gatheringText, { color: colors.text }]}
              numberOfLines={2}
            >
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function SegmentBtn({
  icon,
  label,
  active,
  tint,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  active: boolean;
  tint: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.segmentBtn,
        active
          ? { backgroundColor: withAlpha(tint, 0.16) }
          : { backgroundColor: 'transparent' },
      ]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={active ? tint : colors.textSecondary}
      />
      <Text
        style={[
          typography.caption,
          {
            color: active ? tint : colors.textSecondary,
            fontWeight: active ? '800' : '600',
            marginLeft: 6,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function QuickAction({
  icon,
  label,
  tint,
  disabled,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  tint: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { typography } = theme;
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      speed: 40,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => to(0.96)}
        onPressOut={() => to(1)}
        style={[
          styles.quickAction,
          {
            borderColor: withAlpha(tint, 0.45),
            backgroundColor: withAlpha(tint, 0.1),
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Ionicons name={icon} size={16} color={tint} />
        <Text
          style={[
            typography.caption,
            { color: tint, fontWeight: '800', marginLeft: 6, flexShrink: 1 },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function RosterRow({
  item,
  index,
  locked,
  onPresent,
  onAbsent,
  presentLabel,
  absentLabel,
}: {
  item: AttendanceRow;
  index: number;
  locked: boolean;
  onPresent: () => void;
  onAbsent: () => void;
  presentLabel: string;
  absentLabel: string;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 400,
      delay: Math.min(index, 8) * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [enter, index]);

  const initial = item.fullName.trim().charAt(0).toUpperCase();
  const tone =
    item.status === 'PRESENT'
      ? colors.success
      : item.status === 'ABSENT'
      ? colors.error
      : colors.textSecondary;

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          {
            translateY: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [18, 0],
            }),
          },
        ],
        marginBottom: 10,
      }}
    >
      <View
        style={[
          styles.rosterCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={[styles.rosterBar, { backgroundColor: tone }]} />

        <View
          style={[
            styles.rosterAvatar,
            { backgroundColor: withAlpha(tone, 0.16) },
          ]}
        >
          {item.profilePhotoUrl ? (
            <Image
              source={{ uri: item.profilePhotoUrl }}
              style={styles.rosterAvatarImg}
            />
          ) : (
            <Text style={{ color: tone, fontWeight: '800', fontSize: 16 }}>
              {initial}
            </Text>
          )}
        </View>

        <Text
          style={[
            typography.body,
            { color: colors.text, flex: 1, marginLeft: 12, fontWeight: '700' },
          ]}
          numberOfLines={1}
        >
          {item.fullName}
        </Text>

        <StatusBtn
          label={presentLabel}
          icon="checkmark"
          active={item.status === 'PRESENT'}
          tint={colors.success}
          disabled={locked}
          onPress={onPresent}
        />
        <StatusBtn
          label={absentLabel}
          icon="close"
          active={item.status === 'ABSENT'}
          tint={colors.error}
          disabled={locked}
          onPress={onAbsent}
        />
      </View>
    </Animated.View>
  );
}

function StatusBtn({
  icon,
  active,
  tint,
  disabled,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  active: boolean;
  tint: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      speed: 40,
      bounciness: 8,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], marginLeft: 6 }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.9)}
        onPressOut={() => to(1)}
        disabled={disabled}
        style={{ opacity: disabled ? 0.5 : 1 }}
      >
        {active ? (
          <LinearGradient
            colors={[tint, withAlpha(tint, 0.75)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statusBtn}
          >
            <Ionicons name={icon} size={14} color="#FFFFFF" />
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.statusBtn,
              { borderWidth: 1.5, borderColor: withAlpha(tint, 0.6) },
            ]}
          >
            <Ionicons name={icon} size={14} color={tint} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function SaveButton({
  busy,
  onPress,
  gradient,
}: {
  busy: boolean;
  onPress: () => void;
  gradient: readonly [string, string];
}) {
  const { t } = useTranslation();
  const { typography } = useTheme().theme;
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      speed: 40,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        shadowColor: gradient[1],
        shadowOpacity: 0.45,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
    >
      <Pressable
        onPress={onPress}
        disabled={busy}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        style={{ opacity: busy ? 0.7 : 1 }}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.saveBtn}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={18} color="#FFFFFF" />
              <Text
                style={[
                  typography.button,
                  { color: '#FFFFFF', fontWeight: '800', marginLeft: 8 },
                ]}
              >
                {t('attendance.save', { defaultValue: 'Save attendance' })}
              </Text>
            </>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

function DayGroup({
  tone,
  icon,
  label,
  names,
}: {
  tone: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  names: string[];
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  if (names.length === 0) return null;
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={styles.dayGroupHeader}>
        <Ionicons name={icon} size={16} color={tone} />
        <Text
          style={[
            typography.bodySmall,
            { color: tone, fontWeight: '800', marginLeft: 6 },
          ]}
        >
          {label}
        </Text>
      </View>
      {names.map((n, i) => (
        <View key={`${n}-${i}`} style={styles.dayRow}>
          <View style={[styles.dayBullet, { backgroundColor: tone }]} />
          <Text
            style={[typography.body, { color: colors.text, flex: 1 }]}
            numberOfLines={1}
          >
            {n}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 16,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', width: 180, height: 180, borderRadius: 90 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: BRAND.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    marginTop: 14,
  },
  heroBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },

  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  sectionBar: { width: 4, height: 14, borderRadius: 2 },

  gatheringRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  gatheringChip: {
    minHeight: 62,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatheringText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },

  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },

  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },

  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
  },

  quickRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },

  rosterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingLeft: 16,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rosterBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  rosterAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rosterAvatarImg: { width: '100%', height: '100%' },
  statusBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveBtn: {
    minHeight: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  gridCard: { borderRadius: 22, padding: 14 },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    padding: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(150,150,150,0.4)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  dayBullet: { width: 6, height: 6, borderRadius: 3 },
});