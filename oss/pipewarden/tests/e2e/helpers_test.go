package e2e

import (
	"net/http/httptest"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/aianalysis"
	"github.com/finsavvyai/pipewarden/internal/analysis"
	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/integrations"
	"github.com/finsavvyai/pipewarden/internal/logging"
	"github.com/finsavvyai/pipewarden/internal/router"
	"github.com/finsavvyai/pipewarden/internal/storage"
	"github.com/finsavvyai/pipewarden/internal/vault"
	"github.com/stretchr/testify/require"
)

// setupServerWithCfg creates a test HTTP server using the provided pre-built
// dependencies (DB, manager, logger) and a custom config (e.g. webhook secret).
// Callers are responsible for seeding the DB before calling this helper.
func setupServerWithCfg(
	t *testing.T,
	db *storage.DB,
	manager *integrations.Manager,
	logger *logging.Logger,
	cfg *config.Config,
) *httptest.Server {
	t.Helper()

	claudeAnalyzer := aianalysis.NewClaudeAnalyzer(
		aianalysis.ClaudeConfig{APIKey: "", Model: "claude-3-haiku"},
		logger,
	)
	heuristicAnalyzer := analysis.NewHeuristicAnalyzer()

	v, err := vault.New("test-e2e-cfg-key")
	require.NoError(t, err, "failed to create vault")

	mux := router.New(db, manager, claudeAnalyzer, heuristicAnalyzer, logger, v, cfg)

	server := httptest.NewServer(mux)
	t.Cleanup(func() { server.Close() })

	return server
}
