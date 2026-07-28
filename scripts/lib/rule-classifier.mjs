/**
 * Rule-based sentiment classification and tag extraction.
 *
 * This is the FIRST pass — cheap, local, keyword-driven.
 * The AI classification stage later calibrates and refines these labels.
 *
 * Output buckets: positive | negative | suggestion | other
 * Also attaches preliminary topic tags.
 */

// Positive sentiment indicators
const POSITIVE_KEYWORDS = [
  "love",
  "loved",
  "loving",
  "great",
  "amazing",
  "awesome",
  "fun",
  "addict",
  "addicted",
  "hooked",
  "best",
  "enjoy",
  "enjoyed",
  "satisfying",
  "satisfied",
  "cool",
  "nice",
  "excellent",
  "wonderful",
  "fantastic",
  "obsessed",
  "can't stop",
  "worth it",
  "recommend",
  "favorite",
  "favourite",
  "perfect",
  "beautiful",
  "brilliant",
  "impressed",
  "genius",
  "go-to",
  "worth grinding",
  "smooth",
  "proud",
];

// Negative sentiment indicators
const NEGATIVE_KEYWORDS = [
  "bad",
  "terrible",
  "awful",
  "worst",
  "boring",
  "bug",
  "bugs",
  "broken",
  "crash",
  "crashes",
  "crashed",
  "lag",
  "laggy",
  "frustrat",
  "hate",
  "hated",
  "annoying",
  "trash",
  "garbage",
  "disappoint",
  "disappointed",
  "suck",
  "sucks",
  "sucked",
  "unplayable",
  "glitch",
  "glitches",
  "glitchy",
  "painful",
  "waste of time",
  "not worth",
  "rip off",
  "pay to win",
  "p2w",
  "feel random",
  "feels random",
  "felt random",
  "does not win",
  "robux only",
  "barely",
  "way too",
  "ridiculous",
  "discourages",
  "same items",
];

// Suggestion / feature-request indicators
const SUGGESTION_KEYWORDS = [
  "should add",
  "should be",
  "should have",
  "should show",
  "should give",
  "could add",
  "could be",
  "need to",
  "need more",
  "need a",
  "i want",
  "wish there",
  "wish they",
  "please add",
  "please make",
  "suggest",
  "suggestion",
  "feature request",
  "it would be nice",
  "would be great if",
  "would love to see",
  "can we have",
  "can you add",
  "hope they",
  "i'd like",
  "i would like",
  "add more",
  "improve",
  "fix",
  "update",
  "rework",
  "balance",
  "nerf",
  "buff",
];

// Topic tag patterns (rough)
const TOPIC_PATTERNS = {
  retention: [/\baddict\w*\b/i, /\bhooked\b/i, /\bcan't stop\b/i, /\bkeep playing\b/i, /\bcome back\b/i],
  progression: [/\blevel\b/i, /\bprogress\w*\b/i, /\bupgrade\w*\b/i, /\bunlock\w*\b/i, /\bgrind\w*\b/i, /\bgrindy\b/i],
  reward: [/\breward\w*\b/i, /\bloot\b/i, /\bgem\w*\b/i, /\bcoin\w*\b/i, /\bdrop\w*\b/i, /\bitem\w*\b/i],
  event: [/\bevent\w*\b/i, /\bholiday\b/i, /\bseason\w*\b/i, /\bupdate\w*\b/i, /\bpatch\w*\b/i],
  teamwork: [/\bteam\w*\b/i, /\bcoop\b/i, /\bco-op\b/i, /\bsquad\b/i, /\bparty\b/i, /\blobby\b/i, /\bpublic game\b/i, /\brandoms?\b/i],
  "public-lobby": [/\bpublic\b/i, /\brandoms?\b/i, /\blobby\b/i, /\bteammate\w*\b/i, /\bkick\w*\b/i, /\bleave\w*\b.*early/i, /\bafk\b/i],
  stability: [/\bbug\w*\b/i, /\bcrash\w*\b/i, /\blag\w*\b/i, /\bglitch\w*\b/i, /\bfreeze\w*\b/i, /\bdisconnect\w*\b/i, /\boverheat\w*\b/i],
  frustration: [/\bfrustrat\w*\b/i, /\bannoying\b/i, /\bworst\b/i, /\bterrible\b/i, /\bunfair\b/i, /\brage\w*\b/i],
  equipment: [/\bweapon\w*\b/i, /\btool\w*\b/i, /\bgear\b/i, /\baxe\b/i, /\bsword\b/i, /\bbackpack\b/i, /\bupgrade\w*\b/i],
  "base-building": [/\bbase\b/i, /\bbuild\w*\b/i, /\bwall\w*\b/i, /\bfence\b/i, /\bshelf\w*\b/i, /\bcamp\b/i, /\bstructure\w*\b/i],
  onboarding: [/\btutorial\w*\b/i, /\bnew player\b/i, /\bbeginner\b/i, /\bfirst time\b/i, /\bnoob\b/i, /\bexplain\w*\b/i, /\bguide\b/i],
  resource: [/\bresource\w*\b/i, /\bscrap\b/i, /\bwood\b/i, /\bstone\b/i, /\bmaterial\w*\b/i, /\bfarm\w*\b/i, /\bgather\w*\b/i],
  lore: [/\blore\b/i, /\bstory\b/i, /\bplot\b/i, /\bworld\b/i, /\bsecret\w*\b/i, /\bhidden\b/i],
  "hard-mode": [/\bhard mode\b/i, /\bdifficulty\b/i, /\bchalleng\w*\b/i, /\bnightmare\b/i],
  completion: [/\bbeat\b/i, /\bcomplete\w*\b/i, /\bfinish\w*\b/i, /\bwin\w*\b/i, /\bachievement\w*\b/i, /\bbadge\b/i],
  "first-time": [/\bfirst time\b/i, /\bnew player\b/i, /\bjust started\b/i, /\btried it\b/i],
  tension: [/\bscary\b/i, /\bscared\b/i, /\bhorror\b/i, /\btension\b/i, /\bstress\w*\b/i, /\bchase\w*\b/i, /\bafraid\b/i],
  "anti-troll": [/\btroll\w*\b/i, /\bgrief\w*\b/i, /\bgriefer\w*\b/i, /\bsteal\w*\b/i, /\bstealing\b/i, /\bmalicious\b/i],
  guide: [/\bguide\b/i, /\bhow to\b/i, /\btip\w*\b/i, /\bhint\w*\b/i, /b\?\b/i],
  "map-detail": [/\bmap\b/i, /\bbiome\b/i, /\blocation\w*\b/i, /\barea\w*\b/i, /\bzone\w*\b/i, /\bedge\b/i],
};

function isNegated(text, matchIndex) {
  const prefix = text.slice(Math.max(0, matchIndex - 36), matchIndex);
  if (/\bnot\s+only\s+(?:\w+\s+){0,2}$/.test(prefix)) return false;
  return /\b(?:no|not|never|without)\s+(?:\w+\s+){0,2}$/.test(prefix);
}

function countMatches(text, keywords, options = {}) {
  const lower = text.toLowerCase();
  let count = 0;
  for (const kw of keywords) {
    let matchIndex = lower.indexOf(kw);
    while (matchIndex !== -1) {
      if (!options.ignoreNegated || !isNegated(lower, matchIndex)) {
        count += 1;
        break;
      }
      matchIndex = lower.indexOf(kw, matchIndex + kw.length);
    }
  }
  return count;
}

function extractTopicTags(text) {
  const tags = [];
  for (const [tag, patterns] of Object.entries(TOPIC_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        tags.push(tag);
        break;
      }
    }
  }
  return tags;
}

