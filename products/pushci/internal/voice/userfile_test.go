package voice

import (
	"os"
	"path/filepath"
	"testing"
)

func writeUserFile(t *testing.T, body string) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "voices.yml")
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PUSHCI_VOICE_FILE", path)
	return path
}

func TestLoadUserPersonas_ParsesValidYAML(t *testing.T) {
	writeUserFile(t, `personas:
  - name: pirate-style
    voice: Daniel
    description: Pirate-themed deploy commentary
    phrases:
      start: ["Aye, hoist the colors. Deploying."]
      pass: ["Ye scurvy tests passed."]
      fail: ["Avast, the build hath sunk."]
`)
	got := LoadUserPersonas()
	if len(got) != 1 {
		t.Fatalf("want 1 persona; got %d", len(got))
	}
	p := got[0]
	if p.Name != "pirate-style" || p.VoiceID != "Daniel" {
		t.Errorf("unexpected fields: %+v", p)
	}
	if line := p.Phrases[EventStart][0]; line != "Aye, hoist the colors. Deploying." {
		t.Errorf("EventStart line wrong: %q", line)
	}
}

func TestLoadUserPersonas_DropsInvalidEntries(t *testing.T) {
	writeUserFile(t, `personas:
  - name: ""
    phrases: {start: ["x"]}
  - name: empty-phrases
    phrases: {}
  - name: valid
    phrases: {start: ["hi"]}
`)
	got := LoadUserPersonas()
	if len(got) != 1 || got[0].Name != "valid" {
		t.Fatalf("want only the valid persona; got %+v", got)
	}
}

func TestPersonaByName_UserOverridesBuiltin(t *testing.T) {
	writeUserFile(t, `personas:
  - name: curb-style
    voice: Karen
    description: User-overridden curb
    phrases:
      start: ["Override line"]
`)
	got := PersonaByName("curb-style")
	if got.VoiceID != "Karen" {
		t.Fatalf("user override didn't win: voice=%q", got.VoiceID)
	}
	if got.LineFor(EventStart) != "Override line" {
		t.Fatalf("user override phrase missing: %+v", got.Phrases)
	}
}

func TestListPersonas_IncludesUserAndBuiltins(t *testing.T) {
	writeUserFile(t, `personas:
  - name: pirate-style
    voice: Daniel
    phrases: {start: ["Arrr."]}
`)
	names := map[string]bool{}
	for _, p := range ListPersonas() {
		names[p.Name] = true
	}
	for _, want := range []string{"pirate-style", "curb-style", "office-style", "deadpan-tech", "deadpan-narrator"} {
		if !names[want] {
			t.Errorf("ListPersonas missing %q; got %v", want, names)
		}
	}
}

func TestLoadUserPersonas_MissingFileReturnsNil(t *testing.T) {
	t.Setenv("PUSHCI_VOICE_FILE", filepath.Join(t.TempDir(), "does-not-exist.yml"))
	if got := LoadUserPersonas(); got != nil {
		t.Fatalf("expected nil for missing file; got %+v", got)
	}
}
