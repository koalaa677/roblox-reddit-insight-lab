import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, "..", "data", "pipeline-config.json");

const trackedGameCount = Number.parseInt(
  process.argv[2] || process.env.TRACKED_GAME_COUNT || "5",
  10,
);

function ceilDivide(value, divisor) {
  return Math.ceil(value / divisor);
}

async function main() {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const { reddit, ai } = config;
  const overview = reddit.dailyCrawlBudget.overview;
  const perGame = reddit.dailyCrawlBudget.perTrackedGame;
  const intervalMs = reddit.rateLimitPolicy.requestIntervalMs;

  const overviewPostRequests = overview.sorts.length;
  const overviewCommentRequests = ceilDivide(
    overview.commentsPerDay,
    perGame.maxCommentsPerPost,
  );
  const perGamePostRequests = perGame.sorts.length;
  const perGameCommentRequests = ceilDivide(
    perGame.commentsPerGamePerDay,
    perGame.maxCommentsPerPost,
  );
  const dailyRedditRequests =
    overviewPostRequests +
    overviewCommentRequests +
    trackedGameCount * (perGamePostRequests + perGameCommentRequests);
  const estimatedMinutes = (dailyRedditRequests * intervalMs) / 1000 / 60;
  const dailyAiComments =
    ai.dailyAiBudget.maxOverviewCommentsForAiPerDay +
    trackedGameCount * ai.dailyAiBudget.maxSelectedCommentsPerGamePerDay;
  const weeklyAiComments =
    trackedGameCount * ai.weeklyAiBudget.maxSelectedCommentsPerGameForWeeklyReport;

  console.log("Reddit + AI pipeline budget");
  console.log("--------------------------------");
  console.log(`Tracked games: ${trackedGameCount}`);
  console.log(`Daily Reddit request estimate: ${dailyRedditRequests}`);
  console.log(`Request interval: ${intervalMs} ms`);
  console.log(`Estimated crawl runtime: ${estimatedMinutes.toFixed(1)} min/day`);
  console.log(`Project soft limit: ${reddit.rateLimitPolicy.projectSoftLimitQpm} QPM`);
  console.log(`Daily AI selected comments: ${dailyAiComments}`);
  console.log(`Weekly AI selected game-report comments: ${weeklyAiComments}`);
  console.log("");
  console.log("Policy: crawl broadly, clean locally, send only selected evidence to AI.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