/**
 * Classify a single comment into one of four buckets using keyword rules.
 * Returns { sentiment, confidence, tags }
 */
export function ruleClassify(comment) {
  const text = comment.originalText ?? comment.body ?? comment.text ?? "";

  const posCount = countMatches(text, POSITIVE_KEYWORDS, { ignoreNegated: true });
  const negCount = countMatches(text, NEGATIVE_KEYWORDS, { ignoreNegated: true });
  const sugCount = countMatches(text, SUGGESTION_KEYWORDS);

  const tags = extractTopicTags(text);

  // Suggestions take precedence when present (they are action-oriented)
  if (sugCount >= 1 && sugCount >= Math.max(posCount, negCount) * 0.7) {
    return {
      sentiment: "suggestion",
      ruleConfidence: Math.min(0.4 + sugCount * 0.15, 0.85),
      tags,
      ruleScores: { positive: posCount, negative: negCount, suggestion: sugCount },
    };
  }

  if (posCount > negCount && posCount > 0) {
    return {
      sentiment: "positive",
      ruleConfidence: Math.min(0.35 + posCount * 0.15, 0.85),
      tags,
      ruleScores: { positive: posCount, negative: negCount, suggestion: sugCount },
    };
  }

  if (negCount > posCount && negCount > 0) {
    return {
      sentiment: "negative",
      ruleConfidence: Math.min(0.35 + negCount * 0.15, 0.85),
      tags,
      ruleScores: { positive: posCount, negative: negCount, suggestion: sugCount },
    };
  }

  return {
    sentiment: "other",
    ruleConfidence: 0.2,
    tags,
    ruleScores: { positive: posCount, negative: negCount, suggestion: sugCount },
  };
}

/**
 * Batch classify and attach sentiment + tags to each comment.
 */
export function ruleClassifyBatch(comments) {
  return comments.map((c) => {
    const result = ruleClassify(c);
    const sentiment = c.manualReviewed && c.sentiment ? c.sentiment : result.sentiment;
    return {
      ...c,
      sentiment,
      ruleConfidence: result.ruleConfidence,
      tags: c.tags?.length ? c.tags : result.tags,
      ruleScores: result.ruleScores,
    };
  });
}

/**
 * Select top-N representative comments per sentiment bucket for AI input.
 * Balances evidence score and diversity of tags.
 */
export function selectRepresentativeComments(classifiedComments, options = {}) {
  const maxPerBucket = options.maxPerBucket ?? 4;
  const maxTotal = options.maxTotal ?? 12;

  const buckets = { positive: [], negative: [], suggestion: [], other: [] };
  for (const c of classifiedComments) {
    const bucket = c.sentiment ?? "other";
    if (buckets[bucket]) buckets[bucket].push(c);
  }

  const selected = [];
  for (const bucket of ["positive", "negative", "suggestion", "other"]) {
    const list = buckets[bucket]
      .slice()
      .sort((a, b) => (b.evidenceScore ?? 0) - (a.evidenceScore ?? 0))
      .slice(0, maxPerBucket);
    selected.push(...list);
  }

  return selected.slice(0, maxTotal);
}

export default {
  ruleClassify,
  ruleClassifyBatch,
  selectRepresentativeComments,
};
