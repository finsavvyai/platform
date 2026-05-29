//go:build legacy_migrated
// +build legacy_migrated

package performance

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

// LoadBenchmarkConfig loads benchmark configuration from file
func LoadBenchmarkConfig(configPath string) (*BenchmarkConfig, error) {
	// Set defaults
	config := &BenchmarkConfig{
		ConcurrentUsers:       10,
		TestDuration:          5 * time.Minute,
		RampUpPeriod:          30 * time.Second,
		CooldownPeriod:        30 * time.Second,
		RequestsPerSecond:     100,
		Timeout:               30 * time.Second,
		RetryAttempts:         3,
		EnableSpikeLoad:       false,
		SpikeMultiplier:       2.0,
		SpikeDuration:         2 * time.Minute,
		EnableProfiling:       true,
		MemoryProfileInterval: 30 * time.Second,
		CPUProfileInterval:    30 * time.Second,
		EnableVerboseLogging:  false,
		OutputFormat:          "json",
		ReportDirectory:       "./reports",
		EnableDBMonitoring:    true,
		DBMetricsInterval:     10 * time.Second,
		EnableCacheMonitoring: true,
		CacheMetricsInterval:  10 * time.Second,
	}

	// Load from file if exists
	if configPath != "" {
		data, err := os.ReadFile(configPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}

		if err := yaml.Unmarshal(data, config); err != nil {
			return nil, fmt.Errorf("failed to parse config file: %w", err)
		}
	}

	// Validate configuration
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return config, nil
}

// Validate validates the benchmark configuration
func (c *BenchmarkConfig) Validate() error {
	if c.ConcurrentUsers < 1 || c.ConcurrentUsers > 1000 {
		return fmt.Errorf("concurrent_users must be between 1 and 1000")
	}

	if c.TestDuration < time.Minute {
		return fmt.Errorf("test_duration must be at least 1 minute")
	}

	if c.RequestsPerSecond < 1 {
		return fmt.Errorf("requests_per_second must be at least 1")
	}

	if c.Timeout < time.Second {
		return fmt.Errorf("timeout must be at least 1 second")
	}

	if c.RetryAttempts < 0 || c.RetryAttempts > 5 {
		return fmt.Errorf("retry_attempts must be between 0 and 5")
	}

	if c.EnableSpikeLoad {
		if c.SpikeMultiplier < 1.0 || c.SpikeMultiplier > 10.0 {
			return fmt.Errorf("spike_multiplier must be between 1.0 and 10.0")
		}
		if c.SpikeDuration < time.Second {
			return fmt.Errorf("spike_duration must be at least 1 second")
		}
	}

	if c.OutputFormat != "json" && c.OutputFormat != "csv" && c.OutputFormat != "html" {
		return fmt.Errorf("output_format must be one of: json, csv, html")
	}

	if c.ReportDirectory == "" {
		return fmt.Errorf("report_directory cannot be empty")
	}

	return nil
}

