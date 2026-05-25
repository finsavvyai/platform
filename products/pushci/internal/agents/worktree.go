package agents

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

// WorktreeConfig defines options for creating an isolated git worktree.
type WorktreeConfig struct {
	BasePath string
	Branch   string
	Prefix   string
}

// CreateWorktree creates an isolated git worktree and returns its path.
func CreateWorktree(config WorktreeConfig) (string, error) {
	if config.BasePath == "" {
		return "", fmt.Errorf("worktree: base path is required")
	}
	if config.Prefix == "" {
		config.Prefix = "pushci-agent"
	}
	name := fmt.Sprintf("%s-%s", config.Prefix, config.Branch)
	wtPath := filepath.Join(config.BasePath, ".worktrees", name)

	args := []string{"worktree", "add", wtPath}
	if config.Branch != "" {
		args = append(args, "-b", name)
	}

	cmd := exec.Command("git", args...)
	cmd.Dir = config.BasePath
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("worktree add: %s: %w", string(out), err)
	}
	return wtPath, nil
}

// CleanupWorktree removes a git worktree at the given path.
func CleanupWorktree(basePath, wtPath string) error {
	cmd := exec.Command("git", "worktree", "remove", wtPath, "--force")
	cmd.Dir = basePath
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("worktree remove: %s: %w", string(out), err)
	}
	return nil
}

// ListWorktrees returns the paths of all active git worktrees.
func ListWorktrees(basePath string) ([]string, error) {
	cmd := exec.Command("git", "worktree", "list", "--porcelain")
	cmd.Dir = basePath
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("worktree list: %s: %w", string(out), err)
	}
	var paths []string
	for _, line := range strings.Split(string(out), "\n") {
		if strings.HasPrefix(line, "worktree ") {
			paths = append(paths, strings.TrimPrefix(line, "worktree "))
		}
	}
	return paths, nil
}
