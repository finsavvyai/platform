package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestOGCardSVG_RendersValidSVG(t *testing.T) {
	h := &Handlers{}
	r := httptest.NewRequest(http.MethodGet, "/api/v1/og/global.svg", nil)
	w := httptest.NewRecorder()
	h.OGCardSVG(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "image/svg") {
		t.Errorf("Content-Type = %q", ct)
	}
	body := w.Body.String()
	for _, want := range []string{`<svg`, `width="1200"`, `height="630"`, "PIPEWARDEN", "global", "pipewarden.com"} {
		if !strings.Contains(body, want) {
			t.Errorf("body missing %q", want)
		}
	}
}

func TestOGCardSVG_EmptyNameNotFound(t *testing.T) {
	h := &Handlers{}
	r := httptest.NewRequest(http.MethodGet, "/api/v1/og/", nil)
	w := httptest.NewRecorder()
	h.OGCardSVG(w, r)
	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", w.Code)
	}
}

func TestOGCardSVG_EscapesTargetName(t *testing.T) {
	h := &Handlers{}
	r := httptest.NewRequest(http.MethodGet, "/api/v1/og/<script>alert(1)</script>.svg", nil)
	w := httptest.NewRecorder()
	h.OGCardSVG(w, r)

	body := w.Body.String()
	if strings.Contains(body, "<script>") {
		t.Errorf("XSS: raw <script> in svg body")
	}
	if !strings.Contains(body, "&lt;script&gt;") {
		t.Errorf("expected escaped <script> in body")
	}
}

func TestOGHeadline_SeverityRouting(t *testing.T) {
	cases := []struct {
		s        ogStats
		wantWord string
	}{
		{ogStats{critical: 3}, "critical"},
		{ogStats{high: 2}, "high-severity"},
		{ogStats{medium: 1}, "medium"},
		{ogStats{open: 5}, "open"},
		{ogStats{}, "passing"},
	}
	for _, tc := range cases {
		got, _ := ogHeadline(tc.s)
		if !strings.Contains(strings.ToLower(got), tc.wantWord) {
			t.Errorf("headline for %+v = %q, want word %q", tc.s, got, tc.wantWord)
		}
	}
}

func TestOGStatsRow_AllSeveritiesPresent(t *testing.T) {
	row := ogStatsRow(ogStats{critical: 1, high: 2, medium: 3, low: 4})
	for _, want := range []string{"CRITICAL", "HIGH", "MEDIUM", "LOW", ">1<", ">2<", ">3<", ">4<"} {
		if !strings.Contains(row, want) {
			t.Errorf("row missing %q", want)
		}
	}
}

func TestPlural(t *testing.T) {
	if plural(1) != "" {
		t.Error("plural(1) should be empty")
	}
	if plural(0) != "s" || plural(2) != "s" {
		t.Error("plural(0) and plural(2) should be 's'")
	}
}
