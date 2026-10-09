import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiPost } from './api';

/**
 * Expo Go (SDK 53+) removed Android push notification support.
 * Any call to expo-notifications on Android in Expo Go will crash.
 *
 * We detect Expo Go here and skip all push work in that environment.
 * In a development build or production app, everything runs normally.
 */
function isExpoGo(): boolean {
  // appOwnership === 'expo' means Expo Go. 'standalone' or 'guest' means
  // a real build (dev client or production).
  const ownership = (Constants as any).appOwnership;
  return ownership === 'expo';
}

function canUsePush(): boolean {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android' && isExpoGo()) return false;
  return true;
}

// Lazy-load expo-notifications and expo-device ONLY when we can use them.
// This is critical: importing them at module load time crashes Expo Go
// on Android in SDK 53+.
async function loadNotificationsModule() {
  const Notifications = await import('expo-notifications');
  const Device = await import('expo-device');
  return { Notifications, Device };
}

/**
 * Global notification handler. Must be called once at app startup.
 * In Expo Go on Android this is a no-op.
 */
export function configureForegroundNotifications(): void {
  if (!canUsePush()) {
    // eslint-disable-next-line no-console
    console.log('[pushTokens] push disabled in this environment (Expo Go Android)');
    return;
  }

  void (async () => {
    try {
      const { Notifications } = await loadNotificationsModule();
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[pushTokens] handler setup failed', e);
    }
  })();
}

/**
 * Ensures the Android default channel exists.
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { Notifications } = await loadNotificationsModule();
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#55883B',
    });
  } catch {
    // ignore
  }
}

/**
 * Returns the Expo push token, or null when unavailable.
 * Never throws.
 */
async function getPushTokenOrNull(): Promise<string | null> {
  if (!canUsePush()) return null;

  try {
    const { Notifications, Device } = await loadNotificationsModule();

    if (!Device.isDevice) return null;

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== 'granted') {
      const request = await Notifications.requestPermissionsAsync();
      status = request.status;
    }

    if (status !== 'granted') return null;

    await ensureAndroidChannel();

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;

    if (!projectId) {
      // eslint-disable-next-line no-console
      console.warn('[pushTokens] No EAS projectId configured.');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data ?? null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[pushTokens] getPushTokenOrNull failed', e);
    return null;
  }
}

/**
 * Register the current device with the backend.
 * Safe to call multiple times. Never throws.
 */
export async function registerDeviceWithBackend(): Promise<string | null> {
  const token = await getPushTokenOrNull();
  if (!token) return null;

  try {
    await apiPost('/notifications/register-token', {
      token,
      platform: Platform.OS,
      deviceLabel: undefined,
    });
    return token;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[pushTokens] register with backend failed', e);
    return null;
  }
}

/**
 * Unregister the current device from the backend.
 * Best-effort. Never throws.
 */
export async function unregisterDeviceFromBackend(): Promise<void> {
  const token = await getPushTokenOrNull();
  if (!token) return;

  try {
    await apiPost('/notifications/unregister-token', { token });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[pushTokens] unregister from backend failed', e);
  }
}