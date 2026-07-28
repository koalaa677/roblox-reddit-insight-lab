/**
 * AI analysis pipeline entry point.
 *
 * Full pipeline for one game:
 *   raw comments -> clean & dedupe -> rule classify -> select evidence
 *   -> AI classify calibration -> AI daily summary -> AI weekly decision report
 *   -> update insights.json
 *
 * Usage:
 *   node scripts/ai-analyze.mjs --game forest99
 *   node scripts/ai-analyze.mjs --game forest99 --dry-run
 *   node scripts/ai-analyze.mjs --game forest99 --write
 *
 * Environment variables (see .env.example):
 *   AI_API_BASE_URL, AI_API_TOKEN, AI_MODEL
 *
 * Without credentials, runs in dry-run / mock mode automatically so the
 * pipeline can be validated end-to-end.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { cleanCommentBatch, evidenceScore } from "./lib/cleaner.mjs";
import { ruleClassifyBatch, selectRepresentativeComments } from "./lib/rule-classifier.mjs";
import { buildAnalysisQualityEvaluation } from "./lib/analysis-quality.mjs";
import {
  isConfigured as aiIsConfigured,
  classifyComments as aiClassifyComments,
  generateDailySummary as aiGenerateDailySummary,
  generateWeeklyReport as aiGenerateWeeklyReport,
} from "./lib/ai-client.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const INSIGHTS_PATH = join(ROOT, "data", "insights.json");
const CONFIG_PATH = join(ROOT, "data", "pipeline-config.json");

function parseArgs(argv) {
  const args = { gameId: null, dryRun: false, write: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--game" || a === "-g") args.gameId = argv[i + 1];
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--write") args.write = true;
  }
  return args;
}

function sentimentShare(comments) {
  const counts = { positive: 0, negative: 0, suggestion: 0, other: 0 };
  for (const c of comments) counts[c.sentiment] = (counts[c.sentiment] || 0) + 1;
  const total = Math.max(comments.length, 1);
  const shares = {};
  for (const key of Object.keys(counts)) {
    shares[key] = Math.round((counts[key] / total) * 100);
  }
  // adjust rounding drift onto the largest bucket
  const drift = 100 - Object.values(shares).reduce((s, v) => s + v, 0);
  const largest = Object.keys(shares).reduce((a, b) => (counts[a] > counts[b] ? a : b));
  shares[largest] += drift;
  return shares;
}

/**
 * Map internal sentiment buckets to frontend-compatible keys.
 * Frontend uses "neutral" for the fourth bucket; pipeline uses "other".
 */
function toFrontendSentiment(shareObj) {
  const result = { ...shareObj };
  if ("other" in result) {
    result.neutral = result.other;
    delete result.other;
  }
  return result;
}

