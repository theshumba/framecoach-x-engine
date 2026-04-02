# FrameCoach X Engine

![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-scheduled-2088FF?logo=githubactions)
![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-4285F4?logo=google)
![X API](https://img.shields.io/badge/X_API-v2-000000?logo=x)

Automated posting engine for **[@framecoachapp](https://x.com/framecoachapp)** on X/Twitter. Publishes filmmaking tips and trending film industry content 5 times daily via GitHub Actions — zero infrastructure, fully serverless.

## How It Works

```
GitHub Actions cron (5x daily)
  |
  v
Decide content type (65/35 evergreen/trending split)
  |
  +-- Evergreen: pick next tip from curated bank of 48, track state to avoid repeats
  |
  +-- Trending: ingest RSS feeds -> generate tweet with Gemini 2.5 Flash
  |       (falls back to evergreen if trending fails)
  |
  v
Post to X via v2 API (retry with exponential backoff)
  |
  v
Commit updated state back to repo
```

## Content Sources

**Evergreen** — 48 handcrafted filmmaking tips covering camera settings, composition, lighting, color grading, and storytelling. Cooldown system prevents repeats within a window of 10 posts.

**Trending** — Real-time film industry news from RSS feeds (No Film School, PetaPixel, IndieWire, Google News). Gemini generates a concise, on-brand tweet from the latest headlines. Deduplication checks against recent posts.

## Tech Stack

| Component | Tech |
|-----------|------|
| Runtime | Node.js 22 (ESM) |
| AI | Google Gemini 2.5 Flash |
| Auth | oauth-1.0a (X API v2) |
| News | rss-parser |
| Logging | pino |
| Scheduling | GitHub Actions cron |
| Config | JSON strategy file (weights, cooldowns, retry params) |

## Usage

```bash
# Install
npm install

# Dry run (generates tweet, does not post)
npm run dry-run

# Post to X
npm start

# Pretty-printed logs
npm run start:pretty
```

## Configuration

All behavior is controlled via `config/strategy.json`:

```json
{
  "evergreenWeight": 0.65,
  "trendingWeight": 0.35,
  "trendingCacheTTLHours": 6,
  "maxArticleAgeHours": 48,
  "evergreenCooldownCount": 10,
  "postRetryAttempts": 3
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `X_API_KEY` | Yes | X API consumer key |
| `X_API_SECRET` | Yes | X API consumer secret |
| `X_ACCESS_TOKEN` | Yes | X API access token |
| `X_ACCESS_SECRET` | Yes | X API access token secret |
| `GEMINI_API_KEY` | For trending | Google AI Studio API key |
| `DRY_RUN` | No | Set to `true` to skip posting |

## Pipeline Modules

```
src/
  index.js      # Orchestrator — runs the full pipeline
  decide.js     # Content type selector (evergreen vs trending)
  evergreen.js  # Evergreen tweet picker with cooldown tracking
  ingest.js     # RSS feed fetcher and article filter
  generate.js   # Gemini-powered tweet generation
  post.js       # X API v2 poster with retry logic
  state.js      # State persistence (JSON file in state/)
  validate.js   # Environment and config validation
  logger.js     # Pino logger setup
```

## Links

- [FrameCoach App](https://framecoach.io)
- [FrameCoach Blog](https://theshumba.github.io/framecoach-blog/)
- [@framecoachapp on X](https://x.com/framecoachapp)
