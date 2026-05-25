package server

// handlers_queries_runner.go bridges the HTTP layer to the safe query runner.
//
// It provides:
//   - resolveAdapter: connection entity -> types.DatabaseAdapter (live driver)
//     via the canonical factory in adapters/enhanced_factory.go.
//   - streamAdapterShim: an adapter wrapper that satisfies query.StreamAdapter
//     (no opts) by delegating to types.DatabaseAdapter.Stream(opts).
//
// All HTTP error bodies routed through this file MUST use SafeErrorMessage
// (see handlers_error_mapper.go) — raw err.Error() never leaves the process.

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/application/services/query"
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
	"github.com/sirupsen/logrus"
)

// resolveAdapter materialises a live driver-backed adapter for conn.
//
// Caller MUST defer adapter.Disconnect(ctx) on success. The returned error
// is sentinel-wrapped where possible so MapAdapterErrorToHTTP /
// SafeErrorMessage produce the correct HTTP code + body.
func (s *Server) resolveAdapter(ctx context.Context, conn *entities.Connection) (types.DatabaseAdapter, error) {
	if s.adapterFactory == nil {
		return nil, types.ErrNotConnected
	}
	adapter, err := s.adapterFactory.CreateAdapter(conn)
	if err != nil {
		return nil, err
	}
	if err := adapter.Connect(ctx, conn); err != nil {
		// Best-effort cleanup; ignore disconnect error (we already failed).
		_ = adapter.Disconnect(ctx)
		return nil, err
	}
	return adapter, nil
}

// adapterFactoryGetter is implemented by *adapters.Factory. Indirected so
// future swaps to EnhancedFactory (caching/pooling) don't ripple.
type adapterFactoryGetter interface {
	CreateAdapter(conn *entities.Connection) (types.DatabaseAdapter, error)
}

// Compile-time assertion that the canonical factory satisfies the iface.
var _ adapterFactoryGetter = (*adapters.Factory)(nil)

// streamAdapterShim adapts a types.DatabaseAdapter (which requires
// StreamOptions on the Stream method) to query.StreamAdapter (which does
// not). Runner-side caps are still enforced by SafeQueryRunner; the shim
// passes a normalized StreamOptions through with MaxRows=0 so the runner's
// per-call opts.MaxRows takes precedence.
type streamAdapterShim struct {
	inner types.DatabaseAdapter
	opts  types.StreamOptions
}

// newStreamAdapterShim wraps adapter with the supplied stream options.
func newStreamAdapterShim(adapter types.DatabaseAdapter, opts types.StreamOptions) *streamAdapterShim {
	return &streamAdapterShim{inner: adapter, opts: opts.Normalize()}
}

// Stream forwards to the wrapped adapter, converting types.StreamRow to
// the package-local query.StreamRow envelope.
func (s *streamAdapterShim) Stream(
	ctx context.Context,
	sql string,
	params ...interface{},
) (<-chan query.StreamRow, <-chan error) {
	rawRowCh, errCh := s.inner.Stream(ctx, sql, s.opts, params...)
	rowCh := make(chan query.StreamRow, cap(rawRowCh)+1)
	go func() {
		defer close(rowCh)
		for r := range rawRowCh {
			select {
			case <-ctx.Done():
				return
			case rowCh <- query.StreamRow{
				Columns: r.Columns,
				Values:  r.Values,
				Index:   r.Index,
			}:
			}
		}
	}()
	return rowCh, errCh
}

// ensureRunner returns the configured runner or constructs a default
// in-memory one when the server was built without DI. This keeps unit
// tests that instantiate a bare *Server functional.
//
// TODO(phase-2): persistent audit logger backed by Postgres; replace
// InMemoryAuditLogger here.
func (s *Server) ensureRunner() *query.SafeQueryRunner {
	if s.queryRunner != nil {
		return s.queryRunner
	}
	s.queryRunner = query.NewSafeQueryRunner(query.NewInMemoryAuditLogger())
	return s.queryRunner
}

// ensureFactory returns the configured factory, lazily creating the
// default one if DI did not inject it (test path).
func (s *Server) ensureFactory() adapterFactoryGetter {
	if s.adapterFactory != nil {
		return s.adapterFactory
	}
	s.adapterFactory = adapters.NewFactory(logrus.New())
	return s.adapterFactory
}

// respondWithAdapterError maps a sentinel-wrapped adapter error to the
// correct HTTP status + sanitised message. The raw err is logged WITH the
// connection's RedactedDSN (never the raw DSN) so operators can trace
// failures without leaking credentials.
//
// Callers MUST pass an err that has already traversed the runner (which
// guarantees sentinel wrapping). Direct adapter errors are also safe — the
// mapper falls back to 500 + "internal error" for unknown errors.
func (s *Server) respondWithAdapterError(
	c *gin.Context,
	conn *entities.Connection,
	stage string,
	err error,
) {
	status := MapAdapterErrorToHTTP(err)
	safeMsg := SafeErrorMessage(err)

	dsn := ""
	if conn != nil {
		dsn = conn.RedactedDSN()
	}
	logrus.WithFields(logrus.Fields{
		"stage":         stage,
		"status":        status,
		"redacted_dsn":  dsn,
		"connection_id": c.Param("id"),
		"user_id":       c.GetString("user_id"),
	}).WithError(err).Warn("adapter error mapped to HTTP")

	s.respondWithError(c, status, errCodeForStatus(status), safeMsg, nil)
}

// errCodeForStatus returns the stable error code string for a sentinel-
// mapped HTTP status. Mirrors the codes used elsewhere in errors.go.
func errCodeForStatus(status int) string {
	switch status {
	case 400:
		return ErrCodeInvalidInput
	case 401:
		return ErrCodeUnauthorized
	case 403:
		return ErrCodeForbidden
	case 404:
		return ErrCodeNotFound
	case 409:
		return ErrCodeConflict
	case 413:
		return "PAYLOAD_TOO_LARGE"
	case 503:
		return ErrCodeServiceUnavailable
	case 504:
		return ErrCodeTimeout
	default:
		return ErrCodeInternalError
	}
}
