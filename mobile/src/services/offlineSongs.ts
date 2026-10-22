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

/**
 * Download and persist a song for offline use.
 *
 * @param onProgress Optional. Called with a 0..1 fraction whenever the
 *   download reports byte progress. Fires at least once (with 1) on success.
 */
export async function saveOffline(
  songId: string,
  title: string,
  remoteUrl: string,
  onProgress?: (pct: number) => void,
): Promise<OfflineEntry> {
  await ensureDir();

  const ext = remoteUrl.split('.').pop()?.split('?')[0] || 'mp3';
  const fileUri = `${DIR}${songId}.${ext}`;

  // If we already have the file, skip the download but still report 100%.
  const existing = await FileSystem.getInfoAsync(fileUri);
  if (!existing.exists) {
    const download = FileSystem.createDownloadResumable(
      remoteUrl,
      fileUri,
      {},
      (p) => {
        if (!onProgress) return;
        const total = p.totalBytesExpectedToWrite;
        const written = p.totalBytesWritten;
        if (total > 0) {
          // Cap at 0.99 so the UI can show 100% only after the file is on disk.
          onProgress(Math.min(0.99, written / total));
        }
      },
    );

    const res = await download.downloadAsync();
    if (!res?.uri) {
      throw new Error('Download failed.');
    }
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

  // Now that it's persisted, signal 100%.
  if (onProgress) onProgress(1);

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