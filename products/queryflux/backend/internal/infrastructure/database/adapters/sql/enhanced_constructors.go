package sql

import (
	"github.com/queryflux/backend/internal/domain/entities"

	"github.com/sirupsen/logrus"
)

// NewTiDBEnhancedAdapter creates a new enhanced TiDB adapter
func NewTiDBEnhancedAdapter(conn *entities.Connection, logger *logrus.Logger) *TiDBEnhancedAdapter {
	return &TiDBEnhancedAdapter{
		conn:         conn,
		poolSettings: make(map[string]string),
		logger:       logger,
	}
}

// NewMariaDBEnhancedAdapter creates a new enhanced MariaDB adapter
func NewMariaDBEnhancedAdapter(conn *entities.Connection, logger *logrus.Logger) *MariaDBEnhancedAdapter {
	return &MariaDBEnhancedAdapter{
		conn:         conn,
		poolSettings: make(map[string]string),
		logger:       logger,
	}
}
