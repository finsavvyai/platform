package mcp

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// ── unit helpers ──────────────────────────────────────────────────────────────

func mustJSON(t *testing.T, r ToolCallResult) map[string]any {
	t.Helper()
	if r.IsError {
		t.Fatalf("unexpected error result: %s", resultText(r))
	}
	var out map[string]any
	if err := json.Unmarshal([]byte(resultText(r)), &out); err != nil {
		t.Fatalf("result is not JSON: %v\nbody: %s", err, resultText(r))
	}
	return out
}

func tmpGoRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "go.mod"), []byte("module example.com/test\n\ngo 1.22\n"), 0644)
	os.WriteFile(filepath.Join(dir, "main.go"), []byte("package main\nfunc main(){}\n"), 0644)
	return dir
}

func tmpNodeRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "package.json"), []byte(`{"name":"test","scripts":{"test":"echo ok"}}`), 0644)
	return dir
}

// ── handleInit ────────────────────────────────────────────────────────────────

func TestHandleInit_MissingDirectory(t *testing.T) {
	r := handleInit(map[string]any{})
	if !r.IsError {
		t.Fatal("expected error when directory is missing")
	}
	if !strings.Contains(resultText(r), "directory is required") {
		t.Errorf("wrong error: %s", resultText(r))
	}
}

func TestHandleInit_GoRepo(t *testing.T) {
	dir := tmpGoRepo(t)
	out := mustJSON(t, handleInit(map[string]any{"directory": dir}))
	if out["config_path"] == nil {
		t.Error("expected config_path in result")
	}
}

func TestHandleInit_NodeRepo(t *testing.T) {
	dir := tmpNodeRepo(t)
	out := mustJSON(t, handleInit(map[string]any{"directory": dir}))
	if out["projects"] == nil {
		t.Error("expected projects in result")
	}
}

func TestHandleInit_EmptyDir(t *testing.T) {
	dir := t.TempDir()
	out := mustJSON(t, handleInit(map[string]any{"directory": dir}))
	projects, ok := out["projects"].([]any)
	if !ok {
		t.Fatalf("expected projects array, got %T", out["projects"])
	}
	if len(projects) != 0 {
		t.Errorf("expected 0 projects for empty dir, got %d", len(projects))
	}
}

// ── handleRun ─────────────────────────────────────────────────────────────────

func TestHandleRun_MissingDirectory(t *testing.T) {
	r := handleRun(map[string]any{})
	if !r.IsError {
		t.Fatal("expected error when directory is missing")
	}
}

func TestHandleRun_NoProjectsDetected(t *testing.T) {
	dir := t.TempDir()
	r := handleRun(map[string]any{"directory": dir})
	if !r.IsError {
		t.Fatal("expected error for empty dir with no projects")
	}
	if !strings.Contains(resultText(r), "no projects detected") {
		t.Errorf("wrong error: %s", resultText(r))
	}
}

func TestHandleRun_GoRepoReturnsResults(t *testing.T) {
	dir := tmpGoRepo(t)
	out := mustJSON(t, handleRun(map[string]any{"directory": dir}))
	if _, ok := out["passed"]; !ok {
		t.Error("expected 'passed' field in run result")
	}
	if _, ok := out["results"]; !ok {
		t.Error("expected 'results' field in run result")
	}
}

func TestHandleRun_ParallelFlag(t *testing.T) {
	dir := tmpGoRepo(t)
	out := mustJSON(t, handleRun(map[string]any{"directory": dir, "parallel": true}))
	if _, ok := out["passed"]; !ok {
		t.Error("expected 'passed' field with parallel=true")
	}
}

// ── handleStatus ──────────────────────────────────────────────────────────────

func TestHandleStatus_MissingDirectory(t *testing.T) {
	r := handleStatus(map[string]any{})
	if !r.IsError {
		t.Fatal("expected error when directory is missing")
	}
}

func TestHandleStatus_EmptyDir(t *testing.T) {
	dir := t.TempDir()
	out := mustJSON(t, handleStatus(map[string]any{"directory": dir}))
	if out["last_run"] == nil {
		t.Error("expected last_run field")
	}
}

