package routes

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"

	"github.com/sdlc-ai/platform/services/gateway/internal/interfaces/http/handlers"
)

// SetupRoutes configures all the routes for the gateway service
func SetupRoutes(r *chi.Mux, deps *handlers.Dependencies) {
	// Health and system endpoints (no auth required)
	r.Get("/health", handlers.HealthCheck(deps))
	r.Get("/health/ready", handlers.ReadinessCheck(deps))
	r.Get("/health/live", handlers.LivenessCheck(deps))
	r.Get("/version", handlers.GetVersion(deps))

	// API versioning
	r.Route("/api/v1", func(r chi.Router) {
		// Authentication routes (no auth required for login)
		r.Route("/auth", func(r chi.Router) {
			r.Post("/login", handlers.Login(deps))
			r.Post("/logout", handlers.Logout(deps))
			r.Post("/refresh", handlers.RefreshToken(deps))
			r.Get("/me", handlers.GetCurrentUser(deps))
		})

		// Tenant management routes — RBAC: tenants:{read,write,delete}.
		r.Route("/tenants", func(r chi.Router) {
			r.With(rbacGate(deps, "tenants:read")).Get("/", handlers.ListTenants(deps))
			r.With(rbacGate(deps, "tenants:write")).Post("/", handlers.CreateTenant(deps))
			r.With(rbacGate(deps, "tenants:read")).Get("/{id}", handlers.GetTenant(deps))
			r.With(rbacGate(deps, "tenants:write")).Put("/{id}", handlers.UpdateTenant(deps))
			r.With(rbacGate(deps, "tenants:delete")).Delete("/{id}", handlers.DeleteTenant(deps))
		})

		// User management routes — RBAC: users:{read,write,delete}.
		r.Route("/users", func(r chi.Router) {
			r.With(rbacGate(deps, "users:read")).Get("/", handlers.ListUsers(deps))
			r.With(rbacGate(deps, "users:write")).Post("/", handlers.CreateUser(deps))
			r.With(rbacGate(deps, "users:read")).Get("/{id}", handlers.GetUser(deps))
			r.With(rbacGate(deps, "users:write")).Put("/{id}", handlers.UpdateUser(deps))
			r.With(rbacGate(deps, "users:delete")).Delete("/{id}", handlers.DeleteUser(deps))
		})

		// Document management routes — RBAC: documents:{read,write,delete}.
		r.Route("/documents", func(r chi.Router) {
			r.With(rbacGate(deps, "documents:read")).Get("/", handlers.ListDocuments(deps))
			r.With(rbacGate(deps, "documents:write")).Post("/", handlers.UploadDocument(deps))
			r.With(rbacGate(deps, "documents:read")).Get("/{id}", handlers.GetDocument(deps))
			r.With(rbacGate(deps, "documents:write")).Put("/{id}", handlers.UpdateDocument(deps))
			r.With(rbacGate(deps, "documents:delete")).Delete("/{id}", handlers.DeleteDocument(deps))
			r.With(rbacGate(deps, "documents:read")).Get("/{id}/content", handlers.GetDocumentContent(deps))
		})

		// RAG routes — RBAC: rag:{query,ingest}. Read-side query +
		// search share rag:query; ingest is the write path.
		r.Route("/rag", func(r chi.Router) {
			r.With(rbacGate(deps, "rag:query")).Post("/query", handlers.RAGQuery(deps))
			r.With(rbacGate(deps, "rag:ingest")).Post("/ingest", handlers.IngestDocument(deps))
			r.With(rbacGate(deps, "rag:query")).Get("/search", handlers.SearchDocuments(deps))
		})

		// Policy management routes — RBAC: policies:{read,write,deploy}.
		r.Route("/policies", func(r chi.Router) {
			r.With(rbacGate(deps, "policies:read")).Get("/", handlers.ListPolicies(deps))
			r.With(rbacGate(deps, "policies:write")).Post("/", handlers.CreatePolicy(deps))
			r.With(rbacGate(deps, "policies:read")).Get("/{id}", handlers.GetPolicy(deps))
			r.With(rbacGate(deps, "policies:write")).Put("/{id}", handlers.UpdatePolicy(deps))
			r.With(rbacGate(deps, "policies:write")).Delete("/{id}", handlers.DeletePolicy(deps))
			r.With(rbacGate(deps, "policies:deploy")).Post("/{id}/test", handlers.TestPolicy(deps))
		})

		// File routes — share documents:{read,write,delete} since the
		// underlying storage is the same (UploadFile delegates to
		// UploadDocument). /formats is metadata only and stays open.
		r.Route("/files", func(r chi.Router) {
			r.With(rbacGate(deps, "documents:write")).Post("/upload", handlers.UploadFile(deps))
			r.With(rbacGate(deps, "documents:write")).Post("/upload/batch", handlers.UploadMultipleFiles(deps))
			r.With(rbacGate(deps, "documents:read")).Get("/download", handlers.GetFile(deps))
			r.With(rbacGate(deps, "documents:delete")).Delete("/delete", handlers.DeleteFile(deps))
			r.With(rbacGate(deps, "documents:read")).Get("/", handlers.ListFiles(deps))
			r.With(rbacGate(deps, "documents:read")).Get("/exists", handlers.CheckFileExists(deps))
			r.With(rbacGate(deps, "documents:read")).Get("/metadata", handlers.GetFileMetadata(deps))
			r.Get("/formats", handlers.GetSupportedFormats(deps))
		})

		// OpenClaw-compatible memory routes
		handlers.RegisterMemoryRoutes(r)

		// Domain verification + SSO auto-redirect — RBAC:
		// domains:{read,write,delete}.
		r.Route("/domains", func(r chi.Router) {
			r.With(rbacGate(deps, "domains:read")).Get("/", handlers.ListDomains(deps))
			r.With(rbacGate(deps, "domains:write")).Post("/", handlers.RegisterDomain(deps))
			r.With(rbacGate(deps, "domains:write")).Post("/{domain}/verify", handlers.VerifyDomain(deps))
			r.With(rbacGate(deps, "domains:delete")).Delete("/{domain}", handlers.DeleteDomain(deps))
		})

		// SSO auto-redirect by email domain. Public surface (no RBAC)
		// because the caller is anonymous at the login screen; the
		// redirector only succeeds when the email's domain is verified
		// for some tenant.
		r.Get("/sso/start", handlers.SSOStart(deps))
	})

	// API Key management routes — RBAC: api_keys:{read,write,delete}.
	r.Route("/api/v1/api-keys", func(r chi.Router) {
		r.With(rbacGate(deps, "api_keys:read")).Get("/", handlers.ListAPIKeys(deps))
		r.With(rbacGate(deps, "api_keys:write")).Post("/", handlers.CreateAPIKey(deps))
		r.With(rbacGate(deps, "api_keys:read")).Get("/{id}", handlers.GetAPIKey(deps))
		r.With(rbacGate(deps, "api_keys:write")).Put("/{id}", handlers.UpdateAPIKey(deps))
		r.With(rbacGate(deps, "api_keys:delete")).Delete("/{id}", handlers.RevokeAPIKey(deps))
	})

	// Usage and analytics routes — RBAC: usage:read.
	r.Route("/api/v1/usage", func(r chi.Router) {
		r.With(rbacGate(deps, "usage:read")).Get("/tokens", handlers.GetTokenUsage(deps))
		r.With(rbacGate(deps, "usage:read")).Get("/documents", handlers.GetDocumentUsage(deps))
		r.With(rbacGate(deps, "usage:read")).Get("/costs", handlers.GetCostAnalysis(deps))
	})

	// DLP routes — RBAC: dlp:{scan,rules:read,rules:write}.
	r.Route("/api/v1/dlp", func(r chi.Router) {
		r.With(rbacGate(deps, "dlp:scan")).Post("/scan", handlers.ScanContent(deps))
		r.With(rbacGate(deps, "dlp:rules:read")).Get("/rules", handlers.GetDLPRules(deps))
		r.With(rbacGate(deps, "dlp:rules:write")).Post("/rules", handlers.CreateDLPRule(deps))
	})

	// Vector search routes — RBAC: vector:{read,write}.
	r.Route("/api/v1/vector", func(r chi.Router) {
		r.With(rbacGate(deps, "vector:read")).Post("/search", handlers.VectorSearch(deps))
		r.With(rbacGate(deps, "vector:write")).Post("/embeddings", handlers.GenerateEmbeddings(deps))
		r.With(rbacGate(deps, "vector:read")).Get("/indices", handlers.ListIndices(deps))
		r.With(rbacGate(deps, "vector:write")).Post("/indices", handlers.CreateIndex(deps))
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

	// Root endpoint
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		render.JSON(w, r, map[string]interface{}{
			"service":   "SDLC.ai Gateway",
			"version":   deps.Config.Version,
			"status":    "running",
			"api_docs":  "/api/v1",
			"health":    "/health",
			"metrics":   "/metrics",
			"swagger":   "/swagger",
			"timestamp": deps.Config.StartTime,
		})
	})
}
