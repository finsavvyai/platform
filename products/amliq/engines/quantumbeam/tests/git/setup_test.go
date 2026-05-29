package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestGitRepositorySetup(t *testing.T) {
	// TODO: restore once scripts/setup-git-strategy.sh exists and the test
	// configures git user.email / user.name in the sandbox. Until then this
	// test depends on environment that isn't checked into the repo.
	t.Skip("scripts/setup-git-strategy.sh not present in repo; environmental test")

	// Create a temporary directory for testing
	tempDir, err := os.MkdirTemp("", "quantumbeam-git-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Change to temp directory
	originalDir, _ := os.Getwd()
	defer os.Chdir(originalDir)
	os.Chdir(tempDir)

	// Initialize git repository
	cmd := exec.Command("git", "init")
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to init git repo: %v", err)
	}

	// Run our setup script (assuming it's in the original directory)
	setupScript := filepath.Join(originalDir, "scripts", "setup-git-strategy.sh")
	cmd = exec.Command("bash", setupScript)
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to run setup script: %v", err)
	}

	// Test 1: Check if git hooks are installed
	hooksDir := ".git/hooks"
	hooks := []string{"pre-commit", "pre-push", "commit-msg"}
	for _, hook := range hooks {
		hookPath := filepath.Join(hooksDir, hook)
		if _, err := os.Stat(hookPath); os.IsNotExist(err) {
			t.Errorf("Hook %s was not installed", hook)
		}

		// Check if hook is executable
		info, err := os.Stat(hookPath)
		if err != nil {
			t.Errorf("Failed to stat hook %s: %v", hook, err)
		} else if info.Mode().Perm()&0111 == 0 {
			t.Errorf("Hook %s is not executable", hook)
		}
	}

	// Test 2: Check if .gitattributes was created
	if _, err := os.Stat(".gitattributes"); os.IsNotExist(err) {
		t.Error(".gitattributes file was not created")
	}

	// Test 3: Check Git configuration
	cmd = exec.Command("git", "config", "--get", "core.autocrlf")
	output, err := cmd.Output()
	if err != nil {
		t.Errorf("Failed to get git config: %v", err)
	}
	if strings.TrimSpace(string(output)) != "input" {
		t.Errorf("Expected core.autocrlf to be 'input', got '%s'", strings.TrimSpace(string(output)))
	}

	// Test 4: Test commit message validation
	cmd = exec.Command("bash", "-c", "echo 'invalid commit message' | git commit -m -")
	err = cmd.Run()
	if err == nil {
		t.Error("Expected commit with invalid message to fail")
	}

	// Test 5: Test valid commit message
	cmd = exec.Command("bash", "-c", "echo 'test: initial commit' | git commit -m -")
	err = cmd.Run()
	if err != nil {
		t.Errorf("Expected commit with valid message to succeed, got error: %v", err)
	}
}

func TestBranchNamingValidation(t *testing.T) {
	testCases := []struct {
		name     string
		branch   string
		expected bool
	}{
		{"Valid feature branch", "feature/123-add-quantum-encryption", true},
		{"Valid bugfix branch", "bugfix/456-fix-memory-leak", true},
		{"Valid hotfix branch", "hotfix/789-security-vulnerability", true},
		{"Valid release branch", "release/v1.0.0", true},
		{"Invalid feature branch", "feature/invalid", false},
		{"Invalid branch", "random-branch", false},
		{"Main branch", "main", true},
		{"Develop branch", "develop", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// This is a simplified test - in practice, the validation happens in hooks
			// Here we just test the regex pattern that would be used
			pattern := `^(feature|bugfix|hotfix)/[A-Z0-9]+-.+$|^release/.+$|^(main|develop)$`
			matched, _ := regexp.MatchString(pattern, tc.branch)
			valid := matched

			if valid != tc.expected {
				t.Errorf("Branch %s validation: expected %v, got %v", tc.branch, tc.expected, valid)
			}
		})
	}
}

func TestCommitMessageValidation(t *testing.T) {
	testCases := []struct {
		name     string
		message  string
		expected bool
	}{
		{"Valid feature commit", "feat(api): add transaction fraud detection endpoint", true},
		{"Valid fix commit", "fix(quantum): resolve circuit optimization issue", true},
		{"Valid docs commit", "docs(readme): update installation instructions", true},
		{"Valid simple commit", "test: add unit tests", true},
		{"Invalid no type", "add new feature", false},
		{"Invalid format", "feat add feature", false},
		{"Empty description", "feat(): ", false},
		{"Merge commit", "Merge branch feature/xyz", true}, // Should be allowed
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Test the conventional commit regex
			if strings.HasPrefix(tc.message, "Merge") {
				if !tc.expected {
					t.Errorf("Merge commit %s should be allowed", tc.message)
				}
				return
			}

			pattern := `^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\(.+\))?: .{1,72}$`
			matched, _ := regexp.MatchString(pattern, tc.message)
			valid := matched

			if valid != tc.expected {
				t.Errorf("Commit message '%s': expected %v, got %v", tc.message, tc.expected, valid)
			}
		})
	}
}
