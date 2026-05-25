package ingestion

import (
	"bufio"
	"bytes"
	"encoding/json"

	"github.com/aegis-aml/aegis/internal/domain"
)

// PEPFTMDataURL is the OpenSanctions PEP FTM JSON-lines feed. Richer
// than targets.simple.csv — carries the full property map per entity
// (birthDate, birthPlace, gender, passportNumber, idNumber, address,
// positionOccupancy, etc.), lifting the DOB coverage ceiling that
// applies when reading the simplified CSV.
const PEPFTMDataURL = "https://data.opensanctions.org/datasets/latest/peps/entities.ftm.json"

// OpenSanctionsPEPFTMParser parses the FTM JSON-lines bulk feed.
type OpenSanctionsPEPFTMParser struct{}

// NewOpenSanctionsPEPFTMParser creates a new FTM parser.
func NewOpenSanctionsPEPFTMParser() *OpenSanctionsPEPFTMParser {
	return &OpenSanctionsPEPFTMParser{}
}

// ftmFullEntity mirrors one line of entities.ftm.json. Only the
// fields we map downstream are declared — extra keys in the JSON
// are ignored by encoding/json.
type ftmFullEntity struct {
	ID         string              `json:"id"`
	Caption    string              `json:"caption"`
	Schema     string              `json:"schema"`
	Datasets   []string            `json:"datasets"`
	FirstSeen  string              `json:"first_seen"`
	LastSeen   string              `json:"last_seen"`
	LastChange string              `json:"last_change"`
	Properties map[string][]string `json:"properties"`
	Target     bool                `json:"target"`
}

// Parse reads FTM JSON lines and returns enriched entities. Only
// Person and LegalEntity/Organization schemas become entities —
// Occupancy/Position/Family/etc. are dropped (they are relationship
// nodes, not targets themselves).
func (p *OpenSanctionsPEPFTMParser) Parse(
	data []byte,
) ([]domain.Entity, error) {
	scanner := bufio.NewScanner(bytes.NewReader(data))
	scanner.Buffer(make([]byte, 1<<20), 1<<24) // up to 16MB per line
	var entities []domain.Entity
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var ent ftmFullEntity
		if err := json.Unmarshal(line, &ent); err != nil {
			continue
		}
		if !isPEPEntitySchema(ent.Schema) {
			continue
		}
		if built, ok := buildFTMEntity(ent); ok {
			entities = append(entities, built)
		}
	}
	if err := scanner.Err(); err != nil {
		return entities, err
	}
	return entities, nil
}

// isPEPEntitySchema returns true for schemas that represent a
// screenable subject (not a relationship or occupancy row).
func isPEPEntitySchema(schema string) bool {
	switch schema {
	case "Person", "LegalEntity", "Organization", "Company":
		return true
	}
	return false
}
