package detect

import (
	"os/exec"
	"strings"
)

// detectDefaultBranch returns the repo's default branch name
// by checking the remote HEAD ref. Falls back to "main".
func detectDefaultBranch(root string) string {
	cmd := exec.Command("git", "symbolic-ref", "refs/remotes/origin/HEAD")
	cmd.Dir = root
	out, err := cmd.Output()
	if err == nil {
		ref := strings.TrimSpace(string(out))
		// refs/remotes/origin/main → main
		if parts := strings.Split(ref, "/"); len(parts) > 0 {
			return parts[len(parts)-1]
		}
	}
	// Fallback: check current branch
	cmd2 := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD")
	cmd2.Dir = root
	out2, err2 := cmd2.Output()
	if err2 == nil {
		return strings.TrimSpace(string(out2))
	}
	return "main"
}

// extractCdDir pulls the directory name from a "cd <dir> && "
// prefix. Returns "" if the prefix doesn't start with cd.
func extractCdDir(prefix string) string {
	p := strings.TrimSpace(prefix)
	if !strings.HasPrefix(p, "cd ") {
		return ""
	}
	p = strings.TrimPrefix(p, "cd ")
	if idx := strings.Index(p, " "); idx > 0 {
		return p[:idx]
	}
	return p
}

// extractYAMLField does a simple line-by-line search for
// `key: value` in a YAML string. Not a full parser — good
// enough for reading GitHub Actions `with:` inputs.
func extractYAMLField(content, key string) string {
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, key+":") {
			val := strings.TrimPrefix(trimmed, key+":")
			val = strings.TrimSpace(val)
			val = strings.Trim(val, "'\"")
			if strings.Contains(val, "${{") {
				continue // skip GitHub expression, not a real value
			}
			return val
		}
	}
	return ""
}
