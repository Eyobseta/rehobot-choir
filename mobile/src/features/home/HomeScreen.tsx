import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import type { BirthdayPerson } from '../../services/birthdays';
import DailyQuoteCard from '../quotes/DailyQuoteCard';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import { EthDate, ethToUtcDate, ethTodayFromInstant, formatEthDate } from '../../utils/ethiopianCalendar';
import {
  useBirthdaysQuery,
  useMeQuery,
  useNotificationsPreviewQuery,
  useRecentAnnouncementsQuery,
  useUpcomingEventQuery,
} from './useHomeData';
import { useHomeUnreadSync } from './useHomeUnreadSync';

type IconName = keyof typeof Ionicons.glyphMap;

const AMBER = '#F59E0B';
const SKY = '#0EA5E9';
const TEAL = '#0D9488';

const ABS_FILL = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

/** Whole days from today (local) until the given date. 0 = today. */
function daysUntil(date: string | Date): number {
  const d = new Date(date);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const n = new Date();
  const b = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  return Math.round((a - b) / 86400000);
}

/**
 * EventSummary from the API only carries the E.C. parts (dateEthYear/Month/Day)
 * and the Gregorian mirror (dateGregorian) — there is no plain `date` field.
 * Build the EthDate the display needs from the parts we actually receive.
 */
function ethFromSummary(s: {
  dateEthYear?: number;
  dateEthMonth?: number;
  dateEthDay?: number;
} | null | undefined): EthDate | null {
  if (
    s?.dateEthYear == null ||
    s?.dateEthMonth == null ||
    s?.dateEthDay == null
  ) {
    return null;
  }
  return { year: s.dateEthYear, month: s.dateEthMonth, day: s.dateEthDay };
}

