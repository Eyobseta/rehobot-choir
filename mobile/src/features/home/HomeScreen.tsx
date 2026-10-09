import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { me } from '../../services/auth';
import { listEvents, EventSummary } from '../../services/events';
import {
  listAnnouncements,
  AnnouncementSummary,
} from '../../services/announcements';
import {
  listBirthdays,
  BirthdayPerson,
  BirthdaysResponse,
} from '../../services/members';
import DailyQuoteCard from '../quotes/DailyQuoteCard';
import {
  listNotifications,
  NotificationItem,
} from '../../services/notifications';
import { setUnread } from '../../services/unreadStore';

export default function HomeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [mustChange, setMustChange] = useState(false);
  const [upcoming, setUpcoming] = useState<EventSummary | null>(null);
  const [recent, setRecent] = useState<AnnouncementSummary[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdaysResponse>({
    today: [],
    tomorrow: [],
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const meResp = await me();
      setMustChange(meResp.user.mustChangePassword);
    } catch {
      // ignore
    }
    try {
      const list = await listEvents('upcoming');
      setUpcoming(list[0] ?? null);
    } catch {
      // ignore
    }
    try {
      const ann = await listAnnouncements();
      setRecent(ann.slice(0, 3));
    } catch {
      // ignore
    }
    try {
      setBirthdays(await listBirthdays());
    } catch {
      // ignore
    }
    try {
      const notifs = await listNotifications(5);
      setNotifications(notifs);
      setUnread(notifs.filter((n) => !n.readAt).length);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.lg,
        backgroundColor: colors.background,
        flexGrow: 1,
      }}
    >
      {/* Temporary password banner */}
      {mustChange && (
        <Pressable
          onPress={() =>
            navigation.navigate('Profile', { screen: 'ChangePassword' })
          }
          style={{
            marginBottom: spacing.lg,
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.warning,
          }}
        >
          <Text
            style={[typography.body, { color: '#FFFFFF', fontWeight: '600' }]}
          >
            {t('password.banner')}
          </Text>
          <Text
            style={[
              typography.bodySmall,
              {
                color: '#FFFFFF',
                marginTop: spacing.xs,
                textDecorationLine: 'underline',
              },
            ]}
          >
            {t('password.bannerCta')}
          </Text>
        </Pressable>
      )}

      {/* Greeting */}
      <Text
        style={{
          fontSize: 30,
          fontWeight: '700',
          color: colors.primary,
          marginTop: spacing.xxl,
          marginBottom: spacing.lg,
        }}
      >
        {t('home.welcome')}
      </Text>

      {/* Daily Bible Quote */}
      <DailyQuoteCard />

      {/* Upcoming event */}
      {upcoming && (
        <Pressable
          onPress={() =>
            navigation.navigate('EventDetail', { id: upcoming.id })
          }
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            overflow: 'hidden',
            marginBottom: spacing.lg,
          }}
        >
          {upcoming.coverImageUrl && (
            <Image
              source={{ uri: upcoming.coverImageUrl }}
              style={{ width: '100%', height: 140 }}
            />
          )}
          <View style={{ padding: spacing.md }}>
            <Text style={[typography.caption, { color: colors.primary }]}>
              {t('events.upcoming')}
            </Text>
            <Text
              style={[
                typography.body,
                { color: colors.text, fontWeight: '600', marginTop: spacing.xs },
              ]}
              numberOfLines={1}
            >
              {upcoming.title}
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginTop: 2 },
              ]}
            >
              {new Date(upcoming.date).toLocaleString()}
            </Text>
          </View>
        </Pressable>
      )}

      {/* Quick tiles */}
      <View
        style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}
      >
        <QuickTile
          icon="musical-notes"
          label={t('tabs.songs')}
          onPress={() => navigation.getParent()?.navigate('Songs')}
        />
        <QuickTile
          icon="images"
          label={t('tabs.memories')}
          onPress={() => navigation.getParent()?.navigate('Memories')}
        />
        <QuickTile
          icon="calendar"
          label={t('events.title')}
          onPress={() => navigation.navigate('EventsList')}
        />
        <QuickTile
          icon="people"
          label={t('directory.title')}
          onPress={() => navigation.navigate('Directory')}
        />
      </View>

      {/* Notifications preview */}
      {notifications.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing.sm,
            }}
          >
            <Text style={[typography.h3, { color: colors.text }]}>
              {t('notifications.title')}
            </Text>
            <Pressable
              onPress={() =>
                navigation.navigate('Profile', { screen: 'Notifications' })
              }
              style={{ paddingVertical: spacing.xs }}
            >
              <Text style={[typography.caption, { color: colors.primary }]}>
                {t('home.seeAll')}
              </Text>
            </Pressable>
          </View>
          {notifications.slice(0, 3).map((n) => {
            const unread = !n.readAt;
            return (
              <Pressable
                key={n.id}
                onPress={() =>
                  navigation.navigate('Profile', { screen: 'Notifications' })
                }
                style={{
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  backgroundColor: unread ? colors.surfaceAlt : colors.surface,
                  borderColor: unread ? colors.primary : colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {unread && (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: colors.primary,
                        marginRight: spacing.sm,
                      }}
                    />
                  )}
                  <Text
                    style={[
                      typography.bodySmall,
                      {
                        color: colors.text,
                        fontWeight: unread ? '700' : '500',
                        flex: 1,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {n.title}
                  </Text>
                </View>
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
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Birthdays */}
      {(birthdays.today.length > 0 || birthdays.tomorrow.length > 0) && (
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            style={[
              typography.h3,
              { color: colors.text, marginBottom: spacing.sm },
            ]}
          >
            {t('home.birthdays')}
          </Text>
          {birthdays.today.length > 0 && (
            <>
              <Text
                style={[
                  typography.caption,
                  { color: colors.primary, marginBottom: spacing.xs },
                ]}
              >
                {t('home.birthdayToday')}
              </Text>
              {birthdays.today.map((b) => (
                <BirthdayRow key={b.userId} person={b} />
              ))}
            </>
          )}
          {birthdays.tomorrow.length > 0 && (
            <>
              <Text
                style={[
                  typography.caption,
                  {
                    color: colors.textSecondary,
                    marginTop: spacing.sm,
                    marginBottom: spacing.xs,
                  },
                ]}
              >
                {t('home.birthdayTomorrow')}
              </Text>
              {birthdays.tomorrow.map((b) => (
                <BirthdayRow key={b.userId} person={b} />
              ))}
            </>
          )}
        </View>
      )}

      {/* Announcements */}
      <View style={{ marginBottom: spacing.lg }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.sm,
          }}
        >
          <Text style={[typography.h3, { color: colors.text }]}>
            {t('announcements.recent')}
          </Text>
          <Pressable
            onPress={() => navigation.navigate('AnnouncementsList')}
            style={{ paddingVertical: spacing.xs }}
          >
            <Text style={[typography.caption, { color: colors.primary }]}>
              {t('home.seeAll')}
            </Text>
          </Pressable>
        </View>
        {recent.length === 0 ? (
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            {t('announcements.empty')}
          </Text>
        ) : (
          recent.map((a) => (
            <Pressable
              key={a.id}
              onPress={() =>
                navigation.navigate('AnnouncementDetail', { id: a.id })
              }
              style={{
                padding: spacing.md,
                marginBottom: spacing.sm,
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
              }}
            >
              <Text
                style={[
                  typography.body,
                  { color: colors.text, fontWeight: '600' },
                ]}
                numberOfLines={1}
              >
                {a.title}
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: colors.textSecondary, marginTop: 2 },
                ]}
                numberOfLines={1}
              >
                {new Date(a.publishAt).toLocaleString()}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      {/* Bible Study / Fetua coming soon */}
      <View
        style={{
          padding: spacing.lg,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceAlt,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="book-outline" size={22} color={colors.primary} />
          <Text
            style={[typography.h3, { color: colors.text, marginLeft: spacing.sm }]}
          >
            {t('home.bibleStudy')}
          </Text>
        </View>
        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, marginTop: spacing.xs },
          ]}
        >
          {t('home.comingSoon')}
        </Text>
      </View>

      {loading && (
        <ActivityIndicator
          style={{ marginTop: spacing.lg }}
          color={colors.primary}
        />
      )}
    </ScrollView>
  );

  function QuickTile({
    icon,
    label,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={{
          flex: 1,
          paddingVertical: spacing.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: 'center',
        }}
      >
        <Ionicons name={icon} size={26} color={colors.primary} />
        <Text
          style={[
            typography.caption,
            { color: colors.text, marginTop: spacing.xs, textAlign: 'center' },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

    function BirthdayRow({ person }: { person: BirthdayPerson }) {
    return (
      <Pressable
        onPress={() =>
          navigation.navigate('BirthdayDetail', { postId: person.postId })
        }
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.sm,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: spacing.xs,
        }}
      >
        {person.profilePhotoUrl ? (
          <Image
            source={{ uri: person.profilePhotoUrl }}
            style={{ width: 36, height: 36, borderRadius: 18 }}
          />
        ) : (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.surfaceAlt,
            }}
          />
        )}
        <Text
          style={[
            typography.body,
            { color: colors.text, marginLeft: spacing.sm, flex: 1 },
          ]}
          numberOfLines={1}
        >
          {person.fullName}
        </Text>
        <Ionicons
          name="heart-outline"
          size={18}
          color={colors.primary}
          style={{ marginRight: spacing.sm }}
        />
        <Ionicons
          name="chatbubble-outline"
          size={16}
          color={colors.textSecondary}
          style={{ marginRight: spacing.sm }}
        />
        <Ionicons name="gift-outline" size={20} color={colors.primary} />
      </Pressable>
    );
  }
}