package ingestion

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

const fbiListID = "fbi_most_wanted"

// FBIMostWantedParser parses the FBI Most Wanted JSON API.
// Source: https://www.fbi.gov/wanted (~500 fugitives + terrorists).
type FBIMostWantedParser struct{}

// NewFBIMostWantedParser creates a new FBI parser.
func NewFBIMostWantedParser() *FBIMostWantedParser {
	return &FBIMostWantedParser{}
}

type fbiResponse struct {
	Items []fbiItem `json:"items"`
}

type fbiItem struct {
	Title           string   `json:"title"`
	Subjects        []string `json:"subjects"`
	Caution         string   `json:"caution"`
	DatesOfBirth    []string `json:"dates_of_birth"`
	Nationality     string   `json:"nationality"`
	UID             string   `json:"uid"`
	Sex             string   `json:"sex"`
	PlaceOfBirth    string   `json:"place_of_birth"`
	Race            string   `json:"race"`
	RaceRaw         string   `json:"race_raw"`
	HeightMin       int      `json:"height_min"`
	HeightMax       int      `json:"height_max"`
	WeightMin       int      `json:"weight_min"`
	WeightMax       int      `json:"weight_max"`
	Eyes            string   `json:"eyes"`
	Hair            string   `json:"hair"`
	Build           string   `json:"build"`
	Complexion      string   `json:"complexion"`
	AgeMin          int      `json:"age_min"`
	AgeMax          int      `json:"age_max"`
	ScarsAndMarks   string   `json:"scars_and_marks"`
	Remarks         string   `json:"remarks"`
	WarningMessage  string   `json:"warning_message"`
	RewardText      string   `json:"reward_text"`
	RewardMin       int      `json:"reward_min"`
	RewardMax       int      `json:"reward_max"`
	Occupations     []string `json:"occupations"`
	Status          string   `json:"status"`
	URL             string   `json:"url"`
	PathID          string   `json:"path_id"`
	PosterClassif   string   `json:"poster_classification"`
	Images          []fbiImg `json:"images"`
	Aliases         []string `json:"aliases"`
	PlacesOfBirth   []string `json:"places_of_birth"`
	Languages       []string `json:"languages"`
}

// fbiImg is the image entry returned by FBI API.
type fbiImg struct {
	Caption  string `json:"caption"`
	Original string `json:"original"`
	Large    string `json:"large"`
	Thumb    string `json:"thumb"`
}

// Parse extracts entities from FBI JSON data.
func (p *FBIMostWantedParser) Parse(data []byte) ([]domain.Entity, error) {
	var resp fbiResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("fbi parse: %w", err)
	}

	var entities []domain.Entity
	for i, item := range resp.Items {
		ent, ok := p.buildEntity(item, i)
		if ok {
			entities = append(entities, ent)
		}
	}
	return entities, nil
}

func (p *FBIMostWantedParser) buildEntity(item fbiItem, idx int) (domain.Entity, bool) {
	if item.Title == "" {
		return domain.Entity{}, false
	}
	normalized := NormalizeName(item.Title)
	if normalized == "" {
		return domain.Entity{}, false
	}

	idBase := fmt.Sprintf("fbi%08d00", idx)
	if item.UID != "" {
		clean := strings.ReplaceAll(item.UID, "-", "")
		if len(clean) >= 12 {
			idBase = clean[:12]
		}
	}
	id, _ := domain.NewEntityID("ent_" + idBase[:12])
	name, _ := domain.NewName(normalized, "", "", "")
	ent, err := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{name})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = fbiListID
	if item.Nationality != "" {
		ent.Nationalities = []string{item.Nationality}
	}
	if len(item.Subjects) > 0 {
		ent.Metadata["subjects"] = strings.Join(item.Subjects, "; ")
	}
	if item.Caution != "" {
		ent.Metadata["caution"] = item.Caution
	}
	setFBIFields(&ent, item)
	return ent, true
}
