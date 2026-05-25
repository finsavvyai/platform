package pgx

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type Pool struct {
	db *sql.DB
}

func NewPool(databaseURL string) (*Pool, error) {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	if err := db.PingContext(context.Background()); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}
	return &Pool{db: db}, nil
}

func (p *Pool) DB() *sql.DB {
	return p.db
}

func (p *Pool) Close() error {
	return p.db.Close()
}

func (p *Pool) Ping(ctx context.Context) error {
	return p.db.PingContext(ctx)
}
