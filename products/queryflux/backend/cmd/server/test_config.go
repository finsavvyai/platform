package main

import (
	"fmt"
	"os"

	"github.com/queryflux/backend/internal/config"
)

func mainTestConfig() {
	// Set environment for testing
	os.Setenv("QUERYFLUX_PORT", "8080")
	os.Setenv("QUERYFLUX_HOST", "localhost")
	os.Setenv("QUERYFLUX_LOG_LEVEL", "info")
	os.Setenv("QUERYFLUX_DATABASE_URL", "postgres://localhost:5432/testdb?sslmode=disable")
	os.Setenv("QUERYFLUX_REDIS_URL", "redis://localhost:6379")
	os.Setenv("QUERYFLUX_JWT_SECRET", "test-jwt-secret-key-for-development-testing")

	// Override config file for testing
	os.Setenv("QUERYFLUX_CONFIG_FILE", "./tests/test_config.yaml")

	config, err := config.Load()
	if err != nil {
		fmt.Printf("Failed to load configuration: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Test Configuration loaded:\n")
	fmt.Printf("  Port: %s\n", config.Port)
	fmt.Printf("  Host: %s\n", config.Host)
	fmt.Printf("  Database: %s\n", config.DatabaseURL)
	fmt.Printf("  Redis: %s\n", config.RedisURL)
	fmt.Printf("  JWT Secret: %s\n", "****")
	fmt.Printf("  Environment: %s\n", config.Environment)

	fmt.Printf("Configuration system working correctly!\n")
}
