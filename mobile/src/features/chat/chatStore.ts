import { useSyncExternalStore } from 'react';
import { fetchConversations, fetchDetail } from './chatApi';
import { getCachedConversations, saveConversations } from './chatCache';
import type { ChatMessage, ConversationListItem, MemberInfo } from './chatTypes';

type State = {
  conversations: ConversationListItem[];
  loaded: boolean;
  unreadTotal: number;
  presence: Record<string, boolean>;
  connected: boolean;
};

let state: State = {
  conversations: [],
  loaded: false,
  unreadTotal: 0,
  presence: {},
  connected: false,
};

const listeners = new Set<() => void>();
function emit(): void {
  for (const l of listeners) l();
}
function patch(p: Partial<State>): void {
  state = { ...state, ...p };
  emit();
}
function sum(items: ConversationListItem[]): number {
  let n = 0;
  for (const c of items) n += c.unreadCount;
  return n;
}
function sortItems(items: ConversationListItem[]): ConversationListItem[] {
  return [...items].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
}

export function subscribeChat(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function getChatState(): State {
  return state;
}
export function useChatState(): State {
  return useSyncExternalStore(subscribeChat, getChatState, getChatState);
}

// ---------- Mutations ----------

export function setConnected(connected: boolean): void {
  if (state.connected !== connected) patch({ connected });
}

export function setPresence(userId: string, online: boolean): void {
  patch({ presence: { ...state.presence, [userId]: online } });
}

export function setConversations(items: ConversationListItem[]): void {
  const presence = { ...state.presence };
  for (const c of items) {
    if (c.otherUserId && c.online !== null && presence[c.otherUserId] === undefined) {
      presence[c.otherUserId] = c.online;
    }
  }
  const sorted = sortItems(items);
  patch({ conversations: sorted, loaded: true, unreadTotal: sum(sorted), presence });
  void saveConversations(sorted);
}

/** Show the last known conversation list instantly (before the network answers). */
export async function restoreCachedConversations(): Promise<void> {
  if (state.loaded) return;
  const cached = await getCachedConversations();
  if (cached && !state.loaded) {
    const sorted = sortItems(cached);
    patch({ conversations: sorted, loaded: true, unreadTotal: sum(sorted) });
  }
}

let activeConversationId: string | null = null;
export function setActiveConversation(id: string | null): void {
  activeConversationId = id;
}
export function getActiveConversation(): string | null {
  return activeConversationId;
}

/** Returns false when the conversation is unknown (caller should refetch the list). */
export function bumpFromMessage(m: ChatMessage, meId: string | null): boolean {
  const idx = state.conversations.findIndex((c) => c.id === m.conversationId);
  if (idx < 0) return false;
  const c = state.conversations[idx];
  if (!c) return false;
  const mine = m.sender.id === meId;
  const open = activeConversationId === m.conversationId;
  const updated: ConversationListItem = {
    ...c,
    lastMessageAt: m.createdAt,
    lastMessage: {
      id: m.id,
      type: m.type,
      text: m.text,
      deleted: m.deleted,
      senderId: m.sender.id,
      senderName: m.sender.fullName,
      createdAt: m.createdAt,
    },
    unreadCount: mine || open ? c.unreadCount : c.unreadCount + 1,
  };
  const next = sortItems([updated, ...state.conversations.filter((x) => x.id !== c.id)]);
  patch({ conversations: next, unreadTotal: sum(next) });
  return true;
}

export function markLocalRead(conversationId: string): void {
  const next = state.conversations.map((c) =>
    c.id === conversationId && c.unreadCount > 0 ? { ...c, unreadCount: 0 } : c,
  );
  patch({ conversations: next, unreadTotal: sum(next) });
}

export function removeConversation(conversationId: string): void {
  const next = state.conversations.filter((c) => c.id !== conversationId);
  patch({ conversations: next, unreadTotal: sum(next) });
}

export function resetChatStore(): void {
  activeConversationId = null;
  state = { conversations: [], loaded: false, unreadTotal: 0, presence: {}, connected: false };
  membersCache = null;
  emit();
}

// ---------- Fetch helpers ----------

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export async function refreshConversations(): Promise<void> {
  try {
    setConversations(await fetchConversations());
  } catch {
    // keep the old list; realtime/pull-to-refresh will retry
  }
}

export function refreshConversationsSoon(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    refreshConversations();
  }, 400);
}

// ---------- All members (picker source) ----------
// Every approved member/leader is in General chat, so its member list is the
// directory we need for starting DMs and building groups.

let membersCache: { at: number; items: MemberInfo[] } | null = null;

export async function loadAllMembers(force = false): Promise<MemberInfo[]> {
  if (!force && membersCache && Date.now() - membersCache.at < 60_000) {
    return membersCache.items;
  }
  let list = state.conversations;
  if (list.length === 0) {
    list = await fetchConversations();
    setConversations(list);
  }
  const general = list.find((c) => c.type === 'GENERAL');
  if (!general) return [];
  const detail = await fetchDetail(general.id);
  membersCache = { at: Date.now(), items: detail.members };
  return detail.members;
}
