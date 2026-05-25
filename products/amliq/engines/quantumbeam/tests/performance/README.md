# QuantumBeam Performance Testing Suite

This directory contains a comprehensive performance testing suite for the QuantumBeam fraud detection platform. The suite is designed to test various aspects of system performance under different load conditions.

## Overview

The performance testing suite includes:

- **Load Testing**: Tests system performance under expected normal load
- **Stress Testing**: Tests system behavior under extreme load conditions
- **Spike Testing**: Tests system response to sudden traffic spikes
- **Endurance Testing**: Tests system stability over extended periods
- **Capacity Testing**: Determines maximum system capacity
- **Volume Testing**: Tests system performance with large data volumes

## Features

- **Concurrent User Simulation**: Simulate multiple users accessing the system simultaneously
- **Realistic Request Patterns**: Weighted scenarios that reflect real-world usage
- **Comprehensive Metrics**: Response time, throughput, error rates, resource usage
- **Resource Monitoring**: CPU, memory, database, and cache performance monitoring
- **Assertion Validation**: Automated response validation and business rule checking
- **Multiple Output Formats**: JSON, CSV, and HTML reports
- **Automated Reporting**: Detailed performance reports with charts and analysis

## Quick Start

### Prerequisites

- Go 1.21 or higher
- PostgreSQL (for database monitoring)
- Redis (for cache monitoring)
- Running QuantumBeam application

### Running Tests

1. **Smoke Test** (Quick health check):
   ```bash
   ./tests/performance/scripts/run-performance-tests.sh -t smoke
   ```

2. **Load Test** (Normal usage):
   ```bash
   ./tests/performance/scripts/run-performance-tests.sh -t load -c 20 -d 10m
   ```

3. **Stress Test** (High load):
   ```bash
   ./tests/performance/scripts/run-performance-tests.sh -t stress -c 100 -d 15m --enable-profiling
   ```

4. **All Tests** (Complete test suite):
   ```bash
   ./tests/performance/scripts/run-performance-tests.sh -t all
   ```

### Command Line Options

```bash
Usage: ./tests/performance/scripts/run-performance-tests.sh [OPTIONS]

OPTIONS:
    -e, --environment ENVIRONMENT    Target environment (development, staging, production)
    -t, --test-type TYPE             Test type (smoke, load, stress, spike, endurance, capacity, volume, all)
    -u, --url URL                    Target URL
    -c, --concurrent-users NUM       Number of concurrent users
    -d, --duration DURATION          Test duration (e.g., 5m, 1h)
    --enable-profiling               Enable runtime profiling
    --verbose                        Enable verbose logging
    -f, --format FORMAT              Output format (json, csv, html)
    --reports-dir DIRECTORY          Reports directory
    --skip-build                     Skip application build
    --skip-infra-check              Skip infrastructure health check
    --dry-run                        Perform a dry run without executing tests
    -h, --help                       Show help message
```

## Test Scenarios

### Default Scenarios

The suite includes several pre-defined test scenarios that cover typical QuantumBeam usage patterns:

1. **Health Check**: Basic system health verification
2. **User Authentication**: Login and token management
3. **Transaction Analysis**: AI-powered fraud detection analysis
4. **Transaction History**: Historical data retrieval
5. **User Profile**: User data management
6. **API Key Management**: API key generation and management

### Scenario Configuration

Each scenario includes:

- **Weight**: Relative frequency in the test mix
- **Requests**: HTTP requests with method, path, headers, and body
- **Assertions**: Response validation rules
- **Expected Results**: Performance targets and thresholds
- **Retry Policy**: Error handling and retry logic

## Configuration

### Main Configuration File

The main configuration is in `tests/performance/config.yaml`:

```yaml
# General settings
concurrent_users: 10
test_duration: 5m
ramp_up_period: 30s
cool_down_period: 30s

# Request settings
requests_per_second: 100
timeout: 30s
retry_attempts: 3

# Monitoring settings
enable_profiling: true
enable_db_monitoring: true
enable_cache_monitoring: true

# Output settings
output_format: "json"
report_directory: "./reports"
```

