package api

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/ingestion"
	"github.com/aegis-aml/aegis/internal/screening"
	spgx "github.com/aegis-aml/aegis/internal/storage/pgx"
)

func (sh *ScreenHandler) Screen(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		Error(w, "METHOD_NOT_ALLOWED", "use POST", http.StatusMethodNotAllowed)
		return
	}

	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "MISSING_AUTH", "invalid or missing claims",
			http.StatusUnauthorized)
		return
	}

	tid, err := domain.NewTenantID(claims.TenantID)
	if err != nil {
		Error(w, "INVALID_TENANT", err.Error(), http.StatusBadRequest)
		return
	}

	var req ScreenRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, "INVALID_REQUEST", "failed to decode body",
			http.StatusBadRequest)
		return
	}

	if req.EntityName == "" {
		Error(w, "MISSING_FIELD", "entity_name required",
			http.StatusBadRequest)
		return
	}

	tenant, err := sh.tenants.GetByID(tid)
	if err != nil {
		log.Printf("screen: tenant lookup failed for %s: %v", tid, err)
		Error(w, "DB_ERROR", "internal error", http.StatusInternalServerError)
		return
	}
	if tenant == nil {
		Error(w, "NOT_FOUND", "tenant not found", http.StatusNotFound)
		return
	}

	threshold := tenant.Config.DefaultThreshold
	if req.Threshold > 0 {
		threshold = req.Threshold
	}

	start := time.Now()

	// Tier 1: in-memory index (instant, 68K entities)
	matches, memErr := sh.engine.ScreenByName(
		req.EntityName, screening.SearchOpts{Limit: 50},
	)

	// Tier 2: DB trigram search (full 1M+ dataset)
	// Always try DB if in-memory found nothing or errored
	if memErr != nil || len(matches) == 0 {
		dbMatches := sh.searchDB(r, req.EntityName, threshold)
		if len(dbMatches) > 0 {
			matches = dbMatches
		}
	}

	filtered := filterByThreshold(matches, threshold)

	// External MCP enrichment (Moody's + D&B) — optional, opt-in
	// at router setup via WithExternalEnricher. Runs in parallel
	// against the upstream tools. Failures don't drop local results;
	// we attach whatever returned and log per-source errors.
	enrichment := sh.maybeEnrich(r.Context(), req)

	qe, _ := sh.buildQueryEntity(req.EntityName)
	screenReq, _ := domain.NewScreenRequest(tid, qe)
	screenResp := domain.NewScreenResponse(screenReq)
	screenResp.Matches = filtered
	screenResp.ProcessingTime = time.Since(start)
	if enrichment != nil {
		log.Printf("screen-enrich: %s — moodys=%d dnb=%v errors=%d",
			req.EntityName, len(enrichment.MoodysMatches),
			enrichment.DnBHierarchy != nil, len(enrichment.Errors))
	}
	if err := sh.screenings.Create(screenResp); err != nil {
		log.Printf("screen: save failed for %s: %v", tid, err)
	}
	trackScreen(tid, sh.screenings)
	sh.createScreeningAuditsAndAlerts(tid, screenResp, claims.UserID)
	elapsed := screenResp.ProcessingTime.Milliseconds()
	hydrated := hydrateMatchEntities(filtered, sh.entities)
	Success(w, buildDemoResponse(req.EntityName, filtered, elapsed, hydrated), http.StatusOK)
}

// maybeEnrich runs the external MCP enricher when configured and
// returns nil otherwise. 5s timeout caps the side-channel — local
// screening already determined the user's headline answer.
func (sh *ScreenHandler) maybeEnrich(ctx context.Context, req ScreenRequest) *ingestion.EnrichmentResult {
	if sh.enricher == nil || !sh.enricher.IsConfigured() {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	res := sh.enricher.EnrichEntity(ctx, ingestion.EnricherInput{
		Name:       req.EntityName,
		EntityType: req.EntityType,
		// DUNS not in ScreenRequest yet — extend the request schema
		// when D&B becomes a hot path.
	})
	return &res
}

func (sh *ScreenHandler) searchDB(
	r *http.Request, name string, _ float64,
) []domain.MatchResult {
	pgxRepo, ok := sh.entities.(*spgx.EntityRepository)
	if !ok {
		return nil
	}
	// QuickSearch uses ILIKE (indexed) — much faster than trigram similarity
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cands, err := pgxRepo.QuickSearch(ctx, name, 50)
	if err != nil || len(cands) == 0 {
		log.Printf("screen-db: %s — %d candidates (err=%v)", name, len(cands), err)
		return nil
	}
	log.Printf("screen-db: %s — %d candidates from trigram", name, len(cands))
	qName, _ := domain.NewName(name, "", "", "")
	eid, _ := domain.NewEntityID("ent_query0000000")
	query, _ := domain.NewEntity(eid, domain.EntityTypeIndividual, []domain.Name{qName})
	results, _ := sh.engine.Screen(query, cands)
	return results
}
