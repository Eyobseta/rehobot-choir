import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  RefreshControl,
  Pressable,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { ethTodayFromInstant, formatEthDate } from '../../utils/ethiopianCalendar';
import { DailyQuote } from '../../services/quotes';
import { useRecentQuotesQuery } from './useQuotes';

const BROWN = '#7B5FC7';
const CREAM = '#FAF3EB';
const SAND = '#D3C3F8';
const INK = '#1D4550';
const GRADIENT = ['#102A31', '#1D4550', '#2F6B78'] as const;
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: undefined });

function publisherOf(item: DailyQuote): { name: string | null; photo: string | null } {
  const mp = item.submittedBy?.memberProfile;
  return {
    name: (mp?.fullName ?? '').trim() || null,
    photo: mp?.profilePhotoUrl ?? null,
  };
}

export default function DailyQuoteHistoryScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  const q = useRecentQuotesQuery(7);
  const items = q.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  const today = ethTodayFromInstant(new Date());

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ---------- Header ---------- */}
      <LinearGradient
        colors={GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
          paddingBottom: 24,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          overflow: 'hidden',
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -70,
            right: -60,
            width: 210,
            height: 210,
            borderRadius: 105,
            backgroundColor: withAlpha(BRAND.gold, 0.14),
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -30,
            right: -20,
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: withAlpha(BRAND.gold, 0.2),
          }}
        />
        <Text
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -20,
            left: 130,
            fontSize: 150,
            lineHeight: 170,
            fontWeight: '800',
            fontFamily: SERIF,
            color: 'rgba(255,255,255,0.07)',
          }}
        >
          “
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 17,
              backgroundColor: BRAND.gold,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: BRAND.gold,
              shadowOpacity: 0.5,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 5 },
              elevation: 5,
            }}
          >
            <Ionicons name="time" size={24} color={INK} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: SAND,
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 1.4,
                textTransform: 'uppercase',
              }}
              numberOfLines={1}
            >
              {t('quote.title')}
            </Text>
            <Text
              style={{ color: '#FFFFFF', fontSize: 21, fontWeight: '800', marginTop: 2 }}
              numberOfLines={1}
            >
              {t('quote.previous7')}
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
            accessibilityRole="text"
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: withAlpha('#E8A65D', 0.14),
              borderWidth: 1,
              borderColor: withAlpha('#E8A65D', 0.4),
            }}
          >
            <Ionicons name="cloud-offline" size={13} color="#E8A65D" />
            <Text style={[typography.caption, { color: '#E8A65D', fontWeight: '800' }]}>
              {t('home.showingSavedData', { defaultValue: 'Showing saved data' })}
            </Text>
          </View>
        </View>
      )}

      {firstLoad ? (
        <HistorySkeleton />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xxl,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching && !firstLoad}
              onRefresh={() => q.refetch()}
              tintColor={BROWN}
              colors={[BROWN]}
            />
          }
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <LinearGradient
                colors={GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: 52,
                    backgroundColor: colors.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={40} color={BROWN} />
                </View>
              </LinearGradient>
              <Text
                style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}
              >
                {t('quote.empty')}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <QuoteRow
              item={item}
              index={index}
              isLatest={index === 0}
              isLast={index === items.length - 1}
              isToday={
                item.dateEthYear === today.year &&
                item.dateEthMonth === today.month &&
                item.dateEthDay === today.day
              }
              lang={lang}
              onPress={() => navigation.navigate('DailyQuoteDetail', { quote: item })}
            />
          )}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// One timeline row. The newest quote is a featured golden card; the rest are
// calm surface cards. Rows stagger in on mount.
// ---------------------------------------------------------------------------

