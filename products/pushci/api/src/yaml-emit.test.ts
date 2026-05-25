// Tests for the shared YAML scalar emitter. Covers the decision tree in
// `yaml-emit.ts` and includes round-trip assertions — emit a scalar,
// parse it back with a YAML-1.2-conformant mini parser, verify the
// parsed value equals the original input.
//
// Context: fixes v1.6.6 audit M-006 (migrate-buildspec silently turned
// literal `\n` in commands into real newlines).

import { describe, it, expect } from "vitest";
import { escapeScalar, yamlList, yamlListItem } from "./yaml-emit";

// Minimal YAML-1.2 scalar parser sufficient for testing our emitter
// output. Handles: plain, single-quoted (with `''` doubling),
// double-quoted (with spec 5.7 escape sequences).
function parseYamlScalar(s: string): string {
  if (s.length === 0) return "";
  const first = s[0];
  if (first === "'") {
    if (!s.endsWith("'")) throw new Error("unterminated single-quote");
    const inner = s.slice(1, -1);
    return inner.replace(/''/g, "'");
  }
  if (first === '"') {
    if (!s.endsWith('"')) throw new Error("unterminated double-quote");
    return unescapeDoubleQuoted(s.slice(1, -1));
  }
  return s;
}

function unescapeDoubleQuoted(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = s[++i];
    switch (next) {
      case "\\": out += "\\"; break;
      case '"':  out += '"';  break;
      case "n":  out += "\n"; break;
      case "r":  out += "\r"; break;
      case "t":  out += "\t"; break;
      case "b":  out += "\b"; break;
      case "f":  out += "\f"; break;
      case "0":  out += "\0"; break;
      case "x": {
        const hex = s.slice(i + 1, i + 3);
        out += String.fromCharCode(parseInt(hex, 16));
        i += 2;
        break;
      }
      default:
        throw new Error(`unsupported escape \\${next}`);
    }
  }
  return out;
}

function roundTrip(input: string): string {
  return parseYamlScalar(escapeScalar(input));
}

describe("escapeScalar — plain forms", () => {
  it("empty string emits quoted empty", () => {
    expect(escapeScalar("")).toBe("''");
  });

  it("simple ASCII word stays unquoted", () => {
    expect(escapeScalar("foo")).toBe("foo");
  });

  it("string with internal spaces stays unquoted", () => {
    expect(escapeScalar("hello world")).toBe("hello world");
  });

  it("numeric-looking strings are quoted", () => {
    expect(escapeScalar("42")).toBe('"42"');
  });

  it("boolean-looking strings are quoted", () => {
    expect(escapeScalar("true")).toBe('"true"');
    expect(escapeScalar("YES")).toBe('"YES"');
  });

  it("null-looking string is quoted", () => {
    expect(escapeScalar("null")).toBe('"null"');
  });

  it("leading dash is quoted", () => {
    expect(escapeScalar("-flag")).toBe('"-flag"');
  });

  it("leading whitespace is quoted", () => {
    expect(escapeScalar(" leading")).toBe('" leading"');
  });
});

describe("escapeScalar — colons, hashes, flow indicators", () => {
  it("colon triggers double-quote", () => {
    expect(escapeScalar("with: colon")).toBe('"with: colon"');
  });

  it("hash triggers double-quote", () => {
    expect(escapeScalar("a # b")).toBe('"a # b"');
  });

  it("flow brackets trigger quoting", () => {
    expect(escapeScalar("[1,2]")).toBe('"[1,2]"');
  });
});

describe("escapeScalar — backslash handling (M-006 fix)", () => {
  it("literal backslash-n uses single quotes", () => {
    // JS literal `foo\\nbar` is the 7-char string foo\nbar (literal \).
    const input = "foo\\nbar";
    expect(escapeScalar(input)).toBe("'foo\\nbar'");
  });

  it("Windows-style path with literal backslashes uses single quotes", () => {
    const input = "C:\\Users\\bob\\app";
    // Contains `:` too — but single-quoted form is valid; however colon
    // needs quoting and single-quote provides it. Expected: single-quoted.
    expect(escapeScalar(input)).toBe("'C:\\Users\\bob\\app'");
  });

  it("real newline uses double-quote form with \\n", () => {
    const input = "line1\nline2";
    expect(escapeScalar(input)).toBe('"line1\\nline2"');
  });

  it("real tab uses double-quote form with \\t", () => {
    const input = "a\tb";
    expect(escapeScalar(input)).toBe('"a\\tb"');
  });
});

describe("escapeScalar — quote characters", () => {
  it("single quote alone uses double quotes (no escape needed)", () => {
    expect(escapeScalar("quote'inside")).toBe('"quote\'inside"');
  });

  it("double quote alone uses double quotes with escape", () => {
    expect(escapeScalar('say "hi"')).toBe('"say \\"hi\\""');
  });

  it("both backslash and single quote → double quote + escape backslash", () => {
    const input = "both\\and'";
    // `both\and'` → needs double-quote form (contains `'`). Backslash
    // must be escaped as \\. Single quote does not need escape in DQ.
    expect(escapeScalar(input)).toBe('"both\\\\and\'"');
  });
});

describe("escapeScalar — round-trip", () => {
  const cases: string[] = [
    "foo",
    "hello world",
    "with: colon",
    "foo\\nbar",              // literal backslash-n (the M-006 bug)
    "C:\\Users\\bob",
    "line1\nline2",
    "a\tb\rc",
    "quote'inside",
    'say "hi"',
    "both\\and'",
    "#comment-looking",
    "- dash first",
    "42",
    "true",
    "",
    "'",
    "\\",
    "\\\\",
    "rm -rf ~/.m2/repository/com/\\foo",
  ];
  for (const c of cases) {
    it(`round-trips ${JSON.stringify(c)}`, () => {
      expect(roundTrip(c)).toBe(c);
    });
  }
});

describe("yamlList / yamlListItem", () => {
  it("emits one item per line with indent", () => {
    const out = yamlList(["npm install", "npm test"], "      ");
    expect(out).toBe("      - npm install\n      - npm test");
  });

  it("escapes each item independently", () => {
    const out = yamlList(["simple", "foo\\nbar", "with: colon"], "  ");
    expect(out).toBe("  - simple\n  - 'foo\\nbar'\n  - \"with: colon\"");
  });

  it("yamlListItem produces single entry", () => {
    expect(yamlListItem("x", "    ")).toBe("    - x");
  });
});
