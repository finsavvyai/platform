package aws

import (
	"github.com/queryflux/backend/internal/domain/entities"

	"github.com/sirupsen/logrus"
)

// Constructor functions for AWS adapters

// NewDynamoDBAdapter creates a new DynamoDB adapter
func NewDynamoDBAdapter(conn *entities.Connection, logger *logrus.Logger) *DynamoDBAdapter {
	return &DynamoDBAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewRDSAdapter creates a new RDS adapter
func NewRDSAdapter(conn *entities.Connection, logger *logrus.Logger) *RDSAdapter {
	return &RDSAdapter{
		conn:   conn,
		engine: getEngineFromConnection(conn, "postgres"),
		logger: logger,
	}
}

// NewRedshiftAdapter creates a new Redshift data warehouse adapter
func NewRedshiftAdapter(conn *entities.Connection, logger *logrus.Logger) *RedshiftAdapter {
	return &RedshiftAdapter{
		logger: logger,
	}
}

// NewAuroraAdapter creates a new Aurora adapter with cluster and read replica support
func NewAuroraAdapter(conn *entities.Connection, logger *logrus.Logger) *AuroraAdapter {
	return &AuroraAdapter{
		logger: logger,
	}
}

// NewDocumentDBAdapter creates a new DocumentDB adapter
func NewDocumentDBAdapter(conn *entities.Connection, logger *logrus.Logger) *DocumentDBAdapter {
	return &DocumentDBAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewElastiCacheAdapter creates a new ElastiCache adapter
func NewElastiCacheAdapter(conn *entities.Connection, logger *logrus.Logger) *ElastiCacheAdapter {
	return &ElastiCacheAdapter{
		conn:   conn,
		logger: logger,
	}
}



// getEngineFromConnection extracts engine from connection options with fallback
func getEngineFromConnection(conn *entities.Connection, defaultEngine string) string {
	if engine, ok := conn.Options["engine"]; ok {
		return engine
	}
	return defaultEngine
}