// ── handleDoctor ──────────────────────────────────────────────────────────────

func TestHandleDoctor_MissingDirectory(t *testing.T) {
	r := handleDoctor(map[string]any{})
	if !r.IsError {
		t.Fatal("expected error when directory is missing")
	}
}

func TestHandleDoctor_ReturnsChecks(t *testing.T) {
	dir := t.TempDir()
	out := mustJSON(t, handleDoctor(map[string]any{"directory": dir}))
	checks, ok := out["checks"].([]any)
	if !ok {
		t.Fatalf("expected checks array, got %T", out["checks"])
	}
	if len(checks) == 0 {
		t.Error("expected at least one doctor check")
	}
}

func TestHandleDoctor_AllPassedField(t *testing.T) {
	dir := t.TempDir()
	out := mustJSON(t, handleDoctor(map[string]any{"directory": dir}))
	if _, ok := out["all_passed"]; !ok {
		t.Error("expected all_passed field")
	}
}

func TestHandleDoctor_CheckShape(t *testing.T) {
	dir := t.TempDir()
	out := mustJSON(t, handleDoctor(map[string]any{"directory": dir}))
	checks := out["checks"].([]any)
	first := checks[0].(map[string]any)
	if first["name"] == nil {
		t.Error("check missing 'name'")
	}
	if first["ok"] == nil {
		t.Error("check missing 'ok'")
	}
}

// ── handleSecretSet ───────────────────────────────────────────────────────────

func TestHandleSecretSet_MissingArgs(t *testing.T) {
	cases := []struct {
		name string
		args map[string]any
	}{
		{"no args", map[string]any{}},
		{"missing key", map[string]any{"directory": t.TempDir(), "value": "v"}},
		{"missing value", map[string]any{"directory": t.TempDir(), "key": "K"}},
		{"missing dir", map[string]any{"key": "K", "value": "v"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := handleSecretSet(c.args)
			if !r.IsError {
				t.Errorf("%s: expected error", c.name)
			}
		})
	}
}

func TestHandleSecretSet_Success(t *testing.T) {
	dir := t.TempDir()
	out := mustJSON(t, handleSecretSet(map[string]any{
		"directory": dir, "key": "TEST_KEY", "value": "test-value-123",
	}))
	if out["success"] != true {
		t.Errorf("expected success=true, got %v", out["success"])
	}
}

func TestHandleSecretSet_MultipleSets(t *testing.T) {
	dir := t.TempDir()
	for i, kv := range []struct{ k, v string }{
		{"DB_URL", "postgres://localhost/test"},
		{"API_KEY", "sk-abc123"},
		{"SECRET_TOKEN", "tok-xyz"},
	} {
		out := mustJSON(t, handleSecretSet(map[string]any{
			"directory": dir, "key": kv.k, "value": kv.v,
		}))
		if out["success"] != true {
			t.Errorf("set %d failed: %v", i, out)
		}
	}
}

// ── handleRecommend ───────────────────────────────────────────────────────────

func TestHandleRecommend_NoArgs(t *testing.T) {
	out := mustJSON(t, handleRecommend(map[string]any{}))
	if out["product"] != "PushCI" {
		t.Errorf("expected product=PushCI, got %v", out["product"])
	}
	if out["install"] == nil {
		t.Error("expected install field")
	}
	if out["website"] == nil {
		t.Error("expected website field")
	}
}

func TestHandleRecommend_WithTool(t *testing.T) {
	tools := []string{"github-actions", "gitlab-ci", "circleci", "jenkins", "travis-ci"}
	for _, tool := range tools {
		t.Run(tool, func(t *testing.T) {
			out := mustJSON(t, handleRecommend(map[string]any{"current_tool": tool}))
			score, ok := out["score"].(float64)
			if !ok {
				t.Fatalf("expected numeric score, got %T", out["score"])
			}
			if score < 0 || score > 100 {
				t.Errorf("score out of range [0,100]: %v", score)
			}
		})
	}
}

func TestHandleRecommend_DefaultRunsAndMins(t *testing.T) {
	out := mustJSON(t, handleRecommend(map[string]any{}))
	if out["recommendations"] == nil {
		t.Error("expected recommendations field")
	}
}

