//go:build legacy_migrated
// +build legacy_migrated

package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"

	"quantumbeam/cmd/api-server"
	"quantumbeam/internal/database"
)

const (
	testDatabaseURL = "postgres://postgres:password@localhost:5432/quantumbeam_test?sslmode=disable"
	testServerPort  = 8081
)

// IntegrationTestSuite provides the test infrastructure
type IntegrationTestSuite struct {
	suite.Suite
	db         *sqlx.DB
	server     *httptest.Server
	app        *api.IntegratedApplication
	testUser   *TestUser
	testAPIKey *TestAPIKey
}

// TestUser represents a test user
type TestUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Token    string `json:"token"`
}

// TestAPIKey represents a test API key
type TestAPIKey struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Key  string `json:"key"`
	Hash string `json:"hash"`
}

// SetupSuite runs once before all tests
func (suite *IntegrationTestSuite) SetupSuite() {
	// Set Gin to test mode
	gin.SetMode(gin.TestMode)

	// Connect to test database
	db, err := sqlx.Connect("postgres", testDatabaseURL)
	suite.Require().NoError(err, "Failed to connect to test database")
	suite.db = db

	// Clean database and run migrations
	suite.cleanupDatabase()
	suite.runMigrations()

	// Setup test application
	suite.setupTestApplication()

	// Create test data
	suite.createTestData()
}

// TearDownSuite runs once after all tests
func (suite *IntegrationTestSuite) TearDownSuite() {
	if suite.server != nil {
		suite.server.Close()
	}
	if suite.db != nil {
		suite.db.Close()
	}
}

// SetupTest runs before each test
func (suite *IntegrationTestSuite) SetupTest() {
	// Reset any test-specific state
}

// TearDownTest runs after each test
func (suite *IntegrationTestSuite) TearDownTest() {
	// Clean up any test-specific data
}

func (suite *IntegrationTestSuite) cleanupDatabase() {
	// Drop all tables in the correct order considering foreign key constraints
	tables := []string{
		"audit_logs", "fraud_alerts", "transaction_features", "transactions",
		"api_keys", "payment_methods", "fraud_rules", "system_config",
		"merchants", "users",
	}

	for _, table := range tables {
		_, err := suite.db.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s CASCADE", table))
		if err != nil {
			log.Printf("Warning: Failed to drop table %s: %v", table, err)
		}
	}

	// Drop types and extensions
	_, _ = suite.db.Exec("DROP TYPE IF EXISTS notification_type")
	_, _ = suite.db.Exec("DROP TYPE IF EXISTS account_status")
	_, _ = suite.db.Exec("DROP TYPE IF EXISTS transaction_status")
	_, _ = suite.db.Exec("DROP TYPE IF EXISTS payment_method")
	_, _ = suite.db.Exec("DROP TYPE IF EXISTS risk_level")
	_, _ = suite.db.Exec("DROP EXTENSION IF EXISTS \"uuid-ossp\"")
}

func (suite *IntegrationTestSuite) runMigrations() {
	// Run initial schema migration
	schemaSQL := `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE payment_method AS ENUM ('credit_card', 'debit_card', 'bank_transfer', 'digital_wallet', 'crypto');
CREATE TYPE transaction_status AS ENUM ('pending', 'approved', 'declined', 'fraud_detected', 'investigation', 'completed');
CREATE TYPE account_status AS ENUM ('active', 'suspended', 'closed', 'frozen');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    country VARCHAR(2) NOT NULL,
    status account_status DEFAULT 'active',
    risk_score DECIMAL(5,4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Merchants table
CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100),
    country VARCHAR(2) NOT NULL,
    risk_level risk_level DEFAULT 'MEDIUM',
    status account_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status transaction_status DEFAULT 'pending',
    risk_level risk_level DEFAULT 'LOW',
    fraud_score DECIMAL(5,4) DEFAULT 0.0000,
    confidence DECIMAL(5,4) DEFAULT 0.0000,
    ai_analysis JSONB,
    quantum_analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment methods table
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type payment_method NOT NULL,
    last_four VARCHAR(4),
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API keys table
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    permissions JSONB DEFAULT '[]',
    rate_limit_per_minute INTEGER DEFAULT 1000,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System configuration table
CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`

	_, err := suite.db.Exec(schemaSQL)
	suite.Require().NoError(err, "Failed to run migrations")
}

func (suite *IntegrationTestSuite) setupTestApplication() {
	// Create test configuration
	config := &database.Config{
		Host:     "localhost",
		Port:     5432,
		User:     "postgres",
		Password: "password",
		DBName:   "quantumbeam_test",
		SSLMode:  "disable",
	}

	// Create integrated application
	app, err := api.NewIntegratedApplication(config)
	suite.Require().NoError(err, "Failed to create integrated application")
	suite.app = app

	// Setup test server
	suite.server = httptest.NewServer(app.Router)
}

