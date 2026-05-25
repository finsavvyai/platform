package autofix

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func initTestRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	run := func(args ...string) {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		cmd.Env = append(os.Environ(),
			"GIT_AUTHOR_NAME=test", "GIT_AUTHOR_EMAIL=t@t.com",
			"GIT_COMMITTER_NAME=test", "GIT_COMMITTER_EMAIL=t@t.com",
		)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %s: %v", args, out, err)
		}
	}
	run("init", "-b", "main")
	run("config", "user.email", "t@t.com")
	run("config", "user.name", "test")
	run("config", "commit.gpgsign", "false")
	os.WriteFile(filepath.Join(dir, "readme.md"), []byte("# test"), 0644)
	run("add", ".")
	run("commit", "-m", "init")
	return dir
}

func TestCreateBranch(t *testing.T) {
	tests := []struct {
		name   string
		branch string
	}{
		{"simple branch", "pushci/fix-abc1234"},
		{"feature branch", "feature/new-thing"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := initTestRepo(t)
			if err := CreateBranch(dir, tt.branch); err != nil {
				t.Fatalf("CreateBranch: %v", err)
			}
			got, err := CurrentBranch(dir)
			if err != nil || got != tt.branch {
				t.Errorf("got branch %q, want %q (err=%v)", got, tt.branch, err)
			}
		})
	}
}

func TestCommitFiles(t *testing.T) {
	tests := []struct {
		name    string
		file    string
		content string
	}{
		{"text file", "fix.go", "package main"},
		{"nested file", "sub/fix.txt", "fixed"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := initTestRepo(t)
			path := filepath.Join(dir, tt.file)
			os.MkdirAll(filepath.Dir(path), 0755)
			os.WriteFile(path, []byte(tt.content), 0644)
			err := CommitFiles(dir, []string{tt.file}, "fix: "+tt.name)
			if err != nil {
				t.Fatalf("CommitFiles: %v", err)
			}
		})
	}
}

func TestCurrentSHA(t *testing.T) {
	dir := initTestRepo(t)
	sha, err := CurrentSHA(dir)
	if err != nil {
		t.Fatalf("CurrentSHA: %v", err)
	}
	if len(sha) < 7 {
		t.Errorf("SHA too short: %q", sha)
	}
}

func TestCurrentBranch(t *testing.T) {
	dir := initTestRepo(t)
	branch, err := CurrentBranch(dir)
	if err != nil {
		t.Fatalf("CurrentBranch: %v", err)
	}
	if branch != "main" {
		t.Errorf("got %q, want main", branch)
	}
}
