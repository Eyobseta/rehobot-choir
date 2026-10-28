import { apiGet, apiDelete, http } from './api';
import { cachedFetch, cacheInvalidatePrefix, cacheRead, cacheWrite } from './cache';
import { CACHE_KEYS, CACHE_PREFIXES } from './cacheKeys';

export type MemoryMediaType = 'PHOTO' | 'AUDIO' | 'YOUTUBE';

export type MemoryMediaItem = {
  id: string;
  type: MemoryMediaType;
  storageUrl: string | null;
  youtubeUrl: string | null;
};

export type MemorySummary = {
  id: string;
  title: string;
  description: string | null;
  dateEthYear: number;
  dateEthMonth: number;
  dateEthDay: number;
  dateGregorian: string;
  media: { id: string; type: MemoryMediaType; storageUrl: string | null }[];
};

export type MemoryDetail = {
  id: string;
  title: string;
  description: string | null;
  dateEthYear: number;
  dateEthMonth: number;
  dateEthDay: number;
  dateGregorian: string;
  status: 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'DELETED';
  rejectionReason?: string | null;
  media: MemoryMediaItem[];
};

export type MemoryYear = {
  year: number;
  count: number;
};

export type MyMemoryRow = {
  id: string;
  title: string;
  dateEthYear: number;
  dateEthMonth: number;
  dateEthDay: number;
  status: 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'DELETED';
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

// ---------- Member (cached) ----------

export async function listMemories(search?: string): Promise<MemorySummary[]> {
  const key = CACHE_KEYS.memoriesList(search ?? '');
  const cached = await cachedFetch<MemorySummary[]>(
    key,
    async () => {
      const q = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const res = await apiGet<{ items: MemorySummary[] }>(`/memories${q}`);
      return res.items;
    },
    () => {},
  );
  return cached ?? [];
}

export async function listMemoryYears(): Promise<MemoryYear[]> {
  const cached = await cachedFetch<MemoryYear[]>(
    CACHE_KEYS.memoryYears,
    async () => {
      const res = await apiGet<{ items: MemoryYear[] }>('/memories/years');
      return res.items;
    },
    () => {},
  );
  return cached ?? [];
}

export async function getMemory(id: string): Promise<MemoryDetail> {
  const key = CACHE_KEYS.memoryDetail(id);
  const cached = await cachedFetch<MemoryDetail>(
    key,
    async () => {
      const res = await apiGet<{ item: MemoryDetail }>(`/memories/${id}`);
      return res.item;
    },
    () => {},
  );
  if (cached) return cached;
  const res = await apiGet<{ item: MemoryDetail }>(`/memories/${id}`);
  return res.item;
}

/**
 * Own memory (may be pending/rejected). Cached under the same memoryDetail:<id>
 * key so an offline open of one's own memory works after the first online
 * visit, and so the public detail screen can reuse the cached value.
 */
export async function getMyMemory(id: string): Promise<MemoryDetail> {
  const key = CACHE_KEYS.memoryDetail(id);
  const cached = await cacheRead<MemoryDetail>(key);
  if (cached) {
    // Best-effort refresh in background; swallow failures (offline case).
    void (async () => {
      try {
        const res = await apiGet<{ item: MemoryDetail }>(`/memories/mine/${id}`);
        await cacheWrite(key, res.item);
      } catch {
        /* offline or not allowed — keep cached copy */
      }
    })();
    return cached;
  }
  const res = await apiGet<{ item: MemoryDetail }>(`/memories/mine/${id}`);
  await cacheWrite(key, res.item);
  return res.item;
}

/** Look up a single cached memory by id. Returns undefined if not cached. */
export async function getCachedMemoryById(id: string): Promise<MemoryDetail | undefined> {
  return cacheRead<MemoryDetail>(CACHE_KEYS.memoryDetail(id));
}

export async function listMyMemories(): Promise<MyMemoryRow[]> {
  const cached = await cachedFetch<MyMemoryRow[]>(
    CACHE_KEYS.myMemories,
    async () => {
      const res = await apiGet<{ items: MyMemoryRow[] }>('/memories/mine');
      return res.items;
    },
    () => {},
  );
  return cached ?? [];
}

export type SubmitMemoryInput = {
  title: string;
  description?: string;
  date: { year: number; month: number; day: number };
  photoUris?: string[];
  audioUri?: string | null;
  audioName?: string | null;
  audioMime?: string | null;
  youtubeUrls?: string[];
};

export async function submitMemory(input: SubmitMemoryInput): Promise<{ id: string }> {
  const form = new FormData();
  form.append('title', input.title);
  if (input.description) form.append('description', input.description);
  form.append('date', JSON.stringify(input.date));

  if (input.youtubeUrls && input.youtubeUrls.length > 0) {
    form.append('youtubeUrls', JSON.stringify(input.youtubeUrls));
  }

  for (let i = 0; i < (input.photoUris ?? []).length; i++) {
    const uri = input.photoUris![i];
    // @ts-expect-error — RN FormData
    form.append('photos', { uri, name: `photo_${i}.jpg`, type: 'image/jpeg' });
  }

  if (input.audioUri) {
    // @ts-expect-error — RN FormData
    form.append('audio', {
      uri: input.audioUri,
      name: input.audioName ?? 'audio.m4a',
      type: input.audioMime ?? 'audio/m4a',
    });
  }

  const res = await http.post<{ memory: { id: string } }>('/memories', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
    transformRequest: (d) => d,
  });
  await cacheInvalidatePrefix(CACHE_PREFIXES.memories);
  return { id: res.data.memory.id };
}

