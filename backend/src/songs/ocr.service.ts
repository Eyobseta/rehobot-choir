import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ApiError } from '../utils/ApiError';

/**
 * Lyrics OCR via the Gemini API (free tier, no billing needed).
 *
 * Env:
 *   GEMINI_API_KEY          (required) key from https://aistudio.google.com/apikey
 *   GEMINI_MODEL            (optional) primary model.   default: gemini-3.8-flash
 *   GEMINI_FALLBACK_MODEL   (optional) fallback model.  default: gemini-3.6-flash
 *   GEMINI_MODELS           (optional) comma list, overrides the two above,
 *                           e.g. "gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite"
 *
 * Model names change over time. If Google retires one, only change the env
 * variable on Render. No app update needed.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_IMAGES = 4;
const PER_ATTEMPT_TIMEOUT_MS = 45_000;
const TOTAL_BUDGET_MS = 100_000; // the app waits up to 120 s
const RETRY_DELAY_MS = 2_500;
const ATTEMPTS_PER_MODEL = 2; // retry once when a model is busy (503 / timeout)

// Small in-memory guard so one account can't burn the shared free quota.
const WINDOW_MS = 10 * 60_000;
const MAX_SCANS_PER_WINDOW = 15;
const recentScans = new Map<string, number[]>();

function overUserLimit(userId: string): boolean {
  const now = Date.now();
  const hits = (recentScans.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_SCANS_PER_WINDOW) {
    recentScans.set(userId, hits);
    return true;
  }
  hits.push(now);
  recentScans.set(userId, hits);
  return false;
}

const PROMPT = `You are a careful OCR engine for Amharic (Ge'ez / Ethiopic script) choir song lyrics. The text may be handwritten or printed. The attached image(s) are the pages of ONE song, in order.

Transcribe the lyrics EXACTLY as written. Rules:
1. Output ONLY the transcribed lyrics. No explanations, no markdown, no code fences.
2. Keep every line break as in the image. Put ONE blank line between stanzas / verses.
3. Keep chorus markers exactly as written (for example "አዝ፦" at the start of the chorus) and keep repeat marks such as (2x) or x2.
4. Do NOT translate, correct spelling, modernize or add words. Copy what is written, even if it looks like a mistake.
5. If a word or letter is illegible or you are not sure, write [?] in its place. Never guess.
6. Ignore page numbers, doodles, borders and stamps. Leave out a song title, choir name or footer only when it is clearly separate from the lyrics.
7. Keep Latin letters and digits as written.
If there is no text at all in the image, output exactly: NO_TEXT
If there is text but the photo is so blurry, dark or messy that most of it cannot be read, output exactly: UNREADABLE`;

export type OcrImage = { buffer: Buffer; mimetype: string };

export type OcrErrorCode =
  | 'OCR_UNAVAILABLE' // not configured / key rejected
  | 'OCR_RATE_LIMITED' // free quota used up for now
  | 'OCR_BUSY' // Google is overloaded / timed out
  | 'OCR_NO_TEXT' // nothing readable in the photo
  | 'OCR_UNREADABLE' // text is there but (almost) all unreadable
  | 'OCR_TOO_LARGE' // upload too big
  | 'OCR_FAILED'; // anything else

export type OcrResult =
  | { ok: true; text: string; uncertain: number; quality: 'good' | 'fair' | 'poor' }
  | { ok: false; code: OcrErrorCode };

type GeminiOutcome =
  | { kind: 'ok'; text: string }
  | { kind: 'busy' } // transient: 5xx / network / timeout → retry the same model
  | { kind: 'rate' } // 429 → try the next model
  | { kind: 'gone' } // 404 / unsupported → try the next model
  | { kind: 'empty' } // 200 but no text → try the next model
  | { kind: 'config' } // bad key
  | { kind: 'blocked' }; // safety block → no point retrying

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGemini(
  model: string,
  key: string,
  images: OcrImage[],
  timeoutMs: number,
): Promise<GeminiOutcome> {
  let res: globalThis.Response;
  try {
    res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: PROMPT },
              ...images.map((img) => ({
                inline_data: { mime_type: img.mimetype, data: img.buffer.toString('base64') },
              })),
            ],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 8192 },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    console.error('[ocr] request error', model, (e as Error).message);
    return { kind: 'busy' };
  }

  if (res.status === 429) {
    console.error('[ocr] rate limited', model);
    return { kind: 'rate' };
  }
  if (res.status === 401 || res.status === 403) {
    console.error('[ocr] auth error', res.status);
    return { kind: 'config' };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[ocr] http', res.status, model, body.slice(0, 300));
    if (res.status === 400 && /api key/i.test(body)) return { kind: 'config' };
    if (res.status >= 500) return { kind: 'busy' };
    return { kind: 'gone' }; // 404 (model retired), 400 (unsupported option), ...
  }

  const data: any = await res.json().catch(() => null);
  if (data?.promptFeedback?.blockReason) {
    console.error('[ocr] blocked', data.promptFeedback.blockReason);
    return { kind: 'blocked' };
  }
  const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');
  if (!text.trim()) return { kind: 'empty' };
  return { kind: 'ok', text };
}

function clean(raw: string): string {
  return raw
    .replace(/^\s*```[a-z]*\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function modelList(): string[] {
  const fromList = (process.env.GEMINI_MODELS ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  const list = fromList.length
    ? fromList
    : [
        process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.6-flash',
      ];
  return list.filter((m, i, a) => a.indexOf(m) === i);
}

function judge(rawText: string): OcrResult {
  const text = clean(rawText);
  if (!text || /^NO_TEXT\b/.test(text)) return { ok: false, code: 'OCR_NO_TEXT' };
  if (/^UNREADABLE\b/.test(text)) return { ok: false, code: 'OCR_UNREADABLE' };

  const uncertain = (text.match(/\[\?\]/g) ?? []).length;
  const words = text.replace(/\[\?\]/g, ' ').split(/\s+/).filter(Boolean).length;
  const ratio = uncertain / Math.max(1, words + uncertain);

  // Mostly [?] → nothing useful to put in the field.
  if (uncertain > 0 && ratio >= 0.5) return { ok: false, code: 'OCR_UNREADABLE' };

  const quality = uncertain === 0 ? 'good' : ratio >= 0.15 ? 'poor' : 'fair';
  return { ok: true, text, uncertain, quality };
}

export async function extractLyricsFromImages(images: OcrImage[]): Promise<OcrResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('[ocr] GEMINI_API_KEY is not set');
    return { ok: false, code: 'OCR_UNAVAILABLE' };
  }

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let sawRate = false;
  let sawBusy = false;

  models: for (const model of modelList()) {
    for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 8_000) break models;

      const out = await callGemini(model, key, images, Math.min(PER_ATTEMPT_TIMEOUT_MS, remaining));

      if (out.kind === 'ok') return judge(out.text);
      if (out.kind === 'config') return { ok: false, code: 'OCR_UNAVAILABLE' };
      if (out.kind === 'blocked') return { ok: false, code: 'OCR_FAILED' };

      if (out.kind === 'busy') {
        sawBusy = true;
        if (attempt + 1 < ATTEMPTS_PER_MODEL) {
          await sleep(RETRY_DELAY_MS);
          continue; // retry the same model once
        }
        continue models;
      }
      if (out.kind === 'rate') sawRate = true;
      continue models; // 'rate' | 'gone' | 'empty' → next model
    }
  }

  if (sawRate && !sawBusy) return { ok: false, code: 'OCR_RATE_LIMITED' };
  if (sawBusy) return { ok: false, code: 'OCR_BUSY' };
  if (sawRate) return { ok: false, code: 'OCR_RATE_LIMITED' };
  return { ok: false, code: 'OCR_FAILED' };
}

// ---------------------------------------------------------------------------
// Express glue (shared by the Zema and Leader routers)
// ---------------------------------------------------------------------------

const rawUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: MAX_IMAGES },
});

/**
 * Same `.array(name, max)` API as multer, but upload problems (file too big,
 * too many files) come back as a friendly { ok:false, code } instead of a 500.
 */
export const ocrUpload = {
  array(name: string, maxCount: number) {
    const mw = rawUpload.array(name, maxCount);
    return (req: Request, res: Response, next: NextFunction) => {
      mw(req, res, (err: any) => {
        if (!err) return next();
        const code: OcrErrorCode = err?.code === 'LIMIT_FILE_SIZE' ? 'OCR_TOO_LARGE' : 'OCR_FAILED';
        res.json({ ok: false, code } satisfies OcrResult);
      });
    };
  },
};

export async function scanLyricsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw ApiError.unauthorized();
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw ApiError.badRequest('At least one image is required.');
    if (files.some((f) => !f.mimetype.startsWith('image/'))) {
      throw ApiError.badRequest('Only image files are allowed.');
    }
    if (overUserLimit(req.auth.userId)) {
      return res.json({ ok: false, code: 'OCR_RATE_LIMITED' } satisfies OcrResult);
    }
    const result = await extractLyricsFromImages(
      files.slice(0, MAX_IMAGES).map((f) => ({ buffer: f.buffer, mimetype: f.mimetype })),
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
}