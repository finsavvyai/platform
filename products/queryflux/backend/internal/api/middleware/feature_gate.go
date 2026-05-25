package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/queryflux/backend/internal/services"
)

// FeatureGateKey is the context key for feature permissions
type FeatureGateKey struct{}

// UserFeaturesKey is the context key for user features
type UserFeaturesKey struct{}

// FeatureGate stores feature access permissions
type FeatureGate struct {
	Tier           string
	MaxConnections int
	AllowedDBTypes []string
	AIEnabled      bool
	TeamEnabled    bool
}

// FeatureGateMiddleware checks subscription tier and gates features
func FeatureGateMiddleware(lemonSqueezy *services.LemonSqueezyService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract license key from header
			licenseKey := r.Header.Get("X-License-Key")
			
			var gate FeatureGate
			
			if licenseKey == "" {
				// Free tier - limited features
				gate = FeatureGate{
					Tier:           "free",
					MaxConnections: 2,
					AllowedDBTypes: []string{"sqlite"},
					AIEnabled:      false,
					TeamEnabled:    false,
				}
			} else {
				// Validate license
				resp, err := lemonSqueezy.ValidateLicense(r.Context(), licenseKey)
				if err != nil || !resp.Valid {
					gate = FeatureGate{
						Tier:           "free",
						MaxConnections: 2,
						AllowedDBTypes: []string{"sqlite"},
						AIEnabled:      false,
						TeamEnabled:    false,
					}
				} else {
					// Map variant to features
					tier := getTierByVariant(resp.LicenseDetails.VariantName)
					gate = FeatureGate{
						Tier:           tier.ID,
						MaxConnections: tier.Features.MaxConnections,
						AllowedDBTypes: tier.Features.SupportedDatabases,
						AIEnabled:      tier.Features.AIFeatures,
						TeamEnabled:    tier.Features.TeamCollaboration,
					}
				}
			}
			
			// Add feature gate to context
			ctx := context.WithValue(r.Context(), FeatureGateKey{}, gate)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireFeature checks if a specific feature is enabled
func RequireFeature(feature string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gate, ok := r.Context().Value(FeatureGateKey{}).(FeatureGate)
			if !ok {
				respondForbidden(w, "Feature gate not initialized")
				return
			}
			
			allowed := false
			switch feature {
			case "ai":
				allowed = gate.AIEnabled
			case "team":
				allowed = gate.TeamEnabled
			case "advanced":
				allowed = gate.Tier == "professional" || gate.Tier == "enterprise"
			case "enterprise":
				allowed = gate.Tier == "enterprise"
			default:
				allowed = true
			}
			
			if !allowed {
				respondForbidden(w, "This feature requires a higher subscription tier")
				return
			}
			
			next.ServeHTTP(w, r)
		})
	}
}

// RequireDatabaseType checks if a database type is allowed for the user's tier
func RequireDatabaseType(dbType string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gate, ok := r.Context().Value(FeatureGateKey{}).(FeatureGate)
			if !ok {
				respondForbidden(w, "Feature gate not initialized")
				return
			}
			
			allowed := false
			for _, allowedType := range gate.AllowedDBTypes {
				if strings.EqualFold(allowedType, dbType) {
					allowed = true
					break
				}
			}
			
			if !allowed {
				respondForbidden(w, "Your subscription tier does not support "+dbType+" connections")
				return
			}
			
			next.ServeHTTP(w, r)
		})
	}
}

// CheckConnectionLimit checks if user can create more connections
func CheckConnectionLimit(currentConnections int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gate, ok := r.Context().Value(FeatureGateKey{}).(FeatureGate)
			if !ok {
				respondForbidden(w, "Feature gate not initialized")
				return
			}
			
			// -1 means unlimited
			if gate.MaxConnections != -1 && currentConnections >= gate.MaxConnections {
				respondForbidden(w, "You have reached the maximum number of connections for your tier")
				return
			}
			
			next.ServeHTTP(w, r)
		})
	}
}

// GetFeatureGate returns the feature gate from context
func GetFeatureGate(ctx context.Context) (FeatureGate, bool) {
	gate, ok := ctx.Value(FeatureGateKey{}).(FeatureGate)
	return gate, ok
}

// Helper functions
func getTierByVariant(variantName string) *services.SubscriptionTier {
	tiers := services.GetSubscriptionTiers()
	for _, tier := range tiers {
		if tier.Name == variantName || tier.ID == variantName {
			return &tier
		}
	}
	return &tiers[0] // Default to starter
}

func respondForbidden(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"error":   message,
		"upgrade": true,
	})
}
