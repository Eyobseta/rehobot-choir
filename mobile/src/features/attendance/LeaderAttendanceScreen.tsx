import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  Animated,
  Easing,
} from 'react-native';
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
import {
  BRAND,
  withAlpha,
  onColor,
  ErrorBanner,
  PrimaryButton,
  SecondaryButton,
  FIELD_RADIUS,
} from '../auth/Auth_UI';
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
import {
  Avatar,
  Banner,
  Card,
  EmptyState,
  HeroPill,
  IconName,
  MIN_TOUCH_SIZE,
  ScaleTap,
  ScreenHero,
  SectionTitle,
  SkeletonRows,
} from './Attendance_Kit';

const GATHERINGS: GatheringType[] = [
  'TUESDAY_ZEMA',
  'THURSDAY_CHOIR',
  'SATURDAY_CHOIR',
];

// One flat brand colour per gathering (shown as a dot / active chip fill).
const GATHERING_TINTS: Record<GatheringType, string> = {
  TUESDAY_ZEMA: BRAND.lavender,
  THURSDAY_CHOIR: BRAND.mint,
  SATURDAY_CHOIR: BRAND.lime,
};

const SAVE_BAR_HEIGHT = 92;

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

  const presentCount = rows.filter((r) => getStatus(r.id) === 'PRESENT').length;
  const absentCount = rows.filter((r) => getStatus(r.id) === 'ABSENT').length;
  const unmarkedCount = rows.length - presentCount - absentCount;
  const busy = recordMut.isPending;

  const showSaveBar = view === 'record' && !loading && !locked;

  // ------------------ render ------------------
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: showSaveBar ? SAVE_BAR_HEIGHT + insets.bottom + spacing.lg : spacing.xl * 2,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Hero ---------- */}
        <ScreenHero
          icon="calendar"
          overline={t('attendance.title', { defaultValue: 'Attendance' })}
          title={t('attendance.record', { defaultValue: 'Record attendance' })}
          onBack={() => navigation.goBack()}
          backLabel={t('common.back', { defaultValue: 'Back' })}
        >
          {presentCount > 0 && (
            <HeroPill
              icon="checkmark-circle"
              text={`${presentCount} ${t('attendance.present')}`}
            />
          )}
        </ScreenHero>

        <View style={{ padding: spacing.lg }}>
          {/* ---------- Gathering selector ---------- */}
          <Text
            style={[
              typography.bodySmall,
              { color: colors.textSecondary, fontWeight: '700', marginBottom: 10 },
            ]}
          >
            {t('attendance.gathering')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {GATHERINGS.map((g) => {
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
                  active={gathering === g}
                  tint={GATHERING_TINTS[g]}
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
            style={{
              flexDirection: 'row',
              padding: 4,
              borderRadius: FIELD_RADIUS + 2,
              borderWidth: 1,
              marginBottom: 14,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <SegmentBtn
              icon="create"
              label={t('attendance.record')}
              active={view === 'record'}
              onPress={() => setView('record')}
            />
            <SegmentBtn
              icon="grid"
              label={t('attendance.grid')}
              active={view === 'grid'}
              onPress={() => setView('grid')}
            />
          </View>

          {/* ---------- Banners ---------- */}
          {error && <ErrorBanner message={error} />}
          {saved && <Banner tone="success" icon="checkmark-circle" text={t('attendance.saved')} />}

          {/* ---------- Members shortcut ---------- */}
          <ScaleTap
            onPress={() => navigation.navigate('LeaderAttendanceMembers')}
            accessibilityLabel={t('attendance.members')}
            pressableStyle={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              minHeight: 56,
              paddingHorizontal: 14,
              borderRadius: FIELD_RADIUS + 2,
              borderWidth: 1,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceAlt,
              }}
            >
              <Ionicons name="person-add" size={17} color={colors.accent} />
            </View>
            <Text
              style={[typography.body, { color: colors.text, fontWeight: '700', flex: 1 }]}
              numberOfLines={1}
            >
              {t('attendance.members')}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </ScaleTap>
        </View>

        {/* ================= RECORD VIEW ================= */}
        {view === 'record' && (
          <>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.textSecondary, fontWeight: '700', marginBottom: 8 },
                ]}
              >
                {t('attendance.date')}
              </Text>
              <Pressable
                onPress={() => setPickerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`${t('attendance.date')}: ${formatEthDate(date, lang)}`}
                style={{
                  minHeight: 52,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: spacing.md,
                  borderRadius: FIELD_RADIUS,
                  borderWidth: 1.5,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                }}
              >
                <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
                  {formatEthDate(date, lang)}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
              </Pressable>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
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
                <View style={{ marginTop: 12 }}>
                  <Banner tone="warning" icon="lock-closed" text={t('attendance.locked')} />
                </View>
              )}
            </View>

            {loading ? (
              <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
                <SkeletonRows count={6} height={64} />
              </View>
            ) : (
              <View style={{ paddingHorizontal: spacing.lg }}>
                <SectionTitle
                  title={t('attendance.members')}
                  count={rows.length}
                  tint={colors.accent}
                />

                {rows.length > 0 && (
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <CountChip
                      label={t('attendance.present')}
                      value={presentCount}
                      tone={colors.success}
                    />
                    <CountChip
                      label={t('attendance.absent')}
                      value={absentCount}
                      tone={colors.error}
                    />
                    <CountChip
                      label={t('attendance.notMarked')}
                      value={unmarkedCount}
                      tone={colors.textSecondary}
                    />
                  </View>
                )}

                {rows.length === 0 && (
                  <EmptyState icon="people-outline" text={t('directory.empty', { defaultValue: 'No members found.' })} />
                )}

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
          </>
        )}

        {/* ================= GRID VIEW ================= */}
        {view === 'grid' && (
          <View style={{ paddingHorizontal: spacing.lg }}>
            {gridLoading ? (
              <SkeletonRows count={1} height={260} />
            ) : (
              <Card>
                <AttendanceGrid
                  cells={gridCells}
                  onPressCell={(d) => void openDay(d)}
                  showCount
                />
              </Card>
            )}
          </View>
        )}
      </ScrollView>

      {/* ---------- Sticky save bar ---------- */}
      {showSaveBar && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <PrimaryButton
            label={t('attendance.save', { defaultValue: 'Save attendance' })}
            onPress={onSave}
            busy={busy}
            disabled={presentCount + absentCount === 0}
            iconNode={<Ionicons name="cloud-upload" size={18} color={colors.primaryText} />}
          />
        </View>
      )}

      {/* ---------- Day-detail modal ---------- */}
      <Modal
        visible={dayOpen !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDayOpen(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              padding: 20,
              maxHeight: '85%',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + spacing.lg,
            }}
          >
            <View
              style={{
                width: 44,
                height: 4,
                borderRadius: 2,
                alignSelf: 'center',
                marginBottom: 14,
                backgroundColor: colors.border,
              }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surfaceAlt,
                }}
              >
                <Ionicons name="calendar" size={20} color={colors.accent} />
              </View>
              <Text
                accessibilityRole="header"
                style={[typography.h3, { color: colors.text, flex: 1, fontWeight: '800' }]}
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
              style={{ marginTop: spacing.lg }}
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

            <View style={{ marginTop: spacing.lg }}>
              <SecondaryButton
                label={t('common.close', { defaultValue: 'Close' })}
                onPress={() => setDayOpen(null)}
              />
            </View>
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

