package sdln

import "time"

// ========================================
// Configuration Constants
// ========================================

// This file contains configuration constants only.
// Client configuration is in client.go

// Default configuration values
const (
	DefaultTimeout         = 30 * time.Second
	DefaultRetryAttempts   = 3
	DefaultRetryDelay      = 1 * time.Second
	DefaultMaxIdleConns    = 10
	DefaultMaxConnsPerHost = 50
)

// Environment variables
const (
	EnvAPIURL     = "SDLC_API_URL"
	EnvAPIKey     = "SDLC_API_KEY"
	EnvJWTToken   = "SDLC_JWT_TOKEN"
	EnvDebug      = "SDLC_DEBUG"
	EnvTimeout    = "SDLC_TIMEOUT"
	EnvRetryCount = "SDLC_RETRY_COUNT"
)
