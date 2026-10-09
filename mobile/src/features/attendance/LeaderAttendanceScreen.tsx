import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import {
  AttendanceRow,
  AttendanceStatus,
  GatheringType,
  leaderGetAttendance,
  leaderRecordAttendance,
  leaderGetGrid,
  GridSummary,
} from '../../services/attendance';
import { ApiError } from '../../services/api';
import AttendanceGrid, { GridCell } from './AttendanceGrid';

const GATHERINGS: GatheringType[] = [
  'TUESDAY_ZEMA',
  'THURSDAY_CHOIR',
  'SATURDAY_CHOIR',
];

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthsAgoISO(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export default function LeaderAttendanceScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [gathering, setGathering] = useState<GatheringType>('SATURDAY_CHOIR');
  const [dateText, setDateText] = useState<string>(todayISO());
  const [view, setView] = useState<'record' | 'grid'>('record');

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [grid, setGrid] = useState<GridSummary | null>(null);
  const [gridLoading, setGridLoading] = useState(false);

  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [dayRows, setDayRows] = useState<AttendanceRow[]>([]);

  const loadRoster = useCallback(async () => {
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const data = await leaderGetAttendance(gathering, dateText);
      setRows(data.roster);
      setLocked(data.locked);
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
      setRows([]);
      setLocked(true);
    } finally {
      setLoading(false);
    }
  }, [gathering, dateText]);

  const loadGrid = useCallback(async () => {
    setGridLoading(true);
    try {
      const data = await leaderGetGrid(gathering, monthsAgoISO(90), todayISO());
      setGrid(data);
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setGridLoading(false);
    }
  }, [gathering]);

  useEffect(() => {
    if (view === 'record') void loadRoster();
    if (view === 'grid') void loadGrid();
  }, [view, loadRoster, loadGrid]);

  const openDay = async (date: string) => {
    setDayOpen(date);
    setDayRows([]);
    try {
      const data = await leaderGetAttendance(gathering, date);
      setDayRows(data.roster);
    } catch {
      // ignore
    }
  };

  const setStatus = (id: string, status: AttendanceStatus) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    setSaved(false);
  };

  const markAll = (status: AttendanceStatus) => {
    setRows((prev) => prev.map((r) => ({ ...r, status })));
    setSaved(false);
  };

  const onSave = async () => {
    if (locked) return;
    setError(null);
    const records = rows
      .filter((r) => r.status)
      .map((r) => ({ memberId: r.id, status: r.status as AttendanceStatus }));
    if (records.length === 0) {
      setError(t('attendance.notMarked'));
      return;
    }
    setBusy(true);
    try {
      await leaderRecordAttendance(gathering, dateText, records);
      setSaved(true);
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const gridCells: GridCell[] = (grid?.days ?? []).map((d) => {
    let state: 'PRESENT' | 'ABSENT' | 'EMPTY' = 'EMPTY';
    if (d.present > 0) state = 'PRESENT';
    else if (d.absent > 0) state = 'ABSENT';
    return { date: d.date, state, count: d.present };
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ padding: spacing.lg }}>
          <Text
            style={[
              typography.bodySmall,
              { color: colors.textSecondary, marginBottom: spacing.sm },
            ]}
          >
            {t('attendance.gathering')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            {GATHERINGS.map((g) => {
              const active = gathering === g;
              const key =
                g === 'TUESDAY_ZEMA'
                  ? 'attendance.tuesdayZema'
                  : g === 'THURSDAY_CHOIR'
                  ? 'attendance.thursdayChoir'
                  : 'attendance.saturdayChoir';
              return (
                <Pressable
                  key={g}
                  onPress={() => {
                    setGathering(g);
                    setView('record');
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.xs,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.surface,
                    alignItems: 'center',
                    minHeight: 60,
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: active ? colors.primaryText : colors.text,
                        textAlign: 'center',
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {t(key)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            <Pressable
              onPress={() => setView('record')}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: view === 'record' ? colors.primary : colors.border,
                alignItems: 'center',
              }}
            >
              <Text
                style={[
                  typography.caption,
                  { color: view === 'record' ? colors.primary : colors.text },
                ]}
              >
                {t('attendance.record')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setView('grid')}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: view === 'grid' ? colors.primary : colors.border,
                alignItems: 'center',
              }}
            >
              <Text
                style={[
                  typography.caption,
                  { color: view === 'grid' ? colors.primary : colors.text },
                ]}
              >
                {t('attendance.grid')}
              </Text>
            </Pressable>
          </View>

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
          {saved && (
            <Text
              style={[
                typography.bodySmall,
                { color: colors.success, marginTop: spacing.sm },
              ]}
            >
              {t('attendance.saved')}
            </Text>
          )}

          <Pressable
            onPress={() => navigation.navigate('LeaderAttendanceMembers')}
            style={{
              marginTop: spacing.md,
              paddingVertical: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.primary,
              alignItems: 'center',
            }}
          >
            <Text style={[typography.caption, { color: colors.primary }]}>
              {t('attendance.members')}
            </Text>
          </Pressable>
        </View>

        {view === 'record' && (
          <>
            <View style={{ paddingHorizontal: spacing.lg }}>
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.textSecondary, marginBottom: spacing.xs },
                ]}
              >
                {t('attendance.date')}
              </Text>
              <TextInput
                value={dateText}
                onChangeText={setDateText}
                autoCapitalize="none"
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  color: colors.text,
                }}
              />

              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <Pressable
                  onPress={() => markAll('PRESENT')}
                  disabled={locked}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    opacity: locked ? 0.5 : 1,
                  }}
                >
                  <Text style={[typography.caption, { color: colors.text }]}>
                    {t('attendance.markAllPresent')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => markAll('ABSENT')}
                  disabled={locked}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    opacity: locked ? 0.5 : 1,
                  }}
                >
                  <Text style={[typography.caption, { color: colors.text }]}>
                    {t('attendance.markAllAbsent')}
                  </Text>
                </Pressable>
              </View>

              {locked && (
                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.warning, marginTop: spacing.md },
                  ]}
                >
                  {t('attendance.locked')}
                </Text>
              )}
            </View>

            {loading ? (
              <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
                {rows.map((item) => (
                  <View
                    key={item.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    {item.profilePhotoUrl ? (
                      <Image
                        source={{ uri: item.profilePhotoUrl }}
                        style={{ width: 40, height: 40, borderRadius: 20 }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: colors.surfaceAlt,
                        }}
                      />
                    )}
                    <Text
                      style={[
                        typography.body,
                        { color: colors.text, flex: 1, marginLeft: spacing.md },
                      ]}
                      numberOfLines={1}
                    >
                      {item.fullName}
                    </Text>
                    <StatusBtn
                      label={t('attendance.present')}
                      active={item.status === 'PRESENT'}
                      color={colors.success}
                      disabled={locked}
                      onPress={() => setStatus(item.id, 'PRESENT')}
                    />
                    <StatusBtn
                      label={t('attendance.absent')}
                      active={item.status === 'ABSENT'}
                      color={colors.error}
                      disabled={locked}
                      onPress={() => setStatus(item.id, 'ABSENT')}
                    />
                  </View>
                ))}
              </View>
            )}

            {!loading && !locked && (
              <View style={{ padding: spacing.lg }}>
                <Pressable
                  onPress={onSave}
                  disabled={busy}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: radius.md,
                    paddingVertical: spacing.md,
                    alignItems: 'center',
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.primaryText} />
                  ) : (
                    <Text style={[typography.button, { color: colors.primaryText }]}>
                      {t('attendance.save')}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </>
        )}

        {view === 'grid' && (
          <View style={{ paddingHorizontal: spacing.lg }}>
            {gridLoading ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <AttendanceGrid
                cells={gridCells}
                onPressCell={(date) => void openDay(date)}
                showCount
              />
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={dayOpen !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDayOpen(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              padding: spacing.lg,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              maxHeight: '80%',
            }}
          >
            <Text style={[typography.h3, { color: colors.text }]}>
              {t('attendance.dayDetail', { date: dayOpen ?? '' })}
            </Text>

            <ScrollView style={{ marginTop: spacing.lg }}>
              <Text style={[typography.bodySmall, { color: colors.success }]}>
                {t('attendance.dayPresent', {
                  count: dayRows.filter((r) => r.status === 'PRESENT').length,
                })}
              </Text>
              {dayRows
                .filter((r) => r.status === 'PRESENT')
                .map((r) => (
                  <Text
                    key={r.id}
                    style={[typography.body, { color: colors.text, marginTop: 4 }]}
                  >
                    • {r.fullName}
                  </Text>
                ))}

              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.error, marginTop: spacing.md },
                ]}
              >
                {t('attendance.dayAbsent', {
                  count: dayRows.filter((r) => r.status === 'ABSENT').length,
                })}
              </Text>
              {dayRows
                .filter((r) => r.status === 'ABSENT')
                .map((r) => (
                  <Text
                    key={r.id}
                    style={[typography.body, { color: colors.text, marginTop: 4 }]}
                  >
                    • {r.fullName}
                  </Text>
                ))}

              {dayRows.every((r) => !r.status) && (
                <Text
                  style={[
                    typography.body,
                    { color: colors.textSecondary, marginTop: spacing.md },
                  ]}
                >
                  {t('attendance.dayNoRecords')}
                </Text>
              )}
            </ScrollView>

            <Pressable
              onPress={() => setDayOpen(null)}
              style={{
                marginTop: spacing.lg,
                paddingVertical: spacing.md,
                alignItems: 'center',
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={[typography.button, { color: colors.text }]}>
                {t('common.cancel')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );

  function StatusBtn({
    label,
    active,
    color,
    disabled,
    onPress,
  }: {
    label: string;
    active: boolean;
    color: string;
    disabled: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={{
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.sm,
          marginLeft: spacing.xs,
          borderWidth: 1,
          borderColor: active ? color : colors.border,
          backgroundColor: active ? color : colors.surface,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text
          style={[
            typography.caption,
            { color: active ? '#FFFFFF' : colors.text, fontWeight: '600' },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  }
}