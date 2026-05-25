package collector

import (
	"context"
	"log/slog"

	"github.com/sdlc-ai/platform/services/insights-collector/internal/config"
)

type Collector struct {
	cfg *config.Config
	log *slog.Logger
}

func New(cfg *config.Config, log *slog.Logger) *Collector {
	return &Collector{cfg: cfg, log: log}
}

func (c *Collector) Run(ctx context.Context) error {
	c.log.Info("collector starting", "service", c.cfg.ServiceName)
	<-ctx.Done()
	c.log.Info("collector stopping")
	return nil
}
