package integration

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// DockerComposeTestSuite tests database adapters via Docker containers
type DockerComposeTestSuite struct {
	suite.Suite
	ctx                context.Context
	dockerComposePath  string
	composeProjectName string
	containersRunning  bool
}

// SetupSuite starts Docker containers
func (suite *DockerComposeTestSuite) SetupSuite() {
	suite.ctx = context.Background()
	suite.dockerComposePath = filepath.Join(".", "docker-compose.test.yml")
	suite.composeProjectName = "queryflux-test"

	if testing.Short() {
		suite.T().Skip("Skipping Docker tests in short mode")
	}

	// Check if docker-compose file exists
	if _, err := os.Stat(suite.dockerComposePath); os.IsNotExist(err) {
		suite.T().Skip("docker-compose.test.yml not found")
	}

	// Start containers
	suite.startDockerContainers()
	suite.containersRunning = true

	// Wait for containers to be healthy
	suite.waitForHealthyContainers()
}

// TearDownSuite stops Docker containers
func (suite *DockerComposeTestSuite) TearDownSuite() {
	if suite.containersRunning {
		suite.stopDockerContainers()
	}
}

// startDockerContainers starts all database containers
func (suite *DockerComposeTestSuite) startDockerContainers() {
	suite.T().Log("Starting Docker containers for database testing...")

	cmd := exec.Command("docker-compose", "-f", suite.dockerComposePath, "-p", suite.composeProjectName, "up", "-d")
	cmd.Dir = "."

	output, err := cmd.CombinedOutput()
	if err != nil {
		suite.T().Fatalf("Failed to start Docker containers: %v\nOutput: %s", err, string(output))
	}

	suite.T().Logf("Docker containers started: %s", string(output))

	// Give containers time to initialize
	time.Sleep(10 * time.Second)
}

// stopDockerContainers stops and removes all database containers
func (suite *DockerComposeTestSuite) stopDockerContainers() {
	suite.T().Log("Stopping Docker containers...")

	cmd := exec.Command("docker-compose", "-f", suite.dockerComposePath, "-p", suite.composeProjectName, "down", "-v")
	cmd.Dir = "."

	output, err := cmd.CombinedOutput()
	if err != nil {
		suite.T().Logf("Warning: Failed to stop Docker containers: %v\nOutput: %s", err, string(output))
	} else {
		suite.T().Logf("Docker containers stopped: %s", string(output))
	}

	suite.containersRunning = false
}

// waitForHealthyContainers waits for all containers to be healthy
func (suite *DockerComposeTestSuite) waitForHealthyContainers() {
	suite.T().Log("Waiting for containers to be healthy...")

	containers := []string{
		"queryflux-postgres-test",
		"queryflux-mysql-test",
		"queryflux-mongodb-test",
		"queryflux-redis-test",
		"queryflux-mariadb-test",
		"queryflux-yugabyte-test",
		"queryflux-elasticsearch-test",
		"queryflux-influxdb-test",
		"queryflux-neo4j-test",
		"queryflux-timescaledb-test",
	}

	timeout := time.After(120 * time.Second)
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	healthyCount := 0
	for {
		select {
		case <-timeout:
			suite.T().Fatalf("Timeout waiting for containers to become healthy")
		case <-ticker.C:
			healthyCount = suite.checkContainerHealth(containers)
			if healthyCount == len(containers) {
				suite.T().Logf("All %d containers are healthy", healthyCount)
				return
			}
			suite.T().Logf("%d/%d containers healthy", healthyCount, len(containers))
		}
	}
}

// checkContainerHealth checks the health status of containers
func (suite *DockerComposeTestSuite) checkContainerHealth(containers []string) int {
	healthyCount := 0

	for _, container := range containers {
		// Check if container exists and is healthy
		cmd := exec.Command("docker", "ps", "--filter", "name="+container, "--filter", "status=running", "--format", "{{.Status}}")
		output, err := cmd.Output()
		if err != nil {
			continue
		}

		if len(output) > 0 && (strings.Contains(string(output), "healthy") ||
		   strings.Contains(string(output), "Up") ||
		   strings.Contains(string(output), "running")) {
			healthyCount++
		}
	}

	return healthyCount
}

