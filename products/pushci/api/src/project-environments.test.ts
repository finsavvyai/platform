// Tests for project-environments + company-registry + registry-templates.

import { describe, it, expect, beforeEach } from "vitest";
import {
  listEnvironments,
  getEnvironment,
  upsertEnvironment,
  deleteEnvironment,
  validateEnvironment,
} from "./project-environments";
import {
  listRegistries,
  getRegistry,
  upsertRegistry,
  deleteRegistry,
  validateRegistry,
  renderCredentialsEnvVars,
  type CompanyRegistry,
} from "./company-registry";
import {
  renderMavenSettingsServerBlock,
  renderGradleRepositoryBlock,
  renderDockerLoginCommand,
  renderNpmRegistry,
} from "./registry-templates";

function makeKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list() {
      return {
        keys: [...store.keys()].map((name) => ({ name })),
        list_complete: true,
        cursor: "",
      };
    },
  } as unknown as KVNamespace;
}

const OWNER = "user:alice";

function makeRegistry(
  type: CompanyRegistry["type"],
  overrides: Partial<CompanyRegistry> = {},
): CompanyRegistry {
  return {
    id: overrides.id ?? "reg-1",
    ownerSub: OWNER,
    name: overrides.name ?? "test-registry",
    type,
    url: overrides.url ?? "https://registry.example.com",
    authMode: overrides.authMode ?? "basic",
    usernameRef: overrides.usernameRef ?? "projects/p1/secrets/user",
    passwordRef: overrides.passwordRef ?? "projects/p1/secrets/pw",
    tokenRef: overrides.tokenRef,
    region: overrides.region,
    properties: overrides.properties ?? {},
    createdAt: overrides.createdAt ?? "2026-04-11T00:00:00Z",
    updatedAt: overrides.updatedAt ?? "2026-04-11T00:00:00Z",
  };
}

describe("project-environments CRUD", () => {
  let kv: KVNamespace;
  beforeEach(() => {
    kv = makeKv();
  });

  it("returns empty list for a fresh project", async () => {
    const envs = await listEnvironments(kv, "proj-1");
    expect(envs).toEqual([]);
  });

  it("upserts a new environment and round-trips it", async () => {
    const created = await upsertEnvironment(kv, "proj-1", {
      name: "dev",
      kind: "dev",
    });
    expect(created.id).toBeTruthy();
    expect(created.name).toBe("dev");
    const fetched = await getEnvironment(kv, "proj-1", created.id);
    expect(fetched?.name).toBe("dev");
    expect(fetched?.kind).toBe("dev");
  });

  it("lists environments sorted by order", async () => {
    await upsertEnvironment(kv, "p", { name: "prod", kind: "prod", order: 2 });
    await upsertEnvironment(kv, "p", { name: "dev", kind: "dev", order: 0 });
    await upsertEnvironment(kv, "p", { name: "stg", kind: "staging", order: 1 });
    const envs = await listEnvironments(kv, "p");
    expect(envs.map((e) => e.name)).toEqual(["dev", "stg", "prod"]);
  });

  it("updates an existing environment in place", async () => {
    const created = await upsertEnvironment(kv, "p", {
      name: "dev",
      kind: "dev",
    });
    const updated = await upsertEnvironment(kv, "p", {
      id: created.id,
      name: "dev",
      kind: "dev",
      requireApproval: true,
      requiredApprovers: 2,
    });
    expect(updated.id).toBe(created.id);
    expect(updated.requireApproval).toBe(true);
    expect(updated.requiredApprovers).toBe(2);
    const all = await listEnvironments(kv, "p");
    expect(all).toHaveLength(1);
  });

  it("deletes an environment", async () => {
    const created = await upsertEnvironment(kv, "p", {
      name: "dev",
      kind: "dev",
    });
    const removed = await deleteEnvironment(kv, "p", created.id);
    expect(removed).toBe(true);
    expect(await listEnvironments(kv, "p")).toEqual([]);
  });

  it("validateEnvironment rejects bad payloads", () => {
    expect(validateEnvironment({})).toContain("name is required");
    expect(
      validateEnvironment({ name: "x", kind: "bogus" as never }),
    ).toContain("kind must be one of dev, test, staging, pre-prod, prod, canary, custom");
    expect(
      validateEnvironment({
        name: "x",
        kind: "dev",
        requiredApprovers: 99,
      }),
    ).toContain("requiredApprovers must be 0-25");
  });
});

