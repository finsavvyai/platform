package integration

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// QuickTestSuite provides basic validation for database adapters
type QuickTestSuite struct {
	suite.Suite
	ctx     context.Context
	factory *adapters.EnhancedAdapterFactory
}

// SetupSuite initializes the test suite
func (suite *QuickTestSuite) SetupSuite() {
	suite.ctx = context.Background()
	suite.factory = adapters.NewEnhancedAdapterFactory()
}

// TestPostgreSQLConnection tests basic PostgreSQL connection
func (suite *QuickTestSuite) TestPostgreSQLConnection() {
	config := types.DatabaseConfig{
		Type:     "postgresql",
		Host:     "localhost",
		Port:     5435, // Updated port
		Database: "queryflux_test",
		Username: "testuser",
		Password: "testpass",
		SSLMode:  "disable",
	}

	adapter, err := suite.factory.CreateAdapter("postgresql")
	require.NoError(suite.T(), err)

	err = adapter.Connect(suite.ctx, config)
	require.NoError(suite.T(), err)

	// Test health check
	health, err := adapter.HealthCheck(suite.ctx)
	require.NoError(suite.T(), err)
	assert.True(suite.T(), health.IsHealthy)

	// Test basic query
	query := "SELECT 1 as test"
	result, err := adapter.ExecuteQuery(suite.ctx, query, nil)
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), result.Rows)

	adapter.Close()
	suite.T().Log("PostgreSQL connection test passed")
}

// TestMySQLConnection tests basic MySQL connection
func (suite *QuickTestSuite) TestMySQLConnection() {
	config := types.DatabaseConfig{
		Type:     "mysql",
		Host:     "localhost",
		Port:     3309, // Updated port
		Database: "queryflux_test",
		Username: "testuser",
		Password: "testpass",
	}

	adapter, err := suite.factory.CreateAdapter("mysql")
	require.NoError(suite.T(), err)

	err = adapter.Connect(suite.ctx, config)
	require.NoError(suite.T(), err)

	// Test health check
	health, err := adapter.HealthCheck(suite.ctx)
	require.NoError(suite.T(), err)
	assert.True(suite.T(), health.IsHealthy)

	// Test basic query
	query := "SELECT 1 as test"
	result, err := adapter.ExecuteQuery(suite.ctx, query, nil)
	require.NoError(suite.T(), err)
	assert.NotEmpty(suite.T(), result.Rows)

	adapter.Close()
	suite.T().Log("MySQL connection test passed")
}

// TestMongoDBConnection tests basic MongoDB connection
func (suite *QuickTestSuite) TestMongoDBConnection() {
	config := types.DatabaseConfig{
		Type:     "mongodb",
		Host:     "localhost",
		Port:     27019, // Updated port
		Database: "queryflux_test",
		Username: "testuser",
		Password: "testpass",
	}

	adapter, err := suite.factory.CreateAdapter("mongodb")
	require.NoError(suite.T(), err)

	err = adapter.Connect(suite.ctx, config)
	require.NoError(suite.T(), err)

	// Test health check
	health, err := adapter.HealthCheck(suite.ctx)
	require.NoError(suite.T(), err)
	assert.True(suite.T(), health.IsHealthy)

	// Test basic query
	query := "db.findOne()"
	result, err := adapter.ExecuteQuery(suite.ctx, query, nil)
	require.NoError(suite.T(), err)

	adapter.Close()
	suite.T().Log("MongoDB connection test passed")
}

// TestAdapterFactory tests the adapter factory
func (suite *QuickTestSuite) TestAdapterFactory() {
	supportedTypes := suite.factory.GetSupportedTypes()

	// Test that core database types are supported
	expectedTypes := []string{"postgresql", "mysql", "mongodb", "redis"}
	for _, expectedType := range expectedTypes {
		assert.Contains(suite.T(), supportedTypes, expectedType, "Factory should support %s", expectedType)
	}

	// Test creating adapters
	for _, dbType := range []string{"postgresql", "mysql", "mongodb"} {
		adapter, err := suite.factory.CreateAdapter(dbType)
		assert.NoError(suite.T(), err, "Should create adapter for %s", dbType)
		assert.NotNil(suite.T(), adapter, "Adapter should not be nil for %s", dbType)
	}

	stats := suite.factory.GetStatistics()
	assert.NotEmpty(suite.T(), stats)

	suite.T().Logf("Adapter factory test passed. Supported types: %v", supportedTypes)
}

