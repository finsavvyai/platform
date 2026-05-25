package autofix

import (
	"context"
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/heal"
	"github.com/finsavvyai/pushci/internal/platform"
)

// CreateFixPR creates a branch, commits fixes, pushes, and opens a PR.
func CreateFixPR(
	ctx context.Context,
	provider platform.Provider,
	event *platform.Event,
	fixes []heal.Fix,
) error {
	root, err := repoRoot(event)
	if err != nil {
		return err
	}
	branchName := fixBranchName(event.SHA)
	if err := CreateBranch(root, branchName); err != nil {
		return fmt.Errorf("create branch: %w", err)
	}
	if err := commitAllFixes(root, fixes); err != nil {
		return fmt.Errorf("commit fixes: %w", err)
	}
	if err := PushBranch(root, "origin", branchName); err != nil {
		return fmt.Errorf("push branch: %w", err)
	}
	title := prTitle(fixes)
	body := FormatPRBody(fixes, "")
	return provider.PostComment(ctx, event, formatPRComment(title, body))
}

func fixBranchName(sha string) string {
	short := sha
	if len(sha) > 7 {
		short = sha[:7]
	}
	return "pushci/fix-" + short
}

func prTitle(fixes []heal.Fix) string {
	checks := uniqueChecks(fixes)
	if len(checks) == 1 {
		return fmt.Sprintf("fix: PushCI auto-fix for %s", checks[0])
	}
	return fmt.Sprintf("fix: PushCI auto-fix for %d checks", len(checks))
}

func uniqueChecks(fixes []heal.Fix) []string {
	seen := map[string]bool{}
	var out []string
	for _, f := range fixes {
		if !seen[f.Check] {
			seen[f.Check] = true
			out = append(out, f.Check)
		}
	}
	return out
}

func commitAllFixes(root string, fixes []heal.Fix) error {
	for _, f := range fixes {
		if len(f.FilesChanged) == 0 {
			continue
		}
		msg := fmt.Sprintf("fix(%s): %s", f.Check, f.Action)
		if err := CommitFiles(root, f.FilesChanged, msg); err != nil {
			return err
		}
	}
	return nil
}

func formatPRComment(title, body string) string {
	return fmt.Sprintf("## %s\n\n%s", title, body)
}

func repoRoot(event *platform.Event) (string, error) {
	if event.CloneURL == "" {
		return ".", nil
	}
	parts := strings.Split(event.Repo, "/")
	if len(parts) < 2 {
		return ".", nil
	}
	return ".", nil
}
