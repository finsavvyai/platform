package analysis

import (
	"strings"
	"testing"
)

func makeCommit(sha, msg string, files ...CommitFile) CommitContent {
	return CommitContent{SHA: sha, Message: msg, Files: files}
}

func makeFile(path, content string) CommitFile {
	return CommitFile{Path: path, Content: content}
}

func TestScanHistorySingleCommit(t *testing.T) {
	req := HistoryScanRequest{
		Commits: []CommitContent{
			makeCommit("abc123", "add config",
				makeFile(".env", "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\n"),
			),
		},
	}
	result := ScanHistory(req)

	if result.CommitsScanned != 1 {
		t.Errorf("expected 1 commit scanned, got %d", result.CommitsScanned)
	}
	if len(result.Findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(result.Findings))
	}

	f := result.Findings[0]
	if f.SHA != "abc123" {
		t.Errorf("expected sha=abc123, got %s", f.SHA)
	}
	if f.File != ".env" {
		t.Errorf("expected file=.env, got %s", f.File)
	}
	if !strings.Contains(f.PatternName, "AWS") {
		t.Errorf("expected AWS pattern, got %s", f.PatternName)
	}
}

func TestScanHistoryDeduplication(t *testing.T) {
	secret := "AKIAIOSFODNN7EXAMPLE"
	line := "AWS_ACCESS_KEY_ID=" + secret

	req := HistoryScanRequest{
		Commits: []CommitContent{
			makeCommit("sha1", "commit1", makeFile("cfg.yml", line)),
			makeCommit("sha2", "commit2", makeFile("cfg.yml", line)),
		},
	}
	result := ScanHistory(req)

	if len(result.Findings) != 1 {
		t.Errorf("expected 1 deduplicated finding, got %d", len(result.Findings))
	}
	if result.CommitsScanned != 2 {
		t.Errorf("expected 2 commits scanned, got %d", result.CommitsScanned)
	}
}

func TestScanHistoryStillPresent(t *testing.T) {
	secret := "AKIAIOSFODNN7EXAMPLE"
	line := "KEY=" + secret

	req := HistoryScanRequest{
		Commits: []CommitContent{
			makeCommit("sha1", "add secret", makeFile("secret.txt", line)),
			makeCommit("sha2", "still there", makeFile("secret.txt", line)),
		},
	}
	result := ScanHistory(req)

	if len(result.Findings) == 0 {
		t.Fatal("expected at least 1 finding")
	}
	if !result.Findings[0].StillPresent {
		t.Error("expected StillPresent=true when secret is in latest commit")
	}

	// Now test removed secret: only in first commit
	req2 := HistoryScanRequest{
		Commits: []CommitContent{
			makeCommit("sha1", "add secret", makeFile("secret.txt", line)),
			makeCommit("sha2", "removed", makeFile("secret.txt", "KEY=removed\n")),
		},
	}
	result2 := ScanHistory(req2)

	if len(result2.Findings) == 0 {
		t.Fatal("expected 1 finding from historical commit")
	}
	if result2.Findings[0].StillPresent {
		t.Error("expected StillPresent=false when secret was removed")
	}
}

func TestScanHistoryRedaction(t *testing.T) {
	// AWS key: AKIAIOSFODNN7EXAMPLE (20 chars)
	// Expected redacted: AKIA...LE
	req := HistoryScanRequest{
		Commits: []CommitContent{
			makeCommit("sha1", "msg", makeFile("f.env", "AKIAIOSFODNN7EXAMPLE")),
		},
	}
	result := ScanHistory(req)

	if len(result.Findings) == 0 {
		t.Fatal("expected 1 finding")
	}

	redacted := result.Findings[0].RedactedMatch
	// Must start with first 4 chars of the matched text and end with "..."
	if !strings.Contains(redacted, "...") {
		t.Errorf("expected '...' in redacted match, got %q", redacted)
	}
	// Must not contain the full secret
	if strings.Contains(redacted, "SFODNN7EXAM") {
		t.Errorf("redacted match too revealing: %q", redacted)
	}
	// Must be shorter than original secret
	if len(redacted) >= 20 {
		t.Errorf("redacted match not shorter than original: %q", redacted)
	}
}

func TestScanHistoryNoSecrets(t *testing.T) {
	req := HistoryScanRequest{
		Commits: []CommitContent{
			makeCommit("sha1", "clean commit",
				makeFile("pipeline.yml", "steps:\n  - run: echo hello\n  - name: build\n    image: golang:1.24\n"),
			),
			makeCommit("sha2", "another clean",
				makeFile("Makefile", "build:\n\tgo build ./...\ntest:\n\tgo test ./...\n"),
			),
		},
	}
	result := ScanHistory(req)

	if result.CommitsScanned != 2 {
		t.Errorf("expected 2 commits scanned, got %d", result.CommitsScanned)
	}
	if len(result.Findings) != 0 {
		t.Errorf("expected 0 findings for clean commits, got %d: %+v", len(result.Findings), result.Findings)
	}
}
