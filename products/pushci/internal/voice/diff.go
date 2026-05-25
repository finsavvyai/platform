package voice

import (
	"context"
	osexec "os/exec"
	"strings"
)

// DiffSummary returns a short, redacted summary of `git diff
// <ref>..HEAD --stat` suitable for passing to AICommentary as the
// hint argument. Caps the result at ~500 chars so a giant
// refactor doesn't blow the LLM's context budget. ref defaults
// to HEAD~1 — i.e. "the change you just made" — when empty.
//
// The summary is run through Redact() before return so any
// secrets that snuck into a commit (filenames containing tokens,
// hostnames in changed paths, etc.) don't reach the model.
//
// Returns "" on any git failure — caller falls back to a non-
// diff-aware prompt.
func DiffSummary(ctx context.Context, ref string) string {
	if ref == "" {
		ref = "HEAD~1"
	}
	out, err := osexec.CommandContext(ctx, "git", "diff", "--stat", ref+"..HEAD").Output()
	if err != nil {
		return ""
	}
	s := strings.TrimSpace(string(out))
	if s == "" {
		return ""
	}
	if len(s) > 500 {
		s = s[:500] + " ..."
	}
	return Redact(s)
}

// JokeAboutDiff asks the persona's LLM for one in-character line
// commenting on the diff. Uses AICommentary internally so all
// safety + sanitization paths apply. Returns "" when AI isn't
// configured or the model produced something the safety filter
// rejected — caller speaks a canned phrase instead.
func JokeAboutDiff(ctx context.Context, ai AIClient, p Persona, ref string) string {
	hint := DiffSummary(ctx, ref)
	if hint == "" {
		hint = "(no diff context available)"
	}
	line := AICommentary(ctx, ai, p, EventDeploy, hint)
	if line != "" && !SafetyOK(line) {
		return ""
	}
	return line
}
