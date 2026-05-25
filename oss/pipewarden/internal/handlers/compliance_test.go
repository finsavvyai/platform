package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// TestComplianceReportSOC2 verifies SOC2 report with findings.
func TestComplianceReportSOC2(t *testing.T) {
	h := newTestHandlers(t)

	// Insert 2 findings that map to SOC2 controls.
	findings := []storage.FindingRecord{
		{
			ConnectionName: "ci",
			RunID:          "run-1",
			Severity:       "critical",
			Category:       "secret",
			Title:          "AWS key exposed",
			Description:    "Found in env",
			Status:         "open",
			CreatedAt:      time.Now().UTC(),
		},
		{
			ConnectionName: "ci",
			RunID:          "run-1",
			Severity:       "high",
			Category:       "supply-chain",
			Title:          "Unpinned action",
			Description:    "actions/checkout@v3 not pinned",
			Status:         "open",
			CreatedAt:      time.Now().UTC(),
		},
	}
	for i := range findings {
		if err := h.db.CreateFinding(&findings[i]); err != nil {
			t.Fatalf("insert finding %d: %v", i, err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/compliance/soc2", nil)
	w := httptest.NewRecorder()

	h.GenerateComplianceReport(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d — %s", w.Code, w.Body.String())
	}

	var report ComplianceReport
	if err := json.NewDecoder(w.Body).Decode(&report); err != nil {
		t.Fatalf("failed to decode report: %v", err)
	}

	if report.Framework != "soc2" {
		t.Errorf("expected framework soc2, got %q", report.Framework)
	}
	if report.Summary.Score < 0 || report.Summary.Score > 100 {
		t.Errorf("score %d out of range 0-100", report.Summary.Score)
	}
	if len(report.Controls) == 0 {
		t.Error("expected non-empty controls array")
	}
}

// TestComplianceReportInvalidFramework returns 400 for unknown framework.
func TestComplianceReportInvalidFramework(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/compliance/nist", nil)
	w := httptest.NewRecorder()

	h.GenerateComplianceReport(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

// TestComplianceReportEmpty returns score 100 when no findings exist.
func TestComplianceReportEmpty(t *testing.T) {
	h := newTestHandlers(t)

	for _, fw := range []string{"soc2", "hipaa", "gdpr", "pci-dss"} {
		t.Run(fw, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/compliance/"+fw, nil)
			w := httptest.NewRecorder()

			h.GenerateComplianceReport(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d", w.Code)
			}

			var report ComplianceReport
			if err := json.NewDecoder(w.Body).Decode(&report); err != nil {
				t.Fatalf("decode: %v", err)
			}

			if report.Summary.Score != 100 {
				t.Errorf("expected score 100 with no findings, got %d", report.Summary.Score)
			}
			if report.Summary.Failing != 0 {
				t.Errorf("expected 0 failing controls, got %d", report.Summary.Failing)
			}
		})
	}
}

// TestComplianceReportMethodNotAllowed rejects non-GET requests.
func TestComplianceReportMethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/compliance/soc2", nil)
	w := httptest.NewRecorder()

	h.GenerateComplianceReport(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}

// TestComplianceReportAllFrameworks verifies each supported framework returns 200.
func TestComplianceReportAllFrameworks(t *testing.T) {
	h := newTestHandlers(t)

	for _, fw := range []string{"soc2", "hipaa", "gdpr", "pci-dss"} {
		t.Run(fw, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/compliance/"+fw, nil)
			w := httptest.NewRecorder()

			h.GenerateComplianceReport(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("expected 200, got %d", w.Code)
			}
		})
	}
}
