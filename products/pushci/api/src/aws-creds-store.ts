// Storage + redaction + runtime conversion for per-user AWS credentials.
// Split from aws-routes.ts to keep each file under the 200-line portfolio
// cap.
//
// Wire format in KV (`aws:creds:${sub}`):
// - v1.6.6 and earlier: plain JSON of `StoredCreds`. Legacy, still readable.
// - v1.6.7+: AES-GCM envelope JSON. See crypto-envelope.ts for format.

import type { Env } from "./types";
import { type CodePipelineCreds } from "./aws-codepipeline";
import { assumeRole } from "./aws-sts";
import { redactExternalId } from "./aws-externalid";
import { encryptCreds, tryDecrypt } from "./crypto-envelope";

export interface StoredCreds {
  region: string;
  mode: "static" | "role";
  roleArn?: string;
  externalId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  created_at: string;
  updated_at: string;
}

export const KV_PREFIX = "aws:creds:";

export function staticCredsAllowed(env: Env): boolean {
  const v = (env.PUSHCI_ALLOW_STATIC_CREDS ?? "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export async function loadCreds(env: Env, sub: string): Promise<StoredCreds | null> {
  const raw = await env.RUNNERS.get(`${KV_PREFIX}${sub}`);
  if (!raw) return null;
  try {
    const plain = await tryDecrypt(raw, env.PUSHCI_CRED_ENCRYPTION_KEY);
    if (plain == null) return null;
    return JSON.parse(plain) as StoredCreds;
  } catch {
    return null;
  }
}

export async function writeCreds(
  env: Env,
  sub: string,
  stored: StoredCreds
): Promise<void> {
  const plain = JSON.stringify(stored);
  const keyB64 = env.PUSHCI_CRED_ENCRYPTION_KEY;
  const value = keyB64 ? await encryptCreds(plain, keyB64) : plain;
  await env.RUNNERS.put(`${KV_PREFIX}${sub}`, value);
}

export async function deleteCreds(env: Env, sub: string): Promise<void> {
  await env.RUNNERS.delete(`${KV_PREFIX}${sub}`);
}

export async function toRuntimeCreds(
  stored: StoredCreds,
  env: Env
): Promise<CodePipelineCreds | null> {
  if (stored.mode === "static" && stored.accessKeyId && stored.secretAccessKey) {
    return {
      region: stored.region,
      accessKeyId: stored.accessKeyId,
      secretAccessKey: stored.secretAccessKey,
    };
  }
  // Role mode — use PushCI's IAM user to AssumeRole into customer
  // account. Base creds come from worker secrets (not user KV).
  if (stored.mode === "role" && stored.roleArn) {
    const baseKey = env.AWS_STS_ACCESS_KEY_ID;
    const baseSecret = env.AWS_STS_SECRET_ACCESS_KEY;
    if (!baseKey || !baseSecret) return null;
    try {
      return await assumeRole({
        roleArn: stored.roleArn,
        externalId: stored.externalId,
        region: stored.region,
        accessKeyId: baseKey,
        secretAccessKey: baseSecret,
      });
    } catch {
      return null;
    }
  }
  return null;
}

export function redact(stored: StoredCreds): Record<string, unknown> {
  return {
    region: stored.region,
    mode: stored.mode,
    roleArn: stored.roleArn,
    externalId: stored.externalId ? redactExternalId(stored.externalId) : undefined,
    accessKeyId: stored.accessKeyId
      ? `${stored.accessKeyId.slice(0, 4)}…${stored.accessKeyId.slice(-4)}`
      : undefined,
    created_at: stored.created_at,
    updated_at: stored.updated_at,
  };
}
