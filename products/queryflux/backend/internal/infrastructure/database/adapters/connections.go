package adapters

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/queryflux/backend/internal/domain/entities"

	// Import database drivers
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/jackc/pgx/v5/stdlib"

	// _ "github.com/mattn/go-sqlite3" // Optional: if using sqlite
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// GetPostgresConnection establishes a connection to PostgreSQL using database/sql
func GetPostgresConnection(conn *entities.Connection) (*sql.DB, error) {
	connStr, err := conn.GetConnectionString()
	if err != nil {
		return nil, fmt.Errorf("failed to build connection string: %w", err)
	}

	db, err := sql.Open("pgx", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open postgres connection: %w", err)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping postgres: %w", err)
	}

	return db, nil
}

// GetMySQLConnection establishes a connection to MySQL using database/sql
func GetMySQLConnection(conn *entities.Connection) (*sql.DB, error) {
	connStr, err := conn.GetConnectionString()
	if err != nil {
		return nil, fmt.Errorf("failed to build connection string: %w", err)
	}

	db, err := sql.Open("mysql", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open mysql connection: %w", err)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping mysql: %w", err)
	}

	return db, nil
}

// GetMongoDBConnection establishes a connection to MongoDB
func GetMongoDBConnection(conn *entities.Connection) (*mongo.Client, error) {
	connStr, err := conn.GetConnectionString()
	if err != nil {
		return nil, fmt.Errorf("failed to build connection string: %w", err)
	}

	clientOptions := options.Client().ApplyURI(connStr)
	client, err := mongo.Connect(context.Background(), clientOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to mongodb: %w", err)
	}

	if err := client.Ping(context.Background(), nil); err != nil {
		client.Disconnect(context.Background())
		return nil, fmt.Errorf("failed to ping mongodb: %w", err)
	}

	return client, nil
}

// GetRedisConnection establishes a connection to Redis
func GetRedisConnection(conn *entities.Connection) (*redis.Client, error) {
	connStr, err := conn.GetConnectionString()
	if err != nil {
		return nil, fmt.Errorf("failed to build connection string: %w", err)
	}

	opt, err := redis.ParseURL(connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse redis URL: %w", err)
	}

	client := redis.NewClient(opt)

	if err := client.Ping(context.Background()).Err(); err != nil {
		client.Close()
		return nil, fmt.Errorf("failed to ping redis: %w", err)
	}

	return client, nil
}
