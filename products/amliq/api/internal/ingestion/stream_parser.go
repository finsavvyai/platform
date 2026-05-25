package ingestion

import (
	"io"

	"github.com/aegis-aml/aegis/internal/domain"
)

// EntityEmitter is called once per parsed entity. Returning an error
// halts parsing. The streaming sync path uses this to flush entities
// in batches rather than holding the whole list in RAM.
type EntityEmitter func(domain.Entity) error

// StreamParser is implemented by parsers that can emit entities
// incrementally from an io.Reader. Memory-heavy parsers (anything
// sourced from a multi-hundred-thousand-row feed) MUST implement
// this; the plain Parser interface materialises the full slice and
// blows the API pod's heap.
//
// Parsers may implement both Parser and StreamParser. When both are
// present SyncService prefers the streaming path.
type StreamParser interface {
	ParseStream(r io.Reader, emit EntityEmitter) error
}
