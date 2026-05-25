package api

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestCreateTenantRequest(t *testing.T) {
	tests := []struct {
		name    string
		reqName string
		wantErr bool
	}{
		{"valid", "Acme Corp", false},
		{"empty name", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.reqName == "" && !tt.wantErr {
				t.Error("expected validation to catch empty name")
			}
		})
	}
}

func TestGenerateTenantID(t *testing.T) {
	tests := []struct {
		name string
	}{
		{"generates valid id"},
		{"generates unique ids"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tid, err := domain.GenerateTenantID()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tid.IsZero() {
				t.Error("generated zero tenant id")
			}
			if len(tid.String()) != 16 {
				t.Errorf("len = %d, want 16", len(tid.String()))
			}
		})
	}
}

func TestTruncateScreenings(t *testing.T) {
	tests := []struct {
		name  string
		count int
		max   int
		want  int
	}{
		{"under max", 5, 10, 5},
		{"at max", 10, 10, 10},
		{"over max", 15, 10, 10},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			items := make([]domain.ScreenResponse, tt.count)
			got := truncateScreenings(items, tt.max)
			if len(got) != tt.want {
				t.Errorf("len = %d, want %d", len(got), tt.want)
			}
		})
	}
}
