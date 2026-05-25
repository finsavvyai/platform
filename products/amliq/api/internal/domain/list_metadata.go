package domain

import (
	"fmt"
	"time"
)

type ListMetadata struct {
	ID          string
	Name        string
	Source      ListSource
	URL         string
	Format      string
	LastUpdated time.Time
	EntityCount int
	Checksum    string
}

func NewListMetadata(
	id, name string,
	source ListSource,
	url, format string,
	count int,
) (ListMetadata, error) {
	if id == "" || name == "" {
		return ListMetadata{}, fmt.Errorf("id and name required")
	}
	return ListMetadata{
		ID:          id,
		Name:        name,
		Source:      source,
		URL:         url,
		Format:      format,
		EntityCount: count,
		LastUpdated: time.Now().UTC(),
	}, nil
}

func (lm ListMetadata) RequiresRefresh() bool {
	return time.Since(lm.LastUpdated) > 24*time.Hour
}
