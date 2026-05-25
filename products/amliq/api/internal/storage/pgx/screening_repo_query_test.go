package pgx

import (
	"database/sql"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestScreeningRepository_GetByID(t *testing.T) {
	tests := []struct {
		name    string
		db      *sql.DB
		id      string
		wantErr bool
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
						t.Errorf("GetByID() panicked: %v", r)
					}
				}
			}()
			r := &ScreeningRepository{db: tt.db}
			_, err := r.GetByID(tt.id)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetByID() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestScreeningRepository_ListByTenant(t *testing.T) {
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
			r := &ScreeningRepository{db: tt.db}
			_, err := r.ListByTenant(tt.tenantID)
			if (err != nil) != tt.wantErr {
				t.Errorf("ListByTenant() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
