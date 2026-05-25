// Unit tests for the bridge SSRF guard (M-002 / M-003).
// License: Apache-2.0

import { describe, it, expect } from "vitest";
import {
  validateBridgeUrl,
  hostInAllowlist,
  parseAllowedHosts,
  resolveAllowlist,
  isSelfHosted,
  validateForBridge,
  isPrivateHost,
} from "./bridge-url-guard";

describe("validateBridgeUrl", () => {
  it("accepts an HTTPS URL whose hostname is allowlisted", () => {
    const u = validateBridgeUrl("https://gitlab.com", ["gitlab.com"]);
    expect(u).not.toBeNull();
    expect(u?.hostname).toBe("gitlab.com");
  });

  it("accepts a subdomain bounded by a dot", () => {
    expect(validateBridgeUrl("https://foo.gitlab.com", ["gitlab.com"])).not.toBeNull();
  });

  it("rejects http:// (non-HTTPS)", () => {
    expect(validateBridgeUrl("http://gitlab.com", ["gitlab.com"])).toBeNull();
  });

  it("rejects a suffix-bypass attempt", () => {
    expect(validateBridgeUrl("https://gitlab.com.attacker.com", ["gitlab.com"])).toBeNull();
  });

  it("rejects a URL containing credentials", () => {
    expect(validateBridgeUrl("https://user:pass@gitlab.com", ["gitlab.com"])).toBeNull();
    expect(validateBridgeUrl("https://user@gitlab.com", ["gitlab.com"])).toBeNull();
  });

  it("rejects a private IPv4 literal even when allowlisted (belt-and-suspenders)", () => {
    expect(validateBridgeUrl("https://10.0.0.5", ["10.0.0.5"])).toBeNull();
    expect(validateBridgeUrl("https://127.0.0.1", ["127.0.0.1"])).toBeNull();
    expect(validateBridgeUrl("https://169.254.169.254", ["169.254.169.254"])).toBeNull();
    expect(validateBridgeUrl("https://192.168.1.1", ["192.168.1.1"])).toBeNull();
    expect(validateBridgeUrl("https://172.16.0.1", ["172.16.0.1"])).toBeNull();
  });

  it("rejects a non-allowlisted private IP", () => {
    expect(validateBridgeUrl("https://10.0.0.5", ["gitlab.com"])).toBeNull();
  });

  it("allows a public hostname that operators added via env (self-hosted)", () => {
    const u = validateBridgeUrl("https://gitlab.internal.corp", ["gitlab.internal.corp"]);
    expect(u).not.toBeNull();
  });

  it("rejects localhost, IPv6 loopback and link-local", () => {
    expect(validateBridgeUrl("https://localhost", ["localhost"])).toBeNull();
    expect(validateBridgeUrl("https://[::1]", ["::1"])).toBeNull();
    expect(validateBridgeUrl("https://[fe80::1]", ["*"])).toBeNull();
  });

  it("rejects malformed inputs", () => {
    expect(validateBridgeUrl("", ["gitlab.com"])).toBeNull();
    expect(validateBridgeUrl("not a url", ["gitlab.com"])).toBeNull();
    expect(validateBridgeUrl(null, ["gitlab.com"])).toBeNull();
    expect(validateBridgeUrl(undefined, ["gitlab.com"])).toBeNull();
    expect(validateBridgeUrl(123, ["gitlab.com"])).toBeNull();
  });

  it("rejects ftp:// and other non-HTTPS schemes", () => {
    expect(validateBridgeUrl("ftp://gitlab.com", ["gitlab.com"])).toBeNull();
    expect(validateBridgeUrl("file:///etc/passwd", ["*"])).toBeNull();
  });

  it("wildcard allowlist accepts any public host but still blocks private IPs", () => {
    expect(validateBridgeUrl("https://anything.example.com", ["*"])).not.toBeNull();
    expect(validateBridgeUrl("https://10.0.0.1", ["*"])).toBeNull();
  });
});

describe("hostInAllowlist", () => {
  it("exact match wins", () => {
    expect(hostInAllowlist("gitlab.com", ["gitlab.com"])).toBe(true);
  });
  it("subdomain bounded by dot matches", () => {
    expect(hostInAllowlist("a.b.gitlab.com", ["gitlab.com"])).toBe(true);
  });
  it("suffix without dot boundary does NOT match", () => {
    expect(hostInAllowlist("evilgitlab.com", ["gitlab.com"])).toBe(false);
  });
  it("case-insensitive", () => {
    expect(hostInAllowlist("GITLAB.COM", ["gitlab.com"])).toBe(true);
  });
  it("wildcard matches anything", () => {
    expect(hostInAllowlist("whatever.example", ["*"])).toBe(true);
  });
});

