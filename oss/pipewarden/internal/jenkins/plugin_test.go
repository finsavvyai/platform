package jenkins

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestPluginConfigFromEnv(t *testing.T) {
	t.Setenv("PIPEWARDEN_URL", "https://app.pipewarden.com/")
	t.Setenv("PIPEWARDEN_TOKEN", "tok_test")
	t.Setenv("JOB_NAME", "my-pipeline")
	t.Setenv("BUILD_NUMBER", "42")

	cfg := PluginConfigFromEnv()
	if cfg.ServerURL != "https://app.pipewarden.com" {
		t.Errorf("expected trailing slash trimmed, got %q", cfg.ServerURL)
	}
	if cfg.Token != "tok_test" {
		t.Errorf("expected token, got %q", cfg.Token)
	}
	if cfg.JobName != "my-pipeline" {
		t.Errorf("expected job name, got %q", cfg.JobName)
	}
	if cfg.BuildNumber != "42" {
		t.Errorf("expected build number '42', got %q", cfg.BuildNumber)
	}
}

func TestValidate_Missing(t *testing.T) {
	p := New(PluginConfig{})
	if err := p.Validate(); err == nil {
		t.Error("expected error for empty config")
	}

	p2 := New(PluginConfig{ServerURL: "http://host", Token: "tok"})
	if err := p2.Validate(); err == nil {
		t.Error("expected error for missing JOB_NAME")
	}
}

func TestValidate_OK(t *testing.T) {
	p := New(PluginConfig{
		ServerURL:   "http://host",
		Token:       "tok",
		JobName:     "pipeline",
		BuildNumber: "1",
	})
	if err := p.Validate(); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestTriggerScan_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.Header.Get("Authorization") != "Bearer testtoken" {
			t.Errorf("unexpected auth header: %s", r.Header.Get("Authorization"))
		}
		result := ScanResponse{
			FindingsCount: 3,
			RiskScore:     45,
			Summary:       "3 findings detected",
			ScanID:        "scan-abc",
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(result)
	}))
	defer srv.Close()

	p := &Plugin{
		cfg: PluginConfig{
			ServerURL:   srv.URL,
			Token:       "testtoken",
			JobName:     "my-pipeline",
			BuildNumber: "5",
			Branch:      "main",
		},
		httpClient: srv.Client(),
	}

	result, err := p.TriggerScan(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.FindingsCount != 3 {
		t.Errorf("expected 3 findings, got %d", result.FindingsCount)
	}
	if result.RiskScore != 45 {
		t.Errorf("expected risk score 45, got %d", result.RiskScore)
	}
	if result.ScanID != "scan-abc" {
		t.Errorf("expected scan ID 'scan-abc', got %q", result.ScanID)
	}
}

func TestTriggerScan_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("internal error"))
	}))
	defer srv.Close()

	p := &Plugin{
		cfg: PluginConfig{
			ServerURL:   srv.URL,
			Token:       "tok",
			JobName:     "job",
			BuildNumber: "1",
		},
		httpClient: srv.Client(),
	}

	_, err := p.TriggerScan(context.Background())
	if err == nil {
		t.Error("expected error for 500 response")
	}
}

func TestExitCode(t *testing.T) {
	tests := []struct {
		result    *ScanResponse
		threshold int
		expected  int
	}{
		{nil, 50, 2},
		{&ScanResponse{RiskScore: 30}, 50, 0},
		{&ScanResponse{RiskScore: 75}, 50, 1},
		{&ScanResponse{RiskScore: 50}, 50, 1}, // at threshold = fail
	}
	for _, tt := range tests {
		got := ExitCode(tt.result, tt.threshold)
		if got != tt.expected {
			t.Errorf("score=%v threshold=%d: expected exit %d, got %d",
				tt.result, tt.threshold, tt.expected, got)
		}
	}
}

func TestConnectionNameFallback(t *testing.T) {
	// When Connection is empty, should use JobName
	called := false
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		var req ScanRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.ConnectionName != "my-job" {
			t.Errorf("expected connection_name='my-job', got %q", req.ConnectionName)
		}
		_ = json.NewEncoder(w).Encode(ScanResponse{})
	}))
	defer srv.Close()

	p := &Plugin{
		cfg: PluginConfig{
			ServerURL:   srv.URL,
			Token:       "tok",
			JobName:     "my-job",
			BuildNumber: "1",
			Connection:  "", // empty — should fall back to JobName
		},
		httpClient: srv.Client(),
	}

	_, _ = p.TriggerScan(context.Background())
	if !called {
		t.Error("expected HTTP call to be made")
	}
}