### Environment-Specific Configurations

Different environments can be configured:

```bash
# Development environment
./tests/performance/scripts/run-performance-tests.sh -e development -t load

# Staging environment
./tests/performance/scripts/run-performance-tests.sh -e staging -t load -u https://staging.quantumbeam.io

# Production environment (with caution)
./tests/performance/scripts/run-performance-tests.sh -e production -t smoke -u https://api.quantumbeam.io
```

## Test Types

### Smoke Test
- **Purpose**: Quick health check
- **Users**: 1-2
- **Duration**: 1-2 minutes
- **Focus**: Basic functionality verification

### Load Test
- **Purpose**: Normal usage simulation
- **Users**: 20-50
- **Duration**: 10-30 minutes
- **Focus**: Performance under expected load

### Stress Test
- **Purpose**: Extreme load conditions
- **Users**: 100-200
- **Duration**: 15-30 minutes
- **Focus**: System limits and breaking points

### Spike Test
- **Purpose**: Sudden traffic spikes
- **Users**: 50-100 with 3-5x spikes
- **Duration**: 8-10 minutes
- **Focus**: System response to traffic bursts

### Endurance Test
- **Purpose**: Long-term stability
- **Users**: 10-20
- **Duration**: 2-8 hours
- **Focus**: Memory leaks and performance degradation

### Capacity Test
- **Purpose**: Maximum capacity determination
- **Users**: 200-500
- **Duration**: 20-40 minutes
- **Focus**: System maximum throughput

### Volume Test
- **Purpose**: Large data handling
- **Users**: 5-10
- **Duration**: 15-30 minutes
- **Focus**: Performance with large datasets

## Metrics and Monitoring

### Performance Metrics

- **Response Time**: Average, min, max, percentiles (50th, 95th, 99th)
- **Throughput**: Requests per second (RPS)
- **Success Rate**: Percentage of successful requests
- **Error Rate**: Percentage of failed requests
- **Connection Metrics**: Active connections, connection pool usage

### Resource Metrics

- **CPU Usage**: System and process CPU utilization
- **Memory Usage**: Heap, stack, and system memory
- **Garbage Collection**: GC frequency and pause times
- **Database Metrics**: Connection usage, query performance
- **Cache Metrics**: Hit rates, response times, memory usage

### Error Analysis

- **Error Types**: Categorized error counts
- **Error Trends**: Error rates over time
- **Error Samples**: Detailed error information
- **Endpoint Analysis**: Error rates by endpoint

## Reports

### Report Formats

- **JSON**: Machine-readable detailed data
- **HTML**: Visual reports with charts and graphs
- **CSV**: Spreadsheet-compatible data

### Report Contents

- **Test Summary**: Overall test results and statistics
- **Request Metrics**: Detailed performance data per endpoint
- **Resource Usage**: System resource consumption over time
- **Error Analysis**: Comprehensive error breakdown
- **Timeline Data**: Time-series performance data
- **Recommendations**: Performance optimization suggestions

### Report Location

Reports are saved to `./reports/performance/` by default, organized by timestamp:

```
./reports/performance/20231015_143022/
├── config_smoke.yaml
├── smoke_output.log
├── smoke_summary.json
└── smoke_report.html
```

## Running Tests Programmatically

### Go Test Integration

```go
package main

import (
    "log"
    "time"

    "your-project/tests/performance"
    "go.uber.org/zap"
)

func main() {
    // Load configuration
    config, err := performance.LoadBenchmarkConfig("tests/performance/config.yaml")
    if err != nil {
        log.Fatal(err)
    }

    // Create logger
    logger, _ := zap.NewProduction()
    defer logger.Sync()

    // Setup infrastructure
    db, redis, err := setupTestInfrastructure()
    if err != nil {
        log.Fatal(err)
    }
    defer cleanupTestInfrastructure(db, redis)

    // Create benchmark engine
    engine := performance.NewBenchmarkEngine(config, logger, db, redis)

    // Run benchmark
    result, err := engine.RunBenchmark("custom-test", performance.GetDefaultScenarios())
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Test completed: %+v", result.Metrics.Summary)
}
```

