package audit

import (
	"errors"
	"testing"
	"time"
)

func TestBuildSuccessLog_TokenAndCost(t *testing.T) {
	row := BuildSuccessLog("tnt_abc", "usr_x", "anthropic",
		"claude-haiku-4-5", "alert",
		"prompt of about 40 chars padded ......",
		"response", 250*time.Millisecond, false)
	if row.Status != "ok" {
		t.Errorf("status: %q", row.Status)
	}
	if row.LatencyMs != 250 {
		t.Errorf("latency: %d", row.LatencyMs)
	}
	if row.PromptTokens == nil || *row.PromptTokens == 0 {
		t.Error("prompt tokens should be populated")
	}
	if row.CostUSDMicros == nil || *row.CostUSDMicros <= 0 {
		t.Errorf("cost should be > 0, got %v", row.CostUSDMicros)
	}
	if row.Cached {
		t.Error("non-cached row marked cached")
	}
}

func TestBuildSuccessLog_CachedZeroCost(t *testing.T) {
	row := BuildSuccessLog("tnt_abc", "usr_x", "cache", "claude-haiku",
		"alert", "prompt", "resp", 1*time.Millisecond, true)
	if !row.Cached {
		t.Error("cached row not marked")
	}
	if row.CostUSDMicros == nil || *row.CostUSDMicros != 0 {
		t.Errorf("cached cost should be 0, got %v", row.CostUSDMicros)
	}
}

func TestBuildErrorLog(t *testing.T) {
	row := BuildErrorLog("tnt_abc", "usr_x", "bedrock", "claude-haiku",
		"alert", "prompt", "TIMEOUT", 5*time.Second)
	if row.Status != "error" {
		t.Errorf("status: %q", row.Status)
	}
	if row.ErrorCode != "TIMEOUT" {
		t.Errorf("error code: %q", row.ErrorCode)
	}
	if row.CompletionTokens == nil || *row.CompletionTokens != 0 {
		t.Error("completion tokens should be 0 on error")
	}
	if row.CostUSDMicros != nil {
		t.Error("error row should not have cost")
	}
}

func TestClassifyError(t *testing.T) {
	tests := []struct {
		err  string
		want string
	}{
		{"timeout exceeded", "TIMEOUT"},
		{"503 service unavailable", "UPSTREAM_5XX"},
		{"429 too many requests", "UPSTREAM_RATE_LIMITED"},
		{"401 unauthorized", "AUTH"},
		{"fallback exhausted (2 providers)", "ALL_PROVIDERS_FAILED"},
		{"weird unknown thing", "UNKNOWN"},
	}
	for _, tt := range tests {
		t.Run(tt.want, func(t *testing.T) {
			got := ClassifyError(errors.New(tt.err))
			if got != tt.want {
				t.Errorf("classify(%q) = %q want %q", tt.err, got, tt.want)
			}
		})
	}
	if ClassifyError(nil) != "" {
		t.Error("nil error should produce empty code")
	}
}

func TestEstimateCostMicros_KnownModels(t *testing.T) {
	tests := []struct {
		model      string
		pTok, cTok int
		wantNonNil bool
	}{
		{"claude-haiku-4-5", 1000, 500, true},
		{"claude-sonnet-4", 1000, 500, true},
		{"gpt-4o", 1000, 500, true},
		{"unknown-model-xyz", 1000, 500, false},
		{"", 1000, 500, false},
	}
	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			got := EstimateCostMicros(tt.model, tt.pTok, tt.cTok)
			if (got != nil) != tt.wantNonNil {
				t.Errorf("got=%v wantNonNil=%v", got, tt.wantNonNil)
			}
			if got != nil && *got <= 0 {
				t.Errorf("expected positive cost, got %d", *got)
			}
		})
	}
}
