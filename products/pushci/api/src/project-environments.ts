// Project environments — multi-environment support per PushCI project.
//
// A single project (e.g. "norlys/core-api") can have many lifecycle
// environments: dev, test, staging, pre-prod, prod, canary. Each one
// carries its own approval policy, protected branch, secret refs,
// non-secret variables and a list of company registries it draws
// from. We deliberately store environments in KV (not D1) so we can
// ship without another schema migration and so per-project writes
// stay cheap.
//
// Storage layout:
//   Key:   env:project:${projectId}
//   Value: JSON array of ProjectEnvironment, sorted by `order`.
//
// Secret values are **never** stored here — only references to the
// secret store (`secretRefs: ["projects/123/secrets/nexus-pw"]`).
// The runner resolves secrets at job-dispatch time.

export type EnvKind =
  | "dev"
  | "test"
  | "staging"
  | "pre-prod"
  | "prod"
  | "canary"
  | "custom";

export interface ProjectEnvironment {
  id: string;
  projectId: string;
  name: string;
  kind: EnvKind;
  order: number;
  requireApproval: boolean;
  requiredApprovers: number;
  protectedBranch?: string;
  registryBindings: string[];
  variables: Record<string, string>;
  secretRefs: string[];
  createdAt: string;
  updatedAt: string;
}

const VALID_KINDS: ReadonlyArray<EnvKind> = [
  "dev",
  "test",
  "staging",
  "pre-prod",
  "prod",
  "canary",
  "custom",
];

function envKey(projectId: string): string {
  return `env:project:${projectId}`;
}

async function readAll(
  kv: KVNamespace,
  projectId: string,
): Promise<ProjectEnvironment[]> {
  try {
    const raw = await kv.get(envKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProjectEnvironment[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

async function writeAll(
  kv: KVNamespace,
  projectId: string,
  envs: ProjectEnvironment[],
): Promise<void> {
  const sorted = [...envs].sort((a, b) => a.order - b.order);
  await kv.put(envKey(projectId), JSON.stringify(sorted));
}

/** List all environments for a project, ordered by display order. */
export async function listEnvironments(
  kv: KVNamespace,
  projectId: string,
): Promise<ProjectEnvironment[]> {
  return readAll(kv, projectId);
}

/** Fetch a single environment by id within a project. */
export async function getEnvironment(
  kv: KVNamespace,
  projectId: string,
  envId: string,
): Promise<ProjectEnvironment | null> {
  const all = await readAll(kv, projectId);
  return all.find((e) => e.id === envId) ?? null;
}

/**
 * Insert or update (by id) an environment within a project. Returns
 * the persisted record with createdAt/updatedAt timestamps filled in.
 */
export async function upsertEnvironment(
  kv: KVNamespace,
  projectId: string,
  env: Partial<ProjectEnvironment> & { name: string; kind: EnvKind },
): Promise<ProjectEnvironment> {
  const all = await readAll(kv, projectId);
  const now = new Date().toISOString();
  const existingIdx = env.id ? all.findIndex((e) => e.id === env.id) : -1;
  const existing = existingIdx >= 0 ? all[existingIdx] : null;

  const merged: ProjectEnvironment = {
    id: existing?.id ?? env.id ?? crypto.randomUUID(),
    projectId,
    name: env.name.trim(),
    kind: env.kind,
    order: env.order ?? existing?.order ?? all.length,
    requireApproval: env.requireApproval ?? existing?.requireApproval ?? false,
    requiredApprovers:
      env.requiredApprovers ?? existing?.requiredApprovers ?? 0,
    protectedBranch: env.protectedBranch ?? existing?.protectedBranch,
    registryBindings: env.registryBindings ?? existing?.registryBindings ?? [],
    variables: env.variables ?? existing?.variables ?? {},
    secretRefs: env.secretRefs ?? existing?.secretRefs ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (existingIdx >= 0) {
    all[existingIdx] = merged;
  } else {
    all.push(merged);
  }
  await writeAll(kv, projectId, all);
  return merged;
}

/** Delete an environment by id. Returns true if a record was removed. */
export async function deleteEnvironment(
  kv: KVNamespace,
  projectId: string,
  envId: string,
): Promise<boolean> {
  const all = await readAll(kv, projectId);
  const next = all.filter((e) => e.id !== envId);
  if (next.length === all.length) return false;
  await writeAll(kv, projectId, next);
  return true;
}

/**
 * Validate the shape of a proposed environment. Returns a list of
 * error strings — an empty list means the payload is acceptable.
 */
export function validateEnvironment(
  env: Partial<ProjectEnvironment>,
): string[] {
  const errors: string[] = [];
  if (!env.name || env.name.trim().length === 0) {
    errors.push("name is required");
  }
  if (env.name && env.name.length > 64) {
    errors.push("name must be <= 64 characters");
  }
  if (!env.kind || !VALID_KINDS.includes(env.kind)) {
    errors.push(`kind must be one of ${VALID_KINDS.join(", ")}`);
  }
  if (
    typeof env.requiredApprovers === "number" &&
    (env.requiredApprovers < 0 || env.requiredApprovers > 25)
  ) {
    errors.push("requiredApprovers must be 0-25");
  }
  if (env.registryBindings && !Array.isArray(env.registryBindings)) {
    errors.push("registryBindings must be an array of registry ids");
  }
  if (env.secretRefs && !Array.isArray(env.secretRefs)) {
    errors.push("secretRefs must be an array");
  }
  if (env.variables && typeof env.variables !== "object") {
    errors.push("variables must be an object");
  }
  if (env.protectedBranch && typeof env.protectedBranch !== "string") {
    errors.push("protectedBranch must be a string");
  }
  return errors;
}
