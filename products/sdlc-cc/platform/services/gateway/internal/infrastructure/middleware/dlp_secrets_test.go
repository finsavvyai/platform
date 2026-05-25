// Tests for the Claude Team B1 code-secret regex pack. Each table
// row asserts that a typical "user pasted this into Claude" string
// fires exactly the expected detection class. False-positive
// resistance is exercised by the negative cases at the bottom.
package middleware

import (
	"strings"
	"testing"
)

func TestDetector_CodeSecrets(t *testing.T) {
	d := NewDetector()
	cases := []struct {
		name    string
		input   string
		wantHit string
	}{
		{
			name:    "anthropic key",
			input:   `ANTHROPIC_API_KEY=sk-ant-api03-AbCdEf01234567890123456789012345`,
			wantHit: "anthropic_key",
		},
		{
			name:    "openai project key",
			input:   `client = OpenAI(api_key="sk-proj-AbCd1234EfGh5678IjKl9012MnOp3456")`,
			wantHit: "openai_key",
		},
		{
			name:    "aws access key",
			input:   `aws_access_key_id = AKIAIOSFODNN7EXAMPLE`,
			wantHit: "aws_access_key",
		},
		{
			name:    "github personal access token",
			input:   `git remote set-url origin https://ghp_AbCd0123EfGh4567IjKl8901MnOp2345QrSt:x@github.com/`,
			wantHit: "github_token",
		},
		{
			name:    "slack bot token",
			input:   `SLACK_BOT_TOKEN=xoxb-1234567890-0987654321-AbCdEfGhIjKlMnOpQrStUvWx`,
			wantHit: "slack_token",
		},
		{
			name:    "stripe live key",
			input:   `STRIPE_SECRET=sk_live_51AbCdEfGhIjKlMnOpQrStUvWxYz1234`,
			wantHit: "stripe_key",
		},
		{
			name:    "jwt",
			input:   `Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`,
			wantHit: "jwt",
		},
		{
			name:    "private key block",
			input:   "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAAB\n-----END OPENSSH PRIVATE KEY-----",
			wantHit: "private_key_block",
		},
		{
			name:    "postgres connection string",
			input:   `DATABASE_URL=postgres://admin:hunter2@db.internal:5432/billing`,
			wantHit: "db_connection_string",
		},
		{
			name:    "gcp service account marker",
			input:   `{"type": "service_account", "project_id": "demo"}`,
			wantHit: "gcp_service_account",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			matches := d.Detect(tc.input)
			if len(matches) == 0 {
				t.Fatalf("expected at least one match for %q in %q", tc.wantHit, tc.input)
			}
			seen := make([]string, 0, len(matches))
			for _, m := range matches {
				seen = append(seen, m.Type)
				if m.Type == tc.wantHit {
					return
				}
			}
			t.Fatalf("expected match type %q, got %v", tc.wantHit, seen)
		})
	}
}

// TestDetector_CodeSecrets_FalsePositives covers strings that look
// like secrets but should NOT trip the pack — important so we don't
// mangle benign source code.
func TestDetector_CodeSecrets_FalsePositives(t *testing.T) {
	d := NewDetector()
	negatives := []string{
		// Benign source code — should not fire any code-secret class.
		`const greeting = "hello world"`,
		// SHA-1 of a random commit — 40 hex chars, no slashes/equals,
		// shouldn't match aws_secret_key (which requires base64).
		`commit 1234567890abcdef1234567890abcdef12345678`,
		// Plain English text containing 'sk' but not a key shape.
		`The framework supports multiple SDKs.`,
	}
	for _, n := range negatives {
		t.Run(strings.SplitN(n, " ", 3)[0], func(t *testing.T) {
			matches := d.Detect(n)
			for _, m := range matches {
				switch m.Type {
				case "anthropic_key", "openai_key", "aws_access_key",
					"aws_secret_key", "github_token", "slack_token",
					"stripe_key", "jwt", "private_key_block",
					"db_connection_string", "gcp_service_account":
					t.Fatalf("false positive: %q matched %s in %q",
						m.Value, m.Type, n)
				}
			}
		})
	}
}
