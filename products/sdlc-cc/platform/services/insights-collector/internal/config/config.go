package config

import "os"

type Config struct {
	NATSURL     string
	DatabaseURL string
	DLPEndpoint string
	ServiceName string
}

func Load() (*Config, error) {
	return &Config{
		NATSURL:     getenv("NATS_URL", "nats://localhost:4222"),
		DatabaseURL: getenv("DATABASE_URL", ""),
		DLPEndpoint: getenv("DLP_ENDPOINT", "http://dlp:8080"),
		ServiceName: getenv("SERVICE_NAME", "insights-collector"),
	}, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
