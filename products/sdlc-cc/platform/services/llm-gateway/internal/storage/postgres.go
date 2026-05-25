package storage

import (
	"context"

	"github.com/SDLC/llm-gateway/pkg/models"
	"gorm.io/gorm"
)

// PostgresCostTracker implements CostTracker using PostgreSQL
type PostgresCostTracker struct {
	db *gorm.DB
}

// NewPostgresCostTracker creates a new PostgreSQL cost tracker
func NewPostgresCostTracker(db *gorm.DB) *PostgresCostTracker {
	return &PostgresCostTracker{db: db}
}

// RecordCost records a cost transaction
func (p *PostgresCostTracker) RecordCost(ctx context.Context, cost *models.CostRecord) error {
	return p.db.WithContext(ctx).Create(cost).Error
}

