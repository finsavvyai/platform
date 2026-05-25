package errors

import (
	"net/http"
	"testing"
)

func TestAppError(t *testing.T) {
	tests := []struct {
		name           string
		code           ErrorCode
		message        string
		expectedStatus int
	}{
		{
			name:           "invalid_input",
			code:           ErrInvalidInput,
			message:        "test message",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "not_found",
			code:           ErrNotFound,
			message:        "not found",
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "unauthorized",
			code:           ErrUnauthorized,
			message:        "unauthorized",
			expectedStatus: http.StatusUnauthorized,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := New(tt.code, tt.message)
			if err.HTTPStatus != tt.expectedStatus {
				t.Errorf("HTTPStatus = %d, want %d", err.HTTPStatus, tt.expectedStatus)
			}
			if err.Message != tt.message {
				t.Errorf("Message = %s, want %s", err.Message, tt.message)
			}
		})
	}
}

func TestWithDetails(t *testing.T) {
	err := New(ErrInvalidInput, "bad request")
	err.WithDetails("field 'name' is required")
	if err.Details != "field 'name' is required" {
		t.Errorf("Details not set correctly")
	}
}
