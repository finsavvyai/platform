package middleware

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

// VersioningConfig holds configuration for API versioning
type VersioningConfig struct {
	// Default version to use when none is specified
	DefaultVersion string

	// Supported versions
	SupportedVersions []string

	// Version extraction methods
	EnableURLVersioning    bool // e.g., /api/v1/resource
	EnableHeaderVersioning bool // e.g., Accept: application/vnd.sdlc.v1+json
	EnableQueryVersioning  bool // e.g., ?version=v1
	EnablePrefixVersioning bool // e.g., /v1/resource

	// Header names for versioning
	VersionHeader     string // Default: API-Version
	AcceptHeader      string // Default: Accept
	ContentTypeHeader string // Default: Content-Type

	// Custom version patterns
	CustomPatterns map[string]*regexp.Regexp

	// Deprecated versions
	DeprecatedVersions map[string]DeprecationInfo

	// Sunset versions (to be removed)
	SunsetVersions map[string]SunsetInfo

	// Version routing
	VersionRoutes map[string]http.Handler // Version-specific handlers

	// Strict mode: reject unsupported versions
	StrictMode bool

	// Add version headers to responses
	AddVersionHeaders bool
}

// DeprecationInfo holds deprecation information
type DeprecationInfo struct {
	DeprecationDate string `json:"deprecation_date"`
	SunsetDate      string `json:"sunset_date"`
	ReplacementURL  string `json:"replacement_url,omitempty"`
	Message         string `json:"message"`
}

// SunsetInfo holds sunset information
type SunsetInfo struct {
	SunsetDate     string `json:"sunset_date"`
	RemovalDate    string `json:"removal_date"`
	MigrationGuide string `json:"migration_guide"`
}

// VersionInfo holds extracted version information
type VersionInfo struct {
	Version         string            `json:"version"`
	Source          string            `json:"source"` // url, header, query, prefix
	Original        string            `json:"original,omitempty"`
	Headers         map[string]string `json:"headers,omitempty"`
	IsDeprecated    bool              `json:"is_deprecated"`
	IsSunset        bool              `json:"is_sunset"`
	DeprecationInfo *DeprecationInfo  `json:"deprecation_info,omitempty"`
	SunsetInfo      *SunsetInfo       `json:"sunset_info,omitempty"`
}

// APIVersioningMiddleware handles API versioning
type APIVersioningMiddleware struct {
	config VersioningConfig
	logger *logrus.Logger
}

// Context keys
type contextKey string

const (
	VersionInfoKey  contextKey = "api_version_info"
	RouteVersionKey contextKey = "route_version"
)

// NewAPIVersioningMiddleware creates a new API versioning middleware
func NewAPIVersioningMiddleware(config VersioningConfig, logger *logrus.Logger) *APIVersioningMiddleware {
	if logger == nil {
		logger = logrus.New()
	}

	// Set defaults
	if config.DefaultVersion == "" {
		config.DefaultVersion = "v1"
	}
	if config.VersionHeader == "" {
		config.VersionHeader = "API-Version"
	}
	if config.AcceptHeader == "" {
		config.AcceptHeader = "Accept"
	}
	if config.ContentTypeHeader == "" {
		config.ContentTypeHeader = "Content-Type"
	}

	// Ensure default version is in supported versions
	if len(config.SupportedVersions) == 0 {
		config.SupportedVersions = []string{config.DefaultVersion}
	} else {
		found := false
		for _, v := range config.SupportedVersions {
			if v == config.DefaultVersion {
				found = true
				break
			}
		}
		if !found {
			config.SupportedVersions = append(config.SupportedVersions, config.DefaultVersion)
		}
	}

	return &APIVersioningMiddleware{
		config: config,
		logger: logger,
	}
}