### Custom Scenarios

```go
// Create custom test scenario
customScenario := performance.LoadTestScenario{
    Name:        "Custom API Test",
    Description: "Testing custom endpoint",
    Weight:      100,
    Requests: []performance.RequestDefinition{
        {
            Method:  "POST",
            Path:    "/api/v1/custom/endpoint",
            Headers: map[string]string{
                "Content-Type":  "application/json",
                "Authorization": "Bearer test-token",
            },
            Body: map[string]interface{}{
                "param1": "value1",
                "param2": 123,
            },
            Timeout: 30 * time.Second,
            Weight:  100,
            Assertions: []performance.Assertion{
                {
                    Type:     "status_code",
                    Value:    200,
                    Operator: "equals",
                },
            },
        },
    },
}

// Run test with custom scenario
scenarios := []performance.LoadTestScenario{customScenario}
result, err := engine.RunBenchmark("custom-test", scenarios)
```

## Best Practices

### Test Planning

1. **Define Objectives**: Clearly define what you want to test and measure
2. **Establish Baselines**: Know your current performance metrics
3. **Set Realistic Targets**: Set achievable performance goals
4. **Test Incrementally**: Start with small tests and gradually increase complexity

### Test Execution

1. **Warm-up Period**: Allow the system to warm up before collecting metrics
2. **Stable Environment**: Ensure consistent testing environment
3. **Isolation**: Run tests in isolation to avoid interference
4. **Multiple Runs**: Run tests multiple times for consistent results

### Result Analysis

1. **Compare Baselines**: Compare results against established baselines
2. **Identify Bottlenecks**: Look for performance bottlenecks and issues
3. **Trend Analysis**: Monitor performance trends over time
4. **Actionable Insights**: Focus on actionable performance improvements

## Troubleshooting

### Common Issues

1. **Connection Timeouts**: Increase timeout values or check network connectivity
2. **High Error Rates**: Verify target application is running and healthy
3. **Resource Exhaustion**: Monitor system resources and adjust concurrent user count
4. **Test Failures**: Check logs for detailed error information

### Debug Mode

Enable verbose logging for detailed debugging:

```bash
./tests/performance/scripts/run-performance-tests.sh --verbose -t smoke
```

### Dry Run Mode

Test configuration without executing actual tests:

```bash
./tests/performance/scripts/run-performance-tests.sh --dry-run -t load
```

## Integration with CI/CD

### GitHub Actions

```yaml
name: Performance Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  performance-test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Set up Go
      uses: actions/setup-go@v3
      with:
        go-version: 1.21

    - name: Start Application
      run: |
        go build -o bin/quantumbeam ./cmd/api-server
        ./bin/quantumbeam &
        sleep 30

    - name: Run Performance Tests
      run: |
        ./tests/performance/scripts/run-performance-tests.sh \
          -t smoke \
          --skip-build \
          --skip-infra-check

    - name: Upload Reports
      uses: actions/upload-artifact@v3
      with:
        name: performance-reports
        path: reports/performance/
```

## Contributing

When adding new test scenarios or modifying existing ones:

1. **Update Documentation**: Keep README and documentation up to date
2. **Add Tests**: Include unit tests for new functionality
3. **Validate Configuration**: Ensure configuration is valid
4. **Test Locally**: Verify changes work before submitting

## Support

For questions or issues:

1. Check the logs in the test output files
2. Review the configuration files
3. Consult the troubleshooting section
4. Check the application logs for performance issues

---

**Note**: Performance testing can put significant load on your system. Always run tests against appropriate environments and monitor system resources during test execution.