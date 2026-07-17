/**
 * AI API client wrapper.
 *
 * Supports any OpenAI-compatible chat completions endpoint.
 * Falls back to dry-run / mock output when no API key is configured,
 * so the full pipeline can be validated without credentials.
 */

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.3;

function getEnvConfig() {
  return {
    baseUrl: process.env.AI_API_BASE_URL || "",
    token: process.env.AI_API_TOKEN || "",
    model: process.env.AI_MODEL || DEFAULT_MODEL,
  };
}

export function isConfigured() {
  const cfg = getEnvConfig();
  return Boolean(cfg.baseUrl && cfg.token);
}

/**
 * Call an OpenAI-compatible chat completions endpoint.
 */
async function chatCompletion(messages, options = {}) {
  const cfg = getEnvConfig();
  const url = `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`;

  const body = {
    model: options.model || cfg.model,
    messages,
    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    response_format: options.responseFormat || undefined,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI API error ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Stage 1: Calibrate rule-based classifications and extract structured labels.
 *
 * Input: a small batch of pre-selected comments (already cleaned & rule-classified).
 * Output: JSON array with refined sentiment, tags, painPoint, opportunity, evidenceScore.
 */
export async function classifyComments(selectedComments, gameContext = {}) {
  if (!isConfigured()) {
    return mockClassifyComments(selectedComments);
  }

  const commentBlocks = selectedComments
    .map(
      (c, i) =>
        `[${i + 1}] id=${c.id || i}
rule_sentiment=${c.sentiment || "unknown"}
rule_tags=${(c.tags || []).join(", ")}
text: ${(c.originalText || "").slice(0, 700)}`,
    )
    .join("\n\n");

  const systemPrompt = `You are a gameplay research analyst for Roblox games.
Your job is to classify Reddit player comments and extract structured signals.

For each comment, output:
- sentiment: "positive" | "negative" | "suggestion" | "other"
- tags: array of 1-3 short topic tags (e.g. retention, teamwork, event, progression, stability, reward, frustration, base-building, onboarding)
- painPoint: 1 short phrase if negative/suggestion, else ""
- opportunity: 1 short phrase if positive/suggestion, else ""
- evidenceScore: 0-100 integer, higher = more representative / more actionable for design decisions

Rules:
- Prioritize what the comment actually says over the rule_sentiment hint.
- Suggestions are actionable player requests or design improvement ideas.
- "other" is for off-topic, pure questions, memes, or low-info content.
- Return ONLY a JSON array, no markdown fences, no extra text.`;

  const userPrompt = `Game context:
- Name: ${gameContext.name || "Unknown game"}
- Genre: ${gameContext.genre || "Unknown"}

Comments to classify:
${commentBlocks}

Return a JSON array with one object per comment, in the same order.`;

  const raw = await chatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { maxTokens: 1500, response_format: { type: "json_object" } },
  );

  return parseJsonArray(raw, selectedComments.length);
}

/**
 * Stage 2: Generate a daily game summary from structured metrics + representative comments.
 */
export async function generateDailySummary(gameContext, metrics, representativeComments) {
  if (!isConfigured()) {
    return mockDailySummary(gameContext, metrics, representativeComments);
  }

  const commentBlocks = representativeComments
    .map(
      (c) => `- [${c.sentiment}] ${(c.originalText || "").slice(0, 500)}`,
    )
    .join("\n");

  const systemPrompt = `You are a senior gameplay research analyst producing concise daily summaries from Reddit player feedback.
Output a JSON object with exactly these keys:
- positiveDrivers: array of 2-3 short strings
- negativeRisks: array of 2-3 short strings
- playerSuggestions: array of 2-3 short strings
- gameplaySignals: array of 2-3 short strings (interesting mechanics or loop observations)

Keep each item under 40 Chinese characters. Focus on patterns, not single comments.`;

  const userPrompt = `Game: ${gameContext.name || "Unknown"}
Date window: ${metrics.period || "recent"}
Sample stats:
- total comments: ${metrics.totalComments ?? "n/a"}
- sentiment split: positive ${metrics.sentiment?.positive ?? 0}%, negative ${metrics.sentiment?.negative ?? 0}%, suggestion ${metrics.sentiment?.suggestion ?? 0}%
- top tags: ${(metrics.topTags || []).slice(0, 5).join(", ")}

Representative comments:
${commentBlocks}

Return the JSON summary object only.`;

  const raw = await chatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { maxTokens: 800, response_format: { type: "json_object" } },
  );

  return parseJsonObject(raw);
}

