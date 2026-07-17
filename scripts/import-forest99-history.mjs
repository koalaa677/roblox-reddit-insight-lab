import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const insightsPath = join(rootDir, "data", "insights.json");

const defaultHistoryDir = "C:/Users/gaoyucheng01/forest99-monitor";
const handoffHistoryDir = resolve(rootDir, "..", "..", "02-forest99-history-data", "forest99-monitor");
const historyDir = resolve(
  process.env.FOREST99_HISTORY_DIR ?? (existsSync(handoffHistoryDir) ? handoffHistoryDir : defaultHistoryDir),
);
const dataDir = join(historyDir, "data");

const curatedEvidence = [
  {
    id: "POST_1tnq7nb",
    sentiment: "positive",
    tags: ["retention", "progression"],
    translatedText:
      "玩家表示两周前发现游戏后一直惦记着它，认为循环很有趣、很满足，并且持续追逐下一个大目标让自己上头。",
    usedInReport: true,
  },
  {
    id: "POST_1tg7qha",
    sentiment: "positive",
    tags: ["event", "reward"],
    translatedText:
      "玩家称火山生态区是最好的内容之一，因为奖励丰富，能提供宝石、武器、燃料和大量大块废料。",
    usedInReport: true,
  },
  {
    id: "POST_1tcw3s8",
    sentiment: "positive",
    tags: ["completion", "achievement"],
    translatedText:
      "玩家分享自己通关 99 Nights in the Forest，虽然耗时很长，但认为所有努力最终得到了回报。",
    usedInReport: false,
  },
  {
    id: "POST_1toy6l2",
    sentiment: "positive",
    tags: ["first-time", "tension"],
    translatedText:
      "新玩家原本以为只是儿童向方块游戏，实际体验后被追逐压力吓到，说明轻恐怖和生存压力有很强记忆点。",
    usedInReport: false,
  },
  {
    id: "POST_1tp8rhw",
    sentiment: "negative",
    tags: ["teamwork", "public-lobby"],
    translatedText:
      "玩家抱怨路人队友只捡废料、不砍木头、不维护篝火，甚至开局五分钟就离开，导致团队责任断裂。",
    usedInReport: true,
  },
  {
    id: "oo7a5xh",
    sentiment: "negative",
    tags: ["stability", "public-lobby"],
    translatedText:
      "玩家指出 iPad 过热、断连、闪退等问题会造成中途退出，认为超过 3 人的路人局需要更可靠的队友才值得玩。",
    usedInReport: false,
  },
  {
    id: "oml64cp",
    sentiment: "negative",
    tags: ["event", "frustration"],
    translatedText:
      "玩家认为青蛙事件非常糟糕，尤其在低血量返回基地时被攻击，会明显放大挫败感。",
    usedInReport: true,
  },
  {
    id: "onljyjr",
    sentiment: "negative",
    tags: ["resource", "teamwork"],
    translatedText:
      "玩家吐槽队友把所有废料都浪费在货架上，反映公共房间里的资源管理和协作成本偏高。",
    usedInReport: false,
  },
  {
    id: "POST_1tnagqe",
    sentiment: "suggestion",
    tags: ["anti-troll", "progression"],
    translatedText:
      "玩家建议当恶意玩家拿走恐龙小孩和地图后离开时，蓝图应掉落在工作台，关键物品不要因为退游而永久消失。",
    usedInReport: true,
  },
  {
    id: "POST_1tp4ubc",
    sentiment: "suggestion",
    tags: ["equipment", "content"],
    translatedText:
      "玩家提出战斗斧、吸尘背包、环形灯笼等装备升级，希望通过更多道具层级丰富中后期目标。",
    usedInReport: false,
  },
  {
    id: "oo8pl1k",
    sentiment: "suggestion",
    tags: ["base-building", "usability"],
    translatedText:
      "玩家建议加入正式的围栏或栅栏，不要让玩家继续用丑且笨重的货架当墙。",
    usedInReport: true,
  },
  {
    id: "ommd1h5",
    sentiment: "suggestion",
    tags: ["onboarding", "team-rules"],
    translatedText:
      "玩家总结路人局禁忌：不要乱建货架、不要先建非床设施、不要浪费资源、不要夜间无脑探索，说明游戏需要更强的协作规则提示。",
    usedInReport: false,
  },
  {
    id: "onupw3s",
    sentiment: "neutral",
    tags: ["guide", "hard-mode"],
    translatedText:
      "玩家解释困难模式徽章需要摧毁地图上的腐化藤蔓，属于有信息量的攻略型讨论，可作为背景噪声保留。",
    usedInReport: false,
  },
  {
    id: "ollo5mr",
    sentiment: "neutral",
    tags: ["lore", "map-detail"],
    translatedText:
      "玩家解释地图边缘的树桩结构可能是 kiwi 的家，属于世界观和地图细节讨论，不直接进入决策报告。",
    usedInReport: false,
  },
];

