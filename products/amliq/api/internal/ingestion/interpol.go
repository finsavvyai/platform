package ingestion

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// InterpolParser parses Interpol Red Notices JSON API responses.
type InterpolParser struct{}

func NewInterpolParser() *InterpolParser { return &InterpolParser{} }

type interpolResponse struct {
	Embedded struct {
		Notices []interpolNotice `json:"notices"`
	} `json:"_embedded"`
	Total int `json:"total"`
}

type interpolNotice struct {
	EntityID       string   `json:"entity_id"`
	Forename       string   `json:"forename"`
	Name           string   `json:"name"`
	Nationalities  []string `json:"nationalities"`
	DateOfBirth    string   `json:"date_of_birth"`
	PlaceOfBirth   string   `json:"place_of_birth"`
	CountryOfBirth string   `json:"country_of_birth"`
	Sex            string   `json:"sex_id"`
	Height         string   `json:"height"`
	Weight         string   `json:"weight"`
	HairColor      string   `json:"hairs_id"`
	EyeColor       string   `json:"eyes_colors_id"`
	Distinguishing string   `json:"distinguishing_marks"`
	Languages      []string `json:"languages_spoken_ids"`
	Arrest         []struct {
		Charge        string `json:"charge"`
		IssuingCountry string `json:"issuing_country_id"`
	} `json:"arrest_warrants"`
	Links struct {
		Thumbnail struct {
			Href string `json:"href"`
		} `json:"thumbnail"`
	} `json:"_links"`
}

func (p *InterpolParser) Parse(data []byte) ([]domain.Entity, error) {
	var resp interpolResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	var entities []domain.Entity
	for _, n := range resp.Embedded.Notices {
		fullName := strings.TrimSpace(n.Forename + " " + n.Name)
		if fullName == "" || isOneWord(fullName) {
			continue
		}
		entID := sanitizeBulkID("interpol_" + n.EntityID)
		id, err := domain.NewEntityID(entID)
		if err != nil {
			continue
		}
		normalized := NormalizeName(fullName)
		nm, _ := domain.NewName(normalized,
			strings.TrimSpace(n.Forename),
			strings.TrimSpace(n.Name), "")
		ent, err := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{nm})
		if err != nil {
			continue
		}
		ent.ListID = "interpol_red"
		if len(n.Nationalities) > 0 {
			ent.Nationalities = n.Nationalities
		}
		setInterpolFields(&ent, n)
		entities = append(entities, ent)
	}
	return entities, nil
}

// InterpolFetchURL builds the paginated URL for Interpol notices.
func InterpolFetchURL(page, perPage int) string {
	return fmt.Sprintf(
		"https://ws-public.interpol.int/notices/v1/red?page=%d&resultPerPage=%d",
		page, perPage,
	)
}