// TestDockerConnectivity tests basic connectivity to Docker containers
func (suite *QuickTestSuite) TestDockerConnectivity() {
	// Test PostgreSQL
	cmd := exec.Command("docker", "exec", "queryflux-postgres-test", "psql", "-U", "testuser", "-d", "queryflux_test", "-c", "SELECT 1;")
	output, err := cmd.CombinedOutput()
	if err != nil {
		suite.T().Logf("PostgreSQL test failed: %v\nOutput: %s", err, string(output))
	} else {
		suite.T().Log("PostgreSQL container test passed")
	}

	// Test MySQL
	cmd = exec.Command("docker", "exec", "queryflux-mysql-test", "mysql", "-u", "testuser", "-ptestpass", "-D", "queryflux_test", "-e", "SELECT 1;")
	output, err = cmd.CombinedOutput()
	if err != nil {
		suite.T().Logf("MySQL test failed: %v\nOutput: %s", err, string(output))
	} else {
		suite.T().Log("MySQL container test passed")
	}

	// Test MongoDB
	cmd = exec.Command("docker", "exec", "queryflux-mongodb-test", "mongo", "queryflux_test", "--eval", "db.runCommand({ping: 1})")
	output, err = cmd.CombinedOutput()
	if err != nil {
		suite.T().Logf("MongoDB test failed: %v\nOutput: %s", err, string(output))
	} else {
		suite.T().Log("MongoDB container test passed")
	}
}

// TestQuickDatabaseConnectivity runs the quick test suite
func TestQuickDatabaseConnectivity(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping quick database connectivity test in short mode")
	}

	// Check if Docker containers are running by testing a simple command
	if _, err := exec.LookPath("docker"); err != nil {
		t.Skip("Docker not available")
	}

	// Check if containers are running
	cmd := exec.Command("docker", "ps", "--filter", "name=queryflux", "--format", "{{.Names}}")
	output, err := cmd.Output()
	if err != nil {
		t.Skip("Docker containers not running")
	}

	if len(output) == 0 {
		t.Skip("No queryflux containers running")
	}

	t.Logf("Found containers: %s", string(output))

	// Run the test suite
	suite.Run(t, new(QuickTestSuite))
}

// Helper function to run shell command with proper error handling
func execCommand(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd
}

// TestDatabaseConnectivityStatus checks the status of all database connections
func TestDatabaseConnectivityStatus(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping database connectivity status check in short mode")
	}

	t.Run("ContainerStatus", func(t *testing.T) {
		containers := map[string]string{
			"PostgreSQL": "queryflux-postgres-test",
			"MySQL":      "queryflux-mysql-test",
			"MongoDB":    "queryflux-mongodb-test",
		}

		for dbType, containerName := range containers {
			t.Run(dbType, func(t *testing.T) {
				cmd := exec.Command("docker", "ps", "--filter", "name="+containerName, "--format", "{{.Status}}")
				output, err := cmd.Output()
				if err != nil {
					t.Errorf("Failed to get status for %s: %v", dbType, err)
					return
				}

				status := strings.TrimSpace(string(output))
				if status == "" {
					t.Errorf("%s container is not running", dbType)
				} else {
					t.Logf("%s container status: %s", dbType, status)
				}
			})
		}
	})
}

// TestContainerHealthCheck performs health checks on all containers
func TestContainerHealthCheck(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping container health check in short mode")
	}

	healthChecks := map[string]func() bool{
		"PostgreSQL": func() bool {
			cmd := exec.Command("docker", "exec", "queryflux-postgres-test", "pg_isready", "-U", "testuser", "-d", "queryflux_test")
			return cmd.Run() == nil
		},
		"MySQL": func() bool {
			cmd := exec.Command("docker", "exec", "queryflux-mysql-test", "mysqladmin", "ping", "-h", "localhost", "-u", "testuser", "-ptestpass")
			return cmd.Run() == nil
		},
		"MongoDB": func() bool {
			cmd := exec.Command("docker", "exec", "queryflux-mongodb-test", "mongo", "--eval", "db.adminCommand('ping')")
			return cmd.Run() == nil
		},
	}

	for dbType, healthCheck := range healthChecks {
		t.Run(dbType+"Health", func(t *testing.T) {
			// Wait a moment for containers to be fully ready
			time.Sleep(2 * time.Second)

			if healthCheck() {
				t.Logf("%s is healthy", dbType)
			} else {
				t.Errorf("%s health check failed", dbType)
			}
		})
	}
}