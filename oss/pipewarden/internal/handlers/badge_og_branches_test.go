package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

func seedFindingForBadgeTest(t *testing.T, db *storage.DB, severity, runID string) {
	t.Helper()
	if err := db.CreateFinding(&storage.FindingRecord{
		ConnectionName: "c",
		RunID:          runID,
		Severity:       severity,
		Category:       "secrets",
		Title:          "t-" + severity,
		Description:    "d",
		Status:         "open",
	}); err != nil {
		t.Fatalf("CreateFinding %s: %v", severity, err)
	}
}

func TestBadgeStatusReflectsSeverity(t *testing.T) {
	h, db := newTestHandlersDB(t)

	// No findings -> passing
	label, color := badgeStatus(h, "main")
	if label == "" || color == "" {
		t.Fatalf("default empty: %q %q", label, color)
	}

	// Insert a high finding -> "1 high"
	seedFindingForBadgeTest(t, db, "high", "r1")
	label, color = badgeStatus(h, "main")
	if !strings.Contains(label, "high") {
		t.Fatalf("label=%q want contains high", label)
	}
	if color == "#3ddc97" {
		t.Fatalf("color stayed green for high: %q", color)
	}

	// Promote to critical
	seedFindingForBadgeTest(t, db, "critical", "r2")
	label, _ = badgeStatus(h, "main")
	if !strings.Contains(label, "critical") {
		t.Fatalf("label=%q want contains critical", label)
	}
}

func TestBadgeStatusNilDB(t *testing.T) {
	label, color := badgeStatus(nil, "anything")
	if label != "ready" || color == "" {
		t.Fatalf("nil h: %q %q", label, color)
	}
}

func TestReadStatsReflectsCounts(t *testing.T) {
	h, db := newTestHandlersDB(t)
	for _, sev := range []string{"critical", "high", "medium", "low"} {
		seedFindingForBadgeTest(t, db, sev, "r-"+sev)
	}
	s := readStats(h)
	if s.critical != 1 || s.high != 1 || s.medium != 1 || s.low != 1 {
		t.Fatalf("counts wrong: %+v", s)
	}

	if got := readStats(nil); got != (ogStats{}) {
		t.Fatalf("nil h must return zero: %+v", got)
	}
}

func TestOGCardSVGRoutes(t *testing.T) {
	h, _ := newTestHandlersDB(t)

	// Empty name -> 404
	req := httptest.NewRequest("GET", "/api/v1/og/.svg", nil)
	w := httptest.NewRecorder()
	h.OGCardSVG(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("empty name: %d", w.Code)
	}

	// Real name -> SVG bytes
	req = httptest.NewRequest("GET", "/api/v1/og/release.svg", nil)
	w = httptest.NewRecorder()
	h.OGCardSVG(w, req)
	if w.Code != 200 {
		t.Fatalf("real: %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "image/svg+xml") {
		t.Fatalf("ct=%q", ct)
	}
	if !strings.Contains(w.Body.String(), "<svg") {
		t.Fatalf("body missing <svg")
	}
}

func TestOGHeadlineCovers(t *testing.T) {
	for _, tc := range []struct {
		s        ogStats
		hasWord  string
		notWord  string
		isAccent string
	}{
		{ogStats{critical: 2}, "critical", "high", "#e5484d"},
		{ogStats{high: 1}, "high", "critical", "#f5a524"},
		{ogStats{medium: 3}, "medium", "high", "#f5d524"},
		{ogStats{open: 4}, "open", "medium", "#3ddc97"},
		{ogStats{}, "passing", "open", "#3ddc97"},
	} {
		head, accent := ogHeadline(tc.s)
		if !strings.Contains(head, tc.hasWord) {
			t.Fatalf("%v head=%q want contains %q", tc.s, head, tc.hasWord)
		}
		if accent != tc.isAccent {
			t.Fatalf("%v accent=%q want %q", tc.s, accent, tc.isAccent)
		}
	}
}
