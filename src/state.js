import { readFileSync, writeFileSync } from 'fs';

const STATE_PATH = 'state/posted-log.json';

/**
 * Load the posted-log state.
 * @returns {object}
 */
export function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return {
      evergreen: { posted_indices: [], cycle: 1 },
      trending: { recent_texts: [] },
      last_posted: null,
    };
  }
}

/**
 * Save the posted-log state.
 * @param {object} state
 */
export function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

/**
 * Record a posted tweet in state.
 * @param {object} state - State object (mutated)
 * @param {object} tweet - { text, type, index?, topic? }
 */
export function recordPosted(state, tweet) {
  state.last_posted = new Date().toISOString();

  if (tweet.type === 'trending') {
    state.trending.recent_texts.push(tweet.text);
    // Keep only last 20
    if (state.trending.recent_texts.length > 20) {
      state.trending.recent_texts = state.trending.recent_texts.slice(-20);
    }
  }
  // Evergreen state is updated in pickEvergreen()
}
