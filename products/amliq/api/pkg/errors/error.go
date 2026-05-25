package errors

import (
	"fmt"
	"net/http"
)

type AppError struct {
	Code       ErrorCode
	Message    string
	Details    string
	HTTPStatus int
}

func New(code ErrorCode, message string) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		HTTPStatus: codeToStatus(code),
	}
}

func (e *AppError) WithDetails(details string) *AppError {
	e.Details = details
	return e
}

func (e *AppError) WithStatus(status int) *AppError {
	e.HTTPStatus = status
	return e
}

func (e *AppError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code.String(), e.Message)
}

func codeToStatus(code ErrorCode) int {
	switch code {
	case ErrInvalidInput, ErrMalformed:
		return http.StatusBadRequest
	case ErrNotFound:
		return http.StatusNotFound
	case ErrUnauthorized:
		return http.StatusUnauthorized
	case ErrForbidden:
		return http.StatusForbidden
	case ErrConflict:
		return http.StatusConflict
	case ErrRateLimited:
		return http.StatusTooManyRequests
	default:
		return http.StatusInternalServerError
	}
}