// GetLoadTestConfig returns configuration for different types of load tests
func GetLoadTestConfig(testType string) *BenchmarkConfig {
	baseConfig := &BenchmarkConfig{
		EnableProfiling:       true,
		MemoryProfileInterval: 30 * time.Second,
		CPUProfileInterval:    30 * time.Second,
		EnableVerboseLogging:  false,
		OutputFormat:          "json",
		ReportDirectory:       "./reports",
		EnableDBMonitoring:    true,
		DBMetricsInterval:     10 * time.Second,
		EnableCacheMonitoring: true,
		CacheMetricsInterval:  10 * time.Second,
		RetryAttempts:         3,
		CooldownPeriod:        30 * time.Second,
	}

	switch testType {
	case "smoke":
		return &BenchmarkConfig{
			ConcurrentUsers:   1,
			TestDuration:      1 * time.Minute,
			RampUpPeriod:      5 * time.Second,
			RequestsPerSecond: 10,
			Timeout:           10 * time.Second,
			EnableSpikeLoad:   false,
		}
	case "load":
		return &BenchmarkConfig{
			ConcurrentUsers:   50,
			TestDuration:      10 * time.Minute,
			RampUpPeriod:      2 * time.Minute,
			RequestsPerSecond: 100,
			Timeout:           30 * time.Second,
			EnableSpikeLoad:   false,
		}
	case "stress":
		return &BenchmarkConfig{
			ConcurrentUsers:   200,
			TestDuration:      15 * time.Minute,
			RampUpPeriod:      5 * time.Minute,
			RequestsPerSecond: 500,
			Timeout:           60 * time.Second,
			EnableSpikeLoad:   true,
			SpikeMultiplier:   3.0,
			SpikeDuration:     3 * time.Minute,
		}
	case "spike":
		return &BenchmarkConfig{
			ConcurrentUsers:   100,
			TestDuration:      10 * time.Minute,
			RampUpPeriod:      1 * time.Minute,
			RequestsPerSecond: 200,
			Timeout:           45 * time.Second,
			EnableSpikeLoad:   true,
			SpikeMultiplier:   5.0,
			SpikeDuration:     2 * time.Minute,
		}
	case "endurance":
		return &BenchmarkConfig{
			ConcurrentUsers:   20,
			TestDuration:      2 * time.Hour,
			RampUpPeriod:      5 * time.Minute,
			RequestsPerSecond: 50,
			Timeout:           30 * time.Second,
			EnableSpikeLoad:   false,
		}
	case "capacity":
		return &BenchmarkConfig{
			ConcurrentUsers:   500,
			TestDuration:      30 * time.Minute,
			RampUpPeriod:      10 * time.Minute,
			RequestsPerSecond: 1000,
			Timeout:           120 * time.Second,
			EnableSpikeLoad:   false,
		}
	case "volume":
		return &BenchmarkConfig{
			ConcurrentUsers:   10,
			TestDuration:      30 * time.Minute,
			RampUpPeriod:      1 * time.Minute,
			RequestsPerSecond: 20,
			Timeout:           60 * time.Second,
			EnableSpikeLoad:   false,
		}
	default:
		// Return a reasonable default
		return &BenchmarkConfig{
			ConcurrentUsers:   10,
			TestDuration:      5 * time.Minute,
			RampUpPeriod:      30 * time.Second,
			RequestsPerSecond: 100,
			Timeout:           30 * time.Second,
			EnableSpikeLoad:   false,
		}
	}
}

// MergeWith merges this config with another, taking values from other when set
func (c *BenchmarkConfig) MergeWith(other *BenchmarkConfig) *BenchmarkConfig {
	if other == nil {
		return c
	}

	merged := *c

	if other.ConcurrentUsers != 0 {
		merged.ConcurrentUsers = other.ConcurrentUsers
	}
	if other.TestDuration != 0 {
		merged.TestDuration = other.TestDuration
	}
	if other.RampUpPeriod != 0 {
		merged.RampUpPeriod = other.RampUpPeriod
	}
	if other.CooldownPeriod != 0 {
		merged.CooldownPeriod = other.CooldownPeriod
	}
	if other.RequestsPerSecond != 0 {
		merged.RequestsPerSecond = other.RequestsPerSecond
	}
	if other.Timeout != 0 {
		merged.Timeout = other.Timeout
	}
	if other.RetryAttempts != 0 {
		merged.RetryAttempts = other.RetryAttempts
	}
	if other.EnableSpikeLoad {
		merged.EnableSpikeLoad = other.EnableSpikeLoad
	}
	if other.SpikeMultiplier != 0 {
		merged.SpikeMultiplier = other.SpikeMultiplier
	}
	if other.SpikeDuration != 0 {
		merged.SpikeDuration = other.SpikeDuration
	}
	if other.EnableProfiling {
		merged.EnableProfiling = other.EnableProfiling
	}
	if other.MemoryProfileInterval != 0 {
		merged.MemoryProfileInterval = other.MemoryProfileInterval
	}
	if other.CPUProfileInterval != 0 {
		merged.CPUProfileInterval = other.CPUProfileInterval
	}
	if other.EnableVerboseLogging {
		merged.EnableVerboseLogging = other.EnableVerboseLogging
	}
	if other.OutputFormat != "" {
		merged.OutputFormat = other.OutputFormat
	}
	if other.ReportDirectory != "" {
		merged.ReportDirectory = other.ReportDirectory
	}
	if other.EnableDBMonitoring {
		merged.EnableDBMonitoring = other.EnableDBMonitoring
	}
	if other.DBMetricsInterval != 0 {
		merged.DBMetricsInterval = other.DBMetricsInterval
	}
	if other.EnableCacheMonitoring {
		merged.EnableCacheMonitoring = other.EnableCacheMonitoring
	}
	if other.CacheMetricsInterval != 0 {
		merged.CacheMetricsInterval = other.CacheMetricsInterval
	}

	return &merged
}

