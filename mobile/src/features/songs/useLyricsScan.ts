import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTranslation } from 'react-i18next';
import { scanLyricsImages, ScanOutcome } from '../../services/lyricsScan';

const MAX_PAGES = 4;
const MAX_WIDTH = 1600;

type Choice<T> = { text: string; value: T; style?: 'cancel' | 'default' | 'destructive' };

/**
 * One place that turns a scan failure code (from the backend OR from the
 * network layer) into a friendly, translated message.
 */
export function scanErrorMessage(t: any, code: string): string {
  switch (code) {
    case 'OCR_BUSY':
      return t('zema.scanBusy', {
        defaultValue: 'The scanning service is busy right now. Please wait a minute and try again.',
      });
    case 'OCR_RATE_LIMITED':
      return t('zema.scanRateLimited', {
        defaultValue: 'Scan limit reached for now. Please try again in a few minutes, or type the lyrics.',
      });
    case 'OCR_NO_TEXT':
      return t('zema.scanNoText', {
        defaultValue: 'No readable text found. Try a clearer, closer photo.',
      });
    case 'OCR_UNREADABLE':
      return t('zema.scanUnreadable', {
        defaultValue:
          "We couldn't read this handwriting. Take the photo in good light, without shadows, holding the phone straight above one page at a time. You can also type the lyrics.",
      });
    case 'OCR_UNAVAILABLE':
      return t('zema.scanUnavailable', {
        defaultValue: 'Scanning is not available right now. Please type the lyrics.',
      });
    case 'OCR_TOO_LARGE':
      return t('zema.scanTooLarge', { defaultValue: 'The photo is too large. Please try again.' });
    case 'TIMEOUT':
      return t('zema.scanTimeout', {
        defaultValue: 'It took too long. The server may be waking up, please try again.',
      });
    case 'NETWORK_ERROR':
      return t('zema.scanOffline', {
        defaultValue: 'No internet connection. Check your connection and try again.',
      });
    default:
      return t('zema.scanFailed', { defaultValue: 'Could not read the photo. Please try again.' });
  }
}

/** Promise wrapper around Alert so the flow reads top-to-bottom. */
export function askChoice<T>(title: string, message: string | undefined, choices: Choice<T>[]) {
  return new Promise<T | null>((resolve) => {
    Alert.alert(
      title,
      message,
      choices.map((c) => ({ text: c.text, style: c.style, onPress: () => resolve(c.value) })),
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

/**
 * Photo(s) of a lyrics sheet → text. Reuses the same expo-image-picker /
 * expo-image-manipulator setup as the registration photo, so no native
 * rebuild is needed.
 *
 * `scan()` resolves to:
 *   - null           → the user cancelled
 *   - ScanOutcome    → { ok: true, text, uncertain } | { ok: false, code }
 */
export function useLyricsScan(scope: 'zema' | 'leader' = 'zema') {
  const { t } = useTranslation();
  const [scanning, setScanning] = useState(false);

  const compress = async (uri: string, width?: number) => {
    const actions = width && width > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : [];
    const out = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return out.uri;
  };

  const denied = () =>
    Alert.alert(
      t('zema.scanPermissionTitle', { defaultValue: 'Permission needed' }),
      t('zema.scanPermissionBody', {
        defaultValue: 'Please allow access in your phone settings to scan lyrics.',
      }),
    );

  const fromCamera = async (): Promise<string | null> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      denied();
      return null;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: true, // lets the user crop to the page
    });
    if (res.canceled || !res.assets[0]) return null;
    return compress(res.assets[0].uri, res.assets[0].width);
  };

  const fromLibrary = async (limit: number): Promise<string[]> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      denied();
      return [];
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsMultipleSelection: true,
      selectionLimit: limit,
    });
    if (res.canceled) return [];
    return Promise.all(res.assets.slice(0, limit).map((a) => compress(a.uri, a.width)));
  };

  const scan = useCallback(async (): Promise<ScanOutcome | null> => {
    const source = await askChoice<'camera' | 'library'>(
      t('zema.scanTitle', { defaultValue: 'Scan lyrics' }),
      t('zema.scanHint', {
        defaultValue: 'Take a clear, well-lit photo of the lyrics sheet.',
      }),
      [
        { text: t('register.takePhoto'), value: 'camera' },
        { text: t('register.chooseFromLibrary'), value: 'library' },
        { text: t('register.cancel'), value: null as any, style: 'cancel' },
      ],
    );
    if (!source) return null;

    const pages: string[] = [];
    if (source === 'library') {
      pages.push(...(await fromLibrary(MAX_PAGES)));
    } else {
      while (pages.length < MAX_PAGES) {
        const uri = await fromCamera();
        if (!uri) break;
        pages.push(uri);
        if (pages.length >= MAX_PAGES) break;
        const more = await askChoice<'more' | 'done'>(
          t('zema.scanMoreTitle', { defaultValue: 'Add another page?' }),
          t('zema.scanMoreBody', {
            defaultValue: 'If the song continues on another page, add it now.',
            count: pages.length,
          }),
          [
            { text: t('zema.scanAddPage', { defaultValue: 'Add page' }), value: 'more' },
            { text: t('zema.scanDone', { defaultValue: 'Done' }), value: 'done' },
          ],
        );
        if (more !== 'more') break;
      }
    }
    if (!pages.length) return null;

    setScanning(true);
    try {
      return await scanLyricsImages(pages, scope);
    } finally {
      setScanning(false);
    }
  }, [t, scope]);

  return { scan, scanning };
}