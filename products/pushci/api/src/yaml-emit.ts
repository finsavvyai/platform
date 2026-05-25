// Shared YAML scalar emission helpers used by the migrate-* converters.
//
// Background (M-006, v1.6.6 audit): `migrate-buildspec.ts::yamlList` used
// to wrap command strings in double quotes while only escaping embedded
// `"`. A buildspec command like `echo foo\nbar` (literal backslash-n)
// was therefore emitted as `"echo foo\nbar"` in the generated pushci.yml,
// and YAML 1.2 double-quoted semantics (spec 5.7) interpret `\n` as a
// real newline. Runners then received a TWO-line string — data
// corruption, not injection.
//
// Strategy (option B from the audit): prefer YAML's single-quoted form
// when the scalar contains a backslash. Single-quoted scalars do NOT
// interpret escape sequences — `'foo\nbar'` is the literal 8 characters
// `foo\nbar`. The only required escape inside single quotes is `'`,
// which is doubled as `''`.
//
// Decision tree (see `escapeScalar`):
//   1. Empty string                          → `''`
//   2. Safe plain scalar (no special chars)  → unquoted
//   3. Contains `\` and not `'`              → single-quoted
//   4. Contains `'` (with or without `\`)    → double-quoted with full
//                                              escape of `\`, `"` and
//                                              control chars
//   5. Otherwise                             → double-quoted (simple)
//
// Keep this file tiny (<200 lines, CLAUDE rule) and dependency-free so
// it stays inside the Workers bundle.
//
// License: Apache-2.0

/**
 * Return a safely-YAML-emittable representation of the given string.
 * Round-trips through a YAML 1.2 parser to the identical input string.
 */
export function escapeScalar(s: string): string {
  if (s === "") return "''";
  // Plain scalars: only a conservative ASCII-ish set. We intentionally
  // disallow leading `-`, `?`, `:` and characters that could trigger
  // flow/indicator parsing. Spaces are allowed because YAML plain
  // scalars can contain internal spaces.
  if (isSafePlainScalar(s)) return s;

  const hasBackslash = s.includes("\\");
  const hasSingle = s.includes("'");
  const hasControl = /[\x00-\x08\x0b-\x1f\x7f]/.test(s);
  const hasNewlineOrTab = /[\n\r\t]/.test(s);

  // Control chars (including \n/\r/\t) cannot appear literally inside
  // a YAML single-quoted scalar — they must be double-quoted and
  // escaped. Fall through to double-quote path.
  const needsDoubleQuote =
    hasSingle || hasControl || hasNewlineOrTab;

  if (hasBackslash && !needsDoubleQuote) {
    // Safe to single-quote: doubling `'` is the only escape. Since
    // hasSingle is false here, no escaping is needed at all.
    return `'${s}'`;
  }

  // Double-quoted form. We must escape: `\`, `"`, and control chars
  // per YAML 1.2.2 § 5.7.
  return `"${escapeDoubleQuoted(s)}"`;
}

/**
 * Emit a YAML flow-style list item for a block sequence — i.e.
 * `<indent>- <scalar>` with the scalar safely escaped.
 */
export function yamlListItem(value: string, indent: string): string {
  return `${indent}- ${escapeScalar(value)}`;
}

/** Emit many list items joined by newline. */
export function yamlList(values: string[], indent: string): string {
  return values.map((v) => yamlListItem(v, indent)).join("\n");
}

// ---------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------

function isSafePlainScalar(s: string): boolean {
  if (s.length === 0) return false;
  // Leading/trailing whitespace is never plain-safe.
  if (/^\s|\s$/.test(s)) return false;
  // Reserved YAML indicator characters as the first char.
  if (/^[-?:,\[\]{}#&*!|>'"%@`]/.test(s)) return false;
  // Strings that look like YAML literals must be quoted.
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(s)) return false;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return false;
  // Disallow any character that needs quoting inside a flow/block
  // context: `:` (mapping separator), `#` (comment), quotes,
  // backslash, control chars, and flow indicators.
  if (/[:#"'\\,\[\]{}]/.test(s)) return false;
  if (/[\x00-\x1f\x7f]/.test(s)) return false;
  return true;
}

function escapeDoubleQuoted(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    switch (ch) {
      case "\\":
        out += "\\\\";
        break;
      case '"':
        out += '\\"';
        break;
      case "\n":
        out += "\\n";
        break;
      case "\r":
        out += "\\r";
        break;
      case "\t":
        out += "\\t";
        break;
      case "\b":
        out += "\\b";
        break;
      case "\f":
        out += "\\f";
        break;
      case "\0":
        out += "\\0";
        break;
      default:
        if (code < 0x20 || code === 0x7f) {
          out += `\\x${code.toString(16).padStart(2, "0")}`;
        } else {
          out += ch;
        }
    }
  }
  return out;
}
