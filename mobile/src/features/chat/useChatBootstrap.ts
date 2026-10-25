import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getMe, clearMeCache } from './chatSession';
import { closeChatCache, initChatCache } from './chatCache';
import { onChatEvent, startRealtime, stopRealtime } from './chatRealtime';
import {
  bumpFromMessage,
  refreshConversations,
  refreshConversationsSoon,
  restoreCachedConversations,
  removeConversation,
  resetChatStore,
  setPresence,
} from './chatStore';
import type { ChatMessage } from './chatTypes';

/**
 * Call ONCE from RootTabs. Keeps the conversation list, unread counts and
 * presence up to date for the whole app, regardless of which tab is open.
 */
export function useChatBootstrap(): void {
  useEffect(() => {
    let meId: string | null = null;
    let backgroundTime: number | null = null;

    // Open this user's on-device cache, show the saved list at once, then refresh.
    getMe().then(async (m) => {
      meId = m?.id ?? null;
      if (m) {
        await initChatCache(m.id);
        await restoreCachedConversations();
      }
      await refreshConversations();
    });

    startRealtime();

    const offs = [
      onChatEvent('message:new', (m: ChatMessage) => {
        if (!bumpFromMessage(m, meId)) refreshConversationsSoon();
      }),
      onChatEvent('message:deleted', () => refreshConversationsSoon()),
      onChatEvent('conversation:added', () => refreshConversationsSoon()),
      onChatEvent('conversation:updated', () => refreshConversationsSoon()),
      onChatEvent('conversation:removed', (p: { conversationId: string }) => {
        removeConversation(p.conversationId);
      }),
      onChatEvent('presence:changed', (p: { userId: string; online: boolean }) =>
        setPresence(p.userId, p.online),
      ),
      onChatEvent('connected', () => refreshConversationsSoon()),
    ];

    // --- NEW: AppState listener for foreground refresh ---
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        backgroundTime = Date.now();
      } else if (nextAppState === 'active') {
        // If the app was in the background for more than 30 seconds, refresh.
        // (Reconnecting the socket also usually triggers a 'connected' event, 
        // but this catches any missed updates in case the socket stayed alive.)
        if (backgroundTime && Date.now() - backgroundTime > 30_000) {
          void refreshConversations();
        }
        backgroundTime = null;
      }
    };
    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      offs.forEach((off) => off());
      appStateSub.remove();
      stopRealtime();
      void closeChatCache();
      resetChatStore();
      clearMeCache();
    };
  }, []);
}