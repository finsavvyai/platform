//go:build ignore

package routes

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"

	"github.com/sdlc-ai/platform/services/gateway/internal/interfaces/http/handlers"
)

// SetupRoutes configures all the routes for the gateway service
func SetupRoutes(r *chi.Mux, deps *handlers.Dependencies) {
	// API versioning
	r.Route("/api/v1", func(r chi.Router) {
		// Authentication routes
		r.Route("/auth", func(r chi.Router) {
			r.Post("/login", handlers.Login(deps))
			r.Post("/logout", handlers.Logout(deps))
			r.Post("/refresh", handlers.RefreshToken(deps))
			r.Get("/me", handlers.GetCurrentUser(deps))
		})

		// Tenant management routes
		r.Route("/tenants", func(r chi.Router) {
			r.Get("/", handlers.ListTenants(deps))
			r.Post("/", handlers.CreateTenant(deps))
			r.Get("/{id}", handlers.GetTenant(deps))
			r.Put("/{id}", handlers.UpdateTenant(deps))
			r.Delete("/{id}", handlers.DeleteTenant(deps))
		})

		// User management routes
		r.Route("/users", func(r chi.Router) {
			r.Get("/", handlers.ListUsers(deps))
			r.Post("/", handlers.CreateUser(deps))
			r.Get("/{id}", handlers.GetUser(deps))
			r.Put("/{id}", handlers.UpdateUser(deps))
			r.Delete("/{id}", handlers.DeleteUser(deps))
		})

		// Document management routes
		r.Route("/documents", func(r chi.Router) {
			r.Get("/", handlers.ListDocuments(deps))
			r.Post("/", handlers.UploadDocument(deps))
			r.Get("/{id}", handlers.GetDocument(deps))
			r.Put("/{id}", handlers.UpdateDocument(deps))
			r.Delete("/{id}", handlers.DeleteDocument(deps))
			r.Get("/{id}/content", handlers.GetDocumentContent(deps))
		})

		// File upload and storage routes
		r.Route("/files", func(r chi.Router) {
			// Single file upload
			r.Post("/upload", handlers.UploadFile(deps))
			// Multiple files upload
			r.Post("/upload/batch", handlers.UploadMultipleFiles(deps))
			// Get file
			r.Get("/download", handlers.GetFile(deps))
			// Delete file
			r.Delete("/delete", handlers.DeleteFile(deps))
			// List files
			r.Get("/", handlers.ListFiles(deps))
			// Check if file exists
			r.Get("/exists", handlers.CheckFileExists(deps))
			// Get file metadata
			r.Get("/metadata", handlers.GetFileMetadata(deps))
			// Get supported formats
			r.Get("/formats", handlers.GetSupportedFormats(deps))
		})

		// RAG (Retrieval-Augmented Generation) routes
		r.Route("/rag", func(r chi.Router) {
			r.Post("/query", handlers.RAGQuery(deps))
			r.Post("/ingest", handlers.IngestDocument(deps))
			r.Get("/search", handlers.SearchDocuments(deps))
		})

		// Policy management routes
		r.Route("/policies", func(r chi.Router) {
			r.Get("/", handlers.ListPolicies(deps))
			r.Post("/", handlers.CreatePolicy(deps))
			r.Get("/{id}", handlers.GetPolicy(deps))
			r.Put("/{id}", handlers.UpdatePolicy(deps))
			r.Delete("/{id}", handlers.DeletePolicy(deps))
			r.Post("/{id}/test", handlers.TestPolicy(deps))
		})

		// API Key management routes
		r.Route("/api-keys", func(r chi.Router) {
			r.Get("/", handlers.ListAPIKeys(deps))
			r.Post("/", handlers.CreateAPIKey(deps))
			r.Get("/{id}", handlers.GetAPIKey(deps))
			r.Put("/{id}", handlers.UpdateAPIKey(deps))
			r.Delete("/{id}", handlers.RevokeAPIKey(deps))
		})

		// Usage and analytics routes
		r.Route("/usage", func(r chi.Router) {
			r.Get("/tokens", handlers.GetTokenUsage(deps))
			r.Get("/documents", handlers.GetDocumentUsage(deps))
			r.Get("/costs", handlers.GetCostAnalysis(deps))
		})

		// DLP (Data Loss Prevention) routes
		r.Route("/dlp", func(r chi.Router) {
			r.Post("/scan", handlers.ScanContent(deps))
			r.Get("/rules", handlers.GetDLPRules(deps))
			r.Post("/rules", handlers.CreateDLPRule(deps))
		})

		// Vector search routes
		r.Route("/vector", func(r chi.Router) {
			r.Post("/search", handlers.VectorSearch(deps))
			r.Post("/embeddings", handlers.GenerateEmbeddings(deps))
			r.Get("/indices", handlers.ListIndices(deps))
			r.Post("/indices", handlers.CreateIndex(deps))
		})

		// ─── OpenClaw Integration Routes ─────────────────────────
		r.Route("/openclaw", func(r chi.Router) {
			// Gateway status & health
			r.Get("/status", handlers.OpenClawStatus(deps))
			r.Get("/integration", handlers.OpenClawIntegrationStatus(deps))
			r.Get("/sessions", handlers.OpenClawListSessions(deps))

			// Agent hooks & dispatch
			r.Post("/hook", handlers.OpenClawSendHook(deps))
			r.Post("/wake", handlers.OpenClawSendWake(deps))
			r.Post("/dispatch", handlers.OpenClawDispatch(deps))
			r.Post("/message", handlers.OpenClawSendMessage(deps))

			// SDLC-AI bridge events
			r.Route("/events", func(r chi.Router) {
				r.Post("/test-failure", handlers.OpenClawNotifyTestFailure(deps))
				r.Post("/suite-complete", handlers.OpenClawNotifySuiteComplete(deps))
				r.Post("/security-alert", handlers.OpenClawNotifySecurityAlert(deps))
				r.Post("/self-healing", handlers.OpenClawNotifySelfHealing(deps))
				r.Post("/daily-summary", handlers.OpenClawDailySummary(deps))
			})
		})

		// ─── OpenClaw-Compatible Memory Routes ───────────────────
		r.Route("/memory", func(r chi.Router) {
			r.Post("/", handlers.MemoryStore(deps))
			r.Get("/", handlers.MemoryList(deps))
			r.Post("/search", handlers.MemorySearch(deps))
			r.Get("/stats", handlers.MemoryStatsHandler(deps))
			r.Get("/{id}", handlers.MemoryRead(deps))
			r.Delete("/{id}", handlers.MemoryDelete(deps))
			r.Get("/{id}/export", handlers.MemoryExport(deps))
		})
	})

	// Legacy API routes (for backward compatibility)
	r.Route("/api", func(r chi.Router) {
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			render.JSON(w, r, map[string]string{
				"message": "API v1 is available at /api/v1",
				"version": "v1",
			})
		})
	})

	// Static routes and documentation
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		render.JSON(w, r, map[string]interface{}{
			"service":   "SDLC.ai Gateway",
			"version":   deps.Config.Version,
			"status":    "running",
			"api_docs":  "/api/v1",
			"health":    "/health",
			"metrics":   "/metrics",
			"timestamp": deps.Config.StartTime,
		})
	})

	// Additional utility routes
	r.Get("/version", func(w http.ResponseWriter, r *http.Request) {
		render.JSON(w, r, map[string]string{
			"version": deps.Config.Version,
			"commit":  deps.Config.GitCommit,
			"build":   deps.Config.BuildTime,
		})
	})
}
