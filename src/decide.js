import { logger } from './logger.js';

const log = logger.child({ module: 'decide' });

/**
 * Decide whether this run should post an evergreen or trending tweet.
 *
 * @param {object} strategy - config/strategy.json contents
 * @returns {'evergreen' | 'trending'}
 */
export function decideType(strategy) {
  const roll = Math.random();
  const type = roll < strategy.evergreenWeight ? 'evergreen' : 'trending';
  log.info({ roll: roll.toFixed(3), threshold: strategy.evergreenWeight, decision: type }, 'Content type decided');
  return type;
}
