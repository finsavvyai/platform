package pgx

import (
	"database/sql"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestAuditRepository_ListByTenant(t *testing.T) {
	tests := []struct {
		name     string
		db       *sql.DB
		tenantID domain.TenantID
		wantErr  bool
	}{
		{
			name:    "nil db",
			db:      nil,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			defer func() {
				if r := recover(); r != nil {
					if !tt.wantErr {
						t.Errorf("ListByTenant() panicked: %v", r)
					}
				}
			}()
			r := &AuditRepository{db: tt.db}
			_, err := r.ListByTenant(tt.tenantID)
			if (err != nil) != tt.wantErr {
				t.Errorf("ListByTenant() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestAuditRepository_ListByResource(t *testing.T) {
	tests := []struct {
		name       string
		db         *sql.DB
		resourceID string
		wantErr    bool
	}{
		{
			name:    "nil db",
			db:      nil,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			defer func() {
				if r := recover(); r != nil {
					if !tt.wantErr {
						t.Errorf("ListByResource() panicked: %v", r)
					}
				}
			}()
			r := &AuditRepository{db: tt.db}
			_, err := r.ListByResource(tt.resourceID)
			if (err != nil) != tt.wantErr {
				t.Errorf("ListByResource() error = %v, wantErr %v",
					err, tt.wantErr)
			}
		})
	}
}
