package services

import (
	"fmt"
	"strings"

	"github.com/queryflux/backend/internal/domain"
)

func (s *aiService) formatSchema(schema *domain.DatabaseSchema) string {
	if schema == nil || len(schema.Tables) == 0 {
		return "No schema information available."
	}

	var builder strings.Builder
	for _, table := range schema.Tables {
		builder.WriteString(fmt.Sprintf("Table: %s\n", table.Name))

		if len(table.Columns) > 0 {
			builder.WriteString("Columns:\n")
			for _, col := range table.Columns {
				pk := ""
				fk := ""
				for _, pkCol := range table.PrimaryKey {
					if pkCol == col.Name {
						pk = " (PRIMARY KEY)"
						break
					}
				}
				for _, fkObj := range table.ForeignKeys {
					if fkObj.Column == col.Name {
						fk = fmt.Sprintf(" (FOREIGN KEY referencing %s.%s)", fkObj.ReferencesTable, fkObj.ReferencesColumn)
						break
					}
				}
				builder.WriteString(fmt.Sprintf("  - %s: %s%s%s\n", col.Name, col.Type, pk, fk))
			}
		}

		if len(table.Indexes) > 0 {
			builder.WriteString("Indexes:\n")
			for _, idx := range table.Indexes {
				unique := ""
				if idx.Unique {
					unique = " (UNIQUE)"
				}
				builder.WriteString(fmt.Sprintf("  - %s: [%s]%s\n", idx.Name, strings.Join(idx.Columns, ", "), unique))
			}
		}

		builder.WriteString("\n")
	}

	return builder.String()
}
