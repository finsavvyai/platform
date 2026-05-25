/**
 * Module-level singleton wiring.
 *
 * Phase 6 ships the in-memory adapter for dev. Phase 6.1 will branch
 * on `process.env.TOKENFORGE_STORE` (or platform binding presence) to
 * pick the Drizzle/D1 adapter when available.
 */

import { MemoryDashboardStore } from './store-mem.js';
import type { DashboardStore } from './store.js';

export const DEMO_TENANT_ID = 'tnt_demo';

const memory = new MemoryDashboardStore();
memory.seedDemoData(DEMO_TENANT_ID);

export function getStore(): DashboardStore {
  return memory;
}
