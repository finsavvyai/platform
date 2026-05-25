package api

import (
	"sort"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/ingestion"
	"github.com/aegis-aml/aegis/internal/screening"
	"github.com/aegis-aml/aegis/internal/storage"
)

type ScreenHandler struct {
	entities   storage.EntityRepository
	screenings storage.ScreeningRepository
	alerts     storage.AlertRepository
	audit      storage.AuditRepository
	tenants    storage.TenantRepository
	engine     *screening.Engine
	// Optional external MCP enricher (Moody's + D&B). nil = disabled,
	// which is the default until WithExternalEnricher is called at
	// router setup. Never gates request flow on enricher availability —
	// it adds signal, not source of truth.
	enricher *ingestion.ExternalEnricher
}

func NewScreenHandler(
	entities storage.EntityRepository,
	screenings storage.ScreeningRepository,
	alerts storage.AlertRepository,
	audit storage.AuditRepository,
	tenants storage.TenantRepository,
	engine *screening.Engine,
) *ScreenHandler {
	return &ScreenHandler{
		entities:   entities,
		screenings: screenings,
		alerts:     alerts,
		audit:      audit,
		tenants:    tenants,
		engine:     engine,
	}
}

// WithExternalEnricher attaches the optional Moody's + D&B MCP
// enricher. Returns the handler for chaining at router setup. Pass
// nil to detach.
func (sh *ScreenHandler) WithExternalEnricher(e *ingestion.ExternalEnricher) *ScreenHandler {
	sh.enricher = e
	return sh
}

type ScreenRequest struct {
	EntityName    string   `json:"entity_name"`
	EntityType    string   `json:"entity_type"`
	TransactionID string   `json:"transaction_id,omitempty"`
	Lists         []string `json:"lists,omitempty"`
	Threshold     float64  `json:"threshold,omitempty"`
}

func filterByThreshold(matches []domain.MatchResult,
	threshold float64) []domain.MatchResult {
	var filtered []domain.MatchResult
	for _, m := range matches {
		score := m.Confidence.Score()
		if score < threshold {
			continue
		}
		// Require multi-layer evidence OR very high confidence (>=95%)
		// Single-layer fuzzy matches at 70-85% are usually noise
		if score < 0.95 && len(m.Evidence) < 2 {
			continue
		}
		filtered = append(filtered, m)
	}
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].Confidence.Score() > filtered[j].Confidence.Score()
	})
	return filtered
}

func (sh *ScreenHandler) buildQueryEntity(name string) (domain.Entity, error) {
	qn, err := domain.NewName(name, "", "", "")
	if err != nil {
		return domain.Entity{}, err
	}
	eid, _ := domain.NewEntityID("ent_query0000000")
	return domain.NewEntity(eid, domain.EntityTypeIndividual, []domain.Name{qn})
}

func filterByEnabledLists(matches []domain.MatchResult,
	enabledLists []domain.ListConfig) []domain.MatchResult {
	if len(enabledLists) == 0 {
		return matches
	}
	enabledMap := make(map[string]bool)
	for _, lc := range enabledLists {
		enabledMap[lc.ListID] = true
	}

	var filtered []domain.MatchResult
	for _, m := range matches {
		if enabledMap[m.ListID] {
			filtered = append(filtered, m)
		}
	}
	return filtered
}
