package voice

import "testing"

func TestParseIntent_DirectVerbs(t *testing.T) {
	cases := map[string]string{
		"deploy":   "deploy",
		"rollback": "rollback",
		"status":   "status",
	}
	for input, want := range cases {
		got := ParseIntent(input)
		if got.Verb != want {
			t.Errorf("ParseIntent(%q) = %q; want %q", input, got.Verb, want)
		}
		if got.Confidence != 1.0 {
			t.Errorf("ParseIntent(%q) confidence = %f; want 1.0", input, got.Confidence)
		}
	}
}

func TestParseIntent_PhraseMatch(t *testing.T) {
	cases := map[string]string{
		"please deploy the build now":   "deploy",
		"can you roll back the release": "rollback",
		"show me the current status":    "status",
		"kick off the pipeline":         "run",
	}
	for input, want := range cases {
		got := ParseIntent(input)
		if got.Verb != want {
			t.Errorf("ParseIntent(%q) = %q; want %q", input, got.Verb, want)
		}
	}
}

func TestParseIntent_UnknownReturnsEmpty(t *testing.T) {
	got := ParseIntent("hello world how are you doing today")
	if got.Verb != "" || got.Confidence != 0 {
		t.Fatalf("unknown text should return empty intent; got %+v", got)
	}
}

func TestParseIntent_RollbackBeatsDeploy(t *testing.T) {
	// "rollback the deploy" must match rollback (more specific
	// rule first), not deploy.
	got := ParseIntent("rollback the deploy")
	if got.Verb != "rollback" {
		t.Fatalf("expected rollback to win over deploy; got %q", got.Verb)
	}
}

func TestParseIntent_EmptyInput(t *testing.T) {
	if got := ParseIntent("   "); got.Verb != "" {
		t.Fatalf("empty/whitespace input should return empty; got %+v", got)
	}
}
