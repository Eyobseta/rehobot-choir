import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ApiError } from '../utils/ApiError';

/**
 * Lyrics OCR via the Gemini API (free tier, no billing needed).
 *
 * Env:
 *   GEMINI_API_KEY          (required) key from https://aistudio.google.com/apikey
 *   GEMINI_MODEL            (optional) default: gemini-3.8-flash
 *   GEMINI_FALLBACK_MODEL   (optional) default: gemini-2.5-flash
 *
 * Model names change over time: if Google retires one, just change the env
 * variable on Render. No app update needed.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_IMAGES = 4;
const REQUEST_TIMEOUT_MS = 60_000;

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
If there is no readable text, output exactly: NO_TEXT`;

export type OcrImage = { buffer: Buffer; mimetype: string };

export type OcrResult =
  | { ok: true; text: string; uncertain: number }
  | { ok: false; code: 'OCR_UNAVAILABLE' | 'OCR_RATE_LIMITED' | 'OCR_NO_TEXT' | 'OCR_FAILED' };

type GeminiOutcome =
  | { kind: 'ok'; text: string }
  | { kind: 'retry' } // try the fallback model
  | { kind: 'rate' }
  | { kind: 'config' }
  | { kind: 'fail' };

async function callGemini(model: string, key: string, images: OcrImage[]): Promise<GeminiOutcome> {
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
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    console.error('[ocr] request error', model, (e as Error).message);
    return { kind: 'retry' };
  }

  if (res.status === 429) return { kind: 'rate' };
  if (res.status === 401 || res.status === 403) {
    console.error('[ocr] auth error', res.status);
    return { kind: 'config' };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[ocr] http', res.status, model, body.slice(0, 300));
    // 400 with an invalid key is a config problem; other 4xx/5xx → try fallback model
    if (res.status === 400 && /api key/i.test(body)) return { kind: 'config' };
    return { kind: 'retry' };
  }

  const data: any = await res.json().catch(() => null);
  if (data?.promptFeedback?.blockReason) {
    console.error('[ocr] blocked', data.promptFeedback.blockReason);
    return { kind: 'fail' };
  }
  const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');
  if (!text.trim()) return { kind: 'retry' };
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

export async function extractLyricsFromImages(images: OcrImage[]): Promise<OcrResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('[ocr] GEMINI_API_KEY is not set');
    return { ok: false, code: 'OCR_UNAVAILABLE' };
  }

  const models = [
    process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash',
  ].filter((m, i, a) => a.indexOf(m) === i);

  let sawRate = false;
  for (const model of models) {
    const out = await callGemini(model, key, images);
    if (out.kind === 'ok') {
      const text = clean(out.text);
      if (!text || text === 'NO_TEXT') return { ok: false, code: 'OCR_NO_TEXT' };
      return { ok: true, text, uncertain: (text.match(/\[\?\]/g) ?? []).length };
    }
    if (out.kind === 'config') return { ok: false, code: 'OCR_UNAVAILABLE' };
    if (out.kind === 'rate') sawRate = true;
    if (out.kind === 'fail') return { ok: false, code: 'OCR_FAILED' };
    // 'retry' / 'rate' → next model
  }
  return { ok: false, code: sawRate ? 'OCR_RATE_LIMITED' : 'OCR_FAILED' };
}

// ---------------------------------------------------------------------------
// Express glue (shared by the Zema and Leader routers)
// ---------------------------------------------------------------------------

export const ocrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: MAX_IMAGES },
});

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