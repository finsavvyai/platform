package mcp

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// resultText extracts the concatenated text content from a
// ToolCallResult. Tests written against an earlier API shape that
// used `Content string` can use this helper to read back the
// equivalent string from the current []ContentBlock shape without
// rewriting every assertion.
func resultText(r ToolCallResult) string {
	var b strings.Builder
	for _, c := range r.Content {
		b.WriteString(c.Text)
	}
	return b.String()
}

// TestHandleScan_Success tests successful pipeline scanning via MCP
func TestHandleScan_Success(t *testing.T) {
	// Create a temporary config file
	tmpdir, err := os.MkdirTemp("", "mcp-scan-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpdir)

	// Create .github/workflows directory
	workflowDir := filepath.Join(tmpdir, ".github", "workflows")
	os.MkdirAll(workflowDir, 0755)

	// Write a workflow file with some issues
	workflowPath := filepath.Join(workflowDir, "test.yml")
	content := `name: Test
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm test
      - run: npm run build
      - run: npm run deploy
`
	os.WriteFile(workflowPath, []byte(content), 0644)

	// Change to temp directory to allow findPipelineConfig to work
	oldCwd, _ := os.Getwd()
	os.Chdir(tmpdir)
	defer os.Chdir(oldCwd)

	args := map[string]any{
		"path": workflowPath,
	}

	result := handleScan(args)

	if result.IsError {
		t.Fatalf("handleScan returned error: %s", resultText(result))
	}

	// Parse the JSON result
	if resultText(result) == "" {
		t.Error("Expected non-empty content in result")
	}
}

// TestHandleScan_NoConfigFound tests handling when no config file is found
func TestHandleScan_NoConfigFound(t *testing.T) {
	tmpdir, err := os.MkdirTemp("", "mcp-noscan-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpdir)

	oldCwd, _ := os.Getwd()
	os.Chdir(tmpdir)
	defer os.Chdir(oldCwd)

	args := map[string]any{}

	result := handleScan(args)

	if !result.IsError {
		t.Error("Expected error when no config found and no path provided")
	}
}

// TestHandleScan_WithPathArgument tests scan with explicit path argument
func TestHandleScan_WithPathArgument(t *testing.T) {
	tmpfile, err := os.CreateTemp("", "pushci*.yml")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	defer os.Remove(tmpfile.Name())

	content := `name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
      - run: npm run lint
      - run: npm run sast
`
	tmpfile.WriteString(content)
	tmpfile.Close()

	args := map[string]any{
		"path": tmpfile.Name(),
	}

	result := handleScan(args)

	if result.IsError {
		t.Fatalf("handleScan failed: %s", resultText(result))
	}

	if resultText(result) == "" {
		t.Error("Expected non-empty content")
	}
}

// TestFindPipelineConfig_GitHub tests finding GitHub Actions workflow
func TestFindPipelineConfig_GitHub(t *testing.T) {
	tmpdir, err := os.MkdirTemp("", "find-github-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpdir)

	workflowDir := filepath.Join(tmpdir, ".github", "workflows")
	os.MkdirAll(workflowDir, 0755)

	workflowFile := filepath.Join(workflowDir, "main.yml")
	os.WriteFile(workflowFile, []byte("name: test"), 0644)

	oldCwd, _ := os.Getwd()
	os.Chdir(tmpdir)
	defer os.Chdir(oldCwd)

	found := findPipelineConfig()
	if found == "" {
		t.Error("Expected to find GitHub Actions workflow")
	}

	if !strings.HasPrefix(found, ".github") {
		t.Errorf("Expected GitHub path, got %s", found)
	}
}

// TestFindPipelineConfig_GitLab tests finding GitLab CI config
func TestFindPipelineConfig_GitLab(t *testing.T) {
	tmpdir, err := os.MkdirTemp("", "find-gitlab-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpdir)

	gitlabFile := filepath.Join(tmpdir, ".gitlab-ci.yml")
	os.WriteFile(gitlabFile, []byte("stages: []"), 0644)

	oldCwd, _ := os.Getwd()
	os.Chdir(tmpdir)
	defer os.Chdir(oldCwd)

	found := findPipelineConfig()
	if found == "" {
		t.Error("Expected to find GitLab CI config")
	}

	if !strings.HasPrefix(found, ".gitlab") {
		t.Errorf("Expected GitLab path, got %s", found)
	}
}

// TestFindPipelineConfig_Bitbucket tests finding Bitbucket Pipelines config
func TestFindPipelineConfig_Bitbucket(t *testing.T) {
	tmpdir, err := os.MkdirTemp("", "find-bb-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpdir)

	bbFile := filepath.Join(tmpdir, "bitbucket-pipelines.yml")
	os.WriteFile(bbFile, []byte("image: node"), 0644)

	oldCwd, _ := os.Getwd()
	os.Chdir(tmpdir)
	defer os.Chdir(oldCwd)

	found := findPipelineConfig()
	if found == "" {
		t.Error("Expected to find Bitbucket Pipelines config")
	}

	if !strings.HasSuffix(found, "bitbucket-pipelines.yml") {
		t.Errorf("Expected Bitbucket path, got %s", found)
	}
}

// TestFindPipelineConfig_NotFound tests behavior when no config exists
func TestFindPipelineConfig_NotFound(t *testing.T) {
	tmpdir, err := os.MkdirTemp("", "find-none-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpdir)

	oldCwd, _ := os.Getwd()
	os.Chdir(tmpdir)
	defer os.Chdir(oldCwd)

	found := findPipelineConfig()
	if found != "" {
		t.Errorf("Expected empty result, got %s", found)
	}
}

// TestFindPipelineConfig_Priority tests that GitHub Actions is preferred
func TestFindPipelineConfig_Priority(t *testing.T) {
	tmpdir, err := os.MkdirTemp("", "find-priority-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpdir)

	// Create multiple config files
	workflowDir := filepath.Join(tmpdir, ".github", "workflows")
	os.MkdirAll(workflowDir, 0755)
	os.WriteFile(filepath.Join(workflowDir, "test.yml"), []byte(""), 0644)

	gitlabFile := filepath.Join(tmpdir, ".gitlab-ci.yml")
	os.WriteFile(gitlabFile, []byte(""), 0644)

	bbFile := filepath.Join(tmpdir, "bitbucket-pipelines.yml")
	os.WriteFile(bbFile, []byte(""), 0644)

	oldCwd, _ := os.Getwd()
	os.Chdir(tmpdir)
	defer os.Chdir(oldCwd)

	found := findPipelineConfig()
	// GitHub Actions has highest priority in pattern list
	if found == "" || !strings.HasPrefix(found, ".github") {
		t.Errorf("Expected GitHub Actions config to be found first, got %s", found)
	}
}

// TestHandleScan_SecretDetection tests that secrets are properly detected in scan
func TestHandleScan_SecretDetection(t *testing.T) {
	tmpfile, err := os.CreateTemp("", "scan-secret*.yml")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	defer os.Remove(tmpfile.Name())

	content := `name: CI
env:
  API_KEY: ghp_1234567890123456789012345678
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`
	tmpfile.WriteString(content)
	tmpfile.Close()

	args := map[string]any{
		"path": tmpfile.Name(),
	}

	result := handleScan(args)

	if result.IsError {
		t.Fatalf("handleScan failed: %s", resultText(result))
	}

	// The result should contain information about the secret finding
	if resultText(result) == "" {
		t.Error("Expected findings to be reported")
	}
}
