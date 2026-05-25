/**
 * TenantIQ AI Engine — Cloudflare Worker
 *
 * Embedded from openhands-ai-engine (Apache-2.0 open source)
 * Extended with TenantIQ M365 security and license intelligence.
 *
 * Routes:
 *   GET  /                          — Service info
 *   GET  /health                    — Health check
 *
 *   --- TenantIQ M365 AI Routes ---
 *   POST /api/m365/ask              — Ask the AI about a tenant
 *   POST /api/m365/security-scan    — AI security posture analysis
 *   POST /api/m365/license-optimize — AI license waste analysis
 *   POST /api/m365/backup-analyze   — AI backup health analysis
 *   POST /api/m365/phishing-scan    — AI email phishing detection
 *   POST /api/m365/chain            — Multi-agent analysis chain
 *   GET  /api/m365/status           — AI engine status
 *
 *   --- Luna / OpenClaw Routes (from openhands-ai-engine) ---
 *   POST /api/luna/run              — Run a Luna agent
 *   POST /api/luna/chain            — Multi-agent chain
 *   POST /api/luna/search           — RAG semantic search
 *   GET  /api/luna/agents           — List available agents
 *   GET  /api/luna/channels         — List integration channels
 *   GET  /api/luna/status           — System status
 *
 *   --- Qestro Routes ---
 *   POST /api/qestro/generate-connector
 *
 *   --- PipeWarden Routes ---
 *   POST /api/pipewarden/analyze-error
 *
 *   --- QueryFlux Routes ---
 *   POST /api/queryflux/optimize
 *   POST /api/queryflux/generate-sql
 */

import { Hono } from 'hono';
import type { Bindings } from './types';
import { info } from './routes/info';
import { m365Ask } from './routes/m365-ask';
import { m365Security } from './routes/m365-security';
import { m365Backup } from './routes/m365-backup';
import { m365Phishing } from './routes/m365-phishing';
import { luna } from './routes/luna';
import { tools } from './routes/tools';
import { bridge } from './routes/bridge';

const app = new Hono<{ Bindings: Bindings }>();

// Mount all route modules
app.route('', info);
app.route('', m365Ask);
app.route('', m365Security);
app.route('', m365Backup);
app.route('', m365Phishing);
app.route('', luna);
app.route('', tools);
app.route('', bridge);

export default app;
