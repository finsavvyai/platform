// Centralized Claude model IDs.
//
// Why this file exists: every call site in api/src that talks to
// Anthropic used to hardcode a dated snapshot ID like
// `claude-haiku-4-5-20251001`. When Anthropic deprecates that
// specific snapshot (typically 12 months after release), every
// hardcoded call breaks silently with a 400 from the Messages API.
//
// Fix: import from here. When the model alias changes, you update
// ONE file and every consumer inherits it. Call sites that need a
// different model (e.g. Sonnet for heavy reasoning) export their
// own constant and follow the same pattern.
//
// Anthropic stable alias conventions:
//
//   * `claude-haiku-4-5`   — current Haiku family, auto-follows snapshots
//   * `claude-sonnet-4-6`  — current Sonnet family
//   * `claude-opus-4-6`    — current Opus family
//
// The dated form (`claude-haiku-4-5-20251001`) remains pinned to a
// specific snapshot and should only be used when deterministic
// behavior matters more than staying current.

/** CLAUDE_HAIKU_MODEL is the default model for all "fast, cheap,
 *  good enough" paths: NLP intent, autofix, skill explanations,
 *  diagnose, channel message parsing. */
export const CLAUDE_HAIKU_MODEL = "claude-haiku-4-5";

/** CLAUDE_SONNET_MODEL is reserved for tasks that genuinely need
 *  deeper reasoning — impact analysis, architectural refactors,
 *  multi-file remediation. No current call site uses this yet, but
 *  the slot exists so call sites don't start hardcoding Sonnet
 *  strings all over again. */
export const CLAUDE_SONNET_MODEL = "claude-sonnet-4-6";

/** CLAUDE_OPUS_MODEL is the heavyweight option. Costly — use only
 *  when the user explicitly opts in. */
export const CLAUDE_OPUS_MODEL = "claude-opus-4-6";
