package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/mcpoverflow/api-service/internal/config"
	"github.com/mcpoverflow/api-service/internal/models"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Database struct {
	DB     *gorm.DB
	Redis  *redis.Client
	config *config.Config
}

func NewDatabase(cfg *config.Config) (*Database, error) {
	db, err := connectPostgres(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to postgres: %w", err)
	}

	redisClient, err := connectRedis(cfg)
	if err != nil {
		log.Printf("Warning: failed to connect to redis: %v", err)
		// Continue without Redis for now
	}

	database := &Database{
		DB:     db,
		Redis:  redisClient,
		config: cfg,
	}

	// Run migrations
	if err := database.migrate(); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return database, nil
}

func connectPostgres(cfg *config.Config) (*gorm.DB, error) {
	// Configure GORM logger
	logLevel := logger.Silent
	if cfg.Environment == "development" {
		logLevel = logger.Info
	}

	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL()), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})
	if err != nil {
		return nil, err
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Test connection
	if err := sqlDB.Ping(); err != nil {
		return nil, err
	}

	log.Println("Successfully connected to PostgreSQL database")
	return db, nil
}

func connectRedis(cfg *config.Config) (*redis.Client, error) {
	opt, err := redis.ParseURL(cfg.Redis.URL)
	if err != nil {
		return nil, err
	}

	client := redis.NewClient(opt)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	log.Println("Successfully connected to Redis")
	return client, nil
}

func (d *Database) migrate() error {
	return d.DB.AutoMigrate(
		&models.User{},
		&models.Connector{},
		&models.Agent{},
		&models.ConnectorAnalytics{},
		&models.AgentAnalytics{},
		&models.AgentLog{},
		&models.GenerationJob{},
		&models.Deployment{},
		&models.APIKey{},
	)
}

func (d *Database) Close() error {
	sqlDB, err := d.DB.DB()
	if err != nil {
		return err
	}

	if err := sqlDB.Close(); err != nil {
		return err
	}

	if d.Redis != nil {
		return d.Redis.Close()
	}

	return nil
}

func (d *Database) Health() map[string]interface{} {
	health := make(map[string]interface{})

	// Check PostgreSQL
	sqlDB, err := d.DB.DB()
	if err != nil {
		health["postgres"] = "error: " + err.Error()
	} else if err := sqlDB.Ping(); err != nil {
		health["postgres"] = "error: " + err.Error()
	} else {
		health["postgres"] = "healthy"
	}

	// Check Redis
	if d.Redis != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		if err := d.Redis.Ping(ctx).Err(); err != nil {
			health["redis"] = "error: " + err.Error()
		} else {
			health["redis"] = "healthy"
		}
	} else {
		health["redis"] = "not configured"
	}

	return health
}
