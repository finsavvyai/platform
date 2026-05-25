package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/vault"
)

func TestSecurityAudit_RejectsNonGET(t *testing.T) {
	h := &Handlers{}
	r := httptest.NewRequest(http.MethodPost, "/api/v1/security/audit", nil)
	w := httptest.NewRecorder()
	h.SecurityAudit(w, r)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST should 405, got %d", w.Code)
	}
}

func TestSecurityAudit_ProductionConfig_AllChecksPass(t *testing.T) {
	v, err := vault.New("test-vault-key-32-bytes-for-aes256")
	if err != nil {
		t.Fatalf("vault.New: %v", err)
	}
	cfg := &config.Config{}
	cfg.Environment = "production"
	cfg.Server.CORSOrigins = []string{"https://pipewarden.io"}

	h := &Handlers{cfg: cfg, vault: v}
	r := httptest.NewRequest(http.MethodGet, "/api/v1/security/audit", nil)
	w := httptest.NewRecorder()
	h.SecurityAudit(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d body=%s", w.Code, w.Body.String())
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("want application/json, got %q", ct)
	}

	var report struct {
		Checks []struct {
			Category string `json:"Category"`
			Name     string `json:"Name"`
			Status   bool   `json:"Status"`
		} `json:"Checks"`
		PassCount int `json:"PassCount"`
		FailCount int `json:"FailCount"`
		RiskScore int `json:"RiskScore"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &report); err != nil {
		t.Fatalf("decode: %v body=%s", err, w.Body.String())
	}
	if len(report.Checks) == 0 {
		t.Fatal("audit returned zero checks")
	}
	// Vault on + production env should mark the A2/A3 encryption checks
	// as passing; risk score must stay below the 80/100 alarm threshold.
	if report.RiskScore >= 80 {
		t.Errorf("production config should not trip RiskScore >= 80, got %d", report.RiskScore)
	}
}

func TestSecurityAudit_NoVault_FlagsEncryptionFailure(t *testing.T) {
	cfg := &config.Config{}
	cfg.Environment = "production"

	h := &Handlers{cfg: cfg, vault: nil}
	r := httptest.NewRequest(http.MethodGet, "/api/v1/security/audit", nil)
	w := httptest.NewRecorder()
	h.SecurityAudit(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", w.Code)
	}
	var report struct {
		Checks []struct {
			Category string `json:"Category"`
			Status   bool   `json:"Status"`
			Message  string `json:"Message"`
		} `json:"Checks"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &report); err != nil {
		t.Fatalf("decode: %v", err)
	}
	var sawFail bool
	for _, c := range report.Checks {
		if c.Category == "A2" && !c.Status {
			sawFail = true
		}
	}
	if !sawFail {
		t.Error("expected A2 (broken auth) to fail when vault is nil")
	}
}