function topTags(comments, limit = 8) {
  const freq = new Map();
  for (const c of comments) {
    for (const t of c.tags || []) {
      freq.set(t, (freq.get(t) || 0) + 1);
    }
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

async function loadInsights() {
  return JSON.parse(await readFile(INSIGHTS_PATH, "utf8"));
}

async function loadConfig() {
  return JSON.parse(await readFile(CONFIG_PATH, "utf8"));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.gameId) {
    console.error("Usage: node scripts/ai-analyze.mjs --game <game-id> [--dry-run] [--write]");
    process.exitCode = 1;
    return;
  }

  const dryRun = args.dryRun || !aiIsConfigured();
  if (dryRun && !args.dryRun) {
    console.log("AI_API not configured — running in dry-run / mock mode.");
    console.log("Set AI_API_BASE_URL + AI_API_TOKEN in .env to enable real AI calls.\n");
  }

  const insights = await loadInsights();
  const config = await loadConfig();
  const game = insights.games.find((g) => g.id === args.gameId);

  if (!game) {
    console.error(`Game not found in insights.json: ${args.gameId}`);
    console.error(`Available: ${insights.games.map((g) => g.id).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const rawComments = game.comments || [];
  console.log(`[1/6] Loaded ${rawComments.length} raw comments for ${game.name} (${game.id})`);

  // Stage 1: clean & dedupe
  const cleaned = cleanCommentBatch(rawComments, {
    minChars: config.reddit.commentCleaning.dropIfShorterThanChars,
  });
  console.log(`[2/6] Cleaned & deduped: ${cleaned.length} comments remain`);

  // Stage 2: rule-based classification
  const ruleClassified = ruleClassifyBatch(cleaned);
  const withScores = ruleClassified.map((c) => ({
    ...c,
    evidenceScore: evidenceScore(c, c.sentiment),
  }));
  const shares = sentimentShare(withScores);
  console.log(
    `[3/6] Rule-classified: pos ${shares.positive}% / neg ${shares.negative}% / sug ${shares.suggestion}% / other ${shares.other}%`,
  );

  // Stage 3: select representative comments for AI
  const aiBudget = config.ai.dailyAiBudget;
  const selected = selectRepresentativeComments(withScores, {
    maxPerBucket: aiBudget.maxCommentsPerSentimentBucket ?? 4,
    maxTotal: aiBudget.maxSelectedCommentsPerGamePerDay ?? 12,
  });
  console.log(`[4/6] Selected ${selected.length} representative comments for AI stage`);

  // Stage 4: AI classification calibration
  const gameContext = { name: game.name, cnName: game.cnName, genre: game.genre || "survival" };
  const aiClassified = await aiClassifyComments(selected, gameContext);

  // Merge AI results back into selected comments (keep original fields)
  const calibrated = selected.map((c, i) => {
    const ai = aiClassified[i] || {};
    const preserveManualReview = c.manualReviewed && c.sentiment;
    return {
      ...c,
      sentiment: preserveManualReview ? c.sentiment : ai.sentiment || c.sentiment,
      tags: ai.tags?.length ? ai.tags : c.tags,
      painPoint: preserveManualReview ? c.painPoint || "" : ai.painPoint || "",
      opportunity: preserveManualReview ? c.opportunity || "" : ai.opportunity || "",
      evidenceScore: typeof ai.evidenceScore === "number" ? ai.evidenceScore : c.evidenceScore,
      aiCalibrated: true,
    };
  });

  // Keep the calibrated labels for selected comments, then merge them back into
  // the full display sample before calculating the public sentiment split.
  const analyzedComments = withScores.map((c) => calibrated.find((x) => x.id === c.id) || c);
  const calibratedShares = sentimentShare(calibrated);
  const analyzedShares = sentimentShare(analyzedComments);
  console.log(
    `[5/6] AI calibrated: pos ${calibratedShares.positive}% / neg ${calibratedShares.negative}% / sug ${calibratedShares.suggestion}%`,
  );
  console.log(
    `      Full sample: pos ${analyzedShares.positive}% / neg ${analyzedShares.negative}% / sug ${analyzedShares.suggestion}% / other ${analyzedShares.other}%`,
  );

  // Stage 5: AI daily summary (we treat the snapshot as one aggregated day)
  const metrics = {
    period: insights.meta.period || "snapshot",
    totalComments: withScores.length,
    sentiment: analyzedShares,
    topTags: topTags(calibrated),
  };
  const dailySummary = await aiGenerateDailySummary(gameContext, metrics, calibrated);
  console.log(`[5.5/6] Daily summary generated`);

  // Stage 6: AI weekly decision report
  // With a single snapshot we reuse the daily summary; in production this would aggregate 7 days
  const topEvidence = calibrated
    .slice()
    .sort((a, b) => (b.evidenceScore ?? 0) - (a.evidenceScore ?? 0))
    .slice(0, config.ai.weeklyAiBudget.maxEvidenceQuotesPerGame ?? 5);

  const report = await aiGenerateWeeklyReport(
    gameContext,
    [dailySummary],
    topEvidence,
  );
  console.log(`[6/6] Decision report generated`);

  // Build the updated game object (preserve existing fields, update analysis outputs)
  const updatedGame = {
    ...game,
    comments: analyzedComments.map((merged) => {
      // Map "other" -> "neutral" for frontend compatibility
      if (merged.sentiment === "other") {
        return { ...merged, sentiment: "neutral" };
      }
      return merged;
    }),
    sampleCount: withScores.length,
    sentiment: toFrontendSentiment(analyzedShares),
    summary: {
      overall: report.overall || game.summary?.overall || "",
      pros: report.pros || game.summary?.pros || [],
      cons: report.cons || game.summary?.cons || [],
      suggestions: report.suggestions || game.summary?.suggestions || [],
      transferIdeas: report.transferIdeas || game.summary?.transferIdeas || [],
      risks: report.risks || game.summary?.risks || [],
      decision: report.decision || game.summary?.decision || "",
    },
    aiDailySummary: dailySummary,
    aiMeta: {
      ...game.aiMeta,
      pipelineVersion: "1.0",
      dryRun,
      calibratedCount: calibrated.length,
      sentimentBasis: `${analyzedComments.length} 条展示样本的完整分布，其中 ${calibrated.length} 条经 AI 校准`,
      topEvidenceIds: topEvidence.map((c) => c.id),
      generatedAt: new Date().toISOString(),
    },
  };

  // Update the games array
  const gameIndex = insights.games.findIndex((g) => g.id === args.gameId);
  insights.games[gameIndex] = updatedGame;

  // Update meta
  insights.meta.updatedAt = new Date().toLocaleString("zh-CN", {
    hour12: false,
    timeZone: "Asia/Shanghai",
  });
  insights.meta.aiPipeline = {
    version: "1.0",
    lastRunGame: args.gameId,
    lastRunDryRun: dryRun,
    lastRunAt: new Date().toISOString(),
  };

  if (args.write) {
    insights.meta.qualityEvaluation = buildAnalysisQualityEvaluation(insights);
    await writeFile(INSIGHTS_PATH, `${JSON.stringify(insights, null, 2)}\n`, "utf8");
    console.log(`\n✓ Written back to data/insights.json`);
  } else {
    console.log(`\nℹ  Dry-run complete. Re-run with --write to persist changes to insights.json.`);
  }

  console.log(`\n--- Report preview ---`);
  console.log(`Recommendation: ${game.recommendation || "N/A"}`);
  console.log(`Decision: ${updatedGame.summary.decision?.slice(0, 80)}...`);
  console.log(`Top evidence: ${topEvidence.length} comments`);
}

main().catch((error) => {
  console.error("Pipeline failed:", error);
  process.exitCode = 1;
});