describe("parseAllowedHosts", () => {
  it("splits CSV and trims", () => {
    expect(parseAllowedHosts("a.com, b.com ,c.com")).toEqual(["a.com", "b.com", "c.com"]);
  });
  it("returns empty for empty/undefined", () => {
    expect(parseAllowedHosts(undefined)).toEqual([]);
    expect(parseAllowedHosts("")).toEqual([]);
    expect(parseAllowedHosts("  ,  ,")).toEqual([]);
  });
  it("lowercases and strips edge dots", () => {
    expect(parseAllowedHosts(".Example.COM.")).toEqual(["example.com"]);
  });
});

describe("isSelfHosted", () => {
  it("true for 1/true/yes (case-insensitive)", () => {
    expect(isSelfHosted({ PUSHCI_SELF_HOSTED: "true" })).toBe(true);
    expect(isSelfHosted({ PUSHCI_SELF_HOSTED: "1" })).toBe(true);
    expect(isSelfHosted({ PUSHCI_SELF_HOSTED: "YES" })).toBe(true);
  });
  it("false otherwise", () => {
    expect(isSelfHosted({})).toBe(false);
    expect(isSelfHosted({ PUSHCI_SELF_HOSTED: "false" })).toBe(false);
    expect(isSelfHosted({ PUSHCI_SELF_HOSTED: "" })).toBe(false);
  });
});

describe("resolveAllowlist", () => {
  it("gitlab: defaults include gitlab.com", () => {
    expect(resolveAllowlist("gitlab", {})).toContain("gitlab.com");
  });
  it("gitlab: env var extends allowlist", () => {
    const list = resolveAllowlist("gitlab", { PUSHCI_GITLAB_ALLOWED_HOSTS: "gitlab.internal.corp" });
    expect(list).toContain("gitlab.com");
    expect(list).toContain("gitlab.internal.corp");
  });
  it("jenkins managed + no env → wildcard (CF Workers egress sandbox)", () => {
    expect(resolveAllowlist("jenkins", {})).toEqual(["*"]);
  });
  it("jenkins self-hosted + no env → empty (blocked)", () => {
    expect(resolveAllowlist("jenkins", { PUSHCI_SELF_HOSTED: "true" })).toEqual([]);
  });
  it("jenkins self-hosted + env → only env hosts", () => {
    const list = resolveAllowlist("jenkins", {
      PUSHCI_SELF_HOSTED: "true",
      PUSHCI_JENKINS_ALLOWED_HOSTS: "ci.corp",
    });
    expect(list).toEqual(["ci.corp"]);
  });
  it("bitbucket: defaults include cloud API", () => {
    const list = resolveAllowlist("bitbucket", {});
    expect(list).toContain("bitbucket.org");
    expect(list).toContain("api.bitbucket.org");
  });
});

describe("validateForBridge", () => {
  it("gitlab managed accepts gitlab.com", () => {
    expect(validateForBridge("https://gitlab.com", "gitlab", {})).not.toBeNull();
  });
  it("gitlab self-hosted blocks unknown hosts without env", () => {
    expect(
      validateForBridge("https://gitlab.internal.corp", "gitlab", { PUSHCI_SELF_HOSTED: "true" })
    ).toBeNull();
  });
  it("gitlab self-hosted accepts env-allowlisted host", () => {
    expect(
      validateForBridge("https://gitlab.internal.corp", "gitlab", {
        PUSHCI_SELF_HOSTED: "true",
        PUSHCI_GITLAB_ALLOWED_HOSTS: "gitlab.internal.corp",
      })
    ).not.toBeNull();
  });
  it("jenkins self-hosted without env blocks every URL", () => {
    expect(
      validateForBridge("https://jenkins.example.com", "jenkins", { PUSHCI_SELF_HOSTED: "true" })
    ).toBeNull();
  });
  it("jenkins managed accepts any public HTTPS host", () => {
    expect(validateForBridge("https://jenkins.example.com", "jenkins", {})).not.toBeNull();
  });
  it("private IP is blocked regardless of mode", () => {
    expect(validateForBridge("https://10.0.0.5", "jenkins", {})).toBeNull();
    expect(
      validateForBridge("https://10.0.0.5", "gitlab", { PUSHCI_GITLAB_ALLOWED_HOSTS: "10.0.0.5" })
    ).toBeNull();
  });
});

describe("isPrivateHost re-export", () => {
  it("is exported from bridge-url-guard for convenience", () => {
    expect(isPrivateHost("10.0.0.1")).toBe(true);
    expect(isPrivateHost("example.com")).toBe(false);
  });
});