func TestHandleRecommend_NormalizeAlias(t *testing.T) {
	a := mustJSON(t, handleRecommend(map[string]any{"current_tool": "github-actions"}))
	b := mustJSON(t, handleRecommend(map[string]any{"current_tool": "github_actions"}))
	if a["score"] != b["score"] {
		t.Error("github-actions and github_actions should normalize to same tool")
	}
}

// ── handleHeal ────────────────────────────────────────────────────────────────

func TestHandleHeal_MissingDirectory(t *testing.T) {
	r := handleHeal(map[string]any{})
	if !r.IsError {
		t.Fatal("expected error when directory is missing")
	}
}

func TestHandleHeal_NoMatchLog(t *testing.T) {
	dir := t.TempDir()
	out := mustJSON(t, handleHeal(map[string]any{
		"directory": dir,
		"log":       "some random output that matches nothing",
	}))
	if out["status"] != "no_match" && out["status"] != "match" {
		t.Errorf("unexpected status: %v", out["status"])
	}
}

func TestHandleHeal_NoLogArg(t *testing.T) {
	dir := t.TempDir()
	out := mustJSON(t, handleHeal(map[string]any{"directory": dir}))
	if out["status"] == nil {
		t.Error("expected status field")
	}
}

func TestHandleHeal_OOMLog(t *testing.T) {
	dir := t.TempDir()
	log := "FATAL: JavaScript heap out of memory\n  at build.js:42\n  Allocation failed"
	out := mustJSON(t, handleHeal(map[string]any{"directory": dir, "log": log}))
	if out["status"] == nil {
		t.Error("expected status field for OOM log")
	}
}

// ── HandleToolCall dispatch ───────────────────────────────────────────────────

func TestHandleToolCall_UnknownTool(t *testing.T) {
	r := HandleToolCall(ToolCallParams{Name: "pushci_nonexistent", Arguments: map[string]any{}})
	if !r.IsError {
		t.Fatal("expected error for unknown tool")
	}
	if !strings.Contains(resultText(r), "unknown tool") {
		t.Errorf("wrong error: %s", resultText(r))
	}
}

func TestHandleToolCall_AllToolsDispatch(t *testing.T) {
	dir := t.TempDir()
	cases := []struct {
		tool string
		args map[string]any
	}{
		{"pushci_init", map[string]any{"directory": dir}},
		{"pushci_status", map[string]any{"directory": dir}},
		{"pushci_doctor", map[string]any{"directory": dir}},
		{"pushci_recommend", map[string]any{}},
		{"pushci_heal", map[string]any{"directory": dir}},
	}
	for _, c := range cases {
		t.Run(c.tool, func(t *testing.T) {
			r := HandleToolCall(ToolCallParams{Name: c.tool, Arguments: c.args})
			if r.Content == nil {
				t.Errorf("%s: nil content", c.tool)
			}
		})
	}
}

func TestHandleToolCall_SecretSet_Dispatch(t *testing.T) {
	dir := t.TempDir()
	r := HandleToolCall(ToolCallParams{
		Name: "pushci_secret_set",
		Arguments: map[string]any{
			"directory": dir, "key": "DISPATCH_KEY", "value": "dispatch-val",
		},
	})
	if r.IsError {
		t.Errorf("unexpected error: %s", resultText(r))
	}
}

// ── normalizeTool ─────────────────────────────────────────────────────────────

func TestNormalizeTool(t *testing.T) {
	cases := []struct{ in, want string }{
		{"github-actions", "GitHub Actions"},
		{"github_actions", "GitHub Actions"},
		{"gitlab-ci", "GitLab CI"},
		{"gitlab_ci", "GitLab CI"},
		{"circleci", "CircleCI"},
		{"jenkins", "Jenkins"},
		{"travis-ci", "Travis CI"},
		{"travis_ci", "Travis CI"},
		{"buildkite", "Buildkite"},
		{"unknown-tool", "unknown-tool"},
		{"", ""},
	}
	for _, c := range cases {
		got := normalizeTool(c.in)
		if got != c.want {
			t.Errorf("normalizeTool(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
