# Roblox Reddit Insight Lab

Roblox Reddit Insight Lab is a lightweight market intelligence dashboard for tracking Roblox game discussions, organizing Reddit player feedback, and turning community signals into gameplay research reports.

Online site:

```text
https://koalaa677.github.io/roblox-reddit-insight-lab/
```

## Screenshots

### Roblox Discussion Overview

![Roblox Discussion Overview](assets/screenshots/dashboard.png)

### Targeted Game Analysis

![Targeted Game Analysis](assets/screenshots/game-analysis.png)

### Analysis Report

![Analysis Report](assets/screenshots/ai-report.png)

## Features

- **Roblox discussion overview**: shows the current Top 5 games by Reddit discussion heat, with genre, trend, score, and a short research judgment.
- **Explainable hot score**: combines mentions, 7-day trend, positive sentiment, suggestion density, and sample confidence.
- **Targeted game analysis**: drills into one selected game with official links, Reddit links, trend charts, sentiment split, comments, and summary.
- **Comment evidence library**: keeps original English comments, Chinese translations, sentiment labels, tags, source links, and report citation state.
- **Analysis report**: summarizes whether a gameplay loop is worth further research, what can be adapted, what should not be copied, and what validation actions should follow.
- **Watchlist workflow**: supports adding tracked games, removing them with confirmation, and jumping directly into the related analysis.

## Product Flow

```text
Roblox discussion overview
  -> Top 5 trending games
  -> hot score breakdown
  -> genre mix, sentiment, evidence flow, recommendation mix

Targeted analysis
  -> selected game profile
  -> Roblox and Reddit source links
  -> 7-day heat trend
  -> sentiment split
  -> categorized comment evidence
  -> concise AI summary

Analysis report
  -> overall recommendation
  -> transferable gameplay elements
  -> risks and non-transferable parts
  -> validation actions
  -> cited comment evidence
```

## Scoring Model

The dashboard uses an explainable score instead of a single opaque popularity number:

```text
Hot Score =
  Reddit mentions * 35%
+ 7-day growth * 25%
+ positive sentiment * 15%
+ suggestion density * 15%
+ sample confidence * 10%
```

When connected to live data, the sample confidence layer can be expanded with Roblox-side signals such as concurrent users, visit growth, favorite growth, and game update frequency.

## Comment Evidence Pipeline

The public version uses a curated sample dataset with the same structure expected from the live pipeline. A production data pipeline can follow this flow:

```text
Reddit API
  -> incremental comment collection
  -> deduplication and low-value content filtering
  -> sentiment classification: positive / negative / suggestion / other
  -> time-based sorting
  -> archive by game genre -> game -> sentiment type
  -> select representative evidence for the analysis report
```

This keeps report conclusions traceable back to player comments instead of relying on unsupported summaries.

## AI Analysis Strategy

The report is designed to minimize token usage while preserving decision quality:

- Clean, deduplicate, and classify comments locally before sending anything to an AI model.
- Send structured metrics, daily summaries, and selected high-quality evidence instead of the full raw comment set.
- Ask the model for decision-ready outputs: recommendation, adaptation path, non-transferable risks, value, and validation actions.
- Keep the original cited comments visible in the UI so conclusions remain auditable.

Related configuration and strategy notes:

```text
docs/reddit-ai-pipeline-strategy.md
data/pipeline-config.json
```

## Architecture

```text
index.html
  -> page structure

styles.css
  -> visual system, responsive layout, dashboard and report styles

app.js
  -> rendering, navigation, search, watchlist, comment filters, report switching

data/insights.json
  -> sample insight dataset with games, comments, reports, and source links

data/pipeline-config.json
  -> Reddit collection and AI analysis budget configuration

docs/
  -> deployment, API, pipeline, and reference notes
```

The current implementation is a static frontend that reads a structured JSON snapshot. This keeps the display layer simple and makes it easy to connect a scheduled Reddit and AI analysis job later without changing the page contract.

## Local Development

Use a local static server so the browser can load `data/insights.json`.

```powershell
cd C:\Users\gaoyucheng01\Desktop\新建文件夹\roblox-reddit-insight-lab
python -m http.server 4173 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:4173
```

## Deployment

The project can be deployed as a static site. The repository includes:

- `.nojekyll` for GitHub Pages static file handling.
- `.github/workflows/deploy-pages.yml` for GitHub Pages deployment.
- `vercel.json` for Vercel static hosting.

Deployment guide:

```text
docs/deployment-guide.md
```

## Data And API Notes

- Reddit collection does not consume AI tokens; it consumes Reddit API request quota.
- AI token usage starts only when text or structured evidence is sent to a model.
- API credentials should never be exposed in frontend code.
- A practical live pipeline should run from a local script, scheduled job, or backend task that writes the same JSON schema consumed by the frontend.

## Roadmap

- Connect Reddit API collection for selected subreddits and game keywords.
- Add automated comment cleaning, deduplication, and four-way classification.
- Generate daily summaries and weekly analysis reports from selected evidence.
- Add data freshness indicators for collection volume, filtered volume, and cited evidence count.
- Expand Roblox-side signals for online users, visits, favorites, and update cadence.

## Out Of Scope

- User login and permission management.
- Database-backed collaboration workflows.
- Discord collection.
- Exposing Reddit or AI tokens in the browser.
- Large-scale enterprise monitoring features.
