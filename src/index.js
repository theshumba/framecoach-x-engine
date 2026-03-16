import { readFileSync } from 'fs';
import { logger } from './logger.js';
import { decideType } from './decide.js';
import { pickEvergreen } from './evergreen.js';
import { ingestNews } from './ingest.js';
import { generateTrendingTweet } from './generate.js';
import { postTweet } from './post.js';
import { loadState, saveState, recordPosted } from './state.js';

const log = logger.child({ stage: 'pipeline' });

async function main() {
  // Validate required env vars
  const required = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET'];
  if (process.env.DRY_RUN !== 'true') {
    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
      log.error({ missing }, 'Missing required environment variables');
      process.exit(1);
    }
  }

  log.info({ timestamp: new Date().toISOString() }, 'Pipeline started');

  const strategy = JSON.parse(readFileSync('config/strategy.json', 'utf-8'));
  const state = loadState();

  let tweet;
  const contentType = decideType(strategy);

  if (contentType === 'trending') {
    log.info('Trending path selected — ingesting RSS feeds');

    try {
      const articles = await ingestNews(strategy);

      if (articles.length > 0) {
        const recentTexts = state.trending.recent_texts || [];
        tweet = await generateTrendingTweet(articles, recentTexts, strategy);
      }
    } catch (err) {
      log.warn({ error: err.message }, 'Trending pipeline failed');
    }

    // Fallback to evergreen if trending fails
    if (!tweet) {
      log.info('Trending failed — falling back to evergreen');
      tweet = pickEvergreen(state, strategy);
    }
  } else {
    tweet = pickEvergreen(state, strategy);
  }

  log.info({ type: tweet.type, chars: tweet.text.length }, 'Tweet ready to post');

  // Post to X
  const retryConfig = {
    attempts: strategy.postRetryAttempts || 3,
    baseDelayMs: strategy.postRetryBaseDelayMs || 2000,
  };

  const response = await postTweet(tweet.text, retryConfig);

  log.info({ tweetId: response.data?.id, type: tweet.type }, 'Tweet posted');

  // Record in state
  recordPosted(state, tweet);
  saveState(state);

  log.info('State saved — pipeline complete');
}

main().catch((err) => {
  log.error({ error: err.message }, 'Pipeline failed');
  process.exit(1);
});
