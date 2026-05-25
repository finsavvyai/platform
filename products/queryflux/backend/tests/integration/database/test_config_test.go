package database_test

import (
	"os"
	"time"
)

// TestConnectionConfig holds connection parameters for all test databases
type TestConnectionConfig struct {
	Host            string
	Port            int
	Database        string
	Username        string
	Password        string
	SSLMode         string
	ConnectionString string
	Timeout         time.Duration
}

// TestDatabaseConfigs contains all database connection configurations
var TestDatabaseConfigs = map[string]TestConnectionConfig{
	"postgresql": {
		Host:     "localhost",
		Port:     5433,
		Database: "test_db",
		Username: "test_user",
		Password: "test_password",
		SSLMode:  "disable",
		Timeout:  30 * time.Second,
	},
	"mysql": {
		Host:     "localhost",
		Port:     3307,
		Database: "test_db",
		Username: "test_user",
		Password: "test_password",
		Timeout:  30 * time.Second,
	},
	"mariadb": {
		Host:     "localhost",
		Port:     3308,
		Database: "test_db",
		Username: "test_user",
		Password: "test_password",
		Timeout:  30 * time.Second,
	},
	"cockroachdb": {
		Host:     "localhost",
		Port:     26257,
		Database: "test_db",
		Username: "root",
		Password: "",
		SSLMode:  "disable",
		Timeout:  30 * time.Second,
	},
	"mongodb": {
		Host:            "localhost",
		Port:            27018,
		Database:        "test_db",
		Username:        "test_user",
		Password:        "test_password",
		ConnectionString: "mongodb://test_user:test_password@localhost:27018/test_db",
		Timeout:          30 * time.Second,
	},
	"redis": {
		Host:     "localhost",
		Port:     6380,
		Database: "0",
		Password: "test_password",
		Timeout:  30 * time.Second,
	},
	"memcached": {
		Host:    "localhost",
		Port:    11212,
		Timeout: 30 * time.Second,
	},
	"cassandra": {
		Host:     "localhost",
		Port:     9043,
		Database: "test_db",
		Username: "cassandra",
		Password: "cassandra",
		Timeout:  30 * time.Second,
	},
	"couchdb": {
		Host:            "localhost",
		Port:            5985,
		Database:        "test_db",
		Username:        "test_user",
		Password:        "test_password",
		ConnectionString: "http://test_user:test_password@localhost:5985/test_db",
		Timeout:          30 * time.Second,
	},
	"arangodb": {
		Host:            "localhost",
		Port:            8530,
		Database:        "test_db",
		Username:        "root",
		Password:        "test_password",
		ConnectionString: "http://root:test_password@localhost:8530",
		Timeout:          30 * time.Second,
	},
	"influxdb": {
		Host:            "localhost",
		Port:            8087,
		Database:        "test_bucket",
		Username:        "test_user",
		Password:        "test_password",
		ConnectionString: "http://localhost:8087",
		Timeout:          30 * time.Second,
	},
	"questdb": {
		Host:     "localhost",
		Port:     8812,
		Database: "qdb",
		Username: "test_user",
		Password: "test_password",
		Timeout:  30 * time.Second,
	},
	"timescaledb": {
		Host:     "localhost",
		Port:     5434,
		Database: "test_db",
		Username: "test_user",
		Password: "test_password",
		SSLMode:  "disable",
		Timeout:  30 * time.Second,
	},
	"neo4j": {
		Host:            "localhost",
		Port:            7688,
		Database:        "neo4j",
		Username:        "neo4j",
		Password:        "test_password",
		ConnectionString: "bolt://neo4j:test_password@localhost:7688",
		Timeout:          30 * time.Second,
	},
	"dynamodb": {
		Host:            "localhost",
		Port:            8001,
		Database:        "",
		Username:        "",
		Password:        "",
		ConnectionString: "http://localhost:8001",
		Timeout:          30 * time.Second,
	},
	"elasticsearch": {
		Host:            "localhost",
		Port:            9201,
		Database:        "",
		Username:        "",
		Password:        "",
		ConnectionString: "http://localhost:9201",
		Timeout:          30 * time.Second,
	},
	"sqlserver": {
		Host:     "localhost",
		Port:     1434,
		Database: "test_db",
		Username: "sa",
		Password: "TestPassword123!",
		Timeout:  30 * time.Second,
	},
	"oracle": {
		Host:     "localhost",
		Port:     1522,
		Database: "XE",
		Username: "system",
		Password: "TestPassword123",
		Timeout:  30 * time.Second,
	},
	"sqlite": {
		Database: ":memory:",
		Timeout:  30 * time.Second,
	},
}

// EnvironmentVariableMapping maps database types to their environment variables
var EnvironmentVariableMapping = map[string]string{
	"postgresql":  "POSTGRES_TEST_URL",
	"mysql":       "MYSQL_TEST_URL",
	"mariadb":     "MARIADB_TEST_URL",
	"cockroachdb": "COCKROACHDB_TEST_URL",
	"mongodb":     "MONGODB_TEST_URL",
	"redis":       "REDIS_TEST_URL",
	"memcached":   "MEMCACHED_TEST_URL",
	"cassandra":   "CASSANDRA_TEST_URL",
	"couchdb":     "COUCHDB_TEST_URL",
	"arangodb":    "ARANGODB_TEST_URL",
	"influxdb":    "INFLUXDB_TEST_URL",
	"questdb":     "QUESTDB_TEST_URL",
	"timescaledb": "TIMESCALEDB_TEST_URL",
	"neo4j":       "NEO4J_TEST_URL",
	"dynamodb":    "DYNAMODB_TEST_URL",
	"elasticsearch": "ELASTICSEARCH_TEST_URL",
	"sqlserver":   "SQLSERVER_TEST_URL",
	"oracle":      "ORACLE_TEST_URL",
}

// GetTestConfig returns the test configuration for a given database type
func GetTestConfig(dbType string) TestConnectionConfig {
	if config, exists := TestDatabaseConfigs[dbType]; exists {
		return config
	}

	// Return empty config if database type not found
	return TestConnectionConfig{}
}

// IsDatabaseAvailable checks if a database test should be run based on environment variables
func IsDatabaseAvailable(dbType string) bool {
	envVar, exists := EnvironmentVariableMapping[dbType]
	if !exists {
		return false
	}

	// For SQLite, we don't need environment variables
	if dbType == "sqlite" {
		return true
	}

	return os.Getenv(envVar) != ""
}