package domain

import (
	"fmt"
	"time"
)

// MediaCategory classifies adverse media findings.
type MediaCategory string

const (
	MediaFinancialCrime   MediaCategory = "financial_crime"
	MediaMoneyLaundering  MediaCategory = "money_laundering"
	MediaTerrorism        MediaCategory = "terrorism"
	MediaFraud            MediaCategory = "fraud"
	MediaBribery          MediaCategory = "bribery_corruption"
	MediaDrugTrafficking  MediaCategory = "drug_trafficking"
	MediaOrganizedCrime   MediaCategory = "organized_crime"
	MediaTaxEvasion       MediaCategory = "tax_evasion"
	MediaCyberCrime       MediaCategory = "cybercrime"
	MediaHumanTrafficking MediaCategory = "human_trafficking"
	MediaEnvironmental    MediaCategory = "environmental_crime"
	MediaRegulatory       MediaCategory = "regulatory_action"
	MediaSexualOffence    MediaCategory = "sexual_offence"
	MediaOther            MediaCategory = "other"
)

// AdverseMediaHit represents a single adverse media finding.
type AdverseMediaHit struct {
	ID         string
	EntityID   string
	TenantID   TenantID
	Category   MediaCategory
	Source     string
	Title      string
	Summary    string
	URL        string
	Severity   int // 1-10
	DetectedAt time.Time
	Reviewed   bool
	ReviewedBy string
}

func NewAdverseMediaHit(
	entityID string, tenantID TenantID,
	category MediaCategory, source, title, url string,
	severity int,
) (AdverseMediaHit, error) {
	if entityID == "" || tenantID.IsZero() {
		return AdverseMediaHit{}, fmt.Errorf("entity and tenant required")
	}
	if severity < 1 || severity > 10 {
		severity = 5
	}
	return AdverseMediaHit{
		ID:         fmt.Sprintf("amh_%d", time.Now().UnixNano()),
		EntityID:   entityID,
		TenantID:   tenantID,
		Category:   category,
		Source:     source,
		Title:      title,
		URL:        url,
		Severity:   severity,
		DetectedAt: time.Now().UTC(),
	}, nil
}
