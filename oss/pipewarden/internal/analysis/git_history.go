package analysis

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// GitHistoryScanner walks commit history of a local git repo and runs
// the existing DLP scanner against each commit's introduced lines.
// Matches GitGuardian's main feature: secrets that were once committed
// and are still in the repo's git objects, even if removed from HEAD.
//
// Implementation uses the git CLI directly (no go-git dependency) so it
// works against any worktree without imposing a new module dep. CLI
// availability is required — surfaced clearly in the error path.
type GitHistoryScanner struct {
	dlp        *DLPScanner
	maxCommits int
	timeout    time.Duration
}

// NewGitHistoryScanner returns a scanner with default limits: last 1000
// commits, 5-minute total timeout. Both can be overridden by setting
// the fields directly.
func NewGitHistoryScanner() *GitHistoryScanner {
	return &GitHistoryScanner{
		dlp:        NewDLPScanner(),
		maxCommits: 1000,
		timeout:    5 * time.Minute,
	}
}

// HistorySecret is a single DLP hit found in the diff of a historical
// commit. Filename + line number map back into the commit's diff context;
// SHA + author let humans investigate fast.
type HistorySecret struct {
	CommitSHA string   `json:"commit_sha"`
	Author    string   `json:"author"`
	Date      string   `json:"date"`
	File      string   `json:"file"`
	Line      int      `json:"line"`
	Pattern   string   `json:"pattern"`
	Match     string   `json:"match"` // already redacted by DLP scanner
	Severity  Severity `json:"severity"`
}

// ScanRepo walks `git log -p` output for the repo at repoPath and returns
// every DLP hit. Commits older than the configured maxCommits limit are
// skipped. Errors from the git CLI (missing binary, not-a-repo) are
// returned verbatim so the caller can surface them.
func (s *GitHistoryScanner) ScanRepo(ctx context.Context, repoPath string) ([]HistorySecret, error) {
	if _, err := exec.LookPath("git"); err != nil {
		return nil, fmt.Errorf("git CLI not found in PATH: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()

	args := []string{
		"-C", repoPath,
		"log",
		"-p",
		"--no-merges",
		"--pretty=format:__COMMIT__ %H | %an <%ae> | %ad",
		"--date=iso-strict",
		fmt.Sprintf("-n%d", s.maxCommits),
	}
	cmd := exec.CommandContext(ctx, "git", args...)
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git log failed: %w", err)
	}
	return s.scanLogOutput(string(out)), nil
}

// scanLogOutput is split out so tests can feed canned git-log input
// without spinning up a real repo on disk.
func (s *GitHistoryScanner) scanLogOutput(logOut string) []HistorySecret {
	var hits []HistorySecret
	var sha, author, date, currentFile string

	for _, line := range strings.Split(logOut, "\n") {
		switch {
		case strings.HasPrefix(line, "__COMMIT__ "):
			sha, author, date = parseCommitHeader(line)
			currentFile = ""
		case strings.HasPrefix(line, "+++ b/"):
			currentFile = strings.TrimPrefix(line, "+++ b/")
		case strings.HasPrefix(line, "+") && !strings.HasPrefix(line, "+++"):
			added := strings.TrimPrefix(line, "+")
			for _, f := range s.dlp.ScanContent(added, currentFile) {
				hits = append(hits, HistorySecret{
					CommitSHA: sha,
					Author:    author,
					Date:      date,
					File:      currentFile,
					Line:      f.Line,
					Pattern:   f.Pattern,
					Match:     f.Match,
					Severity:  f.Severity,
				})
			}
		}
	}
	return hits
}

// parseCommitHeader unpacks the custom pretty-format line:
//
//	__COMMIT__ <sha> | <author> | <date>
func parseCommitHeader(line string) (sha, author, date string) {
	body := strings.TrimPrefix(line, "__COMMIT__ ")
	parts := strings.SplitN(body, " | ", 3)
	if len(parts) != 3 {
		return body, "", ""
	}
	return parts[0], parts[1], parts[2]
}

// HistorySecretsToFindings adapts git-history hits to the unified Finding
// type so they appear alongside other findings in the standard UI/SARIF.
func HistorySecretsToFindings(connection string, hits []HistorySecret) []Finding {
	out := make([]Finding, 0, len(hits))
	for _, h := range hits {
		out = append(out, Finding{
			ConnectionName: connection,
			RunID:          h.CommitSHA,
			Severity:       h.Severity,
			Category:       CategorySecrets,
			Title:          fmt.Sprintf("Secret committed: %s in %s", h.Pattern, h.File),
			Description:    fmt.Sprintf("Commit %s by %s (%s) introduced a %s. Match: %s", short(h.CommitSHA), h.Author, h.Date, h.Pattern, h.Match),
			Remediation:    "Rotate the credential immediately — git history is public/cloneable. Then rewrite history with git-filter-repo or BFG Repo-Cleaner to purge from older commits.",
			File:           h.File,
			Line:           h.Line,
			Confidence:     0.9,
			Status:         "open",
		})
	}
	return out
}

func short(sha string) string {
	if len(sha) > 8 {
		return sha[:8]
	}
	return sha
}
