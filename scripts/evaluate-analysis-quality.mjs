import fs from "node:fs";
import { buildAnalysisQualityEvaluation } from "./lib/analysis-quality.mjs";

const dataUrl = new URL("../data/insights.json", import.meta.url);
const shouldWrite = process.argv.includes("--write");
const data = JSON.parse(fs.readFileSync(dataUrl, "utf8"));
const evaluation = buildAnalysisQualityEvaluation(data);

if (shouldWrite) {
  data.meta.qualityEvaluation = evaluation;
  fs.writeFileSync(dataUrl, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

console.log(
  [
    `Classification calibration: ${evaluation.classification.matchedSamples}/${evaluation.classification.reviewedSamples}`,
    `Evidence checks: ${evaluation.evidence.checksPassed}/${evaluation.evidence.checksTotal}`,
    `Historical direct links: ${evaluation.evidence.historicalDirectLinks.covered}/${evaluation.evidence.historicalDirectLinks.total}`,
    shouldWrite ? "Updated data/insights.json" : "Preview only; use --write to persist",
  ].join("\n"),
);
