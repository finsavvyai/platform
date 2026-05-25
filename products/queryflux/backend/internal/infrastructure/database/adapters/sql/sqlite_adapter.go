// Build note: this adapter requires CGO_ENABLED=1 (mattn/go-sqlite3 is a cgo binding).
package sql

import (
	"database/sql"
	"sync"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/base"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	// Driver side-effect import (registers "sqlite3" with database/sql).
	_ "github.com/mattn/go-sqlite3"
	"github.com/sirupsen/logrus"
)

// SQLiteAdapter implements types.DatabaseAdapter for SQLite using the real
// mattn/go-sqlite3 driver over database/sql. Behaviour is split across:
//   - sqlite_connect.go  Connect/Disconnect/TestConnection/IsConnected
//   - sqlite_exec.go     ExecuteQuery
//   - sqlite_stream.go   Stream (Phase 1, cursor-backed)
//   - sqlite_schema.go   GetSchema/GetTableInfo/IntrospectSchema
//   - sqlite_health.go   HealthCheck/Ping/GetMetrics/BeginTransaction
//   - sqlite_errors.go   sqlite3 -> Phase 1 sentinel mapping
type SQLiteAdapter struct {
	base   *base.EnhancedBaseAdapter
	db     *sql.DB
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Compile-time assertion: SQLiteAdapter implements the canonical interface.
// Note: types.DatabaseAdapter does NOT yet declare Stream/IntrospectSchema
// (Phase 1 architect amendment is in flight). The Stream method on this
// adapter is exposed via a sibling concrete type assertion in services.
var _ types.DatabaseAdapter = (*SQLiteAdapter)(nil)
