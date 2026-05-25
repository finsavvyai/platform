package aicommit

import "testing"

func TestDetectClaudeCoAuthor(t *testing.T) {
	d := Detect(Commit{
		AuthorName:  "Shahar",
		AuthorEmail: "info@finsavvyai.com",
		Message: `fix(auth): rotate session secret on logout

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`,
	})
	if d.Tool != ToolClaudeCode {
		t.Errorf("expected ToolClaudeCode, got %q (evidence=%s)", d.Tool, d.Evidence)
	}
	if !d.IsAI() {
		t.Error("expected IsAI true")
	}
	if d.Confidence < 0.9 {
		t.Errorf("expected high confidence, got %f", d.Confidence)
	}
}

func TestDetectCursorCoAuthor(t *testing.T) {
	d := Detect(Commit{
		Message: `feat: add user dashboard

Co-Authored-By: cursor-agent <noreply@cursor.sh>`,
	})
	if d.Tool != ToolCursor {
		t.Errorf("expected ToolCursor, got %q", d.Tool)
	}
}

func TestDetectCopilotEmail(t *testing.T) {
	d := Detect(Commit{
		AuthorName:     "github-copilot[bot]",
		AuthorEmail:    "198982749+github-copilot[bot]@users.noreply.github.com",
		CommitterName:  "github-copilot[bot]",
		CommitterEmail: "198982749+github-copilot[bot]@users.noreply.github.com",
		Message:        "feat: small refactor",
	})
	if d.Tool != ToolCopilot {
		t.Errorf("expected ToolCopilot, got %q", d.Tool)
	}
}

func TestDetectBodyOnly(t *testing.T) {
	d := Detect(Commit{
		AuthorEmail: "dev@example.com",
		Message:     "Some change\n\n🤖 Generated with Claude Code",
	})
	if d.Tool != ToolClaudeCode {
		t.Errorf("expected ToolClaudeCode, got %q", d.Tool)
	}
	if d.Confidence > 0.8 {
		t.Errorf("body-only signal should be < 0.8 confidence, got %f", d.Confidence)
	}
}

func TestDetectHumanCommitReturnsUnknown(t *testing.T) {
	d := Detect(Commit{
		AuthorName:  "Shahar",
		AuthorEmail: "shahar@example.com",
		Message:     "fix bug in login flow",
	})
	if d.IsAI() {
		t.Errorf("expected unknown, got %q (evidence=%s)", d.Tool, d.Evidence)
	}
}

func TestDetectAider(t *testing.T) {
	d := Detect(Commit{
		Message: "wip\n\nCo-Authored-By: aider <noreply@aider.chat>",
	})
	if d.Tool != ToolAider {
		t.Errorf("expected ToolAider, got %q", d.Tool)
	}
}
