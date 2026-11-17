import React from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { EthDate, formatEthDate } from '../../utils/ethiopianCalendar';
import { useLeaderEventsQuery } from './useEvents';

export default function LeaderEventsScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();

  const q = useLeaderEventsQuery();
  const items = q.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  if (firstLoad) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: BRAND.teal,  paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: -65, right: -45, width: 130, height: 130, borderRadius: 65, backgroundColor: BRAND.lime }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: BRAND.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="calendar" size={22} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
              {t('leaderTools.profileEntries', { defaultValue: 'Leader' })}
            </Text>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>
              {t('events.title')}
            </Text>
          </View>

          <GlassBackButton onPress={() => navigation.goBack()} accessibilityLabel={t('common.back', { defaultValue: 'Back' })} size={44} />
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
        <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md + 2, backgroundColor: withAlpha(colors.error, 0.1), borderWidth: 1, borderColor: withAlpha(colors.error, 0.35) }}>
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>
            {(q.error as { message?: string })?.message ?? 'Something went wrong.'}
          </Text>
        </View>
      )}

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Pressable
          onPress={() => navigation.navigate('EventEditor', { id: null })}
          style={({ pressed }) => ({
            borderRadius: 22,
            overflow: 'hidden',
            transform: [{ scale: pressed ? 0.98 : 1 }],
            shadowColor: colors.primary,
            shadowOpacity: 0.4,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 8 },
            elevation: 6,
          })}
        >
          <View style={{ backgroundColor: colors.primary,  paddingVertical: spacing.md, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, overflow: 'hidden' }}>
            <Ionicons name="calendar" size={90} color={withAlpha(colors.primaryText, 0.14)} style={{ position: 'absolute', right: -10, bottom: -24 }} />
            <View style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: colors.primaryText, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={26} color={colors.primary} />
            </View>
            <Text style={[typography.button, { color: colors.primaryText, fontWeight: '800', flex: 1 }]}>{t('events.createEvent')}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.primaryText} />
          </View>
        </Pressable>
      </View>

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
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>{t('events.emptyUpcoming')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const published = item.status === 'PUBLISHED';
          const tint = published ? colors.success : '#E8A65D';

          let eth: EthDate = { year: 0, month: 1, day: 1 };
          if (typeof item.date === 'object' && item.date !== null) {
            eth = item.date as unknown as EthDate;
          } else if (item.dateEthYear && item.dateEthMonth && item.dateEthDay) {
            eth = { year: item.dateEthYear, month: item.dateEthMonth, day: item.dateEthDay };
          }

          const monthShort = eth.month ? formatEthDate(eth, lang).split(' ')[0].slice(0, 3) : '';

          return (
            <Pressable
              onPress={() => navigation.navigate('EventEditor', { id: item.id })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.md,
                marginBottom: spacing.md,
                backgroundColor: colors.surface,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: colors.border,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <View style={{ backgroundColor: BRAND.teal,  width: 56, height: 62, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', lineHeight: 24 }}>{eth.day}</Text>
                <Text style={{ fontSize: 10, fontWeight: '800', color: BRAND.lime, textTransform: 'uppercase' }}>{monthShort}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
                  {formatEthDate(eth, lang)}
                </Text>
                <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.xs + 2, paddingHorizontal: spacing.sm + 2, paddingVertical: 3, borderRadius: 10, backgroundColor: withAlpha(tint, 0.14) }}>
                  <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: tint }} />
                  <Text style={[typography.caption, { color: tint, fontWeight: '800' }]}>
                    {published ? t('events.statusPublished') : t('events.statusDraft')}
                  </Text>
                </View>
              </View>

              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: withAlpha(colors.primary, 0.12), alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="create-outline" size={17} color={colors.primary} />
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}