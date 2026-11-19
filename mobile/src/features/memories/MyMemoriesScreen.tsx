import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { listMyMemories, MyMemoryRow } from '../../services/memories';
import { ApiError } from '../../services/api';
import { ErrorBanner, BRAND, withAlpha } from '../auth/Auth_UI';
import { StatusPill, DatePill, EmptyState, MemoryHero, RowSkeleton, memoryToEthDate } from './Memorykit';
import { formatEthDate } from '../../utils/ethiopianCalendar';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Status = MyMemoryRow['status'];

export default function MyMemoriesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;

  const [items, setItems] = useState<MyMemoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await listMyMemories());
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload every time the screen is focused (e.g. after submitting a memory).
  // The skeleton only shows on the very first load; later focuses refresh silently.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const statusColor = (s: Status) => {
    switch (s) {
      case 'PUBLISHED': return colors.success;
      case 'PENDING_REVIEW': return colors.warning;
      case 'REJECTED': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const statusIcon = (s: Status): IconName => {
    switch (s) {
      case 'PUBLISHED': return 'checkmark-circle';
      case 'PENDING_REVIEW': return 'time';
      case 'REJECTED': return 'close-circle';
      default: return 'ellipse';
    }
  };

  const statusLabel = (s: Status) => {
    switch (s) {
      case 'PUBLISHED': return t('memories.statusPublished');
      case 'PENDING_REVIEW': return t('memories.statusPending');
      case 'REJECTED': return t('memories.statusRejected');
      default: return s;
    }
  };

  const openDetail = (item: MyMemoryRow) => {
    navigation.navigate('MemoryDetail', { id: item.id, mineOnly: true });
  };

  const published = items.filter((i) => i.status === 'PUBLISHED').length;
  const pending = items.filter((i) => i.status === 'PENDING_REVIEW').length;
  const rejected = items.filter((i) => i.status === 'REJECTED').length;

  const visible = filter ? items.filter((i) => i.status === filter) : items;
  const toggle = (s: Status) => setFilter((prev) => (prev === s ? null : s));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={loading ? [] : visible}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl * 2, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={colors.primary}
            colors={[BRAND.teal]}
          />
        }
        ListHeaderComponent={
          <View>
            <MemoryHero
              icon="albums"
              overline={t('memories.mine')}
              title={t('memories.myCount', { count: items.length, defaultValue: '{{count}} memories shared' })}
              titleSize={18}
              onBack={() => navigation.goBack()}
            >
              <View style={styles.summary}>
                <SummaryTile icon="checkmark-circle" value={published} label={t('memories.statusPublished')} active={filter === 'PUBLISHED'} onPress={() => toggle('PUBLISHED')} />
                <SummaryTile icon="time" value={pending} label={t('memories.statusPending')} active={filter === 'PENDING_REVIEW'} onPress={() => toggle('PENDING_REVIEW')} />
                <SummaryTile icon="close-circle" value={rejected} label={t('memories.statusRejected')} active={filter === 'REJECTED'} onPress={() => toggle('REJECTED')} />
              </View>
            </MemoryHero>

            {error && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
                <ErrorBanner message={error} />
              </View>
            )}

            {loading ? <RowSkeleton rows={4} /> : <View style={{ height: spacing.md }} />}
          </View>
        }
        ListEmptyComponent={
          loading ? null : filter ? (
            <EmptyState
              icon="funnel-outline"
              text={t('memories.noneInFilter', { defaultValue: 'Nothing here yet.' })}
              actionLabel={t('memories.clearFilters', { defaultValue: 'Clear filters' })}
              onAction={() => setFilter(null)}
            />
          ) : (
            <EmptyState
              icon="albums-outline"
              text={t('memories.emptyMine')}
              actionLabel={t('memories.submit')}
              onAction={() => navigation.navigate('SubmitMemory')}
            />
          )
        }
        renderItem={({ item, index }) => (
          <MyMemoryCard
            item={item}
            index={index}
            tone={statusColor(item.status)}
            icon={statusIcon(item.status)}
            label={statusLabel(item.status)}
            reasonLabel={t('memories.rejectionReason')}
            onPress={() => openDetail(item)}
          />
        )}
      />
    </View>
  );
}

function SummaryTile({
  icon,
  value,
  label,
  active,
  onPress,
}: {
  icon: IconName;
  value: number;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.summaryTile,
        {
          backgroundColor: active ? BRAND.lime : BRAND.tealDark,
          borderColor: active ? BRAND.lime : 'rgba(255,255,255,0.18)',
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <Ionicons name={icon} size={16} color={active ? BRAND.deep : BRAND.lime} />
      <Text style={[styles.summaryValue, { color: active ? BRAND.deep : '#FFFFFF' }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: active ? BRAND.deep : 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function MyMemoryCard({
  item, index, tone, icon, label, reasonLabel, onPress,
}: {
  item: MyMemoryRow;
  index: number;
  tone: string;
  icon: IconName;
  label: string;
  reasonLabel: string;
  onPress: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [enter, index]);

  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
          { scale },
        ],
        marginHorizontal: spacing.lg,
        marginBottom: spacing.sm + 4,
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.98)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={[styles.bar, { backgroundColor: tone }]} />

        <View style={{ flex: 1 }}>
          <View style={styles.topRow}>
            <Text style={[typography.body, { color: colors.text, fontWeight: '800', flex: 1 }]} numberOfLines={1}>{item.title}</Text>
            <StatusPill label={label} color={tone} icon={icon} />
          </View>

          <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
            <DatePill text={formatEthDate(memoryToEthDate(item), lang)} />
          </View>

          {item.status === 'REJECTED' && item.rejectionReason && (
            <View style={[styles.reason, { backgroundColor: withAlpha(colors.error, 0.1), borderLeftColor: colors.error }]}>
              <Text style={[typography.caption, { color: colors.error, fontWeight: '800' }]}>{reasonLabel}</Text>
              <Text style={[typography.bodySmall, { color: colors.text, marginTop: 3 }]}>{item.rejectionReason}</Text>
            </View>
          )}

          <View style={[styles.hintRow, { borderTopColor: colors.border }]}>
            <Ionicons name="eye-outline" size={13} color={colors.textSecondary} />
            <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700', marginLeft: 4, flex: 1 }]} numberOfLines={1}>
              {t('memories.tapToView', { defaultValue: 'Tap to view' })}
            </Text>
            <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: BRAND.teal, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-forward" size={13} color={BRAND.lime} />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: 10 },
  summaryTile: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 18, borderWidth: 1, minHeight: 44 },
  summaryValue: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  summaryLabel: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  card: { flexDirection: 'row', padding: 14, paddingLeft: 18, borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reason: { marginTop: 12, padding: 12, borderRadius: 12, borderLeftWidth: 4 },
  hintRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
});