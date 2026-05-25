package ingestion

import (
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func BuildDefaultCountryRiskIndex() *domain.CountryRiskIndex {
	idx := domain.NewCountryRiskIndex()
	now := time.Now().UTC().Format(time.RFC3339)

	for code, cpi := range cpiScores {
		riskScore := 1.0 - (cpi / 100.0)
		entry, err := domain.NewCountryRiskEntry(code, "", riskScore)
		if err != nil {
			continue
		}
		entry.Sources = []string{"transparency_international_cpi"}
		entry.UpdatedAt = now

		if highRisk, ok := fatfHighRiskCountries[code]; ok {
			entry.Score = highRisk
			entry.Level = domain.CountryRiskLevelVeryHigh
			entry.Sources = append(entry.Sources, "fatf_high_risk")
		} else if greyList, ok := fatfGreyListCountries[code]; ok {
			if greyList > entry.Score {
				entry.Score = greyList
			}
			entry.Sources = append(entry.Sources, "fatf_grey_list")
		}

		idx.AddEntry(entry)
	}

	return idx
}