// ---------- Memory warm-up (one-time per app session) ----------

// Guard so the warm-up runs at most once per app process. Resets on cold
// start (module re-evaluated) and on logout (cache cleared).
let warmedMemoryDetailThisSession = false;

/** Test/diagnostic reset — force a re-warm without a full app reload. */
export function resetMemoryWarmGuard(): void {
  warmedMemoryDetailThisSession = false;
}

/**
 * Prefetch the full detail of every memory into the cache, so memories
 * (title, description, media URLs) are available offline for the entire
 * library — not only for entries the member has opened while online.
 *
 * Behavior:
 *  - Runs at most once per app session.
 *  - Skips memories whose detail is already cached.
 *  - Fetches with a concurrency cap of 3 and a small pause between batches.
 *  - Never throws: failures are swallowed.
 */
export async function warmMemoryDetailCache(): Promise<void> {
  if (warmedMemoryDetailThisSession) return;
  warmedMemoryDetailThisSession = true;

  try {
    const summaries = await listMemories();
    if (summaries.length === 0) return;

    const missing: string[] = [];
    for (const s of summaries) {
      const cached = await cacheRead<MemoryDetail>(CACHE_KEYS.memoryDetail(s.id));
      if (!cached) missing.push(s.id);
    }
    if (missing.length === 0) return;

    const CONCURRENCY = 3;
    const BATCH_PAUSE_MS = 200;

    for (let i = 0; i < missing.length; i += CONCURRENCY) {
      const batch = missing.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (id) => {
          try {
            await getMemory(id);
          } catch {
            /* skip, try next session */
          }
        }),
      );
      if (i + CONCURRENCY < missing.length) {
        await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
      }
    }
  } catch {
    /* never break the UI */
  }
}

// ---------- Leader ----------

export type PendingMemory = {
  id: string;
  title: string;
  description: string | null;
  dateEthYear: number;
  dateEthMonth: number;
  dateEthDay: number;
  dateGregorian: string;
  status: 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED';
  media: MemoryMediaItem[];
  submittedBy: {
    id: string;
    memberProfile: { fullName: string; profilePhotoUrl: string | null } | null;
  };
};

export async function leaderListPendingMemories(): Promise<PendingMemory[]> {
  const res = await apiGet<{ items: PendingMemory[] }>('/leaders/memories/pending');
  return res.items;
}

export async function leaderGetMemory(id: string): Promise<PendingMemory> {
  const res = await apiGet<{ item: PendingMemory }>(`/leaders/memories/${id}`);
  return res.item;
}

export async function leaderApproveMemory(id: string): Promise<void> {
  await http.post(`/leaders/memories/${id}/approve`, {});
  await cacheInvalidatePrefix(CACHE_PREFIXES.memories);
}

export async function leaderRejectMemory(id: string, reason?: string): Promise<void> {
  await http.post(`/leaders/memories/${id}/reject`, { reason: reason ?? '' });
  await cacheInvalidatePrefix(CACHE_PREFIXES.memories);
}

export type LeaderEditMemoryInput = {
  title?: string;
  description?: string;
  date?: { year: number; month: number; day: number };
  replaceMedia?: boolean;
  photoUris?: string[];
  audioUri?: string | null;
  audioName?: string | null;
  audioMime?: string | null;
  youtubeUrls?: string[];
};

export async function leaderEditMemory(id: string, input: LeaderEditMemoryInput): Promise<void> {
  const form = new FormData();
  if (input.title !== undefined) form.append('title', input.title);
  if (input.description !== undefined) form.append('description', input.description);
  if (input.date !== undefined) form.append('date', JSON.stringify(input.date));

  form.append('replaceMedia', input.replaceMedia ? 'true' : 'false');

  if (input.youtubeUrls) form.append('youtubeUrls', JSON.stringify(input.youtubeUrls));

  for (let i = 0; i < (input.photoUris ?? []).length; i++) {
    const uri = input.photoUris![i];
    // @ts-expect-error — RN FormData
    form.append('photos', { uri, name: `photo_${i}.jpg`, type: 'image/jpeg' });
  }

  if (input.audioUri) {
    // @ts-expect-error — RN FormData
    form.append('audio', {
      uri: input.audioUri,
      name: input.audioName ?? 'audio.m4a',
      type: input.audioMime ?? 'audio/m4a',
    });
  }

  await http.patch(`/leaders/memories/${id}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
    transformRequest: (d) => d,
  });
  await cacheInvalidatePrefix(CACHE_PREFIXES.memories);
}

export async function leaderDeleteMemory(id: string): Promise<void> {
  await apiDelete(`/leaders/memories/${id}`);
  await cacheInvalidatePrefix(CACHE_PREFIXES.memories);
}