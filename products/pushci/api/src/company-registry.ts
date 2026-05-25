// Generic company registry abstraction. Real enterprises run a mix:
// JFrog, GitHub Packages, ECR, GAR, Nexus, Harbor. Stream D hardcoded
// Nexus in maven-settings.ts; this replaces that with a typed record
// where the TYPE is a tag and credentials are references to the
// secret store — never raw values. Workers must not hold creds.
//
// KV layout (no D1 migrations):
//   registry:user:${ownerSub}           → JSON array of ids
//   registry:user:${ownerSub}:${id}     → JSON CompanyRegistry

export type RegistryType =
  | "nexus" | "artifactory" | "jfrog"
  | "github-packages" | "gitlab-registry" | "gitea-registry"
  | "aws-ecr" | "aws-codeartifact"
  | "gcp-artifact-registry" | "gcp-gcr"
  | "azure-container-registry"
  | "harbor"
  | "npm-enterprise" | "pypi-enterprise"
  | "docker-registry" | "oci-generic";

export type RegistryAuthMode =
  | "none" | "basic" | "bearer" | "aws-iam" | "gcp-sa" | "gha-token";

export interface CompanyRegistry {
  id: string;
  ownerSub: string;
  name: string;
  type: RegistryType;
  url: string;
  authMode: RegistryAuthMode;
  usernameRef?: string;
  passwordRef?: string;
  tokenRef?: string;
  region?: string;
  properties: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

const VALID_TYPES: ReadonlyArray<RegistryType> = [
  "nexus", "artifactory", "jfrog", "github-packages", "gitlab-registry",
  "gitea-registry", "aws-ecr", "aws-codeartifact", "gcp-artifact-registry",
  "gcp-gcr", "azure-container-registry", "harbor", "npm-enterprise",
  "pypi-enterprise", "docker-registry", "oci-generic",
];

const VALID_AUTH: ReadonlyArray<RegistryAuthMode> = [
  "none", "basic", "bearer", "aws-iam", "gcp-sa", "gha-token",
];

const indexKey = (sub: string) => `registry:user:${sub}`;
const recordKey = (sub: string, id: string) => `registry:user:${sub}:${id}`;

async function readIndex(kv: KVNamespace, sub: string): Promise<string[]> {
  try {
    const raw = await kv.get(indexKey(sub));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(kv: KVNamespace, sub: string, ids: string[]): Promise<void> {
  await kv.put(indexKey(sub), JSON.stringify(ids));
}

/** List all registries owned by a user, sorted by createdAt asc. */
export async function listRegistries(
  kv: KVNamespace,
  ownerSub: string,
): Promise<CompanyRegistry[]> {
  const ids = await readIndex(kv, ownerSub);
  const out: CompanyRegistry[] = [];
  for (const id of ids) {
    const raw = await kv.get(recordKey(ownerSub, id));
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw) as CompanyRegistry);
    } catch {
      // skip corrupt records
    }
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Fetch a single registry record by id, scoped to the owner. */
export async function getRegistry(
  kv: KVNamespace,
  ownerSub: string,
  id: string,
): Promise<CompanyRegistry | null> {
  const raw = await kv.get(recordKey(ownerSub, id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CompanyRegistry;
  } catch {
    return null;
  }
}

/** Insert or update a registry, always bumping updatedAt. */
export async function upsertRegistry(
  kv: KVNamespace,
  registry: Partial<CompanyRegistry> & {
    ownerSub: string;
    name: string;
    type: RegistryType;
    url: string;
    authMode: RegistryAuthMode;
  },
): Promise<CompanyRegistry> {
  const now = new Date().toISOString();
  const id = registry.id ?? crypto.randomUUID();
  const existing = await getRegistry(kv, registry.ownerSub, id);
  const merged: CompanyRegistry = {
    id,
    ownerSub: registry.ownerSub,
    name: registry.name.trim(),
    type: registry.type,
    url: registry.url.trim(),
    authMode: registry.authMode,
    usernameRef: registry.usernameRef ?? existing?.usernameRef,
    passwordRef: registry.passwordRef ?? existing?.passwordRef,
    tokenRef: registry.tokenRef ?? existing?.tokenRef,
    region: registry.region ?? existing?.region,
    properties: registry.properties ?? existing?.properties ?? {},
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await kv.put(recordKey(registry.ownerSub, id), JSON.stringify(merged));
  const ids = await readIndex(kv, registry.ownerSub);
  if (!ids.includes(id)) {
    ids.push(id);
    await writeIndex(kv, registry.ownerSub, ids);
  }
  return merged;
}

/** Delete a registry. Returns true if a record was removed. */
export async function deleteRegistry(
  kv: KVNamespace,
  ownerSub: string,
  id: string,
): Promise<boolean> {
  const existing = await getRegistry(kv, ownerSub, id);
  if (!existing) return false;
  await kv.delete(recordKey(ownerSub, id));
  const ids = (await readIndex(kv, ownerSub)).filter((x) => x !== id);
  await writeIndex(kv, ownerSub, ids);
  return true;
}

/**
 * Validate a proposed registry record. Returns human-readable error
 * strings; an empty array means the record is acceptable. Type-
 * specific rules live here so the routes layer stays thin.
 */
export function validateRegistry(r: Partial<CompanyRegistry>): string[] {
  const errors: string[] = [];
  if (!r.name || r.name.trim().length === 0) errors.push("name is required");
  if (r.name && r.name.length > 96) errors.push("name must be <= 96 characters");
  if (!r.type || !VALID_TYPES.includes(r.type)) {
    errors.push(`type must be one of: ${VALID_TYPES.join(", ")}`);
  }
  if (!r.authMode || !VALID_AUTH.includes(r.authMode)) {
    errors.push(`authMode must be one of: ${VALID_AUTH.join(", ")}`);
  }
  if (!r.url || r.url.trim().length === 0) {
    errors.push("url is required");
  } else if (!/^https?:\/\//i.test(r.url) && r.type !== "aws-ecr" && r.type !== "gcp-gcr") {
    errors.push("url must start with http:// or https://");
  }
  if ((r.type === "aws-ecr" || r.type === "aws-codeartifact" || r.type === "gcp-artifact-registry") && !r.region) {
    errors.push(`${r.type} requires region`);
  }
  if (r.authMode === "basic") {
    if (!r.usernameRef) errors.push("basic auth requires usernameRef");
    if (!r.passwordRef) errors.push("basic auth requires passwordRef");
  }
  if (r.authMode === "bearer" && !r.tokenRef) {
    errors.push("bearer auth requires tokenRef");
  }
  return errors;
}

const secretRef = (ref?: string): string => (ref ? `\${SECRET:${ref}}` : "");

/**
 * Render env var names a runner should populate. Values are literals
 * (url, region) or `${SECRET:ref}` placeholders resolved at dispatch.
 */
export function renderCredentialsEnvVars(r: CompanyRegistry): Record<string, string> {
  const out: Record<string, string> = {};
  switch (r.type) {
    case "nexus":
    case "artifactory":
    case "jfrog":
    case "harbor": {
      const pfx = r.type.toUpperCase().replace("-", "_");
      out[`${pfx}_URL`] = r.url;
      out[`${pfx}_USER`] = secretRef(r.usernameRef);
      out[`${pfx}_PASSWORD`] = secretRef(r.passwordRef);
      break;
    }
    case "github-packages":
      out.GITHUB_PACKAGES_URL = r.url;
      out.GITHUB_ACTOR = secretRef(r.usernameRef);
      out.GITHUB_TOKEN = secretRef(r.tokenRef ?? r.passwordRef);
      break;
    case "gitlab-registry":
      out.GITLAB_REGISTRY_URL = r.url;
      out.GITLAB_USER = secretRef(r.usernameRef);
      out.GITLAB_TOKEN = secretRef(r.tokenRef ?? r.passwordRef);
      break;
    case "gitea-registry":
      out.GITEA_REGISTRY_URL = r.url;
      out.GITEA_USER = secretRef(r.usernameRef);
      out.GITEA_TOKEN = secretRef(r.tokenRef ?? r.passwordRef);
      break;
    case "aws-ecr":
      out.AWS_REGION = r.region ?? "";
      out.AWS_ECR_REGISTRY = r.url;
      break;
    case "aws-codeartifact":
      out.AWS_REGION = r.region ?? "";
      out.CODEARTIFACT_DOMAIN = r.properties.domain ?? "";
      out.CODEARTIFACT_OWNER = r.properties.domainOwner ?? "";
      out.CODEARTIFACT_AUTH_TOKEN = "${SECRET:aws-codeartifact-token}";
      break;
    case "gcp-artifact-registry":
    case "gcp-gcr":
      out.GCP_REGION = r.region ?? "";
      out.GCP_ARTIFACT_REGISTRY_URL = r.url;
      out.GOOGLE_APPLICATION_CREDENTIALS = secretRef(r.tokenRef);
      break;
    case "azure-container-registry":
      out.AZURE_REGISTRY_URL = r.url;
      out.AZURE_REGISTRY_USER = secretRef(r.usernameRef);
      out.AZURE_REGISTRY_PASSWORD = secretRef(r.passwordRef);
      break;
    case "npm-enterprise":
      out.NPM_REGISTRY_URL = r.url;
      out.NPM_AUTH_TOKEN = secretRef(r.tokenRef ?? r.passwordRef);
      break;
    case "pypi-enterprise":
      out.PIP_INDEX_URL = r.url;
      out.PIP_USER = secretRef(r.usernameRef);
      out.PIP_PASSWORD = secretRef(r.passwordRef);
      break;
    case "docker-registry":
    case "oci-generic":
      out.DOCKER_REGISTRY_URL = r.url;
      if (r.usernameRef) out.DOCKER_REGISTRY_USER = secretRef(r.usernameRef);
      if (r.passwordRef) out.DOCKER_REGISTRY_PASSWORD = secretRef(r.passwordRef);
      break;
  }
  return out;
}
