import * as SQLite from 'expo-sqlite';
import type { ChatMessage, ConversationDetail, ConversationListItem } from './chatTypes';

/**
 * On-device chat cache (SQLite). One database file PER USER, so two accounts on
 * the same phone never see each other's chats. Nothing is evicted: the data
 * stays until the user clears the app's storage (or you call clearChatCache()).
 *
 * Every function swallows its own errors: a broken cache must never break chat,
 * the app simply falls back to the network.
 */

let db: SQLite.SQLiteDatabase | null = null;
let dbUser: string | null = null;
let initPromise: Promise<void> | null = null;

export function initChatCache(userId: string): Promise<void> {
  if (dbUser === userId && (db || initPromise)) return initPromise ?? Promise.resolve();
  dbUser = userId;
  initPromise = (async () => {
    try {
      if (db) await db.closeAsync().catch(() => undefined);
      db = null;
      const d = await SQLite.openDatabaseAsync(`rehobot_chat_${userId}.db`);
      await d.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY NOT NULL,
          conversationId TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_messages_conv
          ON messages (conversationId, createdAt DESC, id DESC);
        CREATE TABLE IF NOT EXISTS details (
          conversationId TEXT PRIMARY KEY NOT NULL,
          json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS conv_meta (
          conversationId TEXT PRIMARY KEY NOT NULL,
          lastSyncAt TEXT,
          reachedStart INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS kv (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
      db = d;
    } catch {
      db = null;
    } finally {
      initPromise = null;
    }
  })();
  return initPromise;
}

export async function closeChatCache(): Promise<void> {
  try {
    if (initPromise) await initPromise;
    await db?.closeAsync();
  } catch {
    // ignore
  }
  db = null;
  dbUser = null;
}

async function getDb(): Promise<SQLite.SQLiteDatabase | null> {
  if (initPromise) await initPromise;
  return db;
}

function parse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function isLocal(m: ChatMessage): boolean {
  return !!m._status || m.id.startsWith('tmp_');
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function saveMessages(items: ChatMessage[]): Promise<void> {
  const d = await getDb();
  if (!d || items.length === 0) return;
  try {
    await d.withTransactionAsync(async () => {
      const stmt = await d.prepareAsync(
        'INSERT OR REPLACE INTO messages (id, conversationId, createdAt, json) VALUES ($id, $c, $t, $j)',
      );
      try {
        for (const m of items) {
          if (isLocal(m)) continue;
          const { _status, _draft, ...clean } = m;
          void _status;
          void _draft;
          await stmt.executeAsync({
            $id: m.id,
            $c: m.conversationId,
            $t: m.createdAt,
            $j: JSON.stringify(clean),
          });
        }
      } finally {
        await stmt.finalizeAsync();
      }
    });
  } catch {
    // ignore
  }
}

/** Newest first. */
export async function getCachedMessages(conversationId: string, limit = 40): Promise<ChatMessage[]> {
  const d = await getDb();
  if (!d) return [];
  try {
    const rows = await d.getAllAsync<{ json: string }>(
      'SELECT json FROM messages WHERE conversationId = ? ORDER BY createdAt DESC, id DESC LIMIT ?',
      [conversationId, limit],
    );
    return rows.map((r) => parse<ChatMessage>(r.json)).filter((m): m is ChatMessage => !!m);
  } catch {
    return [];
  }
}

/** Cached messages older than `oldest`, newest first. */
export async function getOlderCached(
  conversationId: string,
  oldest: { createdAt: string; id: string },
  limit = 40,
): Promise<ChatMessage[]> {
  const d = await getDb();
  if (!d) return [];
  try {
    const rows = await d.getAllAsync<{ json: string }>(
      `SELECT json FROM messages
        WHERE conversationId = ?
          AND (createdAt < ? OR (createdAt = ? AND id < ?))
        ORDER BY createdAt DESC, id DESC LIMIT ?`,
      [conversationId, oldest.createdAt, oldest.createdAt, oldest.id, limit],
    );
    return rows.map((r) => parse<ChatMessage>(r.json)).filter((m): m is ChatMessage => !!m);
  } catch {
    return [];
  }
}

export async function getNewestCachedId(conversationId: string): Promise<string | null> {
  const d = await getDb();
  if (!d) return null;
  try {
    const row = await d.getFirstAsync<{ id: string }>(
      'SELECT id FROM messages WHERE conversationId = ? ORDER BY createdAt DESC, id DESC LIMIT 1',
      [conversationId],
    );
    return row?.id ?? null;
  } catch {
    return null;
  }
}

export async function hasAnyCached(conversationId: string, ids: string[]): Promise<boolean> {
  const d = await getDb();
  if (!d || ids.length === 0) return false;
  try {
    const marks = ids.map(() => '?').join(',');
    const row = await d.getFirstAsync<{ id: string }>(
      `SELECT id FROM messages WHERE conversationId = ? AND id IN (${marks}) LIMIT 1`,
      [conversationId, ...ids],
    );
    return !!row;
  } catch {
    return false;
  }
}

/** Apply a change (delete / reactions) to one cached message. */
export async function patchCachedMessage(
  messageId: string,
  fn: (m: ChatMessage) => ChatMessage,
): Promise<void> {
  const d = await getDb();
  if (!d) return;
  try {
    const row = await d.getFirstAsync<{ json: string }>(
      'SELECT json FROM messages WHERE id = ?',
      [messageId],
    );
    const m = row ? parse<ChatMessage>(row.json) : null;
    if (m) await saveMessages([fn(m)]);
  } catch {
    // ignore
  }
}

/** Forget the messages of one conversation (keeps nothing, so no gaps can exist). */
export async function clearConversationMessages(conversationId: string): Promise<void> {
  const d = await getDb();
  if (!d) return;
  try {
    await d.runAsync('DELETE FROM messages WHERE conversationId = ?', [conversationId]);
    await d.runAsync('DELETE FROM conv_meta WHERE conversationId = ?', [conversationId]);
  } catch {
    // ignore
  }
}

export async function removeConversationCache(conversationId: string): Promise<void> {
  const d = await getDb();
  if (!d) return;
  try {
    await clearConversationMessages(conversationId);
    await d.runAsync('DELETE FROM details WHERE conversationId = ?', [conversationId]);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Per-conversation sync meta
// ---------------------------------------------------------------------------

export type ConvMeta = { lastSyncAt: string | null; reachedStart: boolean };

export async function getMeta(conversationId: string): Promise<ConvMeta> {
  const d = await getDb();
  if (!d) return { lastSyncAt: null, reachedStart: false };
  try {
    const row = await d.getFirstAsync<{ lastSyncAt: string | null; reachedStart: number }>(
      'SELECT lastSyncAt, reachedStart FROM conv_meta WHERE conversationId = ?',
      [conversationId],
    );
    return { lastSyncAt: row?.lastSyncAt ?? null, reachedStart: !!row?.reachedStart };
  } catch {
    return { lastSyncAt: null, reachedStart: false };
  }
}

export async function setMeta(conversationId: string, patch: Partial<ConvMeta>): Promise<void> {
  const d = await getDb();
  if (!d) return;
  try {
    const cur = await getMeta(conversationId);
    const next = { ...cur, ...patch };
    await d.runAsync(
      'INSERT OR REPLACE INTO conv_meta (conversationId, lastSyncAt, reachedStart) VALUES (?, ?, ?)',
      [conversationId, next.lastSyncAt, next.reachedStart ? 1 : 0],
    );
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Conversation detail + list
// ---------------------------------------------------------------------------

export async function saveDetail(conversationId: string, detail: ConversationDetail): Promise<void> {
  const d = await getDb();
  if (!d) return;
  try {
    await d.runAsync('INSERT OR REPLACE INTO details (conversationId, json) VALUES (?, ?)', [
      conversationId,
      JSON.stringify(detail),
    ]);
  } catch {
    // ignore
  }
}

export async function getCachedDetail(conversationId: string): Promise<ConversationDetail | null> {
  const d = await getDb();
  if (!d) return null;
  try {
    const row = await d.getFirstAsync<{ json: string }>(
      'SELECT json FROM details WHERE conversationId = ?',
      [conversationId],
    );
    return row ? parse<ConversationDetail>(row.json) : null;
  } catch {
    return null;
  }
}

export async function saveConversations(items: ConversationListItem[]): Promise<void> {
  const d = await getDb();
  if (!d) return;
  try {
    await d.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [
      'conversations',
      JSON.stringify(items),
    ]);
  } catch {
    // ignore
  }
}

export async function getCachedConversations(): Promise<ConversationListItem[] | null> {
  const d = await getDb();
  if (!d) return null;
  try {
    const row = await d.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', [
      'conversations',
    ]);
    return row ? parse<ConversationListItem[]>(row.value) : null;
  } catch {
    return null;
  }
}

/** Wipe everything (optional: call on logout if you do not want history kept on the phone). */
export async function clearChatCache(): Promise<void> {
  const d = await getDb();
  if (!d) return;
  try {
    await d.execAsync(
      'DELETE FROM messages; DELETE FROM details; DELETE FROM conv_meta; DELETE FROM kv;',
    );
  } catch {
    // ignore
  }
}
