// SPDX-License-Identifier: AGPL-3.0-or-later
import type {
  ExtensionSettings,
  RedactRequest,
  RedactResponse,
} from "./types";

export class GatewayError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "GatewayError";
  }
}

export async function redact(
  settings: ExtensionSettings,
  req: RedactRequest,
): Promise<RedactResponse> {
  const url = `${trimSlash(settings.gatewayUrl)}/v1/redact`;
  const body: RedactRequest = {
    text: req.text,
    presets: req.presets ?? settings.presets,
    ...(req.tenant ?? settings.tenant
      ? { tenant: req.tenant ?? settings.tenant }
      : {}),
  };
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };
  if (settings.apiKey) headers.authorization = `Bearer ${settings.apiKey}`;
  if (settings.tenant) headers["x-tenant-id"] = settings.tenant;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new GatewayError(res.status, detail || res.statusText);
  }
  return (await res.json()) as RedactResponse;
}

function trimSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}
