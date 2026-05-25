package types

// NewNotImplementedStream returns a pair of channels matching the canonical
// Stream contract for adapters that have not implemented streaming in Phase 1.
//
// The rows channel is already closed; the error channel emits exactly one
// terminal AdapterError sentinel-wrapping ErrInvalidParam, then closes. This
// keeps callers compatible with the (<-chan StreamRow, <-chan error) shape
// while signalling the feature is unavailable.
func NewNotImplementedStream(reason string) (<-chan StreamRow, <-chan error) {
	rowCh := make(chan StreamRow)
	close(rowCh)

	errCh := make(chan error, 1)
	errCh <- (&AdapterError{
		Code:    "STREAM_NOT_IMPLEMENTED",
		Message: "Stream not implemented for this adapter in Phase 1",
		Details: reason,
	}).WithSentinel(ErrInvalidParam)
	close(errCh)

	return rowCh, errCh
}
