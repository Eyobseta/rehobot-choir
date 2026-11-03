import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import type {
  NotificationItem,
  NotificationType,
} from '../../services/notifications';
import { BRAND, withAlpha, ErrorBanner } from '../auth/Auth_UI';
import { ScreenHero } from '../profile/SettingsKit';
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsQuery,
  useUnreadNotifications,
} from './useNotifications';
import { useHomeUnreadSync } from '../home/useHomeUnreadSync';

type Props = { navigation: any };
type IconName = keyof typeof Ionicons.glyphMap;

export default function NotificationsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const q = useNotificationsQuery();
  useHomeUnreadSync();

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  const items = q.data ?? [];
  const unread = useUnreadNotifications(q.data);
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  const navigateToEntity = useCallback(
    (
      item:
        | NotificationItem
        | { type?: string; entityType?: string | null; entityId?: string | null },
    ) => {
      const entityType =
        'relatedEntityType' in item ? item.relatedEntityType : item.entityType;
      const entityId =
        'relatedEntityId' in item ? item.relatedEntityId : item.entityId;
      if (!entityType) return;

      const parent = navigation.getParent();
      const root = parent ?? navigation;

      switch (entityType) {
        case 'Announcement':
          if (entityId) {
            if (navigation.getState().routeNames.includes('AnnouncementDetail')) {
              navigation.navigate('AnnouncementDetail', { id: entityId });
            } else {
              root.navigate('Home', {
                screen: 'AnnouncementDetail',
                params: { id: entityId },
              });
            }
          }
          break;

        case 'Song':
          if (entityId) {
            if (navigation.getState().routeNames.includes('SongDetail')) {
              navigation.navigate('SongDetail', { id: entityId });
            } else {
              root.navigate('Songs', {
                screen: 'SongDetail',
                params: { id: entityId },
              });
            }
          }
          break;

        case 'Memory':
          if (entityId) {
            if (navigation.getState().routeNames.includes('MemoryDetail')) {
              navigation.navigate('MemoryDetail', { id: entityId });
            } else {
              root.navigate('Memories', {
                screen: 'MemoryDetail',
                params: { id: entityId },
              });
            }
          }
          break;

        case 'Event':
          if (entityId) {
            if (navigation.getState().routeNames.includes('EventDetail')) {
              navigation.navigate('EventDetail', { id: entityId });
            } else {
              root.navigate('Home', {
                screen: 'EventDetail',
                params: { id: entityId },
              });
            }
          }
          break;

        case 'DailyQuote':
          root.navigate('Home', { screen: 'DailyQuoteHistory' });
          break;

        case 'ChatConversation':
          if (entityId) {
            root.navigate('Chat', {
              screen: 'Conversation',
              params: { conversationId: entityId },
            });
          }
          break;

        case 'AnnualContributionRecord':
        case 'SpecialDonationPayment':
        case 'SpecialDonationCampaign':
          root.navigate('Profile', { screen: 'Funding' });
          break;

        case 'BirthdayPost':
          if (entityId) {
            if (navigation.getState().routeNames.includes('BirthdayDetail')) {
              navigation.navigate('BirthdayDetail', { postId: entityId });
            } else {
              root.navigate('Home', {
                screen: 'BirthdayDetail',
                params: { postId: entityId },
              });
            }
          }
          break;

        case 'LeadershipHistory':
          break;

        default:
          break;
      }
    },
    [navigation],
  );

  // Push tap handler — unchanged.
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (cancelled) return;
        sub = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response?.notification?.request?.content?.data as
            | { entityType?: string | null; entityId?: string | null }
            | undefined;
          if (!data) return;
          setTimeout(() => {
            try {
              navigateToEntity(data);
            } catch {
              /* ignore */
            }
          }, 0);
        });
      } catch {
        /* expo-notifications unavailable */
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [navigateToEntity]);

  const onOpen = (item: NotificationItem) => {
    if (!item.readAt) {
      markRead.mutate(item.id); // fire-and-forget; invalidates on success
    }
    navigateToEntity(item);
  };

  const onDelete = (item: NotificationItem) => {
    Alert.alert(t('notifications.delete'), item.title, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('notifications.delete'),
        style: 'destructive',
        onPress: () => deleteNotification.mutate(item.id),
      },
    ]);
  };

  const onMarkAllRead = () => markAllRead.mutate();

  const iconFor = (type: NotificationType): IconName => {
    switch (type) {
      case 'ANNOUNCEMENT': return 'megaphone-outline';
      case 'EVENT_REMINDER': return 'calendar-outline';
      case 'CHAT_MESSAGE': return 'chatbubble-ellipses-outline';
      case 'BIRTHDAY': return 'gift-outline';
      case 'SONG_PUBLISHED': return 'musical-notes-outline';
      case 'MEMORY_PUBLISHED': return 'images-outline';
      case 'LEADERSHIP_CHANGE': return 'people-outline';
      case 'DAILY_QUOTE': return 'book-outline';
      default: return 'notifications-outline';
    }
  };

  const tintFor = (type: NotificationType): string => {
    switch (type) {
      case 'ANNOUNCEMENT': return '#B6A0FF';
      case 'EVENT_REMINDER': return '#6EDBD5';
      case 'CHAT_MESSAGE': return '#B8E986';
      case 'BIRTHDAY': return '#EE9BBD';
      case 'SONG_PUBLISHED': return '#E6C779';
      case 'MEMORY_PUBLISHED': return '#6EDBD5';
      case 'LEADERSHIP_CHANGE': return '#B6A0FF';
      case 'DAILY_QUOTE': return '#E6C779';
      default: return '#B6A0FF';
    }
  };

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

  const unreadCount = unread.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHero
        icon="notifications"
        title={t('notifications.title')}
        subtitle={
          unreadCount > 0
            ? t('notifications.unreadCount', {
                count: unreadCount,
                defaultValue: '{{count}} unread',
              })
            : t('notifications.allCaughtUp', {
                defaultValue: "You're all caught up",
              })
        }
        onBack={() => navigation.goBack()}
      />

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
              backgroundColor: withAlpha('#F59E0B', 0.14),
              borderWidth: 1,
              borderColor: withAlpha('#F59E0B', 0.4),
            }}
          >
            <Ionicons name="cloud-offline" size={13} color="#F59E0B" />
            <Text
              style={[
                typography.caption,
                { color: '#F59E0B', fontWeight: '800' },
              ]}
            >
              {t('home.showingSavedData', {
                defaultValue: 'Showing saved data',
              })}
            </Text>
          </View>
        </View>
      )}

      {q.isError && q.data === undefined && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <ErrorBanner
            message={
              (q.error as { message?: string })?.message ??
              t('common.error', { defaultValue: 'Something went wrong.' })
            }
          />
        </View>
      )}

      {unreadCount > 0 && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <Pressable
            onPress={onMarkAllRead}
            disabled={markAllRead.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('notifications.markAllRead')}
            style={({ pressed }) => [
              styles.markAll,
              {
                backgroundColor: withAlpha(BRAND.violet, 0.14),
                borderColor: withAlpha(BRAND.violet, 0.45),
                opacity: pressed || markAllRead.isPending ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="checkmark-done" size={16} color={BRAND.violet} />
            <Text
              style={[
                typography.caption,
                { color: BRAND.violet, fontWeight: '800', marginLeft: 6 },
              ]}
            >
              {t('notifications.markAllRead')}
            </Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xl * 2,
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
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <LinearGradient
              colors={[BRAND.violet, BRAND.magenta, BRAND.gold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emptyRing}
            >
              <View style={[styles.emptyInner, { backgroundColor: colors.background }]}>
                <Ionicons
                  name="notifications-off-outline"
                  size={40}
                  color={colors.textSecondary}
                />
              </View>
            </LinearGradient>
            <Text
              style={[
                typography.body,
                {
                  color: colors.textSecondary,
                  marginTop: spacing.lg,
                  textAlign: 'center',
                },
              ]}
            >
              {t('notifications.empty')}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <NotificationCard
            item={item}
            index={index}
            icon={iconFor(item.type)}
            tint={tintFor(item.type)}
            onOpen={() => onOpen(item)}
            onDelete={() => onDelete(item)}
          />
        )}
      />
    </View>
  );
}

// ---------- Card (unchanged visuals) ----------

function NotificationCard({
  item,
  index,
  icon,
  tint,
  onOpen,
  onDelete,
}: {
  item: NotificationItem;
  index: number;
  icon: IconName;
  tint: string;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const unread = !item.readAt;

  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [enter, index]);

  const to = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      speed: 40,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View
      style={{
        marginBottom: spacing.sm + 2,
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
          { scale },
        ],
      }}
    >
      <Pressable
        onPress={onOpen}
        onLongPress={onDelete}
        onPressIn={() => to(0.98)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        style={[
          styles.card,
          {
            backgroundColor: unread ? colors.surfaceAlt : colors.surface,
            borderColor: unread ? withAlpha(tint, 0.55) : colors.border,
          },
        ]}
      >
        {unread && (
          <LinearGradient
            colors={[BRAND.violet, BRAND.magenta]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.unreadBar}
          />
        )}

        <View
          style={[
            styles.iconTile,
            { backgroundColor: withAlpha(tint, unread ? 0.22 : 0.14) },
          ]}
        >
          <Ionicons name={icon} size={22} color={tint} />
        </View>

        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text
            style={[
              typography.body,
              { color: colors.text, fontWeight: unread ? '800' : '500' },
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {item.body && (
            <Text
              style={[
                typography.bodySmall,
                { color: colors.textSecondary, marginTop: 2 },
              ]}
              numberOfLines={2}
            >
              {item.body}
            </Text>
          )}
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </View>
        </View>

        {unread && <View style={styles.dot} />}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingLeft: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  unreadBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: BRAND.magenta,
    marginLeft: 10,
    shadowColor: BRAND.magenta,
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  emptyRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyInner: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
});