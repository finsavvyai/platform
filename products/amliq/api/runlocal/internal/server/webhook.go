package server

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/finsavvyai/pushci/internal/detect"
	"github.com/finsavvyai/pushci/internal/platform"
	"github.com/finsavvyai/pushci/internal/runner"
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
			http.Error(w, "provider not configured", 404)
			return
		}
		event, err := provider.ParseWebhook(r)
		if err != nil {
			log.Printf("[%s] parse error: %v", name, err)
			http.Error(w, err.Error(), 401)
			return
		}
		log.Printf("[%s] %s %s@%s by %s",
			name, event.Action, event.Repo, event.Branch, event.Sender)

		w.WriteHeader(200)
		fmt.Fprint(w, `{"accepted":true}`)

		go s.runPipeline(provider, event)
	}
}

func (s *Server) runPipeline(provider platform.Provider, event *platform.Event) {
	ctx := context.Background()

	// Post pending status
	provider.PostStatus(ctx, event, &platform.Status{
		SHA: event.SHA, State: platform.StatePending,
		Context: "pushci/ci", Description: "Running checks...",
	})

	// Execute checks
	result := runner.Execute(ctx, s.repoRoot, s.projects)

	// Post final status
	state := platform.StateSuccess
	desc := fmt.Sprintf("All checks passed (%s)", result.Elapsed)
	if !result.Passed {
		state = platform.StateFailure
		desc = fmt.Sprintf("Checks failed (%s)", result.Elapsed)
	}
	provider.PostStatus(ctx, event, &platform.Status{
		SHA: event.SHA, State: state,
		Context: "pushci/ci", Description: desc,
	})

	// Post PR comment with results
	if event.PRNumber > 0 {
		provider.PostComment(ctx, event, result.Summary())
	}
}
