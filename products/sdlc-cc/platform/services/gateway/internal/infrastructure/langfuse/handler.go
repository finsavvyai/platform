package langfuse

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

// Handler exposes the Langfuse-compatible /api/public/* endpoints.
type Handler struct {
	BasicAuth  AuthResolver
	BearerAuth BearerResolver
	Prompts    PromptStore
	Scores     ScoreSink
	Traces     TraceSink
}

// Mount installs the Langfuse-compatible routes on the supplied chi router.
func (h *Handler) Mount(r chi.Router) {
	r.Route("/api/public", func(r chi.Router) {
		r.Post("/traces", h.postTraces)
		r.Post("/scores", h.postScores)
		r.Get("/prompts", h.getPrompts)
		r.Post("/prompts", h.postPrompt)
	})
}

func (h *Handler) authed(w http.ResponseWriter, r *http.Request) (string, bool) {
	tenant, err := resolveTenant(r, h.BasicAuth, h.BearerAuth)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return "", false
	}
	return tenant, true
}

func (h *Handler) postTraces(w http.ResponseWriter, r *http.Request) {
	tenant, ok := h.authed(w, r)
	if !ok {
		return
	}

	var t Trace
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if h.Traces != nil {
		if err := h.Traces.Record(r.Context(), tenant, t); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	}
	writeJSON(w, http.StatusCreated, IngestEnvelope{
		Successes: []IngestStatus{{ID: t.ID, Status: http.StatusCreated}},
	})
}

func (h *Handler) postScores(w http.ResponseWriter, r *http.Request) {
	tenant, ok := h.authed(w, r)
	if !ok {
		return
	}

	var s Score
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if s.TraceID == "" || s.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "traceId and name required"})
		return
	}
	if h.Scores != nil {
		if err := h.Scores.Record(r.Context(), tenant, s); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	}
	writeJSON(w, http.StatusCreated, IngestEnvelope{
		Successes: []IngestStatus{{ID: s.ID, Status: http.StatusCreated}},
	})
}

func (h *Handler) getPrompts(w http.ResponseWriter, r *http.Request) {
	tenant, ok := h.authed(w, r)
	if !ok {
		return
	}

	if h.Prompts == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "prompt store not configured"})
		return
	}

	name := r.URL.Query().Get("name")
	if name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name query param required"})
		return
	}

	if v := r.URL.Query().Get("version"); v != "" {
		version, err := strconv.Atoi(v)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "version must be int"})
			return
		}
		p, err := h.Prompts.GetVersion(r.Context(), tenant, name, version)
		if errors.Is(err, ErrPromptNotFound) {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "prompt not found"})
			return
		}
		writeJSON(w, http.StatusOK, p)
		return
	}

	p, err := h.Prompts.GetLatest(r.Context(), tenant, name)
	if errors.Is(err, ErrPromptNotFound) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "prompt not found"})
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (h *Handler) postPrompt(w http.ResponseWriter, r *http.Request) {
	tenant, ok := h.authed(w, r)
	if !ok {
		return
	}

	if h.Prompts == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "prompt store not configured"})
		return
	}

	var p Prompt
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	stored, err := h.Prompts.Put(r.Context(), tenant, p)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, stored)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
