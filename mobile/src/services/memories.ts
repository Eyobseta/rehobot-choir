import { apiGet, apiDelete, http } from './api';

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
  date: string;
  media: { id: string; type: MemoryMediaType; storageUrl: string | null }[];
};

export type MemoryDetail = {
  id: string;
  title: string;
  description: string | null;
  date: string;
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
  date: string;
  status: 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'DELETED';
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export async function listMemories(search?: string): Promise<MemorySummary[]> {
  const q = search?.trim()
    ? `?search=${encodeURIComponent(search.trim())}`
    : '';
  const res = await apiGet<{ items: MemorySummary[] }>(`/memories${q}`);
  return res.items;
}

export async function listMemoryYears(): Promise<MemoryYear[]> {
  const res = await apiGet<{ items: MemoryYear[] }>('/memories/years');
  return res.items;
}

export async function getMemory(id: string): Promise<MemoryDetail> {
  const res = await apiGet<{ item: MemoryDetail }>(`/memories/${id}`);
  return res.item;
}

/** Returns the memory regardless of status, only if it belongs to the caller. */
export async function getMyMemory(id: string): Promise<MemoryDetail> {
  const res = await apiGet<{ item: MemoryDetail }>(`/memories/mine/${id}`);
  return res.item;
}

export async function listMyMemories(): Promise<MyMemoryRow[]> {
  const res = await apiGet<{ items: MyMemoryRow[] }>('/memories/mine');
  return res.items;
}

export type SubmitMemoryInput = {
  title: string;
  description?: string;
  date: string;
  photoUris?: string[];
  audioUri?: string | null;
  audioName?: string | null;
  audioMime?: string | null;
  youtubeUrls?: string[];
};

export async function submitMemory(
  input: SubmitMemoryInput,
): Promise<{ id: string }> {
  const form = new FormData();
  form.append('title', input.title);
  if (input.description) form.append('description', input.description);
  form.append('date', input.date);

  if (input.youtubeUrls && input.youtubeUrls.length > 0) {
    form.append('youtubeUrls', JSON.stringify(input.youtubeUrls));
  }

  for (let i = 0; i < (input.photoUris ?? []).length; i++) {
    const uri = input.photoUris![i];
    // @ts-expect-error — RN FormData
    form.append('photos', {
      uri,
      name: `photo_${i}.jpg`,
      type: 'image/jpeg',
    });
  }

  if (input.audioUri) {
    // @ts-expect-error — RN FormData
    form.append('audio', {
      uri: input.audioUri,
      name: input.audioName ?? 'audio.m4a',
      type: input.audioMime ?? 'audio/m4a',
    });
  }

  const res = await http.post<{ memory: { id: string } }>(
    '/memories',
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
      transformRequest: (d) => d,
    },
  );
  return { id: res.data.memory.id };
}

// ---------- Leader ----------

export type PendingMemory = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  status: 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED';
  media: MemoryMediaItem[];
  submittedBy: {
    id: string;
    memberProfile: {
      fullName: string;
      profilePhotoUrl: string | null;
    } | null;
  };
};

export async function leaderListPendingMemories(): Promise<PendingMemory[]> {
  const res = await apiGet<{ items: PendingMemory[] }>(
    '/leaders/memories/pending',
  );
  return res.items;
}

export async function leaderGetMemory(id: string): Promise<PendingMemory> {
  const res = await apiGet<{ item: PendingMemory }>(
    `/leaders/memories/${id}`,
  );
  return res.item;
}

export async function leaderApproveMemory(id: string): Promise<void> {
  await http.post(`/leaders/memories/${id}/approve`, {});
}

export async function leaderRejectMemory(
  id: string,
  reason?: string,
): Promise<void> {
  await http.post(`/leaders/memories/${id}/reject`, {
    reason: reason ?? '',
  });
}

export type LeaderEditMemoryInput = {
  title?: string;
  description?: string;
  date?: string;
  replaceMedia?: boolean;
  photoUris?: string[];
  audioUri?: string | null;
  audioName?: string | null;
  audioMime?: string | null;
  youtubeUrls?: string[];
};

export async function leaderEditMemory(
  id: string,
  input: LeaderEditMemoryInput,
): Promise<void> {
  const form = new FormData();
  if (input.title !== undefined) form.append('title', input.title);
  if (input.description !== undefined)
    form.append('description', input.description);
  if (input.date !== undefined) form.append('date', input.date);

  form.append('replaceMedia', input.replaceMedia ? 'true' : 'false');

  if (input.youtubeUrls) {
    form.append('youtubeUrls', JSON.stringify(input.youtubeUrls));
  }

  for (let i = 0; i < (input.photoUris ?? []).length; i++) {
    const uri = input.photoUris![i];
    // @ts-expect-error — RN FormData
    form.append('photos', {
      uri,
      name: `photo_${i}.jpg`,
      type: 'image/jpeg',
    });
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
}

export async function leaderDeleteMemory(id: string): Promise<void> {
  await apiDelete(`/leaders/memories/${id}`);
}