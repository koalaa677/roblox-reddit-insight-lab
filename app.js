const state = {
  data: null,
  selectedGameId: null,
  commentFilter: "all",
  searchQuery: "",
  watchSearchQuery: "",
  pendingRemoveWatchId: null,
  removedWatchArchive: [],
};

const WATCHLIST_STORAGE_KEY = "robloxInsight.watchlist.v1";
const REMOVED_WATCH_STORAGE_KEY = "robloxInsight.removedWatchlist.v1";

const sentimentCopy = {
  positive: { label: "正面", color: "#126b5f" },
  negative: { label: "负面", color: "#d95f59" },
  suggestion: { label: "建议", color: "#f2b84b" },
  neutral: { label: "其他", color: "#8b969d" },
};

const reportBriefSections = [
  ["decision", "摘要结论", 1],
  ["eggyIdeas", "最值得借鉴", 2],
  ["risks", "主要风险", 2],
  ["suggestions", "下一步验证", 2],
];

const $ = (selector) => document.querySelector(selector);

async function boot() {
  try {
    const response = await fetch("data/insights.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load insights data");
    state.data = await response.json();
    hydrateLocalState();
    state.selectedGameId = state.data.games[0]?.id ?? null;
    renderAll();
    bindEvents();
    refreshIcons();
  } catch (error) {
    showToast("数据文件加载失败，请检查 data/insights.json。");
    console.error(error);
  }
}

function bindEvents() {
  $("#analysisNav").addEventListener("click", (event) => {
    event.preventDefault();
    const isExpanded = expandAnalysisNav();
    if (isExpanded) {
      $("#game-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  $("#gameSearch").addEventListener("input", (event) => {
    state.searchQuery = event.target.value;
    renderAnalysisMatches(state.searchQuery);
  });

  $("#refreshButton").addEventListener("click", () => {
    showToast("当前展示的是最近一次数据快照；刷新任务完成后会更新同一套指标与报告。");
  });

  $("#printButton").addEventListener("click", () => window.print());

  $("#watchlistAddButton")?.addEventListener("click", openWatchAddModal);

  $("#watchSearchInput").addEventListener("input", (event) => {
    state.watchSearchQuery = event.target.value;
    renderWatchSearchState();
  });

  document.querySelectorAll("[data-modal-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.modalClose));
  });

  document.querySelectorAll(".modal-layer").forEach((layer) => {
    layer.addEventListener("click", (event) => {
      if (event.target === layer) closeModal(layer.id);
    });
  });

  $("#confirmRemoveWatch").addEventListener("click", confirmRemoveWatchItem);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal("watchAddModal");
      closeModal("watchRemoveModal");
    }
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  document.querySelectorAll("[data-jump-section]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      jumpToSection(link.dataset.jumpSection);
    });
  });

  $("#commentFilters").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    state.commentFilter = button.dataset.filter;
    document.querySelectorAll("#commentFilters button").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    renderComments(getSelectedGame());
  });
}

function renderAll() {
  renderMeta();
  renderDashboardSummary();
  renderDashboardVisuals();
  renderGameList();
  renderAnalysisSubnav();
  renderAnalysisMatches();
  renderDataRules();
  renderSelectedGame();
}

function renderMeta() {
  const { meta } = state.data;
  $("#datasetVersion").textContent = meta.version;
  $("#datasetPeriod").textContent = meta.period;
  $("#datasetTime").textContent = meta.updatedAt;
}

function renderDashboardSummary() {
  const topGame = state.data.games[0];
  const totalMentions = state.data.games.reduce((sum, game) => sum + game.mentions, 0);
  const gameCount = state.data.games.length;
  $("#dashboardSummary").textContent = `当前 Top ${gameCount} 共覆盖 ${totalMentions} 次讨论提及，最高热度是 ${topGame.cnName}。看板把提及量、增长率、情绪和建议密度合成可解释分数，先看全局结论，再进入具体游戏查看证据与报告。`;
}

function renderDashboardVisuals() {
  const games = state.data.games;
  const topGame = games[0];
  const totalComments = games.reduce((sum, game) => sum + game.comments.length, 0);
  const quotedComments = games.reduce(
    (sum, game) => sum + game.comments.filter((comment) => comment.usedInReport).length,
    0,
  );
  const genreGroups = games.reduce((groups, game) => {
    const genre = game.genre.split("/")[0].trim();
    groups[genre] = (groups[genre] ?? 0) + 1;
    return groups;
  }, {});
  const recommendationGroups = games.reduce(
    (groups, game) => {
      if (game.recommendation.includes("强烈")) groups.strong += 1;
      else if (game.recommendation.includes("暂不")) groups.no += 1;
      else if (game.recommendation.includes("谨慎")) groups.caution += 1;
      else groups.observe += 1;
      return groups;
    },
    { strong: 0, observe: 0, caution: 0, no: 0 },
  );

  $("#dashboardVisuals").innerHTML = `
    <article class="visual-card visual-card-primary">
      <div class="visual-heading">
        <p class="eyebrow">Sentiment Donut</p>
        <h3>${escapeHtml(topGame.cnName)} 情绪盘</h3>
      </div>
      ${renderSentimentDonut(topGame.sentiment, topGame.heatScore)}
      <div class="donut-legend">${renderSentimentLegend(topGame.sentiment)}</div>
    </article>

    <article class="visual-card visual-card-score">
      <div class="visual-heading">
        <p class="eyebrow">Hot Score Model</p>
        <h3>热点评分拆解</h3>
      </div>
      ${renderHotScoreModel(topGame)}
    </article>

    <article class="visual-card">
      <div class="visual-heading">
        <p class="eyebrow">Category Mix</p>
        <h3>游戏类型分布</h3>
      </div>
      <div class="mini-bars">
        ${Object.entries(genreGroups)
          .map(([genre, count]) => renderMiniBar(genre, count, games.length))
          .join("")}
      </div>
    </article>

    <article class="visual-card">
      <div class="visual-heading">
        <p class="eyebrow">Evidence Pipeline</p>
        <h3>评论证据流</h3>
      </div>
      <div class="pipeline-dashboard">
        ${renderPipelineStep("有效样本", totalComments, "已过滤低价值短评")}
        ${renderPipelineStep("报告引用", quotedComments, "进入报告证据链")}
        ${renderPipelineStep("采集接口", "Reddit API", "展示抓取量与过滤量")}
      </div>
    </article>

    <article class="visual-card">
      <div class="visual-heading">
        <p class="eyebrow">Recommendation Mix</p>
        <h3>研究建议分布</h3>
      </div>
      <div class="decision-stack" aria-label="研究建议分布">
        ${renderDecisionStackItem("强烈研究", recommendationGroups.strong, "#0071e3")}
        ${renderDecisionStackItem("继续观察", recommendationGroups.observe, "#17865d")}
        ${renderDecisionStackItem("谨慎研究", recommendationGroups.caution, "#bf7a00")}
        ${renderDecisionStackItem("暂缓研究", recommendationGroups.no, "#d7352a")}
      </div>
    </article>
  `;
}

