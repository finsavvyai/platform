package main

import (
	"fmt"
	"os"
	"os/exec"
	"time"
)

func main() {
	fmt.Println("QueryFlux Database Adapter Connection Test")
	fmt.Println("=======================================")

	// Check Docker containers are running
	if !checkDockerContainers() {
		fmt.Println("ERROR: Docker containers are not running")
		os.Exit(1)
	}

	// Test individual database connections
	testResults := map[string]bool{
		"PostgreSQL": testPostgreSQLConnection(),
		"MySQL":      testMySQLConnection(),
		"MongoDB":    testMongoDBConnection(),
		"Redis":      testRedisConnection(),
	}

	fmt.Println("\nTest Results:")
	fmt.Println("============")

	successCount := 0
	for dbType, success := range testResults {
		status := "❌ FAILED"
		if success {
			status = "✅ PASSED"
			successCount++
		}
		fmt.Printf("%-12s %s\n", dbType, status)
	}

	fmt.Printf("\nSummary: %d/%d databases connected successfully\n", successCount, len(testResults))

	if successCount == len(testResults) {
		fmt.Println("🎉 All database connections successful!")
		os.Exit(0)
	} else {
		fmt.Println("⚠️  Some database connections failed")
		os.Exit(1)
	}
}

func checkDockerContainers() bool {
	fmt.Println("Checking Docker containers...")

	containers := map[string]string{
		"PostgreSQL": "queryflux-postgres-test",
		"MySQL":      "queryflux-mysql-test",
		"MongoDB":    "queryflux-mongodb-test",
		"Redis":      "queryflux-redis-test",
	}

	allRunning := true
	for dbType, containerName := range containers {
		cmd := exec.Command("docker", "ps", "--filter", "name="+containerName, "--format", "{{.Status}}")
		output, err := cmd.Output()
		if err != nil {
			fmt.Printf("❌ %s: Failed to check container status\n", dbType)
			allRunning = false
			continue
		}

		status := string(output)
		if status == "" {
			fmt.Printf("❌ %s: Container not running\n", dbType)
			allRunning = false
		} else {
			fmt.Printf("✅ %s: %s\n", dbType, status)
		}
	}

	return allRunning
}

func testPostgreSQLConnection() bool {
	fmt.Println("\nTesting PostgreSQL connection...")

	// Wait for container to be ready
	time.Sleep(5 * time.Second)

	cmd := exec.Command("docker", "exec", "queryflux-postgres-test", "psql", "-U", "testuser", "-d", "queryflux_test", "-c", "SELECT COUNT(*) FROM users;")
	output, err := cmd.CombinedOutput()

	if err != nil {
		fmt.Printf("PostgreSQL connection failed: %v\n", err)
		return false
	}

	outputStr := string(output)
	fmt.Printf("PostgreSQL query result: %s\n", outputStr)
	return true
}

func testMySQLConnection() bool {
	fmt.Println("Testing MySQL connection...")

	// Wait for container to be ready
	time.Sleep(5 * time.Second)

	cmd := exec.Command("docker", "exec", "queryflux-mysql-test", "mysql", "-u", "testuser", "-ptestpass", "-D", "queryflux_test", "-e", "SELECT COUNT(*) FROM users;")
	output, err := cmd.CombinedOutput()

	if err != nil {
		fmt.Printf("MySQL connection failed: %v\n", err)
		return false
	}

	outputStr := string(output)
	fmt.Printf("MySQL query result: %s\n", outputStr)
	return true
}

func testMongoDBConnection() bool {
	fmt.Println("Testing MongoDB connection...")

	// Wait for container to be ready
	time.Sleep(10 * time.Second)

	cmd := exec.Command("docker", "exec", "queryflux-mongodb-test", "mongosh", "-u", "testuser", "-p", "testpass", "--authenticationDatabase", "admin", "queryflux_test", "--eval", "db.users.countDocuments()")
	output, err := cmd.CombinedOutput()

	if err != nil {
		fmt.Printf("MongoDB connection failed: %v\n", err)
		return false
	}

	outputStr := string(output)
	fmt.Printf("MongoDB query result: %s\n", outputStr)
	return true
}

func testRedisConnection() bool {
	fmt.Println("Testing Redis connection...")

	// Wait for container to be ready
	time.Sleep(5 * time.Second)

	cmd := exec.Command("docker", "exec", "queryflux-redis-test", "redis-cli", "ping")
	output, err := cmd.CombinedOutput()

	if err != nil {
		fmt.Printf("Redis connection failed: %v\n", err)
		return false
	}

	outputStr := string(output)
	if outputStr == "PONG\n" {
		fmt.Printf("Redis connection result: PONG ✅\n")
		return true
	}

	fmt.Printf("Redis connection result: %s\n", outputStr)
	return false
}