function QuoteRow({
  item,
  index,
  isLatest,
  isLast,
  isToday,
  lang,
  onPress,
}: {
  item: DailyQuote;
  index: number;
  isLatest: boolean;
  isLast: boolean;
  isToday: boolean;
  lang: 'en' | 'am';
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 7) * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [enter, index]);

  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 5, useNativeDriver: true }).start();

  const pub = publisherOf(item);
  const name = pub.name ?? t('quote.unknownPublisher', { defaultValue: 'a choir member' });
  const dateLabel = formatEthDate(
    { year: item.dateEthYear, month: item.dateEthMonth, day: item.dateEthDay },
    lang,
  );

  // Palette depends on featured vs normal card.
  const featured = isLatest;
  const textColor = featured ? '#FFFFFF' : colors.text;
  const subColor = featured ? SAND : colors.textSecondary;
  const accent = featured ? BRAND.gold : BROWN;

  const body = (
    <>
      {featured ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: -60,
              right: -44,
              width: 150,
              height: 150,
              borderRadius: 75,
              backgroundColor: withAlpha(BRAND.lavender, 0.14),
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 30,
              right: 30,
              width: 14,
              height: 14,
              borderRadius: 4,
              backgroundColor: withAlpha(BRAND.lime, 0.6),
              transform: [{ rotate: '45deg' }],
            }}
          />
        </>
      ) : null}
      <Text
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -10,
          right: 12,
          fontSize: featured ? 100 : 84,
          lineHeight: featured ? 116 : 100,
          fontWeight: '800',
          fontFamily: SERIF,
          color: featured ? 'rgba(255,255,255,0.08)' : withAlpha(BROWN, 0.1),
        }}
      >
        “
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: spacing.sm + 2,
            paddingVertical: 4,
            borderRadius: 10,
            backgroundColor: featured ? 'rgba(255,255,255,0.16)' : withAlpha(BROWN, 0.14),
          }}
        >
          <Ionicons name="calendar-outline" size={12} color={featured ? CREAM : BROWN} />
          <Text
            style={[typography.caption, { color: featured ? CREAM : BROWN, fontWeight: '800' }]}
          >
            {dateLabel}
          </Text>
        </View>
        {isToday ? (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 10,
              backgroundColor: BRAND.gold,
            }}
          >
            <Text style={{ color: INK, fontSize: 10.5, fontWeight: '800' }}>
              {t('home.today', { defaultValue: 'Today' })}
            </Text>
          </View>
        ) : null}
      </View>

      <Text
        numberOfLines={featured ? 5 : 4}
        style={{
          color: textColor,
          marginTop: spacing.sm + 2,
          fontFamily: SERIF,
          fontStyle: 'italic',
          lineHeight: featured ? 28 : 24,
          fontSize: featured ? 18 : 15.5,
        }}
      >
        {item.quoteText}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm + 2 }}>
        <View style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: accent }} />
        <Text
          style={[typography.caption, { color: subColor, fontWeight: '700', flexShrink: 1 }]}
          numberOfLines={1}
        >
          {item.source}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginTop: spacing.md,
          paddingTop: spacing.sm + 2,
          borderTopWidth: 1,
          borderTopColor: featured ? 'rgba(255,255,255,0.16)' : colors.border,
        }}
      >
        {pub.photo ? (
          <Image source={{ uri: pub.photo }} style={{ width: 26, height: 26, borderRadius: 13 }} />
        ) : (
          <View style={{ backgroundColor: BRAND.lime, 
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ color: BRAND.teal, fontSize: 12, fontWeight: '800' }}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text
          style={[typography.caption, { color: subColor, flex: 1 }]}
          numberOfLines={1}
        >
          {t('quote.publishedBy', { name, defaultValue: 'Published by {{name}}' })}
        </Text>
        {item.audioUrl ? <Ionicons name="headset" size={14} color={subColor} /> : null}
        {item.youtubeUrl ? <Ionicons name="logo-youtube" size={15} color={subColor} /> : null}
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: featured ? BRAND.gold : withAlpha(BROWN, 0.14),
          }}
        >
          <Ionicons name="arrow-forward" size={13} color={featured ? INK : BROWN} />
        </View>
      </View>
    </>
  );

  return (
    <Animated.View
      style={{
        flexDirection: 'row',
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
          { scale },
        ],
      }}
    >
      {/* timeline rail */}
      <View style={{ width: 22, alignItems: 'center', marginRight: spacing.sm }}>
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            marginTop: spacing.lg,
            borderWidth: 3,
            borderColor: BROWN,
            backgroundColor: isLatest ? BROWN : colors.background,
          }}
        />
        {!isLast && (
          <View
            style={{
              flex: 1,
              width: 2,
              marginTop: 4,
              borderRadius: 1,
              backgroundColor: withAlpha(BROWN, 0.28),
            }}
          />
        )}
      </View>

      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.98)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        style={{
          flex: 1,
          marginBottom: spacing.md,
          borderRadius: 24,
          overflow: 'hidden',
          borderWidth: featured ? 0 : 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          shadowColor: '#0E262C',
          shadowOpacity: featured ? 0.3 : 0.06,
          shadowRadius: featured ? 14 : 8,
          shadowOffset: { width: 0, height: featured ? 8 : 4 },
          elevation: featured ? 7 : 2,
        }}
      >
        {featured ? (
          <LinearGradient
            colors={GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{ padding: spacing.md + 4, overflow: 'hidden' }}
          >
            {body}
          </LinearGradient>
        ) : (
          <View style={{ padding: spacing.md + 2, overflow: 'hidden' }}>{body}</View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// First-load placeholders
// ---------------------------------------------------------------------------

function HistorySkeleton() {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });

  return (
    <View style={{ padding: spacing.lg, gap: spacing.md }} accessibilityState={{ busy: true }}>
      {[190, 150, 150].map((h, i) => (
        <View key={i} style={{ flexDirection: 'row' }}>
          <View style={{ width: 22, alignItems: 'center', marginRight: spacing.sm }}>
            <Animated.View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                marginTop: spacing.lg,
                backgroundColor: colors.border,
                opacity,
              }}
            />
          </View>
          <Animated.View
            style={{
              flex: 1,
              height: h,
              borderRadius: 24,
              backgroundColor: colors.border,
              opacity,
            }}
          />
        </View>
      ))}
    </View>
  );
}