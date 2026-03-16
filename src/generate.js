import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'fs';
import { logger } from './logger.js';
import { validateTweet } from './validate.js';

const log = logger.child({ module: 'generate' });

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a trending tweet from RSS articles using Gemini.
 *
 * @param {Array} articles - Filtered RSS articles
 * @param {string[]} recentTexts - Recent tweet texts for duplicate check
 * @param {object} strategy - config/strategy.json contents
 * @returns {Promise<{ text: string, topic: string, type: 'trending' } | null>}
 */
export async function generateTrendingTweet(articles, recentTexts, strategy) {
  const brandVoice = readFileSync('config/brand-voice.md', 'utf-8');
  const rateLimitDelay = strategy.rateLimitDelayMs || 7000;
  const maxRetries = strategy.maxDuplicateRetries || 2;

  // Format articles for prompt
  const articleList = articles.slice(0, 15).map((a, i) =>
    `[${i}] "${a.title}" — ${a.sourceName} (${a.pubDate?.slice(0, 10) || 'unknown'})\n    ${a.contentSnippet.slice(0, 200)}`
  ).join('\n\n');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const prompt = `${brandVoice}

---

TASK: You are writing a tweet for @framecoachapp on X (Twitter).

Below are recent film/filmmaking news articles. Pick the ONE most relevant to independent filmmakers, videographers, or film students. Then write a single tweet that:

1. References the news topic (what happened, who's involved)
2. Ties it back to a filmmaking TECHNIQUE, SKILL, or LESSON that the audience can learn from
3. Optionally mentions FrameCoach (https://framecoach.io) if it fits naturally — DO NOT force it
4. Includes 1-2 relevant hashtags
5. MUST be under 260 characters (STRICT LIMIT — count carefully, tweets over 280 chars are rejected)
6. Sounds like a working filmmaker sharing insights, NOT a news bot

RECENT ARTICLES:
${articleList}

${attempt > 1 ? 'IMPORTANT: Your previous tweet was too similar to a recent post. Write something DIFFERENT this time.' : ''}

Respond with ONLY a JSON object:
{
  "topic": "brief topic description",
  "tweet": "the actual tweet text"
}`;

    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      let result;
      try {
        result = JSON.parse(response.text);
      } catch (err) {
        log.error({ error: err.message, raw: response.text?.slice(0, 500) }, 'Failed to parse Gemini JSON');
        return null;
      }

      const { tweet, topic } = result;

      if (!tweet || !topic) {
        log.warn('Gemini returned empty tweet or topic');
        return null;
      }

      log.info({ topic, chars: tweet.length, attempt }, 'Gemini generated tweet');

      // Validate
      const validation = validateTweet(tweet, recentTexts);

      if (validation.pass) {
        return { text: tweet, topic, type: 'trending' };
      }

      log.warn({ failures: validation.failures, attempt }, 'Generated tweet failed validation');

      if (attempt < maxRetries) {
        await delay(rateLimitDelay);
      }
    } catch (err) {
      log.error({ error: err.message, attempt }, 'Gemini API call failed');
      return null;
    }
  }

  log.warn('All trending generation attempts failed — returning null');
  return null;
}