// ---------- Sub-components ----------

function GatheringChip({
  label,
  active,
  tint,
  onPress,
}: {
  label: string;
  active: boolean;
  tint: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  const ink = active ? onColor(tint) : colors.text;

  return (
    <ScaleTap
      onPress={onPress}
      to={0.96}
      style={{ flex: 1 }}
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      pressableStyle={{
        minHeight: 64,
        borderRadius: FIELD_RADIUS + 2,
        borderWidth: 1.5,
        paddingHorizontal: 8,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: active ? tint : colors.surface,
        borderColor: active ? tint : colors.border,
      }}
    >
      {/* colour dot identifies the gathering even when not selected */}
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: active ? ink : tint,
        }}
      />
      <Text
        style={{ color: ink, fontSize: 12, fontWeight: '800', textAlign: 'center' }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </ScaleTap>
  );
}

function SegmentBtn({
  icon,
  label,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const ink = active ? colors.primaryText : colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{
        flex: 1,
        minHeight: 42,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: FIELD_RADIUS - 2,
        backgroundColor: active ? colors.primary : 'transparent',
      }}
    >
      <Ionicons name={icon} size={16} color={ink} />
      <Text
        style={[typography.bodySmall, { color: ink, fontWeight: active ? '800' : '600' }]}
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
  icon: IconName;
  label: string;
  tint: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { typography } = theme;
  return (
    <ScaleTap
      onPress={onPress}
      disabled={disabled}
      to={0.96}
      style={{ flex: 1, opacity: disabled ? 0.5 : 1 }}
      accessibilityLabel={label}
      pressableStyle={{
        minHeight: MIN_TOUCH_SIZE,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 8,
        borderRadius: FIELD_RADIUS,
        borderWidth: 1.5,
        borderColor: withAlpha(tint, 0.45),
        backgroundColor: withAlpha(tint, 0.1),
      }}
    >
      <Ionicons name={icon} size={16} color={tint} />
      <Text
        style={[typography.caption, { color: tint, fontWeight: '800', flexShrink: 1 }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </ScaleTap>
  );
}

function CountChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 14,
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: tone, fontSize: 18, fontWeight: '800' }}>{value}</Text>
      <Text
        style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', marginTop: 1 }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
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
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 10,
          paddingLeft: 16,
          borderRadius: 18,
          borderWidth: 1,
          overflow: 'hidden',
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }}
      >
        {/* status stripe: grey = not marked */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 5,
            backgroundColor: item.status ? tone : colors.border,
          }}
        />

        <Avatar
          uri={item.profilePhotoUrl}
          name={item.fullName}
          tone={item.status ? withAlpha(tone, 0.2) : colors.surfaceAlt}
          ink={item.status ? tone : colors.textSecondary}
          size={42}
        />

        <Text
          style={[
            typography.body,
            { color: colors.text, flex: 1, marginHorizontal: 12, fontWeight: '700' },
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
  label,
  icon,
  active,
  tint,
  disabled,
  onPress,
}: {
  label: string;
  icon: IconName;
  active: boolean;
  tint: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <ScaleTap
      onPress={onPress}
      disabled={disabled}
      to={0.9}
      style={{ marginLeft: 6, opacity: disabled ? 0.5 : 1 }}
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      pressableStyle={{
        width: MIN_TOUCH_SIZE,
        height: MIN_TOUCH_SIZE,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? tint : 'transparent',
        borderWidth: active ? 0 : 1.5,
        borderColor: withAlpha(tint, 0.6),
      }}
    >
      <Ionicons name={icon} size={18} color={active ? onColor(tint) : tint} />
    </ScaleTap>
  );
}

function DayGroup({
  tone,
  icon,
  label,
  names,
}: {
  tone: string;
  icon: IconName;
  label: string;
  names: string[];
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  if (names.length === 0) return null;
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Ionicons name={icon} size={16} color={tone} />
        <Text style={[typography.bodySmall, { color: tone, fontWeight: '800' }]}>{label}</Text>
      </View>
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          paddingHorizontal: 14,
          paddingVertical: 4,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }}
      >
        {names.map((n, i) => (
          <View
            key={`${n}-${i}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 10,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.border,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone }} />
            <Text style={[typography.body, { color: colors.text, flex: 1 }]} numberOfLines={1}>
              {n}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}