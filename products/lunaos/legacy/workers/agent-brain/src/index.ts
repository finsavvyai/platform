import { safeJson, json, badRequest, notFound } from "./utils";
import type { Env } from "./providers";
import { callMythicMultiProvider, callMultiProvider, Prompts } from "./providers";
import { handleLemonSqueezyWebhook, verifySubscription } from "./payments";
import type {
  AgentPlan,
  MythicStory,
  AnalysisRequest,
  LLMResponse,
  MemoryRequest,
  LicenseRequest
} from "./types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (path === "/health") {
      return json({ status: "healthy", timestamp: new Date().toISOString() });
    }

    // ============== PAYMENT ROUTES ==============

    // Lemon Squeezy webhook handler
    if (request.method === "POST" && path === "/webhooks/lemonsqueezy") {
      return handleLemonSqueezyWebhook(request, env);
    }

    // Subscription verification (for extension to check subscription status)
    if (request.method === "POST" && path === "/v1/subscription/verify") {
      return verifySubscription(request, env);
    }

    // ============================================

    // AI Plan
    if (request.method === "POST" && path === "/v1/plan") {
      const body = await safeJson<any>(request);
      try {
        const result = await callMultiProvider<{ plan: AgentPlan }>(
          {
            systemPrompt: Prompts.Plan.system,
            userPrompt: Prompts.Plan.user(body.summary || "Refactor workspace", body.target || "workspace")
          },
          { env, fetchImpl: fetch }
        );
        return json(result);
      } catch (err: any) {
        return json({ error: String(err) }, { status: 500 });
      }
    }

    // Mythic
    if (request.method === "POST" && path === "/v1/mythic") {
      const story = await safeJson<MythicStory>(request);
      if (!story.title || !story.text) {
        return badRequest("Missing 'title' or 'text' in story");
      }
      try {
        const output = await callMythicMultiProvider(story, { env, fetchImpl: fetch });
        return json(output);
      } catch (err: any) {
        return json({ error: String(err) }, { status: 500 });
      }
    }

    // Dream sub-paths
    if (path === "/v1/dream/status") {
      return json({ id: url.searchParams.get("id"), status: "completed", summary: "Refactor finished successfully." });
    }
    if (path === "/v1/dream/recent") {
      return json([]);
    }

    // Analysis / Specialized LLM modes (including legacy aliases)
    const modeMappings: Record<string, string> = {
      "/v1/dream": "Dream",
      "/v1/dream/schedule": "Dream",
      "/v1/autopsy": "Autopsy",
      "/autopsy.analyze": "Autopsy",
      "/v1/prophecy": "Prophecy",
      "/prophecy/generate": "Prophecy",
      "/v1/parallel-universe": "ParallelUniverse",
      "/v1/universe": "ParallelUniverse",
      "/v1/zen": "Zen"
    };

    const targetPrompt = modeMappings[path];

    if (request.method === "POST" && targetPrompt) {
      const body = await safeJson<AnalysisRequest>(request);
      try {
        const prompt = (Prompts as any)[targetPrompt];

        const result = await callMultiProvider<LLMResponse>(
          {
            systemPrompt: prompt.system,
            userPrompt: prompt.user(body.target, body.context || body.history?.join("\n"))
          },
          { env, fetchImpl: fetch }
        );
        return json(result);
      } catch (err: any) {
        return json({ error: String(err) }, { status: 500 });
      }
    }

    // Memory
    if (request.method === "POST" && path === "/v1/memory/get") {
      const body = await safeJson<MemoryRequest>(request);
      return json({ memory: { key: body.key, value: null, scope: body.scope } });
    }

    if (request.method === "POST" && path === "/v1/memory/put") {
      const body = await safeJson<MemoryRequest>(request);
      return json({ success: true, memory: body });
    }

    // License
    if (request.method === "POST" && path === "/v1/license/validate") {
      const body = await safeJson<LicenseRequest>(request);
      // Basic validation: any key starting with 'LF-' is valid for MVP
      const isValid = body.key?.startsWith("LF-");
      return json({
        valid: isValid,
        plan: isValid ? "premium" : "free",
        features: isValid ? ["galaxy", "guardian", "timetravel", "mythic", "dream", "autopsy", "prophecy", "parallel-universe", "aura", "zen"] : []
      });
    }

    return notFound();
  }
};

