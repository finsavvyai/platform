/**
 * TenantIQ AI Engine — Shared Types
 */

import type { Hono } from 'hono';

export type Bindings = {
	// OpenAI-compatible providers
	OPENAI_API_KEY?: string;
	GROQ_API_KEY?: string;
	MISTRAL_API_KEY?: string;
	TOGETHER_API_KEY?: string;
	GEMINI_API_KEY?: string;
	// Anthropic (native API)
	ANTHROPIC_API_KEY?: string;
	// OpenClaw / LunaOS backend
	OPENCLAW_URL?: string;
	OPENCLAW_SERVICE_KEY?: string;
	// Environment
	ENVIRONMENT?: string;
};

export type AppType = Hono<{ Bindings: Bindings }>;
