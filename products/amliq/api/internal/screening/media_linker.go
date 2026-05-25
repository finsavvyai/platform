package screening

import (
	"context"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// MediaLinker matches articles to entities using the screening engine.
type MediaLinker struct {
	engine *FastEngine
}

func NewMediaLinker(engine *FastEngine) *MediaLinker {
	return &MediaLinker{engine: engine}
}

// ArticleInput holds article data for entity matching.
type ArticleInput struct {
	Title       string
	URL         string
	Source      string
	PersonNames []string
	OrgNames    []string
}

// LinkedHit represents an article matched to an entity.
type LinkedHit struct {
	EntityID   string
	EntityName string
	Article    ArticleInput
	Confidence float64
}

// LinkToEntities matches article-mentioned names against entity DB.
func (ml *MediaLinker) LinkToEntities(
	_ context.Context,
	article ArticleInput,
	candidates []domain.Entity,
) []LinkedHit {
	var hits []LinkedHit

	allNames := append(article.PersonNames, article.OrgNames...)
	for _, name := range allNames {
		result := ml.engine.Screen(name, candidates)
		if result.Match && result.Confidence > 0.6 {
			hits = append(hits, LinkedHit{
				EntityName: result.MatchedName,
				Article:    article,
				Confidence: result.Confidence,
			})
		}
	}
	return hits
}

// ToAdverseMediaHit converts a linked hit to a domain media hit.
func (lh LinkedHit) ToAdverseMediaHit(
	tenantID domain.TenantID,
	category domain.MediaCategory,
	severity int,
) (domain.AdverseMediaHit, error) {
	hit, err := domain.NewAdverseMediaHit(
		lh.EntityID, tenantID, category,
		lh.Article.Source, lh.Article.Title,
		lh.Article.URL, severity,
	)
	if err != nil {
		return domain.AdverseMediaHit{}, err
	}
	hit.DetectedAt = time.Now().UTC()
	return hit, nil
}
