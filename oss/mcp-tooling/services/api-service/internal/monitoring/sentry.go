package monitoring

import (
	"fmt"
	"log"
	"time"

	"github.com/getsentry/sentry-go"
	sentrygin "github.com/getsentry/sentry-go/gin"
	"github.com/gin-gonic/gin"
)

// SentryConfig holds Sentry configuration
type SentryConfig struct {
	DSN              string
	Environment      string
	Release          string
	TracesSampleRate float64
	Debug            bool
	AttachStacktrace bool
}

// InitSentry initializes Sentry error tracking
func InitSentry(config SentryConfig) error {
	if config.DSN == "" {
		log.Println("Sentry DSN not configured, error tracking disabled")
		return nil
	}

	err := sentry.Init(sentry.ClientOptions{
		Dsn:              config.DSN,
		Environment:      config.Environment,
		Release:          config.Release,
		TracesSampleRate: config.TracesSampleRate,
		Debug:            config.Debug,
		AttachStacktrace: config.AttachStacktrace,
		BeforeSend: func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {
			// Filter out sensitive information before sending to Sentry
			if event.Request != nil {
				// Remove sensitive headers
				if event.Request.Headers != nil {
					delete(event.Request.Headers, "Authorization")
					delete(event.Request.Headers, "Cookie")
					delete(event.Request.Headers, "X-API-Key")
				}

				// Remove sensitive query parameters
				if event.Request.QueryString != "" {
					// You can add custom filtering here
				}
			}

			return event
		},
	})

	if err != nil {
		return fmt.Errorf("failed to initialize Sentry: %w", err)
	}

	log.Printf("Sentry initialized for environment: %s", config.Environment)
	return nil
}

// SentryMiddleware returns a Gin middleware that integrates with Sentry
func SentryMiddleware() gin.HandlerFunc {
	return sentrygin.New(sentrygin.Options{
		Repanic:         true,
		WaitForDelivery: false,
		Timeout:         2 * time.Second,
	})
}

// CaptureError captures an error and sends it to Sentry
func CaptureError(err error) {
	if err != nil {
		sentry.CaptureException(err)
	}
}

// CaptureErrorWithContext captures an error with additional context
func CaptureErrorWithContext(err error, context map[string]interface{}) {
	if err != nil {
		sentry.WithScope(func(scope *sentry.Scope) {
			for key, value := range context {
				scope.SetExtra(key, value)
			}
			sentry.CaptureException(err)
		})
	}
}

// CaptureMessage captures a message and sends it to Sentry
func CaptureMessage(message string, level sentry.Level) {
	sentry.WithScope(func(scope *sentry.Scope) {
		scope.SetLevel(level)
		sentry.CaptureMessage(message)
	})
}

// SetUser sets the current user context for Sentry
func SetUser(c *gin.Context, userID string, email string, username string) {
	if hub := sentrygin.GetHubFromContext(c); hub != nil {
		hub.ConfigureScope(func(scope *sentry.Scope) {
			scope.SetUser(sentry.User{
				ID:       userID,
				Email:    email,
				Username: username,
			})
		})
	}
}

// SetTag sets a custom tag for the current scope
func SetTag(c *gin.Context, key string, value string) {
	if hub := sentrygin.GetHubFromContext(c); hub != nil {
		hub.ConfigureScope(func(scope *sentry.Scope) {
			scope.SetTag(key, value)
		})
	}
}

// SetContext sets custom context data
func SetContext(c *gin.Context, key string, value map[string]interface{}) {
	if hub := sentrygin.GetHubFromContext(c); hub != nil {
		hub.ConfigureScope(func(scope *sentry.Scope) {
			scope.SetContext(key, value)
		})
	}
}

// AddBreadcrumb adds a breadcrumb to track user actions
func AddBreadcrumb(c *gin.Context, message string, category string, level sentry.Level) {
	if hub := sentrygin.GetHubFromContext(c); hub != nil {
		hub.AddBreadcrumb(&sentry.Breadcrumb{
			Message:   message,
			Category:  category,
			Level:     level,
			Timestamp: time.Now(),
		}, nil)
	}
}

// CaptureGinError captures a Gin context error
func CaptureGinError(c *gin.Context, err error) {
	if err == nil {
		return
	}

	if hub := sentrygin.GetHubFromContext(c); hub != nil {
		hub.WithScope(func(scope *sentry.Scope) {
			// Add request context
			scope.SetContext("request", map[string]interface{}{
				"method":      c.Request.Method,
				"url":         c.Request.URL.String(),
				"user_agent":  c.Request.UserAgent(),
				"remote_addr": c.ClientIP(),
			})

			// Add user context if available
			if userID, exists := c.Get("user_id"); exists {
				scope.SetUser(sentry.User{
					ID: fmt.Sprintf("%v", userID),
				})
			}

			hub.CaptureException(err)
		})
	}
}

// Flush waits for all events to be sent to Sentry
// Call this before shutting down the application
func Flush(timeout time.Duration) bool {
	return sentry.Flush(timeout)
}

// Performance monitoring helpers

// StartTransaction starts a new transaction for performance monitoring
func StartTransaction(c *gin.Context, name string, operation string) *sentry.Span {
	if hub := sentrygin.GetHubFromContext(c); hub != nil {
		transaction := sentry.StartTransaction(c,
			name,
			sentry.WithOpName(operation),
		)
		c.Set("sentry_transaction", transaction)
		return transaction
	}
	return nil
}

// StartSpan starts a child span for the current transaction
func StartSpan(c *gin.Context, operation string, description string) *sentry.Span {
	transaction, exists := c.Get("sentry_transaction")
	if !exists {
		return nil
	}

	if tx, ok := transaction.(*sentry.Span); ok {
		span := tx.StartChild(operation)
		span.Description = description
		return span
	}

	return nil
}

// FinishSpan finishes a span
func FinishSpan(span *sentry.Span) {
	if span != nil {
		span.Finish()
	}
}

// RecordError records an error in the current span
func RecordError(span *sentry.Span, err error) {
	if span != nil && err != nil {
		span.Status = sentry.SpanStatusInternalError
		span.SetData("error", err.Error())
	}
}
