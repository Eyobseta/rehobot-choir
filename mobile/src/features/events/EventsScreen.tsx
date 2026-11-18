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
      <View style={{ backgroundColor: BRAND.teal,  paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: insets.top - 22, right: -52, width: 150, height: 150, borderRadius: 75, backgroundColor: withAlpha(BRAND.lime, 0.14) }} />

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

        <View style={{ flexDirection: 'row', padding: 4, borderRadius: 20, backgroundColor: BRAND.tealDark, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', marginTop: 18 }}>
          <HeroSegBtn icon="sparkles" label={t('events.upcoming')} active={scope === 'upcoming'} onPress={() => setScope('upcoming')} />
          <HeroSegBtn icon="time" label={t('events.past')} active={scope === 'past'} onPress={() => setScope('past')} />
        </View>
      </View>

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
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl }}
          refreshControl={
            <RefreshControl refreshing={q.isRefetching && !firstLoad} onRefresh={() => q.refetch()} tintColor={colors.primary} colors={[BRAND.teal]} />
          }
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <LinearGradient colors={[BRAND.lime, BRAND.mint, BRAND.lavender]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="calendar-outline" size={40} color={colors.textSecondary} />
                </View>
              </LinearGradient>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
                {scope === 'upcoming' ? t('events.emptyUpcoming') : t('events.emptyPast')}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            let eth: EthDate = { year: 0, month: 1, day: 1 };
            if (typeof item.date === 'object' && item.date !== null) {
              eth = item.date as unknown as EthDate;
            } else if (item.dateEthYear && item.dateEthMonth && item.dateEthDay) {
              eth = { year: item.dateEthYear, month: item.dateEthMonth, day: item.dateEthDay };
            }

            const dayNum = eth.day;
            const monthShort = eth.month ? formatEthDate(eth, lang).split(' ')[0].slice(0, 3) : '';
            const isNext = scope === 'upcoming' && index === 0;
            const isLast = index === items.length - 1;

            return (
              <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
                {/* timeline rail */}
                <View style={{ width: 60, alignItems: 'center' }}>
                  <View
                    style={{
                      position: 'absolute',
                      left: 29,
                      top: 0,
                      width: 2,
                      ...(isLast ? { height: 34 } : { bottom: -spacing.md }),
                      backgroundColor: colors.border,
                    }}
                  />
                  <View
                    style={{
                      width: 54,
                      paddingVertical: 8,
                      borderRadius: 18,
                      alignItems: 'center',
                      backgroundColor: isNext ? BRAND.lime : colors.surface,
                      borderWidth: isNext ? 0 : 1.5,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 21,
                        fontWeight: '800',
                        lineHeight: 24,
                        color: isNext ? BRAND.teal : colors.text,
                      }}
                    >
                      {dayNum}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        color: isNext ? BRAND.teal : colors.accent,
                      }}
                    >
                      {monthShort}
                    </Text>
                  </View>
                </View>

                {/* card */}
                <Pressable
                  onPress={() => navigation.navigate('EventDetail', { id: item.id })}
                  style={({ pressed }) => ({
                    flex: 1,
                    borderRadius: 26,
                    overflow: 'hidden',
                    backgroundColor: colors.surface,
                    borderWidth: isNext ? 2 : 1,
                    borderColor: isNext ? BRAND.lime : colors.border,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
                >
                  <View style={{ height: item.coverImageUrl ? 128 : 78 }}>
                    {item.coverImageUrl ? (
                      <Image source={{ uri: item.coverImageUrl }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <View style={{ flex: 1, backgroundColor: BRAND.teal, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                        <View pointerEvents="none" style={{ position: 'absolute', top: -40, left: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: BRAND.lime }} />
                        <View pointerEvents="none" style={{ position: 'absolute', bottom: -50, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: BRAND.lavender }} />
                        <Ionicons name="calendar" size={44} color="rgba(255,255,255,0.2)" />
                      </View>
                    )}
                    {item.coverImageUrl && (
                      <LinearGradient pointerEvents="none" colors={['rgba(14,38,44,0)', 'rgba(14,38,44,0.45)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }} />
                    )}
                    {isNext && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 10,
                          left: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: BRAND.lime,
                        }}
                      >
                        <Ionicons name="sparkles" size={12} color={BRAND.teal} />
                        <Text style={{ color: BRAND.teal, fontSize: 11, fontWeight: '800' }}>
                          {t('events.nextUp', { defaultValue: 'Next up' })}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={{ padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.body, { color: colors.text, fontWeight: '800' }]} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                        <Text style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>
                          {formatEthDate(eth, lang)}
                        </Text>
                      </View>
                      {item.location && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                          <Text style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>
                            {item.location}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: BRAND.teal, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="arrow-forward" size={16} color={BRAND.lime} />
                    </View>
                  </View>
                </Pressable>
              </View>
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
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 16, backgroundColor: active ? BRAND.lime : 'transparent' }}
    >
      <Ionicons name={icon} size={15} color={active ? BRAND.deep : 'rgba(255,255,255,0.85)'} />
      <Text style={[typography.button, { color: active ? BRAND.deep : 'rgba(255,255,255,0.85)', fontWeight: '800' }]}>{label}</Text>
    </Pressable>
  );
}