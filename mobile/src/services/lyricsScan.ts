import { http } from './api';

/**
 * Result of a lyrics scan. The backend always answers 200 with one of these
 * shapes (see backend/songs/ocr.service.ts), so the UI can show a friendly
 * message for each failure code.
 */
export type ScanOutcome =
  | { ok: true; text: string; uncertain: number }
  | { ok: false; code: string };

/**
 * Upload 1–4 photos of a lyrics sheet and get the text back.
 *   scope 'zema'   → POST /zema/ocr    (Zema Team members)
 *   scope 'leader' → POST /leaders/ocr (leaders / admins)
 */
export async function scanLyricsImages(
  uris: string[],
  scope: 'zema' | 'leader' = 'zema',
): Promise<ScanOutcome> {
  const form = new FormData();
  uris.slice(0, 4).forEach((uri, i) => {
    // @ts-expect-error — RN FormData
    form.append('images', { uri, name: `page-${i + 1}.jpg`, type: 'image/jpeg' });
  });

  const res = await http.post<ScanOutcome>(
    scope === 'leader' ? '/leaders/ocr' : '/zema/ocr',
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Render free tier can need up to ~1 min to wake up, then Gemini needs a few seconds.
      timeout: 120_000,
      transformRequest: (d) => d,
    },
  );
  return res.data;
}