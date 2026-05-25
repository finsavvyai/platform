import { describe, expect, it } from "vitest";
import { DEFAULT_REDACT_KEYS, REDACTED, redact } from "./redact.js";

describe("redact", () => {
  it("masks values for default sensitive keys", () => {
    const input = {
      user: "alice",
      password: "hunter2",
      nested: { api_key: "sk-abc123def456ghij", ok: "fine" },
    };
    const out = redact(input);
    expect(out.password).toBe(REDACTED);
    expect(out.nested.api_key).toBe(REDACTED);
    expect(out.user).toBe("alice");
    expect(out.nested.ok).toBe("fine");
  });

  it("is case-insensitive on keys", () => {
    const out = redact({ Authorization: "Bearer x" });
    expect(out.Authorization).toBe(REDACTED);
  });

  it("scrubs token-shaped substrings inside strings", () => {
    const out = redact({
      msg: "leaked sk-ant-aaaaaaaaaaaaaaaaaa here and AKIAABCDEFGHIJKLMNOP too",
    });
    expect(out.msg).not.toContain("sk-ant-aaaaaaaaaaaaaaaaaa");
    expect(out.msg).not.toContain("AKIAABCDEFGHIJKLMNOP");
    expect(out.msg).toContain(REDACTED);
  });

  it("scrubs JWT-shaped substrings", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR.eyJzdWIiOiIxMjM0NTY3.SflKxwRJSMeKKF2QT4f";
    const out = redact({ token_in_text: `prefix ${jwt} suffix` });
    expect(out.token_in_text).not.toContain(jwt);
  });

  it("walks arrays", () => {
    const out = redact({ items: [{ secret: "s" }, { ok: "v" }] });
    expect(out.items[0].secret).toBe(REDACTED);
    expect(out.items[1].ok).toBe("v");
  });

  it("accepts custom keys + placeholder", () => {
    const out = redact(
      { custom: "x", password: "y" },
      { keys: ["custom"], placeholder: "***" },
    );
    expect(out.custom).toBe("***");
    // when caller supplies keys, defaults are replaced (not merged)
    expect(out.password).toBe("y");
  });

  it("passes through non-object primitives", () => {
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBe(null);
    expect(redact(undefined)).toBe(undefined);
    expect(redact(true)).toBe(true);
  });

  it("DEFAULT_REDACT_KEYS includes core secret names", () => {
    expect(DEFAULT_REDACT_KEYS).toContain("password");
    expect(DEFAULT_REDACT_KEYS).toContain("api_key");
    expect(DEFAULT_REDACT_KEYS).toContain("authorization");
  });
});
