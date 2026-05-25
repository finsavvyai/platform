package pgx

import (
	"database/sql"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestAlertRepository_Update(t *testing.T) {
	tests := []struct {
		name    string
		db      *sql.DB
		alert   domain.Alert
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
						t.Errorf("Update() panicked: %v", r)
					}
				}
			}()
			r := &AlertRepository{db: tt.db}
			err := r.Update(tt.alert)
			if (err != nil) != tt.wantErr {
				t.Errorf("Update() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestAlertRepository_ListByTenant(t *testing.T) {
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
			r := &AlertRepository{db: tt.db}
			_, err := r.ListByTenant(tt.tenantID)
			if (err != nil) != tt.wantErr {
				t.Errorf("ListByTenant() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
