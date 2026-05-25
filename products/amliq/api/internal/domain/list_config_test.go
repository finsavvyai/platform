package domain

import (
	"testing"
)

func TestNewListConfig(t *testing.T) {
	tests := []struct {
		name       string
		listID     string
		sourceURL  string
		parserType string
		wantErr    bool
	}{
		{
			name:       "valid config",
			listID:     "ofac",
			sourceURL:  "https://www.treasury.gov/sdn",
			parserType: "ofac",
		},
		{
			name:       "missing listID",
			sourceURL:  "https://example.com",
			parserType: "ofac",
			wantErr:    true,
		},
		{
			name:       "missing sourceURL",
			listID:     "ofac",
			parserType: "ofac",
			wantErr:    true,
		},
		{
			name:      "missing parserType",
			listID:    "ofac",
			sourceURL: "https://example.com",
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewListConfig(tt.listID, tt.sourceURL, tt.parserType)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewListConfig error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestListConfigValidate(t *testing.T) {
	tests := []struct {
		name    string
		config  ListConfig
		wantErr bool
	}{
		{
			name: "valid",
			config: ListConfig{
				ListID:      "ofac",
				SourceURL:   "https://www.treasury.gov/sdn",
				ParserType:  "ofac",
				Threshold:   0.7,
				EntityCount: 1000,
			},
		},
		{
			name: "missing listID",
			config: ListConfig{
				SourceURL:  "https://example.com",
				ParserType: "ofac",
			},
			wantErr: true,
		},
		{
			name: "invalid threshold",
			config: ListConfig{
				ListID:     "ofac",
				SourceURL:  "https://example.com",
				ParserType: "ofac",
				Threshold:  150.0,
			},
			wantErr: true,
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
