import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { listMyMemories, MyMemoryRow } from '../../services/memories';
import { ApiError } from '../../services/api';
import { ErrorBanner, BRAND, withAlpha } from '../auth/Auth_UI';
import { StatusPill, DatePill, EmptyState, memoryToEthDate } from './Memorykit';
import { formatEthDate } from '../../utils/ethiopianCalendar';
import GlassBackButton from '../../components/GlassBackButton';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const PENDING_COLOR = '#F59E0B';

export default function MyMemoriesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const insets = useSafeAreaInsets();

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
      case 'PUBLISHED': return colors.success;
      case 'PENDING_REVIEW': return PENDING_COLOR;
      case 'REJECTED': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const statusIcon = (s: MyMemoryRow['status']): IconName => {
    switch (s) {
      case 'PUBLISHED': return 'checkmark-circle';
      case 'PENDING_REVIEW': return 'time';
      case 'REJECTED': return 'close-circle';
      default: return 'ellipse';
    }
  };

  const statusLabel = (s: MyMemoryRow['status']) => {
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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
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
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={BRAND.violet} colors={[BRAND.violet]} />
        }
        ListHeaderComponent={
          <View>
            <LinearGradient
              colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.hero, { paddingTop: insets.top + 16 }]}
            >
              <View pointerEvents="none" style={[styles.blob, { top: -60, right: -40, backgroundColor: withAlpha(BRAND.gold, 0.22) }]} />
              <View pointerEvents="none" style={[styles.blob, { bottom: -80, left: -50, backgroundColor: withAlpha(BRAND.water, 0.22) }]} />

              <View style={styles.heroRow}>
                <View style={styles.heroIcon}>
                  <Ionicons name="albums" size={22} color={BRAND.deep} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroKicker}>{t('memories.mine')}</Text>
                  <Text style={styles.heroTitle} numberOfLines={1}>
                    {t('memories.myCount', { count: items.length, defaultValue: '{{count}} memories shared' })}
                  </Text>
                </View>

                <GlassBackButton onPress={() => navigation.goBack()} accessibilityLabel={t('common.back', { defaultValue: 'Back' })} size={44} />
              </View>

              <View style={styles.summary}>
                <SummaryTile icon="checkmark-circle" value={published} label={t('memories.statusPublished')} />
                <SummaryTile icon="time" value={pending} label={t('memories.statusPending')} />
                <SummaryTile icon="close-circle" value={rejected} label={t('memories.statusRejected')} />
              </View>
            </LinearGradient>

            {error && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
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
            onPress={() => openDetail(item)}
          />
        )}
      />
    </View>
  );
}

function SummaryTile({ icon, value, label }: { icon: IconName; value: number; label: string }) {
  return (
    <View style={styles.summaryTile}>
      <Ionicons name={icon} size={16} color={BRAND.gold} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel} numberOfLines={1}>{label}</Text>
    </View>
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

        <Pressable onPress={onPress} style={{ flex: 1 }}>
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

            <View style={styles.hintRow}>
              <Ionicons name="eye-outline" size={13} color={colors.textSecondary} />
              <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700', marginLeft: 4, flex: 1 }]} numberOfLines={1}>
                {t('memories.tapToView', { defaultValue: 'Tap to view' })}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  blob: { position: 'absolute', width: 180, height: 180, borderRadius: 90 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: BRAND.gold, alignItems: 'center', justifyContent: 'center' },
  heroKicker: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 2 },
  summary: { flexDirection: 'row', gap: 10, marginTop: 18 },
  summaryTile: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)' },
  summaryValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 },
  summaryLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700', marginTop: 1 },
  card: { flexDirection: 'row', padding: 14, paddingLeft: 18, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reason: { marginTop: 12, padding: 12, borderRadius: 12, borderLeftWidth: 4 },
  hintRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(120,120,140,0.22)' },
});