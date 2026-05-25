package analysis

import (
	"context"
	"net/http"
	"strings"
	"time"
)

// ValidityStatus represents the result of a live secret check.
type ValidityStatus string

const (
	ValidityUnknown ValidityStatus = "unknown"
	ValidityActive  ValidityStatus = "active"  // confirmed live
	ValidityInvalid ValidityStatus = "invalid" // confirmed revoked/bad
	ValidityExpired ValidityStatus = "expired" // expired token
	ValiditySkipped ValidityStatus = "skipped" // no validator for this type
)

// ValidateResult holds the result of validating a single secret.
type ValidateResult struct {
	Valid     bool
	Status    ValidityStatus
	Identity  string
	ExpiresAt *time.Time
	Error     string
}

// SecretValidator performs live validity checks against provider APIs.
type SecretValidator struct {
	httpClient *http.Client
}

// NewSecretValidator creates a validator with a 5-second timeout.
func NewSecretValidator() *SecretValidator {
	return &SecretValidator{
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

// Validate checks whether a secret is live. Pattern name determines the provider.
func (v *SecretValidator) Validate(ctx context.Context, patternName, secret string) *ValidateResult {
	nameLower := strings.ToLower(patternName)
	switch {
	case strings.Contains(nameLower, "aws access"):
		return v.validateAWSKey(ctx, secret)
	case strings.Contains(nameLower, "github"):
		return v.validateGitHubToken(ctx, secret)
	case strings.Contains(nameLower, "gitlab"):
		return v.validateGitLabToken(ctx, secret)
	case strings.Contains(nameLower, "slack"):
		return v.validateSlackToken(ctx, secret)
	case strings.Contains(nameLower, "jwt"):
		return v.validateJWT(secret)
	default:
		return &ValidateResult{Status: ValiditySkipped}
	}
}