// Middleware returns the chi middleware function
func (avm *APIVersioningMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract version from request
		versionInfo := avm.extractVersion(r)

		// Log version extraction
		avm.logger.WithFields(logrus.Fields{
			"version": versionInfo.Version,
			"source":  versionInfo.Source,
			"path":    r.URL.Path,
			"method":  r.Method,
		}).Debug("API version extracted")

		// Check if version is supported
		if !avm.isVersionSupported(versionInfo.Version) {
			if avm.config.StrictMode {
				avm.handleUnsupportedVersion(w, r, versionInfo)
				return
			}
			// Fall back to default version in non-strict mode
			versionInfo.Version = avm.config.DefaultVersion
		}

		// Check deprecation and sunset
		if depInfo, ok := avm.config.DeprecatedVersions[versionInfo.Version]; ok {
			versionInfo.IsDeprecated = true
			versionInfo.DeprecationInfo = &depInfo
			avm.addDeprecationHeaders(w, &depInfo)
		}

		if sunsetInfo, ok := avm.config.SunsetVersions[versionInfo.Version]; ok {
			versionInfo.IsSunset = true
			versionInfo.SunsetInfo = &sunsetInfo
			avm.addSunsetHeaders(w, &sunsetInfo)
		}

		// Add version to context
		ctx := context.WithValue(r.Context(), VersionInfoKey, versionInfo)

		// Check for version-specific handler
		if handler, ok := avm.config.VersionRoutes[versionInfo.Version]; ok {
			handler.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		// Add version headers to response if enabled
		if avm.config.AddVersionHeaders {
			avm.addVersionHeaders(w, versionInfo)
		}

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// extractVersion extracts the API version from the request
func (avm *APIVersioningMiddleware) extractVersion(r *http.Request) *VersionInfo {
	var version string
	var source string
	var original string

	// 1. Check URL path versioning (/api/v1/resource)
	if avm.config.EnableURLVersioning {
		if v := avm.extractURLVersion(r.URL.Path); v != "" {
			version = v
			source = "url"
			original = r.URL.Path
		}
	}

	// 2. Check header versioning
	if version == "" && avm.config.EnableHeaderVersioning {
		if v := avm.extractHeaderVersion(r); v != "" {
			version = v
			source = "header"
			original = r.Header.Get(avm.config.VersionHeader)
		}
	}

	// 3. Check Accept header versioning
	if version == "" && avm.config.EnableHeaderVersioning {
		if v := avm.extractAcceptVersion(r); v != "" {
			version = v
			source = "accept"
			original = r.Header.Get(avm.config.AcceptHeader)
		}
	}

	// 4. Check query parameter versioning
	if version == "" && avm.config.EnableQueryVersioning {
		if v := r.URL.Query().Get("version"); v != "" {
			version = v
			source = "query"
			original = v
		}
	}

	// 5. Check prefix versioning (/v1/resource)
	if version == "" && avm.config.EnablePrefixVersioning {
		if v := avm.extractPrefixVersion(r.URL.Path); v != "" {
			version = v
			source = "prefix"
			original = r.URL.Path
		}
	}

	// 6. Check custom patterns
	if version == "" {
		for patternName, pattern := range avm.config.CustomPatterns {
			if matches := pattern.FindStringSubmatch(r.URL.Path); len(matches) > 1 {
				version = matches[1]
				source = "custom:" + patternName
				original = r.URL.Path
				break
			}
		}
	}

	// 7. Use default version
	if version == "" {
		version = avm.config.DefaultVersion
		source = "default"
	}

	// Clean version (remove 'v' prefix if present)
	version = strings.TrimPrefix(version, "v")

	// Re-add 'v' prefix for consistency
	if !strings.HasPrefix(version, "v") {
		version = "v" + version
	}

	return &VersionInfo{
		Version:  version,
		Source:   source,
		Original: original,
		Headers: map[string]string{
			avm.config.VersionHeader: version,
		},
	}
}

// extractURLVersion extracts version from URL path (/api/v1/resource)
func (avm *APIVersioningMiddleware) extractURLVersion(path string) string {
	// Match patterns like /api/v1/resource or /api/v1/
	re := regexp.MustCompile(`/api/v(\d+)`)
	matches := re.FindStringSubmatch(path)
	if len(matches) > 1 {
		return "v" + matches[1]
	}
	return ""
}

// extractHeaderVersion extracts version from API-Version header
func (avm *APIVersioningMiddleware) extractHeaderVersion(r *http.Request) string {
	version := r.Header.Get(avm.config.VersionHeader)
	if version == "" {
		// Try common alternative headers
		version = r.Header.Get("X-API-Version")
		if version == "" {
			version = r.Header.Get("X-Version")
		}
	}
	return version
}

// extractAcceptVersion extracts version from Accept header
func (avm *APIVersioningMiddleware) extractAcceptVersion(r *http.Request) string {
	accept := r.Header.Get(avm.config.AcceptHeader)
	if accept == "" {
		return ""
	}

	// Parse Accept header for vendor-specific MIME types
	// Examples:
	// application/vnd.sdlc.v1+json
	// application/vnd.sdlc.v2+xml
	re := regexp.MustCompile(`application/vnd\.sdlc\.v(\d+)[+]`)
	matches := re.FindStringSubmatch(accept)
	if len(matches) > 1 {
		return "v" + matches[1]
	}

	// Parse for version in Accept header
	// Examples:
	// application/json; version=v1
	// application/xml; version=2
	re = regexp.MustCompile(`version=v?(\d+)`)
	matches = re.FindStringSubmatch(accept)
	if len(matches) > 1 {
		return "v" + matches[1]
	}

	return ""
}

// extractPrefixVersion extracts version from path prefix (/v1/resource)
func (avm *APIVersioningMiddleware) extractPrefixVersion(path string) string {
	re := regexp.MustCompile(`^/v(\d+)(/|$)`)
	matches := re.FindStringSubmatch(path)
	if len(matches) > 1 {
		return "v" + matches[1]
	}
	return ""
}

// isVersionSupported checks if a version is supported
func (avm *APIVersioningMiddleware) isVersionSupported(version string) bool {
	for _, supported := range avm.config.SupportedVersions {
		if supported == version {
			return true
		}
	}
	return false
}

// handleUnsupportedVersion handles unsupported version requests
func (avm *APIVersioningMiddleware) handleUnsupportedVersion(w http.ResponseWriter, r *http.Request, versionInfo *VersionInfo) {
	avm.logger.WithFields(logrus.Fields{
		"requested_version": versionInfo.Version,
		"source":            versionInfo.Source,
		"path":              r.URL.Path,
		"method":            r.Method,
	}).Warn("Unsupported API version requested")

	render.Status(r, http.StatusBadRequest)
	render.JSON(w, r, map[string]interface{}{
		"success": false,
		"error": map[string]interface{}{
			"code":    "UNSUPPORTED_API_VERSION",
			"message": fmt.Sprintf("API version %s is not supported", versionInfo.Version),
			"details": map[string]interface{}{
				"requested_version":  versionInfo.Version,
				"supported_versions": avm.config.SupportedVersions,
				"default_version":    avm.config.DefaultVersion,
			},
		},
		"meta": map[string]interface{}{
			"request_id": uuid.New().String(),
			"timestamp":  "now", // This should be replaced with actual timestamp
			"version":    "v1",
		},
	})
}

// addVersionHeaders adds version information to response headers
func (avm *APIVersioningMiddleware) addVersionHeaders(w http.ResponseWriter, versionInfo *VersionInfo) {
	w.Header().Set("API-Version", versionInfo.Version)
	w.Header().Set("API-Version-Source", versionInfo.Source)

	// Add supported versions header
	w.Header().Set("API-Supported-Versions", strings.Join(avm.config.SupportedVersions, ", "))
}

// addDeprecationHeaders adds deprecation headers
func (avm *APIVersioningMiddleware) addDeprecationHeaders(w http.ResponseWriter, depInfo *DeprecationInfo) {
	w.Header().Set("Deprecation", "true")
	w.Header().Set("Sunset", depInfo.SunsetDate)

	if depInfo.ReplacementURL != "" {
		w.Header().Set("Link", fmt.Sprintf(`<%s>; rel="successor-version"`, depInfo.ReplacementURL))
	}
}

// addSunsetHeaders adds sunset headers
func (avm *APIVersioningMiddleware) addSunsetHeaders(w http.ResponseWriter, sunsetInfo *SunsetInfo) {
	w.Header().Set("Sunset", sunsetInfo.SunsetDate)
	w.Header().Set("Removal-Date", sunsetInfo.RemovalDate)

	if sunsetInfo.MigrationGuide != "" {
		w.Header().Set("Link", fmt.Sprintf(`<%s>; rel="migration-guide"`, sunsetInfo.MigrationGuide))
	}
}

// GetVersionInfo retrieves version info from context
func GetVersionInfo(ctx context.Context) (*VersionInfo, bool) {
	info, ok := ctx.Value(VersionInfoKey).(*VersionInfo)
	return info, ok
}

// GetVersion retrieves just the version from context
func GetVersion(ctx context.Context) string {
	if info, ok := GetVersionInfo(ctx); ok {
		return info.Version
	}
	return ""
}

// RouteVersion is a chi middleware for route-specific versioning
func RouteVersion(version string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), RouteVersionKey, version)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetRouteVersion retrieves the route version from context
func GetRouteVersion(ctx context.Context) string {
	if version, ok := ctx.Value(RouteVersionKey).(string); ok {
		return version
	}
	return ""
}

// VersionMatcher creates a middleware that only matches specific versions
func VersionMatcher(versions ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if info, ok := GetVersionInfo(r.Context()); ok {
				for _, v := range versions {
					if info.Version == v {
						next.ServeHTTP(w, r)
						return
					}
				}
			}

			// Version doesn't match
			render.Status(r, http.StatusNotFound)
			render.JSON(w, r, map[string]interface{}{
				"success": false,
				"error": map[string]interface{}{
					"code":    "VERSION_NOT_MATCH",
					"message": "This endpoint is not available in the requested API version",
					"details": map[string]interface{}{
						"required_versions": versions,
					},
				},
			})
		})
	}
}

