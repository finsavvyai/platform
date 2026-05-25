package main

import (
	"bytes"
	"context"
	"strings"
	"testing"
	"time"

	"github.com/finsavvyai/pushci/internal/heal"
)

type fakeStore struct {
	hits []heal.SimilarRun
	err  error
}

func (f *fakeStore) Query(_ context.Context, _ string, _ int) ([]heal.SimilarRun, error) {
	return f.hits, f.err
}

func TestRunHealSemantic_PrintsCuratedThenSimilar(t *testing.T) {
	fs := &fakeStore{hits: []heal.SimilarRun{
		{Similarity: 0.91, Record: heal.RunRecord{
			Timestamp:  time.Date(2026, 3, 14, 0, 0, 0, 0, time.UTC),
			Stderr:     "ImportError: No module named requests",
			AppliedFix: "pip install requests",
			Outcome:    "passed",
		}},
		{Similarity: 0.72, Record: heal.RunRecord{
			Timestamp:  time.Date(2026, 2, 10, 0, 0, 0, 0, time.UTC),
			Stderr:     "ModuleNotFoundError pandas",
			AppliedFix: "pip install pandas",
			Outcome:    "passed",
		}},
	}}
	var buf bytes.Buffer
	d, err := runHealSemantic(context.Background(), fs, "ModuleNotFoundError: No module named requests", 2, &buf)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	// Curated pattern must fire for "No module named".
	if d.Fix == nil || d.Fix.Pattern != "python-missing-dep" {
		t.Fatalf("expected python-missing-dep curated hit, got %+v", d.Fix)
	}
	out := buf.String()
	for _, want := range []string{
		"Curated match:",
		"python-missing-dep",
		"2 similar failures in your history:",
		"2026-03-14",
		"pip install requests",
		"No data left this machine",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("output missing %q:\n%s", want, out)
		}
	}
}

func TestRunHealSemantic_NoStoreNoHistoryFallsThrough(t *testing.T) {
	var buf bytes.Buffer
	_, err := runHealSemantic(context.Background(), nil, "unknown error nobody has seen", 3, &buf)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	out := buf.String()
	if !strings.Contains(out, "No curated pattern matched") {
		t.Errorf("expected curated-miss message, got:\n%s", out)
	}
	if !strings.Contains(out, "Set PUSHCI_VECTOR_INDEX=1") {
		t.Errorf("expected indexing hint, got:\n%s", out)
	}
}

func TestFormatHit_EmptyFix(t *testing.T) {
	s := formatHit(heal.RunRecord{Stderr: "err", Outcome: "failed"})
	if !strings.Contains(s, "(no fix applied)") {
		t.Errorf("expected placeholder, got %q", s)
	}
}