export default function HomeScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();
  const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';

  // ---------------- Data (cached-first, always revalidating) ----------------
  const meQ = useMeQuery();
  const evQ = useUpcomingEventQuery();
  const annQ = useRecentAnnouncementsQuery();
  const bdayQ = useBirthdaysQuery();
  const notifQ = useNotificationsPreviewQuery(5);

  // Shared unread badge — one source of truth across Home + Notifications.
  useHomeUnreadSync(notifQ.data);

  // Per-section values (fallbacks identical to pre-refactor defaults).
  const mustChange = meQ.data?.user.mustChangePassword ?? false;
  const upcoming = evQ.data ?? null;
  const recent = annQ.data ?? [];
  const birthdays = bdayQ.data ?? { today: [], tomorrow: [] };
  const notifications = notifQ.data ?? [];

  // True first load = nothing in cache yet AND a fetch is in flight.
  const firstLoad =
    meQ.isPending &&
    evQ.isPending &&
    annQ.isPending &&
    bdayQ.isPending &&
    notifQ.isPending;

  // Any background refresh happening (does NOT block UI).
  const refreshing =
    meQ.isFetching ||
    evQ.isFetching ||
    annQ.isFetching ||
    bdayQ.isFetching ||
    notifQ.isFetching;

  // Any query has good cache but the last refresh failed -> "showing saved data".
  const showingSavedData =
    (evQ.isError && evQ.data !== undefined) ||
    (annQ.isError && annQ.data !== undefined) ||
    (bdayQ.isError && bdayQ.data !== undefined) ||
    (notifQ.isError && notifQ.data !== undefined);

  const refetchAll = async () => {
    await Promise.all([
      meQ.refetch(),
      evQ.refetch(),
      annQ.refetch(),
      bdayQ.refetch(),
      notifQ.refetch(),
    ]);
  };

  // ---------------- Motion: drifting blobs + scroll parallax ----------------
  const scrollY = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const parallax = scrollY.interpolate({
    inputRange: [0, 300],
    outputRange: [0, 90],
    extrapolate: 'clamp',
  });
  const heroFade = scrollY.interpolate({
    inputRange: [0, 180],
    outputRange: [1, 0.3],
    extrapolate: 'clamp',
  });
  const heroShift = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, -18],
    extrapolate: 'clamp',
  });

  // ---------------- Derived UI values ----------------
  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const goNotifications = () =>
    navigation.navigate('Profile', { screen: 'Notifications' });
  const openBirthday = (b: BirthdayPerson) =>
    navigation.navigate('BirthdayDetail', { postId: b.postId });

  const hour = new Date().getHours();
  const part: 'morning' | 'afternoon' | 'evening' =
    hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const partIcon: IconName =
    part === 'morning' ? 'sunny' : part === 'afternoon' ? 'partly-sunny' : 'moon';
  const partLabel = {
    morning: t('home.goodMorning', { defaultValue: 'Good morning' }),
    afternoon: t('home.goodAfternoon', { defaultValue: 'Good afternoon' }),
    evening: t('home.goodEvening', { defaultValue: 'Good evening' }),
  }[part];

  const tagline = {
    morning: t('home.taglineMorning', {
      defaultValue: 'A fresh day, full of new blessings ✨',
    }),
    afternoon: t('home.taglineAfternoon', {
      defaultValue: 'Keep shining — good things are coming ☀️',
    }),
    evening: t('home.taglineEvening', {
      defaultValue: 'You did wonderfully today. Rest well 🌙',
    }),
  }[part];

  const dateLabel = formatEthDate(ethTodayFromInstant(new Date()), lang);

  const todayCount = birthdays.today.length;
  const hasBirthdays = todayCount > 0 || birthdays.tomorrow.length > 0;

  // The event summary has no `date` field — only the E.C. parts. Build the
  // EthDate we need for display and for the day-countdown.
  const upcomingEth = ethFromSummary(upcoming);
  const evDays = upcomingEth ? daysUntil(ethToUtcDate(upcomingEth)) : 0;
  const evCountdown =
    evDays <= 0
      ? t('home.today', { defaultValue: 'Today' })
      : evDays === 1
      ? t('home.tomorrow', { defaultValue: 'Tomorrow' })
      : t('home.inDays', { count: evDays, defaultValue: 'In {{count}} days' });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xl * 2 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing && !firstLoad}
            onRefresh={refetchAll}
            tintColor={BRAND.violet}
            colors={[BRAND.violet]}
            progressViewOffset={insets.top}
          />
        }
      >
        {/* =============== HERO =============== */}
        <LinearGradient
          colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 14 }]}
        >
          {/* aurora blobs */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.blob,
              {
                top: -70,
                right: -50,
                width: 230,
                height: 230,
                borderRadius: 115,
                backgroundColor: withAlpha(BRAND.gold, 0.26),
                transform: [
                  { translateY: parallax },
                  {
                    translateY: drift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 14],
                    }),
                  },
                  {
                    translateX: drift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -10],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.blob,
              {
                bottom: -110,
                left: -60,
                backgroundColor: withAlpha(BRAND.water, 0.26),
                transform: [
                  { translateY: Animated.multiply(parallax, -0.5) },
                  {
                    translateY: drift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -12],
                    }),
                  },
                  {
                    translateX: drift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 8],
                    }),
                  },
                ],
              },
            ]}
          />
          {/* concentric rings, pure decoration */}
          <View pointerEvents="none" style={styles.ringA} />
          <View pointerEvents="none" style={styles.ringB} />
          <Sparkle style={{ top: insets.top + 70, right: 96 }} size={16} color={BRAND.gold} />
          <Sparkle style={{ top: insets.top + 118, right: 40 }} size={11} delay={600} />
          <Sparkle style={{ top: insets.top + 40, right: 150 }} size={9} delay={1100} color={BRAND.gold} />

          <Animated.View
            style={{ opacity: heroFade, transform: [{ translateY: heroShift }] }}
          >
            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.kickerPill}>
                  <Ionicons name={partIcon} size={14} color={BRAND.gold} />
                  <Text style={styles.heroKicker} numberOfLines={1}>
                    {partLabel}
                  </Text>
                </View>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {t('home.welcome')}
                </Text>
                <Text style={styles.tagline}>{tagline}</Text>
                <View style={styles.dateRow}>
                  <Ionicons
                    name="calendar-clear-outline"
                    size={13}
                    color="rgba(255,255,255,0.75)"
                  />
                  <Text style={styles.heroDate}>{dateLabel}</Text>
                </View>
              </View>
              <BellButton
                count={unreadCount}
                onPress={goNotifications}
                label={t('notifications.title')}
              />
            </View>

            {/* info chips */}
            {(unreadCount > 0 || todayCount > 0) && (
              <View style={styles.chips}>
                {unreadCount > 0 && (
                  <Chip
                    icon="notifications"
                    text={t('home.chipUnread', {
                      count: unreadCount,
                      defaultValue: '{{count}} new',
                    })}
                    onPress={goNotifications}
                  />
                )}
                {todayCount > 0 && (
                  <Chip
                    icon="gift"
                    text={t('home.chipBirthdays', {
                      count: todayCount,
                      defaultValue: '{{count}} birthday today',
                    })}
                  />
                )}
              </View>
            )}

            {/* temporary password banner */}
            {mustChange && (
              <PasswordBanner
                title={t('password.banner')}
                cta={t('password.bannerCta')}
                onPress={() =>
                  navigation.navigate('Profile', { screen: 'ChangePassword' })
                }
              />
            )}
          </Animated.View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg }}>
          {/* =============== SAVED-DATA NOTICE =============== */}
          {showingSavedData && (
            <View
              accessibilityRole="text"
              style={{
                marginTop: 12,
                marginBottom: 4,
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
          )}

          {/* =============== DAILY QUOTE (overlaps hero) =============== */}
          <Reveal index={0}>
            <View style={{ marginTop: -30 }}>
              <DailyQuoteCard />
            </View>
          </Reveal>

          {/* =============== UPCOMING EVENT =============== */}
          {upcoming && (
            <Reveal index={1}>
              <View style={{ marginBottom: spacing.lg }}>
                <SectionHeader
                  icon="sparkles"
                  title={t('home.lookForward', {
                    defaultValue: 'Something to look forward to',
                  })}
                  accent={BRAND.gold}
                />
                <PressScale
                  onPress={() =>
                    navigation.navigate('EventDetail', { id: upcoming.id })
                  }
                >
                  <View style={styles.eventShadow}>
                    <LinearGradient
                      colors={[BRAND.gold, BRAND.magenta, BRAND.violet]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.eventFrame}
                    >
                      <View
                        style={[
                          styles.eventCard,
                          { backgroundColor: colors.surface },
                        ]}
                      >
                        {upcoming.coverImageUrl ? (
                          <Image
                            source={{ uri: upcoming.coverImageUrl }}
                            style={ABS_FILL}
                          />
                        ) : (
                          <LinearGradient
                            colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[ABS_FILL, styles.center]}
                          >
                            <Ionicons
                              name="calendar"
                              size={120}
                              color="rgba(255,255,255,0.14)"
                            />
                          </LinearGradient>
                        )}
                        <LinearGradient
                          pointerEvents="none"
                          colors={[
                            'rgba(10,6,30,0.02)',
                            'rgba(10,6,30,0.3)',
                            'rgba(10,6,30,0.88)',
                          ]}
                          style={ABS_FILL}
                        />
                        <Sparkle style={{ top: 70, left: 26 }} size={16} color={BRAND.gold} />
                        <Sparkle style={{ top: 120, right: 40 }} size={12} delay={500} />
                        <Sparkle style={{ top: 54, right: 110 }} size={10} delay={900} color={BRAND.gold} />

                        <View style={styles.eventTop}>
                          <View style={styles.eventBadge}>
                            <Ionicons name="sparkles" size={12} color={BRAND.deep} />
                            <Text style={styles.eventBadgeText}>
                              {t('events.upcoming')}
                            </Text>
                          </View>
                          <View style={styles.countBubble}>
                            <Text style={styles.countBig}>
                              {evDays <= 0 ? '🎉' : evDays === 1 ? '⏰' : evDays}
                            </Text>
                            <Text style={styles.countSmall} numberOfLines={1}>
                              {evDays <= 1
                                ? evCountdown
                                : t('home.daysShort', { defaultValue: 'days' })}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.eventGlass}>
                          {upcomingEth ? (
                            <View style={styles.dateChip}>
                              <Text style={styles.dateChipDay}>
                                {upcomingEth.day}
                              </Text>
                              <Text style={styles.dateChipMonth}>
                                {formatEthDate(upcomingEth, lang).split(' ')[0]}
                              </Text>
                            </View>
                          ) : null}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.eventTitle} numberOfLines={2}>
                              {upcoming.title}
                            </Text>
                            <View style={styles.eventMeta}>
                              <Ionicons
                                name="calendar-outline"
                                size={14}
                                color="rgba(255,255,255,0.85)"
                              />
                              <Text style={styles.eventMetaText} numberOfLines={1}>
                                {upcomingEth ? formatEthDate(upcomingEth, lang) : ''}
                              </Text>
                            </View>
                          </View>
                          <PulseGo />
                        </View>
                      </View>
                    </LinearGradient>
                  </View>
                </PressScale>
              </View>
            </Reveal>
          )}

          {/* =============== QUICK ACCESS =============== */}
          <Reveal index={2}>
            <View>
              <SectionHeader
                icon="compass"
                title={t('home.explore', { defaultValue: 'Explore' })}
                accent={SKY}
              />
              <View style={styles.bento}>
                <View style={styles.bentoRow}>
                  <QuickTile
                    flex={1.35}
                    icon="musical-notes"
                    label={t('tabs.songs')}
                    tint={BRAND.violet}
                    onPress={() => navigation.getParent()?.navigate('Songs')}
                  />
                  <QuickTile
                    flex={1}
                    icon="images"
                    label={t('tabs.memories')}
                    tint={SKY}
                    onPress={() => navigation.getParent()?.navigate('Memories')}
                  />
                </View>
                <View style={styles.bentoRow}>
                  <QuickTile
                    flex={1}
                    icon="calendar"
                    label={t('events.title')}
                    tint={AMBER}
                    onPress={() => navigation.navigate('EventsList')}
                  />
                  <QuickTile
                    flex={1.35}
                    icon="people"
                    label={t('directory.title')}
                    tint={TEAL}
                    onPress={() => navigation.navigate('Directory')}
                  />
                </View>
              </View>
            </View>
          </Reveal>

          {/* =============== BIRTHDAY STORIES =============== */}
          {hasBirthdays && (
            <Reveal index={3}>
              <View style={{ marginBottom: spacing.lg }}>
                <SectionHeader
                  icon="gift"
                  title={t('home.birthdays')}
                  accent={BRAND.gold}
                />
                <View
                  style={[
                    styles.storyCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <LinearGradient
                    pointerEvents="none"
                    colors={[withAlpha(BRAND.gold, 0.14), withAlpha(BRAND.magenta, 0.05)]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={ABS_FILL}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.storyRow}
                  >
                    {birthdays.today.map((b) => (
                      <BirthdayBubble
                        key={b.userId}
                        person={b}
                        today
                        caption={t('home.birthdayToday')}
                        onPress={() => openBirthday(b)}
                      />
                    ))}
                    {birthdays.today.length > 0 &&
                      birthdays.tomorrow.length > 0 && (
                        <View
                          style={[
                            styles.storyDivider,
                            { backgroundColor: colors.border },
                          ]}
                        />
                      )}
                    {birthdays.tomorrow.map((b) => (
                      <BirthdayBubble
                        key={b.userId}
                        person={b}
                        caption={t('home.birthdayTomorrow')}
                        onPress={() => openBirthday(b)}
                      />
                    ))}
                  </ScrollView>
                </View>
              </View>
            </Reveal>
          )}

          {/* =============== NOTIFICATIONS =============== */}
          {notifications.length > 0 && (
            <Reveal index={4}>
              <View style={{ marginBottom: spacing.lg }}>
                <SectionHeader
                  icon="notifications"
                  title={t('notifications.title')}
                  action={t('home.seeAll')}
                  accent={BRAND.magenta}
                  badge={unreadCount}
                  onPress={goNotifications}
                />
                <View
                  style={[
                    styles.listCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  {notifications.slice(0, 3).map((n, i, arr) => {
                    const unread = !n.readAt;
                    return (
                      <Pressable
                        key={n.id}
                        onPress={goNotifications}
                        android_ripple={{ color: withAlpha(BRAND.violet, 0.12) }}
                        style={({ pressed }) => [
                          styles.notifRow,
                          {
                            borderBottomColor: colors.border,
                            borderBottomWidth: i === arr.length - 1 ? 0 : StyleSheet.hairlineWidth,
                            backgroundColor: pressed
                              ? withAlpha(BRAND.violet, 0.08)
                              : unread
                              ? withAlpha(BRAND.violet, 0.05)
                              : 'transparent',
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.roundIcon,
                            {
                              backgroundColor: unread
                                ? withAlpha(BRAND.violet, 0.16)
                                : withAlpha(colors.textSecondary, 0.12),
                            },
                          ]}
                        >
                          <Ionicons
                            name={unread ? 'notifications' : 'notifications-outline'}
                            size={17}
                            color={unread ? BRAND.violet : colors.textSecondary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              typography.body,
                              {
                                color: colors.text,
                                fontWeight: unread ? '800' : '500',
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {n.title}
                          </Text>
                          {n.body && (
                            <Text
                              style={[
                                typography.caption,
                                { color: colors.textSecondary, marginTop: 2 },
                              ]}
                              numberOfLines={1}
                            >
                              {n.body}
                            </Text>
                          )}
                        </View>
                        {unread && <View style={styles.unreadDot} />}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </Reveal>
          )}

          {/* =============== ANNOUNCEMENTS TIMELINE =============== */}
          <Reveal index={5}>
            <View style={{ marginBottom: spacing.lg }}>
              <SectionHeader
                icon="megaphone"
                title={t('announcements.recent')}
                action={t('home.seeAll')}
                accent={AMBER}
                onPress={() => navigation.navigate('AnnouncementsList')}
              />
              {recent.length === 0 ? (
                <View
                  style={[
                    styles.emptyBox,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                >
                  <Ionicons
                    name="megaphone-outline"
                    size={22}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: colors.textSecondary, flex: 1 },
                    ]}
                  >
                    {t('announcements.empty')}
                  </Text>
                </View>
              ) : (
                <View>
                  {recent.length > 1 && (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.timelineLine,
                        { backgroundColor: withAlpha(AMBER, 0.35) },
                      ]}
                    />
                  )}
                  {recent.map((a, i) => (
                    <View key={a.id} style={styles.timelineItem}>
                      <View style={styles.timelineDotWrap}>
                        <View
                          style={[
                            styles.timelineDot,
                            {
                              backgroundColor: i === 0 ? AMBER : colors.surface,
                              borderColor: AMBER,
                            },
                          ]}
                        />
                      </View>
                      <PressScale
                        onPress={() =>
                          navigation.navigate('AnnouncementDetail', { id: a.id })
                        }
                        style={{ flex: 1 }}
                      >
                        <View
                          style={[
                            styles.annCard,
                            {
                              backgroundColor: colors.surface,
                              borderColor:
                                i === 0 ? withAlpha(AMBER, 0.55) : colors.border,
                            },
                          ]}
                        >
                          {i === 0 && (
                            <View
                              pointerEvents="none"
                              style={[
                                styles.annGlow,
                                { backgroundColor: withAlpha(AMBER, 0.1) },
                              ]}
                            />
                          )}
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                typography.body,
                                { color: colors.text, fontWeight: '800' },
                              ]}
                              numberOfLines={2}
                            >
                              {a.title}
                            </Text>
                            <View style={styles.annMeta}>
                              <Ionicons
                                name="time-outline"
                                size={13}
                                color={colors.textSecondary}
                              />
                              <Text
                                style={[
                                  typography.caption,
                                  { color: colors.textSecondary, flex: 1 },
                                ]}
                                numberOfLines={1}
                              >
                                {new Date(a.publishAt).toLocaleString()}
                              </Text>
                            </View>
                          </View>
                          <View
                            style={[
                              styles.annArrow,
                              { backgroundColor: withAlpha(AMBER, 0.14) },
                            ]}
                          >
                            <Ionicons name="chevron-forward" size={16} color={AMBER} />
                          </View>
                        </View>
                      </PressScale>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Reveal>

          {/* =============== BIBLE STUDY =============== */}
          <Reveal index={6}>
            <LinearGradient
              colors={[withAlpha(BRAND.violet, 0.16), withAlpha(BRAND.gold, 0.22)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.soon, { borderColor: colors.border }]}
            >
              <Ionicons
                name="book"
                size={120}
                color={withAlpha(BRAND.violet, 0.08)}
                style={styles.soonWatermark}
              />
              <View style={styles.soonIcon}>
                <Ionicons name="book" size={22} color={BRAND.deep} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[typography.h3, { color: colors.text, fontWeight: '800' }]}
                >
                  {t('home.bibleStudy')}
                </Text>
                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.textSecondary, marginTop: 2 },
                  ]}
                >
                  {t('home.comingSoon')}
                </Text>
              </View>
              <View style={styles.soonPill}>
                <Ionicons name="time-outline" size={14} color={BRAND.violet} />
              </View>
            </LinearGradient>
          </Reveal>

          {/* First-load spinner (only when nothing is cached) */}
          {firstLoad && (
            <ActivityIndicator
              style={{ marginTop: spacing.lg }}
              color={BRAND.violet}
            />
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

/* =====================================================================
 * Small components (module scope so they never remount on re-render)
 * ===================================================================== */

/** Fade + slide-up entrance, staggered by index. */
function Reveal({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 460,
      delay: Math.min(index, 7) * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [enter, index]);

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          {
            translateY: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [22, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Pressable that springs down slightly while pressed. */
function PressScale({
  onPress,
  style,
  children,
}: {
  onPress: () => void;
  style?: any;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      speed: 40,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Twinkling sparkle used as optimistic decoration. */
function Sparkle({
  style,
  size = 14,
  delay = 0,
  color = '#FFFFFF',
}: {
  style?: any;
  size?: number;
  delay?: number;
  color?: string;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }),
          transform: [
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) },
            { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) },
          ],
        },
        style,
      ]}
    >
      <Ionicons name="sparkles" size={size} color={color} />
    </Animated.View>
  );
}

/** Gold arrow button that gently pulses to invite a tap. */
function PulseGo() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={styles.eventGo}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.goHalo,
          {
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [
              { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) },
            ],
          },
        ]}
      />
      <Ionicons name="arrow-forward" size={18} color={BRAND.deep} />
    </View>
  );
}

function BellButton({
  count,
  onPress,
  label,
}: {
  count: number;
  onPress: () => void;
  label: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (count > 0) {
      pop.setValue(0);
      Animated.spring(pop, {
        toValue: 1,
        friction: 4,
        tension: 170,
        useNativeDriver: true,
      }).start();
      ring.setValue(0);
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(ring, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [count, pop, ring]);

  const to = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      speed: 40,
      bounciness: 8,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.9)}
        onPressOut={() => to(1)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.bell}
      >
        <Animated.View
          style={{
            transform: [
              {
                rotate: ring.interpolate({
                  inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
                  outputRange: ['0deg', '16deg', '-14deg', '10deg', '-6deg', '0deg'],
                }),
              },
            ],
          }}
        >
          <Ionicons
            name={count > 0 ? 'notifications' : 'notifications-outline'}
            size={22}
            color="#FFFFFF"
          />
        </Animated.View>
        {count > 0 && (
          <Animated.View style={[styles.bellBadge, { transform: [{ scale: pop }] }]}>
            <Text style={styles.bellBadgeText}>{count > 99 ? '99+' : count}</Text>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function Chip({
  icon,
  text,
  onPress,
}: {
  icon: IconName;
  text: string;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.chip}>
      <Ionicons name={icon} size={13} color={BRAND.gold} />
      <Text style={styles.chipText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={6}>
      {body}
    </Pressable>
  );
}

function PasswordBanner({
  title,
  cta,
  onPress,
}: {
  title: string;
  cta: string;
  onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <PressScale onPress={onPress} style={{ marginTop: 16 }}>
      <View style={styles.warnBanner}>
        <Animated.View
          style={[
            styles.warnIcon,
            {
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.12],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="key" size={18} color="#FFFFFF" />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={styles.warnTitle}>{title}</Text>
          <Text style={styles.warnCta}>{cta}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
      </View>
    </PressScale>
  );
}

/** Tonal quick-access tile: tinted surface, solid icon chip, oversized watermark. */
function QuickTile({
  icon,
  label,
  tint,
  flex,
  onPress,
}: {
  icon: IconName;
  label: string;
  tint: string;
  flex: number;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  const scale = useRef(new Animated.Value(1)).current;
  const tilt = useRef(new Animated.Value(0)).current;

  const pressIn = () =>
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.95,
        speed: 40,
        bounciness: 8,
        useNativeDriver: true,
      }),
      Animated.spring(tilt, {
        toValue: 1,
        speed: 30,
        bounciness: 12,
        useNativeDriver: true,
      }),
    ]).start();
  const pressOut = () =>
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        speed: 28,
        bounciness: 14,
        useNativeDriver: true,
      }),
      Animated.spring(tilt, {
        toValue: 0,
        speed: 28,
        bounciness: 14,
        useNativeDriver: true,
      }),
    ]).start();

  return (
    <Animated.View style={{ flex, transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View
          style={[
            styles.tile,
            {
              backgroundColor: withAlpha(tint, 0.12),
              borderColor: withAlpha(tint, 0.28),
            },
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.tileWatermark,
              {
                transform: [
                  {
                    rotate: tilt.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['-14deg', '6deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons name={icon} size={96} color={withAlpha(tint, 0.14)} />
          </Animated.View>

          <View
            style={[
              styles.tileChip,
              { backgroundColor: tint, shadowColor: tint },
            ]}
          >
            <Ionicons name={icon} size={20} color="#FFFFFF" />
          </View>
          <View style={styles.tileFooter}>
            <Text
              style={[styles.tileLabel, { color: colors.text }]}
              numberOfLines={1}
            >
              {label}
            </Text>
            <View style={[styles.tileArrow, { backgroundColor: withAlpha(tint, 0.2) }]}>
              <Ionicons name="arrow-forward" size={13} color={tint} />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function SectionHeader({
  title,
  icon,
  action,
  accent,
  badge,
  onPress,
}: {
  title: string;
  icon: IconName;
  action?: string;
  accent: string;
  badge?: number;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  return (
    <View style={[styles.sectionRow, { marginBottom: spacing.sm + 4 }]}>
      <View style={[styles.sectionIcon, { backgroundColor: withAlpha(accent, 0.18) }]}>
        <Ionicons name={icon} size={15} color={accent} />
      </View>
      <Text
        style={[
          typography.h3,
          { color: colors.text, fontWeight: '800', flexShrink: 1 },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {!!badge && badge > 0 && (
        <View style={[styles.countPill, { backgroundColor: accent }]}>
          <Text style={styles.countPillText}>{badge}</Text>
        </View>
      )}
      <View style={{ flex: 1 }} />
      {action && onPress && (
        <Pressable
          onPress={onPress}
          hitSlop={8}
          accessibilityRole="button"
          style={styles.seeAll}
        >
          <Text style={[typography.caption, { color: BRAND.violet, fontWeight: '800' }]}>
            {action}
          </Text>
          <Ionicons name="chevron-forward" size={13} color={BRAND.violet} />
        </Pressable>
      )}
    </View>
  );
}

/** Story-style circular avatar with a gradient ring. */
function BirthdayBubble({
  person,
  today,
  caption,
  onPress,
}: {
  person: BirthdayPerson;
  today?: boolean;
  caption: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const initial = (person.fullName ?? '').trim().charAt(0).toUpperCase();
  const firstName = (person.fullName ?? '').trim().split(' ')[0];

  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!today) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow, today]);

  const ringColors: readonly [string, string, string] = today
    ? [BRAND.gold, BRAND.magenta, BRAND.violet]
    : [colors.border, colors.border, colors.border];

  return (
    <PressScale onPress={onPress}>
      <View style={styles.bubble}>
        <View style={styles.bubbleRingWrap}>
          {today && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.bubbleGlow,
                {
                  opacity: glow.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.15, 0.55],
                  }),
                  transform: [
                    {
                      scale: glow.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.18],
                      }),
                    },
                  ],
                },
              ]}
            />
          )}
          <LinearGradient
            colors={ringColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bubbleRing}
          >
            <View style={[styles.bubbleInner, { backgroundColor: colors.surface }]}>
              {person.profilePhotoUrl ? (
                <Image source={{ uri: person.profilePhotoUrl }} style={styles.bubbleImg} />
              ) : (
                <LinearGradient
                  colors={[BRAND.violet, BRAND.magenta]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.bubbleImg, styles.center]}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 20 }}>
                    {initial}
                  </Text>
                </LinearGradient>
              )}
            </View>
          </LinearGradient>
          <View
            style={[
              styles.bubbleBadge,
              { backgroundColor: today ? BRAND.gold : colors.surface, borderColor: colors.surface },
            ]}
          >
            <Ionicons
              name={today ? 'gift' : 'gift-outline'}
              size={12}
              color={today ? BRAND.deep : colors.textSecondary}
            />
          </View>
        </View>

        <Text
          style={[
            typography.caption,
            { color: colors.text, fontWeight: '800', marginTop: 8, maxWidth: 76 },
          ]}
          numberOfLines={1}
        >
          {firstName}
        </Text>
        <Text
          style={[
            typography.caption,
            {
              color: today ? BRAND.magenta : colors.textSecondary,
              fontSize: 10,
              fontWeight: '700',
              maxWidth: 76,
            },
          ]}
          numberOfLines={1}
        >
          {caption}
        </Text>
      </View>
    </PressScale>
  );
}

