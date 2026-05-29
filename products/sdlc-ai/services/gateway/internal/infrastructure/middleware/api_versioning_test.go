//go:build ignore

package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseAPIVersion(t *testing.T) {
	tests := []struct {
		input       string
		expected    APIVersion
		expectError bool
	}{
		{"v1.0.0", APIVersion{Major: 1, Minor: 0, Patch: 0}, false},
		{"1.2.3", APIVersion{Major: 1, Minor: 2, Patch: 3}, false},
		{"v2.1", APIVersion{Major: 2, Minor: 1, Patch: 0}, false},
		{"v3", APIVersion{Major: 3, Minor: 0, Patch: 0}, false},
		{"invalid", APIVersion{}, true},
		{"", APIVersion{}, true},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			version, err := ParseAPIVersion(tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Equal(t, APIVersion{}, version)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expected, version)
				assert.Equal(t, "v"+tt.input, version.String())
			}
		})
	}
}

func TestAPIVersionCompare(t *testing.T) {
	tests := []struct {
		name     string
		v1       APIVersion
		v2       APIVersion
		expected int
	}{
		{
			name:     "Equal versions",
			v1:       APIVersion{Major: 1, Minor: 0, Patch: 0},
			v2:       APIVersion{Major: 1, Minor: 0, Patch: 0},
			expected: 0,
		},
		{
			name:     "v1 < v2 (major)",
			v1:       APIVersion{Major: 1, Minor: 0, Patch: 0},
			v2:       APIVersion{Major: 2, Minor: 0, Patch: 0},
			expected: -1,
		},
		{
			name:     "v1 > v2 (minor)",
			v1:       APIVersion{Major: 1, Minor: 5, Patch: 0},
			v2:       APIVersion{Major: 1, Minor: 3, Patch: 0},
			expected: 1,
		},
		{
			name:     "v1 < v2 (patch)",
			v1:       APIVersion{Major: 1, Minor: 0, Patch: 2},
			v2:       APIVersion{Major: 1, Minor: 0, Patch: 5},
			expected: -1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.v1.Compare(tt.v2)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestVersioningMiddleware_URLVersioning(t *testing.T) {
	config := DefaultVersioningConfig()
	config.SupportedVersions = []APIVersion{
		{Major: 1, Minor: 0, Patch: 0},
		{Major: 2, Minor: 0, Patch: 0},
	}
	config.StrictMode = false

	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	mw := NewVersioningMiddleware(config, logger)

	handler := mw.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		version, ok := GetAPIVersion(r.Context())
		require.True(t, ok)
		assert.Equal(t, 1, version.Major)

		source, ok := GetAPIVersionSource(r.Context())
		require.True(t, ok)
		assert.Equal(t, "url", source)

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))

	tests := []struct {
		name           string
		path           string
		expectedStatus int
		expectedMajor  int
	}{
		{
			name:           "v1 URL",
			path:           "/api/v1/users",
			expectedStatus: http.StatusOK,
			expectedMajor:  1,
		},
		{
			name:           "v2 URL",
			path:           "/api/v2/users",
			expectedStatus: http.StatusOK,
			expectedMajor:  2,
		},
		{
			name:           "no version URL",
			path:           "/api/users",
			expectedStatus: http.StatusOK,
			expectedMajor:  1, // Default version
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.path, nil)
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			assert.Equal(t, "v"+string(rune(tt.expectedMajor+'0'))+".0.0", w.Header().Get("API-Version"))
		})
	}
}

func TestVersioningMiddleware_HeaderVersioning(t *testing.T) {
	config := DefaultVersioningConfig()
	config.SupportedVersions = []APIVersion{
		{Major: 1, Minor: 0, Patch: 0},
		{Major: 2, Minor: 1, Patch: 0},
	}
	config.EnableURLVersioning = false
	config.EnableHeaderVersioning = true

	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	mw := NewVersioningMiddleware(config, logger)

	handler := mw.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		version, ok := GetAPIVersion(r.Context())
		require.True(t, ok)
		assert.Equal(t, 2, version.Major)
		assert.Equal(t, 1, version.Minor)

		source, ok := GetAPIVersionSource(r.Context())
		require.True(t, ok)
		assert.Equal(t, "header", source)

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))

	req := httptest.NewRequest("GET", "/users", nil)
	req.Header.Set("Accept", "application/vnd.sdlc.v2.1+json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "v2.1.0", w.Header().Get("API-Version"))
	assert.Equal(t, "header", w.Header().Get("API-Version-Source"))
}

