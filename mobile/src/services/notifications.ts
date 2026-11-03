import { apiGet, apiPost, apiDelete } from './api';
import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';
import { getPersisterScope } from './queryPersister';

export type NotificationType =
  | 'ANNOUNCEMENT'
  | 'EVENT_REMINDER'
  | 'CHAT_MESSAGE'
  | 'BIRTHDAY'
  | 'SONG_PUBLISHED'
  | 'MEMORY_PUBLISHED'
  | 'LEADERSHIP_CHANGE'
  | 'DAILY_QUOTE';

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
  readAt: string | null;
};

export type NotificationPreferences = {
  announcementsEnabled: boolean;
  eventRemindersEnabled: boolean;
  chatMessagesEnabled: boolean;
  birthdaysEnabled: boolean;
  newSongEnabled: boolean;
  newMemoryEnabled: boolean;
  dailyQuoteEnabled: boolean;
};

export async function listNotifications(
  limit = 60,
): Promise<NotificationItem[]> {
  const res = await apiGet<{ items: NotificationItem[] }>(
    `/notifications?limit=${limit}`,
  );
  return res.items;
}

export async function unreadCount(): Promise<number> {
  const items = await listNotifications(200);
  return items.filter((i) => !i.readAt).length;
}

export async function markRead(id: string): Promise<void> {
  await apiPost(`/notifications/${id}/read`, {});
}

export async function markAllRead(): Promise<void> {
  await apiPost('/notifications/read-all', {});
}

export async function deleteNotification(id: string): Promise<void> {
  await apiDelete(`/notifications/${id}`);
}

export async function getPreferences(): Promise<NotificationPreferences> {
  return apiGet<NotificationPreferences>('/notifications/preferences');
}

export type PreferenceUpdate = Partial<
  Omit<NotificationPreferences, 'chatMessagesEnabled'>
>;

export async function updatePreferences(
  input: PreferenceUpdate,
): Promise<NotificationPreferences> {
  const { http } = await import('./api');
  const res = await http.patch<NotificationPreferences>(
    '/notifications/preferences',
    input,
  );
  return res.data;
}

/**
 * Invalidate the shared notifications list. Safe to call from anywhere —
 * including outside React — because it reads the current scope from
 * `queryPersister` (not from a hook).
 */
export function invalidateNotifications(): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.notifications(getPersisterScope()),
  });
}