/* ===================================================================== */

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },

  // hero
  hero: {
    paddingHorizontal: 18,
    paddingBottom: 58,
    borderBottomLeftRadius: 38,
    borderBottomRightRadius: 38,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', width: 190, height: 190, borderRadius: 95 },
  ringA: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  ringB: {
    position: 'absolute',
    top: -90,
    right: -90,
    width: 330,
    height: 330,
    borderRadius: 165,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  kickerPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  heroKicker: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 12,
    letterSpacing: -0.4,
    lineHeight: 36,
  },
  tagline: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    lineHeight: 20,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  heroDate: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '700',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
  },
  chipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  bell: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: BRAND.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },

  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(245,158,11,0.96)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  warnIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warnTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  warnCta: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 2,
    textDecorationLine: 'underline',
  },

  // quick tiles
  bento: { gap: 12, marginBottom: 22 },
  bentoRow: { flexDirection: 'row', gap: 12 },
  tile: {
    height: 108,
    borderRadius: 26,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  tileWatermark: { position: 'absolute', right: -16, bottom: -20 },
  tileChip: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  tileFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileLabel: { fontSize: 15, fontWeight: '800', flexShrink: 1 },
  tileArrow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // event card
  eventShadow: {
    borderRadius: 30,
    shadowColor: BRAND.deep,
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  eventFrame: { borderRadius: 32, padding: 2.5 },
  eventCard: {
    height: 280,
    borderRadius: 30,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 14,
  },
  eventTop: { flexDirection: 'row', justifyContent: 'space-between' },
  eventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: BRAND.gold,
  },
  eventBadgeText: { fontSize: 11, fontWeight: '800', color: BRAND.deep },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  countdownText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  eventGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  dateChip: {
    width: 56,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  dateChipDay: { fontSize: 22, fontWeight: '800', color: BRAND.deep, lineHeight: 24 },
  dateChipMonth: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.magenta,
    textTransform: 'uppercase',
  },
  eventTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  eventMetaText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  countBubble: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  countBig: { fontSize: 24, fontWeight: '800', color: BRAND.deep, lineHeight: 28 },
  countSmall: {
    fontSize: 9,
    fontWeight: '800',
    color: BRAND.magenta,
    textTransform: 'uppercase',
    maxWidth: 56,
  },
  goHalo: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BRAND.gold,
  },
  eventGo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BRAND.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // section header
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPill: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 5,
    paddingLeft: 8,
    paddingRight: 2,
  },

  // birthday stories
  storyCard: {
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
  },
  storyRow: {
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'flex-start',
  },
  storyDivider: { width: 1, height: 64, marginHorizontal: 2, alignSelf: 'flex-start' },
  bubble: { alignItems: 'center', width: 78 },
  bubbleRingWrap: { width: 70, height: 70 },
  bubbleGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 37,
    backgroundColor: BRAND.gold,
  },
  bubbleRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleImg: { width: 56, height: 56, borderRadius: 28 },
  bubbleBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // notifications
  listCard: { borderRadius: 26, borderWidth: 1, overflow: 'hidden' },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  roundIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND.magenta,
  },

  // announcements timeline
  timelineLine: { position: 'absolute', left: 9, top: 26, bottom: 26, width: 2, borderRadius: 1 },
  timelineItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  timelineDotWrap: { width: 20, alignItems: 'center', marginRight: 10 },
  timelineDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
  annCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  annGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  annArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  annMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
  },

  // bible study
  soon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
  },
  soonWatermark: { position: 'absolute', right: -10, bottom: -26 },
  soonIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: BRAND.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soonPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});