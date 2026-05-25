// Remote OPA client — HTTPS bridge to an OPA server running Rego natively.
//
// For customers who already run an Open Policy Agent cluster (Norlys has
// one for Kubernetes admission control), PushCI can delegate policy
// evaluation by POSTing the run context to:
//
//   POST ${opaUrl}/v1/data/pushci/allow
//   Content-Type: application/json
//   Authorization: Bearer ${token}
//
//   { "input": { ... } }
//
// OPA's decision response shape:
//
//   { "result": true }                         // allow
//   { "result": false }                        // deny (no reason)
//   { "result": { "allow": true } }            // object decision
//   { "result": { "allow": false,
//                 "denials": ["reason 1"] } }   // structured deny
//
// We normalise all of these into our { allow, denials } shape.

import type { PolicyDenial, PolicyEvaluation } from "./policy-engine";

export interface RemoteOpaOptions {
  opaUrl: string;
  token?: string;
  // Which data path to query. Defaults to "pushci/allow" per convention.
  // The full URL used is ${opaUrl}/v1/data/${dataPath}.
  dataPath?: string;
  // AbortSignal for timeouts / cancellations.
  signal?: AbortSignal;
}

function normaliseUrl(opaUrl: string, dataPath: string): string {
  const base = opaUrl.replace(/\/+$/, "");
  const path = dataPath.replace(/^\/+/, "");
  return `${base}/v1/data/${path}`;
}

function coerceDenials(result: unknown): PolicyDenial[] {
  if (!result || typeof result !== "object") return [];
  const r = result as Record<string, unknown>;
  const raw = r.denials ?? r.violations ?? r.reasons;
  if (!Array.isArray(raw)) return [];
  const denials: PolicyDenial[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      denials.push({ name: "opa", message: item });
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      denials.push({
        name: typeof obj.name === "string" ? obj.name : "opa",
        message: typeof obj.message === "string" ? obj.message : JSON.stringify(item),
      });
    }
  }
  return denials;
}

export function parseOpaResponse(payload: unknown): PolicyEvaluation {
  if (!payload || typeof payload !== "object") {
    return { allow: false, denials: [{ name: "opa", message: "empty OPA response" }], matched: [] };
  }
  const p = payload as Record<string, unknown>;
  const result = p.result;

  // Boolean form: { "result": true|false }
  if (typeof result === "boolean") {
    return {
      allow: result,
      denials: result ? [] : [{ name: "opa", message: "OPA returned false" }],
      matched: result ? ["opa"] : [],
    };
  }

  // Object form: { "result": { "allow": bool, "denials": [...] } }
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    const allow = r.allow === true;
    const denials = coerceDenials(r);
    if (!allow && denials.length === 0) {
      denials.push({ name: "opa", message: "OPA denied the request" });
    }
    return {
      allow,
      denials: allow ? [] : denials,
      matched: allow ? ["opa"] : [],
    };
  }

  // Undefined result means the query matched nothing in OPA — treat as deny.
  return {
    allow: false,
    denials: [{ name: "opa", message: "OPA returned no decision" }],
    matched: [],
  };
}

export async function evaluateRemote(
  input: unknown,
  opts: RemoteOpaOptions,
): Promise<PolicyEvaluation> {
  if (!opts.opaUrl) {
    throw new Error("opaUrl is required for remote OPA evaluation");
  }
  const url = normaliseUrl(opts.opaUrl, opts.dataPath ?? "pushci/allow");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ input }),
      signal: opts.signal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network error";
    return {
      allow: false,
      denials: [{ name: "opa", message: `remote OPA unreachable: ${msg}` }],
      matched: [],
    };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      allow: false,
      denials: [
        { name: "opa", message: `remote OPA HTTP ${res.status}: ${body.slice(0, 200)}` },
      ],
      matched: [],
    };
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return {
      allow: false,
      denials: [{ name: "opa", message: "remote OPA returned invalid JSON" }],
      matched: [],
    };
  }

  return parseOpaResponse(payload);
}
