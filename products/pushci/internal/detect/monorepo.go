package detect

import (
	"os/exec"
	"path/filepath"
	"strings"
)

// AffectedPackages returns which workspace packages were modified
// since the given base ref (e.g., "main", "HEAD~1").
func AffectedPackages(root, baseRef string) ([]string, error) {
	if baseRef == "" {
		baseRef = "HEAD~1"
	}
	cmd := exec.Command("git", "diff", "--name-only", baseRef)
	cmd.Dir = root
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	changedFiles := strings.Split(strings.TrimSpace(string(out)), "\n")
	if len(changedFiles) == 0 || changedFiles[0] == "" {
		return nil, nil
	}

	workspaces := resolveWorkspaces(root)
	if len(workspaces) == 0 {
		return nil, nil
	}

	affected := map[string]bool{}
	for _, file := range changedFiles {
		for _, ws := range workspaces {
			if strings.HasPrefix(file, ws+"/") || file == ws {
				affected[ws] = true
			}
		}
		if !strings.Contains(file, "/") {
			for _, ws := range workspaces {
				affected[ws] = true
			}
			break
		}
	}

	result := make([]string, 0, len(affected))
	for pkg := range affected {
		result = append(result, pkg)
	}
	return result, nil
}

// IsMonorepo checks if the repo has workspace config.
func IsMonorepo(root string) bool {
	if IsTurboRepo(root) {
		return true
	}
	if fileExists(filepath.Join(root, "pnpm-workspace.yaml")) {
		return true
	}
	return len(resolveWorkspaces(root)) > 0
}

// MonorepoPackages returns all workspace packages in the repo.
func MonorepoPackages(root string) []string {
	workspaces := resolveWorkspaces(root)
	if len(workspaces) == 0 {
		workspaces = resolvePnpmWorkspaces(root)
	}
	return workspaces
}
