package ingestion

// GetHealth returns health info for a source, or nil.
func (ht *HealthTracker) GetHealth(sourceID string) *SourceHealth {
	ht.mu.RLock()
	defer ht.mu.RUnlock()
	h, ok := ht.sources[sourceID]
	if !ok {
		return nil
	}
	cp := *h
	return &cp
}

// AllHealthy returns true if every tracked source is healthy.
func (ht *HealthTracker) AllHealthy() bool {
	ht.mu.RLock()
	defer ht.mu.RUnlock()
	for _, h := range ht.sources {
		if h.Status != StatusHealthy {
			return false
		}
	}
	return true
}

// DegradedSources returns IDs of sources not in healthy state.
func (ht *HealthTracker) DegradedSources() []string {
	ht.mu.RLock()
	defer ht.mu.RUnlock()
	var out []string
	for id, h := range ht.sources {
		if h.Status != StatusHealthy {
			out = append(out, id)
		}
	}
	return out
}