function renderGameList() {
  $("#gameList").innerHTML = state.data.games.map(renderGameRow).join("");

  document.querySelectorAll(".game-row").forEach((row) => {
    row.addEventListener("click", () => {
      selectGame(row.dataset.gameId, false);
    });
    row.addEventListener("dblclick", () => {
      selectGame(row.dataset.gameId, true);
    });
  });
}

function renderAnalysisSubnav() {
  const hotItems = state.data.games
    .map(
      (game) => `
        <button class="subnav-item ${game.id === state.selectedGameId ? "is-active" : ""}" type="button" data-game-id="${game.id}">
          <span>${game.rank}. ${escapeHtml(game.cnName)}</span>
          <strong>${game.heatScore}</strong>
        </button>
      `,
    )
    .join("");

  const focusItems = getWatchlist()
    .map((item) => renderSubnavWatchItem(item))
    .join("");

  $("#analysisSubnav").innerHTML = `
    <p>热门游戏</p>
    ${hotItems}
    <div class="subnav-heading">
      <p>正在关注游戏</p>
      <button class="subnav-add" type="button" aria-label="新增关注游戏">
        <i data-lucide="plus"></i>
      </button>
    </div>
    ${focusItems || '<span class="subnav-empty">暂无关注游戏</span>'}
  `;

  document.querySelectorAll("#analysisSubnav button.subnav-item").forEach((button) => {
    button.addEventListener("click", () => {
      expandAnalysisNav(true);
      selectGame(button.dataset.gameId, true);
    });
  });

  document.querySelector("#analysisSubnav .subnav-add")?.addEventListener("click", openWatchAddModal);
  document.querySelectorAll("#analysisSubnav .watch-remove-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openRemoveWatchModal(button.dataset.watchId);
    });
  });
}

