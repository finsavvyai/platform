/**
 * Provider status routes — GET /providers/status
 * Shows availability of all LLM + TTS providers (cloud and local).
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { getLocalProviderStatus } from '../services/local-providers';

export const providerRoutes = new Hono<{ Bindings: Env }>();

/** GET /providers/status — show all provider availability */
providerRoutes.get('/status', async (c) => {
  const cloud = {
    anthropic: !!c.env.ANTHROPIC_API_KEY,
    openai: !!c.env.OPENAI_API_KEY,
    deepseek: !!c.env.DEEPSEEK_API_KEY,
    clawGateway: !!(c.env.CLAW_API_KEY && c.env.CLAW_ENDPOINT),
    workersAI: !!c.env.AI,
  };

  // Local providers only checked in development
  let local = { llamafile: { available: false }, voicebox: { available: false } };
  if (c.env.ENVIRONMENT === 'development') {
    local = await getLocalProviderStatus() as any;
  }

  return c.json({
    cloud,
    local,
    features: {
      agentBooster: true,
      reasoningBank: c.env.REASONING_BANK_ENABLED !== 'false',
      contextPacking: true,
      smartRouting: true,
      hybridSearch: true,
      credits: true,
    },
  });
});
