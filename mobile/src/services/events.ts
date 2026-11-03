import { apiGet, apiPost, apiDelete, http } from './api';
import { queryClient } from './queryClient';
import { queryKeys } from './queryKeys';

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
  dateEthYear: number;
  dateEthMonth: number;
  dateEthDay: number;
  location: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'DELETED';
  coverImageUrl: string | null;
  publishedAt: string | null;
};

// ---------- Member (uncached here — TanStack owns the cache) ----------

export async function listEvents(
  scope: 'upcoming' | 'past',
): Promise<EventSummary[]> {
  const res = await apiGet<{ items: EventSummary[] }>(`/events?scope=${scope}`);
  return res.items;
}

export async function getEvent(id: string): Promise<EventDetail> {
  const res = await apiGet<{ event: EventDetail }>(`/events/${id}`);
  return res.event;
}

// ---------- Mutations (invalidate via TanStack) ----------

/**
 * Invalidate every events cache entry for the current user scope.
 * Reads the scope from the persisted query key shape, so this works
 * from anywhere — including outside React.
 */
function invalidateEvents(userId: string | null): Promise<void> {
  // Invalidate the event detail + both scopes + the leader list in one pass.
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: ['events', userId ?? 'anon'],
    }),
  ]).then(() => undefined);
}

export async function rsvp(
  id: string,
  response: RsvpResponse,
  userId: string | null,
): Promise<void> {
  await apiPost(`/events/${id}/rsvp`, { response });
  await invalidateEvents(userId);
}

export async function clearRsvp(id: string, userId: string | null): Promise<void> {
  await apiDelete(`/events/${id}/rsvp`);
  await invalidateEvents(userId);
}

// ---------- Leader ----------

export async function leaderListEvents(): Promise<LeaderEventRow[]> {
  const res = await apiGet<{ items: LeaderEventRow[] }>('/leaders/events');
  return res.items;
}

/**
 * Leader view of an event (used by the editor when editing).
 * Falls back to the member endpoint's data shape via `getEvent` — the leader
 * endpoint returns the same base data plus RSVPs, which the editor does not
 * use. To avoid a second endpoint we simply reuse `getEvent`.
 */
export async function leaderGetEvent(id: string): Promise<EventDetail> {
  return getEvent(id);
}

export type CreateEventInput = {
  title: string;
  description?: string;
  location?: string;
  date: string;
  publish: boolean;
  coverUri?: string | null;
  attachmentUris?: string[];
};

export async function leaderCreateEvent(
  input: CreateEventInput,
  userId: string | null,
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
  await invalidateEvents(userId);
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
  userId: string | null,
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
  await invalidateEvents(userId);
}

export async function leaderDeleteEvent(
  id: string,
  userId: string | null,
): Promise<void> {
  await apiDelete(`/leaders/events/${id}`);
  await invalidateEvents(userId);
}