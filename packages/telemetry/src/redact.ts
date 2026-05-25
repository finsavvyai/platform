/**
 * Secret redactor. Walks objects, masks values whose keys match the
 * key list, and scrubs token-shaped substrings inside string values.
 *
 * Pure, synchronous, never throws. Returns a deep-cloned value.
 */

export const DEFAULT_REDACT_KEYS: readonly string[] = [
  "password",
  "passwd",
  "secret",
  "token",
  "api_key",
  "apikey",
  "authorization",
  "auth",
  "cookie",
  "set-cookie",
  "session",
  "bearer",
  "private_key",
  "client_secret",
];

export const REDACTED = "[redacted]";

// Token-shaped substrings: provider api keys + JWT-ish triplets.
// Conservative — only catches strings that look unambiguously like secrets.
const TOKEN_PATTERNS: readonly RegExp[] = [
  /sk-[A-Za-z0-9_-]{16,}/g, // openai-style
  /sk-ant-[A-Za-z0-9_-]{16,}/g, // anthropic-style
  /xox[baprs]-[A-Za-z0-9-]{10,}/g, // slack
  /AKIA[0-9A-Z]{16}/g, // aws access key id
  /ghp_[A-Za-z0-9]{20,}/g, // github personal token
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, // jwt
];

export type RedactOptions = {
  readonly keys?: readonly string[];
  readonly placeholder?: string;
};

const normalizeKeys = (keys: readonly string[]): Set<string> =>
  new Set(keys.map((k) => k.toLowerCase()));

const scrubString = (value: string, placeholder: string): string => {
  let out = value;
  for (const re of TOKEN_PATTERNS) {
    out = out.replace(re, placeholder);
  }
  return out;
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const redact = <T>(value: T, options: RedactOptions = {}): T => {
  const placeholder = options.placeholder ?? REDACTED;
  const keys = normalizeKeys(options.keys ?? DEFAULT_REDACT_KEYS);
  return walk(value, keys, placeholder) as T;
};

const walk = (
  value: unknown,
  keys: ReadonlySet<string>,
  placeholder: string,
): unknown => {
  if (typeof value === "string") return scrubString(value, placeholder);
  if (Array.isArray(value)) {
    return value.map((v) => walk(v, keys, placeholder));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (keys.has(k.toLowerCase())) {
        out[k] = placeholder;
      } else {
        out[k] = walk(v, keys, placeholder);
      }
    }
    return out;
  }
  return value;
};
