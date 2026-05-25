package ingestion

import "time"

// SourceError records a failure for one source during pipeline run.
type SourceError struct {
	SourceID string `json:"source_id"`
	Error    string `json:"error"`
}

// PipelineResult summarizes a full or delta ingestion run.
type PipelineResult struct {
	SourcesProcessed int           `json:"sources_processed"`
	EntitiesAdded    int           `json:"entities_added"`
	EntitiesUpdated  int           `json:"entities_updated"`
	EntitiesRemoved  int           `json:"entities_removed"`
	Errors           []SourceError `json:"errors"`
	Duration         time.Duration `json:"duration"`
}

// PipelineSource defines a source to ingest.
type PipelineSource struct {
	ID       string
	URL      string
	Parser   Parser
	Priority int // lower = higher priority
}
