package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/sdlc-ai/platform/services/insights-collector/internal/collector"
	"github.com/sdlc-ai/platform/services/insights-collector/internal/config"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := config.Load()
	if err != nil {
		log.Error("config load", "err", err)
		os.Exit(1)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	c := collector.New(cfg, log)
	if err := c.Run(ctx); err != nil {
		log.Error("collector exited", "err", err)
		os.Exit(1)
	}
}
