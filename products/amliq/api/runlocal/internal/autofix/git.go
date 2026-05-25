package autofix

import (
	"fmt"
	"os/exec"
	"strings"
)

// CreateBranch creates and checks out a new git branch.
func CreateBranch(root, branch string) error {
	cmd := exec.Command("git", "checkout", "-b", branch)
	cmd.Dir = root
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("create branch %s: %s: %w", branch, out, err)
	}
	return nil
}

// CommitFiles stages the given files and commits them.
func CommitFiles(root string, files []string, message string) error {
	args := append([]string{"add"}, files...)
	add := exec.Command("git", args...)
	add.Dir = root
	if out, err := add.CombinedOutput(); err != nil {
		return fmt.Errorf("git add: %s: %w", out, err)
	}
	commit := exec.Command("git", "commit", "-m", message)
	commit.Dir = root
	if out, err := commit.CombinedOutput(); err != nil {
		return fmt.Errorf("git commit: %s: %w", out, err)
	}
	return nil
}

// PushBranch pushes a branch to the specified remote.
func PushBranch(root, remote, branch string) error {
	cmd := exec.Command("git", "push", remote, branch)
	cmd.Dir = root
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git push: %s: %w", out, err)
	}
	return nil
}

// CurrentSHA returns the HEAD commit SHA.
func CurrentSHA(root string) (string, error) {
	cmd := exec.Command("git", "rev-parse", "HEAD")
	cmd.Dir = root
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("rev-parse HEAD: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

// CurrentBranch returns the current branch name.
func CurrentBranch(root string) (string, error) {
	cmd := exec.Command("git", "branch", "--show-current")
	cmd.Dir = root
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("branch --show-current: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}
