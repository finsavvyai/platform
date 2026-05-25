/**
 * Barrel re-exports for competitor comparison data.
 * Per-competitor content lives in ./data/<slug>.ts to respect the
 * 200-line-per-file portfolio rule and keep content editable in isolation.
 */
export type { CellValue, FeatureRow, PricingTier, VsPageData } from './vs-types';
export { QESTRO_PRICING } from './vs-types';
export { CYPRESS_DATA } from './data/cypress';
export { PLAYWRIGHT_DATA } from './data/playwright';
export { TESTIM_DATA } from './data/testim';

import type { VsPageData } from './vs-types';
import { CYPRESS_DATA } from './data/cypress';
import { PLAYWRIGHT_DATA } from './data/playwright';
import { TESTIM_DATA } from './data/testim';

export const VS_DATA_BY_SLUG: Record<string, VsPageData> = {
  cypress: CYPRESS_DATA,
  playwright: PLAYWRIGHT_DATA,
  testim: TESTIM_DATA,
};
