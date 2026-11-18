import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Animated,
  Easing,
  AppState,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../theme/ThemeContext';
import { zemaListMySubmissions, MySubmission, SubmissionStatus } from '../../services/songs';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';
import { BRAND, withAlpha, ErrorBanner } from '../auth/Auth_UI';
import {
  AMBER,
  EmptyState,
  IconName,
  ListSkeleton,
  PALETTES,
  SavedPill,
  ScreenHero,
} from './Songs_Kit';

type Bucket = 'DRAFT' | 'PENDING_REVIEW' | 'RETURNED' | 'APPROVED';
type Filter = 'ALL' | Bucket;

const bucketOf = (s: SubmissionStatus): Bucket =>
  s === 'APPROVED' ? 'APPROVED' : s === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : s === 'RETURNED' ? 'RETURNED' : 'DRAFT';

export default function ZemaSubmissionsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const userId = useMe()?.id ?? null;

  const [filter, setFilter] = useState<Filter>('ALL');

  const q = useQuery({
    queryKey: [...queryKeys.songsList(userId), 'zema-submissions'],
    queryFn: zemaListMySubmissions,
    // A submission's status is changed by a LEADER on another phone, so this
    // list can never be trusted as "fresh". Always re-check when it is shown.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
    // While anything is waiting for review, quietly re-check every 30 s.
    refetchInterval: (query) =>
      query.state.data?.some((s) => s.status === 'PENDING_REVIEW') ? 30_000 : false,
  });

  // Re-check whenever the screen comes into view (back from the editor, tab switch)...
  const { refetch } = q;
  useFocusEffect(
    useCallback(() => {
      void refetch({ cancelRefetch: false });
    }, [refetch]),
  );
  // ...and whenever the app returns from the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refetch({ cancelRefetch: false });
    });
    return () => sub.remove();
  }, [refetch]);

  const items = q.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  const statusTint = (s: SubmissionStatus) =>
    s === 'APPROVED'
      ? colors.success
      : s === 'PENDING_REVIEW'
        ? colors.primary
        : s === 'RETURNED'
          ? AMBER
          : colors.textSecondary;
  const statusIcon = (s: SubmissionStatus): IconName =>
    s === 'APPROVED'
      ? 'checkmark-circle'
      : s === 'PENDING_REVIEW'
        ? 'time'
        : s === 'RETURNED'
          ? 'return-down-back'
          : 'document-text';
  const statusLabel = (s: SubmissionStatus) =>
    s === 'APPROVED'
      ? t('zema.statusApproved')
      : s === 'PENDING_REVIEW'
        ? t('zema.statusPending')
        : s === 'RETURNED'
          ? t('zema.statusReturned')
          : t('zema.statusDraft');

  // counts per bucket (UI-only filter)
  const counts: Record<Bucket, number> = { DRAFT: 0, PENDING_REVIEW: 0, RETURNED: 0, APPROVED: 0 };
  items.forEach((s) => (counts[bucketOf(s.status)] += 1));
  const visible = filter === 'ALL' ? items : items.filter((s) => bucketOf(s.status) === filter);

  // if the active filter becomes empty (e.g. after a refresh), fall back to All
  useEffect(() => {
    if (filter !== 'ALL' && counts[filter] === 0) setFilter('ALL');
  }, [filter, counts.DRAFT, counts.PENDING_REVIEW, counts.RETURNED, counts.APPROVED]); // eslint-disable-line react-hooks/exhaustive-deps

  const chips: { key: Filter; label: string; icon: IconName; tint: string; count: number }[] = [
    { key: 'ALL', label: t('zema.filterAll', { defaultValue: 'All' }), icon: 'albums', tint: colors.primary, count: items.length },
    { key: 'DRAFT', label: t('zema.statusDraft'), icon: 'document-text', tint: colors.textSecondary, count: counts.DRAFT },
    { key: 'PENDING_REVIEW', label: t('zema.statusPending'), icon: 'time', tint: colors.primary, count: counts.PENDING_REVIEW },
    { key: 'RETURNED', label: t('zema.statusReturned'), icon: 'return-down-back', tint: AMBER, count: counts.RETURNED },
    { key: 'APPROVED', label: t('zema.statusApproved'), icon: 'checkmark-circle', tint: colors.success, count: counts.APPROVED },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHero
        icon="musical-note"
        overline={t('leaderSongs.zemaTeam')}
        title={t('zema.team')}
        onBack={() => navigation.goBack()}
      >
        <Pressable
          onPress={() => navigation.navigate('ZemaEditor', { id: null })}
          accessibilityRole="button"
          style={{
            marginTop: 18,
            borderRadius: 18,
            overflow: 'hidden',
            shadowColor: BRAND.gold,
            shadowOpacity: 0.4,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          }}
        >
          <View style={{ backgroundColor: BRAND.lime, 
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 14,
              borderRadius: 18,
            }}>
            <Ionicons name="add-circle" size={21} color={BRAND.deep} />
            <Text style={{ color: BRAND.deep, fontWeight: '800', fontSize: 14 }}>
              {t('zema.newSubmission')}
            </Text>
          </View>
        </Pressable>
      </ScreenHero>

      {/* status filters */}
      {!firstLoad && items.length > 0 && (
        <View style={{ paddingTop: spacing.md }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}
          >
            {chips
              .filter((c) => c.key === 'ALL' || c.count > 0)
              .map((c) => {
                const active = filter === c.key;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setFilter(c.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 13,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1.5,
                      borderColor: active ? c.tint : colors.border,
                      backgroundColor: active ? withAlpha(c.tint, 0.14) : colors.surface,
                    }}
                  >
                    <Ionicons name={c.icon} size={14} color={c.tint} />
                    <Text
                      style={{
                        color: active ? c.tint : colors.text,
                        fontSize: 12.5,
                        fontWeight: '800',
                      }}
                    >
                      {c.label}
                    </Text>
                    <View
                      style={{
                        minWidth: 20,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 10,
                        backgroundColor: active ? c.tint : withAlpha(colors.textSecondary, 0.16),
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: active ? '#FFFFFF' : colors.textSecondary,
                          fontSize: 11,
                          fontWeight: '800',
                        }}
                      >
                        {c.count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
          </ScrollView>
        </View>
      )}

      {showingSavedData && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <SavedPill />
        </View>
      )}

      {q.isError && q.data === undefined && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <ErrorBanner message={(q.error as any)?.message ?? 'Error'} />
        </View>
      )}

      <FlatList
        data={firstLoad ? [] : visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xl,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !firstLoad}
            onRefresh={() => q.refetch()}
            tintColor={colors.primary}
            colors={[BRAND.teal]}
          />
        }
        ListEmptyComponent={
          firstLoad ? (
            <ListSkeleton rows={4} />
          ) : (
            <EmptyState icon="musical-notes-outline" text={t('zema.empty')} />
          )
        }
        renderItem={({ item, index }) => (
          <SubmissionCard
            item={item}
            index={index}
            palette={PALETTES[index % PALETTES.length]}
            tint={statusTint(item.status)}
            icon={statusIcon(item.status)}
            label={statusLabel(item.status)}
            returnReasonLabel={t('zema.returnReason')}
            onPress={() => navigation.navigate('ZemaEditor', { id: item.id })}
          />
        )}
      />
    </View>
  );
}

