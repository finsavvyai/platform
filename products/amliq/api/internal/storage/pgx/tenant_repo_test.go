package pgx

import (
	"database/sql"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestTenantRepository_CRUD(t *testing.T) {
	tests := []struct {
		name    string
		db      *sql.DB
		wantErr bool
	}{
		{name: "nil db", db: nil, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			defer func() {
				if r := recover(); r != nil {
					if !tt.wantErr {
						t.Errorf("CRUD() panicked: %v", r)
					}
				}
			}()
			r := &TenantRepository{db: tt.db}
			err := r.Create(domain.Tenant{})
			if (err != nil) != tt.wantErr {
				t.Errorf("Create() error = %v, wantErr %v", err, tt.wantErr)
			}
			_, err = r.GetByID(domain.TenantID{})
			if (err != nil) != tt.wantErr {
				t.Errorf("GetByID() error = %v, wantErr %v", err, tt.wantErr)
			}
			err = r.Update(domain.Tenant{})
			if (err != nil) != tt.wantErr {
				t.Errorf("Update() error = %v, wantErr %v", err, tt.wantErr)
			}
			_, err = r.List()
			if (err != nil) != tt.wantErr {
				t.Errorf("List() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
