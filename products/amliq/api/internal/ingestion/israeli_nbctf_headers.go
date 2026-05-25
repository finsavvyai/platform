package ingestion

import (
	"fmt"

	"github.com/aegis-aml/aegis/internal/domain"
)

// parseWithHeaders handles the NBCTF CSV format where row 1 holds
// Hebrew column labels and row 2 holds the English labels we key
// off of. Each data row becomes one domain.Entity.
func (p *NBCTFParser) parseWithHeaders(
	records [][]string, hdr headerIndex,
) ([]domain.Entity, error) {
	var entities []domain.Entity
	for i, rec := range records {
		ent, ok := p.buildFromHeadedRow(i, rec, hdr)
		if !ok {
			continue
		}
		entities = append(entities, ent)
	}
	return entities, nil
}

func (p *NBCTFParser) buildFromHeadedRow(
	idx int, rec []string, hdr headerIndex,
) (domain.Entity, bool) {
	nameEng := hdr.get(rec,
		"Name of Individual - English",
		"Organization Name - English")
	nameHeb := hdr.get(rec,
		"Name of Individual - Hebrew",
		"Organization Name - Hebrew")
	name := pickNBCTFName(nameEng, nameHeb)
	if name == "" {
		return domain.Entity{}, false
	}
	normalized := NormalizeName(name)
	if normalized == "" {
		return domain.Entity{}, false
	}
	entID := sanitizeBulkID(fmt.Sprintf("nbctf_%d", idx))
	id, err := domain.NewEntityID(entID)
	if err != nil {
		return domain.Entity{}, false
	}
	n, _ := domain.NewName(normalized, "", "", "")
	typ := domain.EntityTypeIndividual
	if hdr.get(rec, "Organization Name - English") != "" {
		typ = domain.EntityTypeCompany
	}
	ent, err := domain.NewEntity(id, typ, []domain.Name{n})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.ListID = "israeli_nbctf"
	enrichNBCTFFromHeaders(&ent, rec, hdr)
	if nameHeb != "" && nameHeb != "----" && nameHeb != name {
		setMeta(&ent, "name_heb", nameHeb)
	}
	return ent, true
}

// pickNBCTFName returns the English name when present, otherwise
// the Hebrew name. NBCTF uses "-" / "----" as a sentinel for
// "not supplied" so those get treated as empty.
func pickNBCTFName(eng, heb string) string {
	if eng != "" && eng != "-" && eng != "----" {
		return eng
	}
	if heb != "" && heb != "-" && heb != "----" {
		return heb
	}
	return ""
}
