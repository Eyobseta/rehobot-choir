import { apiGet, apiPost, apiDelete, http } from './api';

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

export async function listSongs(search?: string): Promise<SongSummary[]> {
  const q = search?.trim()
    ? `?search=${encodeURIComponent(search.trim())}`
    : '';
  const res = await apiGet<{ items: SongSummary[] }>(`/songs${q}`);
  return res.items;
}

export async function listCategories(): Promise<SongCategory[]> {
  const res = await apiGet<{ items: SongCategory[] }>('/songs/categories');
  return res.items;
}

export async function getSong(id: string): Promise<SongDetail> {
  const res = await apiGet<{ item: SongDetail }>(`/songs/${id}`);
  return res.item;
}

export async function favoriteSong(id: string): Promise<void> {
  await apiPost(`/songs/${id}/favorite`, {});
}

export async function unfavoriteSong(id: string): Promise<void> {
  await apiDelete(`/songs/${id}/favorite`);
}

export async function listMyFavorites(): Promise<FavoriteRow[]> {
  const res = await apiGet<{ items: FavoriteRow[] }>('/songs/favorites/me');
  return res.items;
}

// ---------- Leader-side helpers ----------

export type LeaderSongRow = {
  id: string;
  title: string;
  status:
    | 'DRAFT'
    | 'PENDING_REVIEW'
    | 'PUBLISHED'
    | 'RETURNED'
    | 'UNPUBLISHED'
    | 'DELETED';
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
  status:
    | 'DRAFT'
    | 'PENDING_REVIEW'
    | 'PUBLISHED'
    | 'RETURNED'
    | 'UNPUBLISHED'
    | 'DELETED';
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
    memberProfile: {
      fullName: string;
      profilePhotoUrl: string | null;
    } | null;
  };
};

export type ZemaMember = {
  id: string;
  assignedAt: string;
  user: {
    id: string;
    memberProfile: {
      fullName: string;
      profilePhotoUrl: string | null;
    } | null;
  };
};

export async function leaderListSongs(): Promise<LeaderSongRow[]> {
  const res = await apiGet<{ items: LeaderSongRow[] }>('/leaders/songs');
  return res.items;
}

export async function leaderGetSong(id: string): Promise<LeaderSongDetail> {
  // Uses the leader-side endpoint so DRAFT / PENDING_REVIEW / RETURNED /
  // UNPUBLISHED songs are also returned (the member endpoint only returns
  // PUBLISHED songs).
  const res = await apiGet<{ item: LeaderSongDetail }>(
    `/leaders/songs/${id}`,
  );
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

export async function leaderCreateSong(
  input: LeaderCreateSongInput,
): Promise<{ id: string }> {
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

  const res = await http.post<{ song: { id: string } }>(
    '/leaders/songs',
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 90_000,
      transformRequest: (d) => d,
    },
  );
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

export async function leaderUpdateSong(
  id: string,
  input: LeaderUpdateSongInput,
): Promise<void> {
  const form = new FormData();
  if (input.title !== undefined) form.append('title', input.title);
  if (input.lyrics !== undefined) form.append('lyrics', input.lyrics);
  if (input.youtubeUrl !== undefined) form.append('youtubeUrl', input.youtubeUrl);
  if (input.categoryId !== undefined && input.categoryId !== null)
    form.append('categoryId', input.categoryId);
  if (input.publish !== undefined)
    form.append('publish', input.publish ? 'true' : 'false');
  if (input.unpublish !== undefined)
    form.append('unpublish', input.unpublish ? 'true' : 'false');
  if (input.removeAudio !== undefined)
    form.append('removeAudio', input.removeAudio ? 'true' : 'false');

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
}

export async function leaderDeleteSong(id: string): Promise<void> {
  await apiDelete(`/leaders/songs/${id}`);
}

// ---------- Categories (leader) ----------

export async function leaderCreateCategory(name: string): Promise<SongCategory> {
  const res = await http.post<{ category: SongCategory }>(
    '/leaders/song-categories',
    { name },
  );
  return res.data.category;
}

export async function leaderRenameCategory(
  id: string,
  name: string,
): Promise<SongCategory> {
  const res = await http.patch<{ category: SongCategory }>(
    `/leaders/song-categories/${id}`,
    { name },
  );
  return res.data.category;
}

export async function leaderDeleteCategory(id: string): Promise<void> {
  await apiDelete(`/leaders/song-categories/${id}`);
}

// ---------- Zema Team ----------

export async function leaderListZemaMembers(): Promise<ZemaMember[]> {
  const res = await apiGet<{ items: ZemaMember[] }>('/leaders/zema-members');
  return res.items;
}

export async function leaderAddZemaMember(userId: string): Promise<void> {
  await http.post(`/leaders/zema-members/${userId}`, {});
}

export async function leaderRemoveZemaMember(userId: string): Promise<void> {
  await apiDelete(`/leaders/zema-members/${userId}`);
}

// ---------- Song review queue ----------

export async function leaderListPendingSubmissions(): Promise<
  PendingSubmission[]
> {
  const res = await apiGet<{ items: PendingSubmission[] }>(
    '/leaders/song-submissions',
  );
  return res.items;
}

export async function leaderApproveSubmission(id: string): Promise<void> {
  await http.post(`/leaders/song-submissions/${id}/approve`, {});
}

export async function leaderReturnSubmission(
  id: string,
  reason: string,
): Promise<void> {
  await http.post(`/leaders/song-submissions/${id}/return`, { reason });
}

// ---------- Zema submission helpers ----------

export type SubmissionStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'RETURNED';

export type MySubmission = {
  id: string;
  status: SubmissionStatus;
  returnReason: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  song: {
    id: string;
    title: string;
    lyrics: string | null;
    youtubeUrl: string | null;
    audioUrl: string | null;
    category: SongCategory | null;
  };
};

export async function zemaListMySubmissions(): Promise<MySubmission[]> {
  const res = await apiGet<{ items: MySubmission[] }>('/zema/submissions/me');
  return res.items;
}

export type ZemaSaveDraftInput = {
  submissionId?: string | null;
  title: string;
  lyrics?: string;
  youtubeUrl?: string;
  categoryId?: string | null;
  audioUri?: string | null;
  audioMime?: string | null;
  audioName?: string | null;
};

export async function zemaSaveDraft(
  input: ZemaSaveDraftInput,
): Promise<{ submissionId: string }> {
  const form = new FormData();
  if (input.submissionId) form.append('submissionId', input.submissionId);
  form.append('title', input.title);
  if (input.lyrics) form.append('lyrics', input.lyrics);
  if (input.youtubeUrl) form.append('youtubeUrl', input.youtubeUrl);
  if (input.categoryId) form.append('categoryId', input.categoryId);
  if (input.audioUri) {
    // @ts-expect-error — RN FormData
    form.append('audio', {
      uri: input.audioUri,
      name: input.audioName ?? 'audio.m4a',
      type: input.audioMime ?? 'audio/m4a',
    });
  }

  const res = await http.post<{ ok: true; submissionId: string }>(
    '/zema/submissions',
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 90_000,
      transformRequest: (d) => d,
    },
  );
  return { submissionId: res.data.submissionId };
}

export async function zemaSubmitForReview(submissionId: string): Promise<void> {
  await http.post(`/zema/submissions/${submissionId}/submit`, {});
}

/**
 * Small helper used to detect whether the current user is on Zema.
 * Returns true if /zema/submissions/me returns 200.
 */
export async function zemaIsTeamMember(): Promise<boolean> {
  try {
    await apiGet<{ items: MySubmission[] }>('/zema/submissions/me');
    return true;
  } catch {
    return false;
  }
}