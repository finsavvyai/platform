package domain

import (
	"testing"
)

func TestListConfigEffectiveURL(t *testing.T) {
	tests := []struct {
		name   string
		config ListConfig
		want   string
	}{
		{
			name: "source when custom empty",
			config: ListConfig{
				SourceURL: "https://source.com",
			},
			want: "https://source.com",
		},
		{
			name: "prefers custom",
			config: ListConfig{
				SourceURL:       "https://source.com",
				CustomSourceURL: "https://custom.com",
			},
			want: "https://custom.com",
		},
		{
			name: "long custom url",
			config: ListConfig{
				SourceURL:       "https://source.com",
				CustomSourceURL: "https://custom.example.com/v2/lists/ofac",
			},
			want: "https://custom.example.com/v2/lists/ofac",
		},
		{
			name: "fallback to source",
			config: ListConfig{
				SourceURL: "https://www.treasury.gov/sdn",
			},
			want: "https://www.treasury.gov/sdn",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.config.EffectiveURL()
			if got != tt.want {
				t.Errorf("EffectiveURL() = %s, want %s", got, tt.want)
			}
		})
	}
}
