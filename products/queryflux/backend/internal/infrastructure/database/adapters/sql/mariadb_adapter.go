package sql

import (
	"database/sql"
	"sync"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	_ "github.com/go-sql-driver/mysql" // MariaDB is wire-compatible with MySQL.
	"github.com/sirupsen/logrus"
)

// MariaDBAdapter implements types.DatabaseAdapter for MariaDB by reusing the
// MySQL driver under the hood. The file split mirrors the MySQL adapter:
//
//   - mariadb_adapter.go  — struct + interface assertion (this file)
//   - mariadb_connect.go  — Connect / Disconnect / TestConnection / DSN
//   - mariadb_exec.go     — ExecuteQuery + MariaDB syntax tweaks
//   - mariadb_stream.go   — Stream (real *sql.Rows cursor, buffered channel)
//   - mariadb_schema.go   — GetSchema / GetTableInfo / column + index probes
//   - mariadb_health.go   — IsConnected / Ping / HealthCheck / Metrics / Tx
//
// Errors flow through the shared `mysql_errors.go` mapper so MySQL +
// MariaDB return identical sentinels to the runner.
type MariaDBAdapter struct {
	conn   *entities.Connection
	db     *sql.DB
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Compile-time guard against canonical Phase 1 types.DatabaseAdapter.
var _ types.DatabaseAdapter = (*MariaDBAdapter)(nil)