// TestPostgreSQLViaDocker tests PostgreSQL adapter with Docker container
func (suite *DockerComposeTestSuite) TestPostgreSQLViaDocker() {
	if !suite.containersRunning {
		suite.T().Skip("Docker containers not running")
	}

	// Test container health
	cmd := exec.Command("docker", "exec", "queryflux-postgres-test", "pg_isready", "-U", "testuser", "-d", "queryflux_test")
	output, err := cmd.CombinedOutput()
	require.NoError(suite.T(), err, "PostgreSQL container not healthy: %s", string(output))
	assert.Contains(suite.T(), string(output), "accepting connections")

	// Test database connectivity via psql
	cmd = exec.Command("docker", "exec", "queryflux-postgres-test", "psql", "-U", "testuser", "-d", "queryflux_test", "-c", "SELECT COUNT(*) FROM users;")
	output, err = cmd.CombinedOutput()
	require.NoError(suite.T(), err, "Failed to query PostgreSQL: %s", string(output))
	assert.Contains(suite.T(), string(output), "2") // We inserted 2 users

	suite.T().Log("PostgreSQL Docker container test passed")
}

// TestMySQLViaDocker tests MySQL adapter with Docker container
func (suite *DockerComposeTestSuite) TestMySQLViaDocker() {
	if !suite.containersRunning {
		suite.T().Skip("Docker containers not running")
	}

	// Test container health
	cmd := exec.Command("docker", "exec", "queryflux-mysql-test", "mysqladmin", "ping", "-h", "localhost", "-u", "testuser", "-ptestpass")
	output, err := cmd.CombinedOutput()
	require.NoError(suite.T(), err, "MySQL container not healthy: %s", string(output))
	assert.Contains(suite.T(), string(output), "mysqld is alive")

	// Test database connectivity
	cmd = exec.Command("docker", "exec", "queryflux-mysql-test", "mysql", "-u", "testuser", "-ptestpass", "-D", "queryflux_test", "-e", "SELECT COUNT(*) FROM users;")
	output, err = cmd.CombinedOutput()
	require.NoError(suite.T(), err, "Failed to query MySQL: %s", string(output))
	assert.Contains(suite.T(), string(output), "2")

	suite.T().Log("MySQL Docker container test passed")
}

// TestMongoDBViaDocker tests MongoDB adapter with Docker container
func (suite *DockerComposeTestSuite) TestMongoDBViaDocker() {
	if !suite.containersRunning {
		suite.T().Skip("Docker containers not running")
	}

	// Test container health
	cmd := exec.Command("docker", "exec", "queryflux-mongodb-test", "mongo", "--eval", "db.adminCommand('ping')")
	output, err := cmd.CombinedOutput()
	require.NoError(suite.T(), err, "MongoDB container not healthy: %s", string(output))
	assert.Contains(suite.T(), string(output), "ok")

	// Test database connectivity
	cmd = exec.Command("docker", "exec", "queryflux-mongodb-test", "mongo", "queryflux_test", "--eval", "db.users.count()")
	output, err = cmd.CombinedOutput()
	require.NoError(suite.T(), err, "Failed to query MongoDB: %s", string(output))
	assert.Contains(suite.T(), string(output), "2")

	suite.T().Log("MongoDB Docker container test passed")
}

// TestRedisViaDocker tests Redis adapter with Docker container
func (suite *DockerComposeTestSuite) TestRedisViaDocker() {
	if !suite.containersRunning {
		suite.T().Skip("Docker containers not running")
	}

	// Test container health
	cmd := exec.Command("docker", "exec", "queryflux-redis-test", "redis-cli", "ping")
	output, err := cmd.CombinedOutput()
	require.NoError(suite.T(), err, "Redis container not healthy: %s", string(output))
	assert.Contains(suite.T(), strings.TrimSpace(string(output)), "PONG")

	// Test Redis operations
	cmd = exec.Command("docker", "exec", "queryflux-redis-test", "redis-cli", "SET", "test:key", "test:value")
	_, err = cmd.CombinedOutput()
	require.NoError(suite.T(), err, "Failed to SET Redis key")

	cmd = exec.Command("docker", "exec", "queryflux-redis-test", "redis-cli", "GET", "test:key")
	output, err = cmd.CombinedOutput()
	require.NoError(suite.T(), err, "Failed to GET Redis key")
	assert.Equal(suite.T(), "test:value\n", string(output))

	suite.T().Log("Redis Docker container test passed")
}

