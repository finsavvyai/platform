// Package logger provides a minimal structured-logging interface used across
// the QuantumBeam engine. The interface mirrors slog-style key/value usage
// (variadic args after the message) so callers can pass pairs like
// ("error", err, "tenant", id).
//
// This package was reintroduced during the AMLIQ migration. The original
// internal logger module was lost during the move from the standalone repo;
// this minimal implementation lets dependent packages (billing, webhooks)
// compile while the broader logging story is consolidated under
// /products/amliq/internal/shared/.
package logger

import (
	"log"
	"os"
)

// Logger is the structured-logging contract used by billing, webhooks, and
// other internal packages. Implementations should treat trailing variadic
// args as alternating key/value pairs for structured output.
type Logger interface {
	Debug(msg string, args ...any)
	Info(msg string, args ...any)
	Warn(msg string, args ...any)
	Error(msg string, args ...any)
}

// stdLogger is a no-frills implementation backed by the standard library
// log package. It is the default returned by New() and is safe for
// concurrent use because log.Logger itself is safe.
type stdLogger struct {
	l *log.Logger
}

// New returns a Logger that writes to stderr with a "[level]" prefix.
func New() Logger {
	return &stdLogger{l: log.New(os.Stderr, "", log.LstdFlags|log.Lmicroseconds)}
}

func (s *stdLogger) Debug(msg string, args ...any) { s.write("DEBUG", msg, args) }
func (s *stdLogger) Info(msg string, args ...any)  { s.write("INFO", msg, args) }
func (s *stdLogger) Warn(msg string, args ...any)  { s.write("WARN", msg, args) }
func (s *stdLogger) Error(msg string, args ...any) { s.write("ERROR", msg, args) }

func (s *stdLogger) write(level, msg string, args []any) {
	if len(args) == 0 {
		s.l.Printf("[%s] %s", level, msg)
		return
	}
	// Format args as key=value pairs; an odd trailing arg is logged as-is.
	pairs := ""
	for i := 0; i < len(args); i += 2 {
		if i+1 < len(args) {
			pairs += " " + toString(args[i]) + "=" + toString(args[i+1])
		} else {
			pairs += " " + toString(args[i])
		}
	}
	s.l.Printf("[%s] %s%s", level, msg, pairs)
}

func toString(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case error:
		if x == nil {
			return "<nil>"
		}
		return x.Error()
	default:
		// Fall back to fmt-style formatting; avoid pulling in fmt just for this
		// in the hot path — log.Logger does the heavy lifting in write().
		return defaultFormat(v)
	}
}
