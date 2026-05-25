package ports

import "errors"

var (
	// ErrNotFound is returned when a requested resource is not found
	ErrNotFound = errors.New("resource not found")

	// ErrInvalidInput is returned when input validation fails
	ErrInvalidInput = errors.New("invalid input")

	// ErrInternal is returned when an internal error occurs
	ErrInternal = errors.New("internal error")
)
