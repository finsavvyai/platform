// Behavior tests for the Claude Team B3 code-aware redact label
// format. These prove that redacting PII inside source-code-shaped
// strings (Python assignments, JSON values, YAML mappings, shell
// exports, .env entries) leaves the surrounding code structure
// intact — variable names, quotes, indentation, and language
// idioms all survive unchanged.
package middleware

import (
	"strings"
	"testing"
)

func TestRedact_PreservesCodeStructure(t *testing.T) {
	d := NewDetector()
	cases := []struct {
		name      string
		input     string
		mustHave  []string
		mustNotHave []string
	}{
		{
			name:  "python assignment with anthropic key",
			input: `api_key = "sk-ant-api03-AbCdEf01234567890123456789012345"`,
			mustHave: []string{
				`api_key = "`,            // var name + open quote
				`<ANTHROPIC_KEY>`,        // placeholder
				`"`,                      // close quote
			},
			mustNotHave: []string{
				"sk-ant-api03",           // raw key
				"[REDACTED",              // legacy label
			},
		},
		{
			name:  "JSON value with email",
			input: `{"user": "alice@example.com"}`,
			mustHave: []string{
				`"user": "`,
				`<EMAIL>`,
				`"}`,
			},
			mustNotHave: []string{"alice@example.com", "[REDACTED"},
		},
		{
			name:  "shell export with AWS key",
			input: `export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE`,
			mustHave: []string{
				"export AWS_ACCESS_KEY_ID=",
				"<AWS_ACCESS_KEY>",
			},
			mustNotHave: []string{"AKIAIOSFODNN7EXAMPLE", "[REDACTED", "[ "},
		},
		{
			name:  "YAML mapping with stripe key",
			input: `stripe_secret: sk_live_51AbCdEfGhIjKlMnOpQrStUvWxYz1234`,
			mustHave: []string{
				"stripe_secret: ",
				"<STRIPE_KEY>",
			},
			mustNotHave: []string{"sk_live_51AbCdEf", "[REDACTED"},
		},
		{
			name:  ".env entry with github token",
			input: `GH_TOKEN=ghp_AbCd0123EfGh4567IjKl8901MnOp2345QrSt`,
			mustHave: []string{
				"GH_TOKEN=",
				"<GITHUB_TOKEN>",
			},
			mustNotHave: []string{"ghp_AbCd0123", "[REDACTED"},
		},
		{
			name:  "indented JSON inside markdown fence",
			input: "```json\n  {\n    \"db\": \"postgres://admin:hunter2@db.internal:5432/x\"\n  }\n```",
			mustHave: []string{
				"```json",                // language tag preserved
				`    "db": "`,            // 4-space indent preserved
				"<DB_CONNECTION_STRING>", // placeholder
				"```",                    // closing fence
			},
			mustNotHave: []string{"hunter2", "admin:hunter2", "[REDACTED"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out, _, _ := d.Apply(tc.input, ActionRedact)
			for _, want := range tc.mustHave {
				if !strings.Contains(out, want) {
					t.Errorf("missing expected fragment %q in output:\n%s", want, out)
				}
			}
			for _, banned := range tc.mustNotHave {
				if strings.Contains(out, banned) {
					t.Errorf("output still contains forbidden fragment %q:\n%s", banned, out)
				}
			}
		})
	}
}

// TestRedact_LabelHasNoBracketChars ensures the redact label avoids
// `[` and `]` so it doesn't break shells, regex literals, or array
// destructuring in pasted code. This is the explicit B3 contract:
// the label is a valid placeholder, not an obviously-broken artefact.
func TestRedact_LabelHasNoBracketChars(t *testing.T) {
	d := NewDetector()
	out, _, _ := d.Apply("contact alice@example.com please", ActionRedact)
	for _, c := range []string{"[", "]"} {
		if strings.Contains(out, c) {
			t.Errorf("redact label must not contain %q (breaks shells); got %q", c, out)
		}
	}
}
