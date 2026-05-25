package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// binary returns the path to the pushci binary built for tests.
func binary(t *testing.T) string {
	t.Helper()
	bin := filepath.Join(t.TempDir(), "pushci")
	cmd := exec.Command("go", "build", "-o", bin, ".")
	cmd.Dir = "."
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("build failed: %v\n%s", err, out)
	}
	return bin
}

func run(t *testing.T, bin string, args ...string) (string, int) {
	t.Helper()
	cmd := exec.Command(bin, args...)
	out, err := cmd.CombinedOutput()
	code := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			code = exitErr.ExitCode()
		} else {
			t.Fatalf("exec error: %v", err)
		}
	}
	return string(out), code
}

func TestVersion(t *testing.T) {
	bin := binary(t)
	for _, flag := range []string{"version", "--version", "-v"} {
		out, code := run(t, bin, flag)
		if code != 0 {
			t.Errorf("%s: exit %d", flag, code)
		}
		if !strings.Contains(out, "pushci") {
			t.Errorf("%s: expected 'pushci' in output, got %q", flag, out)
		}
	}
}

func TestHelp(t *testing.T) {
	bin := binary(t)
	for _, flag := range []string{"help", "--help", "-h"} {
		out, code := run(t, bin, flag)
		if code != 0 {
			t.Errorf("%s: exit %d", flag, code)
		}
		if !strings.Contains(out, "Commands:") {
			t.Errorf("%s: missing 'Commands:' in output", flag)
		}
	}
}

func TestNoArgs(t *testing.T) {
	bin := binary(t)
	out, code := run(t, bin)
	if code != 0 {
		t.Errorf("no args: exit %d", code)
	}
	if !strings.Contains(out, "Commands:") {
		t.Error("no args: missing 'Commands:'")
	}
}

func TestUnknownCommand(t *testing.T) {
	bin := binary(t)
	out, code := run(t, bin, "nonexistent")
	if code != 1 {
		t.Errorf("unknown cmd: expected exit 1, got %d", code)
	}
	if !strings.Contains(out, "unknown command") {
		t.Errorf("unknown cmd: expected 'unknown command' in output, got %q", out)
	}
}

func TestDoctor(t *testing.T) {
	bin := binary(t)
	out, code := run(t, bin, "doctor")
	if code != 0 {
		t.Errorf("doctor: exit %d", code)
	}
	if !strings.Contains(out, "Doctor") {
		t.Error("doctor: missing 'Doctor' in output")
	}
}

func TestStatus(t *testing.T) {
	bin := binary(t)
	out, code := run(t, bin, "status")
	if code != 0 {
		t.Errorf("status: exit %d", code)
	}
	if !strings.Contains(out, "Status") {
		t.Error("status: missing 'Status' in output")
	}
}

func TestLogout(t *testing.T) {
	bin := binary(t)
	out, code := run(t, bin, "logout")
	if code != 0 {
		t.Errorf("logout: exit %d", code)
	}
	if !strings.Contains(out, "Logged out") {
		t.Errorf("logout: expected 'Logged out', got %q", out)
	}
}

func TestSkillList(t *testing.T) {
	bin := binary(t)
	_, code := run(t, bin, "skill", "list")
	if code != 0 {
		t.Errorf("skill list: exit %d", code)
	}
}

func TestDeploy_NoTarget(t *testing.T) {
	bin := binary(t)
	out, code := run(t, bin, "deploy")
	if code != 1 {
		t.Errorf("deploy no target: expected exit 1, got %d", code)
	}
	if !strings.Contains(out, "target required") {
		t.Error("deploy: missing 'target required'")
	}
}

// aiProviderEnvVars is every env var NewClient() consults when
// auto-detecting a provider. AI gating tests must clear ALL of them,
// not just ANTHROPIC_API_KEY — otherwise a developer's real
// OPENAI/GROQ/DEEPSEEK/GEMINI key in the host env bleeds through and
// the test sees an unexpectedly-configured client.
var aiProviderEnvVars = []string{
	"ANTHROPIC_API_KEY",
	"OPEN_AI_KEY",
	"OPENAI_API_KEY",
	"GROQ_API_KEY",
	"DEEPSEEK_API_KEY",
	"GEMINI_API_KEY",
	"PUSHCI_TOKEN",
}

func clearAIEnv(t *testing.T) {
	t.Helper()
	for _, k := range aiProviderEnvVars {
		t.Setenv(k, "")
	}
}

func TestAI_Gated(t *testing.T) {
	bin := binary(t)
	clearAIEnv(t)
	for _, cmd := range []string{"diagnose", "heal", "generate"} {
		out, code := run(t, bin, cmd)
		if code != 1 {
			t.Errorf("%s: expected exit 1, got %d", cmd, code)
		}
		if !strings.Contains(out, "AI feature") {
			t.Errorf("%s: expected AI gate msg, got %q", cmd, out)
		}
	}
}

func TestAsk_Gated(t *testing.T) {
	bin := binary(t)
	clearAIEnv(t)
	out, code := run(t, bin, "ask", "what is CI")
	if code != 1 {
		t.Errorf("ask: expected exit 1, got %d", code)
	}
	if !strings.Contains(out, "AI feature") {
		t.Errorf("ask: expected AI gate msg, got %q", out)
	}
}

