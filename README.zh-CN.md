# Roblox Reddit Insight Lab

[English](README.md#english) | [中文说明](README.md#中文说明)

Roblox Reddit Insight Lab 是一个面向 Roblox 玩法研究和游戏出海研判的轻量级洞察工具。项目把 Reddit 玩家讨论整理成可公开访问的静态产品：先看热门游戏，再看评论证据，最后形成带来源说明的玩法分析报告。

在线访问：

```text
https://koalaa677.github.io/roblox-reddit-insight-lab/
```

## 产品定位

从 AI 应用的角度看，这个项目重点展示的不是底层模型研究，而是如何把 AI 放进真实的营销传播和玩家洞察工作流里：把非结构化玩家评论清洗、分类、评分、总结，再转化成可以支持游戏出海和玩法研判的决策报告。

## 场景背景

Roblox 是一个游戏平台，平台内包含大量独立游戏，但并不提供足够集中的玩家评论入口。为了研究这些游戏的真实玩家反馈，本项目把 Reddit 上围绕 Roblox 游戏的帖子和评论作为外部社区信号来源。

这个流程适合用于竞品分析：当一个团队正在研究与 Roblox 热门玩法相近的产品时，可以通过 Reddit 评论了解玩家喜欢什么、抱怨什么、希望增加什么，再把这些信息转化为产品优化和玩法验证方向。

当前版本重点不是搭建大型后台系统，而是完成一个清晰、可信、可运行的产品闭环：

- 用结构化数据快照驱动页面，保证公开站点稳定可访问。
- 保留 Reddit 评论文本、中文翻译、情绪分类、标签和证据来源状态。
- 用可解释热点评分帮助快速筛选值得研究的 Roblox 游戏。
- 用 AI 分析管线把精选证据转化为玩法机会、风险边界和验证动作。

## AI 应用亮点

- **AI 赋能市场洞察**：用 AI 辅助整理 Reddit 玩家反馈，把分散评论转化为玩法机会、风险和验证建议。
- **人机协作分析流程**：规则分类先完成基础判断，AI 负责校准、摘要和报告表达，避免把全部判断交给模型黑箱。
- **低 token 设计**：先在本地完成去重、过滤和分类，只把精选证据和结构化指标交给 AI。
- **分级证据来源**：Forest99 历史快照保留逐条原帖链接；策展样本明确标出未保留逐条链接，避免把社区首页误作单条证据来源。
- **可展示的应用闭环**：用 `data/insights.json` 作为稳定数据契约，把分析结果直接转化为可公开访问的产品页面。

## Forest99 旗舰案例

Forest99 用一条完整证据链说明系统如何把历史社区数据转化为可验证的产品判断：

```text
10 天历史快照 / 147 个帖子 / 1579 条评论
  -> 本地清洗、去重、规则四分类和证据评分
  -> 38 条展示证据
  -> 12 条代表证据进入校准流程
  -> 6 条评论进入分析报告引用
  -> 形成玩法机会、主要风险和 5-8 分钟原型验证建议
```

页面同时保留原始 Reddit 链接、评论分类、证据分和报告引用状态。报告结论可以回到原评论，而不是只展示不可验证的 AI 摘要。

## 产品界面

### Roblox 讨论热度全局

![Roblox 讨论热度全局](assets/screenshots/dashboard.png)

### 定向分析

![定向分析](assets/screenshots/game-analysis.png)

### 分析报告

![分析报告](assets/screenshots/ai-report.png)

## 当前能力

- **全局热度看板**：展示 Roblox 相关讨论 Top 3，包含热度分、趋势、类型分布、情绪结构和证据流。
- **定向游戏分析**：聚焦单个游戏，展示 Roblox / Reddit 外部入口、趋势图、情绪占比和评论证据。
- **评论证据库**：按正面、负面、建议、其他四类组织评论，保留原文、翻译、标签、证据分和报告引用状态。
- **AI 决策报告**：输出是否值得研究、哪些玩法要素可迁移、哪些内容不能照搬，以及下一步验证动作。
- **关注游戏工作流**：支持新增和移除关注游戏，为后续定向采集与分析保留交互入口。
- **本地图标与静态部署**：页面不依赖外部图标 CDN，适合 GitHub Pages 直接托管。

## 数据状态

公开版本使用结构化样本数据快照，数据结构与后续真实采集流程保持一致。

当前快照采用分级证据来源：

- Forest99：历史 Reddit public JSON 快照，38 条展示证据均保留逐条原帖或评论链接。
- Dress To Impress：25 条策展样本，仅保留社区入口，不宣称逐条原帖可追溯。
- Blox Fruits：23 条策展样本，仅保留社区入口，不宣称逐条原帖可追溯。

看板和报告中的情绪百分比基于全部展示样本，其中每个游戏有 12 条代表证据进入校准流程；页面会直接标出完整样本数和校准数。

Forest99 已接入历史 Reddit public JSON 快照。旧监控任务累计保留：

- 10 天数据
- 147 个帖子
- 1579 条评论
- 当前公开快照展示 38 条 Forest99 评论证据
- 其中 6 条进入分析报告引用

公开站点不会展示真实采集日期。页面会分别显示逐条来源链接或“未保留逐条原帖链接”，并保留情绪分类、主题标签、证据分和报告引用关系。

仓库也保留了低频 `public_json` 探测脚本，用于在 Reddit OAuth 审批前验证采集链路。如果该入口返回 `403 Forbidden`，脚本应停止重试；正式采集仍建议走 Reddit OAuth Data API。

## 分类与证据质量评估

仓库包含一个可重复运行的小型质量评估，用于检查当前规则分类器和证据数据契约：

- 规则分类核验：DTI 的 13 条人工复核样本中，当前分类器匹配 12 条，结果为 92.3%。
- 校准流程覆盖：3 个游戏共 36 条代表证据进入校准流程，每个游戏 12 条。
- 证据契约：评论 ID、样本数、情绪比例、AI 代表证据 ID、报告引用和来源边界共 7 项检查全部通过。
- 历史链接覆盖：Forest99 的 38/38 条展示证据和 6/6 条报告引用均保留逐条 Reddit 链接。

公开快照采用可复现离线输出。13 条人工复核样本只用于小型回归校准，不代表跨游戏模型总体准确率；校准流程覆盖也不等于模型分类准确率。接入在线模型后可沿用同一评估框架重新校准。

```bash
# 只预览评估结果
node scripts/evaluate-analysis-quality.mjs

# 将评估快照写入 data/insights.json
node scripts/evaluate-analysis-quality.mjs --write

# 运行评估回归检查
node scripts/test-analysis-quality.mjs
```

## 产品流程

```text
Roblox 讨论热度全局
  -> Top 3 热门游戏
  -> 热点评分拆解
  -> 类型分布、情绪结构、证据流、建议分布

定向分析
  -> 当前选中游戏
  -> Roblox 与 Reddit 外部入口
  -> 近 3 天轻量展示窗口
  -> 近 7 天热度趋势
  -> 情绪占比
  -> 分类评论证据
  -> 摘要结论

分析报告
  -> 综合建议
  -> 可迁移玩法要素
  -> 风险与不可照搬点
  -> 验证动作
  -> 引用评论证据
```

## 热点评分模型

看板使用可解释评分，而不是只展示一个不透明热度数字：

```text
Hot Score =
  Reddit 提及量 * 35%
+ 7 日增长 * 25%
+ 正向情绪 * 15%
+ 建议密度 * 15%
+ 样本可信度 * 10%
```

后续接入实时数据后，样本可信度可以继续补充 Roblox 侧信号，例如在线人数、访问增长、收藏增长和游戏更新频率。

## AI 分析策略

AI 管线的目标是控制 token 成本，同时保留决策质量和证据可追溯性。

```text
原始评论
  -> 本地清洗与去重
  -> 规则四分类：正面 / 负面 / 建议 / 其他
  -> 证据分计算
  -> 只选择高价值样本进入校准阶段
  -> 校准、摘要和报告生成（离线与在线共用接口）
  -> 写回 data/insights.json
```

关键原则：

- 抓取 Reddit 评论本身不消耗 AI token。
- 只有精选证据、结构化指标或摘要被发送给模型时，才产生 AI token 成本。
- AI 不直接处理全量评论，而是处理本地清洗后的高价值样本。
- 报告中的结论必须能回到当前评论证据；只有保留原始标识的记录才提供逐条 Reddit 链接。

相关文档：

```text
docs/reddit-ai-pipeline-strategy.md
data/pipeline-config.json
```

## AI 分析脚本

仓库内置本地 AI 分析管线：

```text
scripts/ai-analyze.mjs
  -> 主入口：清洗 -> 规则分类 -> 校准阶段 -> 日摘要 -> 决策报告

scripts/lib/cleaner.mjs
  -> 评论清洗、去重、证据分计算

scripts/lib/rule-classifier.mjs
  -> 基于关键词的四分类初筛

scripts/lib/ai-client.mjs
  -> OpenAI 兼容 API 封装，支持可复现离线评估回退

scripts/evaluate-analysis-quality.mjs
  -> 分类校准与证据数据契约评估
```

使用方式：

```bash
# 预览模式，不写入文件
node scripts/ai-analyze.mjs --game forest99

# 写回 data/insights.json
node scripts/ai-analyze.mjs --game forest99 --write

# 强制离线评估模式（参数名保留为 --dry-run）
node scripts/ai-analyze.mjs --game forest99 --dry-run
```

环境变量：

```text
AI_API_BASE_URL=   # OpenAI 兼容接口地址
AI_API_TOKEN=      # API Key
AI_MODEL=          # 模型名称，默认 gpt-4o-mini
```

未配置 API Key 时，脚本使用内置的可复现离线输出验证完整流程和前端展示，公开快照无需上传任何模型凭据。

## 项目结构

```text
index.html
  -> 页面结构

styles.css
  -> 视觉系统、布局、看板和报告样式

app.js
  -> 页面渲染、导航、搜索、关注游戏、评论筛选、报告切换

data/insights.json
  -> 游戏、评论、报告和外部链接的数据快照

data/pipeline-config.json
  -> Reddit 采集和 AI 分析预算配置

scripts/
  -> AI 分析、质量评估、历史数据导入、public JSON 探测、预算估算

docs/
  -> 部署、API、AI 管线和开源参考说明
```

当前实现是一个读取结构化 JSON 快照的静态前端。这让展示层保持简单，也方便后续接入定时采集、AI 分析任务或轻量后端，而不需要改变页面数据契约。

## 本地运行

建议使用本地静态服务器打开，确保浏览器可以读取 `data/insights.json`。

```powershell
cd 01-current-project\roblox-reddit-insight-lab
python -m http.server 4173 --bind 127.0.0.1
```

打开：

```text
http://127.0.0.1:4173
```

## 部署

项目可以作为静态站点部署。仓库已包含：

- `.nojekyll`：用于 GitHub Pages 静态文件处理。
- `.github/workflows/deploy-pages.yml`：用于 GitHub Pages 自动部署。
- `vercel.json`：用于 Vercel 静态托管。

部署说明：

```text
docs/deployment-guide.md
```

## 路线图

- 接入 Reddit OAuth Data API，支持指定 subreddit 和游戏关键词采集。
- 补充在线模型小样本对照评估，记录分类、摘要和报告质量。
- 扩大人工标注评估集，补充第二个真实历史或授权数据案例。
- 增加数据新鲜度指标，例如抓取量、过滤量和引用证据数。
- 扩展 Roblox 侧信号，例如在线人数、访问量、收藏量和更新频率。

## 暂不做

- 用户登录和权限管理。
- 数据库驱动的多人协作后台。
- Discord 数据采集。
- 在浏览器中暴露 Reddit 或 AI token。
- 大规模企业级监控系统。
