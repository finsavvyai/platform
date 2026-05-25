package handlers

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGenerateComplianceReportWrongMethod(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	w, _ := doJSON(t, h.GenerateComplianceReport, "POST", "", nil)
	if w.Code != 405 {
		t.Fatalf("wrong method: %d", w.Code)
	}
}

func TestGenerateComplianceReportUnknownFramework(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("GET", "/api/v1/compliance/voodoo", nil)
	w := httptest.NewRecorder()
	h.GenerateComplianceReport(w, req)
	if w.Code != 400 {
		t.Fatalf("unknown framework: %d body=%s", w.Code, w.Body.String())
	}
}

func TestGenerateComplianceReportCSV(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("GET", "/api/v1/compliance/soc2?format=csv", nil)
	w := httptest.NewRecorder()
	h.GenerateComplianceReport(w, req)
	if w.Code != 200 {
		t.Fatalf("csv: %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/csv") {
		t.Fatalf("CT: %q", ct)
	}
}

func TestGenerateComplianceReportMarkdown(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("GET", "/api/v1/compliance/hipaa?format=markdown", nil)
	w := httptest.NewRecorder()
	h.GenerateComplianceReport(w, req)
	if w.Code != 200 {
		t.Fatalf("md: %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/markdown") {
		t.Fatalf("CT: %q", ct)
	}
}

func TestGenerateComplianceReportJSON(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("GET", "/api/v1/compliance/gdpr", nil)
	w := httptest.NewRecorder()
	h.GenerateComplianceReport(w, req)
	if w.Code != 200 {
		t.Fatalf("json: %d", w.Code)
	}
}

func TestGenerateComplianceReportPCI(t *testing.T) {
	h, _ := newTestHandlersDB(t)
	req := httptest.NewRequest("GET", "/api/v1/compliance/pci-dss?from=2026-01-01T00:00:00Z&to=2026-12-31T00:00:00Z", nil)
	w := httptest.NewRecorder()
	h.GenerateComplianceReport(w, req)
	if w.Code != 200 {
		t.Fatalf("pci: %d", w.Code)
	}
}
