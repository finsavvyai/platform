// Marketplace action ref validators — defense against M-001
// (path traversal through `actions/checkout@../../evil/main`).
//
// Three layered checks:
//   1. Regex allow-lists for owner/repo/ref per GitHub's own rules
//      (see https://docs.github.com/repos — usernames ≤39 chars,
//      no consecutive hyphens; repo names 1-100 chars ASCII; refs
//      must not contain `..`, `/`, whitespace or leading `-`).
//   2. Explicit blocklist for URL-encoded traversal (`%2e`, `%2f`).
//   3. WHATWG URL canonicalization before fetch — the resolved
//      URL must still point at raw.githubusercontent.com with no
//      `//`, `/../`, `/./`, query, or fragment.
//
// The cache key is derived from a SHA-256 of the canonical URL so
// an attacker who bypasses validation still can't poison KV for
// well-formed refs.
//
// Pure module. Async only for crypto.subtle.digest.
export interface RefParts {
  readonly owner: string;
  readonly repo: string;
  readonly subpath: string;
  readonly version: string;
}

// GitHub username: 1-39 chars, alphanumeric or single hyphen,
// cannot begin/end with hyphen, no consecutive hyphens. Keeping
// the check simple: charset + length + no leading/trailing dash.
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

// Repo name: 1-100 chars from {A-Z,a-z,0-9,_,.,-}. GitHub also
// forbids `.` and `..` as whole names; both are excluded below.
const REPO_RE = /^[A-Za-z0-9_.\-]{1,100}$/;

// Git ref: 1-100 chars, must start alphanumeric, then
// alphanumeric/underscore/dot/hyphen. No slash, no `..`, no
// whitespace, no leading `-`.
const REF_RE = /^[A-Za-z0-9][A-Za-z0-9_.\-]{0,99}$/;

// Subpath inside the repo: optional, forward-slash separated
// segments of the same charset as a repo, disallowing traversal
// segments. Each segment 1-100 chars.
const SUBPATH_SEG_RE = /^[A-Za-z0-9_.\-]{1,100}$/;

// Anything URL-encoded that could re-introduce `.` or `/` when
// the downstream library normalises the path. Case-insensitive.
const ENCODED_BAD_RE = /%(?:2e|2f|5c|00|0a|0d)/i;

export function validateOwner(s: string): boolean {
  if (!OWNER_RE.test(s)) return false;
  return s !== "." && s !== "..";
}

export function validateRepo(s: string): boolean {
  if (!REPO_RE.test(s)) return false;
  if (s === "." || s === "..") return false;
  // disallow repos that are pure dots (e.g. "...") — GitHub rejects
  return !/^\.+$/.test(s);
}

export function validateRef(s: string): boolean {
  if (!REF_RE.test(s)) return false;
  if (s.includes("..")) return false;
  if (ENCODED_BAD_RE.test(s)) return false;
  return true;
}

export function validateSubpath(s: string): boolean {
  if (s === "") return true;
  if (s.startsWith("/") || s.endsWith("/")) return false;
  if (s.includes("//")) return false;
  if (ENCODED_BAD_RE.test(s)) return false;
  for (const seg of s.split("/")) {
    if (!SUBPATH_SEG_RE.test(seg)) return false;
    if (seg === "." || seg === "..") return false;
  }
  return true;
}

export function validateParts(p: RefParts): boolean {
  return (
    validateOwner(p.owner) &&
    validateRepo(p.repo) &&
    validateRef(p.version) &&
    validateSubpath(p.subpath)
  );
}

// canonicalRawUrl verifies the URL points at raw.githubusercontent.com,
// has no traversal, no query, no fragment. Returns the canonical string
// or null if anything looks off. Inspects BOTH the raw string (before
// WHATWG normalisation) and the parsed pathname — `new URL(...)` would
// otherwise silently collapse `/a/b/../c` to `/a/c`.
export function canonicalRawUrl(url: string): string | null {
  if (url.includes(" ") || url.includes("\t") || url.includes("\n")) return null;
  if (ENCODED_BAD_RE.test(url)) return null;
  const afterScheme = url.split("://")[1] ?? "";
  const rawPath = afterScheme.slice(afterScheme.indexOf("/"));
  if (
    rawPath.includes("//") ||
    rawPath.includes("/../") ||
    rawPath.includes("/./") ||
    rawPath.endsWith("/..") ||
    rawPath.endsWith("/.")
  ) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (u.host !== "raw.githubusercontent.com") return null;
  if (u.search !== "" || u.hash !== "") return null;
  return `${u.protocol}//${u.host}${u.pathname}`;
}

// cacheKeyFor hashes the canonical URL so cache entries can't be
// poisoned by attacker-controlled ref strings (any attack surface
// that bypassed regex validation still couldn't influence the key).
export async function cacheKeyFor(canonicalUrl: string): Promise<string> {
  const data = new TextEncoder().encode(canonicalUrl);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}
