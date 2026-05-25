package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"strconv"
)

func Load() Config {
	cfg := Default()

	if port := os.Getenv("PORT"); port != "" {
		if p, err := strconv.Atoi(port); err == nil {
			cfg.Server.Port = p
		}
	}

	if host := os.Getenv("HOST"); host != "" {
		cfg.Server.Host = host
	}

	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		cfg.Database.URL = dbURL
	}

	if readURL := os.Getenv("DATABASE_READ_URL"); readURL != "" {
		cfg.Database.ReadURL = readURL
	}

	if redisURL := os.Getenv("REDIS_URL"); redisURL != "" {
		cfg.Redis.URL = redisURL
	}
	if poolSize := os.Getenv("REDIS_POOL_SIZE"); poolSize != "" {
		if n, err := strconv.Atoi(poolSize); err == nil {
			cfg.Redis.PoolSize = n
		}
	}

	if maxConns := os.Getenv("PG_MAX_CONNS"); maxConns != "" {
		if n, err := strconv.Atoi(maxConns); err == nil {
			cfg.Pool.MaxConns = n
		}
	}
	if minConns := os.Getenv("PG_MIN_CONNS"); minConns != "" {
		if n, err := strconv.Atoi(minConns); err == nil {
			cfg.Pool.MinConns = n
		}
	}

	if secret := os.Getenv("TOKEN_SECRET"); secret != "" {
		cfg.Auth.TokenSecret = secret
	} else {
		log.Println("WARNING: TOKEN_SECRET not set, generating random secret")
		s, err := randomSecret()
		if err != nil {
			// crypto/rand.Read failing is an environmental disaster
			// (no /dev/urandom, no OS RNG); caller cannot recover. Log
			// clearly and use a deterministic fallback that will force
			// token-validation mismatches on any clone — safer than
			// silently accepting an empty secret.
			log.Printf("ERROR: %v; TOKEN_SECRET *must* be set", err)
			cfg.Auth.TokenSecret = "CHANGE_ME_RANDOM_SOURCE_UNAVAILABLE"
		} else {
			cfg.Auth.TokenSecret = s
		}
	}

	if expiry := os.Getenv("TOKEN_EXPIRY"); expiry != "" {
		if e, err := strconv.Atoi(expiry); err == nil {
			cfg.Auth.TokenExpiry = e
		}
	}

	if key := os.Getenv("EMBEDDING_API_KEY"); key != "" {
		cfg.Embedding.APIKey = key
	}
	if url := os.Getenv("EMBEDDING_API_URL"); url != "" {
		cfg.Embedding.BaseURL = url
	}
	if model := os.Getenv("EMBEDDING_MODEL"); model != "" {
		cfg.Embedding.Model = model
	}

	if workers := os.Getenv("WORKERS"); workers != "" {
		if n, err := strconv.Atoi(workers); err == nil {
			cfg.Scaling.Workers = n
		}
	}
	if depth := os.Getenv("QUEUE_DEPTH"); depth != "" {
		if n, err := strconv.Atoi(depth); err == nil {
			cfg.Scaling.QueueDepth = n
		}
	}

	return cfg
}

func randomSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("random secret: %w", err)
	}
	return hex.EncodeToString(b), nil
}
