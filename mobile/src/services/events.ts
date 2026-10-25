import { apiGet, apiPost, apiDelete, http } from './api';
import { cachedFetch, cacheInvalidatePrefix } from './cache';
import { CACHE_KEYS, CACHE_PREFIXES } from './cacheKeys';

export type EventSummary = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  date: string;
  dateEthYear?: number;
  dateEthMonth?: number;
  dateEthDay?: number;
  coverImageUrl: string | null;
};

export type EventAttachment = {
  id: string;
  imageUrl: string;
};

export type RsvpResponse = 'GOING' | 'MAYBE' | 'NOT_GOING';

export type RsvpEntry = {
  id: string;
  userId: string;
  response: RsvpResponse;
  updatedAt: string;
};

export type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  date: { year: number; month: number; day: number };
  dateGregorian: string;
  coverImageUrl: string | null;
  attachments: EventAttachment[];
  rsvpClosed: boolean;
  rsvps: RsvpEntry[];
};

export type LeaderEventRow = {
  id: string;
  title: string;
  date: string;
  location: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'DELETED';
  coverImageUrl: string | null;
  publishedAt: string | null;
};

// ---------- Member (cached) ----------

export async function listEvents(
  scope: 'upcoming' | 'past',
): Promise<EventSummary[]> {
  const key =
    scope === 'upcoming' ? CACHE_KEYS.eventsUpcoming : CACHE_KEYS.eventsPast;
  const cached = await cachedFetch<EventSummary[]>(
    key,
    async () => {
      const res = await apiGet<{ items: EventSummary[] }>(
        `/events?scope=${scope}`,
      );
      return res.items;
    },
    () => {},
  );
  return cached ?? [];
}

export async function getEvent(id: string): Promise<EventDetail> {
  const key = CACHE_KEYS.eventDetail(id);
  return (
    (await cachedFetch<EventDetail>(
      key,
      async () => {
        const res = await apiGet<{ event: EventDetail }>(`/events/${id}`);
        return res.event;
      },
      () => {},
    )) ?? (await (async () => {
      const res = await apiGet<{ event: EventDetail }>(`/events/${id}`);
      return res.event;
    })())
  );
}

export async function rsvp(id: string, response: RsvpResponse): Promise<void> {
  await apiPost(`/events/${id}/rsvp`, { response });
  // Refresh cache for this event (the RSVP counts changed)
  await cacheInvalidatePrefix(CACHE_PREFIXES.events);
}

export async function clearRsvp(id: string): Promise<void> {
  await apiDelete(`/events/${id}/rsvp`);
  await cacheInvalidatePrefix(CACHE_PREFIXES.events);
}

// ---------- Leader (uncached — always fresh) ----------

export async function leaderListEvents(): Promise<LeaderEventRow[]> {
  const res = await apiGet<{ items: LeaderEventRow[] }>('/leaders/events');
  return res.items;
}

export type CreateEventInput = {
  title: string;
  description?: string;
  location?: string;
  date: string; // ISO
  publish: boolean;
  coverUri?: string | null;
  attachmentUris?: string[];
};

export async function leaderCreateEvent(
  input: CreateEventInput,
): Promise<{ id: string }> {
  const form = new FormData();
  form.append('title', input.title);
  if (input.description) form.append('description', input.description);
  if (input.location) form.append('location', input.location);
  form.append('date', input.date);
  form.append('publish', input.publish ? 'true' : 'false');

  if (input.coverUri) {
    // @ts-expect-error — RN FormData
    form.append('cover', {
      uri: input.coverUri,
      name: 'cover.jpg',
      type: 'image/jpeg',
    });
  }

  if (input.attachmentUris) {
    for (let i = 0; i < input.attachmentUris.length; i++) {
      // @ts-expect-error — RN FormData
      form.append('attachments', {
        uri: input.attachmentUris[i],
        name: `photo_${i}.jpg`,
        type: 'image/jpeg',
      });
    }
  }

  const res = await http.post<{ event: { id: string } }>(
    '/leaders/events',
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 90_000,
      transformRequest: (data) => data,
    },
  );
  await cacheInvalidatePrefix(CACHE_PREFIXES.events);
  return { id: res.data.event.id };
}

export type UpdateEventInput = {
  title?: string;
  description?: string;
  location?: string;
  date?: string;
  publish?: boolean;
  removeCover?: boolean;
  coverUri?: string | null;
};

export async function leaderUpdateEvent(
  id: string,
  input: UpdateEventInput,
): Promise<void> {
  const form = new FormData();
  if (input.title !== undefined) form.append('title', input.title);
  if (input.description !== undefined)
    form.append('description', input.description);
  if (input.location !== undefined) form.append('location', input.location);
  if (input.date !== undefined) form.append('date', input.date);
  if (input.publish !== undefined)
    form.append('publish', input.publish ? 'true' : 'false');
  if (input.removeCover !== undefined)
    form.append('removeCover', input.removeCover ? 'true' : 'false');

  if (input.coverUri) {
    // @ts-expect-error — RN FormData
    form.append('cover', {
      uri: input.coverUri,
      name: 'cover.jpg',
      type: 'image/jpeg',
    });
  }

  await http.patch(`/leaders/events/${id}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90_000,
    transformRequest: (data) => data,
  });
  await cacheInvalidatePrefix(CACHE_PREFIXES.events);
}

export async function leaderDeleteEvent(id: string): Promise<void> {
  await apiDelete(`/leaders/events/${id}`);
  await cacheInvalidatePrefix(CACHE_PREFIXES.events);
}