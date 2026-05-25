package actions

import (
	"os"
	"strings"
	"testing"
)

func TestWriteSecretsFile_Empty(t *testing.T) {
	path, err := writeSecretsFile(nil)
	if err != nil {
		t.Fatal(err)
	}
	if path != "" {
		t.Errorf("empty secrets should return empty path, got %q", path)
		_ = os.Remove(path)
	}
}

func TestWriteSecretsFile_WritesAndChmods(t *testing.T) {
	secrets := map[string]string{
		"GITHUB_TOKEN": "ghp_xyz",
		"NPM_TOKEN":    "npm_abc",
	}
	path, err := writeSecretsFile(secrets)
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(path)

	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	contents := string(body)
	if !strings.Contains(contents, "GITHUB_TOKEN=ghp_xyz") {
		t.Errorf("missing GITHUB_TOKEN line: %q", contents)
	}
	if !strings.Contains(contents, "NPM_TOKEN=npm_abc") {
		t.Errorf("missing NPM_TOKEN line: %q", contents)
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if perm := info.Mode().Perm(); perm != 0o600 {
		t.Errorf("expected 0600 permissions, got %o", perm)
	}
}

func TestWriteSecretsFile_DeterministicOrder(t *testing.T) {
	secrets := map[string]string{
		"ZETA":  "1",
		"ALPHA": "2",
		"GAMMA": "3",
	}
	// Run twice — output must be byte-identical because keys are sorted.
	a, err := writeSecretsFile(secrets)
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(a)
	b, err := writeSecretsFile(secrets)
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(b)
	ab, _ := os.ReadFile(a)
	bb, _ := os.ReadFile(b)
	if string(ab) != string(bb) {
		t.Errorf("expected deterministic output, got:\n%s\nvs\n%s", ab, bb)
	}
	// First line must be ALPHA after sort.
	if !strings.HasPrefix(string(ab), "ALPHA=") {
		t.Errorf("expected ALPHA first, got: %s", ab)
	}
}

func TestWriteSecretsFile_EscapesNewlines(t *testing.T) {
	secrets := map[string]string{
		"MULTILINE": "line1\nline2\nline3",
	}
	path, err := writeSecretsFile(secrets)
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(path)
	body, _ := os.ReadFile(path)
	if strings.Count(string(body), "\n") != 1 {
		t.Errorf("multiline value should collapse to one file line, got: %q", body)
	}
	if !strings.Contains(string(body), `\n`) {
		t.Errorf("expected literal \\n escape sequence, got: %q", body)
	}
}

func TestWriteEnvFile_Empty(t *testing.T) {
	path, err := writeEnvFile(nil)
	if err != nil {
		t.Fatal(err)
	}
	if path != "" {
		t.Errorf("empty env should return empty path, got %q", path)
	}
}

func TestWriteEnvFile_RoundTrip(t *testing.T) {
	env := map[string]string{
		"NODE_ENV":     "test",
		"BUILD_TARGET": "production",
	}
	path, err := writeEnvFile(env)
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(path)
	body, _ := os.ReadFile(path)
	for k, v := range env {
		if !strings.Contains(string(body), k+"="+v) {
			t.Errorf("missing %s=%s in env file: %s", k, v, body)
		}
	}
	info, _ := os.Stat(path)
	if perm := info.Mode().Perm(); perm != 0o600 {
		t.Errorf("expected 0600 permissions, got %o", perm)
	}
}