/**
 * Stage 3: Generate a weekly decision report for gameplay research / eggy-party adaptation.
 */
export async function generateWeeklyReport(gameContext, dailySummaries, topEvidence) {
  if (!isConfigured()) {
    return mockWeeklyReport(gameContext, dailySummaries, topEvidence);
  }

  const summaryText = dailySummaries
    .map((d, i) => `Day ${i + 1}:
  positives: ${(d.positiveDrivers || []).join("; ")}
  negatives: ${(d.negativeRisks || []).join("; ")}
  suggestions: ${(d.playerSuggestions || []).join("; ")}
  signals: ${(d.gameplaySignals || []).join("; ")}`)
    .join("\n\n");

  const evidenceText = topEvidence
    .map((c) => `- [${c.sentiment}] ${(c.originalText || "").slice(0, 300)}`)
    .join("\n");

  const systemPrompt = `You are a lead gameplay researcher advising a party-game studio.
Produce a structured decision report on whether a Roblox game's core loop is worth adapting / prototyping.

Output a JSON object with exactly these keys:
- overall: 1-2 sentence overall assessment (Chinese)
- pros: array of 3 strings, core strengths (Chinese)
- cons: array of 3 strings, core weaknesses / risks (Chinese)
- suggestions: array of 3 strings, what the original game could improve (Chinese)
- eggyIdeas: array of 3 strings, how to adapt this loop for a cute party-game audience (Chinese)
- risks: array of 3 strings, adaptation risks to validate (Chinese)
- decision: 1 sentence final recommendation (Chinese, e.g. "建议进入低成本原型拆解...")
- evidenceCommentIds: array of comment IDs that most support the conclusion

Keep each bullet concise and actionable. Focus on transferable mechanics, not art or story.`;

  const userPrompt = `Target game: ${gameContext.name || "Unknown"}
Genre: ${gameContext.genre || "Unknown"}
CN name: ${gameContext.cnName || ""}

Aggregated daily summaries:
${summaryText}

Top evidence comments:
${evidenceText}

Return the full JSON decision report.`;

  const raw = await chatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { maxTokens: 2000, response_format: { type: "json_object" } },
  );

  return parseJsonObject(raw);
}

// ---------- helpers ----------

function parseJsonObject(text) {
  try {
    return JSON.parse(text);
  } catch {
    // try to extract first {...} block
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through
      }
    }
    return { _raw: text, _parseError: true };
  }
}

function parseJsonArray(text, expectedLength) {
  try {
    const parsed = JSON.parse(text);
    // some models wrap in an object with a key like "comments"
    if (parsed && !Array.isArray(parsed)) {
      const firstArr = Object.values(parsed).find((v) => Array.isArray(v));
      if (firstArr) return firstArr;
    }
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through
      }
    }
    return new Array(expectedLength).fill(null).map(() => ({ sentiment: "other", tags: [] }));
  }
}

// ---------- dry-run mocks ----------

function mockClassifyComments(selectedComments) {
  return selectedComments.map((c) => ({
    sentiment: c.sentiment || "other",
    tags: c.tags?.slice(0, 3) || ["general"],
    painPoint: c.sentiment === "negative" ? "规则初筛负面信号" : "",
    opportunity: c.sentiment === "positive" ? "规则初筛正面吸引力" : "",
    evidenceScore: c.evidenceScore ?? 60,
  }));
}

