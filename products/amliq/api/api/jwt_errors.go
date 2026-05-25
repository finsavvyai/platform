package api

import "errors"

var (
	ErrTokenExpired      = errors.New("token expired")
	ErrInvalidSignature  = errors.New("invalid token signature")
	ErrInvalidFormat     = errors.New("invalid token format")
	ErrMissingTenantID   = errors.New("missing tenant_id in claims")
	ErrMissingUserID     = errors.New("missing user_id in claims")
	ErrMissingAuthHeader = errors.New("missing authorization header")
	ErrInvalidAuthHeader = errors.New("invalid authorization header format")
	ErrInvalidAPIKey     = errors.New("invalid api key")
	ErrAPIKeyExpired     = errors.New("api key expired")
	ErrIPNotAllowed      = errors.New("ip address not allowed")
)