function SubmissionCard({
  item,
  index,
  palette,
  tint,
  icon,
  label,
  returnReasonLabel,
  onPress,
}: {
  item: MySubmission;
  index: number;
  palette: readonly [string, string];
  tint: string;
  icon: IconName;
  label: string;
  returnReasonLabel: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const returned = item.status === 'RETURNED';

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
        accessibilityLabel={item.song.title}
        style={{
          padding: 14,
          paddingLeft: 18,
          borderRadius: 22,
          borderWidth: returned ? 1.5 : 1,
          borderColor: returned ? withAlpha(AMBER, 0.6) : colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        }}
      >
        <View style={{ backgroundColor: returned ? AMBER : palette[0],  position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 15,
              backgroundColor: withAlpha(tint, 0.14),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={icon} size={22} color={tint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[typography.body, { color: colors.text, fontWeight: '800' }]}
              numberOfLines={1}
            >
              {item.song.title}
            </Text>
            {item.song.category && (
              <Text
                style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
                numberOfLines={1}
              >
                {item.song.category.name}
              </Text>
            )}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                alignSelf: 'flex-start',
                marginTop: 6,
                paddingHorizontal: 9,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: withAlpha(tint, 0.14),
              }}
            >
              <Text style={{ color: tint, fontSize: 11, fontWeight: '800' }}>{label}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </View>

        {returned && item.returnReason && (
          <View
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              borderLeftWidth: 4,
              borderLeftColor: AMBER,
              backgroundColor: withAlpha(AMBER, 0.1),
            }}
          >
            <Text style={[typography.caption, { color: '#A7611B', fontWeight: '800' }]}>
              {returnReasonLabel}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.text, marginTop: 3 }]}>
              {item.returnReason}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}