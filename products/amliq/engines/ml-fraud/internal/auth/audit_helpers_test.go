package auth

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSanitizeAuditDetail(t *testing.T) {
	t.Run("redacts bearer token", func(t *testing.T) {
		value := sanitizeAuditDetail("Authorization: Bearer abc.def.ghi")
		assert.NotContains(t, value, "abc.def.ghi")
		assert.Contains(t, value, "bearer [redacted]")
	})

	t.Run("redacts api key", func(t *testing.T) {
		value := sanitizeAuditDetail("X-API-Key: secret-key-123")
		assert.NotContains(t, value, "secret-key-123")
		assert.Contains(t, value, "X-API-Key: [redacted]")
	})
}