func TestVersioningMiddleware_CustomHeaderVersioning(t *testing.T) {
	config := DefaultVersioningConfig()
	config.VersionHeader = "API-Version"
	config.EnableURLVersioning = false
	config.EnableHeaderVersioning = false
	config.EnableQueryParamVersioning = false

	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	mw := NewVersioningMiddleware(config, logger)

	handler := mw.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		version, ok := GetAPIVersion(r.Context())
		require.True(t, ok)
		assert.Equal(t, 3, version.Major)

		source, ok := GetAPIVersionSource(r.Context())
		require.True(t, ok)
		assert.Equal(t, "custom_header", source)

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))

	req := httptest.NewRequest("GET", "/users", nil)
	req.Header.Set("API-Version", "v3.0.0")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "v3.0.0", w.Header().Get("API-Version"))
}

func TestVersioningMiddleware_QueryParamVersioning(t *testing.T) {
	config := DefaultVersioningConfig()
	config.SupportedVersions = []APIVersion{
		{Major: 1, Minor: 0, Patch: 0},
		{Major: 2, Minor: 0, Patch: 0},
	}
	config.EnableURLVersioning = false
	config.EnableHeaderVersioning = false
	config.EnableQueryParamVersioning = true

	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	mw := NewVersioningMiddleware(config, logger)

	handler := mw.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		version, ok := GetAPIVersion(r.Context())
		require.True(t, ok)
		assert.Equal(t, 2, version.Major)

		source, ok := GetAPIVersionSource(r.Context())
		require.True(t, ok)
		assert.Equal(t, "query", source)

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))

	req := httptest.NewRequest("GET", "/users?version=2.0", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "v2.0.0", w.Header().Get("API-Version"))
}

func TestVersioningMiddleware_UnsupportedVersion(t *testing.T) {
	config := DefaultVersioningConfig()
	config.SupportedVersions = []APIVersion{
		{Major: 1, Minor: 0, Patch: 0},
	}
	config.StrictMode = true

	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	mw := NewVersioningMiddleware(config, logger)

	handler := mw.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))

	req := httptest.NewRequest("GET", "/api/v5/users", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "API version v5.0.0 is not supported")
	assert.Contains(t, w.Body.String(), "UNSUPPORTED_API_VERSION")
}

func TestVersioningMiddleware_DeprecatedVersion(t *testing.T) {
	config := DefaultVersioningConfig()
	config.SupportedVersions = []APIVersion{
		{Major: 1, Minor: 0, Patch: 0},
		{Major: 2, Minor: 0, Patch: 0},
	}
	config.DeprecatedVersions = map[APIVersion]string{
		{Major: 1, Minor: 0, Patch: 0}: "2024-12-31T23:59:59Z",
	}

	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	mw := NewVersioningMiddleware(config, logger)

	handler := mw.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))

	req := httptest.NewRequest("GET", "/api/v1/users", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "true", w.Header().Get("Deprecation"))
	assert.Equal(t, "2024-12-31T23:59:59Z", w.Header().Get("Sunset"))
	assert.Equal(t, "</api/v1>; rel=\"successor-version\"", w.Header().Get("Link"))
}

func TestRequireAPIVersion(t *testing.T) {
	requiredVersion := APIVersion{Major: 2, Minor: 0, Patch: 0}
	middleware := RequireAPIVersion(requiredVersion)

	handler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))

	tests := []struct {
		name           string
		version        APIVersion
		expectedStatus int
	}{
		{
			name:           "Correct version",
			version:        APIVersion{Major: 2, Minor: 0, Patch: 0},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Wrong version",
			version:        APIVersion{Major: 1, Minor: 0, Patch: 0},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "No version in context",
			version:        APIVersion{},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)

			if tt.version.Major > 0 {
				ctx := context.WithValue(req.Context(), APIVersionKey, tt.version)
				req = req.WithContext(ctx)
			}

			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}

func TestRequireMinimumAPIVersion(t *testing.T) {
	minVersion := APIVersion{Major: 2, Minor: 1, Patch: 0}
	middleware := RequireMinimumAPIVersion(minVersion)

	handler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))

	tests := []struct {
		name           string
		version        APIVersion
		expectedStatus int
	}{
		{
			name:           "Equal version",
			version:        APIVersion{Major: 2, Minor: 1, Patch: 0},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Higher version",
			version:        APIVersion{Major: 3, Minor: 0, Patch: 0},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Lower version",
			version:        APIVersion{Major: 2, Minor: 0, Patch: 0},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			ctx := context.WithValue(req.Context(), APIVersionKey, tt.version)
			req = req.WithContext(ctx)

			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}

func BenchmarkVersioningMiddleware(b *testing.B) {
	config := DefaultVersioningConfig()
	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	mw := NewVersioningMiddleware(config, logger)

	handler := mw.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("GET", "/api/v1/test", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
	}
}
