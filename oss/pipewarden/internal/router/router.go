package router

import (
	"net/http"

	"github.com/finsavvyai/pipewarden/internal/aianalysis"
	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/handlers"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/middleware"
	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/finsavvyai/pipewarden/internal/vault"
	"github.com/finsavvyai/pipewarden/internal/web"
)

// New creates and registers all HTTP routes with production middleware.
func New(
	db *storage.DB,
	manager *integrations.Manager,
	claudeAnalyzer *aianalysis.ClaudeAnalyzer,
	heuristicAnalyzer *analysis.HeuristicAnalyzer,
	logger *logging.Logger,
	v *vault.Vault,
	cfgs ...*config.Config,
) http.Handler {
	var cfg *config.Config
	if len(cfgs) > 0 {
		cfg = cfgs[0]
	}

	mux := http.NewServeMux()
	h := handlers.New(db, manager, claudeAnalyzer, heuristicAnalyzer, logger, v, cfg)

	registerRoutes(mux, h)

	// SPA catch-all: any non-API, non-static, non-health route serves dashboard.
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if isAPIRoute(r.URL.Path) {
			http.NotFound(w, r)
			return
		}
		if needsDashboardAuth(r.URL.Path) && !hasValidSession(r) {
			http.Redirect(w, r, "/login/?next="+r.URL.Path, http.StatusSeeOther)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		web.SPAHandler()(w, r)
	})

	allowedOrigins := []string{"*"}
	if cfg != nil && len(cfg.Server.CORSOrigins) > 0 {
		allowedOrigins = cfg.Server.CORSOrigins
	}

	// Wrap entire mux with middleware stack (order matters)
	rl := middleware.NewRateLimiter()
	return middleware.Chain(mux,
		middleware.RecoverPanic(logger),
		middleware.RequestLogger(logger),
		rl.Middleware,
		middleware.AuthRateLimit,
		middleware.MaxBodyBytes(1<<20),
		middleware.SecurityHeaders(),
		middleware.RequestID(),
		middleware.CORS(allowedOrigins),
	)
}
