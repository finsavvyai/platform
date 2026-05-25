package api

import "net/http"

// statusRecorder captures the response status so middleware can
// decide whether to record billable usage. Wraps an http.ResponseWriter
// transparently — callers must use it as a drop-in replacement for the
// underlying writer for the duration of the inner handler.
type statusRecorder struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.wroteHeader = true
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusRecorder) Write(b []byte) (int, error) {
	if !s.wroteHeader {
		s.wroteHeader = true
	}
	return s.ResponseWriter.Write(b)
}
