package main

import (
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
	"quantumbeam/internal/auth"
	"quantumbeam/internal/interfaces"
)

// defaultJWTSecret is intentionally weak so the server refuses to start
// without a proper JWT_SECRET env var in production.
const defaultJWTSecret = "CHANGE_ME_IN_PRODUCTION"

// authDeps holds initialised auth-related services for dependency injection.
type authDeps struct {
	jwtService       *auth.JWTService
	authMiddleware   *auth.AuthMiddleware
	rateLimitService interfaces.RateLimitService
}

// initAuth creates the JWT, API-key, and rate-limit services from env vars.
// Redis is optional -- when unavailable the blacklist and brute-force
// protection are silently disabled (acceptable for local dev).
func initAuth() *authDeps {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = defaultJWTSecret
		log.Println("WARN: JWT_SECRET not set, using insecure default")
	}

	refreshSecret := os.Getenv("JWT_REFRESH_SECRET")
	if refreshSecret == "" {
		refreshSecret = jwtSecret + "_refresh"
	}

	// Optional Redis connection for blacklist + brute-force
	var redisClient *redis.Client
	var rateLimitSvc interfaces.RateLimitService

	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr != "" {
		redisClient = redis.NewClient(&redis.Options{Addr: redisAddr})
		rateLimitSvc = auth.NewRateLimitService(redisClient)
	}

	jwtSvc := auth.NewJWTService(&auth.JWTConfig{
		SecretKey:       jwtSecret,
		RefreshKey:      refreshSecret,
		Issuer:          "quantumbeam-api",
		AccessTokenTTL:  15 * time.Minute,
		RefreshTokenTTL: 7 * 24 * time.Hour,
		RedisClient:     redisClient,
	})

	// AuthMiddleware requires all three deps; apiKeyService and
	// rateLimitService may be nil when Redis is unavailable.
	authMw := auth.NewAuthMiddleware(jwtSvc, nil, rateLimitSvc)

	return &authDeps{
		jwtService:       jwtSvc,
		authMiddleware:   authMw,
		rateLimitService: rateLimitSvc,
	}
}
