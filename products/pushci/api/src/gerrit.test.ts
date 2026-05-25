import { describe, it, expect } from "vitest";
import {
  GERRIT_MAGIC_PREFIX,
  stripGerritMagic,
  parseGerritJson,
  labelsForRunStatus,
} from "./gerrit";
import {
  normalizeGerritEvent,
  verifyWebhookSecret,
  gerritRepoKey,
} from "./gerrit-webhook";

describe("stripGerritMagic", () => {
  it("strips the magic prefix and trailing newline", () => {
    const raw = `${GERRIT_MAGIC_PREFIX}\n{"ok":true}`;
    expect(stripGerritMagic(raw)).toBe('{"ok":true}');
  });

  it("strips a CRLF after the magic prefix", () => {
    const raw = `${GERRIT_MAGIC_PREFIX}\r\n[1,2,3]`;
    expect(stripGerritMagic(raw)).toBe("[1,2,3]");
  });

  it("is a no-op on unprefixed JSON", () => {
    expect(stripGerritMagic('{"ok":true}')).toBe('{"ok":true}');
  });

  it("parseGerritJson parses prefixed responses", () => {
    const raw = `${GERRIT_MAGIC_PREFIX}\n{"version":"3.10.0"}`;
    expect(parseGerritJson<{ version: string }>(raw)).toEqual({ version: "3.10.0" });
  });

  it("parseGerritJson throws on invalid JSON", () => {
    expect(() => parseGerritJson(`${GERRIT_MAGIC_PREFIX}\nnot json`)).toThrow();
  });
});

describe("labelsForRunStatus", () => {
  it("passed -> Verified +1", () => {
    expect(labelsForRunStatus("passed")).toEqual({ Verified: 1 });
  });

  it("failed -> Verified -1", () => {
    expect(labelsForRunStatus("failed")).toEqual({ Verified: -1 });
  });

  it("running/pending/cancelled -> Verified 0", () => {
    expect(labelsForRunStatus("running")).toEqual({ Verified: 0 });
    expect(labelsForRunStatus("pending")).toEqual({ Verified: 0 });
    expect(labelsForRunStatus("cancelled")).toEqual({ Verified: 0 });
  });

  it("accepts an optional Code-Review value", () => {
    expect(labelsForRunStatus("passed", { codeReview: 2 })).toEqual({
      Verified: 1,
      "Code-Review": 2,
    });
  });
});

describe("verifyWebhookSecret", () => {
  it("accepts matching secrets", () => {
    expect(verifyWebhookSecret("abc123", "abc123")).toBe(true);
  });

  it("rejects mismatched secrets of equal length", () => {
    expect(verifyWebhookSecret("abc123", "abc124")).toBe(false);
  });

  it("rejects length mismatch", () => {
    expect(verifyWebhookSecret("abc", "abcd")).toBe(false);
  });

  it("rejects null / empty", () => {
    expect(verifyWebhookSecret("abc", null)).toBe(false);
    expect(verifyWebhookSecret("", "abc")).toBe(false);
  });
});

describe("normalizeGerritEvent", () => {
  it("normalizes a patchset-created event", () => {
    const body = {
      type: "patchset-created",
      change: { project: "norlys/metering", branch: "master", id: "Iabc", number: 42 },
      patchSet: { revision: "deadbeef", number: 1 },
      uploader: { username: "alice" },
    };
    expect(normalizeGerritEvent(body)).toEqual({
      project: "norlys/metering",
      branch: "master",
      sha: "deadbeef",
      sender: "alice",
      changeId: "Iabc",
      trigger: "patchset-created",
    });
  });

  it("normalizes a change-merged event", () => {
    const body = {
      type: "change-merged",
      change: { project: "norlys/metering", branch: "main", id: "Ixyz" },
      newRev: "cafebabe",
      submitter: { username: "bob" },
    };
    const got = normalizeGerritEvent(body);
    expect(got?.trigger).toBe("change-merged");
    expect(got?.sha).toBe("cafebabe");
    expect(got?.branch).toBe("main");
  });

  it("normalizes a ref-updated event and strips refs/heads/ prefix", () => {
    const body = {
      type: "ref-updated",
      refUpdate: {
        project: "norlys/metering",
        refName: "refs/heads/develop",
        oldRev: "0000",
        newRev: "1111",
      },
    };
    const got = normalizeGerritEvent(body);
    expect(got?.branch).toBe("develop");
    expect(got?.sha).toBe("1111");
    expect(got?.trigger).toBe("ref-updated");
  });

  it("returns null for unknown event types", () => {
    expect(normalizeGerritEvent({ type: "reviewer-added" })).toBeNull();
  });

  it("returns null for malformed patchset-created", () => {
    expect(normalizeGerritEvent({ type: "patchset-created" })).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(normalizeGerritEvent(null)).toBeNull();
    expect(normalizeGerritEvent("nope")).toBeNull();
  });
});

describe("gerritRepoKey", () => {
  it("namespaces Gerrit projects under a gerrit/ prefix", () => {
    expect(gerritRepoKey("norlys/metering")).toBe("gerrit/norlys/metering");
  });
});
