import { apiGet, apiPost, apiDelete, http } from './api';
import { cachedFetch, cacheInvalidatePrefix } from './cache';
import { CACHE_KEYS, CACHE_PREFIXES } from './cacheKeys';

export type SongCategory = {
  id: string;
  name: string;
};

export type SongSummary = {
  id: string;
  title: string;
  youtubeUrl: string | null;
  audioUrl: string | null;
  dateAdded: string;
  category: SongCategory | null;
};

export type SongDetail = SongSummary & {
  lyrics: string | null;
  status: string;
};

export type FavoriteRow = {
  id: string;
  createdAt: string;
  song: {
    id: string;
    title: string;
    youtubeUrl: string | null;
    audioUrl: string | null;
    category: SongCategory | null;
  };
};

// ---------- Member (cached) ----------

export async function listSongs(search?: string): Promise<SongSummary[]> {
  const key = CACHE_KEYS.songsList(search ?? '');
  const cached = await cachedFetch<SongSummary[]>(
    key,
    async () => {
      const q = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const res = await apiGet<{ items: SongSummary[] }>(`/songs${q}`);
      return res.items;
    },
    () => {},
  );
  return cached ?? [];
}

export async function listCategories(): Promise<SongCategory[]> {
  const cached = await cachedFetch<SongCategory[]>(
    CACHE_KEYS.songCategories,
    async () => {
      const res = await apiGet<{ items: SongCategory[] }>('/songs/categories');
      return res.items;
    },
    () => {},
  );
  return cached ?? [];
}

export async function getSong(id: string): Promise<SongDetail> {
  const key = CACHE_KEYS.songDetail(id);
  const cached = await cachedFetch<SongDetail>(
    key,
    async () => {
      const res = await apiGet<{ item: SongDetail }>(`/songs/${id}`);
      return res.item;
    },
    () => {},
  );
  if (cached) return cached;
  const res = await apiGet<{ item: SongDetail }>(`/songs/${id}`);
  return res.item;
}

export async function favoriteSong(id: string): Promise<void> {
  await apiPost(`/songs/${id}/favorite`, {});
  await cacheInvalidatePrefix(CACHE_PREFIXES.songs);
}

export async function unfavoriteSong(id: string): Promise<void> {
  await apiDelete(`/songs/${id}/favorite`);
  await cacheInvalidatePrefix(CACHE_PREFIXES.songs);
}

export async function listMyFavorites(): Promise<FavoriteRow[]> {
  const cached = await cachedFetch<FavoriteRow[]>(
    CACHE_KEYS.songFavorites,
    async () => {
      const res = await apiGet<{ items: FavoriteRow[] }>('/songs/favorites/me');
      return res.items;
    },
    () => {},
  );
  return cached ?? [];
}

// ---------- Leader-side helpers ----------

export type LeaderSongRow = {
  id: string;
  title: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'RETURNED' | 'UNPUBLISHED' | 'DELETED';
  dateAdded: string;
  publishedAt: string | null;
  category: SongCategory | null;
};

export type LeaderSongDetail = {
  id: string;
  title: string;
  lyrics: string | null;
  youtubeUrl: string | null;
  audioUrl: string | null;
  audioPublicId?: string | null;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'RETURNED' | 'UNPUBLISHED' | 'DELETED';
  category: SongCategory | null;
};

export type PendingSubmission = {
  id: string;
  status: 'PENDING_REVIEW';
  song: {
    id: string;
    title: string;
    lyrics: string | null;
    youtubeUrl: string | null;
    audioUrl: string | null;
    category: SongCategory | null;
  };
  submittedBy: {
    id: string;
    memberProfile: { fullName: string; profilePhotoUrl: string | null } | null;
  };
};

export type ZemaMember = {
  id: string;
  assignedAt: string;
  user: {
    id: string;
    memberProfile: { fullName: string; profilePhotoUrl: string | null } | null;
  };
};

export async function leaderListSongs(): Promise<LeaderSongRow[]> {
  const res = await apiGet<{ items: LeaderSongRow[] }>('/leaders/songs');
  return res.items;
}

export async function leaderGetSong(id: string): Promise<LeaderSongDetail> {
  const res = await apiGet<{ item: LeaderSongDetail }>(`/leaders/songs/${id}`);
  return res.item;
}

export type LeaderCreateSongInput = {
  title: string;
  lyrics?: string;
  youtubeUrl?: string;
  categoryId?: string | null;
  publish: boolean;
  audioUri?: string | null;
  audioMime?: string | null;
  audioName?: string | null;
};

