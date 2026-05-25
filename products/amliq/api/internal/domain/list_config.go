package domain

import (
	"fmt"
	"time"
)

// ListConfig holds per-list configuration for an organization.
type ListConfig struct {
	ListID          string
	SourceURL       string
	CustomSourceURL string
	ParserType      string
	SyncSchedule    string
	SyncEnabled     bool
	Threshold       float64
	LastSyncedAt    time.Time
	EntityCount     int
	ETag            string
}

// NewListConfig creates a validated list configuration.
func NewListConfig(listID, sourceURL, parserType string) (ListConfig, error) {
	if listID == "" || sourceURL == "" || parserType == "" {
		return ListConfig{}, fmt.Errorf("listID, sourceURL, parserType required")
	}
	lc := ListConfig{
		ListID:       listID,
		SourceURL:    sourceURL,
		ParserType:   parserType,
		SyncSchedule: DefaultSyncSchedule,
		SyncEnabled:  true,
		Threshold:    0.7,
	}
	return lc, lc.Validate()
}

// Validate checks list configuration is sound.
func (lc ListConfig) Validate() error {
	if lc.ListID == "" {
		return fmt.Errorf("listID required")
	}
	if lc.SourceURL == "" {
		return fmt.Errorf("sourceURL required")
	}
	if lc.ParserType == "" {
		return fmt.Errorf("parserType required")
	}
	if lc.Threshold < 0 || lc.Threshold > 100 {
		return fmt.Errorf("threshold must be 0-100")
	}
	if lc.EntityCount < 0 {
		return fmt.Errorf("entityCount cannot be negative")
	}
	return nil
}

// EffectiveURL returns the custom URL if set, otherwise source URL.
func (lc ListConfig) EffectiveURL() string {
	if lc.CustomSourceURL != "" {
		return lc.CustomSourceURL
	}
	return lc.SourceURL
}
