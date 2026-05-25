import type { MythicStory, MythicModelOutput, LLMResponse } from "./types";

export interface ProviderContext {
  env: Env;
  fetchImpl: typeof fetch;
}

export interface Env {
  OPENAI_API_KEY?: string;
  OPENAI_API_BASE?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_API_BASE?: string;
  ZAI_API_KEY?: string;
  ZAI_API_BASE?: string;
  LUNAFORGE_PROVIDERS?: string;
  LUNAFORGE_MYTHIC_PROVIDERS?: string;
  // Payment system
  SUBSCRIPTIONS?: KVNamespace;
  LEMONSQUEEZY_SIGNING_SECRET?: string;
  LEMONSQUEEZY_API_KEY?: string;
}

export type LLMParams = {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
};

/**
 * Generic multi-provider caller
 */
export async function callMultiProvider<T = any>(
  params: LLMParams,
  ctx: ProviderContext
): Promise<T> {
  const order = (ctx.env.LUNAFORGE_PROVIDERS || "anthropic,openai")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const errors: string[] = [];

  for (const provider of order) {
    try {
      if (provider === "anthropic") {
        return await callAnthropic<T>(params, ctx);
      }
      if (provider === "openai") {
        return await callOpenAI<T>(params, ctx);
      }
      if (provider === "zai") {
        return await callZai<T>(params, ctx);
      }
    } catch (err: any) {
      errors.push(provider + ": " + String(err));
      continue;
    }
  }

  throw new Error("All LLM providers failed: " + errors.join(" | "));
}

/**
 * Legacy wrapper for Mythic
 */
export async function callMythicMultiProvider(
  story: MythicStory,
  ctx: ProviderContext
): Promise<MythicModelOutput> {
  return callMultiProvider<MythicModelOutput>(
    {
      systemPrompt: "You are an expert software architect. Convert the story into architecture, a mermaid diagram, and code files. Respond in strict JSON with keys: architecture, diagram, files (array of {path, content}).",
      userPrompt: `Story title: ${story.title}\nStory:\n${story.text}`,
      temperature: 0.4
    },
    ctx
  );
}

async function callOpenAI<T>(params: LLMParams, ctx: ProviderContext): Promise<T> {
  if (!ctx.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  const base = ctx.env.OPENAI_API_BASE || "https://api.openai.com/v1";

  const res = await ctx.fetchImpl(base + "/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": "Bearer " + ctx.env.OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt }
      ],
      temperature: params.temperature ?? 0.7,
      response_format: { type: "json_object" }
    })
  });

  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);

  const data = await res.json() as any;
  const content = data.choices?.[0]?.message?.content;
  return JSON.parse(content) as T;
}

async function callAnthropic<T>(params: LLMParams, ctx: ProviderContext): Promise<T> {
  if (!ctx.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  const base = ctx.env.ANTHROPIC_API_BASE || "https://api.anthropic.com/v1";

  const res = await ctx.fetchImpl(base + "/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ctx.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 4096,
      temperature: params.temperature ?? 0.7,
      system: params.systemPrompt + "\nOutput strict JSON only.",
      messages: [{ role: "user", content: params.userPrompt }]
    })
  });

  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);

  const data = await res.json() as any;
  const content = data.content;
  let jsonText = "";

  if (Array.isArray(content)) {
    const textPart = content.find((p: any) => p.type === "text");
    jsonText = textPart?.text || "";
  }

  // Extract JSON if it's wrapped in backticks
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (jsonMatch) jsonText = jsonMatch[0];

  return JSON.parse(jsonText) as T;
}

async function callZai<T>(params: LLMParams, ctx: ProviderContext): Promise<T> {
  if (!ctx.env.ZAI_API_KEY || !ctx.env.ZAI_API_BASE) throw new Error("ZAI_API_KEY or ZAI_API_BASE not set");

  const res = await ctx.fetchImpl(ctx.env.ZAI_API_BASE + "/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": "Bearer " + ctx.env.ZAI_API_KEY
    },
    body: JSON.stringify({
      model: "zai-latest",
      messages: [
        { role: "system", content: params.systemPrompt + " Output strict JSON." },
        { role: "user", content: params.userPrompt }
      ],
      temperature: params.temperature ?? 0.7
    })
  });

  if (!res.ok) throw new Error(`Zai error ${res.status}: ${await res.text()}`);

  const data = await res.json() as any;
  const content = data.choices?.[0]?.message?.content;
  return JSON.parse(content) as T;
}

/**
 * Prompts for different analysis modes
 */
export const Prompts = {
  Dream: {
    system: "You are a creative systems architect. Visualize the final state of the user's project evolution. Output JSON: { analysis, recommendations, diagram, files }.",
    user: (target: string, context?: string) => `Target: ${target}\nContext: ${context || "Full workspace"}`
  },
  Autopsy: {
    system: "You are a forensic software engineer. Analyze the provided context for root causes of failures or architectural debt. Output JSON: { analysis, recommendations, diagram }.",
    user: (target: string, context: string) => `Target: ${target}\nAvailable Data: ${context}`
  },
  Prophecy: {
    system: "You are a predictive analytics engine for codebases. Forecast potential future issues, scaling bottlenecks, or maintenance risks based on current trends. Output JSON: { analysis, recommendations, prediction }.",
    user: (target: string, history: string[]) => `Target: ${target}\nCommit History Summary: ${history.join("\n")}`
  },
  ParallelUniverse: {
    system: "You are a scenario simulation expert. Simulate 'what-if' scenarios based on different architectural choices. Output JSON: { analysis, recommendations, simulations: [{scenario, pros, cons}] }.",
    user: (target: string, scenario: string) => `Target: ${target}\nScenario to Simulate: ${scenario}`
  },
  Plan: {
    system: "You are a senior project manager and tech lead. Generate a multi-step execution plan to achieve the user's goal. Output JSON: { plan: { id, summary, target, steps: [{id, title, description, status: 'pending'}] } }.",
    user: (goal: string, target: string) => `Goal: ${goal}\nTarget Space: ${target}`
  },
  Zen: {
    system: "You are a focus coach and tech strategist. Based on the current project state, provide a concise summary of work and the absolute next best step to maintain momentum. Output JSON: { summary, nextStep }.",
    user: (target: string, context?: string) => `Project: ${target}\nContext: ${context || "Full workspace"}`
  }
};

