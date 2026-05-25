// Azure DevOps auth & low-level HTTP helpers shared by the client
// module. Split out of azure-devops.ts to keep each file ≤200 lines
// (portfolio CLAUDE.md rule).
//
// License: Apache-2.0

export interface AzureAuth {
  /** Personal Access Token for Basic auth. */
  pat?: string;
  /** Raw OAuth bearer (alternative to pat). */
  bearer?: string;
}

export const API_VERSION = "api-version=7.0";

export function authHeader(auth: AzureAuth): string {
  if (auth.bearer) return `Bearer ${auth.bearer}`;
  // Azure DevOps Basic auth: empty username + PAT as password.
  return "Basic " + btoa(`:${auth.pat ?? ""}`);
}

export function buildHeaders(auth: AzureAuth, contentType?: string): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: authHeader(auth),
    Accept: "application/json",
  };
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
}

function trimSlash(u: string): string {
  return u.replace(/\/+$/, "");
}

export function base(org: string): string {
  return `https://dev.azure.com/${encodeURIComponent(org)}`;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

export async function expectOk(res: Response, ctx: string): Promise<void> {
  if (!res.ok) {
    const body = await safeText(res);
    throw new Error(`azure-devops ${ctx} failed: ${res.status} ${body.slice(0, 200)}`);
  }
}

/**
 * Normalize common user input shapes ("https://dev.azure.com/acme/",
 * "acme/", "acme") into a bare org slug.
 */
export function trimBaseUrl(org: string): string {
  const m = org.match(/dev\.azure\.com\/([^/?#]+)/i);
  if (m) return trimSlash(m[1]);
  return trimSlash(org);
}
