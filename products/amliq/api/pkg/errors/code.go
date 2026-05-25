package errors

type ErrorCode string

const (
	ErrInvalidInput ErrorCode = "INVALID_INPUT"
	ErrNotFound     ErrorCode = "NOT_FOUND"
	ErrUnauthorized ErrorCode = "UNAUTHORIZED"
	ErrForbidden    ErrorCode = "FORBIDDEN"
	ErrConflict     ErrorCode = "CONFLICT"
	ErrInternal     ErrorCode = "INTERNAL_ERROR"
	ErrRateLimited  ErrorCode = "RATE_LIMITED"
	ErrMalformed    ErrorCode = "MALFORMED"
)

func (e ErrorCode) String() string {
	return string(e)
}
