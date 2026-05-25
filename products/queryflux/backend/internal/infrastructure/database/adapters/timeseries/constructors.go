package timeseries

import (
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
)

// Constructor functions for time series adapters

// NewInfluxDBAdapter creates a new InfluxDB adapter
func NewInfluxDBAdapter(conn *entities.Connection, logger *logrus.Logger) types.DatabaseAdapter {
	return &InfluxDBAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewQuestDBAdapter creates a new QuestDB adapter
func NewQuestDBAdapter(conn *entities.Connection, logger *logrus.Logger) types.DatabaseAdapter {
	return &QuestDBAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewTimescaleDBAdapter creates a new TimescaleDB adapter
func NewTimescaleDBAdapter(conn *entities.Connection, logger *logrus.Logger) types.DatabaseAdapter {
	return &TimescaleDBAdapter{
		conn:   conn,
		logger: logger,
	}
}

