package ingestion

import (
	"testing"
	"time"
)

func TestListFetcher(t *testing.T) {
	lf := NewListFetcher(30 * time.Second)

	tests := []struct {
		name      string
		url       string
		shouldErr bool
	}{
		{
			name:      "empty_url",
			url:       "",
			shouldErr: true,
		},
		{
			name:      "invalid_url",
			url:       "://invalid",
			shouldErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, _, err := lf.Fetch(tt.url)
			if (err != nil) != tt.shouldErr {
				t.Errorf("Fetch() error = %v, shouldErr = %v", err, tt.shouldErr)
			}
		})
	}
}
