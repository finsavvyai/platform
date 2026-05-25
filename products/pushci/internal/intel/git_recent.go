package intel

import (
	"os/exec"
	"strconv"
	"strings"
)

// RecentChanges returns files changed in the last N commits.
func RecentChanges(root string, commits int) ([]string, error) {
	cmd := exec.Command("git", "diff", "--name-only", "HEAD~"+strconv.Itoa(commits))
	cmd.Dir = root
	out, err := cmd.Output()
	if err != nil {
		cmd = exec.Command("git", "diff", "--name-only", "HEAD~1")
		cmd.Dir = root
		out, err = cmd.Output()
		if err != nil {
			return nil, err
		}
	}
	var files []string
	for _, line := range strings.Split(string(out), "\n") {
		f := strings.TrimSpace(line)
		if f != "" {
			files = append(files, f)
		}
	}
	return files, nil
}
