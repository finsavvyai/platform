package ingestion

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// NestedDataURL is the OpenSanctions FtM JSON-lines feed. One
// entity per line with the full property set + relationships.
const NestedDataURL = "https://data.opensanctions.org/datasets/latest/default/entities.ftm.json"

// OpenSanctionsNestedParser streams the OpenSanctions FtM JSON feed.
type OpenSanctionsNestedParser struct{}

func NewOpenSanctionsNestedParser() *OpenSanctionsNestedParser {
	return &OpenSanctionsNestedParser{}
}

// nestedRow mirrors a single line in the FtM JSON-lines feed.
type nestedRow struct {
	ID         string              `json:"id"`
	Caption    string              `json:"caption"`
	Schema     string              `json:"schema"`
	Properties map[string][]string `json:"properties"`
	Datasets   []string            `json:"datasets"`
	FirstSeen  string              `json:"first_seen"`
	LastSeen   string              `json:"last_seen"`
	LastChange string              `json:"last_change"`
	Referents  []string            `json:"referents"`
}

func (p *OpenSanctionsNestedParser) Parse(
	data []byte,
) ([]domain.Entity, error) {
	scanner := bufio.NewScanner(bytes.NewReader(data))
	scanner.Buffer(make([]byte, 1<<20), 8<<20)
	var entities []domain.Entity
	for scanner.Scan() {
		line := bytes.TrimSpace(scanner.Bytes())
		if len(line) == 0 {
			continue
		}
		if ent, ok := parseNestedLine(line); ok {
			entities = append(entities, ent)
		}
	}
	return entities, scanner.Err()
}

// ParseStream implements StreamParser for the OpenSanctions nested FtM
// JSON-lines feed. Memory: one JSON line + one domain.Entity at a time.
func (p *OpenSanctionsNestedParser) ParseStream(
	r io.Reader, emit EntityEmitter,
) error {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 1<<20), 8<<20)
	for scanner.Scan() {
		line := bytes.TrimSpace(scanner.Bytes())
		if len(line) == 0 {
			continue
		}
		if ent, ok := parseNestedLine(line); ok {
			if err := emit(ent); err != nil {
				return err
			}
		}
	}
	return scanner.Err()
}

func parseNestedLine(line []byte) (domain.Entity, bool) {
	var row nestedRow
	if err := json.Unmarshal(line, &row); err != nil {
		return domain.Entity{}, false
	}
	if row.ID == "" {
		return domain.Entity{}, false
	}
	name := pickNestedName(row)
	if name == "" {
		return domain.Entity{}, false
	}
	typ := mapSchemaType(row.Schema)
	id, err := domain.NewEntityID(sanitizeBulkID(row.ID))
	if err != nil {
		return domain.Entity{}, false
	}
	first, family, script := nestedNameParts(row.Properties)
	n, _ := domain.NewName(NormalizeName(name), first, family, script)
	ent, err := domain.NewEntity(id, typ, []domain.Name{n})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = mapDatasetToListID(strings.Join(row.Datasets, ","))
	enrichBulkFromProps(&ent, row.Properties)
	enrichNestedMeta(&ent, row)
	return ent, true
}

// nestedNameParts pulls given / family / original-script name
// components out of the OpenSanctions property bag when present.
func nestedNameParts(props map[string][]string) (first, family, script string) {
	first = firstPropOf(props, "firstName", "givenName")
	family = firstPropOf(props, "lastName", "fatherName", "surname")
	script = firstPropOf(props, "originalScript", "nameOriginal", "altName")
	return
}

func firstPropOf(props map[string][]string, keys ...string) string {
	for _, k := range keys {
		if vals := props[k]; len(vals) > 0 && strings.TrimSpace(vals[0]) != "" {
			return strings.TrimSpace(vals[0])
		}
	}
	return ""
}

func pickNestedName(row nestedRow) string {
	if row.Caption != "" {
		return row.Caption
	}
	if names := row.Properties["name"]; len(names) > 0 {
		return names[0]
	}
	return ""
}
