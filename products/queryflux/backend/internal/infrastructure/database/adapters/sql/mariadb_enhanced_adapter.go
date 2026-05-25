package sql

import (
	"database/sql"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	_ "github.com/go-sql-driver/mysql" // MariaDB is MySQL-compatible.
	"github.com/sirupsen/logrus"
)

// MariaDBEnhancedAdapter is the "enhanced" MariaDB adapter — adds DSN
// templating, pool tuning, and server-side verification on top of the
// minimal MariaDBAdapter. Both honour the same canonical contract.
//
// File layout (QUERY_CONTRACT.md §5):
//   - mariadb_enhanced_adapter.go  — struct + interface assertion (this file)
//   - mariadb_enhanced_connect.go  — Connect / Disconnect / DSN / TLS / pool
//   - mariadb_enhanced_exec.go     — ExecuteQuery + scan helpers
//   - mariadb_enhanced_stream.go   — Stream (real *sql.Rows cursor)
//   - mariadb_enhanced_schema.go   — GetSchema / GetTableInfo / column scan
//   - mariadb_enhanced_health.go   — Ping / HealthCheck / Metrics / Tx +
//                                    GetMariaDBVersion / GetEngineInfo /
//                                    GetVariableInfo
//   - mysql_errors.go              — shared sentinel error mapper
type MariaDBEnhancedAdapter struct {
	conn         *entities.Connection
	db           *sql.DB
	poolSettings map[string]string
	logger       *logrus.Logger
}

// Compile-time guard against canonical Phase 1 types.DatabaseAdapter.
var _ types.DatabaseAdapter = (*MariaDBEnhancedAdapter)(nil)
