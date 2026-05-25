package pgx

import (
	"database/sql"
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestEntityRepository_Create(t *testing.T) {
	tests := []struct {
		name    string
		db      *sql.DB
		entity  domain.Entity
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
						t.Errorf("Create() panicked: %v", r)
					}
				}
			}()
			r := &EntityRepository{db: tt.db}
			err := r.Create(tt.entity)
			if (err != nil) != tt.wantErr {
				t.Errorf("Create() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
