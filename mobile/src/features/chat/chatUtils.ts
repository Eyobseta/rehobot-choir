import type { ChatMessage, LastMessage } from './chatTypes';
import type { Tr } from './chatStrings';

export const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

export const ALL_EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤗',
  '🤔', '😮', '😢', '😭', '😡', '🥳', '😇', '🙃', '😴', '🤩',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '👌', '✌️', '🤝', '❤️',
  '🧡', '💛', '💚', '💙', '💜', '🔥', '✨', '🎉', '🎶', '🎵',
  '⛪', '✝️', '🕊️', '📖', '🌟', '☀️', '🌹', '💐', '🎂', '🥁',
];

export function newClientId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Cloudinary on-the-fly resize for thumbnails. Other URLs pass through. */
export function thumbUrl(url: string, width = 480): string {
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`);
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? '?';
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (a + b).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function sameDay(a: string, b: string): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

export function dayLabel(iso: string, tr: Tr): string {
  const now = new Date().toISOString();
  if (sameDay(iso, now)) return tr('today');
  const yest = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if (sameDay(iso, yest)) return tr('yesterday');
  return new Date(iso).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Short label for the conversation list: time today, else weekday/date. */
export function listTime(iso: string, tr: Tr): string {
  const now = new Date().toISOString();
  if (sameDay(iso, now)) return formatClock(iso);
  const yest = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if (sameDay(iso, yest)) return tr('yesterday');
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function lastSeenLabel(iso: string | null, tr: Tr): string {
  if (!iso) return '';
  const when = `${dayLabel(iso, tr)} ${formatClock(iso)}`;
  return tr('lastSeen', { when });
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function messagePreview(
  m: Pick<LastMessage | ChatMessage, 'type' | 'text' | 'deleted'>,
  tr: Tr,
): string {
  if (m.deleted) return tr('messageDeleted');
  if (m.text && m.text.trim()) return m.text;
  if (m.type === 'VOICE') return `🎤 ${tr('voiceMessage')}`;
  if (m.type === 'PHOTO') return `📷 ${tr('photo')}`;
  return '';
}

/** "#RRGGBB" -> rgba string helper is in Auth_UI (withAlpha); re-exported for convenience. */
export { withAlpha } from '../auth/Auth_UI';
