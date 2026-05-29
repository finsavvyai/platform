package publicdemo

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
)

// Handler serves POST /api/v1/screen/public-demo. It is wired with a
// preloaded fixture set, a screening engine, and an audit sink. All
// dependencies are required — nil values yield a 500. The embedder
// field is optional: when non-nil, the handler pushes the per-request
// candidate corpus into it before each engine pass so the in-memory
// embedding layer can score against the live candidate set.
type Handler struct {
	fixtures *FixtureSet
	engine   *screening.Engine
	embedder *screening.InMemoryEmbeddingMatcher
	auditor  Auditor
}

// NewHandler returns a Handler with no embedder wired (legacy path).
// Kept for back-compat with callers that build the engine via
// `screening.NewEngine(nil)` and do not want the embedding cascade.
func NewHandler(fs *FixtureSet, eng *screening.Engine, a Auditor) *Handler {
	return NewHandlerWithEmbedding(fs, eng, nil, a)
}

// NewHandlerWithEmbedding returns a Handler wired with an in-memory
// embedding matcher. The engine MUST also be constructed with
// `screening.WithEmbeddingMatcher(emb)` so the cascade reaches the
// embedding layer — passing emb here without the engine option leaves
// the layer dark. Auditor nil is replaced with a stdout WriterAuditor.
func NewHandlerWithEmbedding(
	fs *FixtureSet, eng *screening.Engine,
	emb *screening.InMemoryEmbeddingMatcher, a Auditor,
) *Handler {
	if a == nil {
		a = NewWriterAuditor(nil)
	}
	return &Handler{fixtures: fs, engine: eng, embedder: emb, auditor: a}
}

// ServeHTTP implements http.Handler. It enforces method + JSON shape,
// runs the screening engine over the filtered fixture set, optionally
// enriches with PEP data, and emits exactly one audit row before
// responding.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		writeError(w, http.StatusMethodNotAllowed,
			"method_not_allowed", "only POST is supported")
		return
	}
	req, err := decodeRequest(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	if h.fixtures == nil || h.engine == nil {
		writeError(w, http.StatusInternalServerError,
			"not_ready", "public-demo not initialised")
		return
	}

	start := time.Now()
	resp := h.runScreening(req)
	resp.LatencyMs = time.Since(start).Milliseconds()
	resp.ScreenedAt = time.Now().UTC().Format(time.RFC3339)

	rec := buildAuditRecord(resp, resp.LatencyMs, req.Threshold, req.Lists, req.PEP)
	if err := h.auditor.Emit(r.Context(), rec); err != nil {
		writeError(w, http.StatusInternalServerError,
			"audit_emit_failed", "audit sink rejected the record")
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// runScreening executes the engine cascade over the fixtures and
// assembles the public-demo Response (sans latency/screenedAt, which
// the caller fills in). When the request name is non-Latin or carries
// a known transliteration variant, expandQuery yields multiple variants
// and the engine runs once per variant; results are deduped by entityID
// with max(confidence) via mergeMatches.
func (h *Handler) runScreening(req Request) Response {
	lists := h.fixtures.FilterLists(req.Lists)
	candidates, listByEntityID := toDomainEntities(lists)
	entityIndex := indexEntities(candidates)

	// Feed the in-memory embedding matcher the per-request candidate
	// corpus. Done ONCE before the variant loop because SetCandidates is
	// idempotent and the candidate set doesn't change per variant.
	if h.embedder != nil {
		h.embedder.SetCandidates(collectCandidateNames(candidates))
	}

	var matches []Match
	for _, variant := range expandQuery(req.Name) {
		m := h.screenAgainst(variant, candidates, listByEntityID, entityIndex)
		matches = mergeMatches(matches, m)
	}

	matches = applyThreshold(matches, req.Threshold)
	if req.PEP {
		matches = applyPEPEnrichment(req.Name, matches, h.fixtures.PEPs)
		matches = ensurePEPSurfaced(req.Name, matches, h.fixtures.PEPs)
	}

	return Response{
		Query:     req.Name,
		Matches:   matches,
		RiskLevel: RiskLevel(matches),
	}
}

// screenAgainst is the engine-bound half of runScreening; pulled out
// so handler.go stays under the 200-line cap.
func (h *Handler) screenAgainst(
	name string,
	candidates []domain.Entity,
	listByEntityID map[string]string,
	entityIndex map[string]domain.Entity,
) []Match {
	qe, err := buildQueryEntity(name)
	if err != nil {
		return nil
	}
	results, err := h.engine.Screen(qe, candidates)
	if err != nil {
		return nil
	}
	return projectMatches(results, listByEntityID, entityIndex)
}

// ensurePEPSurfaced guarantees a PEP-positive query still produces at
// least one Match entry carrying the PEP signal, even if the sanctions
// cascade returned zero hits or all were below threshold.
func ensurePEPSurfaced(query string, matches []Match, peps FixtureList) []Match {
	for _, m := range matches {
		if m.PEPStatus.Status != "none" {
			return matches
		}
	}
	if extra, ok := pepOnlyMatch(query, peps); ok {
		return append(matches, extra)
	}
	return matches
}

func indexEntities(ents []domain.Entity) map[string]domain.Entity {
	out := make(map[string]domain.Entity, len(ents))
	for _, e := range ents {
		out[e.ID.String()] = e
	}
	return out
}

func decodeRequest(r *http.Request) (Request, error) {
	var req Request
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		return Request{}, errors.New("malformed JSON body")
	}
	if req.Name == "" {
		return Request{}, errors.New("`name` is required")
	}
	if req.Threshold < 0 || req.Threshold > 1 {
		return Request{}, errors.New("`threshold` must be in [0,1]")
	}
	return req, nil
}

func writeJSON(w http.ResponseWriter, status int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, ErrorResponse{
		Error:   http.StatusText(status),
		Code:    code,
		Message: msg,
	})
}

// Compile-time check.
var _ http.Handler = (*Handler)(nil)

// Suppress unused-import lint when context is only used transitively.
var _ = context.Background
