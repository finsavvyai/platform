package sql

import (
	"github.com/queryflux/backend/internal/domain/entities"

	"github.com/sirupsen/logrus"
)

// NewPostgreSQLAdapter creates a new PostgreSQL adapter
func NewPostgreSQLAdapter(conn *entities.Connection, logger *logrus.Logger) *PostgreSQLAdapter {
	return &PostgreSQLAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewMySQLAdapter creates a new MySQL adapter
func NewMySQLAdapter(conn *entities.Connection, logger *logrus.Logger) *MySQLAdapter {
	return &MySQLAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewMariaDBAdapter creates a new MariaDB adapter
func NewMariaDBAdapter(conn *entities.Connection, logger *logrus.Logger) *MariaDBAdapter {
	return &MariaDBAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewSQLiteAdapter creates a new SQLite adapter
func NewSQLiteAdapter(conn *entities.Connection, logger *logrus.Logger) *SQLiteAdapter {
	return &SQLiteAdapter{
		// conn handled by base adapter
		logger: logger,
	}
}

// NewSQLServerAdapter creates a new SQL Server adapter
func NewSQLServerAdapter(conn *entities.Connection, logger *logrus.Logger) *SQLServerAdapter {
	return &SQLServerAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewOracleAdapter creates a new Oracle adapter
func NewOracleAdapter(conn *entities.Connection, logger *logrus.Logger) *OracleAdapter {
	return &OracleAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewCockroachDBAdapter creates a new CockroachDB adapter
func NewCockroachDBAdapter(conn *entities.Connection, logger *logrus.Logger) *CockroachDBAdapter {
	return &CockroachDBAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewSupabaseAdapter creates a new Supabase adapter
func NewSupabaseAdapter(conn *entities.Connection, logger *logrus.Logger) *SupabaseAdapter {
	return &SupabaseAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewPlanetScaleAdapter creates a new PlanetScale adapter
func NewPlanetScaleAdapter(conn *entities.Connection, logger *logrus.Logger) *PlanetScaleAdapter {
	return &PlanetScaleAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewNeonAdapter creates a new Neon adapter
func NewNeonAdapter(conn *entities.Connection, logger *logrus.Logger) *NeonAdapter {
	return &NeonAdapter{
		conn:   conn,
		logger: logger,
	}
}
