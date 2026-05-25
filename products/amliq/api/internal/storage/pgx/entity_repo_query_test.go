package pgx

import (
	"database/sql"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestEntityRepository_GetByID(t *testing.T) {
	tests := []struct {
		name    string
		db      *sql.DB
		id      domain.EntityID
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
			r := &EntityRepository{db: tt.db}
			_, err := r.GetByID(tt.id)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetByID() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestEntityRepository_Delete(t *testing.T) {
	tests := []struct {
		name    string
		db      *sql.DB
		id      domain.EntityID
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
						t.Errorf("Delete() panicked: %v", r)
					}
				}
			}()
			r := &EntityRepository{db: tt.db}
			err := r.Delete(tt.id)
			if (err != nil) != tt.wantErr {
				t.Errorf("Delete() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
