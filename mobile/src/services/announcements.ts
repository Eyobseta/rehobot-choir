import { apiGet, apiDelete, http } from './api';
import { queryClient } from './queryClient';

export type AnnouncementStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'DELETED';

export type AnnouncementSummary = {
  id: string;
  title: string;
  message: string;
  publishAt: string;
  imageUrl: string | null;
  eventId: string | null;
};

export type AnnouncementDetail = AnnouncementSummary & {
  songs: { id: string; songId: string; songTitle: string }[];
  event: {
    id: string;
    title: string;
    date: string;
    dateEthYear: number;
    dateEthMonth: number;
    dateEthDay: number;
  } | null;
};

export type LeaderAnnouncementRow = {
  id: string;
  title: string;
  status: AnnouncementStatus;
  publishAt: string;
  imageUrl: string | null;
  eventId: string | null;
};

// ---------- Member (TanStack owns the cache) ----------

export async function listAnnouncements(
  search?: string,
): Promise<AnnouncementSummary[]> {
  const q = search?.trim()
    ? `?search=${encodeURIComponent(search.trim())}`
    : '';
  const res = await apiGet<{ items: AnnouncementSummary[] }>(
    `/announcements${q}`,
  );
  return res.items;
}

export async function getAnnouncement(
  id: string,
): Promise<AnnouncementDetail> {
  const res = await apiGet<{ item: AnnouncementDetail }>(
    `/announcements/${id}`,
  );
  return res.item;
}

// ---------- Leader ----------

export async function leaderListAnnouncements(): Promise<
  LeaderAnnouncementRow[]
> {
  const res = await apiGet<{ items: LeaderAnnouncementRow[] }>(
    '/leaders/announcements',
  );
  return res.items;
}

// ---------- Mutations (invalidate via TanStack) ----------

function invalidateAnnouncements(userId: string | null): Promise<void> {
  return queryClient
    .invalidateQueries({ queryKey: ['announcements', userId ?? 'anon'] })
    .then(() => undefined);
}

export type CreateAnnouncementInput = {
  title: string;
  message: string;
  publishAt: string;
  publish: boolean;
  eventId?: string | null;
  imageUri?: string | null;
  songs?: { songId: string; songTitle: string }[];
};

export async function leaderCreateAnnouncement(
  input: CreateAnnouncementInput,
  userId: string | null,
): Promise<{ id: string }> {
  const form = new FormData();
  form.append('title', input.title);
  form.append('message', input.message);
  form.append('publishAt', input.publishAt);
  form.append('publish', input.publish ? 'true' : 'false');
  if (input.eventId) form.append('eventId', input.eventId);
  if (input.songs && input.songs.length > 0) {
    form.append('songs', JSON.stringify(input.songs));
  }
  if (input.imageUri) {
    // @ts-expect-error — RN FormData
    form.append('image', {
      uri: input.imageUri,
      name: 'announcement.jpg',
      type: 'image/jpeg',
    });
  }

  const res = await http.post<{ announcement: { id: string } }>(
    '/leaders/announcements',
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
      transformRequest: (d) => d,
    },
  );
  await invalidateAnnouncements(userId);
  return { id: res.data.announcement.id };
}

export type UpdateAnnouncementInput = {
  title?: string;
  message?: string;
  publishAt?: string;
  publish?: boolean;
  removeImage?: boolean;
  imageUri?: string | null;
  songs?: { songId: string; songTitle: string }[];
};

export async function leaderUpdateAnnouncement(
  id: string,
  input: UpdateAnnouncementInput,
  userId: string | null,
): Promise<void> {
  const form = new FormData();
  if (input.title !== undefined) form.append('title', input.title);
  if (input.message !== undefined) form.append('message', input.message);
  if (input.publishAt !== undefined) form.append('publishAt', input.publishAt);
  if (input.publish !== undefined)
    form.append('publish', input.publish ? 'true' : 'false');
  if (input.removeImage !== undefined)
    form.append('removeImage', input.removeImage ? 'true' : 'false');
  if (input.songs !== undefined) {
    form.append('songs', JSON.stringify(input.songs));
  }
  if (input.imageUri) {
    // @ts-expect-error — RN FormData
    form.append('image', {
      uri: input.imageUri,
      name: 'announcement.jpg',
      type: 'image/jpeg',
    });
  }
  await http.patch(`/leaders/announcements/${id}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
    transformRequest: (d) => d,
  });
  await invalidateAnnouncements(userId);
}

export async function leaderDeleteAnnouncement(
  id: string,
  userId: string | null,
): Promise<void> {
  await apiDelete(`/leaders/announcements/${id}`);
  await invalidateAnnouncements(userId);
}