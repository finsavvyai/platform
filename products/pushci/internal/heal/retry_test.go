package heal

import (
	"testing"
	"time"

	"github.com/finsavvyai/pushci/internal/ai"
)

func TestDefaultRetryConfig(t *testing.T) {
	cfg := DefaultRetryConfig()
	if cfg.MaxAttempts != 3 {
		t.Errorf("max attempts = %d, want 3", cfg.MaxAttempts)
	}
	if cfg.Backoff != 2*time.Second {
		t.Errorf("backoff = %v, want 2s", cfg.Backoff)
	}
	if !cfg.FixBetween {
		t.Error("fix between should be true")
	}
}

func TestRetryConfigCap(t *testing.T) {
	cfg := RetryConfig{MaxAttempts: 1, Backoff: 0, FixBetween: false}
	if cfg.MaxAttempts != 1 {
		t.Errorf("max attempts = %d, want 1", cfg.MaxAttempts)
	}
}

func TestNewHealerDefaults(t *testing.T) {
	client := ai.NewClient()
	h := NewHealer(client)
	if h.MaxRetry != 1 {
		t.Errorf("max retry = %d, want 1", h.MaxRetry)
	}
}
