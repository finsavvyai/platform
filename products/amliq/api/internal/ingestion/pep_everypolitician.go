package ingestion

import (
	"encoding/json"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// EveryPoliticianParser parses Wikidata-sourced current officeholders.
type EveryPoliticianParser struct{}

func NewEveryPoliticianParser() *EveryPoliticianParser {
	return &EveryPoliticianParser{}
}

type epPerson struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Role   string `json:"role"`
	Area   string `json:"area"`
	Group  string `json:"group"`
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
}

// Parse reads EveryPolitician JSON and returns PEP profiles.
func (p *EveryPoliticianParser) Parse(data []byte) []domain.PEPProfile {
	var persons []epPerson
	if err := json.Unmarshal(data, &persons); err != nil {
		// Try JSON lines format
		for _, line := range strings.Split(string(data), "\n") {
			if line == "" {
				continue
			}
			var person epPerson
			if err := json.Unmarshal([]byte(line), &person); err == nil {
				persons = append(persons, person)
			}
		}
	}

	var profiles []domain.PEPProfile
	for _, person := range persons {
		if person.Name == "" {
			continue
		}
		tier := classifyTier(person.Role)
		profile := domain.NewPEPProfile(person.ID, tier, person.Role, person.Area)
		profile.ActiveFrom = person.StartDate
		profile.ActiveTo = person.EndDate
		profile.IsActive = person.EndDate == ""
		profiles = append(profiles, profile)
	}
	return profiles
}
