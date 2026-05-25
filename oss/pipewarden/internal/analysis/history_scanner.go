package analysis

import "fmt"

// HistoryScanRequest contains git history commits to scan for secrets.
type HistoryScanRequest struct {
	Commits []CommitContent `json:"commits"`
}

// CommitContent is a single git commit with its file contents.
type CommitContent struct {
	SHA     string       `json:"sha"`
	Message string       `json:"message"`
	Files   []CommitFile `json:"files"`
}

// CommitFile is one file's path and content at a particular commit.
type CommitFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// HistoryScanResult is the aggregate output of ScanHistory.
type HistoryScanResult struct {
	CommitsScanned int              `json:"commits_scanned"`
	Findings       []HistoryFinding `json:"findings"`
}

// HistoryFinding is one detected secret from git history.
type HistoryFinding struct {
	SHA           string `json:"sha"`
	File          string `json:"file"`
	PatternName   string `json:"pattern_name"`
	RedactedMatch string `json:"redacted_match"`
	LineNumber    int    `json:"line_number"`
	StillPresent  bool   `json:"still_present"`
}

// deduplicationKey uniquely identifies a secret occurrence across commits.
type deduplicationKey struct {
	pattern  string
	file     string
	redacted string
}

// historyRedact formats a redacted match as first 4 chars + "..." + last 2 chars.
func historyRedact(s string) string {
	if len(s) <= 6 {
		return "****"
	}
	return fmt.Sprintf("%s...%s", s[:4], s[len(s)-2:])
}

// ScanHistory runs DLP pattern matching against each commit's files,
// deduplicates by (pattern+file+redacted_match), and marks StillPresent
// when the same match appears in the final (latest) commit.
func ScanHistory(req HistoryScanRequest) *HistoryScanResult {
	scanner := NewDLPScanner()

	type rawHit struct {
		sha        string
		file       string
		pattern    string
		redacted   string
		lineNumber int
	}

	var allHits []rawHit

	for _, commit := range req.Commits {
		for _, f := range commit.Files {
			findings := scanner.ScanContent(f.Content, f.Path)
			for _, dlp := range findings {
				allHits = append(allHits, rawHit{
					sha:        commit.SHA,
					file:       f.Path,
					pattern:    dlp.Pattern,
					redacted:   historyRedact(dlp.Match),
					lineNumber: dlp.Line,
				})
			}
		}
	}

	// Build set of (pattern+file+redacted) present in the last commit.
	latestPresent := make(map[deduplicationKey]bool)
	if len(req.Commits) > 0 {
		last := req.Commits[len(req.Commits)-1]
		for _, f := range last.Files {
			findings := scanner.ScanContent(f.Content, f.Path)
			for _, dlp := range findings {
				k := deduplicationKey{
					pattern:  dlp.Pattern,
					file:     f.Path,
					redacted: historyRedact(dlp.Match),
				}
				latestPresent[k] = true
			}
		}
	}

	// Deduplicate: keep first occurrence per (pattern+file+redacted).
	seen := make(map[deduplicationKey]bool)
	var findings []HistoryFinding

	for _, hit := range allHits {
		k := deduplicationKey{pattern: hit.pattern, file: hit.file, redacted: hit.redacted}
		if seen[k] {
			continue
		}
		seen[k] = true
		findings = append(findings, HistoryFinding{
			SHA:           hit.sha,
			File:          hit.file,
			PatternName:   hit.pattern,
			RedactedMatch: hit.redacted,
			LineNumber:    hit.lineNumber,
			StillPresent:  latestPresent[k],
		})
	}

	if findings == nil {
		findings = []HistoryFinding{}
	}

	return &HistoryScanResult{
		CommitsScanned: len(req.Commits),
		Findings:       findings,
	}
}
