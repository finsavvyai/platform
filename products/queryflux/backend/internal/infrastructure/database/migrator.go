package database

import (
	"context"

	"go.uber.org/zap"
)

// Migrator handles database migrations
type Migrator struct {
	logger *zap.Logger
}

// NewMigrator creates a new migrator
func NewMigrator(logger *zap.Logger) *Migrator {
	return &Migrator{logger: logger}
}

// Up runs up migrations
func (m *Migrator) Up(ctx context.Context) (interface{}, error) {
	m.logger.Info("Migration Up stub executed")
	return nil, nil
}
