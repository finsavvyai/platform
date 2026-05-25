//go:build ignore

package middleware

import (
	"context"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"go.uber.org/zap"
)

// VersionConfig holds configuration for API versioning
type VersionConfig struct {
	// Default version if no version is specified
	DefaultVersion string `yaml:"default_version" json:"default_version"`

	// Supported versions
	SupportedVersions []string `yaml:"supported_versions" json:"supported_versions"`

	// Deprecation warnings for versions
	DeprecationWarnings map[string]string `yaml:"deprecation_warnings" json:"deprecation_warnings"`

	// Sunset dates for versions (format: YYYY-MM-DD)
	SunsetDates map[string]string `yaml:"sunset_dates" json:"sunset_dates"`

	// Header-based versioning enabled
	HeaderVersioning bool `yaml:"header_versioning" json:"header_versioning"`

	// URL-based versioning enabled
	URLVersioning bool `yaml:"url_versioning" json:"url_versioning"`

	// Query parameter versioning enabled
	QueryVersioning bool `yaml:"query_versioning" json:"query_versioning"`

	// Custom version header name
	VersionHeader string `yaml:"version_header" json:"version_header"`

	// Query parameter name
	VersionQueryParam string `yaml:"version_query_param" json:"version_query_param"`

	// Enable automatic version negotiation
	AutoNegotiation bool `yaml:"auto_negotiation" json:"auto_negotiation"`

	// Version prefix for URLs
	VersionPrefix string `yaml:"version_prefix" json:"version_prefix"`
}

// DefaultVersionConfig returns a default version configuration
func DefaultVersionConfig() *VersionConfig {
	return &VersionConfig{
		DefaultVersion:    "v1",
		SupportedVersions: []string{"v1", "v2"},
		DeprecationWarnings: map[string]string{
			"v1": "Version v1 is deprecated. Please migrate to v2 before 2024-12-31.",
		},
		SunsetDates: map[string]string{
			"v1": "2024-12-31",
		},
		HeaderVersioning:  true,
		URLVersioning:     true,
		QueryVersioning:   true,
		VersionHeader:     "API-Version",
		VersionQueryParam: "version",
		AutoNegotiation:   true,
		VersionPrefix:     "v",
	}
}

// VersionInfo holds version information for the request
type VersionInfo struct {
	// Requested version
	Requested string `json:"requested"`

	// Negotiated version
	Negotiated string `json:"negotiated"`

	// Version source (header, url, query, default)
	Source string `json:"source"`

	// Whether this version is deprecated
	Deprecated bool `json:"deprecated"`

	// Deprecation warning message
	DeprecationWarning string `json:"deprecation_warning,omitempty"`

	// Sunset date
	SunsetDate string `json:"sunset_date,omitempty"`

	// Whether this version is supported
	Supported bool `json:"supported"`

	// API version in semver format
	Semver string `json:"semver"`

	// Feature flags for this version
	Features []string `json:"features"`
}

// VersioningMiddleware creates a middleware for API versioning
func VersioningMiddleware(config *VersionConfig, logger *zap.Logger) func(http.Handler) http.Handler {
	if config == nil {
		config = DefaultVersionConfig()
	}

	// Compile regex patterns for version extraction
	versionPattern := regexp.MustCompile(`^v(\d+)(?:\.(\d+))?(?:\.(\d+))?$`)
	urlVersionPattern := regexp.MustCompile(`^/api/([^/]+)/`)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract version from various sources
			versionInfo := extractVersion(r, config, versionPattern, urlVersionPattern, logger)

			// Set version information in the request context
			ctx := setVersionContext(r.Context(), versionInfo)
			r = r.WithContext(ctx)

			// Add version headers to response
			w.Header().Set("API-Version", versionInfo.Negotiated)
			w.Header().Set("API-Version-Supported", "true")
			w.Header().Set("API-Version-Semver", versionInfo.Semver)

			if versionInfo.Deprecated {
				w.Header().Set("API-Version-Deprecated", "true")
				w.Header().Set("API-Version-Deprecation-Warning", versionInfo.DeprecationWarning)
			}

			if versionInfo.SunsetDate != "" {
				w.Header().Set("API-Version-Sunset-Date", versionInfo.SunsetDate)
			}

			// Add supported versions header
			w.Header().Set("API-Versions-Supported", strings.Join(config.SupportedVersions, ", "))

			// If version is not supported, return error
			if !versionInfo.Supported {
				logger.Warn("Unsupported API version requested",
					zap.String("version", versionInfo.Requested),
					zap.String("source", versionInfo.Source),
					zap.String("path", r.URL.Path),
					zap.String("user_agent", r.UserAgent()),
				)

				render.Status(r, http.StatusBadRequest)
				render.JSON(w, r, map[string]interface{}{
					"success": false,
					"error": map[string]interface{}{
						"code":    "UNSUPPORTED_API_VERSION",
						"message": "API version is not supported",
						"details": map[string]interface{}{
							"requested_version":  versionInfo.Requested,
							"supported_versions": config.SupportedVersions,
							"source":             versionInfo.Source,
						},
					},
					"meta": map[string]interface{}{
						"request_id": getOrGenerateRequestID(r),
						"timestamp":  "now",
						"version":    versionInfo.Negotiated,
					},
				})
				return
			}

			// Add version info to response for debugging
			if r.URL.Query().Get("debug") == "true" {
				w.Header().Set("X-API-Version-Info", formatVersionInfoHeader(versionInfo))
			}

			next.ServeHTTP(w, r)
		})
	}
}

