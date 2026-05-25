package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/stretchr/testify/assert"
)

func TestValidateTransactionAmount(t *testing.T) {
	v := validator.New()
	_ = v.RegisterValidation("transaction_amount", validateTransactionAmount)
	type w struct {
		Amount float64 `validate:"transaction_amount"`
	}
	assert.NoError(t, v.Struct(w{Amount: 100.00}))
	assert.NoError(t, v.Struct(w{Amount: 0.01}))
	assert.NoError(t, v.Struct(w{Amount: 1000000.00}))
	assert.Error(t, v.Struct(w{Amount: 0.001}))
	assert.Error(t, v.Struct(w{Amount: 1000001.00}))
}

func TestValidateMerchantID(t *testing.T) {
	v := validator.New()
	_ = v.RegisterValidation("merchant_id", validateMerchantID)
	type w struct {
		ID string `validate:"merchant_id"`
	}
	assert.NoError(t, v.Struct(w{ID: "550e8400-e29b-41d4-a716-446655440000"}))
	assert.Error(t, v.Struct(w{ID: "short"}))
}

func TestValidatePaymentMethod(t *testing.T) {
	v := validator.New()
	_ = v.RegisterValidation("payment_method", validatePaymentMethod)
	type w struct {
		Method string `validate:"payment_method"`
	}
	valid := []string{"credit_card", "debit_card", "bank_transfer", "digital_wallet"}
	for _, m := range valid {
		assert.NoError(t, v.Struct(w{Method: m}), m)
	}
	assert.Error(t, v.Struct(w{Method: "bitcoin"}))
}

func TestValidateUserID(t *testing.T) {
	v := validator.New()
	_ = v.RegisterValidation("user_id", validateUserID)
	type w struct {
		ID string `validate:"user_id"`
	}
	assert.NoError(t, v.Struct(w{ID: "550e8400-e29b-41d4-a716-446655440000"}))
	assert.Error(t, v.Struct(w{ID: "short"}))
}

func TestValidateRiskScore(t *testing.T) {
	v := validator.New()
	_ = v.RegisterValidation("risk_score", validateRiskScore)
	type w struct {
		Score float64 `validate:"risk_score"`
	}
	assert.NoError(t, v.Struct(w{Score: 0.0}))
	assert.NoError(t, v.Struct(w{Score: 0.5}))
	assert.NoError(t, v.Struct(w{Score: 1.0}))
	assert.Error(t, v.Struct(w{Score: -0.1}))
	assert.Error(t, v.Struct(w{Score: 1.1}))
}

func TestHelperFunctions(t *testing.T) {
	r := Required()
	assert.True(t, r.Required)

	o := Optional()
	assert.False(t, o.Required)

	min := 3
	max := 10
	s := String(&min, &max)
	assert.Equal(t, "string", s.Type)
	assert.Equal(t, &min, s.MinLength)

	minF := 0.0
	maxF := 100.0
	i := Int(&minF, &maxF)
	assert.Equal(t, "int", i.Type)

	f := Float(&minF, &maxF)
	assert.Equal(t, "float", f.Type)

	e := Enum("a", "b", "c")
	assert.Equal(t, "enum", e.Type)
	assert.Len(t, e.Enum, 3)

	d := Date("2006-01-02")
	assert.Equal(t, "date", d.Type)
	assert.Equal(t, "2006-01-02", d.DateFormat)
}

func TestHasValidationRules(t *testing.T) {
	vm := NewValidationMiddleware(&ValidationConfig{
		EnableStructValidation: true,
		ValidationRules: map[string]map[string]ValidationRule{
			"/api/v1/transactions": {"amount": {Type: "float"}},
		},
	})
	assert.True(t, vm.hasValidationRules("/api/v1/transactions"))
	assert.False(t, vm.hasValidationRules("/api/v1/unknown"))
}

func TestHeader_RequiredMissing(t *testing.T) {
	cfg := &ValidationConfig{EnableHeaderValidation: true}
	vm := NewValidationMiddleware(cfg)
	rules := map[string]ValidationRule{
		"X-API-Key": {Required: true, Type: "string"},
	}
	router := gin.New()
	router.GET("/test", vm.Header(rules), func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHeader_RequiredPresent(t *testing.T) {
	cfg := &ValidationConfig{EnableHeaderValidation: true}
	vm := NewValidationMiddleware(cfg)
	rules := map[string]ValidationRule{
		"X-API-Key": {Required: true, Type: "string"},
	}
	router := gin.New()
	router.GET("/test", vm.Header(rules), func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-API-Key", "test-key-value")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHeader_Disabled(t *testing.T) {
	cfg := &ValidationConfig{EnableHeaderValidation: false}
	vm := NewValidationMiddleware(cfg)
	rules := map[string]ValidationRule{"X-Required": {Required: true}}
	router := gin.New()
	router.GET("/test", vm.Header(rules), func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestValidateField_AllTypes(t *testing.T) {
	vm := NewValidationMiddleware(nil)
	types := []struct {
		typ   string
		value string
		valid bool
	}{
		{"string", "hello", true},
		{"int", "42", true},
		{"float", "3.14", true},
		{"bool", "true", true},
		{"uuid", "550e8400-e29b-41d4-a716-446655440000", true},
		{"email", "user@test.com", true},
		{"url", "https://example.com", true},
		{"date", "2026-01-01", true},
		{"datetime", "2026-01-01T00:00:00Z", true},
		{"enum", "a", true},
		{"json", `{"k":"v"}`, true},
		{"base64", "aGVsbG8=", true},
	}
	for _, tc := range types {
		t.Run(tc.typ, func(t *testing.T) {
			rule := ValidationRule{Type: tc.typ, Enum: []string{"a", "b"}}
			err := vm.validateField(tc.value, rule)
			if tc.valid {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
		})
	}
}
