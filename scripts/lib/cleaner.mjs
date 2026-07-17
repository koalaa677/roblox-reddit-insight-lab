/**
 * Comment cleaning & deduplication utilities.
 *
 * Pipeline: raw comment -> normalize -> filter low-value -> dedupe -> scored candidate
 *
 * All logic runs locally. No AI tokens are consumed in this stage.
 */

import { createHash } from "node:crypto";

const DEFAULT_MIN_CHARS = 20;

// Patterns that usually indicate low-value content
const LOW_VALUE_PATTERNS = [
  /^[\s\W_]+$/, // only punctuation / symbols / whitespace
  /^(lol|lmao|lmfao|haha|hehe|nice|cool|yes|no|ok|okay|thx|thanks|ty|same|this|\+1|bump|f)[.!?\s]*$/i,
  /^http(s)?:\/\//i, // link-only
];

const EMOJI_RANGE =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu;

/**
 * Normalize comment body for consistent hashing and comparison.
 * - Collapse whitespace
 * - Decode common HTML entities
 * - Trim
 */
export function normalizeBody(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x200B;/g, "")
    .trim();
}

/**
 * Compute a stable hash for deduplication based on normalized text.
 */
export function bodyHash(normalizedText) {
  return createHash("sha1").update(normalizedText).digest("hex");
}

/**
 * Rough emoji ratio: if the comment is mostly emoji, drop it.
 */
function emojiRatio(text) {
  const matches = text.match(EMOJI_RANGE);
  const emojiCount = matches ? matches.length : 0;
  const charCount = Math.max(text.length, 1);
  return emojiCount / charCount;
}

/**
 * Single-comment quality filter. Returns true if the comment should be kept.
 */
export function isHighInformation(comment, options = {}) {
  const minChars = options.minChars ?? DEFAULT_MIN_CHARS;
  const text = normalizeBody(comment.originalText ?? comment.body ?? comment.text ?? "");

  if (text.length < minChars) return false;
  if (emojiRatio(text) > 0.4) return false;

  for (const pattern of LOW_VALUE_PATTERNS) {
    if (pattern.test(text)) return false;
  }

  return true;
}

/**
 * Deduplicate a list of comments by normalized body hash.
 * Keeps the highest-score version when duplicates exist.
 */
export function dedupeComments(comments) {
  const seen = new Map();

  for (const comment of comments) {
    const normalized = normalizeBody(comment.originalText ?? comment.body ?? comment.text ?? "");
    const hash = bodyHash(normalized);
    const score = comment.score ?? 0;

    const existing = seen.get(hash);
    if (!existing || score > (existing.score ?? 0)) {
      seen.set(hash, { ...comment, _normalized: normalized, _hash: hash });
    }
  }

  return Array.from(seen.values());
}

/**
 * Compute a simple local evidence score used to rank comments before AI selection.
 * Higher = more likely to be a representative evidence item.
 *
 * Factors: length (up to a cap), reddit score, keyword density, sentiment signal strength.
 */
export function evidenceScore(comment, ruleSentiment = null) {
  const text = normalizeBody(comment.originalText ?? comment.body ?? comment.text ?? "");
  const len = text.length;
  const lengthScore = Math.min(len / 200, 1); // 200+ chars = full length score

  const redditScore = comment.score ?? 0;
  const engagementScore = Math.min(Math.max(redditScore, 0) / 20, 1); // 20+ upvotes = full score

  // Rule-classified sentiments are stronger signals than "other"
  const sentimentBonus = ruleSentiment && ruleSentiment !== "other" ? 0.15 : 0;

  const raw = lengthScore * 0.5 + engagementScore * 0.35 + sentimentBonus;
  return Math.round(Math.min(Math.max(raw, 0), 1) * 100);
}

/**
 * Full cleaning pipeline: normalize -> filter -> dedupe -> attach scores.
 */
export function cleanCommentBatch(rawComments, options = {}) {
  const normalized = rawComments.map((c) => ({
    ...c,
    originalText: normalizeBody(c.originalText ?? c.body ?? c.text ?? ""),
  }));

  const filtered = normalized.filter((c) => isHighInformation(c, options));
  const deduped = dedupeComments(filtered);

  return deduped.map((c) => {
    const { _normalized, _hash, ...rest } = c;
    return rest;
  });
}

export default {
  normalizeBody,
  bodyHash,
  isHighInformation,
  dedupeComments,
  evidenceScore,
  cleanCommentBatch,
};