func (suite *IntegrationTestSuite) createTestData() {
	// Create test system configuration
	systemConfig := []struct {
		key         string
		value       interface{}
		description string
		category    string
	}{
		{"app.name", "QuantumBeam Test", "Application name", "general"},
		{"fraud.default_risk_threshold", 0.7, "Default fraud risk threshold", "fraud"},
		{"ai.model_version", "v1.0-test", "AI model version", "ai"},
		{"features.quantum_analysis", true, "Enable quantum analysis", "features"},
	}

	for _, config := range systemConfig {
		valueJSON, _ := json.Marshal(config.value)
		_, err := suite.db.Exec(
			"INSERT INTO system_config (key, value, description, category) VALUES ($1, $2, $3, $4)",
			config.key, valueJSON, config.description, config.category,
		)
		suite.Require().NoError(err)
	}

	// Create test merchant
	merchantID := uuid()
	_, err := suite.db.Exec(`
		INSERT INTO merchants (id, name, business_name, email, category, country)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, merchantID, "Test Merchant", "Test Merchant Inc", "merchant@test.com", "electronics", "US")
	suite.Require().NoError(err)

	// Create test user
	suite.testUser = &TestUser{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "testpassword123",
	}

	userID := uuid()
	passwordHash := hashPassword(suite.testUser.Password)
	_, err = suite.db.Exec(`
		INSERT INTO users (id, username, email, password_hash, full_name, country)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, userID, suite.testUser.Username, suite.testUser.Email, passwordHash, "Test User", "US")
	suite.Require().NoError(err)

	suite.testUser.ID = userID
}

// Helper functions
func (suite *IntegrationTestSuite) makeRequest(method, endpoint string, body interface{}, headers map[string]string) *httptest.ResponseRecorder {
	var reqBody *bytes.Buffer
	if body != nil {
		jsonBody, err := json.Marshal(body)
		suite.Require().NoError(err)
		reqBody = bytes.NewBuffer(jsonBody)
	} else {
		reqBody = bytes.NewBuffer(nil)
	}

	req, err := http.NewRequest(method, suite.server.URL+endpoint, reqBody)
	suite.Require().NoError(err)

	// Set headers
	for key, value := range headers {
		req.Header.Set(key, value)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	w := httptest.NewRecorder()
	suite.server.Config.Handler.ServeHTTP(w, req)
	return w
}

func (suite *IntegrationTestSuite) authenticateUser() {
	loginData := map[string]string{
		"username": suite.testUser.Username,
		"password": suite.testUser.Password,
	}

	w := suite.makeRequest("POST", "/auth/login", loginData, nil)
	suite.Equal(http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	suite.Require().NoError(err)

	suite.testUser.Token = response["token"].(string)
}

func (suite *IntegrationTestSuite) createAPIKey() {
	suite.authenticateUser()

	apiKeyData := map[string]interface{}{
		"name":        "Test API Key",
		"description": "API key for integration tests",
		"permissions": []string{"read", "write"},
	}

	headers := map[string]string{
		"Authorization": "Bearer " + suite.testUser.Token,
	}

	w := suite.makeRequest("POST", "/api/keys", apiKeyData, headers)
	suite.Equal(http.StatusCreated, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	suite.Require().NoError(err)

	data := response["data"].(map[string]interface{})
	suite.testAPIKey = &TestAPIKey{
		ID:   data["id"].(string),
		Name: data["name"].(string),
		Key:  data["key"].(string),
	}
}

// Utility functions
func uuid() string {
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		time.Now().UnixNano(),
		uint16(time.Now().UnixNano()>>48),
		uint16(time.Now().UnixNano()>>32),
		uint16(time.Now().UnixNano()>>16),
		time.Now().UnixNano()&0xffffffffffff,
	)
}

func hashPassword(password string) string {
	// Simple hash for testing - in production use proper bcrypt
	return fmt.Sprintf("hash_%s", password)
}

// Test entry point
func TestIntegrationSuite(t *testing.T) {
	if os.Getenv("SKIP_INTEGRATION") == "1" {
		t.Skip("Skipping integration tests")
	}

	// Check if test database is available
	if !isDatabaseAvailable() {
		t.Skip("Test database not available")
	}

	suite.Run(t, new(IntegrationTestSuite))
}

func isDatabaseAvailable() bool {
	db, err := sqlx.Connect("postgres", testDatabaseURL)
	if err != nil {
		return false
	}
	defer db.Close()
	return db.Ping() == nil
}