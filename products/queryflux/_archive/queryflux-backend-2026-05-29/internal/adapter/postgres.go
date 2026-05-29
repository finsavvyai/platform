package adapter

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/pkg/config"
)

var defaultPoolConfig = config.PoolConfig{
	MaxConns:        10,
	MinConns:        2,
	MaxConnLifetime: time.Hour,
	MaxConnIdleTime: 30 * time.Minute,
	QueryTimeout:    30 * time.Second,
}

var blockedStatements = []string{
	"DROP", "TRUNCATE", "ALTER", "CREATE",
	"GRANT", "REVOKE",
}

type PostgresAdapter struct {
	pool         *pgxpool.Pool
	queryTimeout time.Duration
}

// NewPostgresAdapter creates an adapter with default pool settings.
func NewPostgresAdapter(databaseURL string) (*PostgresAdapter, error) {
	return NewPostgresAdapterWithConfig(databaseURL, defaultPoolConfig)
}

// NewPostgresAdapterWithConfig creates an adapter with caller-supplied pool config.
func NewPostgresAdapterWithConfig(databaseURL string, pc config.PoolConfig) (*PostgresAdapter, error) {
	ctx := context.Background()

	poolCfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	poolCfg.MaxConns = pc.MaxConns
	poolCfg.MinConns = pc.MinConns
	poolCfg.MaxConnLifetime = pc.MaxConnLifetime
	poolCfg.MaxConnIdleTime = pc.MaxConnIdleTime

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	timeout := pc.QueryTimeout
	if timeout == 0 {
		timeout = defaultPoolConfig.QueryTimeout
	}

	return &PostgresAdapter{pool: pool, queryTimeout: timeout}, nil
}

func IsDangerousSQL(query string) bool {
	upper := strings.ToUpper(strings.TrimSpace(query))
	for _, stmt := range blockedStatements {
		if strings.HasPrefix(upper, stmt) || strings.Contains(upper, " "+stmt+" ") {
			return true
		}
	}
	return false
}

func (a *PostgresAdapter) ExecuteQuery(ctx context.Context, query string) (*domain.QueryResponse, error) {
	if IsDangerousSQL(query) {
		return &domain.QueryResponse{
			SQL:   query,
			Error: "statement blocked by security policy",
		}, fmt.Errorf("statement blocked by security policy")
	}

	qCtx, cancel := context.WithTimeout(ctx, a.queryTimeout)
	defer cancel()

	start := time.Now()

	rows, err := a.pool.Query(qCtx, query)
	if err != nil {
		return &domain.QueryResponse{
			SQL:         query,
			ExecutionMs: time.Since(start).Seconds() * 1000,
			Error:       err.Error(),
		}, err
	}
	defer rows.Close()

	fieldDescriptions := rows.FieldDescriptions()
	var results []map[string]interface{}

	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, err
		}

		row := make(map[string]interface{})
		for i, value := range values {
			row[string(fieldDescriptions[i].Name)] = value
		}
		results = append(results, row)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	return &domain.QueryResponse{
		Rows:        results,
		ExecutionMs: time.Since(start).Seconds() * 1000,
		SQL:         query,
	}, nil
}

func (a *PostgresAdapter) GetSchema(ctx context.Context) (*domain.Schema, error) {
	tables, err := a.fetchTablesAndColumns(ctx)
	if err != nil {
		return nil, err
	}

	if err := a.populatePrimaryKeys(ctx, tables); err != nil {
		return nil, err
	}

	if err := a.populateIndexes(ctx, tables); err != nil {
		return nil, err
	}

	result := make([]domain.Table, 0, len(tables))
	for _, table := range tables {
		result = append(result, *table)
	}

	return &domain.Schema{Tables: result}, nil
}

func (a *PostgresAdapter) ValidateQuery(ctx context.Context, query string) error {
	_, err := a.pool.Exec(ctx, fmt.Sprintf("EXPLAIN %s", query))
	return err
}

func (a *PostgresAdapter) Close() error {
	a.pool.Close()
	return nil
}

func (a *PostgresAdapter) Ping(ctx context.Context) error {
	return a.pool.Ping(ctx)
}

func (a *PostgresAdapter) GetPool() *pgxpool.Pool {
	return a.pool
}
