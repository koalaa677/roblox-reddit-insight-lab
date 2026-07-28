import { ruleClassify } from "./rule-classifier.mjs";

const DIRECT_REDDIT_COMMENT_PATTERN =
  /^https?:\/\/(?:[^/]+\.)?reddit\.com\/r\/[^/]+\/comments\/[^/]+/i;

function isDirectRedditCommentUrl(url = "") {
  return DIRECT_REDDIT_COMMENT_PATTERN.test(url);
}

function createCheck(id, label, passed, detail) {
  return { id, label, passed, detail };
}

function percent(value, total) {
  return total ? Math.round((value / total) * 1000) / 10 : 0;
}

export function buildAnalysisQualityEvaluation(data, options = {}) {
  const classify = options.classify ?? ruleClassify;
  const evaluatedAt = options.evaluatedAt ?? new Date().toISOString().slice(0, 10);
  const games = data.games ?? [];
  const comments = games.flatMap((game) =>
    (game.comments ?? []).map((comment) => ({ ...comment, gameId: game.id })),
  );
  const reviewed = comments.filter((comment) => comment.manualReviewed);
  const classificationRows = reviewed.map((comment) => {
    const predicted = classify(comment).sentiment;
    return {
      id: comment.id,
      gameId: comment.gameId,
      expected: comment.sentiment,
      predicted,
      matched: predicted === comment.sentiment,
    };
  });
  const matchedSamples = classificationRows.filter((row) => row.matched).length;
  const mismatchIds = classificationRows.filter((row) => !row.matched).map((row) => row.id);

  const historicalGames = games.filter(
    (game) => game.evidenceProvenance?.kind === "historical_snapshot",
  );
  const curatedGames = games.filter(
    (game) => game.evidenceProvenance?.kind === "curated_sample",
  );
  const historicalComments = historicalGames.flatMap((game) => game.comments ?? []);
  const historicalReportComments = historicalComments.filter((comment) => comment.usedInReport);
  const directHistoricalComments = historicalComments.filter((comment) =>
    isDirectRedditCommentUrl(comment.url),
  );
  const directHistoricalReportComments = historicalReportComments.filter((comment) =>
    isDirectRedditCommentUrl(comment.url),
  );
  const curatedDirectLinks = curatedGames
    .flatMap((game) => game.comments ?? [])
    .filter((comment) => isDirectRedditCommentUrl(comment.url));
  const citedComments = comments.filter((comment) => comment.usedInReport);
  const validCommentIds = comments.map((comment) => comment.id).filter(Boolean);
  const uniqueIds = new Set(validCommentIds);
  const allCommentIds = uniqueIds.size === comments.length;
  const sampleCountMatches = games.map(
    (game) => game.sampleCount === (game.comments ?? []).length,
  );
  const sentimentPercentageMatches = games.map((game) => {
    const sentiment = game.sentiment ?? {};
    return (
      ["positive", "negative", "suggestion", "neutral"].every(
        (key) => Number.isFinite(sentiment[key]),
      ) &&
      Object.values(sentiment).reduce((sum, value) => sum + value, 0) === 100
    );
  });
  const aiTopEvidenceIdMatches = games.map((game) => {
    const ids = new Set((game.comments ?? []).map((comment) => comment.id));
    return (game.aiMeta?.topEvidenceIds ?? []).every((id) => ids.has(id));
  });
  const validReportCitationIds = citedComments.filter((comment) => Boolean(comment.id)).length;
  const curatedBoundaryMatches = curatedGames.map(
    (game) =>
      !(game.comments ?? []).some((comment) => isDirectRedditCommentUrl(comment.url)),
  );
  const sampleCountPassed = sampleCountMatches.filter(Boolean).length;
  const sentimentPercentagePassed = sentimentPercentageMatches.filter(Boolean).length;
  const aiTopEvidenceIdsPassed = aiTopEvidenceIdMatches.filter(Boolean).length;
  const curatedBoundaryPassed = curatedBoundaryMatches.filter(Boolean).length;

  const checks = [
    createCheck(
      "unique-comment-ids",
      "评论 ID 唯一且非空",
      allCommentIds,
      `${uniqueIds.size}/${comments.length} 条评论 ID 通过检查`,
    ),
    createCheck(
      "sample-count-contract",
      "样本数与评论数组一致",
      sampleCountPassed === games.length,
      `${sampleCountPassed}/${games.length} 个游戏通过检查`,
    ),
    createCheck(
      "sentiment-percentages",
      "情绪比例合计为 100%",
      sentimentPercentagePassed === games.length,
      `${sentimentPercentagePassed}/${games.length} 个游戏通过检查`,
    ),
    createCheck(
      "ai-top-evidence-ids",
      "AI 代表证据 ID 可回到评论",
      aiTopEvidenceIdsPassed === games.length,
      `${aiTopEvidenceIdsPassed}/${games.length} 个游戏通过检查`,
    ),
    createCheck(
      "report-citation-ids",
      "报告引用评论保留 ID",
      validReportCitationIds === citedComments.length,
      `${validReportCitationIds}/${citedComments.length} 条报告引用通过检查`,
    ),
    createCheck(
      "historical-direct-links",
      "历史快照保留逐条 Reddit 链接",
      directHistoricalComments.length === historicalComments.length,
      `${directHistoricalComments.length}/${historicalComments.length} 条历史证据可逐条打开`,
    ),
    createCheck(
      "curated-provenance-boundary",
      "策展样本未伪装成逐条原帖",
      curatedDirectLinks.length === 0 && curatedBoundaryPassed === curatedGames.length,
      `${curatedBoundaryPassed}/${curatedGames.length} 个策展样本游戏保持社区级来源标注`,
    ),
  ];
  const checksPassed = checks.filter((check) => check.passed).length;
  const calibratedEvidence = games.reduce(
    (sum, game) => sum + (game.aiMeta?.calibratedCount ?? 0),
    0,
  );

  return {
    version: "1.0",
    evaluatedAt,
    classification: {
      scope: "DTI 人工复核小型校准集",
      reviewedSamples: reviewed.length,
      matchedSamples,
      accuracyPercent: percent(matchedSamples, reviewed.length),
      mismatchIds,
      rows: classificationRows,
    },
    aiCalibration: {
      games: games.length,
      calibratedEvidence,
      perGame: games.map((game) => ({
        gameId: game.id,
        calibratedCount: game.aiMeta?.calibratedCount ?? 0,
        dryRun: Boolean(game.aiMeta?.dryRun),
      })),
    },
    evidence: {
      totalComments: comments.length,
      reportCitations: citedComments.length,
      historicalDirectLinks: {
        covered: directHistoricalComments.length,
        total: historicalComments.length,
      },
      historicalReportLinks: {
        covered: directHistoricalReportComments.length,
        total: historicalReportComments.length,
      },
      checksPassed,
      checksTotal: checks.length,
      allChecksPassed: checksPassed === checks.length,
      checks,
    },
    limitations: [
      "分类结果只基于 13 条 DTI 人工复核样本，用于回归校准，不代表跨游戏总体准确率。",
      "校准流程覆盖表示进入该阶段的代表证据数量，不等同于模型分类准确率。",
      "公开快照采用可复现离线输出；接入在线模型后可沿用同一评估框架重新校准。",
    ],
  };
}

export default {
  buildAnalysisQualityEvaluation,
};
