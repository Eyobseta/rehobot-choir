import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { formatEthDate, EthDate } from '../../utils/ethiopianCalendar';
import { useAnnouncementDetailQuery } from './useAnnouncements';

const AMBER = '#F59E0B';

export default function AnnouncementDetailScreen({ route, navigation }: any) {
   const { t, i18n } = useTranslation();
 const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();
  const { id } = route.params;

  const q = useAnnouncementDetailQuery(id);
  const item = q.data;
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

  if (!item) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
          padding: spacing.xl,
          gap: spacing.md,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 24,
            backgroundColor: withAlpha(colors.error, 0.12),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="megaphone-outline" size={32} color={colors.error} />
        </View>
        <Text style={[typography.body, { color: colors.error, textAlign: 'center' }]}>
          {(q.error as { message?: string })?.message ?? t('announcements.notFound')}
        </Text>

        <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>
      </View>
    );
  }

  let evEth: EthDate | null = null;
  if (item.event) {
    evEth = {
      year: item.event.dateEthYear,
      month: item.event.dateEthMonth,
      day: item.event.dateEthDay,
    };
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: item.imageUrl ? 260 : 190 }}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <LinearGradient
              colors={['#F59E0B', BRAND.magenta, BRAND.violet]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="megaphone" size={120} color="rgba(255,255,255,0.18)" />
            </LinearGradient>
          )}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(10,6,30,0.35)', 'rgba(10,6,30,0)', 'rgba(10,6,30,0.55)']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        </View>

        <View
          style={{
            marginTop: -28,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            backgroundColor: colors.background,
            padding: spacing.xl,
            paddingTop: spacing.xl + 2,
          }}
        >
          {showingSavedData && (
            <View style={{ marginBottom: spacing.md }}>
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

          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: spacing.md,
              paddingVertical: 5,
              borderRadius: 12,
              backgroundColor: withAlpha(AMBER, 0.16),
            }}
          >
            <Ionicons name="time" size={13} color={AMBER} />
            <Text style={[typography.caption, { color: AMBER, fontWeight: '800' }]}>
              {new Date(item.publishAt).toLocaleString()}
            </Text>
          </View>

          <Text
            style={[
              typography.h2,
              { color: colors.text, fontWeight: '800', marginTop: spacing.md, letterSpacing: -0.3 },
            ]}
          >
            {item.title}
          </Text>

          <View
            style={{
              marginTop: spacing.lg,
              padding: spacing.lg,
              borderRadius: 24,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                backgroundColor: AMBER,
              }}
            />
            <Text
              style={[
                typography.body,
                { color: colors.text, lineHeight: 25, paddingLeft: spacing.sm },
              ]}
            >
              {item.message}
            </Text>
          </View>

          {item.event && evEth && (
            <Pressable
              onPress={() => {
                const parent = navigation.getParent();
                const target = parent ?? navigation;
                if (target.getState().routeNames.includes('Home')) {
                  target.navigate('Home', { screen: 'EventDetail', params: { id: item.event!.id } });
                } else {
                  target.navigate('EventDetail', { id: item.event!.id });
                }
              }}
              style={({ pressed }) => ({
                marginTop: spacing.lg,
                borderRadius: 26,
                overflow: 'hidden',
                transform: [{ scale: pressed ? 0.98 : 1 }],
                shadowColor: BRAND.violet,
                shadowOpacity: 0.3,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 5,
              })}
            >
              <LinearGradient
                colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  overflow: 'hidden',
                }}
              >
                <Ionicons
                  name="calendar"
                  size={100}
                  color="rgba(255,255,255,0.1)"
                  style={{ position: 'absolute', right: -12, bottom: -26 }}
                />
                <View
                  style={{
                    width: 56,
                    paddingVertical: 8,
                    borderRadius: 16,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 22, fontWeight: '800', color: BRAND.deep, lineHeight: 24 }}>
                    {evEth.day}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: BRAND.magenta,
                      textTransform: 'uppercase',
                    }}
                  >
                    {formatEthDate(evEth, lang).split(' ')[0].slice(0, 3)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[typography.body, { color: '#FFFFFF', fontWeight: '800' }]}
                    numberOfLines={2}
                  >
                    {item.event.title}
                  </Text>
                  <Text
                    style={[typography.caption, { color: 'rgba(255,255,255,0.85)', marginTop: 3 }]}
                    numberOfLines={1}
                  >
                    {formatEthDate(evEth, lang)}
                  </Text>
                </View>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: BRAND.gold,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="arrow-forward" size={18} color={BRAND.deep} />
                </View>
              </LinearGradient>
            </Pressable>
          )}

          {item.songs.length > 0 && (
            <View style={{ marginTop: spacing.xl }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  marginBottom: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 10,
                    backgroundColor: withAlpha(BRAND.violet, 0.16),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="musical-notes" size={15} color={BRAND.violet} />
                </View>
                <Text style={[typography.h3, { color: colors.text, fontWeight: '800' }]}>
                  {t('announcements.songs')}
                </Text>
              </View>
              <View
                style={{
                  borderRadius: 24,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  overflow: 'hidden',
                }}
              >
                {item.songs.map((s, i) => (
                  <View
                    key={s.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      padding: spacing.md,
                      borderBottomWidth: i === item.songs.length - 1 ? 0 : 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 11,
                        backgroundColor: withAlpha(BRAND.violet, 0.12),
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '800', color: BRAND.violet }}>
                        {i + 1}
                      </Text>
                    </View>
                    <Text
                      style={[typography.body, { color: colors.text, flex: 1, fontWeight: '600' }]}
                    >
                      {s.songTitle}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: insets.top + 12, right: 16, zIndex: 10 }}
      >
        <GlassBackButton
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
          size={44}
        />
      </View>
    </View>
  );
}