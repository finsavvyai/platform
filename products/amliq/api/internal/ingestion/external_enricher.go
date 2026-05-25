package ingestion

import (
	"context"
	"sync"
)

// ExternalEnricher fans out a single entity query to upstream MCP
// data partners (Moody's screening, D&B corporate hierarchy) and
// returns a unified result. Both adapters are nil-safe — if env
// vars aren't set the constructor returns nil for that side and
// EnrichEntity simply skips it.
//
// Use when local screening (engine.Screen) finishes; treat external
// hits as extra signal, not as a replacement. Most institutions
// reconcile external data nightly, so a per-call lookup on top of
// the local pipeline is the right granularity.
type ExternalEnricher struct {
	moodys *MoodysMCP
	dnb    *DnBMCP
}

// EnrichmentResult holds whatever the external sources returned.
// Nil slices/pointer fields mean "not configured" or "no hit" —
// callers distinguish via the IsConfigured method.
type EnrichmentResult struct {
	MoodysMatches []MoodysMatch
	DnBHierarchy  *DnBHierarchy
	Errors        map[string]error // source name → error if that source failed
}

// EnricherInput is the per-call lookup key. DUNS is optional — if
// blank we skip D&B entirely. EntityType is forwarded to Moody's so
// they apply the right index ("individual" vs "company").
type EnricherInput struct {
	Name       string
	EntityType string
	DUNS       string
}

// NewExternalEnricherFromEnv wires both adapters from env. Returns
// an enricher even if both adapters are nil; in that case
// IsConfigured() reports false and EnrichEntity is a no-op.
func NewExternalEnricherFromEnv() *ExternalEnricher {
	return &ExternalEnricher{
		moodys: NewMoodysMCPFromEnv(),
		dnb:    NewDnBMCPFromEnv(),
	}
}

// IsConfigured reports whether at least one upstream source is
// reachable. Callers can early-out on this to avoid logging an
// "enricher ran with nothing to do" line per request.
func (e *ExternalEnricher) IsConfigured() bool {
	return e != nil && (e.moodys != nil || e.dnb != nil)
}

// EnrichEntity runs both lookups in parallel and returns whatever
// arrives. Errors are collected per-source so a Moody's outage
// doesn't kill the D&B half. Caller decides whether to surface
// errors or treat them as "no enrichment available" silently.
func (e *ExternalEnricher) EnrichEntity(ctx context.Context, in EnricherInput) EnrichmentResult {
	res := EnrichmentResult{Errors: make(map[string]error)}
	if !e.IsConfigured() {
		return res
	}

	var (
		mu sync.Mutex
		wg sync.WaitGroup
	)

	if e.moodys != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			hits, err := e.moodys.Screen(ctx, in.Name, in.EntityType)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				res.Errors["moodys"] = err
				return
			}
			res.MoodysMatches = hits
		}()
	}

	if e.dnb != nil && in.DUNS != "" {
		wg.Add(1)
		go func() {
			defer wg.Done()
			h, err := e.dnb.LookupByDUNS(ctx, in.DUNS)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				res.Errors["dnb"] = err
				return
			}
			res.DnBHierarchy = h
		}()
	}

	wg.Wait()
	return res
}
