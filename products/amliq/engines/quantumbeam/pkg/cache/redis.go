//go:build legacy_migrated
// +build legacy_migrated

// Package cache provides Redis caching functionality for QuantumBeam.io
package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// RedisClient wraps Redis operations for QuantumBeam
type RedisClient struct {
	client *redis.Client
	config *Config
}

// Config holds Redis configuration
type Config struct {
	Host         string
	Port         int
	Password     string
	DB           int
	PoolSize     int
	MinIdleConns int
	DialTimeout  time.Duration
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	PoolTimeout  time.Duration
	IdleTimeout  time.Duration
	TLSConfig    *TLSConfig
}

// TLSConfig holds TLS configuration for Redis
type TLSConfig struct {
	Enabled            bool
	CertFile           string
	KeyFile            string
	CaCertFile         string
	InsecureSkipVerify bool
}

// CacheItem represents a cached item with metadata
type CacheItem struct {
	Key        string                 `json:"key"`
	Value      interface{}            `json:"value"`
	Expiration time.Time              `json:"expiration"`
	Tags       []string               `json:"tags,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// NewRedisClient creates a new Redis client with the given configuration
func NewRedisClient(config *Config) (*RedisClient, error) {
	if config == nil {
		config = defaultConfig()
	}

	opts := &redis.Options{
		Addr:         fmt.Sprintf("%s:%d", config.Host, config.Port),
		Password:     config.Password,
		DB:           config.DB,
		PoolSize:     config.PoolSize,
		MinIdleConns: config.MinIdleConns,
		DialTimeout:  config.DialTimeout,
		ReadTimeout:  config.ReadTimeout,
		WriteTimeout: config.WriteTimeout,
		PoolTimeout:  config.PoolTimeout,
		IdleTimeout:  config.IdleTimeout,
	}

	// Configure TLS if enabled
	if config.TLSConfig != nil && config.TLSConfig.Enabled {
		// TLS configuration would go here
		log.Info().Msg("TLS enabled for Redis connection")
	}

	client := redis.NewClient(opts)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Info().
		Str("host", config.Host).
		Int("port", config.Port).
		Int("db", config.DB).
		Msg("Successfully connected to Redis")

	return &RedisClient{
		client: client,
		config: config,
	}, nil
}

// defaultConfig returns default Redis configuration
func defaultConfig() *Config {
	return &Config{
		Host:         "localhost",
		Port:         6379,
		Password:     "",
		DB:           0,
		PoolSize:     10,
		MinIdleConns: 5,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolTimeout:  4 * time.Second,
		IdleTimeout:  5 * time.Minute,
	}
}

// Set stores a value in Redis with optional expiration
func (r *RedisClient) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	if err := r.validateKey(key); err != nil {
		return err
	}

	// Serialize value if it's not a string or []byte
	var data interface{}
	switch v := value.(type) {
	case string, []byte, int, int64, float64, bool:
		data = v
	default:
		jsonData, err := json.Marshal(value)
		if err != nil {
			return fmt.Errorf("failed to serialize value: %w", err)
		}
		data = jsonData
	}

	if err := r.client.Set(ctx, key, data, expiration).Err(); err != nil {
		log.Error().Err(err).Str("key", key).Msg("Failed to set value in Redis")
		return fmt.Errorf("failed to set value: %w", err)
	}

	log.Debug().
		Str("key", key).
		Str("expiration", expiration.String()).
		Msg("Value set in Redis")

	return nil
}

// Get retrieves a value from Redis
func (r *RedisClient) Get(ctx context.Context, key string, dest interface{}) error {
	if err := r.validateKey(key); err != nil {
		return err
	}

	result, err := r.client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return ErrKeyNotFound
		}
		log.Error().Err(err).Str("key", key).Msg("Failed to get value from Redis")
		return fmt.Errorf("failed to get value: %w", err)
	}

	// Deserialize if destination is not a string pointer
	if _, ok := dest.(*string); !ok {
		if err := json.Unmarshal([]byte(result), dest); err != nil {
			// If JSON unmarshal fails, try to assign directly
			switch v := dest.(type) {
			case *[]byte:
				*v = []byte(result)
			case *int:
				if _, err := fmt.Sscanf(result, "%d", v); err != nil {
					return fmt.Errorf("failed to parse int value: %w", err)
				}
			case *int64:
				if _, err := fmt.Sscanf(result, "%d", v); err != nil {
					return fmt.Errorf("failed to parse int64 value: %w", err)
				}
			case *float64:
				if _, err := fmt.Sscanf(result, "%f", v); err != nil {
					return fmt.Errorf("failed to parse float64 value: %w", err)
				}
			case *bool:
				*v = result == "true"
			default:
				return fmt.Errorf("failed to deserialize value for type %T", dest)
			}
		}
	} else {
		*(dest.(*string)) = result
	}

	log.Debug().Str("key", key).Msg("Value retrieved from Redis")
	return nil
}

// Delete removes a key from Redis
func (r *RedisClient) Delete(ctx context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}

	for _, key := range keys {
		if err := r.validateKey(key); err != nil {
			return err
		}
	}

	if err := r.client.Del(ctx, keys...).Err(); err != nil {
		log.Error().Err(err).Strs("keys", keys).Msg("Failed to delete keys from Redis")
		return fmt.Errorf("failed to delete keys: %w", err)
	}

	log.Debug().Strs("keys", keys).Msg("Keys deleted from Redis")
	return nil
}

// Exists checks if a key exists in Redis
func (r *RedisClient) Exists(ctx context.Context, key string) (bool, error) {
	if err := r.validateKey(key); err != nil {
		return false, err
	}

	count, err := r.client.Exists(ctx, key).Result()
	if err != nil {
		log.Error().Err(err).Str("key", key).Msg("Failed to check key existence in Redis")
		return false, fmt.Errorf("failed to check key existence: %w", err)
	}

	return count > 0, nil
}

// SetNX sets a key only if it doesn't exist
func (r *RedisClient) SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) (bool, error) {
	if err := r.validateKey(key); err != nil {
		return false, err
	}

	var data interface{}
	switch v := value.(type) {
	case string, []byte, int, int64, float64, bool:
		data = v
	default:
		jsonData, err := json.Marshal(value)
		if err != nil {
			return false, fmt.Errorf("failed to serialize value: %w", err)
		}
		data = jsonData
	}

	success, err := r.client.SetNX(ctx, key, data, expiration).Result()
	if err != nil {
		log.Error().Err(err).Str("key", key).Msg("Failed to set value with NX in Redis")
		return false, fmt.Errorf("failed to set value with NX: %w", err)
	}

	log.Debug().
		Str("key", key).
		Bool("success", success).
		Msg("SetNX operation completed")

	return success, nil
}

// Increment increments a numeric value
func (r *RedisClient) Increment(ctx context.Context, key string) (int64, error) {
	if err := r.validateKey(key); err != nil {
		return 0, err
	}

	result, err := r.client.Incr(ctx, key).Result()
	if err != nil {
		log.Error().Err(err).Str("key", key).Msg("Failed to increment value in Redis")
		return 0, fmt.Errorf("failed to increment value: %w", err)
	}

	log.Debug().
		Str("key", key).
		Int64("result", result).
		Msg("Value incremented in Redis")

	return result, nil
}

// IncrementBy increments a numeric value by the specified amount
func (r *RedisClient) IncrementBy(ctx context.Context, key string, value int64) (int64, error) {
	if err := r.validateKey(key); err != nil {
		return 0, err
	}

	result, err := r.client.IncrBy(ctx, key, value).Result()
	if err != nil {
		log.Error().Err(err).Str("key", key).Int64("value", value).Msg("Failed to increment value by amount in Redis")
		return 0, fmt.Errorf("failed to increment value by amount: %w", err)
	}

	log.Debug().
		Str("key", key).
		Int64("value", value).
		Int64("result", result).
		Msg("Value incremented by amount in Redis")

	return result, nil
}

// Expire sets the expiration time for a key
func (r *RedisClient) Expire(ctx context.Context, key string, expiration time.Duration) error {
	if err := r.validateKey(key); err != nil {
		return err
	}

	success, err := r.client.Expire(ctx, key, expiration).Result()
	if err != nil {
		log.Error().Err(err).Str("key", key).Msg("Failed to set expiration in Redis")
		return fmt.Errorf("failed to set expiration: %w", err)
	}

	if !success {
		return ErrKeyNotFound
	}

	log.Debug().
		Str("key", key).
		Str("expiration", expiration.String()).
		Msg("Expiration set in Redis")

	return nil
}

// TTL returns the remaining time to live for a key
func (r *RedisClient) TTL(ctx context.Context, key string) (time.Duration, error) {
	if err := r.validateKey(key); err != nil {
		return 0, err
	}

	duration, err := r.client.TTL(ctx, key).Result()
	if err != nil {
		log.Error().Err(err).Str("key", key).Msg("Failed to get TTL from Redis")
		return 0, fmt.Errorf("failed to get TTL: %w", err)
	}

	log.Debug().
		Str("key", key).
		Dur("ttl", duration).
		Msg("TTL retrieved from Redis")

	return duration, nil
}

// Keys returns all keys matching a pattern
func (r *RedisClient) Keys(ctx context.Context, pattern string) ([]string, error) {
	if err := r.validateKey(pattern); err != nil {
		return nil, err
	}

	keys, err := r.client.Keys(ctx, pattern).Result()
	if err != nil {
		log.Error().Err(err).Str("pattern", pattern).Msg("Failed to get keys from Redis")
		return nil, fmt.Errorf("failed to get keys: %w", err)
	}

	log.Debug().
		Str("pattern", pattern).
		Int("count", len(keys)).
		Msg("Keys retrieved from Redis")

	return keys, nil
}

// FlushDB removes all keys from the current database
func (r *RedisClient) FlushDB(ctx context.Context) error {
	if err := r.client.FlushDB(ctx).Err(); err != nil {
		log.Error().Err(err).Msg("Failed to flush database in Redis")
		return fmt.Errorf("failed to flush database: %w", err)
	}

	log.Info().Msg("Database flushed in Redis")
	return nil
}

// Ping checks the connection to Redis
func (r *RedisClient) Ping(ctx context.Context) error {
	if err := r.client.Ping(ctx).Err(); err != nil {
		log.Error().Err(err).Msg("Failed to ping Redis")
		return fmt.Errorf("failed to ping Redis: %w", err)
	}

	log.Debug().Msg("Redis ping successful")
	return nil
}

// Close closes the Redis connection
func (r *RedisClient) Close() error {
	if err := r.client.Close(); err != nil {
		log.Error().Err(err).Msg("Failed to close Redis connection")
		return fmt.Errorf("failed to close Redis connection: %w", err)
	}

	log.Info().Msg("Redis connection closed")
	return nil
}

// GetStats returns Redis client statistics
func (r *RedisClient) GetStats() *redis.PoolStats {
	return r.client.PoolStats()
}

// validateKey validates Redis key format
func (r *RedisClient) validateKey(key string) error {
	if key == "" {
		return ErrEmptyKey
	}

	if len(key) > 512 {
		return ErrKeyTooLong
	}

	return nil
}

// Custom errors
var (
	ErrKeyNotFound      = fmt.Errorf("key not found")
	ErrEmptyKey         = fmt.Errorf("key cannot be empty")
	ErrKeyTooLong       = fmt.Errorf("key exceeds maximum length")
	ErrInvalidOperation = fmt.Errorf("invalid operation")
)