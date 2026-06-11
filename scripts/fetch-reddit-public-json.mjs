import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const dataPath = join(rootDir, "data", "insights.json");
const configPath = join(rootDir, "data", "pipeline-config.json");
const snapshotPath = join(rootDir, "data", "reddit-public-snapshot.json");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

function envInt(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) ? value : fallback;
}

function normalizeBaseUrl(value) {
  return String(value || "https://www.reddit.com").replace(/\/$/, "");
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getNowText() {
  return new Date().toLocaleString("zh-CN", {
    hour12: false,
    timeZone: "Asia/Shanghai",
  });
}

function getSubredditName(url) {
  if (!url) return null;
  const match = String(url).match(/reddit\.com\/r\/([^/]+)/i);
  return match?.[1] ?? null;
}

function getSearchQuery(game) {
  return [game.name, ...(game.aliases ?? [])]
    .filter(Boolean)
    .slice(0, 3)
    .map((item) => `"${item}"`)
    .join(" OR ");
}

async function fetchJson(url, { userAgent }) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": userAgent,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const hint =
      response.status === 403
        ? "Reddit rejected the public JSON request. Use OAuth/Data API approval for production."
        : body.slice(0, 180);
    throw new Error(`${response.status} ${response.statusText}: ${hint}`);
  }

  return response.json();
}

function flattenListing(listing) {
  return listing?.data?.children?.map((child) => child.data).filter(Boolean) ?? [];
}

async function fetchGamePosts(game, settings) {
  const gameSubreddit = getSubredditName(game.sourceLinks?.reddit);
  const subreddits = [...new Set([gameSubreddit, "roblox"].filter(Boolean))];
  const posts = [];

  for (const subreddit of subreddits) {
    const query = encodeURIComponent(getSearchQuery(game));
    const url = `${settings.baseUrl}/r/${subreddit}/search.json?q=${query}&restrict_sr=1&sort=new&t=week&limit=${settings.postsPerGame}`;
    const listing = await fetchJson(url, settings);
    posts.push(
      ...flattenListing(listing).map((post) => ({
        id: post.id,
        title: post.title,
        subreddit: post.subreddit,
        score: post.score ?? 0,
        numComments: post.num_comments ?? 0,
        createdUtc: post.created_utc,
        permalink: `https://www.reddit.com${post.permalink}`,
      })),
    );
    await sleep(settings.requestIntervalMs);
  }

  return dedupeBy(posts, (post) => post.id)
    .sort((a, b) => b.score + b.numComments - (a.score + a.numComments))
    .slice(0, settings.postsPerGame);
}

async function fetchPostComments(post, game, settings) {
  const url = `${settings.baseUrl}/comments/${post.id}.json?limit=${settings.maxCommentsPerPost}&sort=top`;
  const listing = await fetchJson(url, settings);
  const comments = flattenListing(listing?.[1]).filter((comment) => {
    const body = comment.body || "";
    return (
      comment.id &&
      body.length >= settings.minCommentChars &&
      body !== "[deleted]" &&
      body !== "[removed]" &&
      (comment.score ?? 0) >= settings.minCommentScore
    );
  });

  await sleep(settings.requestIntervalMs);

  return comments.map((comment) => ({
    id: `${game.id}-${comment.id}`,
    redditId: comment.id,
    sentiment: classifySentiment(comment.body),
    tags: classifyTags(comment.body),
    score: comment.score ?? 0,
    source: `r/${post.subreddit}`,
    url: `https://www.reddit.com${comment.permalink}`,
    originalText: comment.body.slice(0, 700),
    translatedText: "待 AI 翻译",
    usedInReport: false,
    createdUtc: comment.created_utc,
  }));
}

function classifySentiment(text) {
  const value = text.toLowerCase();
  if (/(should|wish|hope|need|needs|add|fix|change|improve|suggest)/i.test(value)) return "suggestion";
  if (/(bad|boring|hate|annoying|broken|bug|grind|unfair|worse|quit|toxic)/i.test(value)) return "negative";
  if (/(love|like|fun|best|great|good|amazing|cool|enjoy)/i.test(value)) return "positive";
  return "neutral";
}

function classifyTags(text) {
  const value = text.toLowerCase();
  const tags = [];
  if (/(friend|team|coop|co-op|together)/.test(value)) tags.push("social");
  if (/(grind|level|progress|reward)/.test(value)) tags.push("progression");
  if (/(bug|lag|broken|crash)/.test(value)) tags.push("stability");
  if (/(match|fair|balance|vote|voting)/.test(value)) tags.push("fairness");
  if (/(new player|tutorial|learn|onboarding)/.test(value)) tags.push("onboarding");
  if (/(update|event|content|new)/.test(value)) tags.push("content");
  return tags.length ? tags.slice(0, 3) : ["general"];
}

function dedupeBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getSentimentShare(comments) {
  const counts = { positive: 0, negative: 0, suggestion: 0, neutral: 0 };
  for (const comment of comments) counts[comment.sentiment] += 1;
  const total = Math.max(comments.length, 1);
  return Object.fromEntries(
    Object.entries(counts).map(([key, value]) => [key, Math.round((value / total) * 100)]),
  );
}

function getSettings(config) {
  const publicConfig = config.reddit.publicJsonFallback ?? {};
  const budget = config.reddit.dailyCrawlBudget;
  return {
    baseUrl: normalizeBaseUrl(process.env.REDDIT_PUBLIC_JSON_BASE_URL ?? publicConfig.baseUrl),
    userAgent:
      process.env.REDDIT_USER_AGENT ??
      "windows:roblox-reddit-insight-lab:v0.1 (public-json-fallback)",
    trackedGameLimit: envInt("REDDIT_TRACKED_GAME_LIMIT", publicConfig.trackedGameLimit ?? 3),
    requestIntervalMs: envInt(
      "REDDIT_REQUEST_INTERVAL_MS",
      config.reddit.rateLimitPolicy.requestIntervalMs ?? 6500,
    ),
    postsPerGame: envInt(
      "REDDIT_GAME_POSTS_PER_DAY",
      budget.perTrackedGame.postsPerGamePerDay ?? 8,
    ),
    commentsPerGame: envInt(
      "REDDIT_GAME_COMMENTS_PER_DAY",
      budget.perTrackedGame.commentsPerGamePerDay ?? 30,
    ),
    maxCommentsPerPost: budget.perTrackedGame.maxCommentsPerPost ?? 5,
    minCommentScore: budget.perTrackedGame.minCommentScore ?? 1,
    minCommentChars: config.reddit.commentCleaning.dropIfShorterThanChars ?? 20,
    windowDays: envInt("REDDIT_WINDOW_DAYS", publicConfig.windowDays ?? 3),
  };
}

async function main() {
  const [data, config] = await Promise.all([
    readFile(dataPath, "utf8").then(JSON.parse),
    readFile(configPath, "utf8").then(JSON.parse),
  ]);
  const settings = getSettings(config);
  const games = data.games.slice(0, settings.trackedGameLimit);
  const result = {
    mode: "public_json_fallback",
    ok: true,
    dryRun,
    updatedAt: getNowText(),
    baseUrl: settings.baseUrl,
    trackedGameLimit: settings.trackedGameLimit,
    windowDays: settings.windowDays,
    games: [],
    errors: [],
  };

  for (const game of games) {
    try {
      const posts = await fetchGamePosts(game, settings);
      const commentGroups = [];
      for (const post of posts) {
        if (commentGroups.flat().length >= settings.commentsPerGame) break;
        commentGroups.push(await fetchPostComments(post, game, settings));
      }
      const comments = dedupeBy(commentGroups.flat(), (comment) => comment.redditId)
        .sort((a, b) => b.score - a.score)
        .slice(0, settings.commentsPerGame);

      result.games.push({
        id: game.id,
        name: game.name,
        postsFetched: posts.length,
        commentsFetched: comments.length,
      });

      if (comments.length) {
        game.comments = comments.map(({ redditId, createdUtc, ...comment }, index) => ({
          ...comment,
          usedInReport: index < 3,
        }));
        game.sampleCount = game.comments.length;
        game.posts = posts.length;
        game.mentions = posts.reduce((sum, post) => sum + post.numComments, 0) + game.comments.length;
        game.sentiment = getSentimentShare(game.comments);
      }
    } catch (error) {
      result.ok = false;
      result.errors.push({
        gameId: game.id,
        message: error.message,
      });
    }
  }

  if (!dryRun && result.ok && result.games.some((game) => game.commentsFetched > 0)) {
    data.games = games.map((game, index) => ({ ...game, rank: index + 1 }));
    data.meta.version = "Public JSON Snapshot 0.1";
    data.meta.datasetType = "public_json_fallback";
    data.meta.updatedAt = result.updatedAt;
    data.meta.displayWindowDays = settings.windowDays;
    data.meta.period = `近 ${settings.windowDays} 天轻量抓取窗口`;
    await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }

  if (!dryRun) {
    await writeFile(snapshotPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
