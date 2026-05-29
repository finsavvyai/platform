import type { ScreenRequest, ScreenResponse } from "./types.js";
import {
  isListId,
  isLayer,
  isRiskLevel,
  isPepStatus,
} from "./types.js";

export interface ScreenClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export class ScreenClientError extends Error {
  public readonly status?: number;
  public readonly bodyExcerpt?: string;

  public constructor(
    message: string,
    options?: { cause?: unknown; status?: number; bodyExcerpt?: string },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ScreenClientError";
    if (options?.status !== undefined) this.status = options.status;
    if (options?.bodyExcerpt !== undefined) this.bodyExcerpt = options.bodyExcerpt;
  }
}

export class ScreenTimeoutError extends ScreenClientError {
  public constructor(timeoutMs: number, cause?: unknown) {
    super(`Screen request timed out after ${String(timeoutMs)}ms`, { cause });
    this.name = "ScreenTimeoutError";
  }
}

export class ScreenClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number | undefined;

  public constructor(opts: ScreenClientOptions) {
    if (!opts.baseUrl) throw new ScreenClientError("baseUrl is required");
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs;
  }

  public async screen(request: ScreenRequest): Promise<ScreenResponse> {
    const url = `${this.baseUrl}/api/v1/screen/public-demo`;
    const controller = new AbortController();
    const timer = this.armTimer(controller);

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
    } catch (err) {
      if (timer) clearTimeout(timer);
      if (this.isAbort(err)) {
        throw new ScreenTimeoutError(this.timeoutMs ?? 0, err);
      }
      throw new ScreenClientError("Screen request failed", { cause: err });
    }
    if (timer) clearTimeout(timer);

    if (!res.ok) {
      const excerpt = await this.readExcerpt(res);
      throw new ScreenClientError(
        `Screen request returned HTTP ${String(res.status)}`,
        { status: res.status, bodyExcerpt: excerpt },
      );
    }

    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch (err) {
      throw new ScreenClientError("Screen response was not valid JSON", { cause: err });
    }

    return decodeScreenResponse(parsed);
  }

  private armTimer(controller: AbortController): ReturnType<typeof setTimeout> | undefined {
    if (this.timeoutMs === undefined) return undefined;
    return setTimeout(() => controller.abort(), this.timeoutMs);
  }

  private isAbort(err: unknown): boolean {
    if (this.timeoutMs === undefined) return false;
    if (err instanceof Error && err.name === "AbortError") return true;
    return false;
  }

  private async readExcerpt(res: Response): Promise<string> {
    try {
      const text = await res.text();
      return text.slice(0, 500);
    } catch {
      return "";
    }
  }
}

function decodeScreenResponse(raw: unknown): ScreenResponse {
  if (!isObject(raw)) throw new ScreenClientError("Response is not an object");
  const query = req(raw, "query", "string");
  const matches = req(raw, "matches", "array");
  const riskLevelRaw = req(raw, "riskLevel", "string");
  if (!isRiskLevel(riskLevelRaw)) {
    throw new ScreenClientError(`Invalid riskLevel: ${riskLevelRaw}`);
  }
  const latencyMs = req(raw, "latencyMs", "number");
  const screenedAt = req(raw, "screenedAt", "string");

  return {
    query,
    matches: matches.map((m, i) => decodeMatch(m, i)),
    riskLevel: riskLevelRaw,
    latencyMs,
    screenedAt,
  };
}

function decodeMatch(raw: unknown, idx: number): ScreenResponse["matches"][number] {
  if (!isObject(raw)) throw new ScreenClientError(`matches[${String(idx)}] not object`);
  const entityId = req(raw, "entityId", "string");
  const entityName = req(raw, "entityName", "string");
  const confidence = req(raw, "confidence", "number");
  const listsRaw = req(raw, "lists", "array");
  const layersRaw = req(raw, "layers", "array");
  const pepStatusRaw = req(raw, "pepStatus", "string");
  if (!isPepStatus(pepStatusRaw)) {
    throw new ScreenClientError(`Invalid pepStatus at matches[${String(idx)}]`);
  }
  const lists = listsRaw.map((l, j) => {
    if (typeof l !== "string" || !isListId(l)) {
      throw new ScreenClientError(`Invalid list at matches[${String(idx)}].lists[${String(j)}]`);
    }
    return l;
  });
  const layers = layersRaw.map((l, j) => decodeLayer(l, idx, j));
  return { entityId, entityName, confidence, lists, layers, pepStatus: pepStatusRaw };
}

function decodeLayer(raw: unknown, mi: number, li: number): { layer: import("./types.js").Layer; score: number; matched: boolean } {
  if (!isObject(raw)) {
    throw new ScreenClientError(`layers[${String(mi)}][${String(li)}] not object`);
  }
  const layerRaw = req(raw, "layer", "string");
  if (!isLayer(layerRaw)) {
    throw new ScreenClientError(`Invalid layer at matches[${String(mi)}].layers[${String(li)}]`);
  }
  const score = req(raw, "score", "number");
  const matched = req(raw, "matched", "boolean");
  return { layer: layerRaw, score, matched };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

type Kind = "string" | "number" | "boolean" | "array";
type KindOf<K extends Kind> = K extends "string" ? string
  : K extends "number" ? number
  : K extends "boolean" ? boolean
  : K extends "array" ? unknown[] : never;

function req<K extends Kind>(obj: Record<string, unknown>, key: string, kind: K): KindOf<K> {
  const v = obj[key];
  const ok = kind === "array" ? Array.isArray(v) : typeof v === kind;
  if (!ok) throw new ScreenClientError(`Missing/invalid field: ${key}`);
  return v as KindOf<K>;
}
