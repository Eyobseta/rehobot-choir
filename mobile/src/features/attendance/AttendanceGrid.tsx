import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

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

export default function AttendanceGrid({
  cells,
  onPressCell,
  showCount,
}: Props) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  if (cells.length === 0) {
    return (
      <View style={{ padding: spacing.md }}>
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
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

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((d) => (
          <View
            key={d}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: spacing.xs,
            }}
          >
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {d.slice(0, 1)}
            </Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={{ flexDirection: 'row' }}>
          {week.map((date) => {
            const cell = byDate.get(date);
            const state: GridCellState = cell?.state ?? 'EMPTY';
            const count = cell?.count ?? 0;

            const bg =
              state === 'PRESENT'
                ? colors.success
                : state === 'ABSENT'
                ? colors.surfaceAlt
                : colors.surface;

            const border = state === 'EMPTY' ? colors.border : 'transparent';

            return (
              <Pressable
                key={date}
                onPress={() => onPressCell?.(date)}
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  margin: 2,
                  borderRadius: radius.sm,
                  backgroundColor: bg,
                  borderWidth: 1,
                  borderColor: border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showCount && state !== 'EMPTY' && (
                  <Text
                    style={[
                      typography.caption,
                      {
                        color:
                          state === 'PRESENT' ? '#FFFFFF' : colors.text,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {count}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: spacing.sm,
          gap: spacing.md,
        }}
      >
        <LegendDot color={colors.success} label="Present" />
        <LegendDot color={colors.surfaceAlt} label="Absent" />
        <LegendDot color={colors.surface} label="—" border />
      </View>
    </View>
  );

  function LegendDot({
    color,
    label,
    border,
  }: {
    color: string;
    label: string;
    border?: boolean;
  }) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 4,
            backgroundColor: color,
            borderWidth: border ? 1 : 0,
            borderColor: colors.border,
          }}
        />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {label}
        </Text>
      </View>
    );
  }
}