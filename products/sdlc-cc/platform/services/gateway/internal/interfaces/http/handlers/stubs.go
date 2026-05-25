package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/repositories"
)

// Policy CRUD lives in policies.go (BEAT-PLAN S2.2). TestPolicy stays
// stubbed until the dry-run evaluator wraps PolicyEngine.Evaluate with
// a synthetic input.

// TestPolicy tests a policy against given input
func TestPolicy(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "TestPolicy")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Policy testing not yet implemented", uuid.New().String())
	}
}

// API Key Handlers

// ListAPIKeys lists all API keys
func ListAPIKeys(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "ListAPIKeys")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "API key listing not yet implemented", uuid.New().String())
	}
}

// CreateAPIKey creates a new API key
func CreateAPIKey(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "CreateAPIKey")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "API key creation not yet implemented", uuid.New().String())
	}
}

// GetAPIKey retrieves a specific API key
func GetAPIKey(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "GetAPIKey")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "API key retrieval not yet implemented", uuid.New().String())
	}
}

// UpdateAPIKey updates an existing API key
func UpdateAPIKey(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "UpdateAPIKey")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "API key update not yet implemented", uuid.New().String())
	}
}

// RevokeAPIKey revokes an API key
func RevokeAPIKey(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "RevokeAPIKey")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "API key revocation not yet implemented", uuid.New().String())
	}
}

// Usage Handlers

// GetTokenUsage retrieves token usage statistics
func GetTokenUsage(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "GetTokenUsage")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Token usage retrieval not yet implemented", uuid.New().String())
	}
}

// GetDocumentUsage retrieves document usage statistics
func GetDocumentUsage(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "GetDocumentUsage")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Document usage retrieval not yet implemented", uuid.New().String())
	}
}

// GetCostAnalysis retrieves cost analysis
func GetCostAnalysis(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "GetCostAnalysis")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Cost analysis retrieval not yet implemented", uuid.New().String())
	}
}

// DLP Handlers

// ScanContent scans content for PII and sensitive data
func ScanContent(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "ScanContent")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "DLP content scanning not yet implemented", uuid.New().String())
	}
}

// GetDLPRules retrieves DLP rules
func GetDLPRules(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "GetDLPRules")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "DLP rules retrieval not yet implemented", uuid.New().String())
	}
}

// CreateDLPRule creates a new DLP rule
func CreateDLPRule(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "CreateDLPRule")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "DLP rule creation not yet implemented", uuid.New().String())
	}
}

// Vector Handlers

// VectorSearch performs vector similarity search
func VectorSearch(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "VectorSearch")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Vector search not yet implemented", uuid.New().String())
	}
}

// GenerateEmbeddings generates embeddings for text
func GenerateEmbeddings(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "GenerateEmbeddings")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Embedding generation not yet implemented", uuid.New().String())
	}
}

// ListIndices lists vector indices
func ListIndices(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "ListIndices")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Vector indices listing not yet implemented", uuid.New().String())
	}
}

// CreateIndex creates a new vector index
func CreateIndex(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "CreateIndex")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Vector index creation not yet implemented", uuid.New().String())
	}
}

// Memory Routes (OpenClaw-compatible)

// RegisterMemoryRoutes registers memory-related routes
func RegisterMemoryRoutes(r chi.Router) {
	r.Route("/memory", func(r chi.Router) {
		r.Get("/", func(w http.ResponseWriter, r *http.Request) {
			respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Memory API not yet implemented", uuid.New().String())
		})
		r.Post("/store", func(w http.ResponseWriter, r *http.Request) {
			respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Memory storage not yet implemented", uuid.New().String())
		})
		r.Post("/search", func(w http.ResponseWriter, r *http.Request) {
			respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Memory search not yet implemented", uuid.New().String())
		})
		r.Delete("/{id}", func(w http.ResponseWriter, r *http.Request) {
			respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Memory deletion not yet implemented", uuid.New().String())
		})
	})
}

// File Handlers (delegated to existing file handlers)

// UploadFile handles single file upload
func UploadFile(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Delegate to UploadDocument
		UploadDocument(deps).ServeHTTP(w, r)
	}
}

// UploadMultipleFiles handles batch file upload
func UploadMultipleFiles(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "UploadMultipleFiles")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Batch upload not yet implemented, use single upload", uuid.New().String())
	}
}

// GetFile handles file download
func GetFile(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "GetFile")
		defer span.End()

		// Extract document_id and filename from query params
		documentID := r.URL.Query().Get("document_id")
		filename := r.URL.Query().Get("filename")

		if documentID == "" || filename == "" {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "document_id and filename are required", uuid.New().String())
			return
		}

		// For now, delegate to document content endpoint
		// The client should use GET /documents/{id}/content instead
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Use /documents/{id}/content endpoint instead", uuid.New().String())
	}
}

// DeleteFile handles file deletion
func DeleteFile(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "DeleteFile")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Use DELETE /documents/{id} endpoint instead", uuid.New().String())
	}
}

// ListFiles lists files
func ListFiles(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Delegate to ListDocuments
		ListDocuments(deps).ServeHTTP(w, r)
	}
}

// CheckFileExists checks if a file exists
func CheckFileExists(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "CheckFileExists")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "File existence check not yet implemented", uuid.New().String())
	}
}

// GetFileMetadata gets file metadata
func GetFileMetadata(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "GetFileMetadata")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Use GET /documents/{id} endpoint instead", uuid.New().String())
	}
}

// GetSupportedFormats returns supported file formats
func GetSupportedFormats(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "GetSupportedFormats")
		defer span.End()

		requestID := uuid.New().String()

		formats := []string{
			"application/pdf",
			"application/msword",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"text/plain",
			"text/csv",
			"application/vnd.ms-excel",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"application/vnd.ms-powerpoint",
			"application/vnd.openxmlformats-officedocument.presentationml.presentation",
			"text/markdown",
			"application/json",
		}

		response := map[string]interface{}{
			"success": true,
			"data": map[string]interface{}{
				"supported_formats": formats,
				"max_file_size_mb":  50,
				"max_file_size":     50 * 1024 * 1024,
			},
			"meta": map[string]interface{}{
				"request_id": requestID,
				"timestamp":  timestampNow(),
				"version":    "v1",
			},
		}

		renderJSON(w, http.StatusOK, response)
	}
}

// RepoStub creates a stub repository for testing
type RepoStub struct{}

// NewRepoStub creates a new stub repository
func NewRepoStub() *repositories.RepositoryRegistry {
	return &repositories.RepositoryRegistry{}
}
