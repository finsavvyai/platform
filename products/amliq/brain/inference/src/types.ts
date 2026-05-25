/**
 * Brain ↔ Cluster inference bridge — public types.
 *
 * Cross-agent contract (mesh §2): the InferenceProvider interface is the
 * sole sanctioned coupling between AMLIQ Brain and FinSavvy Cluster.
 * Cluster runs out-of-process; Brain talks to it via HTTP. No code in
 * this module imports from products/finsavvy-cluster/ or @finsavvyai/*.
 *
 * Wire shape mirrors OpenAI Chat Completions where reasonable so cluster
 * (or a substitute provider) can implement the contract cheaply.
 */

// -------- Chat message --------

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  readonly role: ChatRole;
  readonly content: string;
  /** Present on role="tool" responses. OpenAI parity. */
  readonly tool_call_id?: string;
  /** Present on role="assistant" when the model emits tool calls. */
  readonly name?: string;
}

// -------- Tool surface (optional, OpenAI parity) --------

export interface ChatTool {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description?: string;
    /** JSON Schema describing the function's arguments. */
    readonly parameters: Readonly<Record<string, unknown>>;
  };
}

// -------- Request --------

export interface CompletionRequest {
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  readonly temperature?: number;
  readonly top_p?: number;
  readonly max_tokens?: number;
  readonly stop?: readonly string[];
  readonly tools?: readonly ChatTool[];
  readonly tool_choice?: "auto" | "none" | "required";
  /**
   * Tenant identifier propagated into the JWT `sub` claim and into
   * cluster routing/quotas. Required: Brain must always identify the
   * caller. PII-free per AMLIQ rule (use the tenant hash, not a name).
   */
  readonly tenantId: string;
  /**
   * Optional per-call timeout override (ms). Falls back to provider
   * default if omitted.
   */
  readonly timeoutMs?: number;
}

// -------- Response --------

export interface TokenUsage {
  readonly prompt_tokens: number;
  readonly completion_tokens: number;
  readonly total_tokens: number;
}

export interface CompletionChoice {
  readonly index: number;
  readonly message: ChatMessage;
  /**
   * OpenAI-parity finish reason. "tool_calls" surfaces when the model
   * decided to invoke a tool instead of emitting a final answer.
   */
  readonly finish_reason: "stop" | "length" | "tool_calls" | "content_filter";
}

export interface CompletionResponse {
  readonly id: string;
  readonly model: string;
  /** Unix seconds. OpenAI parity. */
  readonly created: number;
  readonly choices: readonly CompletionChoice[];
  readonly usage: TokenUsage;
  /** Provider tag for observability ("cluster", "openai", "anthropic"…). */
  readonly providerId: string;
}

// -------- Provider interface --------

/**
 * The single surface Brain agents call to obtain a model completion.
 *
 * Implementations may target the FinSavvy Cluster (default;
 * ClusterInferenceProvider), a cloud provider, or a composite
 * (FallbackInferenceProvider). All implementations must:
 *   - propagate request.tenantId into their auth context
 *   - honor request.timeoutMs (or substitute a sane default)
 *   - throw a typed error on failure (see errors below)
 */
export interface InferenceProvider {
  readonly id: string;
  complete(req: CompletionRequest): Promise<CompletionResponse>;
}

// -------- Errors --------

/**
 * Base error for any inference failure. Carries the provider id so the
 * fallback chain and audit log can attribute it.
 */
export class InferenceError extends Error {
  public readonly providerId: string;
  public readonly cause?: unknown;
  constructor(providerId: string, message: string, cause?: unknown) {
    super(message);
    this.name = "InferenceError";
    this.providerId = providerId;
    if (cause !== undefined) this.cause = cause;
  }
}

/** Transport-level failure (network, timeout, 5xx after retries). */
export class InferenceTransportError extends InferenceError {
  public readonly status?: number;
  constructor(providerId: string, message: string, status?: number, cause?: unknown) {
    super(providerId, message, cause);
    this.name = "InferenceTransportError";
    if (status !== undefined) this.status = status;
  }
}

/** Cluster (or provider) rejected the request — bad input, auth, quota. */
export class InferenceProviderError extends InferenceError {
  public readonly status: number;
  constructor(providerId: string, status: number, message: string, cause?: unknown) {
    super(providerId, message, cause);
    this.name = "InferenceProviderError";
    this.status = status;
  }
}

/** All providers in a FallbackInferenceProvider failed. */
export class InferenceExhaustedError extends InferenceError {
  public readonly failures: readonly InferenceError[];
  constructor(failures: readonly InferenceError[]) {
    super("fallback", `all ${failures.length} providers failed`);
    this.name = "InferenceExhaustedError";
    this.failures = failures;
  }
}

// -------- Auth signer (DI) --------

/**
 * Brain injects a JWT signer. The bridge never holds key material.
 * Signers should mint short-lived (≤300s) tokens with audience "cluster"
 * and the requested scope.
 */
export interface JwtSigner {
  sign(claims: {
    readonly sub: string;
    readonly aud: string;
    readonly scope: string;
    readonly ttlSeconds: number;
  }): Promise<string> | string;
}
