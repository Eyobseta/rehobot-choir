import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { PendingMemory } from '../../services/memories';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import { formatEthDate } from '../../utils/ethiopianCalendar';
import { DatePill, EmptyState, memoryToEthDate } from './Memorykit';
import GlassBackButton from '../../components/GlassBackButton';
import { useLeaderPendingMemoriesQuery } from '../leader/useLeaderSongsAndMemories';

export default function LeaderMemoriesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const insets = useSafeAreaInsets();

  const q = useLeaderPendingMemoriesQuery();
  const items = q.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;
  const error =
    (q.error as { message?: string } | null)?.message ?? null;

  if (firstLoad) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={BRAND.violet} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
            <Ionicons name="shield-checkmark" size={22} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroKicker}>
              {t('tabs.memories', { defaultValue: 'Memories' })}
            </Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {t('memories.reviewTitle', { defaultValue: 'Memory review' })}
            </Text>
          </View>
          <GlassBackButton onPress={() => navigation.goBack()} accessibilityLabel={t('common.back', { defaultValue: 'Back' })} size={44} />
        </View>

        <Text style={styles.heroSubtitle}>
          {t('memories.pendingCount', {
            count: items.length,
            defaultValue: '{{count}} waiting for review',
          })}
        </Text>
      </LinearGradient>

      {showingSavedData && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: withAlpha('#F59E0B', 0.14), borderWidth: 1, borderColor: withAlpha('#F59E0B', 0.4) }}>
            <Ionicons name="cloud-offline" size={13} color="#F59E0B" />
            <Text style={[theme.typography.caption, { color: '#F59E0B', fontWeight: '800' }]}>
              {t('home.showingSavedData', { defaultValue: 'Showing saved data' })}
            </Text>
          </View>
        </View>
      )}

      {error && q.data === undefined && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: 14, backgroundColor: withAlpha(colors.error, 0.1), borderWidth: 1, borderColor: withAlpha(colors.error, 0.35) }}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={[theme.typography.bodySmall, { color: colors.error, flex: 1 }]}>{error}</Text>
          </View>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl * 2 }}
        refreshControl={
          <RefreshControl refreshing={q.isRefetching && !firstLoad} onRefresh={() => q.refetch()} tintColor={BRAND.violet} colors={[BRAND.violet]} />
        }
        ListEmptyComponent={<EmptyState icon="checkmark-done-outline" text={t('memories.emptyReview')} />}
        renderItem={({ item, index }) => (
          <ReviewCard item={item} index={index} onPress={() => navigation.navigate('MemoryReviewDetail', { id: item.id })} />
        )}
      />
    </View>
  );
}

function ReviewCard({ item, index, onPress }: { item: PendingMemory; index: number; onPress: () => void }) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const submitter = item.submittedBy.memberProfile?.fullName ?? '';
  const initial = submitter.trim().charAt(0).toUpperCase();
  const thumb = item.media?.find((m) => m.type === 'PHOTO')?.storageUrl;

  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.timing(enter, { toValue: 1, duration: 420, delay: Math.min(index, 8) * 60, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [enter, index]);
  const to = (v: number) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={{
        marginBottom: spacing.sm + 4,
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
          { scale },
        ],
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
        <View style={[styles.bar, { backgroundColor: '#F59E0B' }]} />

        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} />
        ) : (
          <LinearGradient colors={[BRAND.violet, BRAND.magenta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumb}>
            <Ionicons name="images" size={26} color="rgba(255,255,255,0.7)" />
          </LinearGradient>
        )}

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[typography.body, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
            <DatePill text={formatEthDate(memoryToEthDate(item), 'en')} />
          </View>
          {submitter ? (
            <View style={styles.byRow}>
              <View style={styles.avatar}>
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>{initial}</Text>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>
                {submitter}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.go, { backgroundColor: withAlpha(BRAND.violet, 0.14) }]}>
          <Ionicons name="chevron-forward" size={18} color={BRAND.violet} />
        </View>
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
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 2 },
  heroSubtitle: { marginTop: 12, color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingLeft: 17, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  thumb: { width: 70, height: 70, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  byRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  avatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: BRAND.magenta, alignItems: 'center', justifyContent: 'center' },
  go: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});