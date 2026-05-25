package heal

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// ApplyFix executes a fix action in the given root directory.
func ApplyFix(root string, fix *Fix) error {
	if strings.HasPrefix(fix.Action, "write:") {
		return applyFileFix(root, fix)
	}
	return applyCommandFix(root, fix)
}

func applyCommandFix(root string, fix *Fix) error {
	parts := strings.Fields(fix.Action)
	if len(parts) == 0 {
		return fmt.Errorf("empty fix action")
	}
	cmd := exec.Command(parts[0], parts[1:]...)
	cmd.Dir = root
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func applyFileFix(root string, fix *Fix) error {
	for _, entry := range fix.FilesChanged {
		idx := strings.Index(entry, "=")
		if idx < 0 {
			continue
		}
		relPath := entry[:idx]
		content := entry[idx+1:]
		absPath := filepath.Join(root, relPath)
		dir := filepath.Dir(absPath)
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("mkdir %s: %w", dir, err)
		}
		if err := os.WriteFile(absPath, []byte(content), 0o644); err != nil {
			return fmt.Errorf("write %s: %w", absPath, err)
		}
	}
	return nil
}

// CommitFix stages and commits the fix changes.
func CommitFix(root string, fix *Fix, message string) error {
	for _, f := range fix.FilesChanged {
		path := f
		if idx := strings.Index(f, "="); idx > 0 {
			path = f[:idx]
		}
		add := exec.Command("git", "add", path)
		add.Dir = root
		if err := add.Run(); err != nil {
			return fmt.Errorf("git add %s: %w", path, err)
		}
	}
	// For command-based fixes, stage all changes
	if len(fix.FilesChanged) == 0 {
		add := exec.Command("git", "add", "-A")
		add.Dir = root
		if err := add.Run(); err != nil {
			return fmt.Errorf("git add: %w", err)
		}
	}
	commit := exec.Command("git", "commit", "-m", message)
	commit.Dir = root
	return commit.Run()
}

// CreateFixBranch creates a new git branch for the fix.
func CreateFixBranch(root, branch string) error {
	cmd := exec.Command("git", "checkout", "-b", branch)
	cmd.Dir = root
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git checkout -b %s: %s", branch, out)
	}
	return nil
}
