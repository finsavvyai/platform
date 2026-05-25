import { describe, it, expect } from "vitest";
import {
  parseActionRef,
  buildRawUrl,
  parseActionYaml,
  resolveAction,
  renderStageYaml,
} from "./marketplace-action";
import {
  validateOwner,
  validateRepo,
  validateRef,
  validateSubpath,
  canonicalRawUrl,
  cacheKeyFor,
} from "./marketplace-action-validate";

const SAMPLE_YAML = `name: 'Setup Node.js'
description: 'Install Node.js and optionally cache npm dependencies.'
inputs:
  node-version:
    description: 'Version spec of the node to install'
    required: false
    default: '20'
  cache:
    description: 'package manager cache'
    required: false
  always-auth:
    description: 'force auth'
    required: true
runs:
  using: 'node20'
  main: 'dist/setup/index.js'
`;

describe("parseActionRef", () => {
  it("parses org/repo@version", () => {
    expect(parseActionRef("actions/setup-node@v4")).toEqual({
      owner: "actions", repo: "setup-node", subpath: "", version: "v4",
    });
  });

  it("parses org/repo/subpath@version", () => {
    expect(parseActionRef("actions/cache/save@v4")).toEqual({
      owner: "actions", repo: "cache", subpath: "save", version: "v4",
    });
  });

  it("parses SHA refs", () => {
    const ref = "actions/checkout@a5ac7e51b41094c92402da3b24376905380afc29";
    expect(parseActionRef(ref)?.version).toBe("a5ac7e51b41094c92402da3b24376905380afc29");
  });

  it("rejects missing @version", () => {
    expect(parseActionRef("actions/setup-node")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(parseActionRef("  ")).toBeNull();
  });

  it("rejects marketplace URL without repo info", () => {
    expect(parseActionRef("https://github.com/marketplace/actions/setup-node")).toBeNull();
  });
});

describe("buildRawUrl", () => {
  it("builds root action.yml url", () => {
    const p = parseActionRef("actions/setup-node@v4")!;
    expect(buildRawUrl(p, "action.yml")).toBe(
      "https://raw.githubusercontent.com/actions/setup-node/v4/action.yml",
    );
  });

  it("builds subpath action.yaml url", () => {
    const p = parseActionRef("actions/cache/save@v4")!;
    expect(buildRawUrl(p, "action.yaml")).toBe(
      "https://raw.githubusercontent.com/actions/cache/v4/save/action.yaml",
    );
  });
});

describe("parseActionYaml", () => {
  it("extracts name, description, and inputs", () => {
    const parsed = parseActionYaml(SAMPLE_YAML);
    expect(parsed.name).toBe("Setup Node.js");
    expect(parsed.description).toContain("Install Node.js");
    expect(parsed.inputs).toHaveLength(3);
  });

  it("reads input defaults and required flag", () => {
    const parsed = parseActionYaml(SAMPLE_YAML);
    const nodeVersion = parsed.inputs.find((i) => i.name === "node-version")!;
    expect(nodeVersion.default).toBe("20");
    expect(nodeVersion.required).toBe(false);
    const alwaysAuth = parsed.inputs.find((i) => i.name === "always-auth")!;
    expect(alwaysAuth.required).toBe(true);
    expect(alwaysAuth.default).toBeNull();
  });

  it("handles an action.yml with no inputs", () => {
    const parsed = parseActionYaml("name: 'x'\ndescription: 'y'\nruns:\n  using: 'node20'\n");
    expect(parsed.inputs).toEqual([]);
  });
});

describe("resolveAction", () => {
  it("fetches action.yml and parses it", async () => {
    const fakeFetch = async (url: string | URL): Promise<Response> => {
      const u = String(url);
      if (u.endsWith("/action.yml")) {
        return new Response(SAMPLE_YAML, { status: 200 });
      }
      return new Response("not found", { status: 404 });
    };
    const r = await resolveAction("actions/setup-node@v4", fakeFetch as typeof fetch);
    expect(r.owner).toBe("actions");
    expect(r.repo).toBe("setup-node");
    expect(r.inputs.length).toBe(3);
    expect(r.warnings).toHaveLength(0);
    expect(r.sourceUrl).toContain("action.yml");
  });

  it("falls back to action.yaml", async () => {
    const fakeFetch = async (url: string | URL): Promise<Response> => {
      const u = String(url);
      if (u.endsWith("/action.yaml")) return new Response(SAMPLE_YAML, { status: 200 });
      return new Response("", { status: 404 });
    };
    const r = await resolveAction("acme/foo@v1", fakeFetch as typeof fetch);
    expect(r.sourceUrl).toContain("action.yaml");
  });

  it("throws when neither file exists", async () => {
    const fakeFetch = async (): Promise<Response> => new Response("", { status: 404 });
    await expect(resolveAction("acme/foo@v1", fakeFetch as typeof fetch)).rejects.toThrow(
      /no action\.yml/,
    );
  });

  it("warns when the action declares no inputs", async () => {
    const tiny = "name: 'tiny'\ndescription: 'x'\nruns:\n  using: 'docker'\n";
    const fakeFetch = async (): Promise<Response> => new Response(tiny, { status: 200 });
    const r = await resolveAction("acme/tiny@v1", fakeFetch as typeof fetch);
    expect(r.warnings[0]).toMatch(/no inputs/);
  });

  it("throws on malformed refs", async () => {
    const fakeFetch = async (): Promise<Response> => new Response("", { status: 200 });
    await expect(resolveAction("not-a-ref", fakeFetch as typeof fetch)).rejects.toThrow(
      /unrecognized action ref/,
    );
  });
});

describe("renderStageYaml", () => {
  it("produces a pushci stage with with: inputs", () => {
    const resolved = {
      ref: "actions/setup-node@v4", owner: "actions", repo: "setup-node",
      subpath: "", version: "v4", name: "Setup Node.js", description: "",
      inputs: [], warnings: [], sourceUrl: "",
    };
    const yaml = renderStageYaml(resolved, { "node-version": "20", cache: "npm" });
    expect(yaml).toContain("- name: setup-node-js");
    expect(yaml).toContain("uses: actions/setup-node@v4");
    expect(yaml).toContain("node-version: '20'");
    expect(yaml).toContain("cache: 'npm'");
  });

  it("omits the with: block when values are empty", () => {
    const resolved = {
      ref: "actions/checkout@v4", owner: "actions", repo: "checkout",
      subpath: "", version: "v4", name: "Checkout", description: "",
      inputs: [], warnings: [], sourceUrl: "",
    };
    const yaml = renderStageYaml(resolved, {});
    expect(yaml).not.toContain("with:");
  });
});

// ---------------------------------------------------------------------------
// M-001 path-traversal hardening. The audit findings documented how
// `actions/checkout@../../evil/main` normalises to a different repo on
// raw.githubusercontent.com and poisons KV. Each case below is a positive
// control (good ref accepted) or an attack string that MUST be rejected.
// ---------------------------------------------------------------------------
describe("parseActionRef — path traversal defence (M-001)", () => {
  it("accepts standard actions/checkout@v4", () => {
    expect(parseActionRef("actions/checkout@v4")).not.toBeNull();
  });
  it("accepts semver tag actions/setup-node@v4.0.1", () => {
    expect(parseActionRef("actions/setup-node@v4.0.1")).not.toBeNull();
  });
  it("accepts subpath action actions/cache/save@v4", () => {
    const p = parseActionRef("actions/cache/save@v4");
    expect(p).toEqual({ owner: "actions", repo: "cache", subpath: "save", version: "v4" });
  });
  it("accepts single-char owner (GitHub allows 1-char usernames)", () => {
    expect(parseActionRef("a/b@v1")).not.toBeNull();
  });
  it("rejects ref containing .. (the headline attack)", () => {
    expect(parseActionRef("actions/checkout@../../evil/main")).toBeNull();
  });
  it("rejects URL-encoded ../ in ref", () => {
    expect(parseActionRef("actions/checkout@..%2Fevil")).toBeNull();
  });
  it("rejects URL-encoded dot-dot in ref", () => {
    expect(parseActionRef("actions/checkout@%2e%2e%2fevil")).toBeNull();
  });
  it("rejects repo containing ..", () => {
    expect(parseActionRef("actions/../../evil@v4")).toBeNull();
  });
  it("rejects whitespace-injected ref (would allow shell payload)", () => {
    expect(parseActionRef("actions/checkout@v4 && curl attacker.com")).toBeNull();
  });
  it("rejects leading-dash ref (argv injection)", () => {
    expect(parseActionRef("actions/checkout@-rf")).toBeNull();
  });
  it("rejects slash-in-ref (refs must not carry path separators)", () => {
    expect(parseActionRef("actions/checkout@main/branch")).toBeNull();
  });
  it("rejects owner that is pure dots", () => {
    expect(parseActionRef("./actions@v4")).toBeNull();
  });
  it("rejects empty string", () => {
    expect(parseActionRef("")).toBeNull();
  });
  it("rejects non-ASCII unicode", () => {
    expect(parseActionRef("аctions/checkout@v4")).toBeNull();
  });
});

describe("validator primitives", () => {
  it("validateOwner accepts a-z0-9 with internal hyphens", () => {
    expect(validateOwner("finsavvyai")).toBe(true);
    expect(validateOwner("a")).toBe(true);
    expect(validateOwner("my-org-123")).toBe(true);
  });
  it("validateOwner rejects traversal and edge hyphens", () => {
    expect(validateOwner("..")).toBe(false);
    expect(validateOwner("-evil")).toBe(false);
    expect(validateOwner("evil-")).toBe(false);
    expect(validateOwner("a/b")).toBe(false);
  });
  it("validateRepo accepts dots/underscores but not bare ..", () => {
    expect(validateRepo("checkout")).toBe(true);
    expect(validateRepo("setup-node.js")).toBe(true);
    expect(validateRepo("..")).toBe(false);
    expect(validateRepo("...")).toBe(false);
  });
  it("validateRef rejects .., slash, whitespace, encoded traversal", () => {
    expect(validateRef("v4.0.1")).toBe(true);
    expect(validateRef("a5ac7e51b41094c92402da3b24376905380afc29")).toBe(true);
    expect(validateRef("v..x")).toBe(false);
    expect(validateRef("v4/x")).toBe(false);
    expect(validateRef("v4 x")).toBe(false);
    expect(validateRef("%2e%2e")).toBe(false);
    expect(validateRef("-rf")).toBe(false);
  });
  it("validateSubpath rejects dot segments and double slashes", () => {
    expect(validateSubpath("")).toBe(true);
    expect(validateSubpath("save")).toBe(true);
    expect(validateSubpath("nested/path")).toBe(true);
    expect(validateSubpath("..")).toBe(false);
    expect(validateSubpath("save/../evil")).toBe(false);
    expect(validateSubpath("save//x")).toBe(false);
    expect(validateSubpath("/save")).toBe(false);
  });
});

describe("canonicalRawUrl", () => {
  it("accepts a well-formed raw URL", () => {
    const u = "https://raw.githubusercontent.com/actions/checkout/v4/action.yml";
    expect(canonicalRawUrl(u)).toBe(u);
  });
  it("rejects wrong host", () => {
    expect(canonicalRawUrl("https://evil.com/x/y/z/action.yml")).toBeNull();
  });
  it("rejects http://", () => {
    expect(canonicalRawUrl("http://raw.githubusercontent.com/a/b/v1/action.yml")).toBeNull();
  });
  it("rejects query strings and fragments", () => {
    expect(canonicalRawUrl(
      "https://raw.githubusercontent.com/a/b/v1/action.yml?x=1",
    )).toBeNull();
    expect(canonicalRawUrl(
      "https://raw.githubusercontent.com/a/b/v1/action.yml#frag",
    )).toBeNull();
  });
  it("rejects path containing /../ or //", () => {
    expect(canonicalRawUrl(
      "https://raw.githubusercontent.com/a/b/../c/action.yml",
    )).toBeNull();
    expect(canonicalRawUrl(
      "https://raw.githubusercontent.com//a/b/v1/action.yml",
    )).toBeNull();
  });
});

describe("cacheKeyFor", () => {
  it("is stable for identical URLs", async () => {
    const a = await cacheKeyFor("https://raw.githubusercontent.com/x/y/v1/action.yml");
    const b = await cacheKeyFor("https://raw.githubusercontent.com/x/y/v1/action.yml");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
  it("diverges for different URLs (no collision w/ attacker-chosen prefix)", async () => {
    const a = await cacheKeyFor("https://raw.githubusercontent.com/actions/checkout/v4/action.yml");
    const b = await cacheKeyFor("https://raw.githubusercontent.com/evil/checkout/v4/action.yml");
    expect(a).not.toBe(b);
  });
});

describe("fetchActionYaml URL sanitization", () => {
  it("refuses to fetch if buildRawUrl somehow produced a non-canonical URL", async () => {
    // Sanity: buildRawUrl for a validated ref always yields a canonical
    // URL. This test asserts the invariant by round-tripping a known-good
    // parse result through buildRawUrl + canonicalRawUrl.
    const p = parseActionRef("actions/setup-node@v4")!;
    const url = buildRawUrl(p, "action.yml");
    expect(canonicalRawUrl(url)).toBe(url);
  });
});
