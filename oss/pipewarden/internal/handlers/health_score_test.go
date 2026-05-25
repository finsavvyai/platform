package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/storage"
)

func newHealthTestHandlers(t *testing.T) (*Handlers, *storage.DB) {
	t.Helper()
	db, err := storage.NewInMemory()
	if err != nil {
		t.Fatalf("failed to create db: %v", err)
	}
	logger, err := logging.New(&logging.Config{Level: "error"})
	if err != nil {
		t.Fatalf("failed to create logger: %v", err)
	}
	return New(db, integrations.NewManager(logger), nil, nil, logger, nil), db
}

func TestHealthScorePerfect(t *testing.T) {
	h, db := newHealthTestHandlers(t)
	defer func() { _ = db.Close() }()

	// Insert a recent analysis record so scan recency = 100
	now := time.Now().UTC()
	err := db.CreateAnalysisRecord(&storage.AnalysisRecord{
		ConnectionName: "myconn",
		RunID:          "run-1",
		Summary:        "all clear",
		RiskScore:      0,
		FindingsCount:  0,
		AnalyzedAt:     now,
	})
	if err != nil {
		t.Fatalf("CreateAnalysisRecord: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/myconn/health", nil)
	w := httptest.NewRecorder()
	h.GetHealthScore(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var hs HealthScore
	if err := json.NewDecoder(w.Body).Decode(&hs); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if hs.Score < 90 {
		t.Errorf("expected score >= 90 (perfect), got %d", hs.Score)
	}
	if hs.Grade != "A" {
		t.Errorf("expected grade A, got %s", hs.Grade)
	}
}

func TestHealthScoreWithFindings(t *testing.T) {
	h, db := newHealthTestHandlers(t)
	defer func() { _ = db.Close() }()

	// 4 open secret-exposure + 4 open container-security + 5 policy violations
	// secret score:    100 - 4*25 = 0  → contributes 0*30/100 = 0
	// container score: 100 - 4*30 = -20 → clamped 0 → 0*20/100 = 0
	// policy score:    100 - 5*20 = 0  → 0*15/100 = 0
	// action pinning:  100             → 100*25/100 = 25
	// scan recency:    0 (no scan)     → 0*10/100 = 0
	// total = 25 → grade F (< 40)
	findings := []storage.FindingRecord{
		{ConnectionName: "conn1", Severity: "critical", Category: "secret-exposure", Title: "AWS key1", Status: "open"},
		{ConnectionName: "conn1", Severity: "critical", Category: "secret-exposure", Title: "AWS key2", Status: "open"},
		{ConnectionName: "conn1", Severity: "critical", Category: "secret-exposure", Title: "GH token1", Status: "open"},
		{ConnectionName: "conn1", Severity: "critical", Category: "secret-exposure", Title: "GH token2", Status: "open"},
		{ConnectionName: "conn1", Severity: "high", Category: "container-security", Title: "Root user1", Status: "open"},
		{ConnectionName: "conn1", Severity: "high", Category: "container-security", Title: "Root user2", Status: "open"},
		{ConnectionName: "conn1", Severity: "high", Category: "container-security", Title: "Root user3", Status: "open"},
		{ConnectionName: "conn1", Severity: "high", Category: "container-security", Title: "Root user4", Status: "open"},
		{ConnectionName: "conn1", Severity: "medium", Category: "policy", Title: "Policy1", Status: "open"},
		{ConnectionName: "conn1", Severity: "medium", Category: "policy", Title: "Policy2", Status: "open"},
		{ConnectionName: "conn1", Severity: "medium", Category: "policy", Title: "Policy3", Status: "open"},
		{ConnectionName: "conn1", Severity: "medium", Category: "policy", Title: "Policy4", Status: "open"},
		{ConnectionName: "conn1", Severity: "medium", Category: "policy", Title: "Policy5", Status: "open"},
	}
	for i := range findings {
		if err := db.CreateFinding(&findings[i]); err != nil {
			t.Fatalf("CreateFinding: %v", err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/conn1/health", nil)
	w := httptest.NewRecorder()
	h.GetHealthScore(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var hs HealthScore
	if err := json.NewDecoder(w.Body).Decode(&hs); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if hs.Score >= 40 {
		t.Errorf("expected score < 40 (grade F) with many critical findings, got %d", hs.Score)
	}
	if hs.Grade != "F" {
		t.Errorf("expected grade F, got %s", hs.Grade)
	}
}

func TestHealthScoreGrades(t *testing.T) {
	cases := []struct {
		score int
		grade string
	}{
		{100, "A"}, {90, "A"}, {89, "B"}, {75, "B"},
		{74, "C"}, {60, "C"}, {59, "D"}, {40, "D"},
		{39, "F"}, {0, "F"},
	}
	for _, tc := range cases {
		got := scoreGrade(tc.score)
		if got != tc.grade {
			t.Errorf("scoreGrade(%d) = %q, want %q", tc.score, got, tc.grade)
		}
	}
}

func TestHealthScoreDimensions(t *testing.T) {
	h, db := newHealthTestHandlers(t)
	defer func() { _ = db.Close() }()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/empty/health", nil)
	w := httptest.NewRecorder()
	h.GetHealthScore(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var hs HealthScore
	if err := json.NewDecoder(w.Body).Decode(&hs); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(hs.Dimensions) != 5 {
		t.Errorf("expected 5 dimensions, got %d", len(hs.Dimensions))
	}
	want := map[string]bool{
		"Action Pinning": true, "Secret Hygiene": true,
		"Container Security": true, "Policy Compliance": true, "Scan Recency": true,
	}
	for _, d := range hs.Dimensions {
		if !want[d.Name] {
			t.Errorf("unexpected dimension: %q", d.Name)
		}
		delete(want, d.Name)
	}
	for name := range want {
		t.Errorf("missing dimension: %q", name)
	}
}