// ToYAML converts the config to YAML string
func (c *BenchmarkConfig) ToYAML() ([]byte, error) {
	return yaml.Marshal(c)
}

// SaveToFile saves the config to a file
func (c *BenchmarkConfig) SaveToFile(filepath string) error {
	data, err := c.ToYAML()
	if err != nil {
		return err
	}

	return os.WriteFile(filepath, data, 0644)
}

// GetTestConfigurations returns predefined test configurations
func GetTestConfigurations() map[string]*BenchmarkConfig {
	return map[string]*BenchmarkConfig{
		"development": {
			ConcurrentUsers:       5,
			TestDuration:          2 * time.Minute,
			RampUpPeriod:          15 * time.Second,
			CooldownPeriod:        15 * time.Second,
			RequestsPerSecond:     20,
			Timeout:               15 * time.Second,
			RetryAttempts:         2,
			EnableSpikeLoad:       false,
			EnableProfiling:       true,
			MemoryProfileInterval: 30 * time.Second,
			CPUProfileInterval:    30 * time.Second,
			EnableVerboseLogging:  true,
			OutputFormat:          "json",
			ReportDirectory:       "./reports/dev",
			EnableDBMonitoring:    true,
			DBMetricsInterval:     15 * time.Second,
			EnableCacheMonitoring: true,
			CacheMetricsInterval:  15 * time.Second,
		},
		"staging": {
			ConcurrentUsers:       25,
			TestDuration:          10 * time.Minute,
			RampUpPeriod:          2 * time.Minute,
			CooldownPeriod:        1 * time.Minute,
			RequestsPerSecond:     100,
			Timeout:               30 * time.Second,
			RetryAttempts:         3,
			EnableSpikeLoad:       true,
			SpikeMultiplier:       2.0,
			SpikeDuration:         2 * time.Minute,
			EnableProfiling:       true,
			MemoryProfileInterval: 30 * time.Second,
			CPUProfileInterval:    30 * time.Second,
			EnableVerboseLogging:  false,
			OutputFormat:          "json",
			ReportDirectory:       "./reports/staging",
			EnableDBMonitoring:    true,
			DBMetricsInterval:     10 * time.Second,
			EnableCacheMonitoring: true,
			CacheMetricsInterval:  10 * time.Second,
		},
		"production": {
			ConcurrentUsers:       100,
			TestDuration:          30 * time.Minute,
			RampUpPeriod:          5 * time.Minute,
			CooldownPeriod:        5 * time.Minute,
			RequestsPerSecond:     500,
			Timeout:               60 * time.Second,
			RetryAttempts:         3,
			EnableSpikeLoad:       true,
			SpikeMultiplier:       3.0,
			SpikeDuration:         5 * time.Minute,
			EnableProfiling:       false, // Disabled in production
			MemoryProfileInterval: 60 * time.Second,
			CPUProfileInterval:    60 * time.Second,
			EnableVerboseLogging:  false,
			OutputFormat:          "json",
			ReportDirectory:       "./reports/prod",
			EnableDBMonitoring:    true,
			DBMetricsInterval:     30 * time.Second,
			EnableCacheMonitoring: true,
			CacheMetricsInterval:  30 * time.Second,
		},
	}
}