//go:build ignore

package services

import (
	"github.com/sdlc-ai/platform/services/gateway/internal/domain/types"
)

// SessionManager manages user sessions and refresh tokens.
// This is a minimal interface definition; the full implementation
// is in the token_rotation package.
type SessionManager interface{}

// UploadSession is an alias for the types package
type UploadSession = types.UploadSession

// UploadProgress is an alias for the types package
type UploadProgress = types.UploadProgress

// Helper functions for type conversions

func convertStringMap(m map[string]string) map[string]interface{} {
	result := make(map[string]interface{}, len(m))
	for k, v := range m {
		result[k] = v
	}
	return result
}

func convertSliceToJSONB(s []string) map[string]interface{} {
	result := make(map[string]interface{}, len(s))
	for i, v := range s {
		result[v] = i
	}
	return result
}

func jsonbToStringSlice(m map[string]interface{}) []string {
	result := make([]string, 0, len(m))
	for k := range m {
		result = append(result, k)
	}
	return result
}

func jsonbToStringMap(m map[string]interface{}) map[string]string {
	result := make(map[string]string, len(m))
	for k, v := range m {
		if s, ok := v.(string); ok {
			result[k] = s
		}
	}
	return result
}

func profileString(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