describe("company-registry CRUD", () => {
  let kv: KVNamespace;
  beforeEach(() => {
    kv = makeKv();
  });

  it("round-trips a registry", async () => {
    const saved = await upsertRegistry(kv, {
      ownerSub: OWNER,
      name: "norlys-artifactory",
      type: "artifactory",
      url: "https://artifactory.norlys.dk",
      authMode: "basic",
      usernameRef: "secrets/art-user",
      passwordRef: "secrets/art-pw",
    });
    expect(saved.id).toBeTruthy();
    const fetched = await getRegistry(kv, OWNER, saved.id);
    expect(fetched?.name).toBe("norlys-artifactory");
    const all = await listRegistries(kv, OWNER);
    expect(all).toHaveLength(1);
  });

  it("deletes a registry", async () => {
    const saved = await upsertRegistry(kv, {
      ownerSub: OWNER,
      name: "r",
      type: "nexus",
      url: "https://nexus.example.com",
      authMode: "basic",
      usernameRef: "x",
      passwordRef: "y",
    });
    expect(await deleteRegistry(kv, OWNER, saved.id)).toBe(true);
    expect(await listRegistries(kv, OWNER)).toEqual([]);
  });
});

describe("validateRegistry", () => {
  it("requires name, type, url and authMode", () => {
    const errs = validateRegistry({});
    expect(errs.some((e) => e.includes("name"))).toBe(true);
    expect(errs.some((e) => e.includes("type"))).toBe(true);
    expect(errs.some((e) => e.includes("url"))).toBe(true);
    expect(errs.some((e) => e.includes("authMode"))).toBe(true);
  });

  it("aws-ecr requires a region", () => {
    const errs = validateRegistry({
      name: "ecr",
      type: "aws-ecr",
      url: "123.dkr.ecr.us-east-1.amazonaws.com",
      authMode: "aws-iam",
    });
    expect(errs).toContain("aws-ecr requires region");
  });

  it("artifactory requires url + basic auth refs", () => {
    const errs = validateRegistry({
      name: "art",
      type: "artifactory",
      url: "https://artifactory.corp.com",
      authMode: "basic",
    });
    expect(errs).toContain("basic auth requires usernameRef");
    expect(errs).toContain("basic auth requires passwordRef");
  });

  it("gcp-artifact-registry requires a region", () => {
    const errs = validateRegistry({
      name: "gar",
      type: "gcp-artifact-registry",
      url: "https://europe-west1-docker.pkg.dev",
      authMode: "gcp-sa",
    });
    expect(errs).toContain("gcp-artifact-registry requires region");
  });

  it("bearer auth requires tokenRef", () => {
    const errs = validateRegistry({
      name: "gha",
      type: "github-packages",
      url: "https://maven.pkg.github.com/norlys",
      authMode: "bearer",
    });
    expect(errs).toContain("bearer auth requires tokenRef");
  });
});

