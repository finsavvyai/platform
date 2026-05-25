package screening

import (
	"context"
	"log"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

// CaseCreator auto-generates compliance cases from screening results.
type CaseCreator struct {
	cases     storage.CaseRepository
	threshold float64
}

// NewCaseCreator creates a case creator with a confidence threshold.
func NewCaseCreator(cases storage.CaseRepository, threshold float64) *CaseCreator {
	if threshold <= 0 {
		threshold = 0.70
	}
	return &CaseCreator{cases: cases, threshold: threshold}
}

// EvaluateResult checks if a screening result warrants a case.
func (cc *CaseCreator) EvaluateResult(
	ctx context.Context,
	result domain.ScreenResponse,
) error {
	tenantID := result.Request.TenantID
	entityName := result.Request.Entity.PrimaryName().Full
	for _, match := range result.Matches {
		conf := match.Confidence.Score()
		if conf < cc.threshold {
			continue
		}
		matchedName := match.EntityID.String()
		c, err := domain.NewComplianceCase(
			tenantID, result.ID,
			entityName, matchedName,
			match.ListID, conf,
		)
		if err != nil {
			log.Printf("case create error: %v", err)
			continue
		}
		if err := cc.cases.Create(ctx, c); err != nil {
			log.Printf("case persist error: %v", err)
			continue
		}
		log.Printf("auto-created case %s (%.1f%%)", c.ID, conf*100)
	}
	return nil
}
