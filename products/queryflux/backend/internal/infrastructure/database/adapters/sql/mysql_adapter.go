package sql

import (
	"database/sql"
	"sync"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
)

// MySQLAdapter implements types.DatabaseAdapter for MySQL.
//
// File layout (per QUERY_CONTRACT.md §5):
//   - mysql_adapter.go  — struct + interface assertion (this file)
//   - mysql_connect.go  — Connect / Disconnect / TestConnection / DSN / TLS / pool
//   - mysql_exec.go     — ExecuteQuery + value conversion
//   - mysql_stream.go   — Stream (real *sql.Rows cursor, buffered channel)
//   - mysql_schema.go   — GetSchema / GetTableInfo / column + index introspection
//   - mysql_health.go   — IsConnected / GetConnectionInfo / Ping / HealthCheck /
//                         GetMetrics / Transaction
//   - mysql_errors.go   — sentinel errors + mapMySQLError (shared with MariaDB)
//   - mysql_stream_core.go — shared stream helpers (multi-stmt reject, scan)
type MySQLAdapter struct {
	conn   *entities.Connection
	db     *sql.DB
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Compile-time guard: catches signature drift against the canonical Phase 1
// types.DatabaseAdapter interface (Stream + IntrospectSchema).
var _ types.DatabaseAdapter = (*MySQLAdapter)(nil)