describe("renderCredentialsEnvVars", () => {
  it("nexus produces NEXUS_URL/USER/PASSWORD", () => {
    const out = renderCredentialsEnvVars(makeRegistry("nexus"));
    expect(out.NEXUS_URL).toBe("https://registry.example.com");
    expect(out.NEXUS_USER).toContain("SECRET:");
    expect(out.NEXUS_PASSWORD).toContain("SECRET:");
  });

  it("artifactory produces ARTIFACTORY_* env vars", () => {
    const out = renderCredentialsEnvVars(makeRegistry("artifactory"));
    expect(Object.keys(out)).toEqual(
      expect.arrayContaining(["ARTIFACTORY_URL", "ARTIFACTORY_USER", "ARTIFACTORY_PASSWORD"]),
    );
  });

  it("github-packages produces GITHUB_ACTOR and GITHUB_TOKEN", () => {
    const out = renderCredentialsEnvVars(
      makeRegistry("github-packages", {
        url: "https://maven.pkg.github.com/norlys",
        authMode: "bearer",
        tokenRef: "secrets/gh-token",
      }),
    );
    expect(out.GITHUB_TOKEN).toContain("SECRET:");
    expect(out.GITHUB_ACTOR).toBeDefined();
  });

  it("aws-ecr exposes region and registry url", () => {
    const out = renderCredentialsEnvVars(
      makeRegistry("aws-ecr", {
        region: "eu-west-1",
        url: "123.dkr.ecr.eu-west-1.amazonaws.com",
        authMode: "aws-iam",
      }),
    );
    expect(out.AWS_REGION).toBe("eu-west-1");
    expect(out.AWS_ECR_REGISTRY).toContain("dkr.ecr");
  });

  it("gcp-artifact-registry exposes region and credentials path", () => {
    const out = renderCredentialsEnvVars(
      makeRegistry("gcp-artifact-registry", {
        region: "europe-west1",
        authMode: "gcp-sa",
        tokenRef: "secrets/gcp-sa.json",
      }),
    );
    expect(out.GCP_REGION).toBe("europe-west1");
    expect(out.GOOGLE_APPLICATION_CREDENTIALS).toContain("SECRET:");
  });
});

describe("registry-templates", () => {
  it("renderMavenSettingsServerBlock produces a <server> XML block", () => {
    const xml = renderMavenSettingsServerBlock(makeRegistry("artifactory"));
    expect(xml).toContain("<server>");
    expect(xml).toContain("<id>reg-1</id>");
    expect(xml).toContain("<username>${env.ARTIFACTORY_USER}</username>");
    expect(xml).toContain("<password>${env.ARTIFACTORY_PASSWORD}</password>");
    expect(xml).toContain("</server>");
  });

  it("renderMavenSettingsServerBlock handles github-packages", () => {
    const xml = renderMavenSettingsServerBlock(
      makeRegistry("github-packages", { authMode: "bearer", tokenRef: "t" }),
    );
    expect(xml).toContain("${env.GITHUB_ACTOR}");
    expect(xml).toContain("${env.GITHUB_TOKEN}");
  });

  it("renderGradleRepositoryBlock emits Groovy DSL with credentials", () => {
    const groovy = renderGradleRepositoryBlock(makeRegistry("nexus"));
    expect(groovy).toContain("maven {");
    expect(groovy).toContain("url = uri(");
    expect(groovy).toContain('System.getenv("NEXUS_USER")');
    expect(groovy).toContain('System.getenv("NEXUS_PASSWORD")');
  });

  it("renderDockerLoginCommand produces aws ecr login", () => {
    const sh = renderDockerLoginCommand(
      makeRegistry("aws-ecr", {
        region: "us-east-1",
        url: "123.dkr.ecr.us-east-1.amazonaws.com",
        authMode: "aws-iam",
      }),
    );
    expect(sh).toContain("aws ecr get-login-password");
    expect(sh).toContain("docker login");
  });

  it("renderDockerLoginCommand produces gcloud command for GAR", () => {
    const sh = renderDockerLoginCommand(
      makeRegistry("gcp-artifact-registry", {
        region: "europe-west1",
        authMode: "gcp-sa",
      }),
    );
    expect(sh).toContain("gcloud auth configure-docker");
  });

  it("renderNpmRegistry produces a scoped .npmrc line", () => {
    const rc = renderNpmRegistry(
      makeRegistry("npm-enterprise", {
        url: "https://npm.norlys.dk/",
        authMode: "bearer",
        tokenRef: "secrets/npm",
      }),
      "@norlys",
    );
    expect(rc).toContain("@norlys:registry=https://npm.norlys.dk/");
    expect(rc).toContain("_authToken=${NPM_AUTH_TOKEN}");
  });
});
