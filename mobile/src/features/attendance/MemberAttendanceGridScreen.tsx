import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { leaderGetMemberGrid, MyGridSummary } from '../../services/attendance';
import { ApiError } from '../../services/api';
import AttendanceGrid, { GridCell } from './AttendanceGrid';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { EthDate, ethTodayFromInstant, addEthDays } from '../../utils/ethiopianCalendar';

export default function MemberAttendanceGridScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();
  const { memberId, memberName } = route.params;

  const today = ethTodayFromInstant(new Date());

  const [summary, setSummary] = useState<MyGridSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const from = addEthDays(today, -120);
      setSummary(await leaderGetMemberGrid(memberId, from, today));
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
    date: d.isoDate,
    state: d.status === 'PRESENT' ? 'PRESENT' : 'ABSENT',
  }));

  const present = cells.filter((c) => c.state === 'PRESENT').length;
  const total = cells.length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  return (
    <ScrollView
      contentContainerStyle={{
        paddingBottom: spacing.xl * 2,
        backgroundColor: colors.background,
      }}
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
            { top: -60, right: -40, backgroundColor: withAlpha(BRAND.gold, 0.22) },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.blob,
            { bottom: -70, left: -50, backgroundColor: withAlpha(BRAND.water, 0.22) },
          ]}
        />

        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <Ionicons name="person" size={22} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroKicker}>
              {t('attendance.historyTitle', { defaultValue: 'Attendance history' })}
            </Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {memberName}
            </Text>
          </View>

          {/* Back — right side, gap from title */}
          <GlassBackButton
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
          />
        </View>

        {!loading && total > 0 && (
          <View style={styles.heroStats}>
            <HeroStat label={t('attendance.present')} value={present} tint="#FFFFFF" />
            <HeroStat
              label={t('attendance.rateLabel', { defaultValue: 'Rate' })}
              value={`${rate}%`}
              tint={BRAND.gold}
            />
            <HeroStat
              label={t('attendance.absent')}
              value={total - present}
              tint="#FFFFFF"
            />
          </View>
        )}
      </LinearGradient>

      {loading ? (
        <View style={{ padding: spacing.xl * 2, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={BRAND.violet} />
        </View>
      ) : (
        <View style={{ padding: spacing.lg }}>
          {error && (
            <Text
              style={[
                typography.bodySmall,
                { color: colors.error, marginBottom: spacing.md },
              ]}
            >
              {error}
            </Text>
          )}

          {total > 0 && (
            <LinearGradient
              colors={[BRAND.deep, BRAND.violet]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gridCard}
            >
              <AttendanceGrid cells={cells} />
            </LinearGradient>
          )}

          {total === 0 && (
            <View style={{ alignItems: 'center', padding: spacing.xl }}>
              <Ionicons name="calendar-outline" size={40} color={colors.textSecondary} />
              <Text
                style={[
                  typography.body,
                  { color: colors.textSecondary, marginTop: 10, textAlign: 'center' },
                ]}
              >
                {t('attendance.empty')}
              </Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function HeroStat({
  label,
  value,
  tint,
}: {
  label: string;
  value: number | string;
  tint: string;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', width: 180, height: 180, borderRadius: 90 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
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
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  statBox: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  gridCard: {
    borderRadius: 22,
    padding: 14,
  },
});