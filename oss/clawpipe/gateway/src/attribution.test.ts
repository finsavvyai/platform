/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { attributionForTier, FREE_TIER_ATTRIBUTION } from './attribution';

describe('attributionForTier', () => {
  it('returns the marketing string for free tier', () => {
    expect(attributionForTier('free')).toBe(FREE_TIER_ATTRIBUTION);
  });

  it.each(['dev', 'growth', 'scale', 'enterprise'] as const)(
    'returns null for paid tier %s',
    (tier) => {
      expect(attributionForTier(tier)).toBeNull();
    },
  );

  it('the attribution string is a single line with the brand and url', () => {
    expect(FREE_TIER_ATTRIBUTION).not.toContain('\n');
    expect(FREE_TIER_ATTRIBUTION).toContain('ClawPipe');
    expect(FREE_TIER_ATTRIBUTION).toContain('https://clawpipe.ai');
  });
});
