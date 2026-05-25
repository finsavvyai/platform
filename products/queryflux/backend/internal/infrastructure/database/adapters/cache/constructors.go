package cache

import (
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
)

// Constructor functions for cache adapters

// NewRedisAdapter creates a new Redis adapter
func NewRedisAdapter(conn *entities.Connection, logger *logrus.Logger) types.DatabaseAdapter {
	return &RedisAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewMemcachedAdapter creates a new Memcached adapter
func NewMemcachedAdapter(conn *entities.Connection, logger *logrus.Logger) types.DatabaseAdapter {
	return &MemcachedAdapter{
		conn:   conn,
		logger: logger,
	}
}
