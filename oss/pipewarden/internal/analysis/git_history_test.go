package analysis

import (
	"strings"
	"testing"
)

const sampleGitLog = `__COMMIT__ abc1234567890def | Alice <alice@example.com> | 2026-04-01T10:00:00+00:00
diff --git a/config.yml b/config.yml
index aaaaa..bbbbb 100644
--- a/config.yml
+++ b/config.yml
@@ -1,3 +1,4 @@
 server:
   port: 8080
+  aws_key: AKIAIOSFODNN7EXAMPLE
 done

__COMMIT__ def4567890abc123ab | Bob <bob@example.com> | 2026-04-02T11:30:00+00:00
diff --git a/main.go b/main.go
index ccccc..ddddd 100644
--- a/main.go
+++ b/main.go
@@ -10,3 +10,4 @@ func main() {
 	x := 1
+	githubToken := "ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
 }
`

func TestScanLogOutput_FindsAWSKey(t *testing.T) {
	s := NewGitHistoryScanner()
	hits := s.scanLogOutput(sampleGitLog)
	found := false
	for _, h := range hits {
		if strings.Contains(strings.ToLower(h.Pattern), "aws") {
			found = true
			if h.CommitSHA != "abc1234567890def" {
				t.Errorf("AWS hit attributed to wrong commit: %q", h.CommitSHA)
			}
			if h.Author != "Alice <alice@example.com>" {
				t.Errorf("author wrong: %q", h.Author)
			}
			if h.File != "config.yml" {
				t.Errorf("file wrong: %q", h.File)
			}
		}
	}
	if !found {
		t.Errorf("expected an AWS-key hit; got %v", hits)
	}
}

func TestScanLogOutput_FindsGitHubToken(t *testing.T) {
	s := NewGitHistoryScanner()
	hits := s.scanLogOutput(sampleGitLog)
	found := false
	for _, h := range hits {
		if strings.Contains(strings.ToLower(h.Pattern), "github") {
			found = true
			if h.CommitSHA != "def4567890abc123ab" {
				t.Errorf("GitHub hit attributed to wrong commit: %q", h.CommitSHA)
			}
		}
	}
	if !found {
		t.Errorf("expected a GitHub-token hit; got %v", hits)
	}
}

func TestScanLogOutput_IgnoresRemovedLines(t *testing.T) {
	log := `__COMMIT__ deadbeef | a <a@x> | 2026-04-01T00:00:00+00:00
diff --git a/x b/x
+++ b/x
-aws_key: AKIAIOSFODNN7EXAMPLE
`
	s := NewGitHistoryScanner()
	hits := s.scanLogOutput(log)
	if len(hits) != 0 {
		t.Errorf("removed lines (-) should not produce hits, got %v", hits)
	}
}

func TestScanLogOutput_HandlesEmptyInput(t *testing.T) {
	s := NewGitHistoryScanner()
	if hits := s.scanLogOutput(""); hits != nil {
		t.Errorf("empty input should yield nil, got %v", hits)
	}
}

func TestParseCommitHeader_StripsPrefixAndSplits(t *testing.T) {
	sha, author, date := parseCommitHeader("__COMMIT__ abc | Alice | 2026-04-01")
	if sha != "abc" || author != "Alice" || date != "2026-04-01" {
		t.Errorf("parseCommitHeader mismatch: sha=%q author=%q date=%q", sha, author, date)
	}
}

func TestParseCommitHeader_HandlesMissingFields(t *testing.T) {
	sha, author, date := parseCommitHeader("__COMMIT__ abc-only")
	if sha != "abc-only" || author != "" || date != "" {
		t.Errorf("malformed header should return sha+empties, got sha=%q author=%q date=%q", sha, author, date)
	}
}

func TestHistorySecretsToFindings_StampsContext(t *testing.T) {
	hits := []HistorySecret{{
		CommitSHA: "abcdef1234",
		Author:    "Alice",
		Date:      "2026-04-01",
		File:      "config.yml",
		Line:      3,
		Pattern:   "AWS Key",
		Match:     "AKIA****",
		Severity:  SeverityCritical,
	}}
	findings := HistorySecretsToFindings("my-conn", hits)
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d", len(findings))
	}
	f := findings[0]
	if f.Category != CategorySecrets {
		t.Errorf("category should be secrets, got %q", f.Category)
	}
	if f.RunID != "abcdef1234" {
		t.Errorf("RunID should be the commit SHA, got %q", f.RunID)
	}
	if !strings.Contains(f.Remediation, "Rotate") {
		t.Errorf("remediation should advise rotation, got %q", f.Remediation)
	}
}

func TestShortSHA(t *testing.T) {
	if got := short("abcdef1234"); got != "abcdef12" {
		t.Errorf("short() should truncate to 8 chars, got %q", got)
	}
	if got := short("abc"); got != "abc" {
		t.Errorf("short() should pass through short input, got %q", got)
	}
}