// extractVersion extracts version information from the request
func extractVersion(r *http.Request, config *VersionConfig, versionPattern, urlVersionPattern *regexp.Regexp, logger *zap.Logger) *VersionInfo {
	var version string
	var source string

	// Priority order: URL > Header > Query > Accept header > Default

	// 1. URL-based versioning
	if config.URLVersioning {
		if urlVersion := extractURLVersion(r.URL.Path, urlVersionPattern); urlVersion != "" {
			version = urlVersion
			source = "url"
		}
	}

	// 2. Header-based versioning
	if version == "" && config.HeaderVersioning {
		if headerVersion := r.Header.Get(config.VersionHeader); headerVersion != "" {
			version = headerVersion
			source = "header"
		}
	}

	// 3. Query parameter versioning
	if version == "" && config.QueryVersioning {
		if queryVersion := r.URL.Query().Get(config.VersionQueryParam); queryVersion != "" {
			version = queryVersion
			source = "query"
		}
	}

	// 4. Accept header versioning (content negotiation)
	if version == "" && config.AutoNegotiation {
		if acceptVersion := extractAcceptVersion(r.Header.Get("Accept")); acceptVersion != "" {
			version = acceptVersion
			source = "accept"
		}
	}

	// 5. Default version
	if version == "" {
		version = config.DefaultVersion
		source = "default"
	}

	// Normalize version (ensure it starts with 'v')
	if !strings.HasPrefix(version, "v") {
		version = "v" + version
	}

	// Validate version format
	if !versionPattern.MatchString(version) {
		logger.Warn("Invalid version format",
			zap.String("version", version),
			zap.String("source", source),
		)
		version = config.DefaultVersion
		source = "default_fallback"
	}

	// Create version info
	versionInfo := &VersionInfo{
		Requested:  version,
		Negotiated: version,
		Source:     source,
		Supported:  isVersionSupported(version, config.SupportedVersions),
		Semver:     convertToSemver(version),
	}

	// Check deprecation
	if warning, exists := config.DeprecationWarnings[version]; exists {
		versionInfo.Deprecated = true
		versionInfo.DeprecationWarning = warning
	}

	// Check sunset date
	if sunsetDate, exists := config.SunsetDates[version]; exists {
		versionInfo.SunsetDate = sunsetDate
	}

	// Add feature flags based on version
	versionInfo.Features = getVersionFeatures(version)

	return versionInfo
}

// extractURLVersion extracts version from URL path
func extractURLVersion(path string, pattern *regexp.Regexp) string {
	matches := pattern.FindStringSubmatch(path)
	if len(matches) > 1 {
		version := matches[1]
		// Ensure version starts with 'v'
		if !strings.HasPrefix(version, "v") {
			version = "v" + version
		}
		return version
	}
	return ""
}

// extractAcceptVersion extracts version from Accept header
func extractAcceptVersion(acceptHeader string) string {
	if acceptHeader == "" {
		return ""
	}

	// Parse Accept header for version information
	// Format: application/vnd.sdlc.v1+json
	acceptHeader = strings.ToLower(acceptHeader)

	// Look for patterns like "application/vnd.sdlc.v1+json"
	pattern := regexp.MustCompile(`application/vnd\.sdlc\.([^+]+)`)
	matches := pattern.FindStringSubmatch(acceptHeader)
	if len(matches) > 1 {
		version := matches[1]
		if !strings.HasPrefix(version, "v") {
			version = "v" + version
		}
		return version
	}

	return ""
}

// isVersionSupported checks if a version is supported
func isVersionSupported(version string, supportedVersions []string) bool {
	for _, supported := range supportedVersions {
		if supported == version {
			return true
		}
	}
	return false
}

// convertToSemver converts API version to semantic version
func convertToSemver(version string) string {
	// Remove 'v' prefix if present
	semver := strings.TrimPrefix(version, "v")

	// Ensure we have at least major.minor format
	parts := strings.Split(semver, ".")
	if len(parts) == 1 {
		semver += ".0"
	}

	return semver
}

