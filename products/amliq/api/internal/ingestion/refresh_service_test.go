package ingestion

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

var errStub = errors.New("stub error")

type stubTenantLister struct {
	tenants []domain.Tenant
	err     error
}

func (s *stubTenantLister) List() ([]domain.Tenant, error) {
	return s.tenants, s.err
}

func TestRefreshAll(t *testing.T) {
	tests := []struct {
		name      string
		tenants   []domain.Tenant
		listErr   error
		wantError bool
	}{
		{
			name:      "no tenants succeeds",
			tenants:   nil,
			wantError: false,
		},
		{
			name: "suspended tenants skipped",
			tenants: []domain.Tenant{
				{ID: testTenantID(), Suspended: true},
			},
			wantError: false,
		},
		{
			name:      "tenant list error",
			listErr:   errStub,
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lister := &stubTenantLister{tenants: tt.tenants, err: tt.listErr}
			limiter := NewDownloadLimiter(time.Millisecond)
			svc := NewRefreshService(nil, lister, limiter)

			err := svc.RefreshAll(context.Background())
			if (err != nil) != tt.wantError {
				t.Errorf("got error=%v, want error=%v", err, tt.wantError)
			}
		})
	}
}

func testTenantID() domain.TenantID {
	id, _ := domain.NewTenantID("test-tenant-001")
	return id
}
