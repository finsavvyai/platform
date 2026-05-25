package analytics

import (
	"net/http"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"

	"github.com/sirupsen/logrus"
)

// NewClickHouseAdapter creates a new ClickHouse adapter
func NewClickHouseAdapter(conn *entities.Connection, logger *logrus.Logger) *ClickHouseAdapter {
	return &ClickHouseAdapter{
		conn:     conn,
		settings: make(map[string]string),
		logger:   logger,
	}
}

// NewDuckDBAdapter creates a new DuckDB adapter
func NewDuckDBAdapter(conn *entities.Connection, logger *logrus.Logger) *DuckDBAdapter {
	return &DuckDBAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewDruidAdapter creates a new Druid adapter
func NewDruidAdapter(conn *entities.Connection, logger *logrus.Logger) *DruidAdapter {
	return &DruidAdapter{
		conn:   conn,
		logger: logger,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// NewFlinkAdapter creates a new Flink adapter
func NewFlinkAdapter(conn *entities.Connection, logger *logrus.Logger) *FlinkAdapter {
	return &FlinkAdapter{
		conn:   conn,
		logger: logger,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}
