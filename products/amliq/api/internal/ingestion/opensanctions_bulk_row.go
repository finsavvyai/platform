package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

// emitRow invokes the callback for the primary entity (if the row
// yields one) and then for every alias entity expanded from it.
func (p *OpenSanctionsBulkParser) emitRow(
	rec []string, hdr headerIndex, emit EntityEmitter,
) error {
	if ent, ok := p.parseRow(rec, hdr); ok {
		if err := emit(ent); err != nil {
			return err
		}
	}
	for _, alias := range p.parseAliases(rec, hdr) {
		if err := emit(alias); err != nil {
			return err
		}
	}
	return nil
}

// parseRow builds the primary entity for a CSV record. Returns
// (_, false) when the row is missing required fields (id, name) or
// when name normalisation rejects the caption.
func (p *OpenSanctionsBulkParser) parseRow(
	rec []string, hdr headerIndex,
) (domain.Entity, bool) {
	rawID := hdr.get(rec, "id")
	if rawID == "" {
		return domain.Entity{}, false
	}
	typ := mapSchemaType(hdr.get(rec, "schema"))
	// Simple CSV uses "name"; full CSV uses "caption"
	caption := hdr.get(rec, "name", "caption")
	if caption == "" {
		return domain.Entity{}, false
	}
	props := parseProperties(hdr.get(rec, "properties"))
	name := pickName(caption, props)
	if name == "" {
		return domain.Entity{}, false
	}
	return p.buildEntity(rec, hdr, rawID, typ, name, props)
}

func (p *OpenSanctionsBulkParser) buildEntity(
	rec []string, hdr headerIndex,
	rawID string, typ domain.EntityType, name string,
	props map[string][]string,
) (domain.Entity, bool) {
	normalized := NormalizeName(name)
	id, err := domain.NewEntityID(sanitizeBulkID(rawID))
	if err != nil {
		return domain.Entity{}, false
	}
	n, _ := domain.NewName(normalized, "", "", "")
	ent, err := domain.NewEntity(id, typ, []domain.Name{n})
	if err != nil {
		return domain.Entity{}, false
	}
	// Simple CSV uses "dataset"; full CSV uses "datasets"
	ent.ListID = mapDatasetToListID(hdr.get(rec, "dataset", "datasets"))
	setBulkMeta(&ent, props, hdr, rec)
	enrichBulkFromFlatCols(&ent, rec, hdr)
	return ent, true
}
