import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

/**
 * A single global audio player that survives across screens.
 * Play, pause, seek and status are shared by every consumer.
 */

export type SimpleStatus = {
  isLoaded: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
};

let player: AudioPlayer | null = null;
let currentKey: string | null = null;
let currentTitle: string | null = null;
const listeners = new Set<(s: SimpleStatus) => void>();

let modeConfigured = false;

async function ensureMode() {
  if (modeConfigured) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    });
  } catch {
    // Non-fatal.
  }
  modeConfigured = true;
}

function snapshot(): SimpleStatus {
  if (!player) {
    return {
      isLoaded: false,
      isPlaying: false,
      positionMillis: 0,
      durationMillis: 0,
    };
  }
  const s = player.currentStatus ?? {};
  return {
    isLoaded: !!s.isLoaded,
    isPlaying: !!s.playing,
    positionMillis:
      typeof s.currentTime === 'number' ? s.currentTime * 1000 : 0,
    durationMillis:
      typeof s.duration === 'number' ? s.duration * 1000 : 0,
  };
}

function emit() {
  const snap = snapshot();
  for (const l of listeners) l(snap);
}

export type PlayInput = {
  key: string;
  uri: string;
  title?: string;
};

export async function playTrack(input: PlayInput): Promise<void> {
  await ensureMode();

  if (currentKey === input.key && player) {
    try {
      player.play();
      emit();
      return;
    } catch {
      // Fall through to fresh load.
    }
  }

  await stopTrack();

  const created = createAudioPlayer({ uri: input.uri });
  player = created;
  currentKey = input.key;
  currentTitle = input.title ?? null;

  created.addListener('playbackStatusUpdate', () => emit());

  try {
    created.play();
  } catch {
    // ignore
  }

  emit();
}

export async function pauseTrack(): Promise<void> {
  if (!player) return;
  try {
    player.pause();
  } catch {
    // ignore
  }
  emit();
}

export async function resumeTrack(): Promise<void> {
  if (!player) return;
  try {
    player.play();
  } catch {
    // ignore
  }
  emit();
}

export async function stopTrack(): Promise<void> {
  if (player) {
    try {
      player.pause();
      player.remove();
    } catch {
      // ignore
    }
  }
  player = null;
  currentKey = null;
  currentTitle = null;
  emit();
}

export async function seekTo(ms: number): Promise<void> {
  if (!player) return;
  try {
    await player.seekTo(ms / 1000);
    emit();
  } catch {
    // ignore
  }
}

/**
 * Skip ±deltaSec relative to the current position.
 * Clamped to [0, duration].
 */
export async function skipBy(deltaSec: number): Promise<void> {
  if (!player) return;
  try {
    const s = player.currentStatus;
    if (!s?.isLoaded) return;
    const current = typeof s.currentTime === 'number' ? s.currentTime : 0;
    const duration = typeof s.duration === 'number' ? s.duration : 0;
    const next = Math.max(
      0,
      Math.min(duration || Infinity, current + deltaSec),
    );
    await player.seekTo(next);
    emit();
  } catch {
    // ignore
  }
}

export function getCurrentKey(): string | null {
  return currentKey;
}

export function getCurrentTitle(): string | null {
  return currentTitle;
}

export function getSnapshot(): SimpleStatus {
  return snapshot();
}

export function subscribe(listener: (s: SimpleStatus) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}