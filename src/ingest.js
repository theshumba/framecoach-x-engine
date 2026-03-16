import Parser from 'rss-parser';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { logger } from './logger.js';

const log = logger.child({ module: 'ingest' });

/**
 * Ingest film industry news from RSS feeds.
 * Uses trending-cache.json with configurable TTL to avoid re-fetching.
 *
 * @param {object} strategy - config/strategy.json contents
 * @returns {Promise<Array>} Filtered, deduplicated articles
 */
export async function ingestNews(strategy) {
  // --- Check cache TTL ---
  const cachePath = 'state/trending-cache.json';
  let cache;
  try {
    cache = JSON.parse(readFileSync(cachePath, 'utf-8'));
  } catch {
    cache = { fetched_at: null, articles: [] };
  }

  const ttlMs = (strategy.trendingCacheTTLHours || 6) * 60 * 60 * 1000;
  const cacheAge = cache.fetched_at ? Date.now() - new Date(cache.fetched_at).getTime() : Infinity;

  if (cacheAge < ttlMs && cache.articles.length > 0) {
    log.info({ cached: cache.articles.length, ageHours: (cacheAge / 3600000).toFixed(1) }, 'Using cached articles');
    return cache.articles;
  }

  // --- Fresh fetch ---
  const feedConfig = JSON.parse(readFileSync('config/feeds.json', 'utf-8'));
  const { feeds, globalKeywords = [], excludeKeywords = [] } = feedConfig;

  log.info({ feedCount: feeds.length }, 'Starting RSS ingestion');

  const parser = new Parser({
    timeout: 10000,
    maxRedirects: 5,
    headers: { 'User-Agent': 'FrameCoachXEngine/1.0' },
  });

  // Stage 1: Fetch all feeds in parallel
  const results = await Promise.allSettled(
    feeds.map(feed => parser.parseURL(feed.url))
  );

  const allArticles = [];
  let succeeded = 0;
  let failed = 0;

  for (const [i, result] of results.entries()) {
    const feed = feeds[i];
    if (result.status === 'fulfilled') {
      const items = result.value.items.map(item => ({
        title: item.title || '',
        link: item.link || '',
        pubDate: item.isoDate || item.pubDate,
        contentSnippet: (item.contentSnippet || '').slice(0, 500),
        source: feed.id,
        sourceName: feed.name,
      }));
      log.info({ feed: feed.id, items: items.length }, 'Feed fetched');
      allArticles.push(...items);
      succeeded++;
    } else {
      log.warn({ feed: feed.id, error: result.reason?.message }, 'Feed failed');
      failed++;
    }
  }

  log.info({ total: allArticles.length, succeeded, failed }, 'Fetch complete');

  // Stage 2: Freshness filter (48 hours)
  const cutoffMs = (strategy.maxArticleAgeHours || 48) * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - cutoffMs);

  const fresh = allArticles.filter(article => {
    if (!article.pubDate) return false;
    const parsed = new Date(article.pubDate);
    if (isNaN(parsed.getTime())) return false;
    return parsed >= cutoff;
  });

  log.info({ before: allArticles.length, after: fresh.length }, 'Freshness filter applied');

  // Stage 3: Keyword relevance + exclude filter
  const feedMap = Object.fromEntries(feeds.map(f => [f.id, f]));

  const relevant = fresh.filter(article => {
    const text = `${article.title} ${article.contentSnippet}`.toLowerCase();

    // Exclude articles matching exclude keywords
    if (excludeKeywords.some(kw => text.includes(kw.toLowerCase()))) {
      return false;
    }

    const feedCfg = feedMap[article.source];
    const feedKeywords = feedCfg?.keywords || [];

    // Google News feeds (empty keywords) are pre-filtered
    if (feedKeywords.length === 0) return true;

    const allKeywords = [...feedKeywords, ...globalKeywords];
    return allKeywords.some(kw => text.includes(kw.toLowerCase()));
  });

  log.info({ before: fresh.length, after: relevant.length }, 'Keyword filter applied');

  // Stage 4: Deduplication
  const seen = new Set();
  const unique = relevant.filter(article => {
    const normalized = `${article.title.toLowerCase().trim()}|${article.link}`;
    const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
    if (seen.has(hash)) return false;
    seen.add(hash);
    return true;
  });

  log.info({ before: relevant.length, after: unique.length }, 'Deduplication applied');

  // Update cache
  const cacheData = {
    fetched_at: new Date().toISOString(),
    articles: unique,
  };
  writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));

  // Stage 5: Minimum threshold
  if (unique.length < (strategy.minArticlesRequired || 2)) {
    log.warn({ found: unique.length }, 'Too few articles for trending — will fall back to evergreen');
    return [];
  }

  log.info({ total: unique.length }, 'Ingestion complete');
  return unique;
}
