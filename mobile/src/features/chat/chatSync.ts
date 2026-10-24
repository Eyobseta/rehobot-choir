import { fetchChangesApi, fetchDetail, fetchMessages } from './chatApi';
import {
  clearConversationMessages,
  getMeta,
  getNewestCachedId,
  hasAnyCached,
  saveDetail,
  saveMessages,
  setMeta,
} from './chatCache';
import type { ChatMessage, ConversationDetail } from './chatTypes';

export type SyncResult = {
  detail: ConversationDetail;
  /** Fresh messages to merge over what is on screen. */
  items: ChatMessage[];
  /** True when the cache was dropped; the screen must replace (not merge) its list. */
  reset: boolean;
};

const LATEST_PAGE = 40;
const GAP_PAGE = 60; // server maximum
const GAP_MAX_PAGES = 15;

/**
 * Bring the on-device cache of ONE conversation up to date, downloading as
 * little as possible:
 *
 *  1. latest page (40) + conversation detail           -> 2 small requests
 *  2. if the latest page does not touch the cache, the user was away for a
 *     while: download only the missing messages ("after" the newest cached one)
 *  3. ask the server which OLDER messages changed since the last sync
 *     (edited / deleted / reacted) and patch just those.
 *
 * The cache is always one contiguous block ending at the newest message, so
 * scrolling back through cached history can never show a hole.
 */
export async function revalidateConversation(conversationId: string): Promise<SyncResult> {
  const [detail, page] = await Promise.all([
    fetchDetail(conversationId),
    fetchMessages(conversationId, { limit: LATEST_PAGE }),
  ]);
  const syncedAt = page.serverTime ?? new Date().toISOString();
  void saveDetail(conversationId, detail);

  const resetTo = async (): Promise<SyncResult> => {
    await clearConversationMessages(conversationId);
    await saveMessages(page.items);
    await setMeta(conversationId, { lastSyncAt: syncedAt, reachedStart: !page.hasMore });
    return { detail, items: page.items, reset: true };
  };

  const newestCached = await getNewestCachedId(conversationId);
  const meta = await getMeta(conversationId);

  // Nothing cached yet.
  if (!newestCached) {
    await saveMessages(page.items);
    await setMeta(conversationId, { lastSyncAt: syncedAt, reachedStart: !page.hasMore });
    return { detail, items: page.items, reset: false };
  }

  let items: ChatMessage[] = [...page.items];
  const touchesCache =
    !page.hasMore || (await hasAnyCached(conversationId, page.items.map((m) => m.id)));

  if (touchesCache) {
    await saveMessages(page.items);
  } else {
    // Gap: fetch only what we are missing.
    const gap: ChatMessage[] = [];
    let after = newestCached;
    let complete = false;
    for (let i = 0; i < GAP_MAX_PAGES; i++) {
      const p = await fetchMessages(conversationId, { after, limit: GAP_PAGE });
      if (p.items.length === 0) {
        complete = true;
        break;
      }
      await saveMessages(p.items);
      gap.push(...p.items);
      if (!p.hasMore || !p.nextCursor) {
        complete = true;
        break;
      }
      after = p.nextCursor;
    }
    if (!complete) return resetTo(); // away for a very long time: start fresh
    await saveMessages(page.items);
    items = [...gap, ...page.items];
  }

  // Edits / deletes / reactions on messages we already had.
  if (meta.lastSyncAt) {
    try {
      const ch = await fetchChangesApi(conversationId, meta.lastSyncAt);
      if (ch.truncated) return resetTo();
      await saveMessages(ch.items);
      items = [...items, ...ch.items]; // fresher copies override
    } catch {
      // keep going; the next open retries from the same lastSyncAt
      return { detail, items, reset: false };
    }
  }

  await setMeta(conversationId, {
    lastSyncAt: syncedAt,
    reachedStart: !page.hasMore && touchesCache ? true : meta.reachedStart,
  });
  return { detail, items, reset: false };
}
