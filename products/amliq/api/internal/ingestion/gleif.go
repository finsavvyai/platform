package ingestion

import (
	"encoding/json"
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// GLEIFBaseURL is the GLEIF API for legal entity identifiers.
const GLEIFBaseURL = "https://api.gleif.org/api/v1/lei-records"

// GLEIFParser parses GLEIF API JSON responses.
type GLEIFParser struct{}

// NewGLEIFParser returns the default GLEIF JSON parser.
func NewGLEIFParser() *GLEIFParser { return &GLEIFParser{} }

// Parse unmarshals a single-page GLEIF API response into entities.
func (p *GLEIFParser) Parse(data []byte) ([]domain.Entity, error) {
	var resp gleifResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	var entities []domain.Entity
	for _, rec := range resp.Data {
		if ent, ok := buildGLEIFEntity(rec); ok {
			entities = append(entities, ent)
		}
	}
	return entities, nil
}

func buildGLEIFEntity(rec gleifRecord) (domain.Entity, bool) {
	name := rec.Attributes.Entity.LegalName.Name
	if name == "" || len(name) < 3 {
		return domain.Entity{}, false
	}
	entID := sanitizeBulkID("lei_" + rec.ID)
	id, err := domain.NewEntityID(entID)
	if err != nil {
		return domain.Entity{}, false
	}
	n, _ := domain.NewName(NormalizeName(name), "", "", "")
	ent, err := domain.NewEntity(id, domain.EntityTypeCompany, []domain.Name{n})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = "gleif_lei"
	if j := rec.Attributes.Entity.Jurisdiction; j != "" {
		setMeta(&ent, "jurisdiction", j)
	}
	setMeta(&ent, "lei", rec.ID)
	setGLEIFFields(&ent, rec)
	return ent, true
}

// GLEIFPageURL returns the URL for a specific page of GLEIF results.
func GLEIFPageURL(page, perPage int) string {
	return fmt.Sprintf(
		"%s?page%%5Bnumber%%5D=%d&page%%5Bsize%%5D=%d",
		GLEIFBaseURL, page, perPage,
	)
}

// GLEIFTotal returns the total number of LEI records available.
func GLEIFTotal(data []byte) int {
	var resp gleifResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return 0
	}
	return resp.Meta.Pagination.Total
}
