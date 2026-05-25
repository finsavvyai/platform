package api

import (
	"context"
	"log"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
)

// screenName runs the 6-layer engine against a name.
func (h *TxnScreenHandler) screenName(name string) []domain.MatchResult {
	candidates := searchCandidates(h.entities, name, nil, 0.15)
	if len(candidates) == 0 {
		return nil
	}
	query := screening.BuildQueryEntity(name)
	matches, err := h.engine.Screen(query, candidates)
	if err != nil {
		log.Printf("txn screen error: %v", err)
		return nil
	}
	return filterByThreshold(matches, 0.5)
}

// checkCountryRisk adds FATF flags for sender/receiver countries.
func (h *TxnScreenHandler) checkCountryRisk(
	resp *txnScreenResponse, req TxnScreenRequest,
) {
	if req.SenderCountry != "" {
		if h.fatf.IsBlacklisted(req.SenderCountry) {
			resp.RiskFlags = append(resp.RiskFlags,
				"FATF_BLACKLIST:"+req.SenderCountry)
			resp.Decision = "HELD"
		} else if h.fatf.IsGreylisted(req.SenderCountry) {
			resp.RiskFlags = append(resp.RiskFlags,
				"FATF_GREYLIST:"+req.SenderCountry)
		}
	}
	if req.ReceiverCountry != "" {
		if h.fatf.IsBlacklisted(req.ReceiverCountry) {
			resp.RiskFlags = append(resp.RiskFlags,
				"FATF_BLACKLIST:"+req.ReceiverCountry)
			resp.Decision = "HELD"
		} else if h.fatf.IsGreylisted(req.ReceiverCountry) {
			resp.RiskFlags = append(resp.RiskFlags,
				"FATF_GREYLIST:"+req.ReceiverCountry)
		}
	}
}

// createHoldCase creates a compliance case for a held transaction.
func (h *TxnScreenHandler) createHoldCase(
	ctx context.Context,
	tid domain.TenantID,
	userID string,
	req TxnScreenRequest,
	resp txnScreenResponse,
) string {
	matchedName := ""
	listID := ""
	conf := 0.0
	if len(resp.SenderHits) > 0 {
		hit := resp.SenderHits[0]
		if v, ok := hit["entity_name"].(string); ok {
			matchedName = v
		}
		if v, ok := hit["list_id"].(string); ok {
			listID = v
		}
		if v, ok := hit["confidence"].(float64); ok {
			conf = v
		}
	}

	c, err := domain.NewComplianceCase(
		tid, req.TxnID,
		req.SenderName, matchedName, listID, conf,
	)
	if err != nil {
		log.Printf("txn case create error: %v", err)
		return ""
	}
	if err := h.cases.Create(ctx, c); err != nil {
		log.Printf("txn case persist error: %v", err)
		return ""
	}
	log.Printf("txn HELD: case %s for %s (%.0f%%)",
		c.ID, req.SenderName, conf*100)
	return c.ID
}
