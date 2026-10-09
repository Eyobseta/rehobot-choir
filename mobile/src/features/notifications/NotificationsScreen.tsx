import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import {
  listNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  NotificationItem,
  NotificationType,
} from '../../services/notifications';
import { ApiError } from '../../services/api';
import { setUnread } from '../../services/unreadStore';

type Props = {
  navigation: any;
};

export default function NotificationsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listNotifications();
      setItems(list);
      setUnread(list.filter((n) => !n.readAt).length);
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const onMarkAllRead = async () => {
    try {
      await markAllRead();
      setItems((prev) =>
        prev.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })),
      );
      setUnread(0);
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    }
  };

  const onOpen = async (item: NotificationItem) => {
    // Mark as read (best-effort).
    if (!item.readAt) {
      try {
        await markRead(item.id);
        const updated = items.map((x) =>
          x.id === item.id ? { ...x, readAt: new Date().toISOString() } : x,
        );
        setItems(updated);
        setUnread(updated.filter((n) => !n.readAt).length);
      } catch {
        // ignore
      }
    }

    // Deep-link based on relatedEntityType.
    const entityType = item.relatedEntityType;
    const entityId = item.relatedEntityId;
    if (!entityType || !entityId) return;

    const parent = navigation.getParent();
    switch (entityType) {
      case 'Announcement':
        parent?.navigate('Home', {
          screen: 'AnnouncementDetail',
          params: { id: entityId },
        });
        break;
      case 'Song':
        parent?.navigate('Songs', {
          screen: 'SongDetail',
          params: { id: entityId },
        });
        break;
      case 'Memory':
        parent?.navigate('Memories', {
          screen: 'MemoryDetail',
          params: { id: entityId },
        });
        break;
      case 'Event':
        parent?.navigate('Home', {
          screen: 'EventDetail',
          params: { id: entityId },
        });
        break;
      case 'DailyQuote':
        parent?.navigate('Home', {
          screen: 'DailyQuoteHistory',
        });
        break;
      default:
        // Unknown target — do nothing.
        break;
    }
  };

  const onDelete = (item: NotificationItem) => {
    Alert.alert(t('notifications.delete'), item.title, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('notifications.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNotification(item.id);
            const updated = items.filter((x) => x.id !== item.id);
            setItems(updated);
            setUnread(updated.filter((n) => !n.readAt).length);
          } catch (e) {
            const err = e as ApiError;
            setError(`${err.message} [${err.code}]`);
          }
        },
      },
    ]);
  };

  const iconFor = (type: NotificationType): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'ANNOUNCEMENT':
        return 'megaphone-outline';
      case 'EVENT_REMINDER':
        return 'calendar-outline';
      case 'CHAT_MESSAGE':
        return 'chatbubble-ellipses-outline';
      case 'BIRTHDAY':
        return 'gift-outline';
      case 'SONG_PUBLISHED':
        return 'musical-notes-outline';
      case 'MEMORY_PUBLISHED':
        return 'images-outline';
      case 'LEADERSHIP_CHANGE':
        return 'people-outline';
      case 'DAILY_QUOTE':
        return 'book-outline';
      default:
        return 'notifications-outline';
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        {items.some((i) => !i.readAt) && (
          <Pressable
            onPress={onMarkAllRead}
            style={{
              alignSelf: 'flex-end',
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.primary,
            }}
          >
            <Text style={[typography.caption, { color: colors.primary }]}>
              {t('notifications.markAllRead')}
            </Text>
          </Pressable>
        )}
        {error && (
          <Text
            style={[
              typography.bodySmall,
              { color: colors.error, marginTop: spacing.sm },
            ]}
          >
            {error}
          </Text>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Ionicons
              name="notifications-off-outline"
              size={40}
              color={colors.textSecondary}
            />
            <Text
              style={[
                typography.body,
                { color: colors.textSecondary, marginTop: spacing.md },
              ]}
            >
              {t('notifications.empty')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const unread = !item.readAt;
          return (
            <Pressable
              onPress={() => onOpen(item)}
              onLongPress={() => onDelete(item)}
              style={{
                padding: spacing.md,
                marginBottom: spacing.sm,
                backgroundColor: unread ? colors.surfaceAlt : colors.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: unread ? colors.primary : colors.border,
                flexDirection: 'row',
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={iconFor(item.type)}
                  size={20}
                  color={colors.primaryText}
                />
              </View>

              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text
                  style={[
                    typography.body,
                    { color: colors.text, fontWeight: unread ? '700' : '500' },
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
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textSecondary, marginTop: spacing.xs },
                  ]}
                >
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
              </View>

              {unread && (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: colors.primary,
                    marginLeft: spacing.sm,
                    marginTop: 6,
                  }}
                />
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}