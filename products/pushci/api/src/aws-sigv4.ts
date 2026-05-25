// AWS SigV4 signer using WebCrypto (HMAC-SHA256).
// Runs on Cloudflare Workers — no @aws-sdk, no Node crypto.
// Reference: https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html

export interface AwsCreds {
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface SignedHeaders {
  [k: string]: string;
}

const ALGORITHM = "AWS4-HMAC-SHA256";

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return hex(buf);
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = key instanceof Uint8Array ? key : new Uint8Array(key);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    k,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function deriveSigningKey(
  secret: string,
  date: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kSecret = new TextEncoder().encode("AWS4" + secret);
  const kDate = await hmac(kSecret, date);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  return kSigning;
}

function rfc3986(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function canonicalUri(pathname: string): string {
  if (!pathname || pathname === "") return "/";
  // AWS expects each path segment URI-encoded (except "/")
  return pathname
    .split("/")
    .map((seg) => rfc3986(decodeURIComponent(seg)))
    .join("/");
}

function canonicalQuery(search: string): string {
  if (!search || search === "?") return "";
  const s = search.startsWith("?") ? search.slice(1) : search;
  if (!s) return "";
  const pairs: Array<[string, string]> = s.split("&").map((p) => {
    const i = p.indexOf("=");
    if (i === -1) return [p, ""];
    return [p.slice(0, i), p.slice(i + 1)];
  });
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1));
  return pairs
    .map(([k, v]) => `${rfc3986(decodeURIComponent(k))}=${rfc3986(decodeURIComponent(v))}`)
    .join("&");
}

function canonicalHeaders(headers: Record<string, string>): {
  canonical: string;
  signed: string;
} {
  const entries = Object.entries(headers).map(
    ([k, v]) => [k.toLowerCase(), String(v).trim().replace(/\s+/g, " ")] as [string, string]
  );
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const canonical = entries.map(([k, v]) => `${k}:${v}\n`).join("");
  const signed = entries.map(([k]) => k).join(";");
  return { canonical, signed };
}

export async function buildCanonicalRequest(
  method: string,
  url: URL,
  headers: Record<string, string>,
  bodyHash: string
): Promise<{ canonicalRequest: string; signedHeaders: string }> {
  const { canonical, signed } = canonicalHeaders(headers);
  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri(url.pathname),
    canonicalQuery(url.search),
    canonical,
    signed,
    bodyHash,
  ].join("\n");
  return { canonicalRequest, signedHeaders: signed };
}

export async function signRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: string | Uint8Array | undefined,
  creds: AwsCreds,
  nowIso?: string
): Promise<SignedHeaders> {
  const u = new URL(url);
  // amzDate must be AWS basic-format (YYYYMMDDTHHMMSSZ). Strip ISO-8601
  // separators (dashes, colons) and millisecond fraction in a single pass.
  // Callers may pass a pre-formatted value via `nowIso` (used by tests).
  const amzDate = nowIso ?? new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);

  const bodyBytes =
    body === undefined ? new Uint8Array(0) : typeof body === "string" ? new TextEncoder().encode(body) : body;
  const bodyHash = await sha256(bodyBytes);

  const base: Record<string, string> = { ...headers };
  base["host"] = u.host;
  base["x-amz-date"] = amzDate;
  base["x-amz-content-sha256"] = bodyHash;
  if (creds.sessionToken) base["x-amz-security-token"] = creds.sessionToken;

  const { canonicalRequest, signedHeaders } = await buildCanonicalRequest(
    method,
    u,
    base,
    bodyHash
  );
  const credentialScope = `${date}/${creds.region}/${creds.service}/aws4_request`;
  const stringToSign = [
    ALGORITHM,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join("\n");

  const signingKey = await deriveSigningKey(
    creds.secretAccessKey,
    date,
    creds.region,
    creds.service
  );
  const signature = hex(await hmac(signingKey, stringToSign));

  base["authorization"] =
    `${ALGORITHM} Credential=${creds.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return base;
}

export const _internal = {
  sha256,
  hmac,
  deriveSigningKey,
  buildCanonicalRequest,
  canonicalHeaders,
  canonicalQuery,
  canonicalUri,
};
