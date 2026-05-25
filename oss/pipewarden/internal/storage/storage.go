package storage

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	_ "github.com/mattn/go-sqlite3"
)

// ensureSQLiteParentDir creates the parent directory for a SQLite file path
// when missing, so configured paths like /app/data/pipewarden.db work without
// a separate provisioning step. In-memory and URI paths are skipped.
func ensureSQLiteParentDir(path string) error {
	if path == "" || path == ":memory:" || strings.HasPrefix(path, "file::memory:") {
		return nil
	}
	clean := path
	if i := strings.Index(clean, "?"); i >= 0 {
		clean = clean[:i]
	}
	clean = strings.TrimPrefix(clean, "file:")
	dir := filepath.Dir(clean)
	if dir == "" || dir == "." {
		return nil
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("failed to create sqlite parent dir %q: %w", dir, err)
	}
	return nil
}

// Engine identifies the configured backing database.
type Engine string

const (
	EngineSQLite   Engine = "sqlite"
	EnginePostgres Engine = "postgres"
)

// Config is the storage package runtime configuration.
type Config struct {
	Driver          string
	Path            string
	URL             string
	Host            string
	Port            int
	Username        string
	Password        string
	Name            string
	SSLMode         string
	WALMode         bool
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

// DB wraps the configured backing database.
type DB struct {
	db     *sql.DB
	driver Engine
}

// New opens the default SQLite backend.
func New(dbPath string) (*DB, error) {
	return Open(Config{
		Driver:  string(EngineSQLite),
		Path:    dbPath,
		WALMode: true,
	})
}

// NewFromConfig opens a database using the provided Config, applying
// production-grade connection pool defaults when driver is Postgres.
func NewFromConfig(cfg Config) (*DB, error) {
	if resolveDriver(cfg.Driver, cfg.URL, cfg.Host) == EnginePostgres {
		if cfg.MaxOpenConns == 0 {
			cfg.MaxOpenConns = 25
		}
		if cfg.MaxIdleConns == 0 {
			cfg.MaxIdleConns = 5
		}
		if cfg.ConnMaxLifetime == 0 {
			cfg.ConnMaxLifetime = 5 * time.Minute
		}
	}
	return Open(cfg)
}

// NewInMemory opens an in-memory SQLite database for tests and local ephemeral use.
func NewInMemory(_ ...any) (*DB, error) {
	return Open(Config{
		Driver:       string(EngineSQLite),
		Path:         fmt.Sprintf("file:pipewarden_%d?mode=memory&cache=shared", time.Now().UnixNano()),
		WALMode:      false,
		MaxOpenConns: 1,
	})
}

// Open opens the configured database backend.
func Open(cfg Config) (*DB, error) {
	driver := resolveDriver(cfg.Driver, cfg.URL, cfg.Host)
	dsn, sqlDriver, err := buildDSN(driver, cfg)
	if err != nil {
		return nil, err
	}

	if driver == EngineSQLite {
		if err := ensureSQLiteParentDir(cfg.Path); err != nil {
			return nil, err
		}
	}

	db, err := sql.Open(sqlDriver, dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if cfg.MaxOpenConns > 0 {
		db.SetMaxOpenConns(cfg.MaxOpenConns)
	}
	if cfg.MaxIdleConns > 0 {
		db.SetMaxIdleConns(cfg.MaxIdleConns)
	}
	if cfg.ConnMaxLifetime > 0 {
		db.SetConnMaxLifetime(cfg.ConnMaxLifetime)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	store := &DB{db: db, driver: driver}
	if err := store.migrate(); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return store, nil
}

// Driver returns the configured storage engine.
func (s *DB) Driver() Engine {
	return s.driver
}

// Ping verifies that the backing database is reachable.
func (s *DB) Ping() error {
	return s.db.Ping()
}

// Close closes the database.
func (s *DB) Close() error {
	return s.db.Close()
}
