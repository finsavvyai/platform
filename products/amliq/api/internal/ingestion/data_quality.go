package ingestion

import (
	"log"

	"github.com/aegis-aml/aegis/internal/domain"
)

const (
	qualityWeightName        = 0.3
	qualityWeightDOB         = 0.2
	qualityWeightNationality = 0.2
	qualityWeightIdentifiers = 0.2
	qualityWeightAliases     = 0.1
)

// QualityScore computes a 0.0-1.0 quality score for an entity.
// Factors: has name (+0.3), has DOB (+0.2), has nationality (+0.2),
// has identifiers (+0.2), has aliases (+0.1).
func QualityScore(entity domain.Entity) float64 {
	score := 0.0

	if len(entity.Names) > 0 && entity.Names[0].Full != "" {
		score += qualityWeightName
	}

	if entity.DOB != nil {
		score += qualityWeightDOB
	}

	if len(entity.Nationalities) > 0 {
		score += qualityWeightNationality
	}

	if len(entity.Identifiers) > 0 {
		score += qualityWeightIdentifiers
	}

	if len(entity.Names) > 1 {
		score += qualityWeightAliases
	}

	return score
}

// FilterLowQuality removes entities below the minimum quality threshold.
func FilterLowQuality(entities []domain.Entity, minScore float64) []domain.Entity {
	var result []domain.Entity
	filtered := 0

	for _, ent := range entities {
		if QualityScore(ent) >= minScore {
			result = append(result, ent)
		} else {
			filtered++
		}
	}

	if filtered > 0 {
		log.Printf("Filtered %d low-quality entities (below %.2f threshold)",
			filtered, minScore)
	}
	return result
}

// QualityStats summarizes data quality across a set of entities.
type QualityStats struct {
	Total      int     `json:"total"`
	HighCount  int     `json:"high_quality"`
	MedCount   int     `json:"medium_quality"`
	LowCount   int     `json:"low_quality"`
	AvgScore   float64 `json:"avg_score"`
}

// ComputeQualityStats computes quality distribution for entities.
func ComputeQualityStats(entities []domain.Entity) QualityStats {
	stats := QualityStats{Total: len(entities)}
	if len(entities) == 0 {
		return stats
	}

	totalScore := 0.0
	for _, ent := range entities {
		s := QualityScore(ent)
		totalScore += s
		switch {
		case s >= 0.7:
			stats.HighCount++
		case s >= 0.4:
			stats.MedCount++
		default:
			stats.LowCount++
		}
	}
	stats.AvgScore = totalScore / float64(len(entities))
	return stats
}
