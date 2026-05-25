package ingestion

import (
	"context"
	"fmt"
	"log"
	"time"
)

// Pipeline orchestrates ingestion from multiple sources.
type Pipeline struct {
	fetcher *ResilientFetcher
	health  *HealthTracker
	sources []PipelineSource
}

// NewPipeline creates a pipeline with the given fetcher and sources.
func NewPipeline(fetcher *ResilientFetcher, health *HealthTracker, sources []PipelineSource) *Pipeline {
	return &Pipeline{fetcher: fetcher, health: health, sources: sources}
}

// RunFull performs a full ingestion of all sources.
func (p *Pipeline) RunFull(ctx context.Context) (*PipelineResult, error) {
	return p.run(ctx, time.Time{})
}

// RunDelta performs a delta ingestion since the given time.
func (p *Pipeline) RunDelta(ctx context.Context, since time.Time) (*PipelineResult, error) {
	return p.run(ctx, since)
}

func (p *Pipeline) run(ctx context.Context, since time.Time) (*PipelineResult, error) {
	start := time.Now()
	result := &PipelineResult{}

	for _, src := range p.sources {
		if ctx.Err() != nil {
			break
		}
		added, err := p.processSource(ctx, src, since)
		if err != nil {
			log.Printf("Source %s: ERROR %v", src.ID, err)
			result.Errors = append(result.Errors, SourceError{
				SourceID: src.ID, Error: err.Error(),
			})
			p.health.RecordFailure(src.ID, err)
			continue
		}
		result.SourcesProcessed++
		result.EntitiesAdded += added
		elapsed := time.Since(start).Milliseconds()
		log.Printf("Source %s: +%d added (%dms)", src.ID, added, elapsed)
	}
	result.Duration = time.Since(start)
	return result, nil
}

func (p *Pipeline) processSource(
	ctx context.Context, src PipelineSource, since time.Time,
) (int, error) {
	if src.URL == "" {
		return 0, fmt.Errorf("no URL configured")
	}
	srcStart := time.Now()
	data, _, err := p.fetcher.Fetch(ctx, src.URL)
	if err != nil {
		return 0, err
	}
	if data == nil {
		return 0, nil // 304 not modified
	}
	entities, err := src.Parser.Parse(data)
	if err != nil {
		return 0, fmt.Errorf("parse: %w", err)
	}
	latency := time.Since(srcStart).Milliseconds()
	p.health.RecordSuccess(src.ID, latency, len(entities))
	return len(entities), nil
}
