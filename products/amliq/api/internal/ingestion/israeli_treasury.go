package ingestion

import (
	"bytes"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/xuri/excelize/v2"
)

// Israeli Treasury Sanctions HQ — XLSX format.
const IsraeliTreasuryURL = "https://www.gov.il/BlobFolder/generalpage/declared_elements_list/he/sanctions-headquarters_declared_elements_list-file2-update-022026.xlsx"

// IsraeliTreasuryParser parses the Israeli Treasury sanctions XLSX.
type IsraeliTreasuryParser struct{}

func NewIsraeliTreasuryParser() *IsraeliTreasuryParser {
	return &IsraeliTreasuryParser{}
}

func (p *IsraeliTreasuryParser) Parse(
	data []byte,
) ([]domain.Entity, error) {
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	defer f.Close()

	sheet := f.GetSheetName(0)
	rows, err := f.GetRows(sheet)
	if err != nil {
		return nil, err
	}
	if len(rows) < 2 {
		return nil, nil
	}

	// Find English name column
	hdr := rows[0]
	nameCol := findCol(hdr, "name", "english", "entity")
	if nameCol < 0 && len(rows) > 1 {
		hdr = rows[1]
		nameCol = findCol(hdr, "name", "english", "entity")
	}

	startRow := 1
	if nameCol < 0 {
		nameCol = findFirstNonEmpty(rows, 3)
		startRow = 2
	}
	if nameCol < 0 {
		nameCol = 0
	}

	seen := make(map[string]bool)
	var entities []domain.Entity
	for i := startRow; i < len(rows); i++ {
		if nameCol >= len(rows[i]) {
			continue
		}
		name := strings.TrimSpace(rows[i][nameCol])
		if name == "" || name == "-" || len(name) < 3 {
			continue
		}
		normalized := NormalizeName(name)
		if normalized == "" {
			continue
		}
		entID := sanitizeBulkID(
			"il_treasury_" + strings.ReplaceAll(normalized, " ", "_"),
		)
		if seen[entID] {
			continue // skip duplicate within same file
		}
		seen[entID] = true
		id, err := domain.NewEntityID(entID)
		if err != nil {
			continue
		}
		n, _ := domain.NewName(normalized, "", "", "")
		typ := domain.EntityTypeIndividual
		if !looksLikePerson(name) {
			typ = domain.EntityTypeCompany
		}
		ent, err := domain.NewEntity(id, typ, []domain.Name{n})
		if err != nil {
			continue
		}
		ent.ListID = "israeli_treasury"
		setIsraeliTreasuryFields(&ent, rows, i)
		entities = append(entities, ent)
	}
	return entities, nil
}

