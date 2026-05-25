package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// LogEntry represents a structured log record.
type LogEntry struct {
	Timestamp string            `json:"ts"`
	Level     string            `json:"level"`
	Message   string            `json:"msg"`
	Fields    map[string]string `json:"fields,omitempty"`
}

// Logger writes structured JSON logs to stdout.
type Logger struct{}

// NewLogger creates a Logger.
func NewLogger() *Logger { return &Logger{} }

func (l *Logger) write(level, msg string, fields map[string]string) {
	entry := LogEntry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Level:     level,
		Message:   msg,
		Fields:    fields,
	}
	data, _ := json.Marshal(entry)
	fmt.Fprintln(os.Stdout, string(data))
}

// Info logs an informational message.
func (l *Logger) Info(msg string, fields map[string]string) {
	l.write("info", msg, fields)
}

// Warn logs a warning message.
func (l *Logger) Warn(msg string, fields map[string]string) {
	l.write("warn", msg, fields)
}

// Error logs an error message.
func (l *Logger) Error(msg string, fields map[string]string) {
	l.write("error", msg, fields)
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (sw *statusWriter) WriteHeader(code int) {
	sw.status = code
	sw.ResponseWriter.WriteHeader(code)
}

// RequestLogging returns middleware that logs each request.
func (l *Logger) RequestLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(sw, r)
		dur := time.Since(start)

		ip := r.Header.Get("X-Forwarded-For")
		if ip == "" {
			ip = r.RemoteAddr
		}
		l.Info("request", map[string]string{
			"method":   r.Method,
			"path":     r.URL.Path,
			"status":   fmt.Sprintf("%d", sw.status),
			"duration": dur.String(),
			"ip":       ip,
		})
	})
}
