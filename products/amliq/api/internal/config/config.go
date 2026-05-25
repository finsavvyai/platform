package config

type ServerConfig struct {
	Port int
	Host string
}

type DatabaseConfig struct {
	URL     string
	ReadURL string // Read replica URL (falls back to URL if empty)
}

type RedisConfig struct {
	URL      string
	PoolSize int
}

type PoolConfig struct {
	MaxConns int
	MinConns int
}

type AuthConfig struct {
	TokenSecret string
	TokenExpiry int
}

type EmbeddingConfig struct {
	APIKey  string
	BaseURL string
	Model   string
}

type ScalingConfig struct {
	Workers    int
	QueueDepth int
}

type Config struct {
	Server    ServerConfig
	Database  DatabaseConfig
	Redis     RedisConfig
	Pool      PoolConfig
	Auth      AuthConfig
	Embedding EmbeddingConfig
	Scaling   ScalingConfig
}

func Default() Config {
	return Config{
		Server: ServerConfig{
			Port: 8080,
			Host: "0.0.0.0",
		},
		Database: DatabaseConfig{
			URL: "postgres://localhost/aegis",
		},
		Redis: RedisConfig{
			URL:      "redis://localhost:6379",
			PoolSize: 100,
		},
		Pool: PoolConfig{
			MaxConns: 25,
			MinConns: 5,
		},
		Auth: AuthConfig{
			TokenExpiry: 3600,
		},
		Embedding: EmbeddingConfig{
			BaseURL: "https://api.openai.com/v1",
			Model:   "text-embedding-3-small",
		},
		Scaling: ScalingConfig{
			Workers:    100,
			QueueDepth: 10000,
		},
	}
}
