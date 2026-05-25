package heal

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestVectorStore_TopKOrderingMakesSense(t *testing.T) {
	dir := t.TempDir()
	os.Setenv("PUSHCI_VECTOR_DIR", dir)
	defer os.Unsetenv("PUSHCI_VECTOR_DIR")

	vs, err := Open("")
	if err != nil {
		t.Fatalf("Open: %v", err)
	}

	synthetic := []RunRecord{
		{Repo: "app", Stage: "test", Stderr: "ImportError: No module named requests", AppliedFix: "pip install requests", Outcome: "passed"},
		{Repo: "app", Stage: "test", Stderr: "ModuleNotFoundError: pandas missing", AppliedFix: "pip install pandas", Outcome: "passed"},
		{Repo: "app", Stage: "build", Stderr: "Cannot find module lodash", AppliedFix: "npm install lodash", Outcome: "passed"},
		{Repo: "app", Stage: "build", Stderr: "MODULE_NOT_FOUND react-dom", AppliedFix: "npm install react-dom", Outcome: "passed"},
		{Repo: "api", Stage: "lint", Stderr: "go.sum is out of sync", AppliedFix: "go mod tidy", Outcome: "passed"},
		{Repo: "api", Stage: "test", Stderr: "no required module provides package foo", AppliedFix: "go mod tidy", Outcome: "passed"},
		{Repo: "api", Stage: "test", Stderr: "port 8080 already in use", AppliedFix: "kill -9 $(lsof -t -i:8080)", Outcome: "passed"},
		{Repo: "cli", Stage: "fmt", Stderr: "gofmt would reformat main.go", AppliedFix: "go fmt ./...", Outcome: "passed"},
		{Repo: "cli", Stage: "fmt", Stderr: "prettier Check failed on src/index.ts", AppliedFix: "npx prettier --write .", Outcome: "passed"},
		{Repo: "infra", Stage: "deploy", Stderr: "permission denied /usr/local/bin/pushci", AppliedFix: "chmod +x", Outcome: "passed"},
	}
	ctx := context.Background()
	base := time.Now().Add(-240 * time.Hour)
	for i, r := range synthetic {
		r.Timestamp = base.Add(time.Duration(i) * time.Hour)
		if err := vs.Index(ctx, r); err != nil {
			t.Fatalf("Index[%d]: %v", i, err)
		}
	}

	// Query close to record 0 (python missing requests). Expect
	// a python-related record to be top-1.
	got, err := vs.Query(ctx, "ImportError: No module named requests in tests", 3)
	if err != nil {
		t.Fatalf("Query: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("want 3 hits, got %d", len(got))
	}
	topStderr := got[0].Record.Stderr
	if !strings.Contains(topStderr, "ImportError") && !strings.Contains(topStderr, "ModuleNotFoundError") {
		t.Errorf("top-1 should be python-related; got %q", topStderr)
	}
	// Sorted descending.
	if got[0].Similarity < got[1].Similarity || got[1].Similarity < got[2].Similarity {
		t.Errorf("hits not sorted desc: %.3f %.3f %.3f",
			got[0].Similarity, got[1].Similarity, got[2].Similarity)
	}
}

func TestVectorStore_RoundTripPersists(t *testing.T) {
	dir := t.TempDir()
	vs, _ := Open(dir)
	_ = vs.Index(context.Background(), RunRecord{Stderr: "gofmt issue"})
	vs2, _ := Open(dir)
	hits, _ := vs2.Query(context.Background(), "gofmt", 1)
	if len(hits) != 1 {
		t.Fatalf("persist round-trip failed, got %d hits", len(hits))
	}
}

func TestVectorStore_EmptyQuery(t *testing.T) {
	vs, _ := Open(t.TempDir())
	hits, err := vs.Query(context.Background(), "anything", 5)
	if err != nil || len(hits) != 0 {
		t.Fatalf("empty store should return empty, got %v err=%v", hits, err)
	}
}

// TestVectorStore_PrivacyNoNetImports: static guarantee that Index/
// Query never touch the network — impl files import no net stdlib.
func TestVectorStore_PrivacyNoNetImports(t *testing.T) {
	files := []string{"vector.go", "vector_embed.go", "vector_types.go"}
	bad := []string{`"net"`, `"net/http"`, `"net/rpc"`, `"net/smtp"`, `"database/sql"`}
	for _, f := range files {
		b, err := os.ReadFile(filepath.Join(".", f))
		if err != nil {
			t.Fatalf("read %s: %v", f, err)
		}
		for _, x := range bad {
			if strings.Contains(string(b), x) {
				t.Errorf("%s imports %s; must remain offline", f, x)
			}
		}
	}
}
