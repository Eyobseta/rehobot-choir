import React from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
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
import { useLeaderAnnouncementsQuery } from './useAnnouncements';

const AMBER = '#F59E0B';

export default function LeaderAnnouncementsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();

  const q = useLeaderAnnouncementsQuery();
  const items = q.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  if (firstLoad) {
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
      <LinearGradient
        colors={['#F59E0B', BRAND.magenta, BRAND.violet]}
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
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -60,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: withAlpha('#FFFFFF', 0.18),
          }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="megaphone" size={22} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              {t('leaderTools.manageMember', { defaultValue: 'Leader' })}
            </Text>
            <Text
              style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }}
              numberOfLines={1}
            >
              {t('announcements.title')}
            </Text>
          </View>

          <GlassBackButton
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
            size={44}
          />
        </View>
      </LinearGradient>

      {showingSavedData && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: withAlpha(AMBER, 0.14),
              borderWidth: 1,
              borderColor: withAlpha(AMBER, 0.4),
            }}
          >
            <Ionicons name="cloud-offline" size={13} color={AMBER} />
            <Text style={[typography.caption, { color: AMBER, fontWeight: '800' }]}>
              {t('home.showingSavedData', { defaultValue: 'Showing saved data' })}
            </Text>
          </View>
        </View>
      )}

      {q.isError && q.data === undefined && (
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.md + 2,
            backgroundColor: withAlpha(colors.error, 0.1),
            borderWidth: 1,
            borderColor: withAlpha(colors.error, 0.35),
          }}
        >
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>
            {(q.error as { message?: string })?.message ?? 'Error'}
          </Text>
        </View>
      )}

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Pressable
          onPress={() => navigation.navigate('AnnouncementEditor', { id: null })}
          style={({ pressed }) => ({
            borderRadius: 22,
            overflow: 'hidden',
            transform: [{ scale: pressed ? 0.98 : 1 }],
            shadowColor: BRAND.magenta,
            shadowOpacity: 0.4,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 8 },
            elevation: 6,
          })}
        >
          <LinearGradient
            colors={[BRAND.violet, BRAND.magenta]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              overflow: 'hidden',
            }}
          >
            <Ionicons
              name="megaphone"
              size={90}
              color="rgba(255,255,255,0.14)"
              style={{ position: 'absolute', right: -8, bottom: -24 }}
            />
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 15,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={26} color={BRAND.magenta} />
            </View>
            <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '800', flex: 1 }]}>
              {t('announcements.create')}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !firstLoad}
            onRefresh={() => q.refetch()}
            tintColor={BRAND.violet}
            colors={[BRAND.violet]}
          />
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 26,
                backgroundColor: withAlpha(AMBER, 0.14),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="megaphone-outline" size={34} color={AMBER} />
            </View>
            <Text
              style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}
            >
              {t('announcements.empty')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const tint =
            item.status === 'PUBLISHED'
              ? colors.success
              : item.status === 'SCHEDULED'
              ? colors.warning
              : colors.textSecondary;
          const statusIcon: keyof typeof Ionicons.glyphMap =
            item.status === 'PUBLISHED'
              ? 'checkmark-circle'
              : item.status === 'SCHEDULED'
              ? 'time'
              : 'document-text';
          return (
            <Pressable
              onPress={() => navigation.navigate('AnnouncementEditor', { id: item.id })}
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
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={{ width: 62, height: 62, borderRadius: 18 }}
                />
              ) : (
                <LinearGradient
                  colors={[AMBER, BRAND.magenta]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="megaphone" size={26} color="#FFFFFF" />
                </LinearGradient>
              )}

              <View style={{ flex: 1 }}>
                <Text
                  style={[typography.body, { color: colors.text, fontWeight: '800' }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text
                  style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
                  numberOfLines={1}
                >
                  {new Date(item.publishAt).toLocaleString()}
                </Text>
                <View
                  style={{
                    alignSelf: 'flex-start',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    marginTop: spacing.xs + 2,
                    paddingHorizontal: spacing.sm + 2,
                    paddingVertical: 3,
                    borderRadius: 10,
                    backgroundColor: withAlpha(tint, 0.14),
                  }}
                >
                  <Ionicons name={statusIcon} size={12} color={tint} />
                  <Text style={[typography.caption, { color: tint, fontWeight: '800' }]}>
                    {item.status === 'PUBLISHED'
                      ? t('announcements.statusPublished')
                      : item.status === 'SCHEDULED'
                      ? t('announcements.statusScheduled')
                      : t('announcements.statusDraft')}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: withAlpha(BRAND.violet, 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="create-outline" size={17} color={BRAND.violet} />
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}