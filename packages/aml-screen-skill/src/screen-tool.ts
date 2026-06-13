import {
  isListId,
  type ListId,
  type ScreenRequest,
  type ScreenResponse,
} from "@finsavvyai/aml-screen-client";
import { checkAndConsume, type GateDecision, type GateDeps } from "./gate.js";
import {
  type CustomerResolver,
  type ScreenToolTextResult,
} from "./types.js";

export interface ScreenClientLike {
  screen(request: ScreenRequest): Promise<ScreenResponse>;
}

export interface ScreenToolDeps {
  gate: GateDeps;
  client: ScreenClientLike;
  resolveCustomerId: CustomerResolver;
}

export const SCREEN_TOOL = {
  name: "aml_screen",
  description:
    "Screen a name against AMLIQ sanctions/PEP lists (OFAC, EU, UN, UK OFSI) " +
    "with multi-layer matching. Returns matches, confidence, and a risk " +
    "level. Metered against the caller's billing entitlement.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Entity name to screen." },
      lists: {
        type: "array",
        items: { type: "string", enum: ["ofac", "eu_fsf", "un", "uk_ofsi"] },
        description: "Restrict to these list sources (default: all).",
      },
      pep: { type: "boolean", description: "Include PEP matching." },
      threshold: {
        type: "number",
        description: "Match confidence threshold, 0..1.",
      },
    },
    required: ["name"],
  },
} as const;

type ParsedArgs = { request: ScreenRequest } | { error: string };

export async function handleScreen(
  deps: ScreenToolDeps,
  rawArgs: Record<string, unknown>,
): Promise<ScreenToolTextResult> {
  const parsed = parseArgs(rawArgs);
  if ("error" in parsed) return err(parsed.error);

  const customerId = deps.resolveCustomerId();
  if (customerId === null) {
    return err(
      "No billing identity for this request; the skill is not configured " +
        "with a customer.",
    );
  }

  const decision = await checkAndConsume(deps.gate, customerId);
  if (!decision.allowed) return err(denialMessage(decision));

  let res: ScreenResponse;
  try {
    res = await deps.client.screen(parsed.request);
  } catch (e) {
    return err(`Screening failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { content: [{ type: "text", text: formatResult(res, decision.remaining) }] };
}

function parseArgs(raw: Record<string, unknown>): ParsedArgs {
  const name = raw.name;
  if (typeof name !== "string" || name.trim() === "") {
    return { error: "`name` is required and must be a non-empty string." };
  }
  const request: ScreenRequest = { name: name.trim() };

  if (raw.lists !== undefined) {
    if (!Array.isArray(raw.lists)) return { error: "`lists` must be an array." };
    const lists: ListId[] = [];
    for (const l of raw.lists) {
      if (typeof l !== "string" || !isListId(l)) {
        return { error: `Unknown list id: ${String(l)}` };
      }
      lists.push(l);
    }
    request.lists = lists;
  }
  if (raw.pep !== undefined) {
    if (typeof raw.pep !== "boolean") return { error: "`pep` must be a boolean." };
    request.pep = raw.pep;
  }
  if (raw.threshold !== undefined) {
    if (
      typeof raw.threshold !== "number" ||
      raw.threshold < 0 ||
      raw.threshold > 1
    ) {
      return { error: "`threshold` must be a number between 0 and 1." };
    }
    request.threshold = raw.threshold;
  }
  return { request };
}

function denialMessage(d: Extract<GateDecision, { allowed: false }>): string {
  if (d.reason === "no_entitlement") {
    return (
      "Payment required: no active AMLIQ screening entitlement for this " +
      "customer. Subscribe to a plan that grants `aml.screen`."
    );
  }
  return (
    `Quota exceeded: the screening limit of ${String(d.limit)} for the ` +
    "current period has been reached. Upgrade the plan or wait for the next " +
    "period."
  );
}

function formatResult(
  res: ScreenResponse,
  remaining: number | "unlimited",
): string {
  const quota =
    remaining === "unlimited" ? "unlimited" : `${String(remaining)} remaining`;
  const head =
    `Risk: ${res.riskLevel.toUpperCase()} · ${String(res.matches.length)} ` +
    `match(es) · ${String(res.latencyMs)}ms · quota: ${quota}`;
  if (res.matches.length === 0) {
    return `${head}\nNo matches for "${res.query}".`;
  }
  const lines = res.matches.map(
    (m) =>
      `• ${m.entityName} (${(m.confidence * 100).toFixed(1)}%) — lists: ` +
      `${m.lists.join(", ")} — PEP: ${m.pepStatus}`,
  );
  return `${head}\n${lines.join("\n")}`;
}

function err(text: string): ScreenToolTextResult {
  return { content: [{ type: "text", text }], isError: true };
}
