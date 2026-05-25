package api

import (
	"encoding/csv"
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

type DatasetHandler struct {
	entities storage.EntityRepository
}

func NewDatasetHandler(entities storage.EntityRepository) *DatasetHandler {
	return &DatasetHandler{entities: entities}
}

func (dh *DatasetHandler) Latest(w http.ResponseWriter, r *http.Request) {
	tenantID := GetTenantID(r)
	if tenantID == "" {
		Error(w, "UNAUTHORIZED", "missing tenant", http.StatusUnauthorized)
		return
	}
	format := QueryParam(r, "format")
	if format == "" {
		format = "csv"
	}

	entities, err := dh.entities.ListAll()
	if err != nil {
		Error(w, "DB_ERROR", "failed to query", http.StatusInternalServerError)
		return
	}

	if format == "json" {
		dh.latestJSON(w, entities)
	} else {
		dh.latestCSV(w, entities)
	}
}

func (dh *DatasetHandler) latestCSV(w http.ResponseWriter, entities []domain.Entity) {
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=sanctions.csv")
	cw := csv.NewWriter(w)
	defer cw.Flush()

	headers := []string{
		"entity_id", "primary_name", "aliases",
		"type", "dob", "nationalities",
		"countries", "identifiers", "sanctions_programs",
		"remarks", "list_id", "last_updated",
	}
	cw.Write(headers)

	for _, e := range entities {
		cw.Write([]string{
			e.ID.String(),
			e.PrimaryName().Full,
			formatAliases(e),
			e.Type.String(),
			formatDOB(e.DOB),
			formatStringSlice(e.Nationalities),
			formatStringSlice(e.Addresses),
			formatIdentifiers(e.Identifiers),
			metadataString(e.Metadata, "sanctions_programs"),
			metadataString(e.Metadata, "remarks"),
			e.ListID,
			e.UpdatedAt.Format(time.RFC3339),
		})
	}
}

func (dh *DatasetHandler) latestJSON(w http.ResponseWriter, entities []domain.Entity) {
	w.Header().Set("Content-Type", "application/json")
	Success(w, entities, http.StatusOK)
}
