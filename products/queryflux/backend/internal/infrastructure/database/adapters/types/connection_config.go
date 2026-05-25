package types

import "time"

// ConnectionConfig represents enhanced connection configuration shared by
// every adapter for pool, timeout, retry, and TLS knobs.
type ConnectionConfig struct {
	// Connection details
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	Database string `json:"database"`
	SSL      bool   `json:"ssl"`

	// Pool configuration
	MaxOpenConns    int           `json:"max_open_conns"`
	MaxIdleConns    int           `json:"max_idle_conns"`
	ConnMaxLifetime time.Duration `json:"conn_max_lifetime"`
	ConnMaxIdleTime time.Duration `json:"conn_max_idle_time"`

	// Timeouts
	ConnectTimeout time.Duration `json:"connect_timeout"`
	QueryTimeout   time.Duration `json:"query_timeout"`
	ReadTimeout    time.Duration `json:"read_timeout"`
	WriteTimeout   time.Duration `json:"write_timeout"`

	// Retry configuration
	MaxRetries   int           `json:"max_retries"`
	RetryDelay   time.Duration `json:"retry_delay"`
	RetryBackoff time.Duration `json:"retry_backoff"`

	// Health check configuration
	HealthCheckInterval time.Duration `json:"health_check_interval"`
	HealthCheckTimeout  time.Duration `json:"health_check_timeout"`

	// SSL/TLS configuration
	SSLMode     string `json:"ssl_mode"`
	SSLCert     string `json:"ssl_cert,omitempty"`
	SSLKey      string `json:"ssl_key,omitempty"`
	SSLRootCert string `json:"ssl_root_cert,omitempty"`

	// Additional options
	Options map[string]interface{} `json:"options,omitempty"`
}

// GetInt retrieves an integer value from Options or returns defaultVal.
// Handles both `int` and `float64` (JSON unmarshal) variants.
func (c *ConnectionConfig) GetInt(key string, defaultVal int) int {
	if val, ok := c.Options[key]; ok {
		if intVal, ok := val.(int); ok {
			return intVal
		}
		if floatVal, ok := val.(float64); ok {
			return int(floatVal)
		}
	}
	return defaultVal
}

// GetString retrieves a string value from Options or returns defaultVal.
func (c *ConnectionConfig) GetString(key string, defaultVal string) string {
	if val, ok := c.Options[key]; ok {
		if strVal, ok := val.(string); ok {
			return strVal
		}
	}
	return defaultVal
}

// DefaultConnectionConfig returns Phase 1 baseline connection configuration.
func DefaultConnectionConfig() ConnectionConfig {
	return ConnectionConfig{
		MaxOpenConns:        10,
		MaxIdleConns:        2,
		ConnMaxLifetime:     time.Hour,
		ConnMaxIdleTime:     time.Minute * 30,
		ConnectTimeout:      time.Second * 10,
		QueryTimeout:        time.Minute * 5,
		ReadTimeout:         time.Second * 30,
		WriteTimeout:        time.Second * 30,
		MaxRetries:          3,
		RetryDelay:          time.Second,
		RetryBackoff:        time.Second * 2,
		HealthCheckInterval: time.Second * 30,
		HealthCheckTimeout:  time.Second * 5,
		SSLMode:             "prefer",
		Options:             make(map[string]interface{}),
	}
}
