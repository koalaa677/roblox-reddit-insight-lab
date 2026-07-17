# 线上部署手把手指南

当前项目是纯静态网站：`index.html`、`styles.css`、`app.js`、`data/insights.json`。适合先部署成公开可访问的产品预览，再逐步接 Reddit API 和 AI API。

## 推荐路线

优先推荐 GitHub Pages：

- 免费。
- 适合静态产品页面。
- 可以把源码、README 和线上预览放在同一个仓库里。
- 访问者能同时看到网页、数据结构和项目说明。

备选 Vercel：

- 部署更快，界面更友好。
- 适合先快速拿一个线上链接。
- 后续如果加本地构建或简单 Serverless API，也比较顺。

## 部署前检查

本地先确认：

```powershell
cd 01-current-project\roblox-reddit-insight-lab
python -m http.server 4173 --bind 127.0.0.1
```

浏览器打开：

```text
http://127.0.0.1:4173
```

如果页面能正常加载、图表能出现、没有数据加载失败提示，就可以部署。

## 方式一：GitHub Pages

### 你需要做

1. 登录 GitHub。
2. 创建新仓库，建议仓库名：

```text
roblox-reddit-insight-lab
```

3. 把当前项目文件上传到仓库。
4. 打开仓库的 `Settings`。
5. 进入 `Pages`。
6. 在 `Build and deployment` 中选择 `GitHub Actions`。
7. 回到 `Actions`，运行或等待 `Deploy static site to GitHub Pages`。
8. 部署成功后，在 `Settings -> Pages` 查看线上地址。

### 如果你还没有 git

当前电脑 shell 里没有检测到 `git` 命令。你可以先用 GitHub 网页上传，最快：

1. 进入 GitHub 仓库页面。
2. 点击 `Add file`。
3. 选择 `Upload files`。
4. 把项目目录里的文件和文件夹拖进去。
5. 点击 `Commit changes`。

需要上传的核心内容：

```text
.github/
assets/
data/
docs/
scripts/
.env.example
.gitignore
.nojekyll
app.js
index.html
README.md
styles.css
vercel.json
```

注意：不要上传真实 `.env` 文件，也不要上传 Reddit 或 AI token。

## 方式二：Vercel

### 你需要做

1. 登录 Vercel。
2. 点击 `Add New...`。
3. 选择 `Project`。
4. 从 GitHub 导入 `roblox-reddit-insight-lab` 仓库。
5. Framework Preset 选择 `Other` 或保持默认自动识别。
6. Build Command 留空。
7. Output Directory 留空或填 `.`。
8. 点击 `Deploy`。

部署完成后，Vercel 会给出一个访问地址。后续每次推送 GitHub，Vercel 会自动重新部署。

## 上线后需要补 README

拿到线上地址后，把 README 顶部改成：

```md
在线访问：你的线上地址
本地预览：http://127.0.0.1:4173
```

同时建议截 2-3 张图放到 `assets/screenshots/`：

- 洞察看板
- 定向分析
- AI 报告

## API 接入放到第二阶段

上线静态预览后，再做真实数据接入：

```text
Reddit API
  -> 本地抓取脚本
  -> 评论清洗与四分类
  -> AI 精选分析
  -> 写回 data/insights.json
  -> 重新部署静态网站
```

不要在前端直接调用 Reddit API 或 AI API，因为 token 会暴露。
