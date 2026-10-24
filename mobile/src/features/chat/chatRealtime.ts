import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import EventSource from 'react-native-sse';
import { API_ROOT } from '../../config/env';
import { getAccessToken } from '../../services/secureStorage';
import { apiGet } from '../../services/api';
import { setConnected } from './chatStore';
import { setOpenConversationsApi } from './chatApi';

/**
 * One SSE connection for the whole app.
 *  - reconnects with backoff, refreshes the token on 401
 *  - closes in the background (push takes over), reopens on resume
 *  - emits 'connected' after every (re)connect so screens can re-sync
 */

export type ChatEventName =
  | 'hello'
  | 'message:new'
  | 'message:edited'
  | 'message:deleted'
  | 'reaction:updated'
  | 'pin:updated'
  | 'read:updated'
  | 'typing'
  | 'presence:changed'
  | 'conversation:added'
  | 'conversation:updated'
  | 'conversation:removed';

export type LocalEventName = ChatEventName | 'connected' | 'resume';

const SERVER_EVENTS: ChatEventName[] = [
  'hello',
  'message:new',
  'message:edited',
  'message:deleted',
  'reaction:updated',
  'pin:updated',
  'read:updated',
  'typing',
  'presence:changed',
  'conversation:added',
  'conversation:updated',
  'conversation:removed',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (data: any) => void;
const handlers = new Map<LocalEventName, Set<Handler>>();

export function onChatEvent(name: LocalEventName, handler: Handler): () => void {
  let set = handlers.get(name);
  if (!set) {
    set = new Set();
    handlers.set(name, set);
  }
  set.add(handler);
  return () => {
    set?.delete(handler);
  };
}

function emit(name: LocalEventName, data: unknown): void {
  const set = handlers.get(name);
  if (!set) return;
  for (const h of [...set]) {
    try {
      h(data);
    } catch {
      // a broken handler must not break the stream
    }
  }
}

let source: EventSource<ChatEventName> | null = null;
let wanted = false;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: NativeEventSubscription | null = null;
let appState: AppStateStatus = AppState.currentState;
let openIds: string[] = [];
let opening = false;

function clearRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function closeSource(): void {
  if (source) {
    try {
      source.removeAllEventListeners();
      source.close();
    } catch {
      // ignore
    }
    source = null;
  }
}

function scheduleReconnect(immediate = false): void {
  if (!wanted || appState !== 'active') return;
  clearRetry();
  const delay = immediate ? 300 : Math.min(30_000, 1000 * 2 ** retry) + Math.random() * 500;
  retry += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void open();
  }, delay);
}

async function handleDrop(dead: EventSource<ChatEventName>, status?: number): Promise<void> {
  if (source !== dead) return; // stale event from an old connection
  closeSource();
  setConnected(false);
  if (status === 401) {
    // Any authenticated call makes api.ts refresh the token for us.
    try {
      await apiGet('/chats/unread-count');
    } catch {
      // session over; the app-level unauthorized handler logs out
    }
    scheduleReconnect(true);
    return;
  }
  scheduleReconnect();
}

async function open(): Promise<void> {
  if (!wanted || appState !== 'active' || source || opening) return;
  opening = true;
  try {
    const token = await getAccessToken();
    if (!token || !wanted || source) return;

    const es = new EventSource<ChatEventName>(`${API_ROOT}/chats/stream`, {
      headers: { Authorization: `Bearer ${token}` },
      pollingInterval: 0, // we handle reconnects ourselves
      timeout: 0,
    });
    source = es;

    es.addEventListener('open', () => {
      retry = 0;
    });

    for (const name of SERVER_EVENTS) {
      es.addEventListener(name, (e) => {
        const raw = (e as { data?: string | null }).data;
        let data: unknown = null;
        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch {
            return;
          }
        }
        if (name === 'hello') {
          retry = 0;
          setConnected(true);
          if (openIds.length > 0) setOpenConversationsApi(openIds).catch(() => undefined);
          emit('connected', data);
        }
        emit(name, data);
      });
    }

    es.addEventListener('error', (e) => {
      const status = (e as { xhrStatus?: number }).xhrStatus;
      void handleDrop(es, status);
    });
    es.addEventListener('close', () => {
      void handleDrop(es);
    });
  } finally {
    opening = false;
  }
}

function onAppState(next: AppStateStatus): void {
  const was = appState;
  appState = next;
  if (!wanted) return;
  if (next === 'active' && was !== 'active') {
    retry = 0;
    void open();
    emit('resume', null);
  } else if (next !== 'active') {
    clearRetry();
    closeSource();
    setConnected(false);
  }
}

export function startRealtime(): void {
  if (wanted) return;
  wanted = true;
  retry = 0;
  appState = AppState.currentState;
  appStateSub = AppState.addEventListener('change', onAppState);
  void open();
}

export function stopRealtime(): void {
  wanted = false;
  clearRetry();
  closeSource();
  setConnected(false);
  appStateSub?.remove();
  appStateSub = null;
  openIds = [];
}

/** Tell the server which conversations are on screen (suppresses their push). */
export function setOpenConversations(ids: string[]): void {
  openIds = ids;
  setOpenConversationsApi(ids).catch(() => undefined);
}
