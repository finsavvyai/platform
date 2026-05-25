package sql

import (
	"sync"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"
)

// PostgreSQLAdapter implements types.DatabaseAdapter (and the Phase 1 Stream
// extension defined in QUERY_CONTRACT.md). The concrete implementation is
// split across postgresql_connect.go, postgresql_exec.go, postgresql_stream.go,
// postgresql_schema.go, postgresql_health.go and postgresql_tx.go.
type PostgreSQLAdapter struct {
	conn   *entities.Connection
	pool   *pgxpool.Pool
	mutex  sync.RWMutex
	logger *logrus.Logger
}

// Compile-time assertion: PostgreSQLAdapter satisfies the canonical interface.
// Stream is not yet on the interface (task #7 owns that change) but the method
// is implemented on the concrete type — see postgresql_stream.go.
var _ types.DatabaseAdapter = (*PostgreSQLAdapter)(nil)
