import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';

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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AttendanceGrid({ cells, onPressCell, showCount }: Props) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

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

  if (cells.length === 0) {
    return (
      <View style={{ padding: spacing.md, alignItems: 'center' }}>
        <Ionicons name="calendar-outline" size={32} color={colors.textSecondary} />
        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, marginTop: 8 },
          ]}
        >
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
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((d) => (
          <View key={d} style={styles.weekdayCell}>
            <Text
              style={[
                typography.caption,
                {
                  color: colors.textSecondary,
                  fontWeight: '800',
                  fontSize: 10,
                },
              ]}
            >
              {d.slice(0, 1)}
            </Text>
          </View>
        ))}
      </View>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
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
      <View style={styles.legendRow}>
        <LegendDot
          colors={['#22C55E', '#16A34A']}
          label="Present"
        />
        <LegendDot
          colors={['#F87171', '#DC2626']}
          label="Absent"
        />
        <LegendDot
          colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
          label="—"
          border
        />
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

  const gradient: readonly [string, string] = isPresent
    ? ['#22C55E', '#16A34A']
    : isAbsent
      ? ['#F87171', '#DC2626']
      : ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)'];

  const shadowColor = isPresent ? '#16A34A' : isAbsent ? '#DC2626' : 'transparent';

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
        accessibilityRole="button"
        accessibilityLabel={`${date} ${state.toLowerCase()}`}
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.cell,
            {
              borderColor: isEmpty ? colors.border : 'transparent',
              borderWidth: isEmpty ? 1 : 0,
              shadowColor,
              shadowOpacity: isEmpty ? 0 : 0.45,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: isEmpty ? 0 : 4,
              // glow ring for today
              ...(isToday
                ? {
                    borderWidth: 2,
                    borderColor: BRAND.gold,
                  }
                : null),
            },
          ]}
        >
          {showCount && state !== 'EMPTY' ? (
            <Text
              style={[
                styles.cellText,
                { color: '#FFFFFF', fontWeight: '800' },
              ]}
            >
              {count}
            </Text>
          ) : isToday ? (
            <Ionicons name="ellipse" size={8} color={BRAND.gold} />
          ) : null}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

function LegendDot({
  colors,
  label,
  border,
}: {
  colors: readonly [string, string];
  label: string;
  border?: boolean;
}) {
  const { theme } = useTheme();
  const { typography } = theme;
  return (
    <View style={styles.legendItem}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.legendDot,
          border ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' } : null,
        ]}
      />
      <Text
        style={[
          typography.caption,
          { color: 'rgba(255,255,255,0.75)', fontWeight: '700' },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  weekdayRow: { flexDirection: 'row' },
  weekdayCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  weekRow: { flexDirection: 'row' },
  cell: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { fontSize: 11 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 14,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 4 },
});