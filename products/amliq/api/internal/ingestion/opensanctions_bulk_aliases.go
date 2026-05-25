package ingestion

import (
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// parseAliases creates separate entities for each alias name present
// on the source row. Each alias becomes its own matchable entity
// sharing the source row's schema type and list ID.
func (p *OpenSanctionsBulkParser) parseAliases(
	rec []string, hdr headerIndex,
) []domain.Entity {
	rawID := hdr.get(rec, "id")
	aliasStr := hdr.get(rec, "aliases")
	if rawID == "" || aliasStr == "" {
		return nil
	}
	typ := mapSchemaType(hdr.get(rec, "schema"))
	listID := mapDatasetToListID(hdr.get(rec, "dataset", "datasets"))
	aliases := strings.Split(aliasStr, ";")
	var entities []domain.Entity
	for i, alias := range aliases {
		if ent, ok := buildAliasEntity(rawID, alias, i, typ, listID); ok {
			entities = append(entities, ent)
		}
	}
	return entities
}

func buildAliasEntity(
	rawID, alias string, i int, typ domain.EntityType, listID string,
) (domain.Entity, bool) {
	alias = strings.TrimSpace(alias)
	if alias == "" || len(alias) < 3 {
		return domain.Entity{}, false
	}
	normalized := NormalizeName(alias)
	if normalized == "" || isOneWord(normalized) {
		return domain.Entity{}, false
	}
	id, err := domain.NewEntityID(
		sanitizeBulkID(fmt.Sprintf("%s_a%d", rawID, i)),
	)
	if err != nil {
		return domain.Entity{}, false
	}
	n, _ := domain.NewName(normalized, "", "", "")
	ent, err := domain.NewEntity(id, typ, []domain.Name{n})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = listID
	return ent, true
}