// WithVersionHandler registers a handler for a specific version
func (avm *APIVersioningMiddleware) WithVersionHandler(version string, handler http.Handler) *APIVersioningMiddleware {
	if avm.config.VersionRoutes == nil {
		avm.config.VersionRoutes = make(map[string]http.Handler)
	}
	avm.config.VersionRoutes[version] = handler
	return avm
}

// WithDeprecatedVersion marks a version as deprecated
func (avm *APIVersioningMiddleware) WithDeprecatedVersion(version string, info DeprecationInfo) *APIVersioningMiddleware {
	if avm.config.DeprecatedVersions == nil {
		avm.config.DeprecatedVersions = make(map[string]DeprecationInfo)
	}
	avm.config.DeprecatedVersions[version] = info
	return avm
}

// WithSunsetVersion marks a version for sunset
func (avm *APIVersioningMiddleware) WithSunsetVersion(version string, info SunsetInfo) *APIVersioningMiddleware {
	if avm.config.SunsetVersions == nil {
		avm.config.SunsetVersions = make(map[string]SunsetInfo)
	}
	avm.config.SunsetVersions[version] = info
	return avm
}

// WithCustomPattern adds a custom version extraction pattern
func (avm *APIVersioningMiddleware) WithCustomPattern(name string, pattern *regexp.Regexp) *APIVersioningMiddleware {
	if avm.config.CustomPatterns == nil {
		avm.config.CustomPatterns = make(map[string]*regexp.Regexp)
	}
	avm.config.CustomPatterns[name] = pattern
	return avm
}

