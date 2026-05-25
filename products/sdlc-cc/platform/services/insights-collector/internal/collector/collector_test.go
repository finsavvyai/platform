package collector

import (
	"context"
	"log/slog"
	"io"
	"testing"
	"time"

	"github.com/sdlc-ai/platform/services/insights-collector/internal/config"
)

func TestCollectorRunStopsOnContextCancel(t *testing.T) {
	c := New(&config.Config{ServiceName: "test"}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	if err := c.Run(ctx); err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
}
