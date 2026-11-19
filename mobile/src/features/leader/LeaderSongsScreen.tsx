import React, { useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { LeaderSongRow } from '../../services/songs';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { useLeaderSongsQuery } from './useLeaderSongsAndMemories';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const PALETTES: readonly [string, string][] = [
  [BRAND.tealDark, '#2B6B7A'],
  ['#2B6B7A', BRAND.teal],
  ['#3B2F6B', '#7B5FC7'],
  [BRAND.teal, '#2E9E5B'],
];

export default function LeaderSongsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  const q = useLeaderSongsQuery();
  const items = q.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;
  const error =
    (q.error as { message?: string; code?: string } | null)?.message ?? null;

  const statusTint = (s: LeaderSongRow['status']) => {
    switch (s) {
      case 'PUBLISHED':
        return colors.success;
      case 'RETURNED':
        return '#E8A65D';
      case 'PENDING_REVIEW':
        return colors.accent;
      case 'UNPUBLISHED':
      default:
        return colors.textSecondary;
    }
  };

  const statusIcon = (s: LeaderSongRow['status']): IconName => {
    switch (s) {
      case 'PUBLISHED':
        return 'checkmark-circle';
      case 'PENDING_REVIEW':
        return 'time';
      case 'RETURNED':
        return 'return-down-back';
      case 'UNPUBLISHED':
        return 'cloud-offline';
      default:
        return 'document-text';
    }
  };

  const statusLabel = (s: LeaderSongRow['status']) => {
    switch (s) {
      case 'PUBLISHED':
        return t('leaderSongs.statusPublished');
      case 'PENDING_REVIEW':
        return t('leaderSongs.statusPending');
      case 'RETURNED':
        return t('leaderSongs.statusReturned');
      case 'UNPUBLISHED':
        return t('leaderSongs.statusUnpublished');
      case 'DRAFT':
      default:
        return t('leaderSongs.statusDraft');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
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
            <LinearGradient
              colors={[BRAND.teal, BRAND.teal]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                paddingHorizontal: 16,
                paddingTop: insets.top + 16,
                paddingBottom: 22,
                borderBottomLeftRadius: 28,
                borderBottomRightRadius: 28,
                overflow: 'hidden',
              }}
            >
              <View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: withAlpha(BRAND.lime, 0.14) }} />
              <View pointerEvents="none" style={{ position: 'absolute', bottom: -80, left: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: withAlpha(BRAND.lavender, 0.1) }} />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: BRAND.gold, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="musical-notes" size={22} color={BRAND.deep} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
                    {t('leaderTools.profileEntries', { defaultValue: 'Leader' })}
                  </Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>
                    {t('leaderSongs.title')}
                  </Text>
                </View>
                <GlassBackButton onPress={() => navigation.goBack()} size={44} />
              </View>

              <Pressable
                onPress={() => navigation.navigate('SongEditor', { id: null })}
                style={{ marginTop: 18, borderRadius: 16, overflow: 'hidden', shadowColor: BRAND.lime, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}
              >
                <LinearGradient
                  colors={[BRAND.lime, BRAND.lime]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16 }}
                >
                  <Ionicons name="add-circle" size={20} color={BRAND.deep} />
                  <Text style={{ color: BRAND.deep, fontWeight: '800', fontSize: 14 }}>{t('leaderSongs.newSong')}</Text>
                </LinearGradient>
              </Pressable>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <QuickShortcut icon="albums" label={t('leaderSongs.categories')} onPress={() => navigation.navigate('SongCategories')} />
                <QuickShortcut icon="people" label={t('leaderSongs.zemaTeam')} onPress={() => navigation.navigate('ZemaTeam')} />
                <QuickShortcut icon="checkmark-done" label={t('leaderSongs.review')} onPress={() => navigation.navigate('SongReview')} />
              </View>
            </LinearGradient>

            {showingSavedData && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
                <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: withAlpha('#E8A65D', 0.14), borderWidth: 1, borderColor: withAlpha('#E8A65D', 0.4) }}>
                  <Ionicons name="cloud-offline" size={13} color="#E8A65D" />
                  <Text style={[typography.caption, { color: '#E8A65D', fontWeight: '800' }]}>
                    {t('home.showingSavedData', { defaultValue: 'Showing saved data' })}
                  </Text>
                </View>
              </View>
            )}

            {error && q.data === undefined && (
              <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: 14, backgroundColor: withAlpha(colors.error, 0.1), borderWidth: 1, borderColor: withAlpha(colors.error, 0.35) }}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>{error}</Text>
              </View>
            )}

            {items.length > 0 && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: colors.accent }} />
                <Text style={[typography.caption, { color: colors.textSecondary, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '800', flex: 1 }]}>
                  {t('leaderSongs.allSongs', { defaultValue: 'All songs' })}
                </Text>
                <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: withAlpha(colors.accent, 0.18) }}>
                  <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }}>{items.length}</Text>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          firstLoad ? (
            <View style={{ paddingVertical: spacing.xl * 2, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <LinearGradient colors={[BRAND.lime, BRAND.mint, BRAND.lavender]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="musical-notes-outline" size={40} color={colors.textSecondary} />
                </View>
              </LinearGradient>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>{t('leaderSongs.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <SongRow
            item={item}
            index={index}
            palette={PALETTES[index % PALETTES.length]}
            tint={statusTint(item.status)}
            icon={statusIcon(item.status)}
            label={statusLabel(item.status)}
            onPress={() => navigation.navigate('SongEditor', { id: item.id })}
          />
        )}
      />
    </View>
  );
}

function QuickShortcut({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable onPress={onPress} onPressIn={() => to(0.96)} onPressOut={() => to(1)} accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' }}>
        <Ionicons name={icon} size={15} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }} numberOfLines={1}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function SongRow({ item, index, palette, tint, icon, label, onPress }: {
  item: LeaderSongRow; index: number; palette: readonly [string, string]; tint: string; icon: IconName; label: string; onPress: () => void;
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
    <Animated.View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.sm + 4, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }, { scale }] }}>
      <Pressable onPress={onPress} onPressIn={() => to(0.98)} onPressOut={() => to(1)}
        style={{ flexDirection: 'row', alignItems: 'center', padding: 12, paddingLeft: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 }} />
        <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="musical-notes" size={22} color="#FFFFFF" />
        </LinearGradient>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[typography.body, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>{item.title}</Text>
          {item.category && (
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>{item.category.name}</Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: withAlpha(tint, 0.14) }}>
            <Ionicons name={icon} size={11} color={tint} />
            <Text style={{ color: tint, fontSize: 11, fontWeight: '800' }}>{label}</Text>
          </View>
        </View>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: withAlpha(colors.accent, 0.16), alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="create-outline" size={17} color={colors.accent} />
        </View>
      </Pressable>
    </Animated.View>
  );
}