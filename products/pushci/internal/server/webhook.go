package server

import (
	"fmt"
	"log"
	"net/http"

	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/platform"
)

// Server receives webhooks and dispatches CI runs.
type Server struct {
	providers map[string]platform.Provider
	repoRoot  string
	projects  []detect.Project
}

// New creates a webhook server.
func New(root string, projects []detect.Project) *Server {
	return &Server{
		providers: make(map[string]platform.Provider),
		repoRoot:  root,
		projects:  projects,
	}
}

// RegisterProvider adds a platform provider.
func (s *Server) RegisterProvider(name string, p platform.Provider) {
	s.providers[name] = p
}

// Handler returns an HTTP handler for webhooks.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/webhook/github", s.handle("github"))
	mux.HandleFunc("/webhook/gitlab", s.handle("gitlab"))
	mux.HandleFunc("/webhook/bitbucket", s.handle("bitbucket"))
	mux.HandleFunc("/webhook/circleci", s.handle("circleci"))
	mux.HandleFunc("/webhook/azure", s.handle("azure"))
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(200)
		fmt.Fprint(w, `{"status":"ok"}`)
	})
	return mux
}

func (s *Server) handle(name string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		provider, ok := s.providers[name]
		if !ok {
			http.Error(w, "provider not configured", http.StatusNotFound)
			return
		}
		event, err := provider.ParseWebhook(r)
		if err != nil {
			log.Printf("[%s] parse error: %v", name, err)
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		log.Printf("[%s] %s %s@%s by %s",
			name, event.Action, event.Repo, event.Branch, event.Sender)

		w.WriteHeader(200)
		fmt.Fprint(w, `{"accepted":true}`)

		go s.runPipeline(provider, event) // defined in webhook_dispatch.go
	}
}
