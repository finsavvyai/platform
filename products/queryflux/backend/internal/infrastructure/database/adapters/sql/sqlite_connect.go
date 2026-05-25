package sql

import (
	"context"
	"database/sql"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/base"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
	"github.com/sirupsen/logrus"
)

// Connect opens a SQLite database with single-writer pool sizing.
func (s *SQLiteAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.db != nil {
		return nil
	}

	if s.logger == nil {
		s.logger = logrus.New()
	}
	s.base = base.NewEnhancedBaseAdapter(conn, s.logger)

	connStr, err := conn.GetConnectionString()
	if err != nil {
		return s.base.CreateError("CONNECTION_STRING_ERROR",
			"Failed to build connection string", err.Error(), "").
			WithSentinel(types.ErrConnection)
	}

	db, err := sql.Open("sqlite3", connStr)
	if err != nil {
		return s.base.CreateError("CONNECTION_FAILED",
			"Failed to open SQLite connection", err.Error(), "").
			WithSentinel(mapSQLiteError(err))
	}

	// SQLite is single-writer; a wider pool just serializes behind the file lock.
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(0)

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return s.base.CreateError("CONNECTION_TEST_FAILED",
			"Failed to ping SQLite database", err.Error(), "").
			WithSentinel(mapSQLiteError(err))
	}

	s.db = db
	s.logger.Infof("Connected to SQLite database: %s", conn.Name)
	return nil
}

// Disconnect closes the SQLite connection. Idempotent.
func (s *SQLiteAdapter) Disconnect(ctx context.Context) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.base != nil {
		s.base.Close()
	}
	if s.db == nil {
		return nil
	}
	if err := s.db.Close(); err != nil {
		return (&types.AdapterError{
			Code:    "DISCONNECT_FAILED",
			Message: "Failed to close SQLite connection",
			Details: err.Error(),
		}).WithSentinel(types.ErrConnection)
	}
	s.db = nil
	if s.logger != nil {
		s.logger.Infof("Disconnected from SQLite database")
	}
	return nil
}

// TestConnection pings the underlying handle and records the result.
func (s *SQLiteAdapter) TestConnection(ctx context.Context) error {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	if s.db == nil {
		return notConnected()
	}

	start := nowMonotonic()
	err := s.db.PingContext(ctx)
	if s.base != nil {
		s.base.RecordHealthCheck(err == nil, sinceMonotonic(start), err)
	}
	if err != nil {
		return (&types.AdapterError{
			Code:    "CONNECTION_TEST_FAILED",
			Message: "Connection test failed",
			Details: err.Error(),
		}).WithSentinel(mapSQLiteError(err))
	}
	return nil
}

// IsConnected returns true when the database handle is non-nil.
func (s *SQLiteAdapter) IsConnected() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.db != nil
}

// GetConnectionInfo returns the connection entity tracked by the base adapter.
func (s *SQLiteAdapter) GetConnectionInfo() *entities.Connection {
	if s.base != nil {
		return s.base.GetConnection()
	}
	return nil
}

func notConnected() error {
	return (&types.AdapterError{
		Code:    "NOT_CONNECTED",
		Message: "Not connected to database",
	}).WithSentinel(types.ErrNotConnected)
}
