// Package observability provides Sentry initialization for the gateway.
//
// Sentry is initialised at process start when SENTRY_DSN is set in the
// environment. With no DSN, Init returns a clean shutdown function and
// the rest of the codebase can call CaptureException freely as a no-op.
//
// Sample rate, environment, and release are env-driven so deploys can
// dial down sampling without code changes:
//
//	SENTRY_DSN              required to enable
//	SENTRY_ENVIRONMENT      defaults to "development"
//	SENTRY_RELEASE          defaults to "" (Sentry derives from CI)
//	SENTRY_TRACES_SAMPLE_RATE float64, defaults to 0.1
package observability

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"time"

	"github.com/getsentry/sentry-go"
)

// FlushFunc flushes pending Sentry events; call from a defer in main().
type FlushFunc func()

// InitSentry initialises Sentry from environment variables. Returns a
// FlushFunc that callers MUST defer in main; the returned function is a
// no-op when Sentry is disabled, so it is always safe to defer.
func InitSentry(ctx context.Context, logger *slog.Logger) (FlushFunc, error) {
	dsn := os.Getenv("SENTRY_DSN")
	if dsn == "" {
		logger.Info("sentry disabled (SENTRY_DSN unset)")
		return func() {}, nil
	}

	tracesSampleRate := 0.1
	if raw := os.Getenv("SENTRY_TRACES_SAMPLE_RATE"); raw != "" {
		parsed, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			return nil, fmt.Errorf("SENTRY_TRACES_SAMPLE_RATE: %w", err)
		}
		tracesSampleRate = parsed
	}

	env := os.Getenv("SENTRY_ENVIRONMENT")
	if env == "" {
		env = "development"
	}

	if err := sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		Environment:      env,
		Release:          os.Getenv("SENTRY_RELEASE"),
		TracesSampleRate: tracesSampleRate,
		AttachStacktrace: true,
	}); err != nil {
		return nil, fmt.Errorf("sentry init: %w", err)
	}

	logger.Info("sentry initialised",
		slog.String("environment", env),
		slog.Float64("traces_sample_rate", tracesSampleRate),
	)

	return func() {
		// Two-second flush window before process exit; Sentry's own
		// recommendation. Deliberately short so a panic at shutdown
		// can't keep the process alive forever.
		_ = sentry.Flush(2 * time.Second)
	}, nil
}

// CaptureException reports an error to Sentry. No-op when Sentry is not
// initialised. Safe to call from any goroutine.
func CaptureException(err error) {
	if err == nil {
		return
	}
	sentry.CaptureException(err)
}
