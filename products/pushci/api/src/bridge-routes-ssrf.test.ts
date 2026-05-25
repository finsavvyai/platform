// Integration tests: verify that POST /connect on each vulnerable bridge
// rejects private / credential-bearing / non-HTTPS baseUrls (M-002 / M-003).
// License: Apache-2.0

import { describe, it, expect, beforeEach } from "vitest";
import { gitlabRoutes } from "./gitlab-routes";
import { jenkinsRoutes } from "./jenkins-routes";
import { bitbucketRoutes } from "./bitbucket-routes";
import { createJwt } from "./auth";
import type { Env, JwtPayload } from "./types";

const JWT_SECRET = "test_jwt_secret_long_enough_xyz";

function makeKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => { store.set(k, v); },
    delete: async (k: string) => { store.delete(k); },
    list: async ({ prefix }: { prefix: string }) => ({
      keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
    }),
  } as unknown as KVNamespace;
}

async function makeAuthHeader(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: "github:1", login: "tester", provider: "github", iat: now, exp: now + 3600,
  };
  const token = await createJwt(payload, JWT_SECRET);
  return `Bearer ${token}`;
}

function makeEnv(extra: Record<string, string> = {}): Env {
  return {
    RUNNERS: makeKv(),
    JWT_SECRET,
    ...extra,
  } as unknown as Env;
}

async function postConnect(
  app: typeof gitlabRoutes,
  auth: string,
  body: unknown,
  env: Env
): Promise<Response> {
  return app.fetch(
    new Request("https://api.local/connect", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: auth },
      body: JSON.stringify(body),
    }),
    env
  );
}

describe("GitLab /connect — SSRF guard (M-002)", () => {
  let auth: string;
  beforeEach(async () => { auth = await makeAuthHeader(); });

  it("rejects baseUrl pointing at RFC1918 address", async () => {
    const res = await postConnect(gitlabRoutes, auth,
      { baseUrl: "http://10.0.0.5", privateToken: "glpat-x" }, makeEnv());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("baseUrl blocked") });
  });

  it("rejects suffix-bypass attempt", async () => {
    const res = await postConnect(gitlabRoutes, auth,
      { baseUrl: "https://gitlab.com.attacker.com", privateToken: "glpat-x" }, makeEnv());
    expect(res.status).toBe(400);
  });

  it("rejects credentials in URL", async () => {
    const res = await postConnect(gitlabRoutes, auth,
      { baseUrl: "https://user:pass@gitlab.com", privateToken: "glpat-x" }, makeEnv());
    expect(res.status).toBe(400);
  });

  it("rejects http://", async () => {
    const res = await postConnect(gitlabRoutes, auth,
      { baseUrl: "http://gitlab.com", privateToken: "glpat-x" }, makeEnv());
    expect(res.status).toBe(400);
  });

  it("rejects IMDS", async () => {
    const res = await postConnect(gitlabRoutes, auth,
      { baseUrl: "https://169.254.169.254", privateToken: "glpat-x" }, makeEnv());
    expect(res.status).toBe(400);
  });

  it("accepts gitlab.com with defaults", async () => {
    const res = await postConnect(gitlabRoutes, auth,
      { privateToken: "glpat-x" }, makeEnv());
    expect(res.status).toBe(201);
  });

  it("accepts env-allowlisted self-hosted host", async () => {
    const res = await postConnect(gitlabRoutes, auth,
      { baseUrl: "https://gitlab.internal.corp", privateToken: "glpat-x" },
      makeEnv({ PUSHCI_GITLAB_ALLOWED_HOSTS: "gitlab.internal.corp" }));
    expect(res.status).toBe(201);
  });
});

describe("Jenkins /connect — SSRF guard (M-003)", () => {
  let auth: string;
  beforeEach(async () => { auth = await makeAuthHeader(); });

  const body = { baseUrl: "", user: "u", apiToken: "t" };

  it("rejects RFC1918", async () => {
    const res = await postConnect(jenkinsRoutes, auth,
      { ...body, baseUrl: "http://10.0.0.5:8080" }, makeEnv());
    expect(res.status).toBe(400);
  });

  it("rejects http:// scheme", async () => {
    const res = await postConnect(jenkinsRoutes, auth,
      { ...body, baseUrl: "http://jenkins.example.com" }, makeEnv());
    expect(res.status).toBe(400);
  });

  it("self-hosted + no env blocks even valid public host", async () => {
    const res = await postConnect(jenkinsRoutes, auth,
      { ...body, baseUrl: "https://jenkins.example.com" },
      makeEnv({ PUSHCI_SELF_HOSTED: "true" }));
    expect(res.status).toBe(400);
  });

  it("self-hosted + env allows the listed host", async () => {
    const res = await postConnect(jenkinsRoutes, auth,
      { ...body, baseUrl: "https://jenkins.corp.example" },
      makeEnv({ PUSHCI_SELF_HOSTED: "true", PUSHCI_JENKINS_ALLOWED_HOSTS: "jenkins.corp.example" }));
    expect(res.status).toBe(201);
  });

  it("managed mode allows any public HTTPS host", async () => {
    const res = await postConnect(jenkinsRoutes, auth,
      { ...body, baseUrl: "https://jenkins.example.com" }, makeEnv());
    expect(res.status).toBe(201);
  });
});

describe("Bitbucket /connect — SSRF guard (tightened)", () => {
  let auth: string;
  beforeEach(async () => { auth = await makeAuthHeader(); });

  it("rejects suffix-bypass of api.bitbucket.org", async () => {
    const res = await postConnect(bitbucketRoutes, auth,
      { baseUrl: "https://api.bitbucket.org.attacker.com", user: "u", appPassword: "p" }, makeEnv());
    expect(res.status).toBe(400);
  });

  it("accepts canonical bitbucket.org", async () => {
    const res = await postConnect(bitbucketRoutes, auth,
      { baseUrl: "https://api.bitbucket.org", user: "u", appPassword: "p" }, makeEnv());
    expect(res.status).toBe(201);
  });
});
