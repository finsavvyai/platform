package domain

import (
	"fmt"
	"time"
)

// Extended media categories.
const (
	MediaSanctions MediaCategory = "sanctions"
	MediaBriberyEx MediaCategory = "bribery"
)

// ReviewStatus tracks analyst review of a media hit.
type ReviewStatus string

const (
	ReviewPending    ReviewStatus = "pending"
	ReviewRelevant   ReviewStatus = "relevant"
	ReviewIrrelevant ReviewStatus = "irrelevant"
	ReviewEscalated  ReviewStatus = "escalated"
)

// MediaHit is an enhanced adverse media finding with NLP fields.
type MediaHit struct {
	ID           string          `json:"id"`
	EntityName   string          `json:"entity_name"`
	Source       string          `json:"source"`
	URL          string          `json:"url"`
	Title        string          `json:"title"`
	Snippet      string          `json:"snippet"`
	PublishedAt  time.Time       `json:"published_at"`
	Language     string          `json:"language"`
	Sentiment    float64         `json:"sentiment"`
	Categories   []MediaCategory `json:"categories"`
	RiskScore    float64         `json:"risk_score"`
	ReviewStatus ReviewStatus    `json:"review_status"`
}

// NewMediaHit creates a validated media hit.
func NewMediaHit(
	entityName, source, url, title, snippet string,
	categories []MediaCategory,
	riskScore float64,
) (MediaHit, error) {
	if entityName == "" || title == "" {
		return MediaHit{}, fmt.Errorf("entity_name and title required")
	}
	if riskScore < 0 {
		riskScore = 0
	}
	if riskScore > 1.0 {
		riskScore = 1.0
	}
	return MediaHit{
		ID:           fmt.Sprintf("mh_%d", time.Now().UnixNano()),
		EntityName:   entityName,
		Source:       source,
		URL:          url,
		Title:        title,
		Snippet:      snippet,
		Categories:   categories,
		RiskScore:    riskScore,
		Language:     "en",
		ReviewStatus: ReviewPending,
		PublishedAt:  time.Now().UTC(),
	}, nil
}

// MarkReviewed sets the review status of a media hit.
func (mh *MediaHit) MarkReviewed(status ReviewStatus) {
	mh.ReviewStatus = status
}
