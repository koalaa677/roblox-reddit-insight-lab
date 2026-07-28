import assert from "node:assert/strict";
import fs from "node:fs";
import { buildAnalysisQualityEvaluation } from "./lib/analysis-quality.mjs";

const data = JSON.parse(fs.readFileSync(new URL("../data/insights.json", import.meta.url), "utf8"));
const evaluation = buildAnalysisQualityEvaluation(data, { evaluatedAt: "2026-07-28" });

assert.equal(evaluation.classification.reviewedSamples, 13);
assert.equal(evaluation.classification.matchedSamples, 12);
assert.equal(evaluation.classification.accuracyPercent, 92.3);
assert.deepEqual(evaluation.classification.mismatchIds, ["dti-c01"]);

assert.equal(evaluation.aiCalibration.calibratedEvidence, 36);
assert.equal(evaluation.evidence.totalComments, 86);
assert.equal(evaluation.evidence.reportCitations, 18);
assert.equal(evaluation.evidence.historicalDirectLinks.covered, 38);
assert.equal(evaluation.evidence.historicalDirectLinks.total, 38);
assert.equal(evaluation.evidence.historicalReportLinks.covered, 6);
assert.equal(evaluation.evidence.historicalReportLinks.total, 6);
assert.equal(evaluation.evidence.allChecksPassed, true);

const oldRedditData = structuredClone(data);
oldRedditData.games[0].comments[0].url =
  "https://old.reddit.com/r/99nightsintheforest/comments/test/example/";
const oldRedditEvaluation = buildAnalysisQualityEvaluation(oldRedditData, {
  evaluatedAt: "2026-07-28",
});
assert.equal(oldRedditEvaluation.evidence.historicalDirectLinks.covered, 38);

const brokenData = structuredClone(data);
brokenData.games[0].sampleCount += 1;
brokenData.games[0].sentiment.positive += 1;
brokenData.games[0].aiMeta.topEvidenceIds.push("missing-evidence-id");
const brokenEvaluation = buildAnalysisQualityEvaluation(brokenData, {
  evaluatedAt: "2026-07-28",
});
assert.equal(
  brokenEvaluation.evidence.checks.find((check) => check.id === "sample-count-contract").detail,
  "2/3 个游戏通过检查",
);
assert.equal(
  brokenEvaluation.evidence.checks.find((check) => check.id === "sentiment-percentages").detail,
  "2/3 个游戏通过检查",
);
assert.equal(
  brokenEvaluation.evidence.checks.find((check) => check.id === "ai-top-evidence-ids").detail,
  "2/3 个游戏通过检查",
);

console.log(
  `Analysis quality checks passed: ${evaluation.evidence.checksPassed}/${evaluation.evidence.checksTotal}`,
);
