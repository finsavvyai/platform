/**
 * FinSavvyAI LLM Gateway — Cloudflare Worker v5.0
 *
 * Features:
 *   - Direct LLM API calls (OpenAI, Anthropic, Ollama) from the edge
 *   - Customer API key authentication (KV-backed)
 *   - Tier-based rate limiting (free: 100rpm, pro: 1000rpm, unlimited)
 *   - Admin key management endpoints
 *   - Apple HIG dashboard at /dashboard, Chat UI at /chat
 *   - Custom domain: llm.finsavvyai.com
 *
 * Secrets: OPENAI_API_KEY, ANTHROPIC_API_KEY, OLLAMA_BASE_URL, ADMIN_SECRET
 * KV: API_KEYS, RATE_LIMIT
 */

import { handleRequest } from "./router.js";

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};