// CreateVersioningRouter creates a router with versioned routes
func CreateVersioningRouter() *chi.Mux {
	r := chi.NewRouter()

	// v1 routes
	r.Route("/v1", func(r chi.Router) {
		r.Use(RouteVersion("v1"))
		// Add v1 specific routes here
		r.Get("/users", func(w http.ResponseWriter, r *http.Request) {
			render.JSON(w, r, map[string]interface{}{
				"version": "v1",
				"users":   []string{},
			})
		})
	})

	// v2 routes
	r.Route("/v2", func(r chi.Router) {
		r.Use(RouteVersion("v2"))
		// Add v2 specific routes here
		r.Get("/users", func(w http.ResponseWriter, r *http.Request) {
			render.JSON(w, r, map[string]interface{}{
				"version":  "v2",
				"users":    []string{},
				"features": []string{"pagination", "filtering"},
			})
		})
	})

	return r
}

// DefaultVersioningConfig returns a default versioning configuration
func DefaultVersioningConfig() VersioningConfig {
	return VersioningConfig{
		DefaultVersion:         "v1",
		SupportedVersions:      []string{"v1"},
		EnableURLVersioning:    true,
		EnableHeaderVersioning: true,
		EnableQueryVersioning:  true,
		EnablePrefixVersioning: false,
		StrictMode:             false,
		AddVersionHeaders:      true,
		DeprecatedVersions: map[string]DeprecationInfo{
			"v1": {
				DeprecationDate: "2024-06-01",
				SunsetDate:      "2024-12-31",
				ReplacementURL:  "/api/v2",
				Message:         "Version 1 is deprecated. Please migrate to version 2.",
			},
		},
		SunsetVersions: map[string]SunsetInfo{
			"v0": {
				SunsetDate:     "2023-12-31",
				RemovalDate:    "2024-03-31",
				MigrationGuide: "https://docs.sdlc.cc/migration/v0-to-v1",
			},
		},
		CustomPatterns: map[string]*regexp.Regexp{
			"custom": regexp.MustCompile(`/api/preview/v(\d+)/`),
		},
	}
}

// ParseVersion parses a version string and returns numeric version
func ParseVersion(version string) (int, error) {
	// Remove 'v' prefix
	version = strings.TrimPrefix(version, "v")

	// Extract numeric part
	re := regexp.MustCompile(`^(\d+)`)
	matches := re.FindStringSubmatch(version)
	if len(matches) == 0 {
		return 0, fmt.Errorf("invalid version format: %s", version)
	}

	return strconv.Atoi(matches[1])
}

// CompareVersions compares two version strings
func CompareVersions(v1, v2 string) (int, error) {
	num1, err := ParseVersion(v1)
	if err != nil {
		return 0, err
	}

	num2, err := ParseVersion(v2)
	if err != nil {
		return 0, err
	}

	switch {
	case num1 < num2:
		return -1, nil
	case num1 > num2:
		return 1, nil
	default:
		return 0, nil
	}
}
