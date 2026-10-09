import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DIR = FileSystem.documentDirectory + 'offline-songs/';
const INDEX_KEY = '@rehobot/offline-songs';

export type OfflineEntry = {
  songId: string;
  title: string;
  fileUri: string;
  savedAt: string;
};

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  }
}

async function readIndex(): Promise<OfflineEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as OfflineEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeIndex(entries: OfflineEntry[]): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

export async function listOffline(): Promise<OfflineEntry[]> {
  return readIndex();
}

export async function isOffline(songId: string): Promise<boolean> {
  const entries = await readIndex();
  return entries.some((e) => e.songId === songId);
}

export async function saveOffline(
  songId: string,
  title: string,
  remoteUrl: string,
): Promise<OfflineEntry> {
  await ensureDir();
  const ext = remoteUrl.split('.').pop()?.split('?')[0] || 'mp3';
  const fileUri = `${DIR}${songId}.${ext}`;

  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists) {
    await FileSystem.downloadAsync(remoteUrl, fileUri);
  }

  const entry: OfflineEntry = {
    songId,
    title,
    fileUri,
    savedAt: new Date().toISOString(),
  };

  const entries = (await readIndex()).filter((e) => e.songId !== songId);
  entries.unshift(entry);
  await writeIndex(entries);
  return entry;
}

export async function removeOffline(songId: string): Promise<void> {
  const entries = await readIndex();
  const target = entries.find((e) => e.songId === songId);
  if (target) {
    try {
      await FileSystem.deleteAsync(target.fileUri, { idempotent: true });
    } catch {
      // ignore
    }
  }
  const next = entries.filter((e) => e.songId !== songId);
  await writeIndex(next);
}

export async function clearAllOffline(): Promise<void> {
  try {
    await FileSystem.deleteAsync(DIR, { idempotent: true });
  } catch {
    // ignore
  }
  await writeIndex([]);
}