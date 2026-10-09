type Listener = (n: number) => void;

let count = 0;
const listeners = new Set<Listener>();

export function getUnread(): number {
  return count;
}

export function setUnread(n: number): void {
  count = n;
  for (const l of listeners) l(count);
}

export function subscribeUnread(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}