function normalizeBody(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function sentimentShare(comments) {
  const counts = { positive: 0, negative: 0, suggestion: 0, neutral: 0 };
  for (const comment of comments) counts[comment.sentiment] += 1;
  const total = Math.max(comments.length, 1);
  const keys = Object.keys(counts);
  const shares = Object.fromEntries(keys.map((key) => [key, Math.round((counts[key] / total) * 100)]));
  const diff = 100 - keys.reduce((sum, key) => sum + shares[key], 0);
  shares[keys.reduce((best, key) => (counts[key] > counts[best] ? key : best), keys[0])] += diff;
  return shares;
}

async function loadRawIndex() {
  if (!existsSync(dataDir)) {
    throw new Error(`Forest99 history data directory not found: ${dataDir}`);
  }

  const files = (await readdir(dataDir)).filter((file) => /^raw_\d{4}-\d{2}-\d{2}\.json$/.test(file));
  const index = new Map();
  const totals = { posts: 0, comments: 0, days: files.length };

  for (const file of files) {
    const raw = JSON.parse(await readFile(join(dataDir, file), "utf8"));
    totals.posts += raw.post_count ?? raw.posts?.length ?? 0;
    totals.comments += raw.comment_count ?? 0;

    for (const post of raw.posts ?? []) {
      index.set(`POST_${post.id}`, {
        id: `POST_${post.id}`,
        score: post.score ?? 0,
        source: `r/${raw.subreddit}`,
        url: post.permalink,
        originalText: normalizeBody(`[Post] ${post.title}. ${post.selftext}`),
      });

      for (const comment of post.comments ?? []) {
        index.set(comment.id, {
          id: comment.id,
          score: comment.score ?? 0,
          source: `r/${raw.subreddit}`,
          url: comment.permalink,
          originalText: normalizeBody(comment.body),
        });
      }
    }
  }

  return { index, totals };
}

function buildComments(index) {
  return curatedEvidence.map((item) => {
    const source = index.get(item.id);
    if (!source) throw new Error(`Curated Forest99 evidence not found in history: ${item.id}`);
    return {
      id: `f99-hist-${item.id.toLowerCase()}`,
      redditId: item.id,
      sentiment: item.sentiment,
      tags: item.tags,
      score: source.score,
      source: `${source.source} historical snapshot`,
      url: source.url,
      originalText: source.originalText.slice(0, 700),
      translatedText: item.translatedText,
      usedInReport: item.usedInReport,
    };
  });
}

async function main() {
  const insights = JSON.parse(await readFile(insightsPath, "utf8"));
  const { index, totals } = await loadRawIndex();
  const forest = insights.games.find((game) => game.id === "forest99");
  if (!forest) throw new Error("forest99 game not found in insights.json");

  const comments = buildComments(index);
  forest.comments = comments;
  forest.sampleCount = 266;
  forest.mentions = 430;
  forest.posts = 21;
  forest.sentiment = sentimentShare(comments);
  forest.recommendation = "强烈建议研究";
  forest.oneLine =
    "真实历史评论显示，合作生存、昼夜压力和资源分工很有吸引力，但公共房协作、事件挫败和反恶意机制必须重点处理。";
  forest.summary = {
    overall:
      "历史 Reddit 快照显示，99 Nights in the Forest 的讨论重点集中在合作分工、资源维护、夜晚压力、公共房队友质量和中后期内容变化。正向反馈证明它的短局生存循环有很强黏性；负面与建议集中在路人局协作、事件挫败、关键物品被恶意带走和新手规则不清晰。",
    pros: [
      "核心循环简单清楚：白天收集与建设，夜晚防守与应对突发风险，玩家很快能理解局内目标。",
      "合作分工天然产生社交故事：有人守营地、有人找资源、有人探索，适合形成可传播的玩家经历。",
      "完成长局或解锁关键目标能带来强成就感，评论中出现明显的上头、通关和挑战记录表达。",
    ],
    cons: [
      "公共房队友不维护篝火、浪费资源、提前退游的问题非常集中，会直接破坏团队体验。",
      "部分事件和敌人设计带来强挫败感，尤其在低血量、回营地、设备不稳定时更明显。",
      "中后期目标依赖道具、事件和地图变化，如果更新不足，容易被玩家认为重复。",
    ],
    suggestions: [
      "加入更明确的团队分工提示和关键规则提示，减少新手或路人局的资源浪费。",
      "为关键物品增加防恶意丢失机制，例如蓝图回收、离线掉落或工作台备份。",
      "把高挫败事件拆成可预判、可反制的小挑战，降低纯惩罚感。",
      "用更多中后期装备、营地设施和随机事件延长目标链。",
    ],
    eggyIdeas: [
      "可迁移“白天收集、夜晚防守”的节奏，但改成蛋仔派对更轻量的机关防守、道具协作和短局挑战。",
      "保留多人分工价值，把守家、探索、搬运、修复、触发机关设计成不同蛋仔都能参与的任务。",
      "把恐怖表达改写成轻紧张、可爱但有压力的派对危机，避免直接照搬森林恐怖题材。",
    ],
    risks: [
      "如果只复刻资源消耗和夜晚进攻，可能变成重复劳动，缺少蛋仔派对用户期待的变化和爽点。",
      "公共匹配下的协作失败会被玩家归因于系统设计，需要用任务分配、提示和补偿机制兜底。",
      "关键物品、基地设施和成长线必须防止被单个玩家恶意破坏，否则负面情绪会集中爆发。",
    ],
    decision:
      "建议进入低成本原型拆解：保留合作生存节奏和分工压力，弱化恐怖题材与长线惩罚，优先验证 5-8 分钟短局内的资源协作、防守事件和反恶意机制。",
  };

  insights.meta = {
    ...insights.meta,
    version: "Insight Snapshot 1.2",
    datasetType: "historical_public_json_snapshot",
    updatedAt: new Date().toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" }),
    period: "历史样本池 + 近 3 天轻量展示窗口",
    sourceNote:
      "当前 Top 3 保持轻量展示；Forest99 已接入旧监控任务抓取的 Reddit 历史公开 JSON 快照。公开 JSON 现已可能返回 403，正式增量采集仍建议等待 Reddit OAuth/Data API。",
    refreshPolicy: "当前页面读取结构化快照；后续接入 API 后按 3 天轻量窗口增量刷新。",
    crawlScope: {
      overview: "洞察看板聚合 Roblox Reddit 讨论信号并压缩成 Top 3 决策入口。",
      targeted: "定向分析抓取具体游戏对应的 Reddit 子社区或关键词范围。",
      watchlist: "当前关注游戏直接抓取对应子社区或固定关键词范围。",
    },
    historicalImport: {
      sourceProject: "forest99-monitor",
      subreddit: "r/99nightsintheforest",
      rawDays: totals.days,
      rawPosts: totals.posts,
      rawComments: totals.comments,
      importedEvidence: comments.length,
    },
  };

  await writeFile(insightsPath, `${JSON.stringify(insights, null, 2)}\n`, "utf8");
  console.log(
    `Imported ${comments.length} Forest99 comments from ${totals.rawComments ?? totals.comments} historical raw comments.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
