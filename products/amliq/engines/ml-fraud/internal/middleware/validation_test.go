package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestNewValidationMiddleware_DefaultConfig(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	assert.NotNil(t, vm)
	assert.True(t, vm.config.EnableStructValidation)
	assert.True(t, vm.config.EnableQueryValidation)
	assert.False(t, vm.config.EnableHeaderValidation)
}

func TestNewValidationMiddleware_CustomConfig(t *testing.T) {
	cfg := &ValidationConfig{
		EnableStructValidation: false,
		EnableQueryValidation:  false,
		EnableHeaderValidation: true,
		StrictMode:             true,
	}
	vm := NewValidationMiddleware(cfg)
	assert.False(t, vm.config.EnableStructValidation)
	assert.True(t, vm.config.EnableHeaderValidation)
}

func TestValidateString(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	minLen := 3
	maxLen := 10
	assert.NoError(t, vm.validateString("hello", ValidationRule{MinLength: &minLen}))
	assert.Error(t, vm.validateString("ab", ValidationRule{MinLength: &minLen}))
	assert.NoError(t, vm.validateString("short", ValidationRule{MaxLength: &maxLen}))
	assert.Error(t, vm.validateString("this is too long", ValidationRule{MaxLength: &maxLen}))
}

func TestValidateInt(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	min := float64(1)
	max := float64(100)
	assert.NoError(t, vm.validateInt("42", ValidationRule{}))
	assert.Error(t, vm.validateInt("abc", ValidationRule{}))
	assert.NoError(t, vm.validateInt("50", ValidationRule{Min: &min, Max: &max}))
	assert.Error(t, vm.validateInt("0", ValidationRule{Min: &min}))
	assert.Error(t, vm.validateInt("101", ValidationRule{Max: &max}))
}

func TestValidateFloat(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	min := 0.0
	max := 1.0
	assert.NoError(t, vm.validateFloat("0.5", ValidationRule{Min: &min, Max: &max}))
	assert.Error(t, vm.validateFloat("abc", ValidationRule{}))
	assert.Error(t, vm.validateFloat("-1.0", ValidationRule{Min: &min}))
	assert.Error(t, vm.validateFloat("1.5", ValidationRule{Max: &max}))
}

func TestValidateBool(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	assert.NoError(t, vm.validateBool("true", ValidationRule{}))
	assert.NoError(t, vm.validateBool("false", ValidationRule{}))
	assert.NoError(t, vm.validateBool("1", ValidationRule{}))
	assert.NoError(t, vm.validateBool("0", ValidationRule{}))
	assert.Error(t, vm.validateBool("yes", ValidationRule{}))
}

func TestValidateUUID(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	assert.NoError(t, vm.validateUUID("550e8400-e29b-41d4-a716-446655440000", ValidationRule{}))
	assert.NoError(t, vm.validateUUID("550e8400e29b41d4a716446655440000", ValidationRule{}))
	assert.Error(t, vm.validateUUID("not-a-uuid", ValidationRule{}))
}

func TestValidateEmail(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	assert.NoError(t, vm.validateEmail("user@example.com", ValidationRule{}))
	assert.Error(t, vm.validateEmail("invalid", ValidationRule{}))
}

func TestValidateURL_Middleware(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	assert.NoError(t, vm.validateURL("https://example.com", ValidationRule{}))
	assert.NoError(t, vm.validateURL("http://localhost", ValidationRule{}))
	assert.Error(t, vm.validateURL("ftp://invalid", ValidationRule{}))
}

func TestValidateDate(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	assert.NoError(t, vm.validateDate("2026-01-15", ValidationRule{}))
	assert.Error(t, vm.validateDate("not-a-date", ValidationRule{}))
	assert.NoError(t, vm.validateDate("01/15/2026", ValidationRule{DateFormat: "01/02/2006"}))
}

func TestValidateDateTime(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	assert.NoError(t, vm.validateDateTime("2026-01-15T10:30:00Z", ValidationRule{}))
	assert.NoError(t, vm.validateDateTime("2026-01-15 10:30:00", ValidationRule{}))
	assert.Error(t, vm.validateDateTime("not-a-datetime", ValidationRule{}))
}

func TestValidateEnum(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	rule := ValidationRule{Enum: []string{"credit_card", "debit_card", "wire"}}
	assert.NoError(t, vm.validateEnum("credit_card", rule))
	assert.Error(t, vm.validateEnum("bitcoin", rule))
}

func TestValidateJSON(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	assert.NoError(t, vm.validateJSON(`{"key":"val"}`, ValidationRule{}))
	assert.NoError(t, vm.validateJSON(`[1,2,3]`, ValidationRule{}))
	assert.Error(t, vm.validateJSON("not json", ValidationRule{}))
}

func TestValidateBase64(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	assert.NoError(t, vm.validateBase64("aGVsbG8=", ValidationRule{}))
	assert.Error(t, vm.validateBase64("abc", ValidationRule{})) // len not multiple of 4
}

func TestTransformValue(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	tests := []struct {
		name      string
		value     string
		rule      ValidationRule
		expected  interface{}
	}{
		{"lowercase", "Hello", ValidationRule{Transform: "lowercase"}, "hello"},
		{"uppercase", "hello", ValidationRule{Transform: "uppercase"}, "HELLO"},
		{"trim", "  hello  ", ValidationRule{Transform: "trim"}, "hello"},
		{"slug", "Hello World", ValidationRule{Transform: "slug"}, "hello-world"},
		{"int type", "42", ValidationRule{Type: "int"}, 42},
		{"bool type", "true", ValidationRule{Type: "bool"}, true},
		{"default", "value", ValidationRule{}, "value"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result, err := vm.transformValue(tc.value, tc.rule)
			assert.NoError(t, err)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestTransformValue_FloatType(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	result, err := vm.transformValue("3.14", ValidationRule{Type: "float"})
	assert.NoError(t, err)
	assert.InDelta(t, 3.14, result, 0.001)
}

func TestQuery_RequiredMissing(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	rules := map[string]ValidationRule{"page": {Required: true, Type: "int"}}
	router := gin.New()
	router.GET("/test", vm.Query(rules), func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestQuery_RequiredWithDefault(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	rules := map[string]ValidationRule{
		"page": {Required: true, Type: "int", Default: 1},
	}
	router := gin.New()
	router.GET("/test", vm.Query(rules), func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestQuery_ValidationDisabled(t *testing.T) {
	cfg := &ValidationConfig{EnableQueryValidation: false}
	vm := NewValidationMiddleware(cfg)
	rules := map[string]ValidationRule{"page": {Required: true}}
	router := gin.New()
	router.GET("/test", vm.Query(rules), func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}