function renderCompactDataRules() {
  const { meta } = state.data;
  const rules = [
    ["窗口", `近 ${meta.displayWindowDays ?? 7} 天`],
    ["刷新", "只抓最新评论"],
    ["保留", "7 天内不清理"],
    ["范围", "Roblox Reddit"],
  ];

  return `
    <div class="subnav-rules" aria-label="分析数据规则">
      <div class="subnav-rules-title">
        <span>分析数据规则</span>
      </div>
      ${rules
        .map(
          ([label, value]) => `
            <div class="subnav-rule">
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderSubnavWatchItem(item) {
  const linkedGame = getLinkedWatchGame(item);
  const isActive = linkedGame?.id === state.selectedGameId;
  const content = linkedGame
    ? `
      <button class="subnav-item subnav-focus ${isActive ? "is-active" : ""}" type="button" data-game-id="${linkedGame.id}">
        <span>关注 · ${escapeHtml(item.cnName)}</span>
        <strong>${linkedGame.heatScore}</strong>
      </button>
    `
    : `
      <div class="subnav-item subnav-focus subnav-pending" aria-disabled="true">
        <span>关注 · ${escapeHtml(item.cnName)}</span>
        <strong>分析中</strong>
      </div>
    `;

  return `
    <div class="subnav-watch-item">
      ${content}
      <button class="watch-remove-button subnav-remove" type="button" data-watch-id="${item.id}" aria-label="移出 ${escapeHtml(item.cnName)}">
        <i data-lucide="minus"></i>
      </button>
    </div>
  `;
}

function renderGameRow(game) {
  return `
    <button class="game-row ${game.id === state.selectedGameId ? "is-active" : ""}" type="button" data-game-id="${game.id}">
      <span class="rank-badge">${game.rank}</span>
      <span>
        <h3>${escapeHtml(game.name)}</h3>
        <p>${escapeHtml(game.cnName)} · ${escapeHtml(game.genre)}</p>
      </span>
      <span class="heat-pill">${game.heatScore}</span>
    </button>
  `;
}

function renderWatchlist() {
  if (!$("#watchlistList")) return;
  const watchlist = getWatchlist();
  $("#watchlistList").innerHTML = watchlist
    .map((item) => {
      const linkedGame = getLinkedWatchGame(item);
      const isActive = item.gameId && item.gameId === state.selectedGameId;
      const heatText = linkedGame ? `热度 ${linkedGame.heatScore}` : "后台分析中";
      const actionText = linkedGame ? "查看分析" : "等待结果";

      return `
        <article class="watch-card ${isActive ? "is-active" : ""}" data-game-id="${item.gameId ?? ""}">
          <button class="watch-remove-button watch-card-remove" type="button" data-watch-id="${item.id}" aria-label="移出 ${escapeHtml(item.cnName)}">
            <i data-lucide="minus"></i>
          </button>
          <div>
            <span class="watch-status">${escapeHtml(item.status)}</span>
            <h4>${escapeHtml(item.cnName)} / ${escapeHtml(item.name)}</h4>
            <p>${escapeHtml(item.reason)}</p>
          </div>
          <div class="watch-meta">
            <span>${heatText}</span>
            <button class="watch-card-action" type="button" ${linkedGame ? "" : "disabled"}>${actionText}</button>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".watch-card .watch-card-action:not(:disabled)").forEach((button) => {
    button.addEventListener("click", () => {
      const gameId = button.closest(".watch-card")?.dataset.gameId;
      if (gameId) selectGame(gameId, true);
    });
  });

  document.querySelectorAll(".watch-card .watch-remove-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openRemoveWatchModal(button.dataset.watchId);
    });
  });
}

function getWatchlist() {
  return state.data.watchlist ?? [];
}

function getLinkedWatchGame(item) {
  return item.gameId ? state.data.games.find((game) => game.id === item.gameId) : null;
}

function hydrateLocalState() {
  const savedWatchlist = readStoredJson(WATCHLIST_STORAGE_KEY);
  if (Array.isArray(savedWatchlist)) {
    state.data.watchlist = savedWatchlist;
  }
  const savedArchive = readStoredJson(REMOVED_WATCH_STORAGE_KEY);
  state.removedWatchArchive = Array.isArray(savedArchive) ? savedArchive : [];
}

function readStoredJson(key) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function persistWatchlist() {
  window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(getWatchlist()));
}

function persistRemovedWatchArchive() {
  window.localStorage.setItem(REMOVED_WATCH_STORAGE_KEY, JSON.stringify(state.removedWatchArchive));
}

function renderWatchlistSurfaces() {
  renderAnalysisSubnav();
  renderDecisionReportNav();
  refreshIcons();
}

function openWatchAddModal() {
  state.watchSearchQuery = "";
  $("#watchSearchInput").value = "";
  renderWatchTopList();
  renderWatchSearchState();
  openModal("watchAddModal");
  window.setTimeout(() => $("#watchSearchInput").focus(), 80);
}

function renderWatchTopList() {
  $("#watchTopList").innerHTML = state.data.games
    .map((game) => {
      const alreadyAdded = isGameWatchlisted(game.id);
      return `
        <button class="modal-game-option" type="button" data-game-id="${game.id}" ${alreadyAdded ? "disabled" : ""}>
          <span>
            <strong>${game.rank}. ${escapeHtml(game.cnName)}</strong>
            <small>${escapeHtml(game.name)} · 热度 ${game.heatScore}</small>
          </span>
          <em>${alreadyAdded ? "已关注" : "加入"}</em>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("#watchTopList .modal-game-option:not(:disabled)").forEach((button) => {
    button.addEventListener("click", () => addGameToWatchlist(button.dataset.gameId, "top5"));
  });
}

function renderWatchSearchState() {
  const query = state.watchSearchQuery.trim();
  if (!query) {
    $("#watchSearchState").innerHTML = `
      <p>可以直接点下方热门游戏加入关注，也可以输入一个新的 Roblox 游戏名加入后台分析队列。</p>
    `;
    return;
  }

  const result = findWatchSearchResult(query);
  if (result.type === "exact") {
    const alreadyAdded = isGameWatchlisted(result.game.id);
    $("#watchSearchState").innerHTML = `
      <div class="search-result-card">
        <div>
          <span class="watch-status">已找到</span>
          <h4>${escapeHtml(result.game.cnName)} / ${escapeHtml(result.game.name)}</h4>
          <p>匹配到当前热门游戏，可直接加入正在关注。</p>
        </div>
        <button type="button" data-add-game="${result.game.id}" ${alreadyAdded ? "disabled" : ""}>
          ${alreadyAdded ? "已关注" : "加入关注"}
        </button>
      </div>
    `;
  } else if (result.type === "suggestion") {
    $("#watchSearchState").innerHTML = `
      <div class="search-result-card">
        <div>
          <span class="watch-status">关联搜索</span>
          <h4>你是不是想找：${escapeHtml(result.game.cnName)} / ${escapeHtml(result.game.name)}？</h4>
          <p>当前输入可能是笔误、简称或别名。确认后会按这个游戏进入爬取和分析流程。</p>
        </div>
        <button type="button" data-add-game="${result.game.id}" ${isGameWatchlisted(result.game.id) ? "disabled" : ""}>
          确认并加入
        </button>
      </div>
    `;
  } else {
    $("#watchSearchState").innerHTML = `
      <div class="search-result-card">
        <div>
          <span class="watch-status">新目标</span>
          <h4>${escapeHtml(query)}</h4>
          <p>当前数据快照未匹配到热门游戏。点击确定后，会先加入分析队列；后续采集任务会检索 Roblox / Reddit 并生成分析结果。</p>
        </div>
        <button type="button" data-add-custom="true">确定加入</button>
      </div>
    `;
  }

  document.querySelector("[data-add-game]")?.addEventListener("click", (event) => {
    addGameToWatchlist(event.currentTarget.dataset.addGame, "search");
  });
  document.querySelector("[data-add-custom]")?.addEventListener("click", () => addCustomWatchItem(query));
}

function findWatchSearchResult(query) {
  const normalizedQuery = normalizeSearchTerm(query);
  const candidates = state.data.games.map((game) => {
    const terms = getGameSearchTerms(game);
    const normalizedTerms = terms.map(normalizeSearchTerm);
    const exact = normalizedTerms.includes(normalizedQuery);
    const partial = normalizedTerms.some((term) => term.includes(normalizedQuery) || normalizedQuery.includes(term));
    const distance = Math.min(...normalizedTerms.map((term) => getLevenshteinDistance(normalizedQuery, term)));
    return { game, exact, partial, distance };
  });

  const exact = candidates.find((candidate) => candidate.exact);
  if (exact) return { type: "exact", game: exact.game };

  const partial = candidates.find((candidate) => candidate.partial && normalizedQuery.length >= 2);
  if (partial) return { type: "suggestion", game: partial.game };

  const fuzzy = candidates.sort((a, b) => a.distance - b.distance)[0];
  const threshold = Math.max(2, Math.ceil(normalizedQuery.length * 0.34));
  if (fuzzy && fuzzy.distance <= threshold) return { type: "suggestion", game: fuzzy.game };

  return { type: "custom" };
}

function getGameSearchTerms(game) {
  return [game.name, game.cnName, ...(game.aliases ?? [])];
}

function normalizeSearchTerm(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
}

function getLevenshteinDistance(a, b) {
  if (!a) return b.length;
  if (!b) return a.length;
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return rows[a.length][b.length];
}

function isGameWatchlisted(gameId) {
  return getWatchlist().some((item) => item.gameId === gameId);
}

function addGameToWatchlist(gameId, source) {
  const game = state.data.games.find((item) => item.id === gameId);
  if (!game) return;
  if (isGameWatchlisted(game.id)) {
    showToast(`${game.cnName} 已经在正在关注中。`);
    return;
  }

  state.data.watchlist = [
    ...getWatchlist(),
    {
      id: `focus-${game.id}`,
      gameId: game.id,
      name: game.name,
      cnName: game.cnName,
      status: source === "search" ? "搜索加入" : "常驻关注",
      reason: "由操作者加入正在关注。系统会持续保留近 7 天评论和分析数据，便于后续回看。",
      createdAt: new Date().toISOString(),
    },
  ];
  persistWatchlist();
  renderWatchlistSurfaces();
  closeModal("watchAddModal");
  showToast(`已将 ${game.cnName} 加入正在关注。`);
}

function addCustomWatchItem(query) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return;
  const duplicated = getWatchlist().some(
    (item) => normalizeSearchTerm(item.name) === normalizeSearchTerm(normalizedQuery) || normalizeSearchTerm(item.cnName) === normalizeSearchTerm(normalizedQuery),
  );
  if (duplicated) {
    showToast(`${normalizedQuery} 已经在正在关注中。`);
    return;
  }

  state.data.watchlist = [
    ...getWatchlist(),
    {
      id: `focus-custom-${Date.now()}`,
      name: normalizedQuery,
      cnName: normalizedQuery,
      status: "等待分析",
      reason: "已加入后台分析队列。接入 Roblox / Reddit 后，会先检索名称，再抓取评论并生成 AI 分析。",
      createdAt: new Date().toISOString(),
      source: "manual-search",
    },
  ];
  persistWatchlist();
  renderWatchlistSurfaces();
  closeModal("watchAddModal");
  showToast(`已将 ${normalizedQuery} 加入后台分析队列。`);
}

function openRemoveWatchModal(watchId) {
  const item = getWatchlist().find((watchItem) => watchItem.id === watchId);
  if (!item) return;
  state.pendingRemoveWatchId = watchId;
  $("#watchRemoveCopy").textContent = `确认将「${item.cnName}」移出正在关注？移出后不会立即删除这个游戏已经爬取和分析过的数据。`;
  openModal("watchRemoveModal");
}

function confirmRemoveWatchItem() {
  const item = getWatchlist().find((watchItem) => watchItem.id === state.pendingRemoveWatchId);
  if (!item) return;
  state.removedWatchArchive = [
    ...state.removedWatchArchive,
    {
      ...item,
      removedAt: new Date().toISOString(),
      retentionPolicy: "保留近 7 天评论和分析数据；仅手动清理时删除 7 天前数据。",
    },
  ];
  state.data.watchlist = getWatchlist().filter((watchItem) => watchItem.id !== item.id);
  persistWatchlist();
  persistRemovedWatchArchive();
  state.pendingRemoveWatchId = null;
  renderWatchlistSurfaces();
  closeModal("watchRemoveModal");
  showToast(`已移出 ${item.cnName}。近 7 天内已抓取和分析数据仍会保留。`);
}

function openModal(modalId) {
  const modal = $(`#${modalId}`);
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  refreshIcons();
}

function closeModal(modalId) {
  const modal = $(`#${modalId}`);
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

function renderDataRules() {
  if (!$("#dataRuleFooter")) return;
  $("#dataRuleFooter").innerHTML = renderCompactDataRules();
}

function renderAnalysisMatches(query = state.searchQuery) {
  const normalizedQuery = normalize(query);
  const matches = normalizedQuery ? getMatchedGames(normalizedQuery) : [getSelectedGame()].filter(Boolean);

  if (!normalizedQuery) {
    $("#analysisMatches").innerHTML = `
      <button class="match-chip is-active" type="button" data-game-id="${state.selectedGameId}">
        当前分析：${escapeHtml(getSelectedGame()?.cnName ?? "-")}
      </button>
    `;
  } else if (!matches.length) {
    $("#analysisMatches").innerHTML = `
      <span class="match-empty">没有完全匹配。可尝试：森林99、99 Nights、DTI、Brookhaven。</span>
    `;
  } else {
    $("#analysisMatches").innerHTML = matches
      .map(
        (game) => `
          <button class="match-chip ${game.id === state.selectedGameId ? "is-active" : ""}" type="button" data-game-id="${game.id}">
            ${escapeHtml(game.cnName)} · ${escapeHtml(game.name)}
          </button>
        `,
      )
      .join("");
  }

  document.querySelectorAll(".match-chip").forEach((button) => {
    button.addEventListener("click", () => {
      selectGame(button.dataset.gameId, false);
    });
  });
}

function getMatchedGames(normalizedQuery) {
  return state.data.games.filter((game) => {
    const haystack = [game.name, game.cnName, game.genre, ...game.aliases].map(normalize).join(" ");
    return haystack.includes(normalizedQuery);
  });
}

function selectGame(gameId, scrollToAnalysis) {
  state.selectedGameId = gameId;
  state.commentFilter = "all";
  document.querySelectorAll("#commentFilters button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filter === "all");
  });
  renderGameList();
  renderAnalysisSubnav();
  renderAnalysisMatches();
  renderSelectedGame();
  if (scrollToAnalysis) {
    $("#game-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function expandAnalysisNav(force) {
  const nav = $("#analysisNav");
  const subnav = $("#analysisSubnav");
  const shouldOpen = typeof force === "boolean" ? force : !subnav.classList.contains("is-expanded");
  subnav.classList.toggle("is-expanded", shouldOpen);
  nav.setAttribute("aria-expanded", String(shouldOpen));
  return shouldOpen;
}

function renderSelectedGame() {
  const game = getSelectedGame();
  if (!game) return;

  $("#coverArt").dataset.tone = game.cover.tone;
  $("#coverLabel").textContent = game.cover.label;
  $("#gameRank").textContent = `#${game.rank}`;
  $("#gameGenre").textContent = game.genre;
  $("#gameName").textContent = `${game.name} / ${game.cnName}`;
  renderSourceLinks(game);
  $("#gameOneLine").textContent = game.oneLine;
  $("#detailHeat").textContent = game.heatScore;
  $("#detailSamples").textContent = game.sampleCount;
  $("#detailMentions").textContent = game.mentions;
  $("#detailRecommendation").textContent = game.recommendation;
  $("#overallSummary").textContent = game.summary.overall;

  $("#tagRow").innerHTML = game.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");

  renderTrend(game.trend);
  renderSentiment(game.sentiment);
  renderComments(game);
  renderReport(game);
  renderDecisionReportNav();
  renderDecisionReport(game);
  refreshIcons();
}

function renderSourceLinks(game) {
  const encodedName = encodeURIComponent(game.name);
  const sourceLinks = {
    roblox: game.sourceLinks?.roblox ?? `https://www.roblox.com/search/experiences?keyword=${encodedName}`,
    reddit: game.sourceLinks?.reddit ?? `https://www.reddit.com/search/?q=${encodedName}%20Roblox&type=communities`,
  };

  $("#gameSourceLinks").innerHTML = `
    <a class="source-link" href="${escapeHtml(sourceLinks.roblox)}" target="_blank" rel="noreferrer">
      <span class="source-link-icon"><i data-lucide="gamepad-2"></i></span>
      <span>
        <strong>Roblox 官方游戏页</strong>
        <small>${escapeHtml(game.name)}</small>
      </span>
      <i data-lucide="external-link"></i>
    </a>
    <a class="source-link" href="${escapeHtml(sourceLinks.reddit)}" target="_blank" rel="noreferrer">
      <span class="source-link-icon"><i data-lucide="message-square"></i></span>
      <span>
        <strong>Reddit 游戏论坛</strong>
        <small>${escapeHtml(formatSourceHost(sourceLinks.reddit))}</small>
      </span>
      <i data-lucide="external-link"></i>
    </a>
  `;
}

function renderTrend(values) {
  const width = 620;
  const height = 260;
  const margin = { top: 22, right: 18, bottom: 52, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const yTicks = [0, 25, 50, 75, 100];
  const xLabels = state.data.meta.trendLabels ?? values.map((_, index) => `D-${values.length - index - 1}`);

  const points = values.map((value, index) => {
    const x = margin.left + (index / (values.length - 1)) * plotWidth;
    const y = margin.top + (1 - value / 100) * plotHeight;
    return { x, y, value };
  });

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  $("#trendChart").innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="近 7 天热度趋势图，横轴为时间，纵轴为热度分 0 到 100">
      <text class="chart-title" x="${margin.left}" y="12">近 7 天热度分变化</text>
      ${yTicks
        .map((tick) => {
          const y = margin.top + (1 - tick / 100) * plotHeight;
          return `
            <line class="chart-grid" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"></line>
            <text class="chart-tick" x="${margin.left - 12}" y="${y + 4}" text-anchor="end">${tick}</text>
          `;
        })
        .join("")}
      ${xLabels
        .map((label, index) => {
          const x = margin.left + (index / (xLabels.length - 1)) * plotWidth;
          return `
            <line class="chart-grid vertical" x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}"></line>
            <text class="chart-tick" x="${x}" y="${height - 28}" text-anchor="middle">${escapeHtml(label)}</text>
          `;
        })
        .join("")}
      <line class="chart-axis" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"></line>
      <line class="chart-axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"></line>
      <text class="chart-axis-label" x="${width / 2}" y="${height - 6}" text-anchor="middle">时间（近 7 天）</text>
      <text class="chart-axis-label" transform="translate(14 ${height / 2}) rotate(-90)" text-anchor="middle">热度分（0-100）</text>
      <path class="chart-line" d="${path}"></path>
      ${points
        .map(
          (point) => `
            <circle class="chart-dot" cx="${point.x}" cy="${point.y}" r="6"></circle>
            <text class="chart-value" x="${point.x}" y="${Math.max(point.y - 12, 18)}" text-anchor="middle">${point.value}</text>
          `,
        )
        .join("")}
    </svg>
  `;
}

function renderSentiment(sentiment) {
  $("#sentimentBars").innerHTML = Object.entries(sentiment)
    .map(([key, value]) => {
      const copy = sentimentCopy[key];
      return `
        <div class="sentiment-item">
          <div class="sentiment-label">
            <span>${copy.label}</span>
            <strong>${value}%</strong>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${value}%; background: ${copy.color};"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderSentimentDonut(sentiment, centerValue) {
  const entries = Object.entries(sentiment);
  let cursor = 0;
  const slices = entries
    .map(([key, value]) => {
      const copy = sentimentCopy[key];
      const start = cursor;
      cursor += value;
      return `${copy.color} ${start}% ${cursor}%`;
    })
    .join(", ");

  return `
    <div class="sentiment-donut" style="background: conic-gradient(${slices});">
      <div>
        <strong>${escapeHtml(centerValue)}</strong>
        <span>热度分</span>
      </div>
    </div>
  `;
}

function renderSentimentLegend(sentiment) {
  return Object.entries(sentiment)
    .map(([key, value]) => {
      const copy = sentimentCopy[key];
      return `
        <span>
          <i style="background:${copy.color}"></i>
          ${copy.label} ${value}%
        </span>
      `;
    })
    .join("");
}

function getHotScoreBreakdown(game) {
  const games = state.data.games ?? [];
  const maxMentions = Math.max(...games.map((item) => item.mentions), 1);
  const maxSampleCount = Math.max(...games.map((item) => item.sampleCount), 1);
  const positiveTrendDeltas = games.map((item) => Math.max(getTrendDelta(item), 0));
  const maxTrendDelta = Math.max(...positiveTrendDeltas, 1);
  const components = [
    {
      label: "提及量",
      value: Math.round((game.mentions / maxMentions) * 35),
      weight: 35,
      caption: `${game.mentions} 次提及`,
    },
    {
      label: "增长率",
      value: Math.round((Math.max(getTrendDelta(game), 0) / maxTrendDelta) * 25),
      weight: 25,
      caption: `7 日趋势 ${formatDelta(getTrendDelta(game))}`,
    },
    {
      label: "正向情绪",
      value: Math.round(((game.sentiment.positive ?? 0) / 100) * 15),
      weight: 15,
      caption: `${game.sentiment.positive ?? 0}% 正面`,
    },
    {
      label: "建议密度",
      value: Math.round(((game.sentiment.suggestion ?? 0) / 100) * 15),
      weight: 15,
      caption: `${game.sentiment.suggestion ?? 0}% 建议`,
    },
    {
      label: "样本可信度",
      value: Math.round((game.sampleCount / maxSampleCount) * 10),
      weight: 10,
      caption: `${game.sampleCount} 条样本`,
    },
  ];
  const score = components.reduce((sum, item) => sum + item.value, 0);
  return { score, components };
}

function renderHotScoreModel(game) {
  const model = getHotScoreBreakdown(game);
  return `
    <div class="score-model">
      <div class="score-model-total">
        <span>模型分</span>
        <strong>${model.score}</strong>
        <small>当前口径可继续补充 Roblox 在线人数、访问增速或收藏增长。</small>
      </div>
      <div class="score-model-bars">
        ${model.components
          .map(
            (item) => `
              <div class="score-component">
                <div>
                  <span>${escapeHtml(item.label)}</span>
                  <strong>${item.value}/${item.weight}</strong>
                </div>
                <div class="mini-bar-track">
                  <span style="width:${Math.max(6, Math.round((item.value / item.weight) * 100))}%"></span>
                </div>
                <small>${escapeHtml(item.caption)}</small>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderMiniBar(label, value, total) {
  const width = Math.max(8, Math.round((value / total) * 100));
  return `
    <div class="mini-bar-row">
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${value}</strong>
      </div>
      <div class="mini-bar-track"><span style="width:${width}%"></span></div>
    </div>
  `;
}

function renderPipelineStep(label, value, caption) {
  return `
    <div class="pipeline-step">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(caption)}</small>
    </div>
  `;
}

function renderDecisionStackItem(label, value, color) {
  return `
    <div class="decision-stack-item">
      <span><i style="background:${color}"></i>${escapeHtml(label)}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderComments(game) {
  const comments =
    state.commentFilter === "all"
      ? game.comments
      : game.comments.filter((comment) => comment.sentiment === state.commentFilter);

  $("#commentList").innerHTML = comments.map((comment) => renderComment(comment, game)).join("");
  renderCommentArchive();

  if (!comments.length) {
    $("#commentList").innerHTML = `<div class="comment-card"><p class="translated">当前筛选下没有评论样本。</p></div>`;
  }
}

function renderComment(comment, game) {
  return `
    <article class="comment-card">
      <header>
        <span class="sentiment-badge ${comment.sentiment}">${sentimentCopy[comment.sentiment]?.label ?? "其他"}</span>
        <span class="comment-meta">${escapeHtml(getCommentCollectedAt(game, comment))} · Score ${comment.score}</span>
      </header>
      <p class="original">${escapeHtml(comment.originalText)}</p>
      <p class="translated">${escapeHtml(comment.translatedText)}</p>
      <div class="comment-meta">
        <span>${escapeHtml(comment.source)}</span>
        <span>${comment.usedInReport ? "已被分析报告引用" : "补充样本"}</span>
        <span>${comment.tags.map((tag) => escapeHtml(tag)).join(" / ")}</span>
        <a href="${comment.url}" target="_blank" rel="noreferrer">查看来源</a>
      </div>
    </article>
  `;
}

function renderCommentArchive() {
  if (!$("#commentArchive")) return;
  const items = getCommentArchiveItems();
  const genreGroups = items.reduce((groups, item) => {
    groups[item.genre] ??= [];
    groups[item.genre].push(item);
    return groups;
  }, {});

  $("#commentArchive").innerHTML = Object.entries(genreGroups)
    .map(([genre, genreItems]) => {
      const games = genreItems.reduce((groups, item) => {
        groups[item.gameId] ??= { game: item.game, items: [] };
        groups[item.gameId].items.push(item);
        return groups;
      }, {});

      return `
        <details class="archive-group" open>
          <summary>
            <span>${escapeHtml(genre)}</span>
            <strong>${genreItems.length}</strong>
          </summary>
          ${Object.values(games)
            .map(({ game, items: gameItems }) => renderArchiveGame(game, gameItems))
            .join("")}
        </details>
      `;
    })
    .join("");

  document.querySelectorAll("[data-archive-game]").forEach((button) => {
    button.addEventListener("click", () => {
      state.commentFilter = button.dataset.archiveFilter;
      selectGame(button.dataset.archiveGame, false);
      activateTab("comments");
      document.querySelectorAll("#commentFilters button").forEach((item) => {
        item.classList.toggle("is-active", item.dataset.filter === state.commentFilter);
      });
    });
  });
}

function renderArchiveGame(game, items) {
  const counts = Object.keys(sentimentCopy).map((key) => {
    const count = items.filter((item) => item.sentiment === key).length;
    return [key, count];
  });

  return `
    <div class="archive-game">
      <div>
        <strong>${escapeHtml(game.cnName)}</strong>
        <span>${escapeHtml(items[0]?.collectedAtLabel ?? "今日")} 更新</span>
      </div>
      <div class="archive-sentiments">
        ${counts
          .map(
            ([key, count]) => `
              <button type="button" data-archive-game="${game.id}" data-archive-filter="${key}" ${count ? "" : "disabled"}>
                ${sentimentCopy[key].label}<strong>${count}</strong>
              </button>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function getCommentArchiveItems() {
  return state.data.games
    .flatMap((game) =>
      game.comments.map((comment, index) => ({
        ...comment,
        game,
        gameId: game.id,
        genre: game.genre.split("/")[0].trim(),
        collectedAtLabel: getCommentCollectedAt(game, comment, index),
        sortOrder: game.rank * 100 + index,
      })),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function getCommentCollectedAt(game, comment, knownIndex) {
  const index = typeof knownIndex === "number" ? knownIndex : game.comments.findIndex((item) => item.id === comment.id);
  const labels = [...(state.data.meta.trendLabels ?? ["D-6", "D-5", "D-4", "D-3", "D-2", "昨日", "今日"])].reverse();
  return labels[Math.max(index, 0) % labels.length] ?? "今日";
}

function renderReport(game) {
  $("#reportGrid").innerHTML = reportBriefSections
    .map(([key, title, limit]) => {
      const value = game.summary[key];
      const body = Array.isArray(value)
        ? renderList(value.slice(0, limit))
        : `<p>${escapeHtml(value)}</p>`;

      return `
        <section class="report-section report-brief">
          <h3>${title}</h3>
          ${body}
        </section>
      `;
    })
    .join("");
}

function renderDecisionReportNav() {
  const hotButtons = state.data.games.map((game) => renderDecisionReportButton(game, `${game.rank}. ${game.cnName}`, game.heatScore));
  const focusButtons = (state.data.watchlist ?? [])
    .map((item) => {
      const linkedGame = item.gameId ? state.data.games.find((game) => game.id === item.gameId) : null;
      if (!linkedGame) {
        return `
          <button class="decision-report-button" type="button" disabled>
            <span>常驻 · ${escapeHtml(item.cnName)}</span>
            <strong>待补</strong>
          </button>
        `;
      }
      return renderDecisionReportButton(linkedGame, `常驻 · ${item.cnName}`, "关注");
    })
    .join("");

  $("#decisionReportNav").innerHTML = `
    <div class="switcher-group">
      <span class="switcher-label">热门 Top ${state.data.games.length}</span>
      ${hotButtons.join("")}
    </div>
    <div class="switcher-group">
      <span class="switcher-label">正在关注</span>
      ${focusButtons || '<span class="switcher-empty">暂无常驻关注游戏</span>'}
    </div>
  `;

  document.querySelectorAll("#decisionReportNav .decision-report-button:not(:disabled)").forEach((button) => {
    button.addEventListener("click", () => {
      selectGame(button.dataset.gameId, false);
      requestAnimationFrame(() => jumpToSection("decision-report"));
    });
  });
}

function renderDecisionReportButton(game, label, meta) {
  return `
    <button class="decision-report-button ${game.id === state.selectedGameId ? "is-active" : ""}" type="button" data-game-id="${game.id}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(meta)}</strong>
    </button>
  `;
}

function renderDecisionReport(game) {
  const trendDelta = getTrendDelta(game);
  const decision = getDecisionModel(game, trendDelta);
  const evidenceComments = game.comments.filter((comment) => comment.usedInReport).slice(0, 3);
  const evidence = evidenceComments.length ? evidenceComments : game.comments.slice(0, 3);
  const firstIdea = game.summary.eggyIdeas[0] ?? "先拆核心循环，再按蛋仔派对用户心智重写题材和表达。";
  const firstRisk = game.summary.risks[0] ?? "直接照搬题材、数值或社区语境会放大迁移风险。";
  const evidenceCount = game.comments.filter((comment) => comment.usedInReport).length;
  const evidenceBasis = formatEvidenceBasis(evidenceCount || evidence.length);

  $("#decisionGameName").textContent = `${game.name} / ${game.cnName}`;
  $("#decisionVerdict").textContent = decision.label;
  $("#decisionConfidence").textContent = `依据强度：${decision.confidence}`;
  $("#decisionVerdictText").textContent = decision.reason;

  $("#decisionMetrics").innerHTML = [
    renderDecisionMetric("flame", "热度分", game.heatScore, `Top ${game.rank}，近 7 天提及 ${game.mentions} 次`),
    renderDecisionMetric("activity", "7 日趋势", formatDelta(trendDelta), "今日热度相对窗口首日变化"),
    renderDecisionMetric("smile-plus", "正向占比", `${game.sentiment.positive}%`, "用于判断玩法吸引力是否足够清晰"),
    renderDecisionMetric("message-circle-warning", "负面占比", `${game.sentiment.negative}%`, "用于判断复刻时必须规避的问题"),
  ].join("");

  $("#decisionNarrative").innerHTML = `
    <section class="decision-block decision-conclusion">
      <p class="eyebrow">Recommendation</p>
      <h3>报告结论</h3>
      <p>${escapeHtml(game.summary.decision)}</p>
      <p>${escapeHtml(decision.action)}</p>
    </section>

    ${renderDecisionDisclosure("为什么值得看", `核心优点与玩家正向反馈，${evidenceBasis}`, game.summary.pros)}
    ${renderDecisionDisclosure("复刻到蛋仔派对应保留什么", `可迁移为蛋仔派对体验的玩法要素，${evidenceBasis}`, game.summary.eggyIdeas)}
    ${renderDecisionDisclosure("不能直接照搬的地方", `主要争议和迁移风险，${evidenceBasis}`, [
      ...game.summary.cons.slice(0, 2),
      ...game.summary.risks,
    ])}

    <section class="decision-block">
      <h3>建议的验证动作</h3>
      ${renderList([
        `先验证核心假设：${firstIdea}`,
        ...game.summary.suggestions,
        "用一周内可完成的低成本玩法原型验证核心循环，再决定是否进入完整项目排期。",
        "把 Reddit 新评论继续纳入证据池，观察负面反馈是否集中在可修复问题上。",
      ])}
    </section>

    <section class="decision-block evidence-section">
      <div class="evidence-heading">
        <p class="eyebrow">Evidence</p>
        <h3>原评论证据</h3>
        <p>本报告引用 ${evidenceCount || evidence.length} 条代表性评论。真实版会从 Reddit 抓取全量评论，清洗无效内容后再进入正面、负面、建议、其他四类证据库。</p>
      </div>
      <div class="evidence-list">
        ${evidence.map(renderDecisionEvidence).join("")}
      </div>
    </section>

    ${renderDecisionMethodPanel(game, decision)}
  `;
}

function renderDecisionMethodPanel(game, decision) {
  const steps = [
    ["Collect", "Reddit 增量抓取", "按游戏关键词和 r/roblox 总论坛每日收集评论。"],
    ["Clean", "清洗与四分类", "剔除无效评论，归入正面、负面、建议、其他。"],
    ["Score", "热度与证据评分", `综合热度 ${game.heatScore}、样本 ${game.sampleCount}、趋势和情绪。`],
    ["Report", "生成分析报告", `输出 ${decision.label}，并绑定原评论证据。`],
  ];

  return `
    <details class="decision-method-panel decision-method-compact" aria-label="分析报告生成流程">
      <summary>
        <span>分析生成口径</span>
        <small>展开查看采集、清洗、评分和报告生成方式</small>
      </summary>
      <div class="decision-method-copy">
        <p class="eyebrow">Method</p>
        <h3>结构化指标 + 精选证据</h3>
        <p>报告先读取指标、摘要和代表性评论，再生成建议，保证 token 可控、结论可追溯。</p>
      </div>
      <div class="method-steps">
        ${steps
          .map(
            ([label, title, caption], index) => `
              <article>
                <span>${index + 1}. ${escapeHtml(label)}</span>
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(caption)}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </details>
  `;
}

function renderDecisionMemo(kicker, title, body, caption = "") {
  return `
    <article class="decision-memo-card">
      <span>${escapeHtml(kicker)}</span>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
      ${caption ? `<small>${escapeHtml(caption)}</small>` : ""}
    </article>
  `;
}

function renderDecisionDisclosure(title, summary, items) {
  return `
    <details class="decision-disclosure">
      <summary>
        <span>${escapeHtml(title)}</span>
        <small>${escapeHtml(summary)}</small>
      </summary>
      ${renderList(items)}
    </details>
  `;
}

function formatEvidenceBasis(count) {
  return `基于 ${count} 条引用评论`;
}

function renderDecisionMetric(icon, label, value, caption) {
  return `
    <article class="decision-metric">
      <i data-lucide="${icon}"></i>
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(caption)}</small>
      </div>
    </article>
  `;
}

function renderDecisionEvidence(comment) {
  return `
    <article class="evidence-card">
      <div>
        <span class="sentiment-badge ${comment.sentiment}">${sentimentCopy[comment.sentiment]?.label ?? "其他"}</span>
        <span class="comment-meta">Score ${comment.score}</span>
      </div>
      <p>${escapeHtml(comment.translatedText)}</p>
      <small>${escapeHtml(comment.originalText)}</small>
    </article>
  `;
}

function getDecisionModel(game, trendDelta) {
  const positive = game.sentiment.positive ?? 0;
  const negative = game.sentiment.negative ?? 0;
  const sampleWeight = Math.min(game.sampleCount, 60) / 60;
  const suitabilityScore = Math.round(
    game.heatScore * 0.42 +
      positive * 0.24 +
      sampleWeight * 14 +
      Math.max(trendDelta, 0) * 0.1 +
      (100 - negative) * 0.1,
  );
  const confidence = game.sampleCount >= 40 && game.mentions >= 200 ? "较高" : game.sampleCount >= 20 ? "中等" : "偏低";

  if (suitabilityScore >= 78 || game.recommendation.includes("强烈")) {
    return {
      label: "建议进入原型拆解",
      confidence,
      reason: `${game.cnName} 当前热度高、讨论样本充足，且玩家正向反馈集中在可拆解的玩法循环上。`,
      action: "建议把它作为优先级较高的竞品参考，但只复刻核心循环和情绪节奏，不直接照搬题材表达。",
    };
  }

  if (suitabilityScore >= 66 || game.recommendation.includes("建议")) {
    return {
      label: "建议继续验证",
      confidence,
      reason: `${game.cnName} 有明确讨论热度，但仍需要进一步确认玩法能否迁移到蛋仔派对的用户和内容生态。`,
      action: "建议继续收集 Reddit 评论和玩法视频样本，先完成纸面玩法拆解，再决定是否做可玩原型。",
    };
  }

  return {
    label: "暂缓复刻",
    confidence,
    reason: `${game.cnName} 当前复刻信号不够强，热度、正向反馈或迁移适配度还不足以支撑直接投入。`,
    action: "建议保留观察，不进入制作排期，除非后续讨论热度或玩家诉求明显上升。",
  };
}

function getTrendDelta(game) {
  if (!game.trend?.length) return 0;
  return game.trend[game.trend.length - 1] - game.trend[0];
}

function formatDelta(value) {
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return "0";
}

function renderList(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function activateTab(tabName) {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tabName);
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === tabName);
  });
}

function jumpToSection(sectionId) {
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function getSelectedGame() {
  return state.data.games.find((game) => game.id === state.selectedGameId);
}

function normalize(value) {
  return String(value).toLowerCase().trim();
}

function formatSourceHost(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return url;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

boot();