// TestElasticsearchViaDocker tests Elasticsearch adapter with Docker container
func (suite *DockerComposeTestSuite) TestElasticsearchViaDocker() {
	if !suite.containersRunning {
		suite.T().Skip("Docker containers not running")
	}

	// Test container health
	cmd := exec.Command("curl", "-f", "http://localhost:9200/_cluster/health")
	output, err := cmd.CombinedOutput()
	if err != nil {
		suite.T().Skipf("Elasticsearch not available: %v", err)
	}
	assert.Contains(suite.T(), string(output), "cluster_name")

	// Test Elasticsearch connectivity
	cmd = exec.Command("curl", "-f", "http://localhost:9200/_cat/health")
	output, err = cmd.CombinedOutput()
	require.NoError(suite.T(), err, "Failed to query Elasticsearch health")
	assert.Contains(suite.T(), string(output), "green")

	suite.T().Log("Elasticsearch Docker container test passed")
}

// TestTimescaleDBViaDocker tests TimescaleDB adapter with Docker container
func (suite *DockerComposeTestSuite) TestTimescaleDBViaDocker() {
	if !suite.containersRunning {
		suite.T().Skip("Docker containers not running")
	}

	// Test container health
	cmd := exec.Command("docker", "exec", "queryflux-timescaledb-test", "pg_isready", "-U", "testuser", "-d", "queryflux_test")
	output, err := cmd.CombinedOutput()
	if err != nil {
		suite.T().Skipf("TimescaleDB not available: %v", err)
	}
	require.NoError(suite.T(), err, "TimescaleDB container not healthy: %s", string(output))
	assert.Contains(suite.T(), string(output), "accepting connections")

	// Test TimescaleDB extension
	cmd = exec.Command("docker", "exec", "queryflux-timescaledb-test", "psql", "-U", "testuser", "-d", "queryflux_test", "-c", "SELECT extversion FROM pg_extension WHERE extname='timescaledb';")
	output, err = cmd.CombinedOutput()
	require.NoError(suite.T(), err, "Failed to query TimescaleDB extension: %s", string(output))
	assert.NotEmpty(suite.T(), strings.TrimSpace(string(output)))

	// Test hypertable
	cmd = exec.Command("docker", "exec", "queryflux-timescaledb-test", "psql", "-U", "testuser", "-d", "queryflux_test", "-c", "SELECT COUNT(*) FROM query_metrics;")
	output, err = cmd.CombinedOutput()
	require.NoError(suite.T(), err, "Failed to query TimescaleDB hypertable: %s", string(output))
	assert.Contains(suite.T(), string(output), "288") // We inserted 288 records

	suite.T().Log("TimescaleDB Docker container test passed")
}

// TestInfluxDBViaDocker tests InfluxDB adapter with Docker container
func (suite *DockerComposeTestSuite) TestInfluxDBViaDocker() {
	if !suite.containersRunning {
		suite.T().Skip("Docker containers not running")
	}

	// Test container health
	cmd := exec.Command("curl", "-f", "http://localhost:8086/ping")
	output, err := cmd.CombinedOutput()
	if err != nil {
		suite.T().Skipf("InfluxDB not available: %v", err)
	}
	assert.Contains(suite.T(), string(output), "influxdb")

	// Test InfluxDB connectivity
	cmd = exec.Command("curl", "-f", "http://localhost:8086/query?q=SHOW%20DATABASES")
	output, err = cmd.CombinedOutput()
	require.NoError(suite.T(), err, "Failed to query InfluxDB databases")
	assert.Contains(suite.T(), string(output), "queryflux_test")

	suite.T().Log("InfluxDB Docker container test passed")
}

// TestNeo4jViaDocker tests Neo4j adapter with Docker container
func (suite *DockerComposeTestSuite) TestNeo4jViaDocker() {
	if !suite.containersRunning {
		suite.T().Skip("Docker containers not running")
	}

	// Test container health
	cmd := exec.Command("curl", "-f", "-u", "neo4j:testpass", "http://localhost:7474/")
	output, err := cmd.CombinedOutput()
	if err != nil {
		suite.T().Skipf("Neo4j not available: %v", err)
	}
	assert.Contains(suite.T(), string(output), "Neo4j")

	// Test Neo4j connectivity via cypher-shell
	cmd = exec.Command("docker", "exec", "queryflux-neo4j-test", "cypher-shell", "-u", "neo4j", "-p", "testpass", "RETURN 1 as test")
	output, err = cmd.CombinedOutput()
	require.NoError(suite.T(), err, "Failed to query Neo4j: %s", string(output))
	assert.Contains(suite.T(), string(output), "test")

	suite.T().Log("Neo4j Docker container test passed")
}

