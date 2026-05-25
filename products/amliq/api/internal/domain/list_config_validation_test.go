package domain

import (
	"testing"
)

func TestListConfigValidateErrors(t *testing.T) {
	tests := []struct {
		name    string
		config  ListConfig
		wantErr bool
	}{
		{
			name: "missing parserType",
			config: ListConfig{
				ListID:    "ofac",
				SourceURL: "https://example.com",
			},
			wantErr: true,
		},
		{
			name: "negative threshold",
			config: ListConfig{
				ListID:     "ofac",
				SourceURL:  "https://example.com",
				ParserType: "ofac",
				Threshold:  -0.1,
			},
			wantErr: true,
		},
		{
			name: "all fields valid",
			config: ListConfig{
				ListID:       "ofac",
				SourceURL:    "https://www.treasury.gov/sdn",
				ParserType:   "ofac",
				SyncSchedule: "0 3 * * *",
				SyncEnabled:  true,
				Threshold:    0.7,
				EntityCount:  5000,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
