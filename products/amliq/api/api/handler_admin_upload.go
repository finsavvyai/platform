package api

import (
	"context"
	"io"
	"log"
	"net/http"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/ingestion"
	"github.com/aegis-aml/aegis/internal/storage"
	spgx "github.com/aegis-aml/aegis/internal/storage/pgx"
)

// AdminUploadHandler handles CSV file uploads for data import.
type AdminUploadHandler struct {
	entities storage.EntityRepository
}

func NewAdminUploadHandler(e storage.EntityRepository) *AdminUploadHandler {
	return &AdminUploadHandler{entities: e}
}

// Upload handles POST /api/v1/admin/data-sources/upload.
// Accepts multipart form with "file" field (CSV) and "list_id" field.
func (h *AdminUploadHandler) Upload(
	w http.ResponseWriter, r *http.Request,
) {
	if err := r.ParseMultipartForm(100 << 20); err != nil { // 100MB max
		Error(w, "INVALID", "file too large (max 100MB)", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		Error(w, "INVALID", "file field required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	listID := r.FormValue("list_id")
	if listID == "" {
		listID = "custom_upload"
	}

	data, err := io.ReadAll(file)
	if err != nil {
		Error(w, "READ_ERROR", "failed to read file", http.StatusInternalServerError)
		return
	}

	parser := ingestion.NewICIJParser()
	entities, err := parser.Parse(data)
	if err != nil {
		Error(w, "PARSE_ERROR", "failed to parse CSV", http.StatusBadRequest)
		return
	}

	// Override list_id with user-specified value
	for i := range entities {
		entities[i].ListID = listID
	}

	tenantID := GetTenantID(r)
	tid, _ := domain.NewTenantID(tenantID)

	count := 0
	if pgxRepo, ok := h.entities.(*spgx.EntityRepository); ok {
		batchSize := 1000
		for i := 0; i < len(entities); i += batchSize {
			end := i + batchSize
			if end > len(entities) {
				end = len(entities)
			}
			if err := pgxRepo.BulkUpsert(context.Background(), tid, entities[i:end]); err != nil {
				log.Printf("upload upsert error at %d: %v", i, err)
				break
			}
			count = end
		}
	}

	log.Printf("Uploaded %d entities from %s as list %s", count, header.Filename, listID)
	Success(w, map[string]interface{}{
		"filename":  header.Filename,
		"list_id":   listID,
		"imported":  count,
		"parsed":    len(entities),
	}, http.StatusOK)
}
