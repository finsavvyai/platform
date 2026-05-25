package screening

import (
	"math"
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// SourceTier represents news source credibility.
type SourceTier int

const (
	SourceTier1 SourceTier = 1 // Reuters, AP, Bloomberg, FT, WSJ
	SourceTier2 SourceTier = 2 // Major newspapers, BBC, CNN
	SourceTier3 SourceTier = 3 // Regional, blogs, unknown
)

// MediaScorer scores adverse media hits based on credibility, recency, severity.
type MediaScorer struct {
	decayHalfLifeDays float64
}

func NewMediaScorer() *MediaScorer {
	return &MediaScorer{decayHalfLifeDays: 180}
}

// Score computes a composite risk score for a set of media hits.
func (ms *MediaScorer) Score(hits []domain.AdverseMediaHit) float64 {
	if len(hits) == 0 {
		return 0
	}
	total := 0.0
	for _, hit := range hits {
		total += ms.scoreHit(hit)
	}
	// Normalize: multiple sources increase confidence
	sourceFactor := math.Log2(float64(len(hits))+1) / 3.0
	score := (total/float64(len(hits)))*0.7 + sourceFactor*0.3
	return math.Min(score, 1.0)
}

func (ms *MediaScorer) scoreHit(hit domain.AdverseMediaHit) float64 {
	credibility := ms.sourceCredibility(hit.Source)
	recency := ms.recencyDecay(hit.DetectedAt)
	severity := float64(hit.Severity) / 10.0
	return credibility * recency * severity
}

func (ms *MediaScorer) sourceCredibility(source string) float64 {
	tier := classifySource(source)
	switch tier {
	case SourceTier1:
		return 1.0
	case SourceTier2:
		return 0.7
	default:
		return 0.4
	}
}

func (ms *MediaScorer) recencyDecay(detectedAt time.Time) float64 {
	days := time.Since(detectedAt).Hours() / 24
	return math.Pow(0.5, days/ms.decayHalfLifeDays)
}

var tier1Sources = []string{
	"reuters.com", "apnews.com", "bloomberg.com",
	"ft.com", "wsj.com", "nytimes.com",
}

var tier2Sources = []string{
	"bbc.com", "bbc.co.uk", "cnn.com", "theguardian.com",
	"washingtonpost.com", "politico.com", "aljazeera.com",
}

func classifySource(source string) SourceTier {
	lower := strings.ToLower(source)
	for _, s := range tier1Sources {
		if strings.Contains(lower, s) {
			return SourceTier1
		}
	}
	for _, s := range tier2Sources {
		if strings.Contains(lower, s) {
			return SourceTier2
		}
	}
	return SourceTier3
}