func TestInitAndRun(t *testing.T) {
	// TestInitAndRun spawns a fake Node project and runs the full
	// generated pipeline, which today pulls tsc/vitest/vite via npx.
	// That makes the test network-dependent and hostile to hermetic
	// CI environments — it fails offline, behind strict firewalls,
	// and inside CI containers without a writable npx cache. It
	// also exposes a real product gap: the framework detector
	// overrides the package.json "scripts" block with its own
	// tools, so fake fixtures can't stub out the heavy commands.
	// Skipping under `-short` or PUSHCI_SKIP_NETWORK_TESTS lets the
	// pre-push hook run clean; CI without the flag still runs it.
	if testing.Short() || os.Getenv("PUSHCI_SKIP_NETWORK_TESTS") == "1" {
		t.Skip("skipping network-dependent init+run test")
	}
	bin := binary(t)
	dir := t.TempDir()

	// Set up a node project
	exec.Command("git", "init", dir).Run()
	os.WriteFile(filepath.Join(dir, "package.json"),
		[]byte(`{"name":"t","scripts":{"test":"echo ok","build":"echo ok","lint":"echo ok"}}`), 0644)
	gitAdd := exec.Command("git", "add", ".")
	gitAdd.Dir = dir
	gitAdd.Run()
	gitCommit := exec.Command("git", "commit", "-m", "init")
	gitCommit.Dir = dir
	gitCommit.Env = append(os.Environ(),
		"GIT_AUTHOR_NAME=test", "GIT_AUTHOR_EMAIL=t@t",
		"GIT_COMMITTER_NAME=test", "GIT_COMMITTER_EMAIL=t@t")
	gitCommit.Run()

	// init
	initCmd := exec.Command(bin, "init")
	initCmd.Dir = dir
	initCmd.Stdin = strings.NewReader("0\n")
	out, err := initCmd.CombinedOutput()
	if err != nil {
		t.Logf("init output: %s", out)
	}
	yml := filepath.Join(dir, "pushci.yml")
	if _, serr := os.Stat(yml); serr != nil {
		t.Fatal("pushci.yml not created")
	}

	// run
	runCmd := exec.Command(bin, "run")
	runCmd.Dir = dir
	rout, rerr := runCmd.CombinedOutput()
	if rerr != nil {
		t.Errorf("run failed: %v\n%s", rerr, rout)
	}
	if !strings.Contains(string(rout), "passed") {
		t.Errorf("run: expected 'passed', got %s", rout)
	}
}

func TestSecrets(t *testing.T) {
	bin := binary(t)
	dir := t.TempDir()
	exec.Command("git", "init", dir).Run()
	os.MkdirAll(filepath.Join(dir, ".pushci"), 0755)

	setCmd := exec.Command(bin, "secret", "set", "K1", "V1")
	setCmd.Dir = dir
	sout, serr := setCmd.CombinedOutput()
	if serr != nil {
		t.Errorf("secret set: %v\n%s", serr, sout)
	}

	listCmd := exec.Command(bin, "secret", "list")
	listCmd.Dir = dir
	lout, lerr := listCmd.CombinedOutput()
	if lerr != nil {
		t.Errorf("secret list: %v\n%s", lerr, lout)
	}
	if !strings.Contains(string(lout), "K1") {
		t.Errorf("secret list: missing K1, got %s", lout)
	}

	getCmd := exec.Command(bin, "secret", "get", "K1")
	getCmd.Dir = dir
	gout, gerr := getCmd.CombinedOutput()
	if gerr != nil {
		t.Errorf("secret get: %v\n%s", gerr, gout)
	}
	if !strings.Contains(string(gout), "V1") {
		t.Errorf("secret get: expected V1, got %s", gout)
	}
}

func TestMigrate(t *testing.T) {
	bin := binary(t)
	dir := t.TempDir()
	exec.Command("git", "init", dir).Run()
	wfDir := filepath.Join(dir, ".github", "workflows")
	os.MkdirAll(wfDir, 0755)
	os.WriteFile(filepath.Join(wfDir, "ci.yml"), []byte(
		"name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm test\n",
	), 0644)

	cmd := exec.Command(bin, "migrate", ".github/workflows/ci.yml")
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Errorf("migrate: %v\n%s", err, out)
	}
	if !strings.Contains(string(out), "Converted") {
		t.Errorf("migrate: expected 'Converted', got %s", out)
	}
}

func TestUninstall(t *testing.T) {
	bin := binary(t)
	dir := t.TempDir()
	exec.Command("git", "init", dir).Run()
	os.MkdirAll(filepath.Join(dir, ".pushci"), 0755)
	hookDir := filepath.Join(dir, ".git", "hooks")
	os.MkdirAll(hookDir, 0755)
	os.WriteFile(filepath.Join(hookDir, "pre-push"),
		[]byte("#!/bin/sh\n"), 0755)

	cmd := exec.Command(bin, "uninstall")
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Logf("uninstall output: %s", out)
	}
	if !strings.Contains(string(out), "Uninstall") {
		t.Errorf("uninstall: missing 'Uninstall', got %s", out)
	}
}
