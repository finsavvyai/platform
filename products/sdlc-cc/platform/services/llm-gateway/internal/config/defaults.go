package config

import (
	"github.com/spf13/viper"
)

// setDefaults sets default configuration values
func setDefaults() {
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", 8080)
	viper.SetDefault("server.read_timeout", "30s")
	viper.SetDefault("server.write_timeout", "30s")
	viper.SetDefault("server.idle_timeout", "120s")
	viper.SetDefault("server.gin_mode", "release")

	viper.SetDefault("llm.default_provider", "openai")
	viper.SetDefault("llm.max_retries", 3)
	viper.SetDefault("llm.retry_delay", "1s")
	viper.SetDefault("llm.timeout", "60s")
	viper.SetDefault("llm.enable_failover", true)
	viper.SetDefault("llm.enable_cost_tracking", true)
	viper.SetDefault("llm.enable_validation", true)

	viper.SetDefault("llm.security.prompt_injection_detection", true)
	viper.SetDefault("llm.security.response_sanitization", true)
	viper.SetDefault("llm.security.jailbreak_protection", true)
	viper.SetDefault("llm.security.max_response_length", 4000)

	viper.SetDefault("llm.budgets.default_monthly_limit", 1000.0)
	viper.SetDefault("llm.budgets.default_daily_limit", 50.0)
	viper.SetDefault("llm.budgets.alert_threshold", 80.0)
	viper.SetDefault("llm.budgets.currency", "USD")

	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", 5432)
	viper.SetDefault("database.user", "postgres")
	viper.SetDefault("database.password", "")
	viper.SetDefault("database.dbname", "llm_gateway")
	viper.SetDefault("database.sslmode", "disable")
	viper.SetDefault("database.max_open_conns", 25)
	viper.SetDefault("database.max_idle_conns", 5)
	viper.SetDefault("database.conn_max_lifetime", "5m")

	viper.SetDefault("redis.host", "localhost")
	viper.SetDefault("redis.port", 6379)
	viper.SetDefault("redis.password", "")
	viper.SetDefault("redis.db", 0)
	viper.SetDefault("redis.pool_size", 10)

	viper.SetDefault("auth.enabled", true)
	viper.SetDefault("auth.jwt_expiry", "24h")
	viper.SetDefault("auth.auth_header", "Authorization")

	viper.SetDefault("monitoring.enabled", true)
	viper.SetDefault("monitoring.port", 9090)
	viper.SetDefault("monitoring.path", "/metrics")
	viper.SetDefault("monitoring.namespace", "llm_gateway")

	viper.SetDefault("logging.level", "info")
	viper.SetDefault("logging.format", "json")
	viper.SetDefault("logging.output", "stdout")
}