function mockDailySummary(gameContext, metrics, representativeComments) {
  const genre = (gameContext.genre || "").toLowerCase();
  const name = (gameContext.name || "").toLowerCase();

  // Fashion / social / dress-up games
  if (genre.includes("时装") || genre.includes("fashion") || name.includes("dress") || name.includes("impress")) {
    return {
      positiveDrivers: ["主题挑战激发创作欲", "造型分享带来社交传播", "收集服装有持续动力"],
      negativeRisks: ["投票公平性争议频繁", "付费服装与免费差距大", "主题重复导致疲劳"],
      playerSuggestions: ["优化投票机制减少人情票", "增加免费可获取服装", "加入套装预设与收藏功能"],
      gameplaySignals: ["短局主题评分结构轻量易上手", "UGC 造型天然适合截图传播", "评分争议反而是社区讨论燃料"],
    };
  }

  // Combat / progression / collection games
  if (genre.includes("战斗") || genre.includes("combat") || name.includes("blox") || name.includes("fruit")) {
    return {
      positiveDrivers: ["战斗连招手感爽快", "长线成长目标清晰", "果实收集带来多样性"],
      negativeRisks: ["新手期刷取压力过大", "PVP 环境与高等级碾压", "付费强度优势明显"],
      playerSuggestions: ["降低新手追赶成本", "优化果实平衡性", "增加安全区与新手保护"],
      gameplaySignals: ["收集+战斗双驱动留存结构成熟", "海贼团社交强化长期黏着", "版本更新持续供给新目标"],
    };
  }

  // Default: survival / co-op (Forest99 style)
  return {
    positiveDrivers: ["合作生存循环有黏性", "资源分工产生社交故事", "通关和挑战带来成就感"],
    negativeRisks: ["公共房队友协作失败", "部分事件挫败感强", "中后期内容重复风险"],
    playerSuggestions: ["加强反恶意机制", "优化新手协作引导", "扩展中后期装备线"],
    gameplaySignals: ["白天收集夜晚防守节奏清晰", "多人分工天然产生玩法差异", "轻恐怖压力有记忆点"],
  };
}

