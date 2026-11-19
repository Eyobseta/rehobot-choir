import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  RefreshControl,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { PendingMemory } from '../../services/memories';
import { BRAND, ErrorBanner } from '../auth/Auth_UI';
import { formatEthDate } from '../../utils/ethiopianCalendar';
import {
  DatePill,
  EmptyState,
  SavedPill,
  RowSkeleton,
  MemoryHero,
  Avatar,
  PALETTES,
  memoryToEthDate,
} from './Memorykit';
import { useLeaderPendingMemoriesQuery } from '../leader/useLeaderSongsAndMemories';

export default function LeaderMemoriesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;

  const q = useLeaderPendingMemoriesQuery();
  const items = q.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;
  const error = (q.error as { message?: string } | null)?.message ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={firstLoad ? [] : items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl * 2, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !firstLoad}
            onRefresh={() => q.refetch()}
            tintColor={colors.primary}
            colors={[BRAND.teal]}
          />
        }
        ListHeaderComponent={
          <View>
            <MemoryHero
              icon="shield-checkmark"
              overline={t('tabs.memories', { defaultValue: 'Memories' })}
              title={t('memories.reviewTitle', { defaultValue: 'Memory review' })}
              onBack={() => navigation.goBack()}
            >
              {!firstLoad && (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: BRAND.tealDark,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.18)',
                  }}
                >
                  <Ionicons name="time" size={14} color={BRAND.lime} />
                  <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>
                    {t('memories.pendingCount', {
                      count: items.length,
                      defaultValue: '{{count}} waiting for review',
                    })}
                  </Text>
                </View>
              )}
            </MemoryHero>

            {showingSavedData && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
                <SavedPill />
              </View>
            )}

            {error && q.data === undefined && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
                <ErrorBanner message={error} />
              </View>
            )}

            {firstLoad ? <RowSkeleton rows={4} /> : <View style={{ height: spacing.md }} />}
          </View>
        }
        ListEmptyComponent={
          firstLoad ? null : <EmptyState icon="checkmark-done-outline" text={t('memories.emptyReview')} />
        }
        renderItem={({ item, index }) => (
          <ReviewCard item={item} index={index} onPress={() => navigation.navigate('MemoryReviewDetail', { id: item.id })} />
        )}
      />
    </View>
  );
}

function ReviewCard({ item, index, onPress }: { item: PendingMemory; index: number; onPress: () => void; }) {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const { colors, spacing, typography } = theme;

  const submitter = item.submittedBy.memberProfile?.fullName ?? '';
  const thumb = item.media?.find((m) => m.type === 'PHOTO')?.storageUrl;
  const palette = PALETTES[index % PALETTES.length];

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
        marginHorizontal: spacing.lg,
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
        <View style={[styles.bar, { backgroundColor: colors.warning }]} />

        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} />
        ) : (
          <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumb}>
            <Ionicons name="images" size={26} color="rgba(255,255,255,0.7)" />
          </LinearGradient>
        )}

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[typography.body, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
            <DatePill text={formatEthDate(memoryToEthDate(item), lang)} />
          </View>
          {submitter ? (
            <View style={styles.byRow}>
              <Avatar name={submitter} size={20} />
              <Text style={[typography.caption, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>
                {submitter}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.go, { backgroundColor: BRAND.teal }]}>
          <Ionicons name="arrow-forward" size={16} color={BRAND.lime} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingLeft: 17, borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  thumb: { width: 70, height: 70, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  byRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  go: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});