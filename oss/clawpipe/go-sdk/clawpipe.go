package clawpipe

import (
	"context"
	"time"
)

const defaultGateway = "https://api.clawpipe.ai/v1"

// ClawPipe is the main client that runs the full pipeline on every prompt.
type ClawPipe struct {
	booster   *Booster
	packer    *Packer
	cache     *Cache
	router    *Router
	gateway   *Gateway
	telemetry *Telemetry
	cfg       pipeFlags
}

type pipeFlags struct {
	enableBooster bool
	enablePacker  bool
	enableCache   bool
}

// New creates a ClawPipe client with the given config.
func New(c Config) *ClawPipe {
	gw := c.GatewayURL
	if gw == "" {
		gw = defaultGateway
	}
	eb, ep, ec := true, true, true
	if c.EnableBooster || c.EnablePacker || c.EnableCache {
		eb, ep, ec = c.EnableBooster, c.EnablePacker, c.EnableCache
	}
	ttl := c.CacheTTLMs
	if ttl == 0 {
		ttl = 300_000
	}
	return &ClawPipe{
		booster:   NewBooster(),
		packer:    NewPacker(),
		cache:     NewCache(ttl, c.CacheMax),
		router:    NewRouter(),
		gateway:   NewGateway(gw, c.APIKey, c.ProjectID),
		telemetry: NewTelemetry(0),
		cfg:       pipeFlags{enableBooster: eb, enablePacker: ep, enableCache: ec},
	}
}

// Prompt sends input through the full pipeline: Booster -> Packer -> Cache -> Router -> Gateway -> Learn.
func (cp *ClawPipe) Prompt(ctx context.Context, input string, opts *PromptOptions) (*Result, error) {
	start := time.Now()
	meta := PipelineMeta{ContextSavings: "0%"}

	// Stage 1: Booster
	if cp.cfg.enableBooster {
		if text, ok := cp.booster.TryResolve(input); ok {
			meta.Boosted = true
			return cp.finalize(text, meta, start, true), nil
		}
	}

	// Stage 2: Packer
	packed := input
	if cp.cfg.enablePacker {
		var sys string
		if opts != nil {
			sys = opts.System
		}
		pr := cp.packer.Pack(input, sys)
		packed = pr.Packed
		meta.Packed = true
		meta.ContextSavings = pr.Savings
	}

	// Stage 3: Cache
	if cp.cfg.enableCache {
		key := cp.cache.Key(packed, opts)
		if cached, ok := cp.cache.Get(key); ok {
			meta.Cached = true
			return cp.finalize(cached, meta, start, false), nil
		}
	}

	// Stage 4: Route
	route := cp.router.Route(packed, opts)
	meta.Route = route.Provider
	meta.Model = route.Model

	// Stage 5: Gateway call
	resp, err := cp.gateway.Call(ctx, packed, opts, route)
	if err != nil {
		return nil, err
	}

	meta.TokensIn = resp.TokensIn
	meta.TokensOut = resp.TokensOut
	cp.router.Learn(route, float64(resp.LatencyMs), resp.TokensOut)

	// Cache the response
	if cp.cfg.enableCache {
		cp.cache.Set(cp.cache.Key(packed, opts), resp.Text)
	}

	return cp.finalize(resp.Text, meta, start, false), nil
}

// Stats returns a telemetry snapshot.
func (cp *ClawPipe) Stats() TelemetrySnapshot { return cp.telemetry.Snapshot() }

func (cp *ClawPipe) finalize(text string, meta PipelineMeta, start time.Time, boosted bool) *Result {
	meta.LatencyMs = time.Since(start).Milliseconds()
	cost := cp.telemetry.EstimateCost(meta.Route, meta.Model, meta.TokensIn, meta.TokensOut)
	if boosted || meta.Cached {
		cost = 0
	}
	meta.EstimatedCostUsd = cost
	cp.telemetry.Record(requestRecord{
		Provider: meta.Route, Model: meta.Model,
		TokensIn: meta.TokensIn, TokensOut: meta.TokensOut,
		LatencyMs: meta.LatencyMs, CostUsd: cost,
		Cached: meta.Cached, Boosted: meta.Boosted,
	})
	return &Result{Text: text, Meta: meta}
}
