import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { listMyMemories, MyMemoryRow } from '../../services/memories';
import { ApiError } from '../../services/api';
import { ErrorBanner, BRAND, withAlpha } from '../auth/Auth_UI';
import { HeroBanner, StatusPill, DatePill, EmptyState } from './Memorykit';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const PENDING_COLOR = '#F59E0B';

export default function MyMemoriesScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const [items, setItems] = useState<MyMemoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const statusColor = (s: MyMemoryRow['status']) => {
    switch (s) {
      case 'PUBLISHED':
        return colors.success;
      case 'PENDING_REVIEW':
        return PENDING_COLOR;
      case 'REJECTED':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const statusIcon = (s: MyMemoryRow['status']): IconName => {
    switch (s) {
      case 'PUBLISHED':
        return 'checkmark-circle';
      case 'PENDING_REVIEW':
        return 'time';
      case 'REJECTED':
        return 'close-circle';
      default:
        return 'ellipse';
    }
  };

  const statusLabel = (s: MyMemoryRow['status']) => {
    switch (s) {
      case 'PUBLISHED':
        return t('memories.statusPublished');
      case 'PENDING_REVIEW':
        return t('memories.statusPending');
      case 'REJECTED':
        return t('memories.statusRejected');
      default:
        return s;
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={BRAND.violet} />
      </View>
    );
  }

  const published = items.filter((i) => i.status === 'PUBLISHED').length;
  const pending = items.filter((i) => i.status === 'PENDING_REVIEW').length;
  const rejected = items.filter((i) => i.status === 'REJECTED').length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={BRAND.violet}
            colors={[BRAND.violet]}
          />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg }}>
            <HeroBanner
              icon="albums"
              title={t('memories.mine')}
              subtitle={t('memories.myCount', { count: items.length, defaultValue: '{{count}} memories shared' })}
            >
              {/* status summary */}
              <View style={styles.summary}>
                <SummaryTile icon="checkmark-circle" value={published} label={t('memories.statusPublished')} />
                <SummaryTile icon="time" value={pending} label={t('memories.statusPending')} />
                <SummaryTile icon="close-circle" value={rejected} label={t('memories.statusRejected')} />
              </View>
            </HeroBanner>

            {error && (
              <View style={{ marginTop: spacing.md }}>
                <ErrorBanner message={error} />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={<EmptyState icon="albums-outline" text={t('memories.emptyMine')} />}
        renderItem={({ item, index }) => (
          <MyMemoryCard
            item={item}
            index={index}
            tone={statusColor(item.status)}
            icon={statusIcon(item.status)}
            label={statusLabel(item.status)}
            reasonLabel={t('memories.rejectionReason')}
          />
        )}
      />
    </View>
  );
}

// ---------- Helpers (module scope) ----------

function SummaryTile({ icon, value, label }: { icon: IconName; value: number; label: string }) {
  return (
    <View style={styles.summaryTile}>
      <Ionicons name={icon} size={16} color={BRAND.gold} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function MyMemoryCard({
  item,
  index,
  tone,
  icon,
  label,
  reasonLabel,
}: {
  item: MyMemoryRow;
  index: number;
  tone: string;
  icon: IconName;
  label: string;
  reasonLabel: string;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const enter = useRef(new Animated.Value(0)).current;
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

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
        marginBottom: spacing.sm + 4,
      }}
    >
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.bar, { backgroundColor: tone }]} />

        <View style={{ flex: 1 }}>
          <View style={styles.topRow}>
            <Text style={[typography.body, { color: colors.text, fontWeight: '800', flex: 1 }]} numberOfLines={1}>
              {item.title}
            </Text>
            <StatusPill label={label} color={tone} icon={icon} />
          </View>

          <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
            <DatePill text={new Date(item.date).toISOString().slice(0, 10)} />
          </View>

          {item.status === 'REJECTED' && item.rejectionReason && (
            <View
              style={[
                styles.reason,
                { backgroundColor: withAlpha(colors.error, 0.1), borderLeftColor: colors.error },
              ]}
            >
              <Text style={[typography.caption, { color: colors.error, fontWeight: '800' }]}>
                {reasonLabel}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.text, marginTop: 3 }]}>
                {item.rejectionReason}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: 10, marginTop: 18 },
  summaryTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  summaryValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 },
  summaryLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700', marginTop: 1 },
  card: {
    flexDirection: 'row',
    padding: 14,
    paddingLeft: 18,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reason: { marginTop: 12, padding: 12, borderRadius: 12, borderLeftWidth: 4 },
});