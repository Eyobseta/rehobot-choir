import { apiGet, apiPost, apiPatch, apiDelete } from '../../services/api';
import { cachedFetch, cacheInvalidatePrefix } from '../../services/cache';
import { CACHE_PREFIXES } from '../../services/cacheKeys';
import type {
  ChangesPage,
  ChatMessage,
  ConversationDetail,
  ConversationListItem,
  Draft,
  MessagePage,
  Reaction,
  ReportItem,
  LocalPhoto,
} from './chatTypes';

const UPLOAD_TIMEOUT_MS = 120_000;

function appendFile(form: FormData, field: string, file: LocalPhoto): void {
  form.append(field, file as unknown as Blob);
}

// ---------------- Conversations ----------------

export async function fetchConversations(): Promise<ConversationListItem[]> {
  const key = 'chats:list';
  const cached = await cachedFetch<ConversationListItem[]>(
    key,
    async () => {
      const res = await apiGet<{ items: ConversationListItem[] }>('/chats');
      return res.items;
    },
    () => {},
  );
  return cached ?? [];
}

export async function fetchUnread(): Promise<{
  total: number;
  byConversation: Record<string, number>;
}> {
  return apiGet('/chats/unread-count');
}

export async function fetchDetail(id: string): Promise<ConversationDetail> {
  const key = `chats:detail:${id}`;
  const cached = await cachedFetch<ConversationDetail>(
    key,
    async () => {
      const res = await apiGet<{ conversation: ConversationDetail }>(`/chats/${id}`);
      return res.conversation;
    },
    () => {},
  );
  if (cached) return cached;
  const res = await apiGet<{ conversation: ConversationDetail }>(`/chats/${id}`);
  return res.conversation;
}

export async function openDirect(userId: string): Promise<{ id: string }> {
  return apiPost('/chats/direct', { userId });
}

// ---------------- Messages ----------------

export async function fetchMessages(
  id: string,
  opts: { before?: string; after?: string; limit?: number } = {},
): Promise<MessagePage> {
  const params: Record<string, string | number> = {};
  if (opts.before) params.before = opts.before;
  if (opts.after) params.after = opts.after;
  if (opts.limit) params.limit = opts.limit;
  return apiGet(`/chats/${id}/messages`, { params });
}

export async function fetchChangesApi(id: string, since: string): Promise<ChangesPage> {
  return apiGet(`/chats/${id}/changes`, { params: { since } });
}

export async function searchMessagesApi(
  id: string,
  q: string,
  before?: string,
): Promise<MessagePage> {
  const params: Record<string, string> = { q };
  if (before) params.before = before;
  return apiGet(`/chats/${id}/search`, { params });
}

export async function sendMessageApi(
  conversationId: string,
  clientId: string,
  draft: Draft,
): Promise<ChatMessage> {
  const hasMedia = draft.photos.length > 0 || !!draft.voice;

  if (!hasMedia) {
    const res = await apiPost<{ message: ChatMessage }>(
      `/chats/${conversationId}/messages`,
      { text: draft.text, replyToId: draft.replyToId, clientId },
    );
    await cacheInvalidatePrefix(CACHE_PREFIXES.chats || 'chats:');
    return res.message;
  }

  const form = new FormData();
  if (draft.text) form.append('text', draft.text);
  if (draft.replyToId) form.append('replyToId', draft.replyToId);
  form.append('clientId', clientId);
  for (const p of draft.photos) appendFile(form, 'photos', p);
  if (draft.voice) {
    appendFile(form, 'voice', draft.voice);
    form.append('voiceDurationSeconds', String(draft.voice.durationSeconds));
  }
  const res = await apiPost<{ message: ChatMessage }>(
    `/chats/${conversationId}/messages`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: UPLOAD_TIMEOUT_MS },
  );
  await cacheInvalidatePrefix(CACHE_PREFIXES.chats || 'chats:');
  return res.message;
}

export async function editMessageApi(id: string, text: string): Promise<ChatMessage> {
  const res = await apiPatch<{ message: ChatMessage }>(`/chats/messages/${id}`, { text });
  return res.message;
}

export async function deleteMessageApi(id: string): Promise<void> {
  await apiDelete(`/chats/messages/${id}`);
}

export async function reactApi(id: string, emoji: string): Promise<Reaction[]> {
  const res = await apiPost<{ reactions: Reaction[] }>(`/chats/messages/${id}/reactions`, {
    emoji,
  });
  return res.reactions;
}

export async function pinApi(id: string): Promise<ChatMessage[]> {
  const res = await apiPost<{ pinned: ChatMessage[] }>(`/chats/messages/${id}/pin`);
  return res.pinned;
}

export async function unpinApi(id: string): Promise<ChatMessage[]> {
  const res = await apiDelete<{ pinned: ChatMessage[] }>(`/chats/messages/${id}/pin`);
  return res.pinned;
}

export async function reportApi(id: string): Promise<void> {
  await apiPost(`/chats/messages/${id}/report`);
}

export async function markReadApi(id: string): Promise<void> {
  await apiPost(`/chats/${id}/read`);
}

export async function typingApi(id: string): Promise<void> {
  await apiPost(`/chats/${id}/typing`);
}

export async function setOpenConversationsApi(ids: string[]): Promise<void> {
  await apiPost('/chats/stream/open-conversations', { conversationIds: ids });
}

// ---------------- Groups ----------------

export async function createGroupApi(input: {
  name: string;
  memberIds: string[];
  photo?: LocalPhoto | null;
}): Promise<{ id: string }> {
  const form = new FormData();
  form.append('name', input.name);
  form.append('memberIds', JSON.stringify(input.memberIds));
  if (input.photo) appendFile(form, 'photo', input.photo);
  return apiPost('/chats/groups', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: UPLOAD_TIMEOUT_MS,
  });
}

export async function updateGroupApi(
  conversationId: string,
  input: {
    name?: string;
    photo?: LocalPhoto | null;
    removePhoto?: boolean;
    managerId?: string;
  },
): Promise<void> {
  const form = new FormData();
  if (input.name !== undefined) form.append('name', input.name);
  if (input.removePhoto) form.append('removePhoto', 'true');
  if (input.managerId) form.append('managerId', input.managerId);
  if (input.photo) appendFile(form, 'photo', input.photo);
  await apiPatch(`/chats/groups/${conversationId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: UPLOAD_TIMEOUT_MS,
  });
}

export async function deleteGroupApi(conversationId: string): Promise<void> {
  await apiDelete(`/chats/groups/${conversationId}`);
}

export async function addMembersApi(conversationId: string, memberIds: string[]): Promise<void> {
  await apiPost(`/chats/groups/${conversationId}/members`, { memberIds });
}

export async function removeMemberApi(conversationId: string, userId: string): Promise<void> {
  await apiDelete(`/chats/groups/${conversationId}/members/${userId}`);
}

// ---------------- Moderation ----------------

export async function fetchReports(): Promise<ReportItem[]> {
  const res = await apiGet<{ items: ReportItem[] }>('/chats/reports');
  return res.items;
}

export async function resolveReportApi(
  messageId: string,
  resolution: 'KEPT' | 'DELETED' | 'DISMISSED',
): Promise<void> {
  await apiPost(`/chats/reports/${messageId}/resolve`, { resolution });
}