package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

// TestSBOMEndpoint verifies CycloneDX 1.4 SBOM generation.
func TestSBOMEndpoint(t *testing.T) {
	h := newTestHandlers(t)

	// Insert a finding for the connection.
	f := &storage.FindingRecord{
		ConnectionName: "my-conn",
		RunID:          "run-001",
		Severity:       "high",
		Category:       "secret",
		Title:          "Exposed AWS key",
		Description:    "AWS access key found in workflow env",
		Status:         "open",
		Confidence:     0.95,
		CreatedAt:      time.Now().UTC(),
	}
	if err := h.db.CreateFinding(f); err != nil {
		t.Fatalf("failed to insert finding: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/my-conn/sbom", nil)
	w := httptest.NewRecorder()

	h.GenerateSBOM(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d — body: %s", w.Code, w.Body.String())
	}

	ct := w.Header().Get("Content-Type")
	if ct != "application/vnd.cyclonedx+json" {
		t.Errorf("expected CycloneDX content-type, got %q", ct)
	}

	var doc SBOMDocument
	if err := json.NewDecoder(w.Body).Decode(&doc); err != nil {
		t.Fatalf("failed to decode SBOM: %v", err)
	}

	if doc.BOMFormat != "CycloneDX" {
		t.Errorf("expected bomFormat CycloneDX, got %q", doc.BOMFormat)
	}
	if doc.SpecVersion != "1.4" {
		t.Errorf("expected specVersion 1.4, got %q", doc.SpecVersion)
	}
	if len(doc.Vulnerabilities) != 1 {
		t.Errorf("expected 1 vulnerability, got %d", len(doc.Vulnerabilities))
	}
}

// TestSBOMEndpoint_MultipleFindings verifies all findings appear as vulnerabilities.
func TestSBOMEndpoint_MultipleFindings(t *testing.T) {
	h := newTestHandlers(t)

	titles := []string{"Missing test step", "No lint step", "No SAST step"}
	for i := 0; i < 3; i++ {
		f := &storage.FindingRecord{
			ConnectionName: "proj",
			RunID:          "run-002",
			Severity:       "medium",
			Category:       "policy",
			Title:          titles[i],
			Description:    "No test step found",
			Status:         "open",
			CreatedAt:      time.Now().UTC(),
		}
		if err := h.db.CreateFinding(f); err != nil {
			t.Fatalf("insert %d: %v", i, err)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/proj/sbom", nil)
	w := httptest.NewRecorder()

	h.GenerateSBOM(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var doc SBOMDocument
	_ = json.NewDecoder(w.Body).Decode(&doc)

	if len(doc.Vulnerabilities) != 3 {
		t.Errorf("expected 3 vulnerabilities, got %d", len(doc.Vulnerabilities))
	}
}

// TestSBOMEndpoint_NoFindings returns empty vulnerabilities for unknown connection.
func TestSBOMEndpoint_NoFindings(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/connections/empty-conn/sbom", nil)
	w := httptest.NewRecorder()

	h.GenerateSBOM(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var doc SBOMDocument
	_ = json.NewDecoder(w.Body).Decode(&doc)

	if doc.BOMFormat != "CycloneDX" {
		t.Errorf("expected CycloneDX bomFormat")
	}
	if len(doc.Vulnerabilities) != 0 {
		t.Errorf("expected 0 vulnerabilities, got %d", len(doc.Vulnerabilities))
	}
}

// TestSBOMEndpoint_MethodNotAllowed rejects non-GET.
func TestSBOMEndpoint_MethodNotAllowed(t *testing.T) {
	h := newTestHandlers(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/connections/my-conn/sbom", nil)
	w := httptest.NewRecorder()

	h.GenerateSBOM(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Code)
	}
}
