package api

import (
	"context"
	"net/http"
)

type Server struct {
	mux    *http.ServeMux
	addr   string
	secLog *SecurityLogWriter
}

func NewServer(addr string) *Server {
	return &Server{
		mux:  http.NewServeMux(),
		addr: addr,
	}
}

// WithSecurityLog attaches DB-backed security logging.
func (s *Server) WithSecurityLog(w *SecurityLogWriter) {
	s.secLog = w
}

func (s *Server) RegisterHandler(pattern string, handler http.Handler) {
	s.mux.Handle(pattern, handler)
}

func (s *Server) RegisterFunc(pattern string, fn http.HandlerFunc) {
	s.mux.HandleFunc(pattern, fn)
}

func (s *Server) Start() error {
	var handler http.Handler = SecurityHeadersMiddleware(CORSMiddleware(s.mux))
	handler = SecurityLogger(s.secLog)(handler)
	return http.ListenAndServe(s.addr, handler)
}

func (s *Server) Shutdown(ctx context.Context) error {
	return nil
}

func (s *Server) GetMux() *http.ServeMux {
	return s.mux
}
