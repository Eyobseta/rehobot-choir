import type { ChatMessage } from './chatTypes';

/** Newest first; ISO timestamps compare correctly as strings. */
export function sortDesc(list: ChatMessage[]): ChatMessage[] {
  return [...list].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

function indexOfMessage(list: ChatMessage[], m: ChatMessage): number {
  return list.findIndex(
    (x) => x.id === m.id || (m.clientId !== null && x.clientId === m.clientId),
  );
}

/** Insert or replace (by id, or by clientId so a server copy replaces its optimistic twin). */
export function upsertMessage(list: ChatMessage[], m: ChatMessage): ChatMessage[] {
  const i = indexOfMessage(list, m);
  if (i < 0) return sortDesc([m, ...list]);
  const copy = list.slice();
  copy[i] = m;
  return sortDesc(copy);
}

export function mergeMessages(list: ChatMessage[], items: ChatMessage[]): ChatMessage[] {
  let out = list.slice();
  for (const m of items) {
    const i = indexOfMessage(out, m);
    if (i < 0) out.push(m);
    else out[i] = m;
  }
  out = sortDesc(out);
  return out;
}
