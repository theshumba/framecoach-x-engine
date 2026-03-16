import { readFileSync } from 'fs';
import { logger } from './logger.js';

const log = logger.child({ module: 'evergreen' });

/**
 * Pick a random unposted evergreen tweet from the bank.
 * Manages cycle resets with cooldown to avoid quick repeats.
 *
 * @param {object} state - The posted-log state object (mutated in place)
 * @param {object} strategy - The strategy config
 * @returns {{ text: string, index: number, type: 'evergreen' }}
 */
export function pickEvergreen(state, strategy) {
  const bank = JSON.parse(readFileSync('tweets/evergreen-bank.json', 'utf-8'));
  const totalTweets = bank.length;
  const posted = new Set(state.evergreen.posted_indices);

  log.info({ total: totalTweets, posted: posted.size, cycle: state.evergreen.cycle }, 'Picking evergreen tweet');

  // Find available (unposted) indices
  let available = [];
  for (let i = 0; i < totalTweets; i++) {
    if (!posted.has(i)) available.push(i);
  }

  // Cycle reset if all posted
  if (available.length === 0) {
    log.info({ cycle: state.evergreen.cycle }, 'All tweets posted — resetting cycle');
    state.evergreen.cycle += 1;

    // Cooldown: exclude last N posted to avoid quick repeats
    const cooldown = strategy.evergreenCooldownCount || 10;
    const recentlyPosted = new Set(
      state.evergreen.posted_indices.slice(-cooldown)
    );

    state.evergreen.posted_indices = [];

    available = [];
    for (let i = 0; i < totalTweets; i++) {
      if (!recentlyPosted.has(i)) available.push(i);
    }

    // Fallback if cooldown is larger than bank
    if (available.length === 0) {
      available = Array.from({ length: totalTweets }, (_, i) => i);
    }
  }

  // Random pick
  const index = available[Math.floor(Math.random() * available.length)];
  const tweet = bank[index];

  // Update state
  state.evergreen.posted_indices.push(index);

  log.info({ index, chars: tweet.text.length }, 'Evergreen tweet selected');

  return { text: tweet.text, index, type: 'evergreen' };
}
