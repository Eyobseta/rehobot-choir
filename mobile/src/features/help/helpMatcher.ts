import type { HelpEntry, HelpRole, HelpLanguage } from './helpTypes';

const EN_STOP = new Set([
  'the','a','an','is','are','was','were','be','been','being','how','do','does','did',
  'i','you','we','they','he','she','my','your','our','their','his','her','to','for',
  'of','in','on','at','by','with','from','about','and','or','but','if','then','so',
  'what','where','when','why','who','which','whose','it','this','that','these','those',
  'can','could','should','would','will','shall','may','might','must','have','has','had',
  'get','got','use','using','go','going','want','need','please','thanks','thank',
]);

const AM_STOP = new Set([
  'እና','ምን','እንዴት','የ','ለ','በ','ከ','ውስጥ','ነው','ናት','ናቸው','ነበር',
  'እኔ','አንተ','አንቺ','እሱ','እሷ','እኛ','እናንተ','እነሱ','ይህ','ያ','ይህን','ያን',
  'ወደ','ላይ','ስር','ጋር','ግን','ወይም','ስለ','ነገር',
]);

/** ADMIN sees everything; others only entries tagged with their role. */
export function canSee(entry: HelpEntry, role: HelpRole): boolean {
  return role === 'ADMIN' || entry.visibleToRoles.includes(role);
}

/**
 * Keeps a-z, 0-9, whitespace and the Ethiopic blocks. Explicit ranges instead
 * of \p{L} so it also works on Hermes builds without Unicode property escapes.
 */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u1200-\u139f\u2d80-\u2ddf\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** songs → song, memories → memorie (consistent on both sides, which is all that matters). */
const stem = (t: string) => (/^[a-z]{4,}s$/.test(t) ? t.slice(0, -1) : t);

function tokenize(s: string, lang: HelpLanguage): string[] {
  const stop = lang === 'am' ? AM_STOP : EN_STOP;
  return normalise(s)
    .split(' ')
    .filter((t) => t.length > 0 && !stop.has(t))
    .map(stem);
}

function overlap(q: Set<string>, t: Set<string>): number {
  let n = 0;
  for (const x of t) if (q.has(x)) n++;
  return n;
}

function trigrams(s: string): Set<string> {
  const p = `  ${s}  `;
  const out = new Set<string>();
  for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export type MatchResult = { entry: HelpEntry; score: number };

const MIN_TOKEN_SCORE = 4.5;
const MIN_FUZZY_SCORE = 2;

export function matchHelpQuery(
  query: string,
  entries: HelpEntry[],
  opts: { role: HelpRole; language: HelpLanguage; currentScreen?: string },
): MatchResult | null {
  const qTokens = new Set([
    ...tokenize(query, 'en'),
    ...tokenize(query, 'am'),
  ]);
  if (!qTokens.size) return null;
  const qSize = qTokens.size;

  const qTrigrams = trigrams(normalise(query));
  let best: MatchResult | null = null;

  for (const entry of entries) {
    if (!canSee(entry, opts.role)) continue;

    // Help is only reachable from the Profile screen, so a screen boost would
    // just bias every query toward profile entries. Kept as a no-op hook.
    const screenBoost = 0;

    let bestScore = 0;

    /**
     * score = shared tokens * weight
     *       + how much of the phrase was covered (0..1) * 2
     *       + how much of the user's query it explains (0..1)
     * The last two terms break ties in favour of the more specific entry.
     * `strict` (question variants): one shared word alone is not enough
     * unless it is at least half of the variant.
     */
    const consider = (
      texts: string[],
      lang: HelpLanguage,
      weight: number,
      strict: boolean,
    ) => {
      for (const text of texts) {
        const t = new Set(tokenize(text, lang));
        if (t.size === 0) continue;
        const o = overlap(qTokens, t);
        if (o === 0) continue;
        const coverage = o / t.size;
        if (strict && o < 2 && coverage < 0.5) continue;
        const s = o * weight + coverage * 2 + o / qSize;
        if (s > bestScore) bestScore = s;
      }
    };

    consider(entry.intentsEn, 'en', 3, false);
    consider(entry.intentsAm, 'am', 3, false);
    consider(entry.questionVariantsEn, 'en', 2, true);
    consider(entry.questionVariantsAm, 'am', 2, true);

    let fuzzy = false;
    // Typo / transliteration fallback.
    if (bestScore < MIN_TOKEN_SCORE) {
      for (const intent of [...entry.intentsEn, ...entry.intentsAm]) {
        const sim = jaccard(qTrigrams, trigrams(normalise(intent)));
        if (sim > 0.5) {
          const s = sim * 4;
          if (s > bestScore) { bestScore = s; fuzzy = true; }
        }
      }
    }
    if (!fuzzy && bestScore < MIN_TOKEN_SCORE) bestScore = 0;
    if (fuzzy && bestScore < MIN_FUZZY_SCORE) bestScore = 0;

    const total = bestScore > 0 ? bestScore + screenBoost : 0;
    if (total > 0 && (!best || total > best.score)) best = { entry, score: total };
  }

  if (!best) return null;
  return best;
}

export function pickAnswer(entry: HelpEntry, lang: HelpLanguage): string {
  if (lang === 'am' && entry.answerAm?.trim()) return entry.answerAm;
  return entry.answerEn;
}

export function suggestCategories(
  entries: HelpEntry[],
  role: HelpRole,
  limit = 6,
): string[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (!canSee(e, role)) continue;
    counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([c]) => c);
}