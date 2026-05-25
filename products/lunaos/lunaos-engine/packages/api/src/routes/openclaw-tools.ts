/**
 * OpenClaw Tool Routes — /openclaw/tools/*
 *
 * Native OpenClaw tool endpoints that mirror the plugin's tool API.
 * These allow any client (CLI, dashboard, external plugin, Gateway)
 * to invoke LunaOS agent tools using the OpenClaw-compatible interface.
 *
 * Endpoints:
 *   GET    /openclaw/tools              — list all available tools
 *   POST   /openclaw/tools/run          — execute luna_run tool
 *   POST   /openclaw/tools/chain        — execute luna_chain tool
 *   POST   /openclaw/tools/search       — execute luna_search tool
 *   POST   /openclaw/tools/index        — execute luna_index tool
 *   POST   /openclaw/tools/execute_code — sandbox code execution
 *   GET    /openclaw/tools/agents       — list all available agents
 *   GET    /openclaw/tools/chains       — list all chain presets
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { listPersonas } from '../data/personas';
import { getAgentTier } from '../data/agent-tiers';
import { listPresetChains } from '../data/preset-chains';
import { getToolRegistry } from '../services/openclaw-service';
import { runToolRoute } from './openclaw-tools-run';
import { chainToolRoute } from './openclaw-tools-chain';
import { searchToolRoute } from './openclaw-tools-search';
import { indexToolRoute } from './openclaw-tools-index';
import { executeCodeRoute } from './openclaw-tools-execute';

export const openclawToolRoutes = new Hono<{ Bindings: Env }>();

// Mount tool-specific routes
openclawToolRoutes.route('/run', runToolRoute);
openclawToolRoutes.route('/chain', chainToolRoute);
openclawToolRoutes.route('/search', searchToolRoute);
openclawToolRoutes.route('/index', indexToolRoute);
openclawToolRoutes.route('/execute_code', executeCodeRoute);

// GET /openclaw/tools — List all available tools
openclawToolRoutes.get('/', (c) => {
    const tools = getToolRegistry();
    return c.json({
        tools, total: tools.length,
        protocol: 'openclaw-compatible', version: '0.3.0',
        docs: 'https://docs.lunaos.ai/openclaw',
    });
});

// GET /openclaw/tools/agents — List all available agents
openclawToolRoutes.get('/agents', (c) => {
    const agents = listPersonas().map(p => ({
        slug: p.slug, name: p.name, category: p.category,
        tier: getAgentTier(p.slug),
    }));
    return c.json({
        agents, total: agents.length,
        free: agents.filter(a => a.tier === 'free').length,
        pro: agents.filter(a => a.tier === 'pro').length,
    });
});

// GET /openclaw/tools/chains — List all chain presets
openclawToolRoutes.get('/chains', (c) => {
    const presets = listPresetChains();
    return c.json({ presets, total: presets.length });
});
