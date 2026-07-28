import assert from "node:assert/strict";
import { ruleClassify, ruleClassifyBatch } from "./lib/rule-classifier.mjs";

const cases = [
  {
    label: "voting fairness complaint",
    text: "The voting can feel random. Sometimes the best outfit does not win because friends vote for each other.",
    expected: "negative",
  },
  {
    label: "negated negative phrase",
    text: "The dressing room interface is really smooth. Swapping items is fast, no annoying loading screens.",
    expected: "positive",
  },
  {
    label: "clear praise without generic love keyword",
    text: "The theme system is genius. Every round feels different.",
    expected: "positive",
  },
  {
    label: "interface suggestion",
    text: "Voting should show the theme again on the voting screen.",
    expected: "suggestion",
  },
  {
    label: "reward suggestion",
    text: "Winning should give more than just points.",
    expected: "suggestion",
  },
  {
    label: "paywall complaint",
    text: "So many good items are robux only. Free players barely have anything to work with.",
    expected: "negative",
  },
  {
    label: "negated positive phrase",
    text: "This is not fun and never enjoyable.",
    expected: "other",
  },
  {
    label: "not-only emphasis is not negation",
    text: "This game is not only fun but also satisfying.",
    expected: "positive",
  },
];

for (const testCase of cases) {
  const actual = ruleClassify({ originalText: testCase.text }).sentiment;
  assert.equal(actual, testCase.expected, `${testCase.label}: expected ${testCase.expected}, received ${actual}`);
}

const preserved = ruleClassifyBatch([
  {
    id: "manual-override",
    originalText: "The best outfit does not win because friends vote for each other.",
    sentiment: "negative",
    manualReviewed: true,
  },
])[0];
assert.equal(preserved.sentiment, "negative", "manual review must override future rule classification");

console.log(`Rule classifier checks passed: ${cases.length + 1}`);