function mockWeeklyReport(gameContext, dailySummaries, topEvidence) {
  const genre = (gameContext.genre || "").toLowerCase();
  const name = (gameContext.name || "").toLowerCase();

  // ── Fashion / social game report ──
  if (genre.includes("时装") || genre.includes("fashion") || name.includes("dress") || name.includes("impress")) {
    return {
      overall:
        "Reddit 讨论显示，时装主题评分类游戏的核心吸引力在于创作表达与社交分享，玩家对主题挑战和造型展示有很强参与欲，但投票公平性和内容更新节奏是主要争议点。",
      pros: [
        "主题挑战结构轻量清晰，每局有明确目标，短局体验完整。",
        "角色外观表达和造型分享有强社交传播性，天然适合截图和社区二次传播。",
        "服装收集和限定活动能驱动持续登录，形成稳定的日常留存节奏。",
      ],
      cons: [
        "投票公平性争议频繁，熟人互投、人气碾压等问题会打击认真创作的玩家。",
        "美术内容供给压力大，主题和服装更新不足时玩家很快会疲劳。",
        "付费与免费服装差距明显，免费玩家后期可玩内容有限。",
      ],
      suggestions: [
        "优化投票机制，增加主题权重或匿名投票，减少纯人气因素影响。",
        "扩充免费可获取服装池，降低免费玩家的内容天花板。",
        "增加套装预设、收藏和分类功能，提升换装效率和体验。",
      ],
      eggyIdeas: [
        "可迁移主题挑战+短局投票结构，把时装替换为蛋仔外观、动作、道具搭配。",
        "保留造型展示和社交分享环节，设计适合蛋仔风格的主题赛季。",
        "把评分争议转化为趣味点，用更轻量、更娱乐化的投票方式降低挫败感。",
      ],
      risks: [
        "美术资产更新需求高，如果供给跟不上会快速导致内容疲劳。",
        "派对游戏用户对纯审美评分的接受度需要验证，可能需要加入更多玩法互动。",
        "UGC 造型的质量参差，需要设计好审核和展示机制。",
      ],
      decision:
        "建议作为社交表达类玩法参考：主题挑战和短局投票结构可迁移，但需适配蛋仔的轻量审美与互动风格，暂不建议作为核心玩法复刻。",
      evidenceCommentIds: topEvidence.filter((c) => c.usedInReport).map((c) => c.id),
    };
  }

  // ── Combat / progression game report ──
  if (genre.includes("战斗") || genre.includes("combat") || name.includes("blox") || name.includes("fruit")) {
    return {
      overall:
        "玩家讨论集中在战斗手感、成长路线、刷取压力和平衡性。游戏的长线目标和收集体系很成熟，但新手门槛高、付费优势明显是核心争议。",
      pros: [
        "长线成长目标清晰，等级、果实、装备多层目标链驱动长期留存。",
        "战斗连招和 PVP 对抗有深度，熟练后有明显的技巧成就感。",
        "版本更新内容量大，新岛屿、新果实、新 Boss 持续供给新目标。",
      ],
      cons: [
        "新手期刷取压力极大，新玩家追赶成本高，容易在前几小时流失。",
        "高等级玩家在低等级区虐新手，破坏新手区体验和公平感。",
        "付费果实强度优势明显，存在 pay-to-win 争议。",
      ],
      suggestions: [
        "增加新手追赶机制或加速升级路径，降低前期重复刷取感。",
        "优化果实平衡性，减少少数强势套路垄断 PVP 的情况。",
        "增加海贼团专属合作内容，强化社交黏着和团队目标。",
      ],
      eggyIdeas: [
        "可借鉴能力收集和成长解锁的结构，但大幅压缩时长，做成短局内的技能拾取与进化。",
        "把 PVP 对抗改造成更娱乐化的派对乱斗，降低挫败感、增加随机性。",
        "保留版本更新驱动新目标的节奏，但用赛季制而非永久长线的方式适配派对用户。",
      ],
      risks: [
        "重度成长和刷取与蛋仔派对的轻量定位差异较大，直接照搬会劝退核心用户。",
        "PVP 平衡维护成本高，派对游戏用户对平衡性容忍度可能更低。",
        "长线目标需要持续内容供给，对更新节奏要求很高。",
      ],
      decision:
        "适合拆解成长收集和战斗反馈结构作为参考，不建议直接复刻核心玩法。可提取短局能力进化的思路用于派对模式。",
      evidenceCommentIds: topEvidence.filter((c) => c.usedInReport).map((c) => c.id),
    };
  }

  // ── Default: survival / co-op (Forest99 style) ──
  return {
    overall:
      "历史 Reddit 快照显示，该游戏合作生存、昼夜压力和资源分工很有吸引力，但公共房协作、事件挫败和反恶意机制必须重点处理。",
    pros: [
      "核心循环简单清楚：白天收集建设，夜晚防守应对风险，玩家很快能理解局内目标。",
      "合作分工天然产生社交故事：守家、探索、搬运各有角色，适合形成可传播的玩家经历。",
      "完成长局或解锁关键目标带来强成就感，评论中有明显的上头和通关记录表达。",
    ],
    cons: [
      "公共房队友不维护关键设施、浪费资源、提前退游的问题集中，直接破坏团队体验。",
      "部分事件和敌人设计带来强挫败感，低血量回营地时更明显。",
      "中后期目标依赖道具和事件，如果更新不足容易被玩家认为重复。",
    ],
    suggestions: [
      "加入更明确的团队分工提示和关键规则提示，减少新手或路人局的资源浪费。",
      "为关键物品增加防恶意丢失机制，例如蓝图回收、离线掉落或工作台备份。",
      "把高挫败事件拆成可预判、可反制的小挑战，降低纯惩罚感。",
    ],
    eggyIdeas: [
      "可迁移「白天收集、夜晚防守」的节奏，但改成更轻量的机关防守、道具协作和短局挑战。",
      "保留多人分工价值，把守家、探索、搬运、修复、触发机关设计成不同角色都能参与的任务。",
      "把恐怖表达改写成轻紧张、可爱但有压力的派对危机，避免直接照搬恐怖题材。",
    ],
    risks: [
      "如果只复刻资源消耗和夜晚进攻，可能变成重复劳动，缺少派对用户期待的变化和爽点。",
      "公共匹配下的协作失败会被玩家归因于系统设计，需要用任务分配、提示和补偿机制兜底。",
      "关键物品和成长线必须防止被单个玩家恶意破坏，否则负面情绪会集中爆发。",
    ],
    decision:
      "建议进入低成本原型拆解：保留合作生存节奏和分工压力，弱化恐怖题材与长线惩罚，优先验证 5-8 分钟短局内的资源协作、防守事件和反恶意机制。",
    evidenceCommentIds: topEvidence.filter((c) => c.usedInReport).map((c) => c.id),
  };
}

export default {
  isConfigured,
  classifyComments,
  generateDailySummary,
  generateWeeklyReport,
};
