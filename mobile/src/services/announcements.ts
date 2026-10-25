import { apiGet, apiDelete, http } from './api';
import { cachedFetch, cacheInvalidatePrefix } from './cache';
import { CACHE_KEYS, CACHE_PREFIXES } from './cacheKeys';

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
  event: { id: string; title: string; date: string } | null;
};

export type LeaderAnnouncementRow = {
  id: string;
  title: string;
  status: AnnouncementStatus;
  publishAt: string;
  imageUrl: string | null;
  eventId: string | null;
};

export async function listAnnouncements(
  search?: string,
): Promise<AnnouncementSummary[]> {
  const key = CACHE_KEYS.announcementsList(search ?? '');
  const cached = await cachedFetch<AnnouncementSummary[]>(
    key,
    async () => {
      const q = search?.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : '';
      const res = await apiGet<{ items: AnnouncementSummary[] }>(
        `/announcements${q}`,
      );
      return res.items;
    },
    () => {},
  );
  return cached ?? [];
}

export async function getAnnouncement(
  id: string,
): Promise<AnnouncementDetail> {
  const key = CACHE_KEYS.announcementDetail(id);
  const cached = await cachedFetch<AnnouncementDetail>(
    key,
    async () => {
      const res = await apiGet<{ item: AnnouncementDetail }>(
        `/announcements/${id}`,
      );
      return res.item;
    },
    () => {},
  );
  if (cached) return cached;
  const res = await apiGet<{ item: AnnouncementDetail }>(`/announcements/${id}`);
  return res.item;
}

export async function leaderListAnnouncements(): Promise<
  LeaderAnnouncementRow[]
> {
  const res = await apiGet<{ items: LeaderAnnouncementRow[] }>(
    '/leaders/announcements',
  );
  return res.items;
}

export type CreateAnnouncementInput = {
  title: string;
  message: string;
  publishAt: string;
  publish: boolean;
  eventId?: string | null;
  imageUri?: string | null;
  songs?: { songId: string; songTitle: string }[]; // NEW
};

export async function leaderCreateAnnouncement(
  input: CreateAnnouncementInput,
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
  await cacheInvalidatePrefix(CACHE_PREFIXES.announcements);
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
  await cacheInvalidatePrefix(CACHE_PREFIXES.announcements);
}

export async function leaderDeleteAnnouncement(id: string): Promise<void> {
  await apiDelete(`/leaders/announcements/${id}`);
  await cacheInvalidatePrefix(CACHE_PREFIXES.announcements);
}