export async function leaderCreateSong(input: LeaderCreateSongInput): Promise<{ id: string }> {
  const form = new FormData();
  form.append('title', input.title);
  if (input.lyrics) form.append('lyrics', input.lyrics);
  if (input.youtubeUrl) form.append('youtubeUrl', input.youtubeUrl);
  if (input.categoryId) form.append('categoryId', input.categoryId);
  form.append('publish', input.publish ? 'true' : 'false');

  if (input.audioUri) {
    // @ts-expect-error — RN FormData
    form.append('audio', {
      uri: input.audioUri,
      name: input.audioName ?? 'audio.m4a',
      type: input.audioMime ?? 'audio/m4a',
    });
  }

  const res = await http.post<{ song: { id: string } }>('/leaders/songs', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90_000,
    transformRequest: (d) => d,
  });
  await cacheInvalidatePrefix(CACHE_PREFIXES.songs);
  return { id: res.data.song.id };
}

export type LeaderUpdateSongInput = {
  title?: string;
  lyrics?: string;
  youtubeUrl?: string;
  categoryId?: string | null;
  publish?: boolean;
  unpublish?: boolean;
  removeAudio?: boolean;
  audioUri?: string | null;
  audioMime?: string | null;
  audioName?: string | null;
};

export async function leaderUpdateSong(id: string, input: LeaderUpdateSongInput): Promise<void> {
  const form = new FormData();
  if (input.title !== undefined) form.append('title', input.title);
  if (input.lyrics !== undefined) form.append('lyrics', input.lyrics);
  if (input.youtubeUrl !== undefined) form.append('youtubeUrl', input.youtubeUrl);
  if (input.categoryId !== undefined && input.categoryId !== null) form.append('categoryId', input.categoryId);
  if (input.publish !== undefined) form.append('publish', input.publish ? 'true' : 'false');
  if (input.unpublish !== undefined) form.append('unpublish', input.unpublish ? 'true' : 'false');
  if (input.removeAudio !== undefined) form.append('removeAudio', input.removeAudio ? 'true' : 'false');

  if (input.audioUri) {
    // @ts-expect-error — RN FormData
    form.append('audio', {
      uri: input.audioUri,
      name: input.audioName ?? 'audio.m4a',
      type: input.audioMime ?? 'audio/m4a',
    });
  }

  await http.patch(`/leaders/songs/${id}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90_000,
    transformRequest: (d) => d,
  });
  await cacheInvalidatePrefix(CACHE_PREFIXES.songs);
}

export async function leaderDeleteSong(id: string): Promise<void> {
  await apiDelete(`/leaders/songs/${id}`);
  await cacheInvalidatePrefix(CACHE_PREFIXES.songs);
}

// ---------- Categories (leader) ----------

export async function leaderCreateCategory(name: string): Promise<SongCategory> {
  const res = await http.post<{ category: SongCategory }>('/leaders/song-categories', { name });
  await cacheInvalidatePrefix(CACHE_PREFIXES.songs);
  return res.data.category;
}

export async function leaderRenameCategory(id: string, name: string): Promise<SongCategory> {
  const res = await http.patch<{ category: SongCategory }>(`/leaders/song-categories/${id}`, { name });
  await cacheInvalidatePrefix(CACHE_PREFIXES.songs);
  return res.data.category;
}

export async function leaderDeleteCategory(id: string): Promise<void> {
  await apiDelete(`/leaders/song-categories/${id}`);
  await cacheInvalidatePrefix(CACHE_PREFIXES.songs);
}

// ---------- Zema Team (FIXED: matches backend /leaders/zema-members) ----------

export async function leaderListZemaMembers(): Promise<ZemaMember[]> {
  const res = await apiGet<{ items: ZemaMember[] }>('/leaders/zema-members');
  return res.items;
}

export async function leaderAddZemaMember(userId: string): Promise<{ ok: true }> {
  const res = await apiPost<{ ok: true }>(`/leaders/zema-members/${userId}`, {});
  await cacheInvalidatePrefix(CACHE_PREFIXES.songs);
  return res;
}

export async function leaderRemoveZemaMember(userId: string): Promise<{ ok: true }> {
  const res = await apiDelete<{ ok: true }>(`/leaders/zema-members/${userId}`);
  await cacheInvalidatePrefix(CACHE_PREFIXES.songs);
  return res;
}

// ---------- Song Submissions (FIXED: matches backend /leaders/song-submissions) ----------

export async function leaderListPendingSubmissions(): Promise<PendingSubmission[]> {
  const res = await apiGet<{ items: PendingSubmission[] }>('/leaders/song-submissions');
  return res.items;
}

export async function leaderApproveSubmission(submissionId: string): Promise<{ ok: true }> {
  const res = await apiPost<{ ok: true }>(`/leaders/song-submissions/${submissionId}/approve`, {});
  await cacheInvalidatePrefix(CACHE_PREFIXES.songs);
  return res;
}

export async function leaderReturnSubmission(submissionId: string, reason: string): Promise<{ ok: true }> {
  const res = await apiPost<{ ok: true }>(`/leaders/song-submissions/${submissionId}/return`, { reason });
  await cacheInvalidatePrefix(CACHE_PREFIXES.songs);
  return res;
}