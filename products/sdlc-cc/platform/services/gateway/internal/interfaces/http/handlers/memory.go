//go:build ignore

// Package handlers provides HTTP handlers for memory operations
package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/services"
)

// MemoryHandler handles memory-related HTTP requests
type MemoryHandler struct {
	memoryService *services.MemoryService
	logger        *logrus.Logger
}

// NewMemoryHandler creates a new memory handler
func NewMemoryHandler(memoryService *services.MemoryService, logger *logrus.Logger) *MemoryHandler {
	return &MemoryHandler{
		memoryService: memoryService,
		logger:        logger,
	}
}

// RegisterRoutes registers memory routes
func (h *MemoryHandler) RegisterRoutes(r chi.Router) {
	r.Route("/memory", func(r chi.Router) {
		r.Get("/search", h.SearchMemories)
		r.Post("/", h.CreateMemory)
		r.Get("/{id}", h.GetMemory)
		r.Delete("/{id}", h.DeleteMemory)
		r.Get("/user/{userId}", h.GetUserMemories)
		r.Get("/session/{userId}/{sessionId}", h.GetSessionMemories)
	})
}

// CreateMemoryRequest defines the request body for creating a memory entry
type CreateMemoryRequest struct {
	Type       string                 `json:"type"`
	Content    string                 `json:"content"`
	UserID     string                 `json:"user_id,omitempty"`
	SessionID  string                 `json:"session_id,omitempty"`
	AgentID    string                 `json:"agent_id,omitempty"`
	Importance int                    `json:"importance,omitempty"`
	Tags       []string               `json:"tags,omitempty"`
	ExpiresAt  string                 `json:"expires_at,omitempty"`
	Extra      map[string]interface{} `json:"extra,omitempty"`
}

// SearchMemoriesRequest defines search parameters
type SearchMemoriesRequest struct {
	Query         string   `json:"query"`
	Type          string   `json:"type,omitempty"`
	UserID        string   `json:"user_id,omitempty"`
	SessionID     string   `json:"session_id,omitempty"`
	Tags          []string `json:"tags,omitempty"`
	Limit         int      `json:"limit,omitempty"`
	MinImportance int      `json:"min_importance,omitempty"`
}

// CreateMemory creates a new memory entry
func (h *MemoryHandler) CreateMemory(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("memory").Start(r.Context(), "CreateMemory")
	defer span.End()

	var req CreateMemoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate required fields
	if req.Type == "" {
		h.writeError(w, http.StatusBadRequest, "type is required")
		return
	}
	if req.Content == "" {
		h.writeError(w, http.StatusBadRequest, "content is required")
		return
	}

	// Build metadata
	metadata := services.Metadata{
		UserID:     req.UserID,
		SessionID:  req.SessionID,
		AgentID:    req.AgentID,
		Importance: req.Importance,
		Extra:      req.Extra,
	}

	// Parse expiration
	if req.ExpiresAt != "" {
		// Parse ISO 8601 datetime
		// TODO: proper time parsing
	}

	// Create entry
	entry, err := h.memoryService.Write(ctx, req.Type, req.Content, metadata, req.Tags)
	if err != nil {
		h.logger.WithError(err).Error("Failed to create memory entry")
		h.writeError(w, http.StatusInternalServerError, "Failed to create memory entry")
		return
	}

	h.writeJSON(w, http.StatusCreated, entry)
}

// GetMemory retrieves a memory entry by ID
func (h *MemoryHandler) GetMemory(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("memory").Start(r.Context(), "GetMemory")
	defer span.End()

	id := chi.URLParam(r, "id")
	if id == "" {
		h.writeError(w, http.StatusBadRequest, "id is required")
		return
	}

	entry, err := h.memoryService.Read(ctx, id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			h.writeError(w, http.StatusNotFound, "Memory entry not found")
		} else {
			h.writeError(w, http.StatusInternalServerError, "Failed to read memory")
		}
		return
	}

	h.writeJSON(w, http.StatusOK, entry)
}

// DeleteMemory removes a memory entry
func (h *MemoryHandler) DeleteMemory(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("memory").Start(r.Context(), "DeleteMemory")
	defer span.End()

	id := chi.URLParam(r, "id")
	if id == "" {
		h.writeError(w, http.StatusBadRequest, "id is required")
		return
	}

	if err := h.memoryService.Delete(ctx, id); err != nil {
		if strings.Contains(err.Error(), "not found") {
			h.writeError(w, http.StatusNotFound, "Memory entry not found")
		} else {
			h.writeError(w, http.StatusInternalServerError, "Failed to delete memory")
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// SearchMemories searches for memory entries
func (h *MemoryHandler) SearchMemories(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("memory").Start(r.Context(), "SearchMemories")
	defer span.End()

	query := r.URL.Query().Get("q")
	if query == "" {
		h.writeError(w, http.StatusBadRequest, "query parameter 'q' is required")
		return
	}

	userID := r.URL.Query().Get("user_id")
	sessionID := r.URL.Query().Get("session_id")
	memType := r.URL.Query().Get("type")

	limit := 10
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil {
			limit = l
		}
	}

	req := &services.MemorySearchRequest{
		Query:     query,
		UserID:    userID,
		SessionID: sessionID,
		Type:      memType,
		Limit:     limit,
	}

	results, err := h.memoryService.Search(ctx, req)
	if err != nil {
		h.logger.WithError(err).Error("Failed to search memories")
		h.writeError(w, http.StatusInternalServerError, "Failed to search memories")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"query":   query,
		"count":   len(results),
		"results": results,
	})
}

// GetUserMemories retrieves recent memories for a user
func (h *MemoryHandler) GetUserMemories(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("memory").Start(r.Context(), "GetUserMemories")
	defer span.End()

	userID := chi.URLParam(r, "userId")
	if userID == "" {
		h.writeError(w, http.StatusBadRequest, "userId is required")
		return
	}

	limit := 50
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil {
			limit = l
		}
	}

	entries, err := h.memoryService.GetRecent(ctx, userID, limit)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "Failed to get memories")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"user_id":  userID,
		"count":    len(entries),
		"memories": entries,
	})
}

// GetSessionMemories retrieves all memories for a session
func (h *MemoryHandler) GetSessionMemories(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("memory").Start(r.Context(), "GetSessionMemories")
	defer span.End()

	userID := chi.URLParam(r, "userId")
	sessionID := chi.URLParam(r, "sessionId")

	if userID == "" || sessionID == "" {
		h.writeError(w, http.StatusBadRequest, "userId and sessionId are required")
		return
	}

	entries, err := h.memoryService.GetBySession(ctx, userID, sessionID)
	if err != nil {
		h.writeError(w, http.StatusInternalServerError, "Failed to get session memories")
		return
	}

	h.writeJSON(w, http.StatusOK, map[string]interface{}{
		"user_id":    userID,
		"session_id": sessionID,
		"count":      len(entries),
		"memories":   entries,
	})
}

// writeJSON writes a JSON response
func (h *MemoryHandler) writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// writeError writes an error response
func (h *MemoryHandler) writeError(w http.ResponseWriter, status int, message string) {
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error": message,
	})
}
