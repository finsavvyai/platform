package server

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/finsavvyai/pipewarden/internal/logging"
)

type Server struct {
	srv    *http.Server
	logger *logging.Logger
}

func New(handler http.Handler, port int, logger *logging.Logger) *Server {
	return &Server{
		srv: &http.Server{
			Addr:         fmt.Sprintf(":%d", port),
			Handler:      handler,
			ReadTimeout:  15 * time.Second,
			WriteTimeout: 15 * time.Second,
			IdleTimeout:  60 * time.Second,
		},
		logger: logger,
	}
}

func (s *Server) ListenAndServe() error {
	return s.srv.ListenAndServe()
}

func (s *Server) Shutdown(ctx interface{}) error {
	return s.srv.Shutdown(ctx.(context.Context))
}
