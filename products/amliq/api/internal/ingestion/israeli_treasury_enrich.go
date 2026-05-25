package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

func setIsraeliTreasuryFields(ent *domain.Entity, rows [][]string, rowIdx int) {
	// Metadata — dataset & schema
	setMeta(ent, "dataset", "il_treasury")
	if ent.Type == domain.EntityTypeIndividual {
		setMeta(ent, "schemaType", "Person")
	} else {
		setMeta(ent, "schemaType", "Organization")
	}

	// Extract additional fields from the row if available
	if rowIdx >= len(rows) {
		setMeta(ent, "source_url", "https://www.gov.il/en/departments/general/declared_elements_list")
		return
	}

	row := rows[rowIdx]
	if len(row) > 1 {
		// Try to find any address-like data
		for i := 2; i < len(row) && i < 10; i++ {
			if cell := strings.TrimSpace(row[i]); cell != "" && len(cell) > 10 {
				setMeta(ent, "remarks", cell)
				break
			}
		}
	}

	// Source URL
	setMeta(ent, "source_url", "https://www.gov.il/en/departments/general/declared_elements_list")

	// Mark as Israel-based
	if len(ent.Nationalities) == 0 {
		ent.Nationalities = []string{"IL"}
	}
}
