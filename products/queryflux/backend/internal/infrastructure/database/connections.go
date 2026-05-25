package database

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/mattn/go-sqlite3"
)

// NewPostgreSQLConnection creates a new PostgreSQL database connection using pgxpool
func NewPostgreSQLConnection(databaseURL string) (*pgxpool.Pool, error) {
	// Parse the database URL to ensure it's valid
	_, err := url.Parse(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid database URL: %w", err)
	}

	// Create pgxpool config
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	// Configure connection pool
	config.MaxConns = 25
	config.MinConns = 5
	config.MaxConnLifetime = 0      // No limit
	config.MaxConnIdleTime = 0      // No limit

	// Create connection pool
	ctx := context.Background()
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Test the connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return pool, nil
}

// NewRedisConnection creates a new Redis client connection
func NewRedisConnection(redisURL string) (*redis.Client, error) {
	// Parse Redis URL
	parsedURL, err := url.Parse(redisURL)
	if err != nil {
		return nil, fmt.Errorf("invalid Redis URL: %w", err)
	}

	// Extract connection details
	host := parsedURL.Host
	if host == "" {
		host = "localhost:6379"
	}

	// Extract database number
	db := 0
	if parsedURL.Path != "" && len(parsedURL.Path) > 1 {
		if dbNum, err := strconv.Atoi(parsedURL.Path[1:]); err == nil {
			db = dbNum
		}
	}

	// Extract password
	password := ""
	if parsedURL.User != nil {
		password, _ = parsedURL.User.Password()
	}

	// Create Redis client
	client := redis.NewClient(&redis.Options{
		Addr:     host,
		Password: password,
		DB:       db,
	})

	// Test the connection
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		client.Close()
		return nil, fmt.Errorf("failed to ping Redis: %w", err)
	}

	return client, nil
}

// NewMySQLConnection creates a new MySQL database connection
func NewMySQLConnection(databaseURL string) (*sql.DB, error) {
	db, err := sql.Open("mysql", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open MySQL connection: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(0)

	// Test the connection
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping MySQL database: %w", err)
	}

	return db, nil
}

// NewSQLiteConnection creates a new SQLite database connection
func NewSQLiteConnection(databasePath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", databasePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open SQLite connection: %w", err)
	}

	// Configure connection pool (SQLite doesn't need many connections)
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	// Test the connection
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping SQLite database: %w", err)
	}

	return db, nil
}