// getVersionFeatures returns feature flags for a specific version
func getVersionFeatures(version string) []string {
	features := []string{
		"basic_auth",
		"document_upload",
		"rag_query",
	}

	switch version {
	case "v1":
		features = append(features, "rate_limiting", "basic_dlp")
	case "v2":
		features = append(features, "advanced_dlp", "webhooks", "real_time_updates")
	case "v3":
		features = append(features, "ai_features", "advanced_analytics", "custom_models")
	}

	return features
}

// formatVersionInfoHeader formats version info for HTTP header
func formatVersionInfoHeader(info *VersionInfo) string {
	return info.Negotiated + ";" + info.Source + ";supported=" + strconv.FormatBool(info.Supported) + ";deprecated=" + strconv.FormatBool(info.Deprecated)
}

// Context keys for version information
type contextKey string

const versionKey contextKey = "version"

// setVersionContext sets version information in the request context
func setVersionContext(ctx context.Context, versionInfo *VersionInfo) context.Context {
	return context.WithValue(ctx, versionKey, versionInfo)
}

// GetVersionFromContext returns version information from the request context
func GetVersionFromContext(ctx context.Context) *VersionInfo {
	if versionInfo, ok := ctx.Value(versionKey).(*VersionInfo); ok {
		return versionInfo
	}
	return nil
}

// GetVersionFromRequest returns version information from the request
func GetVersionFromRequest(r *http.Request) *VersionInfo {
	return GetVersionFromContext(r.Context())
}

// IsVersionAtLeast checks if the current version is at least the specified version
func IsVersionAtLeast(current, required string) bool {
	// Convert to semver format and compare
	currentSemver := convertToSemver(current)
	requiredSemver := convertToSemver(required)

	// Simple semver comparison (for full implementation, use a proper semver library)
	currentParts := strings.Split(currentSemver, ".")
	requiredParts := strings.Split(requiredSemver, ".")

	for i := 0; i < 3; i++ {
		var currentNum, requiredNum int

		if i < len(currentParts) {
			currentNum, _ = strconv.Atoi(currentParts[i])
		}
		if i < len(requiredParts) {
			requiredNum, _ = strconv.Atoi(requiredParts[i])
		}

		if currentNum > requiredNum {
			return true
		}
		if currentNum < requiredNum {
			return false
		}
	}

	return true
}

// VersionRouter creates a router that handles version-based routing
func VersionRouter(config *VersionConfig) chi.Router {
	r := chi.NewRouter()

	// Version-specific routes
	for _, version := range config.SupportedVersions {
		r.Route("/"+version, func(r chi.Router) {
			// Add version middleware for this route
			r.Use(func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					// Set version in context
					versionInfo := &VersionInfo{
						Requested:  version,
						Negotiated: version,
						Source:     "url",
						Supported:  true,
						Semver:     convertToSemver(version),
					}

					ctx := setVersionContext(r.Context(), versionInfo)
					next.ServeHTTP(w, r.WithContext(ctx))
				})
			})

			// Add version-specific routes here
			// This would be populated by the actual route definitions
		})
	}

	// Legacy routes (without version prefix)
	r.Route("/", func(r chi.Router) {
		// Apply versioning middleware
		r.Use(VersioningMiddleware(config, nil))

		// Legacy routes that don't have version prefix
		// These will use the default version or header-based versioning
	})

	return r
}

// VersionValidator middleware validates version compatibility
func VersionValidator(minVersion, maxVersion string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			versionInfo := GetVersionFromContext(r)
			if versionInfo == nil {
				// No version info, skip validation
				next.ServeHTTP(w, r)
				return
			}

			currentVersion := versionInfo.Negotiated

			// Check minimum version
			if minVersion != "" && !IsVersionAtLeast(currentVersion, minVersion) {
				render.Status(r, http.StatusBadRequest)
				render.JSON(w, r, map[string]interface{}{
					"success": false,
					"error": map[string]interface{}{
						"code":    "API_VERSION_TOO_OLD",
						"message": "API version is too old for this endpoint",
						"details": map[string]interface{}{
							"current_version": currentVersion,
							"minimum_version": minVersion,
						},
					},
				})
				return
			}

			// Check maximum version
			if maxVersion != "" && IsVersionAtLeast(maxVersion, currentVersion) {
				render.Status(r, http.StatusBadRequest)
				render.JSON(w, r, map[string]interface{}{
					"success": false,
					"error": map[string]interface{}{
						"code":    "API_VERSION_TOO_NEW",
						"message": "API version is too new for this endpoint",
						"details": map[string]interface{}{
							"current_version": currentVersion,
							"maximum_version": maxVersion,
						},
					},
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