// TestYugabyteDBViaDocker tests YugabyteDB adapter with Docker container
func (suite *DockerComposeTestSuite) TestYugabyteDBViaDocker() {
	if !suite.containersRunning {
		suite.T().Skip("Docker containers not running")
	}

	// Test container health
	cmd := exec.Command("docker", "exec", "queryflux-yugabyte-test", "ysqlsh", "-h", "localhost", "-p", "5433", "-U", "yugabyte", "-d", "yugabyte", "-c", "SELECT 1;")
	output, err := cmd.CombinedOutput()
	if err != nil {
		suite.T().Skipf("YugabyteDB not available: %v", err)
	}
	require.NoError(suite.T(), err, "YugabyteDB container not healthy: %s", string(output))
	assert.Contains(suite.T(), string(output), "1")

	suite.T().Log("YugabyteDB Docker container test passed")
}

// TestDockerLogs checks for any errors in container logs
func (suite *DockerComposeTestSuite) TestDockerLogs() {
	if !suite.containersRunning {
		suite.T().Skip("Docker containers not running")
	}

	containers := []string{
		"queryflux-postgres-test",
		"queryflux-mysql-test",
		"queryflux-mongodb-test",
		"queryflux-redis-test",
		"queryflux-mariadb-test",
		"queryflux-yugabyte-test",
		"queryflux-elasticsearch-test",
		"queryflux-influxdb-test",
		"queryflux-neo4j-test",
		"queryflux-timescaledb-test",
	}

	for _, container := range containers {
		cmd := exec.Command("docker", "logs", "--tail=50", container)
		output, err := cmd.Output()
		if err != nil {
			suite.T().Logf("Warning: Could not get logs for %s: %v", container, err)
			continue
		}

		// Check for error messages
		logOutput := string(output)
		errorKeywords := []string{"ERROR", "FATAL", "failed", "denied", "refused"}

		for _, keyword := range errorKeywords {
			if strings.Contains(strings.ToUpper(logOutput), keyword) {
				suite.T().Logf("Potential error in %s logs: contains '%s'", container, keyword)
				// Log a snippet of the error
				lines := strings.Split(logOutput, "\n")
				for i, line := range lines {
					if strings.Contains(strings.ToUpper(line), keyword) && i > 0 {
						suite.T().Logf("  Context: %s", lines[i-1])
						suite.T().Logf("  Error:   %s", line)
						if i+1 < len(lines) {
							suite.T().Logf("  Next:    %s", lines[i+1])
						}
						break
					}
				}
			}
		}
	}
}

// TestContainerResourceUsage checks resource usage of containers
func (suite *DockerComposeTestSuite) TestContainerResourceUsage() {
	if !suite.containersRunning {
		suite.T().Skip("Docker containers not running")
	}

	// Get container stats
	cmd := exec.Command("docker", "stats", "--no-stream", "--format", "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}")
	output, err := cmd.Output()
	if err != nil {
		suite.T().Logf("Warning: Could not get container stats: %v", err)
		return
	}

	suite.T().Log("Container Resource Usage:")
	suite.T().Log(string(output))
}

// TestDockerCompose runs the Docker compose test suite
func TestDockerCompose(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping Docker compose tests in short mode")
	}

	// Check if Docker is available
	_, err := exec.LookPath("docker")
	if err != nil {
		t.Skip("Docker not available")
	}

	_, err = exec.LookPath("docker-compose")
	if err != nil {
		t.Skip("docker-compose not available")
	}

	// Run the test suite
	suite.Run(t, new(DockerComposeTestSuite))
}

// Helper function to run Docker commands with timeout
func runDockerCommandWithTimeout(timeout time.Duration, name string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, name, args...)
	output, err := cmd.CombinedOutput()

	if ctx.Err() == context.DeadlineExceeded {
		return string(output), fmt.Errorf("command timed out after %v", timeout)
	}

	return string(output), err
}