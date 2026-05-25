/**
 * HTTP EngineClient — one per engine endpoint.
 *
 * Contract:
 *   - POST {url}/v1/score with JSON body == DecisionRequest
 *   - Bearer JWT in Authorization header (per-call signed via injected JwtSigner)
 *   - Hard timeout via AbortController (default 200 ms)
 *   - Non-2xx ⇒ EngineResult{ error: "http_<status>", risk_score: 0, ... }
 *   - Network error ⇒ EngineResult{ error: "network", ... }
 *   - Timeout ⇒ EngineResult{ error: "timeout", ... }
 *   - MUST NOT throw — orchestrator depends on `Promise.all` always settling.
 *
 * No real engine URLs hard-coded. URL + timeout injected via config.
 */

import type {
  DecisionRequest,
  EngineClient,
  EngineEndpointConfig,
  EngineResult,
  JwtSigner,
} from "./types.js";

type FetchLike = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

export interface CreateEngineClientDeps {
  readonly config: EngineEndpointConfig;
  readonly signer: JwtSigner;
  readonly fetchImpl?: FetchLike;
  readonly now?: () => number;
}

interface EngineResponseBody {
  readonly risk_score?: unknown;
  readonly explanations?: unknown;
}

const asNumber = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const asExplanations = (v: unknown): readonly string[] => {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
};

const buildErrorResult = (
  engine: EngineClient["engine"],
  error: string,
  latencyMs: number,
): EngineResult => ({
  engine,
  risk_score: 0,
  explanations: [`engine.${engine}.${error}`],
  latency_ms: latencyMs,
  error,
});

export const createEngineClient = (
  deps: CreateEngineClientDeps,
): EngineClient => {
  const { config, signer } = deps;
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const now = deps.now ?? (() => Date.now());

  return {
    engine: config.engine,
    async score(
      request: DecisionRequest,
      parentSignal: AbortSignal,
    ): Promise<EngineResult> {
      const started = now();
      const localController = new AbortController();
      const timeoutId: ReturnType<typeof setTimeout> = setTimeout(
        () => localController.abort(),
        config.timeoutMs,
      );
      const onParentAbort = (): void => localController.abort();
      parentSignal.addEventListener("abort", onParentAbort, { once: true });

      try {
        const token = await signer.sign({
          tenant_id: request.tenant_id,
          engine: config.engine,
          iat: Math.floor(started / 1000),
        });
        const res = await fetchImpl(`${config.url}/v1/score`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(request),
          signal: localController.signal,
        });
        const latency = now() - started;

        if (!res.ok) {
          return buildErrorResult(
            config.engine,
            `http_${res.status}`,
            latency,
          );
        }
        const body = (await res.json()) as EngineResponseBody;
        return {
          engine: config.engine,
          risk_score: asNumber(body.risk_score, 0),
          explanations: asExplanations(body.explanations),
          latency_ms: latency,
        };
      } catch (err) {
        const latency = now() - started;
        const aborted =
          (err instanceof Error && err.name === "AbortError") ||
          localController.signal.aborted;
        return buildErrorResult(
          config.engine,
          aborted ? "timeout" : "network",
          latency,
        );
      } finally {
        clearTimeout(timeoutId);
        parentSignal.removeEventListener("abort", onParentAbort);
      }
    },
  };
};
