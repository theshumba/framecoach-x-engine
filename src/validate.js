import { logger } from './logger.js';

const log = logger.child({ module: 'validate' });

const BANNED_PHRASES = [
  "in today's rapidly evolving",
  "let's dive in",
  "game-changer",
  "game changer",
  "unlock the power",
  "in the ever-changing landscape",
  "revolutionize",
  "it's no secret that",
  "at the end of the day",
  "leverage synergies",
  "paradigm shift",
  "move the needle",
  "deep dive",
  "circle back",
  "low-hanging fruit",
  "thought leader",
  "disruptive innovation",
  "synergistic approach",
  "cutting-edge solution",
  "best-in-class",
  "next-level",
];

/**
 * Validate a tweet before posting.
 *
 * @param {string} text - Tweet text
 * @param {string[]} recentTexts - Last 20 posted tweet texts for duplicate check
 * @returns {{ pass: boolean, failures: string[] }}
 */
export function validateTweet(text, recentTexts = []) {
  const failures = [];

  // Gate 1: Length
  if (text.length > 280) {
    failures.push(`Too long: ${text.length} chars (max 280)`);
  }

  // Gate 2: AI filler phrases
  const lower = text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      failures.push(`Banned phrase: "${phrase}"`);
    }
  }

  // Gate 3: Hashtag check
  if (!/#\w+/.test(text)) {
    failures.push('Missing hashtag');
  }

  // Gate 4: Duplicate check (dice coefficient)
  for (const recent of recentTexts) {
    const similarity = diceCoefficient(text, recent);
    if (similarity >= 0.6) {
      failures.push(`Too similar to recent tweet (similarity: ${similarity.toFixed(3)})`);
      break;
    }
  }

  const result = { pass: failures.length === 0, failures };

  if (!result.pass) {
    log.warn({ failures }, 'Tweet failed validation');
  } else {
    log.info({ chars: text.length }, 'Tweet passed validation');
  }

  return result;
}

/**
 * Dice coefficient similarity between two strings.
 * Returns 0.0 (completely different) to 1.0 (identical).
 */
function diceCoefficient(a, b) {
  const bigramsA = bigrams(a.toLowerCase());
  const bigramsB = bigrams(b.toLowerCase());

  if (bigramsA.size === 0 && bigramsB.size === 0) return 1.0;
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0.0;

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }

  return (2.0 * intersection) / (bigramsA.size + bigramsB.size);
}

function bigrams(str) {
  const set = new Set();
  for (let i = 0; i < str.length - 1; i++) {
    set.add(str.slice(i, i + 2));
  }
  return set;
}
