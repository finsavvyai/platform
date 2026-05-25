/** Free-tier attribution string injected into prompt-response meta.
 *
 * Self-boosting growth loop: customer apps that surface the meta to their
 * end-users will display the ClawPipe brand whenever they use the free tier.
 * Paid tiers get clean responses (no attribution).
 */

import type { Tier } from './billing/types';

export const FREE_TIER_ATTRIBUTION =
  'Powered by ClawPipe — your AI pipeline. https://clawpipe.ai';

/** Returns the attribution string for free-tier projects, or null otherwise. */
export function attributionForTier(tier: Tier): string | null {
  return tier === 'free' ? FREE_TIER_ATTRIBUTION : null;
}
