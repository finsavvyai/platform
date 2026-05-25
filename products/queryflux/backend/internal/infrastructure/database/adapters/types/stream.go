package types

// StreamOptions configures Stream behaviour. See QUERY_CONTRACT.md §2.
type StreamOptions struct {
	MaxRows    int64 // hard cap, 0 = use default (10000)
	BatchSize  int   // suggested driver fetch size, default 1000
	BufferSize int   // chan buffer, default 64
}

// StreamRow is a single row pushed by Stream. Columns are valid on every row
// (cheap re-use of the underlying slice header is fine for the receiver).
type StreamRow struct {
	Columns []string
	Values  []any
	Index   int64
}

// Defaults applied to a zero-value StreamOptions.
const (
	DefaultStreamMaxRows    int64 = 10000
	DefaultStreamBatchSize  int   = 1000
	DefaultStreamBufferSize int   = 64
)

// Normalize fills zero fields with Phase 1 defaults.
func (o StreamOptions) Normalize() StreamOptions {
	if o.MaxRows <= 0 {
		o.MaxRows = DefaultStreamMaxRows
	}
	if o.BatchSize <= 0 {
		o.BatchSize = DefaultStreamBatchSize
	}
	if o.BufferSize <= 0 {
		o.BufferSize = DefaultStreamBufferSize
	}
	return o
}
