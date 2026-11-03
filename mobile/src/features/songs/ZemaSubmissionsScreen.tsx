import React, { useRef } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../theme/ThemeContext';
import { zemaListMySubmissions, MySubmission, SubmissionStatus } from '../../services/songs';
import { queryKeys } from '../../services/queryKeys';
import { useMe } from '../chat/chatSession';
import { BRAND, withAlpha, ErrorBanner } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';

const PALETTES: readonly [string, string][] = [
  [BRAND.violet, BRAND.magenta],
  [BRAND.water, BRAND.violet],
  [BRAND.magenta, '#F59E0B'],
  [BRAND.deep, BRAND.violet],
];

export default function ZemaSubmissionsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();
  const userId = useMe()?.id ?? null;

  const q = useQuery({
    queryKey: [...queryKeys.songsList(userId), 'zema-submissions'],
    queryFn: zemaListMySubmissions,
  });

  const items = q.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  const statusTint = (s: SubmissionStatus) =>
    s === 'APPROVED' ? colors.success : s === 'PENDING_REVIEW' ? BRAND.violet : s === 'RETURNED' ? '#F59E0B' : colors.textSecondary;
  const statusIcon = (s: SubmissionStatus): React.ComponentProps<typeof Ionicons>['name'] =>
    s === 'APPROVED' ? 'checkmark-circle' : s === 'PENDING_REVIEW' ? 'time' : s === 'RETURNED' ? 'return-down-back' : 'document-text';
  const statusLabel = (s: SubmissionStatus) =>
    s === 'APPROVED' ? t('zema.statusApproved') : s === 'PENDING_REVIEW' ? t('zema.statusPending') : s === 'RETURNED' ? t('zema.statusReturned') : t('zema.statusDraft');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient colors={[BRAND.deep, BRAND.violet, BRAND.magenta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: withAlpha(BRAND.gold, 0.22) }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: BRAND.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="musical-note" size={22} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>{t('leaderSongs.zemaTeam')}</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>{t('zema.team')}</Text>
          </View>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>

        <Pressable onPress={() => navigation.navigate('ZemaEditor', { id: null })}
          style={{ marginTop: 18, borderRadius: 18, overflow: 'hidden', shadowColor: BRAND.gold, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 }}>
          <LinearGradient colors={[BRAND.gold, '#FFA94D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 18 }}>
            <Ionicons name="add-circle" size={20} color={BRAND.deep} />
            <Text style={{ color: BRAND.deep, fontWeight: '800', fontSize: 14 }}>{t('zema.newSubmission')}</Text>
          </LinearGradient>
        </Pressable>
      </LinearGradient>

      {showingSavedData && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: withAlpha('#F59E0B', 0.14), borderWidth: 1, borderColor: withAlpha('#F59E0B', 0.4) }}>
            <Ionicons name="cloud-offline" size={13} color="#F59E0B" />
            <Text style={[typography.caption, { color: '#F59E0B', fontWeight: '800' }]}>{t('home.showingSavedData', { defaultValue: 'Showing saved data' })}</Text>
          </View>
        </View>
      )}

      {q.isError && q.data === undefined && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <ErrorBanner message={(q.error as any)?.message ?? 'Error'} />
        </View>
      )}

      {firstLoad ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={BRAND.violet} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={q.isRefetching && !firstLoad} onRefresh={() => q.refetch()} tintColor={BRAND.violet} colors={[BRAND.violet]} />}
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <LinearGradient colors={[BRAND.violet, BRAND.magenta, BRAND.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="musical-notes-outline" size={40} color={colors.textSecondary} />
                </View>
              </LinearGradient>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>{t('zema.empty')}</Text>
            </View>
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
      )}
    </View>
  );
}

function SubmissionCard({ item, index, palette, tint, icon, label, returnReasonLabel, onPress }: {
  item: MySubmission; index: number; palette: readonly [string, string]; tint: string;
  icon: React.ComponentProps<typeof Ionicons>['name']; label: string; returnReasonLabel: string; onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    const a = Animated.timing(enter, { toValue: 1, duration: 420, delay: Math.min(index, 8) * 55, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [enter, index]);
  const to = (v: number) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ marginBottom: spacing.sm + 4, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }, { scale }] }}>
      <Pressable onPress={onPress} onPressIn={() => to(0.98)} onPressOut={() => to(1)}
        style={{ padding: 14, paddingLeft: 18, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.body, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>{item.song.title}</Text>
            {item.song.category && (
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>{item.song.category.name}</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: withAlpha(tint, 0.14) }}>
            <Ionicons name={icon} size={13} color={tint} />
            <Text style={{ color: tint, fontSize: 11, fontWeight: '800' }}>{label}</Text>
          </View>
        </View>
        {item.status === 'RETURNED' && item.returnReason && (
          <View style={{ marginTop: 12, padding: 12, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#F59E0B', backgroundColor: withAlpha('#F59E0B', 0.1) }}>
            <Text style={[typography.caption, { color: '#B45309', fontWeight: '800' }]}>{returnReasonLabel}</Text>
            <Text style={[typography.bodySmall, { color: colors.text, marginTop: 3 }]}>{item.returnReason}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}