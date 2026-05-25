package ingestion

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

type mockParser struct{}

func (m *mockParser) Parse(data []byte) ([]domain.Entity, error) {
	return []domain.Entity{}, nil
}

func TestRegistry(t *testing.T) {
	reg := NewRegistry()
	parser := &mockParser{}

	tests := []struct {
		name      string
		source    domain.ListSource
		register  bool
		shouldErr bool
	}{
		{
			name:      "register_and_get",
			source:    domain.ListSourceOFAC,
			register:  true,
			shouldErr: false,
		},
		{
			name:      "get_unregistered",
			source:    domain.ListSourceEU,
			register:  false,
			shouldErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.register {
				err := reg.Register(tt.source, parser)
				if err != nil {
					t.Fatalf("Register() error = %v", err)
				}
			}
			_, err := reg.Get(tt.source)
			if (err != nil) != tt.shouldErr {
				t.Errorf("Get() error = %v, shouldErr = %v", err, tt.shouldErr)
			}
		})
	}
}
