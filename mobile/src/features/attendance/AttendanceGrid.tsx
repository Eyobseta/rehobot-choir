import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { onColor } from '../auth/Auth_UI';

export type GridCellState = 'PRESENT' | 'ABSENT' | 'EMPTY';

export type GridCell = {
  date: string; // YYYY-MM-DD
  state: GridCellState;
  count?: number;
};

type Props = {
  cells: GridCell[];
  onPressCell?: (date: string) => void;
  showCount?: boolean;
};

const WEEKDAYS_DEFAULT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AttendanceGrid({ cells, onPressCell, showCount }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  // Entrance animation for the whole grid
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, cells]);

  // Single-letter weekday headers (Sunday first), translated.
  const wdRaw = t('attendance.weekdaysShort', {
    returnObjects: true,
    defaultValue: WEEKDAYS_DEFAULT,
  }) as unknown;
  const weekdays: string[] =
    Array.isArray(wdRaw) && wdRaw.length === 7 ? (wdRaw as string[]) : WEEKDAYS_DEFAULT;

  if (cells.length === 0) {
    return (
      <View style={{ padding: spacing.md, alignItems: 'center' }}>
        <Ionicons name="calendar-outline" size={32} color={colors.textSecondary} />
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 8 }]}>
          —
        </Text>
      </View>
    );
  }

  const sorted = [...cells].sort((a, b) => (a.date < b.date ? -1 : 1));
  const byDate = new Map(sorted.map((c) => [c.date, c]));

  const first = new Date(sorted[0].date + 'T00:00:00.000Z');
  const last = new Date(sorted[sorted.length - 1].date + 'T00:00:00.000Z');

  const startGrid = new Date(first);
  startGrid.setUTCDate(startGrid.getUTCDate() - startGrid.getUTCDay());

  const endGrid = new Date(last);
  endGrid.setUTCDate(endGrid.getUTCDate() + (6 - endGrid.getUTCDay()));

  const allDates: string[] = [];
  const cursor = new Date(startGrid);
  while (cursor.getTime() <= endGrid.getTime()) {
    allDates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const weeks: string[][] = [];
  for (let i = 0; i < allDates.length; i += 7) {
    weeks.push(allDates.slice(i, i + 7));
  }

  const today = todayISO();

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          {
            translateY: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }}
    >
      {/* Weekday header */}
      <View style={{ flexDirection: 'row' }}>
        {weekdays.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}>
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, fontWeight: '800', fontSize: 11 },
              ]}
            >
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row' }}>
          {week.map((date) => {
            const cell = byDate.get(date);
            const state: GridCellState = cell?.state ?? 'EMPTY';
            const count = cell?.count ?? 0;
            const isToday = date === today;
            return (
              <GridCellView
                key={date}
                date={date}
                state={state}
                count={count}
                showCount={!!showCount}
                isToday={isToday}
                onPress={onPressCell}
              />
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginTop: 14,
        }}
      >
        <LegendDot color={colors.success} label={t('attendance.present')} />
        <LegendDot color={colors.error} label={t('attendance.absent')} />
        <LegendDot color={colors.background} label={t('attendance.notMarked')} bordered />
      </View>
    </Animated.View>
  );
}

// ---------- Cell ----------

function GridCellView({
  date,
  state,
  count,
  showCount,
  isToday,
  onPress,
}: {
  date: string;
  state: GridCellState;
  count: number;
  showCount: boolean;
  isToday: boolean;
  onPress?: (date: string) => void;
}) {
  const { t } = useTranslation();
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

  const isPresent = state === 'PRESENT';
  const isAbsent = state === 'ABSENT';
  const isEmpty = state === 'EMPTY';

  const fill = isPresent ? colors.success : isAbsent ? colors.error : colors.background;
  const ink = onColor(fill);

  const stateLabel = isPresent
    ? t('attendance.present')
    : isAbsent
      ? t('attendance.absent')
      : t('attendance.notMarked');

  return (
    <Animated.View
      style={{
        flex: 1,
        aspectRatio: 1,
        margin: 2.5,
        transform: [{ scale }],
      }}
    >
      <Pressable
        onPress={() => onPress?.(date)}
        onPressIn={() => to(0.9)}
        onPressOut={() => to(1)}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityLabel={`${date}, ${stateLabel}`}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: fill,
            // today gets a strong ring, empty cells a hairline border
            borderWidth: isToday ? 2 : isEmpty ? 1 : 0,
            borderColor: isToday ? colors.text : colors.border,
          }}
        >
          {showCount && !isEmpty ? (
            <Text style={{ color: ink, fontSize: 11, fontWeight: '800' }}>{count}</Text>
          ) : isToday ? (
            <Ionicons name="ellipse" size={7} color={isEmpty ? colors.text : ink} />
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function LegendDot({
  color,
  label,
  bordered,
}: {
  color: string;
  label: string;
  bordered?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 5,
          backgroundColor: color,
          borderWidth: bordered ? 1 : 0,
          borderColor: colors.border,
        }}
      />
      <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
        {label}
      </Text>
    </View>
  );
}