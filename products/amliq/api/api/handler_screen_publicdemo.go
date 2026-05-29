package api

import (
	"log"
	"net/http"

	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/screening/publicdemo"
)

// NewPublicDemoHandler returns the fixture-backed public-demo handler
// wired with the process-wide screening engine. The handler is the new
// canonical implementation of POST /api/v1/screen/public-demo:
//   - reads samples/screen/lists/*.json once at startup
//   - re-uses the screening cascade (exact + fuzzy + phonetic + token +
//     in-memory embedding)
//   - expands non-Latin queries (Cyrillic, Arabic) into Latin variants
//     before running the cascade
//   - applies the spec'd risk-level mapping
//   - emits one audit record per request (actor_id=public-demo,
//     event=aml.screen.public_demo)
//
// The embedding layer is the in-process trigram-cosine matcher
// (screening.InMemoryEmbeddingMatcher) — no DB, no network, no API key.
// It is wired into a dedicated engine instance so the production
// shared engine (`eng`) is not affected. On fixture-load failure the
// handler falls back to the legacy DB-backed PublicScreenDemo so
// production deployments without sample data still respond.
func NewPublicDemoHandler(eng *screening.Engine, fallback http.HandlerFunc) http.HandlerFunc {
	fs, err := publicdemo.LoadDefault()
	if err != nil {
		log.Printf("publicdemo: fixture load failed (%v); using fallback", err)
		return fallback
	}
	emb := screening.NewInMemoryEmbeddingMatcher(0, 0)
	demoEng := screening.NewEngine(nil, screening.WithEmbeddingMatcher(emb))
	h := publicdemo.NewHandlerWithEmbedding(fs, demoEng, emb, publicdemo.NewWriterAuditor(nil))
	return ipRateLimited(h.ServeHTTP)
}
