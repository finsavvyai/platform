package pgx

import (
	"context"
	"database/sql"
	"testing"
)

func TestMigrator_ensureMigrationsTable(t *testing.T) {
	tests := []struct {
		name    string
		db      *sql.DB
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
						t.Errorf("ensureMigrationsTable() panicked: %v", r)
					}
				}
			}()
			m := &Migrator{db: tt.db}
			err := m.ensureMigrationsTable(context.Background())
			if (err != nil) != tt.wantErr {
				t.Errorf("ensureMigrationsTable() error = %v, wantErr %v",
					err, tt.wantErr)
			}
		})
	}
}

func TestMigrator_applyMigration(t *testing.T) {
	tests := []struct {
		name    string
		file    string
		wantErr bool
	}{
		{
			name:    "invalid file",
			file:    "nonexistent.up.sql",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			defer func() {
				if r := recover(); r != nil {
					if !tt.wantErr {
						t.Errorf("applyMigration() panicked: %v", r)
					}
				}
			}()
			m := &Migrator{db: nil, fs: nil}
			err := m.applyMigration(context.Background(), tt.file)
			if (err != nil) != tt.wantErr {
				t.Errorf("applyMigration() error = %v, wantErr %v",
					err, tt.wantErr)
			}
		})
	}
}
