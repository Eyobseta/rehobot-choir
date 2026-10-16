import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import {
  leaderListPendingMemories,
  PendingMemory,
} from '../../services/memories';
import { ApiError } from '../../services/api';
import { ErrorBanner, BRAND, withAlpha } from '../auth/Auth_UI';
import { HeroBanner, DatePill, EmptyState } from './Memorykit';

export default function LeaderMemoriesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;

  const [items, setItems] = useState<PendingMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await leaderListPendingMemories());
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl * 2 }}
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
              icon="shield-checkmark"
              title={t('memories.reviewTitle')}
              subtitle={t('memories.pendingCount', {
                count: items.length,
                defaultValue: '{{count}} waiting for review',
              })}
            />
            {error && (
              <View style={{ marginTop: spacing.md }}>
                <ErrorBanner message={error} />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={<EmptyState icon="checkmark-done-outline" text={t('memories.emptyReview')} />}
        renderItem={({ item, index }) => (
          <ReviewCard
            item={item}
            index={index}
            onPress={() => navigation.navigate('MemoryReviewDetail', { id: item.id })}
          />
        )}
      />
    </View>
  );
}

// ---------- Card (module scope) ----------

function ReviewCard({
  item,
  index,
  onPress,
}: {
  item: PendingMemory;
  index: number;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const submitter = item.submittedBy.memberProfile?.fullName ?? '';
  const initial = submitter.trim().charAt(0).toUpperCase();
  const thumb = item.media?.find((m) => m.type === 'PHOTO')?.storageUrl;

  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 60,
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
          <LinearGradient
            colors={[BRAND.violet, BRAND.magenta]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.thumb}
          >
            <Ionicons name="images" size={26} color="rgba(255,255,255,0.7)" />
          </LinearGradient>
        )}

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[typography.body, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
            <DatePill text={new Date(item.date).toISOString().slice(0, 10)} />
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingLeft: 17,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  thumb: { width: 70, height: 70, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  byRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BRAND.magenta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  go: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});