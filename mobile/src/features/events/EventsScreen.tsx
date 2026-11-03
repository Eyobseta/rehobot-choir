import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { EventSummary } from '../../services/events';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { EthDate, formatEthDate } from '../../utils/ethiopianCalendar';
import { useMe } from '../chat/chatSession';
import { useEventsQuery, warmEventDetailCache } from './useEvents';

export default function EventsScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const userId = useMe()?.id ?? null;

  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');

  const q = useEventsQuery(scope);
  const items = q.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  useEffect(() => {
    if (!items.length) return;
    void warmEventDetailCache(qc, userId, items.map((e) => e.id));
  }, [items, qc, userId]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}
      >
        <View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: withAlpha(BRAND.gold, 0.22) }} />
        <View pointerEvents="none" style={{ position: 'absolute', bottom: -80, left: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: withAlpha(BRAND.water, 0.22) }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: BRAND.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="calendar" size={22} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
              {t('tabs.home', { defaultValue: 'Home' })}
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>
              {t('events.title')}
            </Text>
          </View>

          <GlassBackButton onPress={() => navigation.goBack()} accessibilityLabel={t('common.back', { defaultValue: 'Back' })} />
        </View>

        <View style={{ flexDirection: 'row', padding: 4, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', marginTop: 18 }}>
          <HeroSegBtn icon="sparkles" label={t('events.upcoming')} active={scope === 'upcoming'} onPress={() => setScope('upcoming')} />
          <HeroSegBtn icon="time" label={t('events.past')} active={scope === 'past'} onPress={() => setScope('past')} />
        </View>
      </LinearGradient>

      {showingSavedData && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: withAlpha('#F59E0B', 0.14), borderWidth: 1, borderColor: withAlpha('#F59E0B', 0.4) }}>
            <Ionicons name="cloud-offline" size={13} color="#F59E0B" />
            <Text style={[typography.caption, { color: '#F59E0B', fontWeight: '800' }]}>
              {t('home.showingSavedData', { defaultValue: 'Showing saved data' })}
            </Text>
          </View>
        </View>
      )}

      {q.isError && q.data === undefined && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md + 2, backgroundColor: withAlpha(colors.error, 0.1), borderWidth: 1, borderColor: withAlpha(colors.error, 0.35) }}>
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>
            {(q.error as { message?: string })?.message ?? 'Something went wrong.'}
          </Text>
        </View>
      )}

      {firstLoad ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={BRAND.violet} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl }}
          refreshControl={
            <RefreshControl refreshing={q.isRefetching && !firstLoad} onRefresh={() => q.refetch()} tintColor={BRAND.violet} colors={[BRAND.violet]} />
          }
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <LinearGradient colors={[BRAND.violet, BRAND.magenta, BRAND.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="calendar-outline" size={40} color={colors.textSecondary} />
                </View>
              </LinearGradient>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
                {scope === 'upcoming' ? t('events.emptyUpcoming') : t('events.emptyPast')}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            let eth: EthDate = { year: 0, month: 1, day: 1 };
            if (typeof item.date === 'object' && item.date !== null) {
              eth = item.date as unknown as EthDate;
            } else if (item.dateEthYear && item.dateEthMonth && item.dateEthDay) {
              eth = { year: item.dateEthYear, month: item.dateEthMonth, day: item.dateEthDay };
            }

            const dayNum = eth.day;
            const monthShort = eth.month ? formatEthDate(eth, lang).split(' ')[0] : '';

            return (
              <Pressable
                onPress={() => navigation.navigate('EventDetail', { id: item.id })}
                style={({ pressed }) => ({
                  marginBottom: spacing.md + 2,
                  borderRadius: 26,
                  overflow: 'hidden',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  shadowColor: BRAND.deep,
                  shadowOpacity: 0.12,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 3,
                })}
              >
                <View style={{ height: item.coverImageUrl ? 150 : 96 }}>
                  {item.coverImageUrl ? (
                    <Image source={{ uri: item.coverImageUrl }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <LinearGradient colors={[BRAND.deep, BRAND.violet, BRAND.magenta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="calendar" size={64} color="rgba(255,255,255,0.18)" />
                    </LinearGradient>
                  )}
                  {item.coverImageUrl && (
                    <LinearGradient pointerEvents="none" colors={['rgba(10,6,30,0)', 'rgba(10,6,30,0.45)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }} />
                  )}
                  <View style={{ position: 'absolute', top: spacing.sm + 2, left: spacing.sm + 2, width: 52, paddingVertical: 6, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 }}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: BRAND.deep, lineHeight: 22 }}>{dayNum}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: BRAND.magenta, textTransform: 'uppercase' }}>{monthShort}</Text>
                  </View>
                </View>

                <View style={{ padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.body, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>{item.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
                      <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                      <Text style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>
                        {formatEthDate(eth, lang)}
                      </Text>
                    </View>
                    {item.location && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                        <Text style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>{item.location}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: withAlpha(BRAND.violet, 0.12), alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="arrow-forward" size={16} color={BRAND.violet} />
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

function HeroSegBtn({ icon, label, active, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const { typography } = theme;
  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 16, backgroundColor: active ? '#FFFFFF' : 'transparent' }}
    >
      <Ionicons name={icon} size={15} color={active ? BRAND.deep : 'rgba(255,255,255,0.85)'} />
      <Text style={[typography.button, { color: active ? BRAND.deep : 'rgba(255,255,255,0.85)', fontWeight: '800' }]}>{label}</Text>
    </Pressable>
  );
}