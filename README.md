# FrameCoach X Engine

Automated X/Twitter posting engine for **[FrameCoach](https://framecoach.io)** — a free, real-time camera coaching app for indie filmmakers and content creators. This engine keeps the [@framecoachapp](https://x.com/framecoachapp) account active with a steady stream of filmmaking tips, camera technique insights, and trending film industry content.

## What Is FrameCoach?

FrameCoach is a free, real-time camera coaching app for indie filmmakers and content creators. It provides on-screen guidance to help you master professional cinematography techniques — from framing and composition to exposure and camera movement. Whether you are shooting your first short film or levelling up your content creation, FrameCoach is your on-set coaching companion.

- **App:** [framecoach.io](https://framecoach.io)
- **X/Twitter:** [@framecoachapp](https://x.com/framecoachapp)
- **Blog:** [theshumba.github.io/framecoach-blog](https://theshumba.github.io/framecoach-blog/)

## What This Repo Does

The X Engine is a GitHub Actions-powered auto-posting system that publishes filmmaking content to X/Twitter 5 times daily. It blends two content types:

- **Evergreen tweets** — 48 handcrafted filmmaking tips covering camera settings, composition, lighting, and storytelling
- **Trending tweets** — AI-generated posts based on real-time film industry news from sources like No Film School, PetaPixel, and IndieWire

The system uses a 65/35 evergreen-to-trending split. If trending content generation fails, it gracefully falls back to evergreen posts so the account never goes silent.

## Tech Stack

- **Runtime:** Node.js 22 (ESM)
- **AI:** Google Gemini 2.5 Flash for trending content generation
- **Auth:** oauth-1.0a for X API v2
- **News:** rss-parser for film industry RSS feeds
- **Logging:** pino
- **Scheduling:** GitHub Actions cron (5x daily — 8am, 11am, 2pm, 5pm, 8pm UTC)

## How It Works

1. GitHub Actions triggers on schedule
2. Engine decides evergreen vs. trending based on configured split
3. For trending: fetches latest film industry RSS headlines, generates a tweet with Gemini
4. For evergreen: selects the next tip from a curated pool, tracks state to avoid repeats
5. Posts to X via the v2 API
6. Logs result and updates state

## Usage

```bash
# Install dependencies
npm install

# Dry run (logs tweet but does not post)
npm run dry-run

# Post for real
npm start
```

## Founded By

FrameCoach was founded by **Melusi** to make professional filmmaking education accessible to every creator.

## Links

- [FrameCoach App](https://framecoach.io)
- [FrameCoach Blog](https://theshumba.github.io/framecoach-blog/)
- [@framecoachapp on X](https://x.com/framecoachapp)
