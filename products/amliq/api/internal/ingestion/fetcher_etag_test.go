package ingestion

import (
	"testing"
	"time"
)

func TestFetchWithETag(t *testing.T) {
	lf := NewListFetcher(5 * time.Second)

	tests := []struct {
		name      string
		url       string
		etag      string
		shouldErr bool
	}{
		{
			name:      "empty_url",
			url:       "",
			etag:      "",
			shouldErr: true,
		},
		{
			name:      "invalid_url",
			url:       "://bad",
			etag:      "",
			shouldErr: true,
		},
		{
			name:      "with_previous_etag",
			url:       "://bad",
			etag:      "abc123",
			shouldErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, _, err := lf.FetchWithETag(tt.url, tt.etag)
			if (err != nil) != tt.shouldErr {
				t.Errorf("FetchWithETag() err=%v, shouldErr=%v", err, tt.shouldErr)
			}
		})
	}
}
