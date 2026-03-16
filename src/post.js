import OAuth from 'oauth-1.0a';
import { createHmac } from 'crypto';
import { logger } from './logger.js';

const log = logger.child({ module: 'post' });

/**
 * Post a tweet to X using OAuth 1.0a + API v2.
 *
 * @param {string} text - Tweet text (max 280 chars)
 * @param {object} retryConfig - { attempts, baseDelayMs }
 * @returns {Promise<object>} X API response data
 */
export async function postTweet(text, retryConfig = {}) {
  const { attempts = 3, baseDelayMs = 2000 } = retryConfig;

  if (process.env.DRY_RUN === 'true') {
    log.info({ text, chars: text.length }, 'DRY RUN — tweet not posted');
    return { data: { id: 'dry-run-id', text } };
  }

  const oauth = new OAuth({
    consumer: {
      key: process.env.X_API_KEY,
      secret: process.env.X_API_SECRET,
    },
    signature_method: 'HMAC-SHA1',
    hash_function: (baseString, key) =>
      createHmac('sha1', key).update(baseString).digest('base64'),
  });

  const token = {
    key: process.env.X_ACCESS_TOKEN,
    secret: process.env.X_ACCESS_SECRET,
  };

  const url = 'https://api.x.com/2/tweets';
  const body = JSON.stringify({ text });

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const requestData = { url, method: 'POST' };
    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...authHeader,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (response.ok) {
        const data = await response.json();
        log.info({ tweetId: data.data?.id }, 'Tweet posted successfully');
        return data;
      }

      const errorBody = await response.text();
      const status = response.status;

      // Don't retry on auth errors (4xx except 429)
      if (status >= 400 && status < 500 && status !== 429) {
        throw new Error(`X API error ${status}: ${errorBody}`);
      }

      log.warn({ status, attempt, errorBody }, 'Retryable X API error');
    } catch (err) {
      if (attempt >= attempts || (err.message && err.message.startsWith('X API error 4'))) {
        throw err;
      }
      log.warn({ error: err.message, attempt }, 'Request failed, retrying');
    }

    // Exponential backoff
    const delay = baseDelayMs * Math.pow(2, attempt - 1);
    log.info({ delayMs: delay, attempt }, 'Backing off before retry');
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  throw new Error('All retry attempts exhausted — tweet not posted');
}
